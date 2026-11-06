"""Fixed-host Gmail app-password transport for an explicitly separate mailbox.

No Google Cloud project is needed. Provider-controlled app-password eligibility
still applies. Every operation authenticates the pinned Gmail username before
any search or send. The reader reuses the reviewed receipt/provenance parser.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import email.utils
import fcntl
import hashlib
import hmac
import imaplib
import json
import os
from pathlib import Path
import re
import secrets
import smtplib
import ssl
import sys
import tempfile
import time

import configure_removal_mailbox as private
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from preview.lib import removal_mail as relay

CONFIG_FILE = 'gmail-app-password.json'
SELECTION_FILE = 'provider-selection.json'
VERSIONED_CONFIG = re.compile(r'gmail-app-password-[a-f0-9]{32}\.json\Z')
OAUTH_CONFIG_FILE = 'gmail-oauth.json'
OAUTH_VERSIONED_CONFIG = re.compile(r'gmail-oauth-[a-f0-9]{32}\.json\Z')
_UNSET = object()
PROVIDER = 'gmail_app_password'
IMAP_HOST, IMAP_PORT = 'imap.gmail.com', 993
SMTP_HOST, SMTP_PORT = 'smtp.gmail.com', 465


class AppMailError(Exception):
    def __init__(self, code='app_password_unavailable'):
        self.code = code
        super().__init__('The separate Gmail connection could not be verified. Check its app password privately.')


def password(value):
    if not isinstance(value, str) or not re.fullmatch(r'(?:[a-z]{16}|[a-z]{4}(?: [a-z]{4}){3})', value):
        raise AppMailError('invalid_app_password')
    return value.replace(' ', '')


def validate_config(value):
    fields = {'version', 'provider', 'mailbox', 'personal_email_sha256', 'app_password', 'allow_sending', 'connected_at'}
    try:
        if (not isinstance(value, dict) or set(value) != fields or type(value['version']) is not int
                or value['version'] != 1 or value['provider'] != PROVIDER
                or type(value['allow_sending']) is not bool
                or not isinstance(value['personal_email_sha256'], str)
                or not re.fullmatch(r'[a-f0-9]{64}', value['personal_email_sha256'])
                or not isinstance(value['mailbox'], str)
                or not re.fullmatch(r'[a-z0-9._-]{1,25}@(?:gmail\.com|googlemail\.com)', value['mailbox'])
                or private.personal_digest(value['mailbox']) == value['personal_email_sha256']
                or password(value['app_password']) != value['app_password']
                or not isinstance(value['connected_at'], str) or len(value['connected_at']) > 40
                or datetime.fromisoformat(value['connected_at']).tzinfo is None):
            raise ValueError()
        return dict(value)
    except (ValueError, TypeError, KeyError, AppMailError):
        raise AppMailError('invalid_app_config') from None


def make_config(mailbox, personal, secret, *, allow_sending=False):
    if type(allow_sending) is not bool or not isinstance(mailbox, str):
        raise AppMailError('invalid_app_config')
    return validate_config({'version': 1, 'provider': PROVIDER, 'mailbox': mailbox.lower(),
        'personal_email_sha256': private.personal_digest(personal), 'app_password': password(secret),
        'allow_sending': allow_sending, 'connected_at': datetime.now(timezone.utc).isoformat()})


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise AppMailError('invalid_app_config')
        result[key] = value
    return result


def _path(path, name):
    path = Path(path).expanduser().absolute()
    if path.name != name or any(p.is_symlink() for p in (path, *path.parents)):
        raise AppMailError('invalid_app_config')
    private.safe_directory(path.parent)
    return path


def _read(path, name):
    path = _path(path, name)
    private._regular(path)
    if path.stat().st_size > 4096:
        raise AppMailError('invalid_app_config')
    try:
        return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=_object,
                          parse_constant=lambda _value: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError, RecursionError):
        raise AppMailError('invalid_app_config') from None


def _save(path, name, value, *, replace=False):
    path = Path(path).expanduser().absolute()
    if path.name != name or any(p.is_symlink() for p in (path, *path.parents)):
        raise AppMailError('invalid_app_config')
    directory = private.safe_directory(path.parent, create=True)
    if path.exists() or path.is_symlink():
        private._regular(path)
        if not replace:
            raise AppMailError('reconnect_required')
    descriptor, temporary = tempfile.mkstemp(prefix='.gmail-connection-', dir=directory)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            json.dump(value, stream, separators=(',', ':'))
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def save_config(path, config, *, replace=False):
    name = Path(path).name
    if name != CONFIG_FILE and not VERSIONED_CONFIG.fullmatch(name):
        raise AppMailError('invalid_app_config')
    if VERSIONED_CONFIG.fullmatch(name) and replace:
        raise AppMailError('invalid_app_config')
    if name == CONFIG_FILE:
        with _selection_lock(Path(path).parent):
            _save(path, name, validate_config(config), replace=replace)
    else:
        _save(path, name, validate_config(config), replace=replace)


def load_config(path):
    name = Path(path).name
    if name != CONFIG_FILE and not VERSIONED_CONFIG.fullmatch(name):
        raise AppMailError('invalid_app_config')
    return validate_config(_read(path, name))


def config_path(directory, selected=None):
    name = selected.get('config_file', CONFIG_FILE) if selected else CONFIG_FILE
    if name != CONFIG_FILE and not VERSIONED_CONFIG.fullmatch(name):
        raise AppMailError('invalid_app_config')
    return Path(directory) / name


def oauth_config_path(directory, selected=None):
    name = selected.get('config_file', OAUTH_CONFIG_FILE) if selected else OAUTH_CONFIG_FILE
    if name != OAUTH_CONFIG_FILE and not OAUTH_VERSIONED_CONFIG.fullmatch(name):
        raise AppMailError('invalid_app_config')
    return Path(directory) / name


def _versioned(provider, name):
    pattern = VERSIONED_CONFIG if provider == PROVIDER else OAUTH_VERSIONED_CONFIG if provider == 'gmail_oauth' else None
    return isinstance(name, str) and pattern is not None and pattern.fullmatch(name) is not None


def _load_provider_config(path, provider):
    if provider == PROVIDER:
        return load_config(path)
    if provider == 'gmail_oauth':
        import connect_removal_gmail as oauth
        return oauth.load_config(path)
    raise AppMailError('invalid_app_config')


@contextmanager
def _selection_lock(directory):
    directory = private.safe_directory(Path(directory), create=True)
    path = directory / '.connection-update.lock'
    if path.exists() or path.is_symlink():
        _path(path, path.name)
        private._regular(path)
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        private._regular(path)
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise AppMailError('connection_changed') from None
        yield
    finally:
        os.close(descriptor)


def _selection_digest(directory):
    path = Path(directory) / SELECTION_FILE
    if not path.exists() and not path.is_symlink():
        return None
    _path(path, SELECTION_FILE)
    private._regular(path)
    if path.stat().st_size > 4096:
        raise AppMailError('invalid_app_config')
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _connection_digest(directory, selected):
    path = (config_path(directory, selected) if selected and selected['provider'] == PROVIDER
            else oauth_config_path(directory, selected))
    config_digest = None
    if path.exists() or path.is_symlink():
        if any(part.is_symlink() for part in (path, *path.parents)):
            raise AppMailError('invalid_app_config')
        private._regular(path)
        if path.stat().st_size > 65536:
            raise AppMailError('invalid_app_config')
        config_digest = hashlib.sha256(path.read_bytes()).hexdigest()
    value = {'selection': _selection_digest(directory), 'config_file': path.name, 'config': config_digest}
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def connection_snapshot(directory):
    path = Path(directory) / SELECTION_FILE
    if not path.exists() and not path.is_symlink():
        return {'selection': None, 'digest': _connection_digest(directory, None)}
    with _selection_lock(directory):
        selected = selection(directory)
        return {'selection': selected, 'digest': _connection_digest(directory, selected)}


def stage_config(directory, config):
    """Create only this invocation's inactive, immutable credential file."""
    provider = config.get('provider')
    if provider == PROVIDER:
        path = Path(directory) / ('gmail-app-password-' + secrets.token_hex(16) + '.json')
        save_config(path, config)
    elif provider == 'gmail_oauth':
        import connect_removal_gmail as oauth
        path = Path(directory) / ('gmail-oauth-' + secrets.token_hex(16) + '.json')
        oauth.save_config(path, config)
    else:
        raise AppMailError('invalid_app_config')
    return path


def discard_staged(path, config):
    """Never delete an active, replaced or unrelated credential file."""
    path = Path(path)
    if not _versioned(config.get('provider'), path.name):
        raise AppMailError('invalid_app_config')
    with _selection_lock(path.parent):
        selected = selection(path.parent)
        if selected and selected.get('config_file') == path.name:
            return
        if path.exists() and _load_provider_config(path, config['provider']) == config:
            path.unlink()


def select_config(directory, config, *, config_file=None, expected_selection=_UNSET, before_commit=None):
    provider = config.get('provider')
    if provider not in (PROVIDER, 'gmail_oauth'):
        raise AppMailError('invalid_app_config')
    value = {'version': 1, 'provider': provider,
             'mailbox_sha256': private.personal_digest(config['mailbox']),
             'personal_email_sha256': config['personal_email_sha256']}
    if config_file is not None:
        if not _versioned(provider, config_file):
            raise AppMailError('invalid_app_config')
        if _load_provider_config(Path(directory) / config_file, provider) != config:
            raise AppMailError('invalid_app_config')
        value.update(version=2, config_file=config_file)
    with _selection_lock(directory):
        if expected_selection is not _UNSET and _connection_digest(directory, selection(directory)) != expected_selection:
            raise AppMailError('connection_changed')
        if before_commit is not None:
            before_commit()
        _save(Path(directory) / SELECTION_FILE, SELECTION_FILE, value, replace=True)


def selection(directory):
    path = Path(directory) / SELECTION_FILE
    if not path.exists() and not path.is_symlink():
        return None
    value = _read(path, SELECTION_FILE)
    fields = {'version', 'provider', 'mailbox_sha256', 'personal_email_sha256'}
    if (not isinstance(value, dict) or set(value) not in (fields, fields | {'config_file'})
            or type(value['version']) is not int or value['version'] not in (1, 2)
            or (value['version'] == 1) != ('config_file' not in value)
            or value['version'] == 2 and not _versioned(value['provider'], value['config_file'])
            or value['provider'] not in (PROVIDER, 'gmail_oauth')
            or any(not isinstance(value[key], str) or not re.fullmatch(r'[a-f0-9]{64}', value[key])
                   for key in ('mailbox_sha256', 'personal_email_sha256'))):
        raise AppMailError('invalid_app_config')
    return value


def check_selection(selected, config):
    if selected and (selected['provider'] != config['provider']
            or not hmac.compare_digest(selected['mailbox_sha256'], private.personal_digest(config['mailbox']))
            or not hmac.compare_digest(selected['personal_email_sha256'], config['personal_email_sha256'])):
        raise AppMailError('invalid_app_config')
    return config


def _timeout(deadline):
    remaining = min(8, deadline - time.monotonic())
    if remaining <= 0:
        raise AppMailError('timeout')
    return remaining


def _bound(client, deadline):
    remaining = _timeout(deadline)
    sock = getattr(client, 'sock', None)
    if sock is not None:
        sock.settimeout(remaining)


@contextmanager
def imap_connection(config, deadline):
    config = validate_config(config)
    client = None
    try:
        client = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, ssl_context=ssl.create_default_context(), timeout=_timeout(deadline))
        _bound(client, deadline)
        status, _reply = client.login(config['mailbox'], config['app_password'])
        if status != 'OK':
            raise AppMailError()
        yield client
    except AppMailError:
        raise
    except Exception:
        raise AppMailError() from None
    finally:
        if client is not None:
            try:
                _bound(client, deadline)
                client.logout()
            except Exception:
                try:
                    client.shutdown()
                except Exception:
                    pass


@contextmanager
def smtp_connection(config, deadline):
    config = validate_config(config)
    if not config['allow_sending']:
        raise AppMailError('send_permission_required')
    client = None
    try:
        client = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ssl.create_default_context(), timeout=_timeout(deadline))
        _bound(client, deadline)
        code, _reply = client.login(config['mailbox'], config['app_password'])
        if code != 235:
            raise AppMailError()
        yield client
    except AppMailError:
        raise
    except Exception:
        raise AppMailError() from None
    finally:
        if client is not None:
            try:
                _bound(client, deadline)
                client.quit()
            except Exception:
                pass
            finally:
                try:
                    client.close()
                except Exception:
                    pass


def verify(config, *, sending=False, deadline=None):
    deadline = time.monotonic() + 25 if deadline is None else deadline
    with (smtp_connection(config, deadline) if sending else imap_connection(config, deadline)):
        pass


def send(config, raw, recipient, *, deadline=None):
    """Return only after Gmail's DATA command explicitly returns SMTP 250."""
    config = validate_config(config)
    if (not isinstance(raw, bytes) or not 0 < len(raw) <= 65536 or not isinstance(recipient, str)
            or not private.EMAIL_RE.fullmatch(recipient)):
        raise AppMailError('invalid_message')
    deadline = time.monotonic() + 25 if deadline is None else deadline
    with smtp_connection(config, deadline) as client:
        _bound(client, deadline)
        code, _reply = client.mail(config['mailbox'])
        if code != 250:
            raise AppMailError('smtp_not_accepted')
        _bound(client, deadline)
        code, _reply = client.rcpt(recipient)
        if code not in (250, 251):
            raise AppMailError('smtp_not_accepted')
        _bound(client, deadline)
        code, _reply = client.data(raw)
        if code != 250:
            raise AppMailError('smtp_not_accepted')


class MailEngine:
    """Per-call transport facade; never monkeypatch the shared OAuth relay."""
    CONFIRMATION_CONTRACTS = relay.CONFIRMATION_CONTRACTS
    CAPABILITY_LIFETIME = relay.CAPABILITY_LIFETIME
    CHECK_BUDGET_SECONDS = relay.CHECK_BUDGET_SECONDS
    _b64 = staticmethod(relay._b64)

    def __init__(self, config, keys):
        self.config = validate_config(config)
        self.keys = keys

    def _secret(self):
        return bytes.fromhex(self.keys['capability_secret'])

    def _recipient(self, request_id):
        local, domain = self.config['mailbox'].split('@')
        return local + '+erase-' + request_id + '@' + domain

    def _authorize(self, key):
        if not isinstance(key, str) or not hmac.compare_digest(key, self.keys['pilot_key']):
            raise relay.MailError('Explicit local authorization is required.', 403)

    def _gmail_token(self, deadline, pilot_key):
        # Compatibility name for the native reader's identity-only preflight.
        self._authorize(pilot_key)
        verify(self.config, deadline=deadline)

    def verify_capability(self, capability, *, now=None):
        try:
            if not isinstance(capability, str) or len(capability) > 2048:
                raise ValueError()
            encoded, signature = capability.split('.')
            expected = hmac.new(self._secret(), encoded.encode('ascii'), hashlib.sha256).digest()
            if not hmac.compare_digest(relay._unb64(signature, 64), expected):
                raise ValueError()
            obj = relay.parse_json(relay._unb64(encoded, 1800))
            if (set(obj) != {'v', 'request_id', 'route_id', 'operation_id', 'recipient', 'issued_at', 'expires_at'}
                    or type(obj['v']) is not int or obj['v'] != 1 or obj['route_id'] not in relay.ROUTES
                    or not isinstance(obj['request_id'], str) or not re.fullmatch(r'[a-f0-9]{32}', obj['request_id'])
                    or not isinstance(obj['operation_id'], str) or not re.fullmatch(r'[a-f0-9-]{32,40}', obj['operation_id'])
                    or obj['recipient'] != self._recipient(obj['request_id'])
                    or type(obj['issued_at']) is not int or type(obj['expires_at']) is not int):
                raise ValueError()
            stamp = int(time.time() if now is None else now)
            if obj['expires_at'] - obj['issued_at'] != self.CAPABILITY_LIFETIME or obj['issued_at'] > stamp + 60:
                raise ValueError()
            if obj['expires_at'] <= stamp:
                raise relay.MailError('This mailbox capability has expired. No request was repeated.', 410)
            return obj
        except relay.MailError:
            raise
        except (ValueError, UnicodeError, TypeError, KeyError):
            raise relay.MailError('Invalid mailbox capability.', 403) from None

    def session(self, body, *, now=None, pilot_key=None):
        self._authorize(pilot_key)
        if (not isinstance(body, dict) or set(body) != {'route_id', 'operation_id', 'authorized'}
                or body['authorized'] is not True or body['route_id'] not in relay.ROUTES
                or not isinstance(body['operation_id'], str) or not re.fullmatch(r'[a-f0-9-]{32,40}', body['operation_id'])):
            raise relay.MailError('Authorize a supported local contact first.', 400)
        self._gmail_token(time.monotonic() + self.CHECK_BUDGET_SECONDS, pilot_key)
        stamp = int(time.time() if now is None else now)
        request_id = secrets.token_hex(16)
        claims = {'v': 1, 'request_id': request_id, 'route_id': body['route_id'], 'operation_id': body['operation_id'],
                  'recipient': self._recipient(request_id), 'issued_at': stamp, 'expires_at': stamp + self.CAPABILITY_LIFETIME}
        encoded = self._b64(json.dumps(claims, sort_keys=True, separators=(',', ':')).encode())
        signature = self._b64(hmac.new(self._secret(), encoded.encode(), hashlib.sha256).digest())
        return {'status': 'ready', 'capability': encoded + '.' + signature, 'request_id': request_id,
                'route_id': body['route_id'], 'operation_id': body['operation_id'], 'contact_email': claims['recipient'],
                'expires_at': claims['expires_at'], 'automatic_execution': False}

    def _find(self, claims, *, now=None, pilot_key=None, receipt_ref=None):
        self._authorize(pilot_key)
        deadline = time.monotonic() + self.CHECK_BUDGET_SECONDS
        with imap_connection(self.config, deadline) as client:
            _bound(client, deadline)
            status, _reply = client.select('INBOX', readonly=True)
            if status != 'OK':
                raise AppMailError()
            _bound(client, deadline)
            query = '"to:' + claims['recipient'] + ' after:' + str(claims['issued_at']) + '"'
            status, listing = client.uid('search', None, 'X-GM-RAW', query)
            if (status != 'OK' or not isinstance(listing, list) or len(listing) != 1
                    or not isinstance(listing[0], bytes) or len(listing[0]) > 65536):
                raise AppMailError()
            identifiers = listing[0].split()
            if any(not re.fullmatch(rb'[1-9][0-9]{0,19}', uid) for uid in identifiers):
                raise AppMailError()
            for uid in reversed(identifiers[-relay.MAX_MESSAGES:]):
                _bound(client, deadline)
                status, parts = client.uid('fetch', uid, '(UID INTERNALDATE RFC822.SIZE BODY.PEEK[]<0.' + str(relay.MAX_BYTES + 1) + '>)')
                if status != 'OK' or not isinstance(parts, list):
                    continue
                for part in parts:
                    if not isinstance(part, tuple) or len(part) != 2:
                        continue
                    metadata, raw = part
                    if not isinstance(metadata, bytes) or not isinstance(raw, bytes) or not 0 < len(raw) <= relay.MAX_BYTES:
                        continue
                    identity = re.search(rb'\bUID ([0-9]+)\b', metadata)
                    size = re.search(rb'\bRFC822.SIZE ([0-9]+)\b', metadata)
                    arrival = re.search(rb'\bINTERNALDATE "([^"\r\n]{1,40})"', metadata)
                    if not identity or identity[1] != uid or not size or int(size[1]) != len(raw) or not arrival:
                        continue
                    try:
                        received = email.utils.parsedate_to_datetime(arrival[1].decode('ascii').replace('-', ' ', 2))
                        if received.tzinfo is None:
                            continue
                        inspected = relay._inspect_receipt(raw, int(received.timestamp() * 1000), claims, now=now)
                    except (ValueError, TypeError, UnicodeError, OverflowError):
                        continue
                    if not inspected:
                        continue
                    receipt, continuation = inspected
                    fingerprint = claims['request_id'] + ':imap:' + uid.decode() + ':' + hashlib.sha256(raw).hexdigest()
                    reference = hmac.new(self._secret(), fingerprint.encode(), hashlib.sha256).hexdigest()
                    if receipt_ref is not None and not hmac.compare_digest(reference, receipt_ref):
                        continue
                    receipt['receipt_ref'] = reference
                    return receipt, continuation
        return None

    def check(self, body, *, now=None, pilot_key=None):
        self._authorize(pilot_key)
        if not isinstance(body, dict) or set(body) != {'capability', 'explicit'} or body['explicit'] is not True:
            raise relay.MailError('Choose one explicit mailbox check.', 400)
        claims = self.verify_capability(body['capability'], now=now)
        found = self._find(claims, now=now, pilot_key=pilot_key)
        return found[0] if found else {'status': 'pending', 'request_id': claims['request_id'],
            'route_id': claims['route_id'], 'operation_id': claims['operation_id'], 'automatic_execution': False}

    def continue_confirmation(self, body, *, now=None, pilot_key=None):
        self._authorize(pilot_key)
        if (not isinstance(body, dict) or set(body) != {'capability', 'explicit', 'receipt_ref'}
                or body['explicit'] is not True or not isinstance(body['receipt_ref'], str)
                or not re.fullmatch(r'[a-f0-9]{64}', body['receipt_ref'])):
            raise relay.MailError('Choose the reviewed receipt explicitly.', 400)
        claims = self.verify_capability(body['capability'], now=now)
        if claims['route_id'] not in self.CONFIRMATION_CONTRACTS:
            raise relay.MailError('This broker confirmation is not supported.', 409)
        found = self._find(claims, now=now, pilot_key=pilot_key, receipt_ref=body['receipt_ref'])
        if not found or not found[1]:
            raise relay.MailError('No authenticated reviewed continuation is available.', 409)
        return {'status': 'confirmation_ready', 'request_id': claims['request_id'], 'route_id': claims['route_id'],
                'operation_id': claims['operation_id'], 'receipt_ref': found[0]['receipt_ref'],
                'confirmation_url': found[1], 'automatic_execution': False}
