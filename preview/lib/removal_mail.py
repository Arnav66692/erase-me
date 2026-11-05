"""On-demand receipt checks and explicit reviewed broker-form continuation.

No message link is followed by this service. Capabilities isolate random per-operation
aliases; a separate explicit action can release one reviewed form URL to its browser.
"""
from __future__ import annotations

import base64
import email
import email.policy
import email.utils
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from html import unescape
from html.parser import HTMLParser
from types import MappingProxyType
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_BYTES = 262144
MAX_MESSAGES = 10
MAX_JSON_BYTES = 524288
CAPABILITY_LIFETIME = 7 * 86400
CHECK_BUDGET_SECONDS = 25
REQUIRED = ('ERASE_REMOVAL_INBOX', 'ERASE_GMAIL_CLIENT_ID', 'ERASE_GMAIL_CLIENT_SECRET',
            'ERASE_GMAIL_REFRESH_TOKEN', 'ERASE_MAIL_CAPABILITY_SECRET')
ROUTES = MappingProxyType({
    'usphonebook': {'sender_domains': ('usphonebook.com',), 'hosts': ('www.usphonebook.com', 'usphonebook.com')},
    # Retained for receipt checks on existing capabilities, not new aliases.
    'searchpeoplefree': {'sender_domains': ('searchpeoplefree.com',), 'hosts': ('www.searchpeoplefree.com', 'searchpeoplefree.com')},
    'fastpeoplesearch': {'sender_domains': ('fastpeoplesearch.com',), 'hosts': ('www.fastpeoplesearch.com', 'fastpeoplesearch.com')},
})
# This identifies a reviewed second privacy-request form, not deletion or request
# completion. Other broker links remain held; environment variables cannot add routes.
CONFIRMATION_CONTRACTS = MappingProxyType({
    'usphonebook': MappingProxyType({'host': 'www.usphonebook.com',
                                   'path': '/removal/validate-record-info',
                                   'query_keys': frozenset(('key', 'ticketid'))}),
})


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


_open = build_opener(_NoRedirect).open


class MailError(Exception):
    def __init__(self, message='The dedicated mailbox could not be checked.', status=503):
        super().__init__(message)
        self.status = status


def _base_address():
    value = os.getenv('ERASE_REMOVAL_INBOX', '').strip().lower()
    if not re.fullmatch(r'[a-z0-9._-]{1,25}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}', value):
        raise MailError('Dedicated mailbox configuration is unavailable.')
    return value


def configured():
    try:
        return (os.getenv('ERASE_DEDICATED_MAILBOX') == 'true' and all(os.getenv(k) for k in REQUIRED)
                and bool(re.fullmatch(r'[a-fA-F0-9]{64}', os.environ['ERASE_MAIL_CAPABILITY_SECRET']))
                and bool(_base_address()))
    except (KeyError, MailError):
        return False


def enabled():
    return (configured() and os.getenv('ERASE_MAIL_RELAY_ENABLED') == 'true'
            and bool(re.fullmatch(r'[a-fA-F0-9]{64}', os.getenv('ERASE_MAIL_PILOT_KEY', ''))))


def status():
    return {'configured': configured(), 'enabled': enabled(), 'provider': 'gmail', 'on_demand': True,
            'access': 'private_pilot', 'authorization_required': True, 'automatic_execution': False}


def authorize(pilot_key):
    # Configuration is not public activation. Possession of a route capability is
    # also insufficient: every issuance and Google call needs this private key.
    if not enabled():
        raise MailError('The private removal-mail pilot is not enabled.')
    if (not isinstance(pilot_key, str) or not re.fullmatch(r'[a-fA-F0-9]{64}', pilot_key)
            or not hmac.compare_digest(pilot_key, os.environ['ERASE_MAIL_PILOT_KEY'])):
        raise MailError('Private pilot authorization is required.', 403)



def _require_config():
    if not configured():
        raise MailError('The dedicated removal mailbox is not connected.')


def _secret():
    return bytes.fromhex(os.environ['ERASE_MAIL_CAPABILITY_SECRET'])


def _b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode('ascii')


def _unb64(value, maximum):
    if not isinstance(value, str) or not value or len(value) > maximum or not re.fullmatch(r'[A-Za-z0-9_-]+', value):
        raise ValueError('Invalid encoding')
    result = base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))
    if _b64(result) != value:
        raise ValueError('Noncanonical encoding')
    return result


def _recipient(request_id):
    local, domain = _base_address().split('@')
    return local + '+erase-' + request_id + '@' + domain


def _strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate object key')
        result[key] = value
    return result


def parse_json(raw):
    try:
        obj = json.loads(raw, object_pairs_hook=_strict_object)
        if not isinstance(obj, dict):
            raise ValueError()
        return obj
    except (ValueError, UnicodeError, TypeError):
        raise MailError('Invalid mailbox request.', 400) from None


def session(body, *, now=None, pilot_key=None):
    authorize(pilot_key)
    if not isinstance(body, dict) or set(body) != {'route_id', 'operation_id', 'authorized'} or body.get('authorized') is not True:
        raise MailError('Authorize a supported removal contact address first.', 400)
    route_id = body.get('route_id')
    if not isinstance(route_id, str) or route_id not in ROUTES:
        raise MailError('This route cannot substitute a dedicated contact mailbox.', 400)
    if route_id == 'searchpeoplefree':
        # Its current consent identifies the person associated with the email.
        # Shared-contact support has not been established, so fail before Google
        # access while preserving receipt checks for previously issued references.
        raise MailError('SearchPeopleFree needs an email associated with you. Use your typed email and complete verification on the broker site; a shared removal contact is not available.', 400)
    operation_id = body.get('operation_id')
    if not isinstance(operation_id, str) or not re.fullmatch(r'[a-f0-9-]{32,40}', operation_id):
        raise MailError('Choose a valid workspace operation.', 400)
    # Do not publish a contact address until Google's current identity proves
    # these credentials belong to the separately configured removal account.
    _gmail_token(time.monotonic() + CHECK_BUDGET_SECONDS, pilot_key)
    stamp = int(time.time() if now is None else now)
    request_id = secrets.token_hex(16)
    payload = {'v': 1, 'request_id': request_id, 'route_id': route_id, 'operation_id': operation_id,
               'recipient': _recipient(request_id), 'issued_at': stamp,
               'expires_at': stamp + CAPABILITY_LIFETIME}
    encoded = _b64(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode())
    signature = _b64(hmac.new(_secret(), encoded.encode('ascii'), hashlib.sha256).digest())
    return {'status': 'ready', 'capability': encoded + '.' + signature,
            'request_id': request_id, 'route_id': route_id, 'operation_id': operation_id, 'contact_email': payload['recipient'],
            'expires_at': payload['expires_at'], 'automatic_execution': False}


def verify_capability(capability, *, now=None):
    _require_config()
    try:
        if not isinstance(capability, str) or len(capability) > 2048:
            raise ValueError()
        encoded, signature = capability.split('.')
        expected = hmac.new(_secret(), encoded.encode('ascii'), hashlib.sha256).digest()
        if not hmac.compare_digest(_unb64(signature, 64), expected):
            raise ValueError()
        obj = parse_json(_unb64(encoded, 1800))
        if set(obj) != {'v', 'request_id', 'route_id', 'operation_id', 'recipient', 'issued_at', 'expires_at'} or obj['v'] != 1:
            raise ValueError()
        if not isinstance(obj['route_id'], str) or obj['route_id'] not in ROUTES:
            raise ValueError()
        if not isinstance(obj['request_id'], str) or not re.fullmatch(r'[a-f0-9]{32}', obj['request_id']):
            raise ValueError()
        if not isinstance(obj['operation_id'], str) or not re.fullmatch(r'[a-f0-9-]{32,40}', obj['operation_id']):
            raise ValueError()
        if obj['recipient'] != _recipient(obj['request_id']):
            raise ValueError()
        if type(obj['issued_at']) is not int or type(obj['expires_at']) is not int:
            raise ValueError()
        stamp = int(time.time() if now is None else now)
        if obj['expires_at'] - obj['issued_at'] != CAPABILITY_LIFETIME or obj['issued_at'] > stamp + 60:
            raise ValueError()
        if obj['expires_at'] <= stamp:
            raise MailError('This mailbox capability has expired. No request was repeated.', 410)
        return obj
    except MailError as exc:
        if exc.status == 410:
            raise
        raise MailError('Invalid mailbox capability.', 403) from None
    except (ValueError, UnicodeError, TypeError, KeyError):
        raise MailError('Invalid mailbox capability.', 403) from None


def _request_json(url, *, access_token=None, form=None, deadline=None, pilot_key=None):
    """Fixed Google endpoints only, with bounded response size and duration."""
    authorize(pilot_key)
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('oauth2.googleapis.com', 'openidconnect.googleapis.com', 'gmail.googleapis.com'):
        raise MailError()
    headers = {'Accept': 'application/json'}
    if access_token:
        headers['Authorization'] = 'Bearer ' + access_token
    data = None
    if form is not None:
        data = urlencode(form).encode('ascii')
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    remaining = 8 if deadline is None else min(8, deadline - time.monotonic())
    if remaining <= 0:
        raise MailError('The dedicated mailbox check timed out. Try another explicit check later.')
    try:
        request = Request(url, data=data, headers=headers, method='POST' if data is not None else 'GET')
        with _open(request, timeout=remaining) as response:
            # Google endpoints must not redirect access tokens to another host.
            if response.geturl() != url:
                raise MailError()
            raw = response.read(MAX_JSON_BYTES + 1)
        if len(raw) > MAX_JSON_BYTES:
            raise MailError()
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except (HTTPError, URLError, OSError, ValueError, UnicodeError):
        # Never include a provider response, token, account address or request URL.
        raise MailError('The dedicated mailbox is unavailable. Check its connection privately.') from None


def _gmail_token(deadline, pilot_key):
    result = _request_json('https://oauth2.googleapis.com/token', form={
        'client_id': os.environ['ERASE_GMAIL_CLIENT_ID'], 'client_secret': os.environ['ERASE_GMAIL_CLIENT_SECRET'],
        'refresh_token': os.environ['ERASE_GMAIL_REFRESH_TOKEN'], 'grant_type': 'refresh_token'}, deadline=deadline, pilot_key=pilot_key)
    token = result.get('access_token')
    if not isinstance(token, str) or not token or any(c.isspace() for c in token):
        raise MailError()
    identity = _request_json('https://openidconnect.googleapis.com/v1/userinfo', access_token=token, deadline=deadline, pilot_key=pilot_key)
    if identity.get('email_verified') is not True or not isinstance(identity.get('email'), str) or identity['email'].casefold() != _base_address().casefold():
        raise MailError('The connected account is not the configured dedicated mailbox. No messages were read.')
    return token


def _domain(value):
    return value.lower().strip().rstrip('.')


def _authenticated(message, sender_domain):
    headers = message.get_all('Authentication-Results', [])
    if not headers:
        return False
    parts = ' '.join(str(headers[0]).split()).split(';')
    if not parts[0].strip().split() or parts[0].strip().split()[0].lower() != 'mx.google.com':
        return False
    dmarc = []
    aligned = False
    for part in parts[1:]:
        if re.search(r'\bdmarc=', part, re.I):
            found = re.search(r'\bdmarc=pass\b.*?\bheader\.from=([^\s;]+)', part, re.I)
            dmarc.append(bool(found and _domain(found[1].strip('"')) == sender_domain))
        for kind, field in (('dkim', 'header.d'), ('dkim', 'header.i'), ('spf', 'smtp.mailfrom')):
            found = re.search(r'\b' + kind + r'=pass\b.*?\b' + re.escape(field) + r'=([^\s;]+)', part, re.I)
            if found and _domain(found[1].strip('"').rsplit('@', 1)[-1]) == sender_domain:
                aligned = True
    return dmarc == [True] and aligned


class _MailText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.urls = []
        self.text = []
        self.invalid_links = False

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            for key, value in attrs:
                if key != 'href':
                    continue
                if not isinstance(value, str) or len(value) > 2048 or len(self.urls) >= 20:
                    self.invalid_links = True
                else:
                    self.urls.append(value)

    def handle_data(self, data):
        self.text.append(data)


def _safe_url(value, route):
    try:
        u = urlsplit(value)
        return (len(value) <= 2048 and not any(c.isspace() for c in value) and u.scheme == 'https'
                and u.hostname in route['hosts'] and not u.username and not u.password and u.port in (None, 443)
                and not u.fragment)
    except (ValueError, TypeError):
        return False


def _continuation_url(links, route_id):
    """One exact reviewed destination, with no link-purpose inference or fetching.

    HTMLParser has decoded HTML attribute entities once. Plain-text links are
    decoded once when extracted. Decoding here again would accept double encoding.
    Every extracted link must identify the same reviewed form; unknown links or
    conflicting tokens hold the message instead of selecting a convenient link.
    """
    contract = CONFIRMATION_CONTRACTS.get(route_id)
    if not contract or not links:
        return None
    destinations = set()
    for value in links:
        try:
            if (not isinstance(value, str) or len(value) > 2048
                    or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in value)
                    or '\\' in value or '#' in value):
                return None
            url = urlsplit(value)
            if (url.scheme != 'https' or url.hostname != contract['host'] or url.path != contract['path']
                    or url.netloc.lower() not in (contract['host'], contract['host'] + ':443')
                    or url.username is not None or url.password is not None
                    or url.port not in (None, 443) or url.fragment):
                return None
            pairs = parse_qsl(url.query, keep_blank_values=True, strict_parsing=True,
                              encoding='utf-8', errors='strict', max_num_fields=3)
            if len(pairs) != 2 or {key for key, _ in pairs} != contract['query_keys']:
                return None
            parameters = dict(pairs)
            if (len(parameters['key']) > 512 or not re.fullmatch(r'[A-Za-z0-9_-]+={0,2}', parameters['key'])
                    or not re.fullmatch(r'[0-9]{1,32}', parameters['ticketid'])):
                return None
            destinations.add(tuple(sorted(pairs)))
        except (ValueError, TypeError, UnicodeError):
            return None
    if len(destinations) != 1:
        return None
    # Return a canonical URL on the fixed reviewed origin, not attacker-controlled
    # source formatting or a redirect destination from the message.
    return 'https://' + contract['host'] + contract['path'] + '?' + urlencode(next(iter(destinations)))


def _inspect_receipt(raw, received_ms, claims, *, now=None):
    if not isinstance(raw, bytes) or len(raw) > MAX_BYTES or type(received_ms) is not int:
        return None
    stamp = int(time.time() if now is None else now)
    received = received_ms // 1000
    if received < claims['issued_at'] or received > stamp + 300:
        return None
    try:
        message = email.message_from_bytes(raw, policy=email.policy.default)
    except (ValueError, TypeError):
        return None
    froms = email.utils.getaddresses(message.get_all('From', []))
    if len(froms) != 1 or '@' not in froms[0][1]:
        return None
    sender_domain = _domain(froms[0][1].rsplit('@', 1)[-1])
    route = ROUTES[claims['route_id']]
    if sender_domain not in route['sender_domains'] or not _authenticated(message, sender_domain):
        return None
    recipients = email.utils.getaddresses(message.get_all('To', []) + message.get_all('Delivered-To', []))
    if claims['recipient'].casefold() not in [address.casefold() for _, address in recipients]:
        return None
    text, links = [str(message.get('Subject', ''))], []
    invalid_links = False
    for number, part in enumerate(message.walk()):
        if number >= 40:
            return None
        if part.get_content_maintype() != 'text' or part.get_content_disposition() == 'attachment':
            continue
        try:
            content = part.get_content()
        except (ValueError, LookupError, UnicodeError):
            continue
        if not isinstance(content, str):
            continue
        if part.get_content_type() == 'text/html':
            parser = _MailText()
            parser.feed(content)
            text.extend(parser.text)
            links.extend(parser.urls)
            invalid_links = invalid_links or parser.invalid_links
        else:
            text.append(content)
            # Plain prose may wrap a URL in parentheses or sentence punctuation.
            # HTML href attributes are exact destinations and are never trimmed.
            links.extend(unescape(value).rstrip('.,)') for value in re.findall(r'https://[^\s<>"\']+', content))
    prose = ' '.join(text)
    if not re.search(r'\b(remov\w*|opt[ -]?out|unlist\w*)\b', prose, re.I) or not re.search(r'\b(confirm\w*|verif\w*)\b', prose, re.I):
        return None
    urls = list(dict.fromkeys(value for value in links if _safe_url(value, route)))
    continuation = (None if invalid_links or len(links) > 20 else
                    _continuation_url(links, claims['route_id']))
    reason = 'route_validation_required' if urls else 'confirmation_link_unvalidated'
    return ({'status': 'held', 'reason': reason, 'request_id': claims['request_id'],
             'route_id': claims['route_id'], 'operation_id': claims['operation_id'], 'received_at': received,
             'authenticated': True, 'continuation_available': continuation is not None,
             'automatic_execution': False}, continuation)


def _receipt(raw, received_ms, claims, *, now=None):
    """Public receipt shape never contains a message link."""
    result = _inspect_receipt(raw, received_ms, claims, now=now)
    return result[0] if result else None


def _find_receipt(claims, *, now=None, pilot_key=None, receipt_ref=None):
    """Requery only the capability's alias and revalidate raw provenance each time."""
    deadline = time.monotonic() + CHECK_BUDGET_SECONDS
    token = _gmail_token(deadline, pilot_key)
    query = urlencode({'q': 'to:' + claims['recipient'] + ' after:' + str(claims['issued_at']), 'maxResults': MAX_MESSAGES})
    listing = _request_json('https://gmail.googleapis.com/gmail/v1/users/me/messages?' + query, access_token=token, deadline=deadline, pilot_key=pilot_key)
    messages = listing.get('messages', [])
    if not isinstance(messages, list):
        raise MailError()
    for item in messages[:MAX_MESSAGES]:
        message_id = item.get('id') if isinstance(item, dict) else None
        if not isinstance(message_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', message_id):
            continue
        message = _request_json('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + message_id + '?format=raw', access_token=token, deadline=deadline, pilot_key=pilot_key)
        if type(message.get('sizeEstimate')) is not int or not 0 < message['sizeEstimate'] <= MAX_BYTES:
            continue
        raw = message.get('raw')
        try:
            if not isinstance(raw, str) or len(raw) > (MAX_BYTES * 4 // 3 + 8):
                continue
            content = _unb64(raw.rstrip('='), MAX_BYTES * 4 // 3 + 8)
            received = message.get('internalDate')
            if not isinstance(received, str) or not re.fullmatch(r'\d{1,16}', received):
                continue
            inspected = _inspect_receipt(content, int(received), claims, now=now)
        except (ValueError, TypeError, UnicodeError):
            continue
        if inspected:
            receipt, continuation = inspected
            fingerprint = claims['request_id'] + ':' + message_id + ':' + hashlib.sha256(content).hexdigest()
            reference = hmac.new(_secret(), fingerprint.encode(), hashlib.sha256).hexdigest()
            if receipt_ref is not None and not hmac.compare_digest(reference, receipt_ref):
                continue
            receipt['receipt_ref'] = reference
            return receipt, continuation
    return None


def check(body, *, now=None, pilot_key=None):
    authorize(pilot_key)
    if not isinstance(body, dict) or set(body) != {'capability', 'explicit'} or body.get('explicit') is not True:
        raise MailError('Choose an explicit mailbox check for this operation.', 400)
    claims = verify_capability(body.get('capability'), now=now)
    found = _find_receipt(claims, now=now, pilot_key=pilot_key)
    if found:
        return found[0]
    return {'status': 'pending', 'request_id': claims['request_id'], 'route_id': claims['route_id'], 'operation_id': claims['operation_id'],
            'automatic_execution': False}


def continue_confirmation(body, *, now=None, pilot_key=None):
    """Release a reviewed form URL after a separate explicit authorization.

    This service never navigates to the broker and has no durable consumed-nonce
    store. The companion must journal its action before navigation and hold replay
    or interruption. A ready form is not an accepted request or verified deletion.
    """
    authorize(pilot_key)
    if (not isinstance(body, dict) or set(body) != {'capability', 'explicit', 'receipt_ref'}
            or body.get('explicit') is not True or not isinstance(body.get('receipt_ref'), str)
            or not re.fullmatch(r'[a-f0-9]{64}', body['receipt_ref'])):
        raise MailError('Choose an explicit continuation for the checked receipt.', 400)
    claims = verify_capability(body.get('capability'), now=now)
    if claims['route_id'] not in CONFIRMATION_CONTRACTS:
        raise MailError('This broker confirmation form is not supported.', 409)
    found = _find_receipt(claims, now=now, pilot_key=pilot_key, receipt_ref=body['receipt_ref'])
    if not found or not found[1]:
        raise MailError('The checked receipt has no validated continuation. No broker was contacted.', 409)
    receipt, continuation = found
    return {'status': 'confirmation_ready', 'request_id': claims['request_id'], 'route_id': claims['route_id'],
            'operation_id': claims['operation_id'], 'receipt_ref': receipt['receipt_ref'],
            'confirmation_url': continuation, 'automatic_execution': False}
