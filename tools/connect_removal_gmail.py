#!/usr/bin/env python3
"""Connect a dedicated removal-only Gmail through a bounded desktop OAuth flow."""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import math
import os
import re
from pathlib import Path
import secrets
import ssl
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, HTTPSHandler
import webbrowser

import configure_removal_mailbox as private

AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
IDENTITY_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
GMAIL_READONLY = 'https://www.googleapis.com/auth/gmail.readonly'
SCOPES = frozenset({'openid', 'email', GMAIL_READONLY})
GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send'
SEND_SCOPES = SCOPES | {GMAIL_SEND}
SCOPE_ALIASES = {'https://www.googleapis.com/auth/userinfo.email': 'email'}
MAX_RESPONSE = 65536
TOKEN_FILE = 'gmail-oauth.json'


class OAuthError(Exception):
    """Public error messages contain no provider response, codes, or credentials."""


class IdentityMismatch(OAuthError):
    pass


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, url):
        return None


def _secret(value: object, maximum: int = 8192) -> bool:
    return isinstance(value, str) and 0 < len(value) <= maximum and not any(ord(c) < 32 or ord(c) == 127 for c in value)


def _path(path: Path) -> Path:
    path = Path(path).expanduser().absolute()
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise OAuthError('Use original private files without symbolic links.')
    if private.ROOT == path.resolve() or private.ROOT in path.resolve().parents:
        raise OAuthError('Keep OAuth credentials outside the source repository.')
    return path


def load_client(path: Path) -> dict:
    path = _path(path)
    try:
        private._regular(path)
        if path.stat().st_size > MAX_RESPONSE:
            raise ValueError()
        source = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(source, dict) or set(source) != {'installed'} or not isinstance(source['installed'], dict):
            raise ValueError()
        client = source['installed']
        if (not _secret(client.get('client_id'), 512) or not client['client_id'].endswith('.apps.googleusercontent.com')
                or not _secret(client.get('client_secret'), 512)
                or client.get('auth_uri') not in {AUTH_URL, 'https://accounts.google.com/o/oauth2/auth'} or client.get('token_uri') != TOKEN_URL):
            raise ValueError()
        return {'client_id': client['client_id'], 'client_secret': client['client_secret']}
    except (OSError, ValueError, TypeError, UnicodeError):
        raise OAuthError('Use a private, owner-only Google Desktop OAuth client JSON file.') from None


def validate_mailbox(mailbox: str, personal_email: str) -> str:
    try:
        canonical = private.canonical_email(mailbox)
        if mailbox.casefold().rsplit('@', 1)[-1] not in {'gmail.com', 'googlemail.com'}:
            raise ValueError()
        local = mailbox.split('@')[0]
        if '+' in local or len(local) > 25 or not private.EMAIL_RE.fullmatch(mailbox):
            raise ValueError()
        if canonical == private.canonical_email(personal_email):
            raise ValueError()
        return mailbox.casefold()
    except (ValueError, TypeError, AttributeError):
        raise OAuthError('Use a separate, untagged removal-only Gmail account, not the personal inbox or an alias.') from None


def pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode('ascii')).digest()).rstrip(b'=').decode('ascii')
    return verifier, challenge


def authorization_url(client: dict, mailbox: str, redirect_uri: str, state: str, challenge: str,
                      *, allow_sending=False) -> str:
    if type(allow_sending) is not bool:
        raise OAuthError('Choose the optional sending permission explicitly.')
    requested = SEND_SCOPES if allow_sending else SCOPES
    return AUTH_URL + '?' + urlencode({
        'client_id': client['client_id'], 'redirect_uri': redirect_uri, 'response_type': 'code',
        'scope': ' '.join(sorted(requested)), 'state': state, 'code_challenge': challenge,
        'code_challenge_method': 'S256', 'login_hint': mailbox, 'access_type': 'offline',
        'prompt': 'consent select_account', 'include_granted_scopes': 'false',
    })


def callback_code(path: str, host: str, port: int, expected_state: str) -> str | None:
    """Untrusted callbacks never choose an endpoint or provide usable credentials."""
    try:
        parsed = urlsplit(path)
        if (host != f'127.0.0.1:{port}' or parsed.scheme or parsed.netloc or parsed.fragment
                or parsed.path != '/oauth/callback' or len(path) > 16384):
            return None
        query = parse_qs(parsed.query, keep_blank_values=True, strict_parsing=True, max_num_fields=12)
        states = query.get('state', [])
        if len(states) != 1 or not hmac.compare_digest(states[0], expected_state):
            return None
        if 'error' in query:
            raise OAuthError('Google authorization was not completed.')
        codes = query.get('code', [])
        if len(codes) != 1 or not _secret(codes[0], 4096):
            return None
        return codes[0]
    except (ValueError, TypeError):
        return None


class OAuthReceiver:
    def __init__(self, state: str, timeout: float = 120):
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not 0 < timeout <= 120:
            raise OAuthError('Authorization must finish within 120 seconds.')
        self.state = state
        self.deadline = time.monotonic() + timeout
        self.code = None
        self.error = None
        receiver = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                try:
                    code = callback_code(self.path, self.headers.get('Host', ''), self.server.server_port, receiver.state)
                    if code and receiver.code is None:
                        receiver.code = code
                    status = 200 if code else 400
                except OAuthError:
                    receiver.error = OAuthError('Google authorization was not completed.')
                    status = 400
                message = b'Authorization received. Return to Erase Me.' if status == 200 else b'Authorization could not be completed. Return to Erase Me.'
                self.send_response(status)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Referrer-Policy', 'no-referrer')
                self.send_header('Content-Security-Policy', "default-src 'none'")
                self.send_header('Content-Length', str(len(message)))
                self.end_headers()
                self.wfile.write(message)

        class LoopbackServer(HTTPServer):
            def get_request(self):
                connection, address = super().get_request()
                connection.settimeout(max(0.01, min(5, receiver.deadline - time.monotonic())))
                return connection, address

        self.server = LoopbackServer(('127.0.0.1', 0), Handler)
        self.redirect_uri = f'http://127.0.0.1:{self.server.server_port}/oauth/callback'

    def __enter__(self):
        return self

    def wait(self) -> str:
        while self.code is None and self.error is None:
            remaining = self.deadline - time.monotonic()
            if remaining <= 0:
                raise OAuthError('Google authorization timed out. Start a new connection when ready.')
            self.server.timeout = min(0.5, remaining)
            self.server.handle_request()
        if self.error:
            raise self.error
        return self.code

    def __exit__(self, *args):
        self.server.server_close()


def request_json(url: str, *, form: dict | None = None, bearer: str | None = None) -> dict:
    if url not in {TOKEN_URL, IDENTITY_URL, REVOKE_URL}:
        raise OAuthError('An OAuth endpoint was refused.')
    headers = {'Accept': 'application/json'}
    data = None
    if form is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        data = urlencode(form).encode('ascii')
    if bearer:
        headers['Authorization'] = 'Bearer ' + bearer
    request = Request(url, data=data, headers=headers)
    try:
        opener = build_opener(_NoRedirect(), HTTPSHandler(context=ssl.create_default_context()))
        with opener.open(request, timeout=15) as response:
            raw = response.read(MAX_RESPONSE + 1)
        if len(raw) > MAX_RESPONSE:
            raise ValueError()
        result = json.loads(raw or b'{}')
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except (OSError, HTTPError, URLError, ValueError, UnicodeError):
        raise OAuthError('Google could not complete the requested authorization step. No provider details were logged.') from None


def scopes(value: object, *, expected=SCOPES) -> frozenset[str]:
    if not isinstance(value, str):
        raise OAuthError('The granted permissions could not be verified.')
    result = frozenset(SCOPE_ALIASES.get(part, part) for part in value.split())
    if expected not in (SCOPES, SEND_SCOPES) or result != expected:
        raise OAuthError('Only the explicitly requested identity and Gmail permissions are allowed.')
    return result


def tokens(response: dict, *, previous: dict | None = None, now: float | None = None,
           expected=SCOPES) -> dict:
    if not isinstance(response, dict):
        raise OAuthError('Google did not return valid read-only credentials.')
    granted = response.get('scope')
    if granted is None and previous is not None:
        granted = ' '.join(sorted(expected))
    scopes(granted, expected=expected)
    access, refresh = response.get('access_token'), response.get('refresh_token')
    if refresh is None and previous is not None:
        refresh = previous['refresh_token']
    lifetime = response.get('expires_in')
    if (not isinstance(response.get('token_type'), str) or response['token_type'].casefold() != 'bearer' or not _secret(access) or not _secret(refresh)
            or isinstance(lifetime, bool) or not isinstance(lifetime, (int, float)) or not math.isfinite(lifetime)
            or not 0 < lifetime <= 86400):
        raise OAuthError('Google did not issue the required offline read-only credentials.')
    return {'access_token': access, 'refresh_token': refresh, 'expires_at': (time.time() if now is None else now) + lifetime}


def revoke(response: dict, request=request_json) -> None:
    if not isinstance(response, dict):
        return
    credential = response.get('refresh_token') or response.get('access_token')
    if not _secret(credential):
        return
    try:
        request(REVOKE_URL, form={'token': credential})
    except Exception:
        pass


def identity(access_token: str, mailbox: str, *, request=request_json) -> dict:
    result = request(IDENTITY_URL, bearer=access_token)
    try:
        if (result.get('email_verified') is not True or not _secret(result.get('sub'), 255)
                or private.canonical_email(result['email']) != private.canonical_email(mailbox)):
            raise ValueError()
    except (KeyError, ValueError, TypeError, AttributeError):
        raise IdentityMismatch('The selected Google account does not match the dedicated removal mailbox. No Gmail data was accessed.') from None
    return {'email': result['email'].casefold(), 'sub': result['sub'], 'email_verified': True}


def validate_config(data: object) -> dict:
    try:
        keys = {'version', 'provider', 'mailbox', 'personal_email_sha256', 'client', 'tokens', 'scopes', 'identity', 'connected_at'}
        if not isinstance(data, dict) or set(data) != keys or type(data['version']) is not int or data['version'] != 1 or data['provider'] != 'gmail_oauth':
            raise ValueError()
        if not isinstance(data['personal_email_sha256'], str) or not re.fullmatch(r'[a-f0-9]{64}', data['personal_email_sha256']):
            raise ValueError()
        mailbox = data['mailbox']
        canonical = private.canonical_email(mailbox)
        if mailbox.rsplit('@', 1)[-1] not in {'gmail.com', 'googlemail.com'} or '+' in mailbox.split('@')[0] or len(mailbox.split('@')[0]) > 25:
            raise ValueError()
        if private.personal_digest(mailbox) == data['personal_email_sha256']:
            raise ValueError()
        client, token, owner = data['client'], data['tokens'], data['identity']
        if (not isinstance(client, dict) or set(client) != {'client_id', 'client_secret'} or not _secret(client['client_id'], 512)
                or not client['client_id'].endswith('.apps.googleusercontent.com') or not _secret(client['client_secret'], 512)):
            raise ValueError()
        if (not isinstance(token, dict) or set(token) != {'access_token', 'refresh_token', 'expires_at'}
                or not _secret(token['access_token']) or not _secret(token['refresh_token'])
                or isinstance(token['expires_at'], bool) or not isinstance(token['expires_at'], (int, float))
                or not math.isfinite(token['expires_at'])):
            raise ValueError()
        if (not isinstance(data['scopes'], list) or frozenset(data['scopes']) not in (SCOPES, SEND_SCOPES)
                or len(data['scopes']) != len(frozenset(data['scopes']))
                or not isinstance(owner, dict) or set(owner) != {'email', 'sub', 'email_verified'}
                or owner['email_verified'] is not True or not _secret(owner['sub'], 255)
                or private.canonical_email(owner['email']) != canonical):
            raise ValueError()
        connected = datetime.fromisoformat(data['connected_at'])
        if connected.tzinfo is None:
            raise ValueError()
        return json.loads(json.dumps(data))
    except (ValueError, TypeError, KeyError, AttributeError):
        raise OAuthError('The private OAuth configuration is invalid or does not describe a separate read-only mailbox.') from None


def save_config(path: Path, data: dict, *, replace: bool = False) -> None:
    data = validate_config(data)
    path = _path(path)
    if path.name != TOKEN_FILE:
        raise OAuthError('Use the dedicated gmail-oauth.json token file.')
    try:
        directory = private.safe_directory(path.parent, create=True)
        if path.exists() or path.is_symlink():
            private._regular(path)
            if not replace:
                raise OAuthError('OAuth credentials already exist. Use --replace for an explicit reconnection.')
        fd, temporary = tempfile.mkstemp(prefix='.gmail-oauth-', dir=directory)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                json.dump(data, stream, indent=2)
                stream.write('\n')
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(temporary, 0o600)
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    except (ValueError, OSError):
        raise OAuthError('OAuth credentials could not be saved to an owner-private directory outside the repository.') from None


def load_config(path: Path) -> dict:
    path = _path(path)
    if path.name != TOKEN_FILE:
        raise OAuthError('Use the dedicated gmail-oauth.json token file.')
    try:
        private.safe_directory(path.parent)
        private._regular(path)
        if path.stat().st_size > MAX_RESPONSE:
            raise ValueError()
        return validate_config(json.loads(path.read_text(encoding='utf-8')))
    except (ValueError, OSError, UnicodeError):
        raise OAuthError('OAuth credentials could not be read from the private token file.') from None


def connect(mailbox: str, personal_email: str, client: dict, *, opener=webbrowser.open,
            receiver_factory=OAuthReceiver, request=request_json, timeout: float = 120,
            allow_sending=False) -> dict:
    if type(allow_sending) is not bool:
        raise OAuthError('Choose the optional sending permission explicitly.')
    requested = SEND_SCOPES if allow_sending else SCOPES
    mailbox = validate_mailbox(mailbox, personal_email)
    verifier, challenge = pkce()
    state = secrets.token_urlsafe(32)
    response = {}
    with receiver_factory(state, timeout=timeout) as receiver:
        if not opener(authorization_url(client, mailbox, receiver.redirect_uri, state, challenge, allow_sending=allow_sending)):
            raise OAuthError('The authorization browser could not be opened. No credentials were saved.')
        code = receiver.wait()
        response = request(TOKEN_URL, form={'code': code, 'client_id': client['client_id'], 'client_secret': client['client_secret'],
                                          'redirect_uri': receiver.redirect_uri, 'grant_type': 'authorization_code', 'code_verifier': verifier})
        try:
            issued = tokens(response, expected=requested)
            owner = identity(issued['access_token'], mailbox, request=request)
        except OAuthError:
            revoke(response, request=request)
            raise
    return validate_config({'version': 1, 'provider': 'gmail_oauth', 'mailbox': mailbox,
                            'personal_email_sha256': private.personal_digest(personal_email), 'client': client,
                            'tokens': issued, 'scopes': sorted(requested), 'identity': owner,
                            'connected_at': datetime.now(timezone.utc).isoformat()})


def check_token(path: Path, *, request=request_json, now: float | None = None) -> dict:
    """Check identity on demand, refreshing only when needed. Never calls Gmail."""
    data = load_config(path)
    now = time.time() if now is None else now
    if data['tokens']['expires_at'] <= now + 60:
        response = request(TOKEN_URL, form={'grant_type': 'refresh_token', 'refresh_token': data['tokens']['refresh_token'], **data['client']})
        try:
            data['tokens'] = tokens(response, previous=data['tokens'], now=now, expected=frozenset(data['scopes']))
        except OAuthError:
            revoke(response, request=request)
            raise
    try:
        data['identity'] = identity(data['tokens']['access_token'], data['mailbox'], request=request)
    except IdentityMismatch:
        revoke(data['tokens'], request=request)
        raise
    save_config(path, data, replace=True)
    return data


def default_config() -> Path:
    return Path.home() / '.erase-me-removal-mail' / TOKEN_FILE


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mailbox')
    parser.add_argument('--personal-email')
    parser.add_argument('--client-json', type=Path)
    parser.add_argument('--config', type=Path, default=default_config())
    parser.add_argument('--replace', action='store_true')
    parser.add_argument('--check-token', action='store_true')
    parser.add_argument('--allow-sending', action='store_true', help='Explicitly request optional Gmail sending permission through fresh consent.')
    args = parser.parse_args(argv)
    try:
        if args.check_token:
            check_token(args.config)
            print('Dedicated Gmail identity checked. No Gmail messages were accessed and no scheduled work was started.')
            return 0
        if not all((args.mailbox, args.personal_email, args.client_json)):
            raise OAuthError('Provide --mailbox, --personal-email and --client-json for the dedicated account.')
        validate_mailbox(args.mailbox, args.personal_email)
        client = load_client(args.client_json)
        path = _path(args.config)
        if path.name != TOKEN_FILE:
            raise OAuthError('Use the dedicated gmail-oauth.json token file.')
        if path.exists() and not args.replace:
            raise OAuthError('OAuth credentials already exist. Use --replace for an explicit reconnection.')
        # Refuse unsafe destinations before the Google consent window opens.
        private.safe_directory(path.parent, create=True)
        if path.exists() or path.is_symlink():
            private._regular(path)
        print('Opening Google consent for the dedicated removal mailbox. Select that account only.')
        data = connect(args.mailbox, args.personal_email, client, **({'allow_sending': True} if args.allow_sending else {}))
        try:
            save_config(path, data, replace=args.replace)
        except OAuthError:
            revoke(data['tokens'])
            raise
        print('Dedicated Gmail OAuth credentials saved privately. No Gmail messages were accessed and no timers were started.')
        return 0
    except (OAuthError, ValueError, OSError):
        print('Dedicated Gmail connection did not finish. Check the separate account, private client file and Google consent. No provider response or credentials were logged.')
        return 1
    except (KeyboardInterrupt, EOFError):
        print('\nDedicated Gmail connection cancelled. No timers were started.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
