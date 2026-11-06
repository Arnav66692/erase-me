"""One reviewed privacy email from an explicitly send-enabled separate Gmail.

The native outbox stores digests and outcomes, never names, record references,
message bodies or credentials. A started send is never automatically repeated.
"""
from __future__ import annotations

import base64
from email.message import EmailMessage
from email.policy import SMTP
import hashlib
import hmac
import json
import re
import secrets
import ssl
import time
import unicodedata
from types import MappingProxyType
from urllib.parse import urlencode
from urllib.request import Request, HTTPSHandler, build_opener

import connect_removal_gmail as oauth
import configure_removal_mailbox as private

SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
LIFETIME = 15 * 60
OP = re.compile(r'[a-f0-9-]{32,40}\Z')
DIGEST = re.compile(r'[a-f0-9]{64}\Z')
OPAQUE = re.compile(r'[A-Za-z0-9_-]{1,128}\Z')
CAPABILITY = re.compile(r's1\.[A-Za-z0-9_-]{1,1800}\.[A-Za-z0-9_-]{43}\Z')
# Only first-party, purpose-verified privacy channels. Support contacts and
# Vodafone's recorded-sender-only channel are intentionally absent.
ROUTES = MappingProxyType({
    'ca-411': ('privacy@411.ca', 'https://www.411.ca/privacy-policy'),
    'ukphonebook': ('dpo@simunix.com', 'https://www.ukphonebook.com/privacy'),
    'de-teilnehmerverzeichnis-widerspruch': ('datenschutz@dasoertliche-marketing.de', 'https://www.dasoertliche.de/datenschutz'),
    'tr-ceptennumarasorgula': ('mh@mobilisim.com.tr', 'https://www.ceptennumarasorgula.com/PrivacyPolicy'),
    'tr-numaraara': ('bilgi@numaraara.com', 'https://www.numaraara.com/iletisim'),
    'beenverified': ('privacy@beenverified.com', 'https://www.beenverified.com/faq/privacy/'),
    'peoplelooker': ('privacy@peoplelooker.com', 'https://www.peoplelooker.com/privacy-policy/'),
})


class SenderError(Exception):
    def __init__(self, code='unavailable'):
        self.code = code
        super().__init__('The reviewed removal-only email action could not be completed.')


def _exact(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)


def _text(value, maximum):
    try:
        size = len(value.encode('utf-8')) if isinstance(value, str) else 0
    except UnicodeError:
        size = 0
    if (not 0 < size <= maximum * 4 or len(value) > maximum
            or any(unicodedata.category(char) in ('Cc', 'Cf', 'Cs') for char in value)
            or '<' in value or '>' in value or value != ' '.join(value.split())):
        raise SenderError('invalid_request')
    return value


def validate_request(request):
    fields = {'send-status': {'authorized'},
              'send-prepare': {'route_id', 'operation_id', 'authorized', 'own_request', 'name', 'record_reference'},
              'send-once': {'authorized', 'own_request', 'capability', 'preview'},
              'send-result': {'route_id', 'operation_id', 'explicit'},
              'send-revoke': {'route_id', 'operation_id', 'explicit'}}
    common = {'action', 'workspace_id', 'personal_email_sha256'}
    if (not isinstance(request, dict) or not isinstance(request.get('action'), str) or request['action'] not in fields
            or set(request) != common | fields[request['action']]
            or not isinstance(request['workspace_id'], str) or not OP.fullmatch(request['workspace_id'])
            or not isinstance(request['personal_email_sha256'], str) or not DIGEST.fullmatch(request['personal_email_sha256'])):
        raise SenderError('invalid_request')
    if request.get('authorized', request.get('explicit')) is not True:
        raise SenderError('invalid_request')
    if request['action'] in ('send-prepare', 'send-once') and request['own_request'] is not True:
        raise SenderError('invalid_request')
    if 'route_id' in request and (not isinstance(request['route_id'], str) or request['route_id'] not in ROUTES
            or not isinstance(request['operation_id'], str) or not OP.fullmatch(request['operation_id'])):
        raise SenderError('unsupported_route')
    if request['action'] == 'send-prepare':
        _text(request['name'], 120)
        _text(request['record_reference'], 512)
    if request['action'] == 'send-once':
        if not isinstance(request['capability'], str) or not CAPABILITY.fullmatch(request['capability']):
            raise SenderError('invalid_request')
        _validate_preview(request['preview'])


def _validate_preview(value):
    if not _exact(value, ('from', 'to', 'subject', 'body')):
        raise SenderError('invalid_request')
    for key, maximum in (('from', 254), ('to', 254), ('subject', 120)):
        _text(value[key], maximum)
    if (not isinstance(value['body'], str) or not 0 < len(value['body'].encode('utf-8')) <= 4096
            or '\r' in value['body'] or any(ord(char) < 32 and char != '\n' for char in value['body'])):
        raise SenderError('invalid_request')


def _digest(preview):
    _validate_preview(preview)
    return hashlib.sha256(json.dumps(preview, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def _preview(request, mailbox, reference):
    return {'from': mailbox, 'to': ROUTES[request['route_id']][0],
            'subject': 'Request to remove or suppress my public record [' + reference + ']',
            'body': ('Hello,\n\nI am requesting removal or suppression of the publicly displayed personal information about me identified below.\n\n'
                     + 'My name: ' + request['name'] + '\nRecord reference: ' + request['record_reference']
                     + '\n\nPlease confirm the result or explain the official verification steps needed to process my request.'
                     + '\nThis separate removal-only address is controlled by me and may be used to reply about this request.'
                     + '\n\nRequest reference: ' + reference + '\n')}


def request_json(url, *, form=None, bearer=None, body=None, deadline=None):
    if (url not in (oauth.TOKEN_URL, oauth.IDENTITY_URL, SEND_URL)
            or url == oauth.TOKEN_URL and (form is None or bearer is not None or body is not None)
            or url == oauth.IDENTITY_URL and (not bearer or form is not None or body is not None)
            or url == SEND_URL and (not bearer or form is not None or not _exact(body, ('raw',)))):
        raise SenderError('invalid_endpoint')
    remaining = min(8, deadline - time.monotonic()) if deadline is not None else 8
    if remaining <= 0:
        raise SenderError('timeout')
    headers, data = {'Accept': 'application/json'}, None
    if form is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        data = urlencode(form).encode('ascii')
    if body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode('utf-8')
    if bearer:
        headers['Authorization'] = 'Bearer ' + bearer
    try:
        opener = build_opener(oauth._NoRedirect(), HTTPSHandler(context=ssl.create_default_context()))
        with opener.open(Request(url, data=data, headers=headers, method='POST' if data is not None else 'GET'), timeout=remaining) as response:
            if response.geturl() != url:
                raise ValueError()
            raw = response.read(65537)
        if len(raw) > 65536:
            raise ValueError()
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except Exception:
        raise SenderError('provider_unavailable') from None


def _token(config, deadline):
    response = request_json(oauth.TOKEN_URL, form={'grant_type': 'refresh_token',
        'refresh_token': config['tokens']['refresh_token'], **config['client']}, deadline=deadline)
    issued = oauth.tokens(response, previous=config['tokens'], expected=oauth.SEND_SCOPES)
    owner = request_json(oauth.IDENTITY_URL, bearer=issued['access_token'], deadline=deadline)
    if (owner.get('email_verified') is not True or not isinstance(owner.get('email'), str)
            or private.canonical_email(owner['email']) != private.canonical_email(config['mailbox'])
            or owner.get('sub') != config['identity']['sub']):
        raise SenderError('account_mismatch')
    return issued['access_token']


def _schema(db):
    db.execute('''CREATE TABLE IF NOT EXISTS removal_outbox (
        route TEXT, operation TEXT, workspace TEXT NOT NULL, personal_hash TEXT NOT NULL,
        account TEXT, state TEXT NOT NULL, request_id TEXT NOT NULL, digest TEXT,
        issued_at INTEGER, expires_at INTEGER, cap_hash TEXT, message_id TEXT, thread_id TEXT,
        PRIMARY KEY(route,operation))''')


def _row(db, request, route, operation):
    row = db.execute('SELECT * FROM removal_outbox WHERE route=? AND operation=?', (route, operation)).fetchone()
    if row and (row['workspace'] != request['workspace_id'] or not hmac.compare_digest(row['personal_hash'], request['personal_email_sha256'])):
        raise SenderError('grant_mismatch')
    return row


def _outcome(row, route, operation, status=None):
    state = status or (row['state'] if row else 'unknown')
    result = {'status': 'unknown' if state == 'started' else state, 'route_id': route,
              'operation_id': operation, 'request_id': row['request_id'] if row else None,
              'automatic_execution': False, 'delivery_verified': False,
              'acceptance_verified': False, 'deletion_verified': False}
    if row and state == 'provider_accepted':
        result.update(message_id=row['message_id'], thread_id=row['thread_id'])
    return result


def _capability(row, keys):
    claims = {key: row[column] for key, column in [('route_id', 'route'), ('operation_id', 'operation'),
        ('workspace_id', 'workspace'), ('personal_email_sha256', 'personal_hash'), ('account', 'account'),
        ('request_id', 'request_id'), ('message_digest', 'digest'), ('issued_at', 'issued_at'), ('expires_at', 'expires_at')]}
    claims['v'] = 1
    encoded = base64.urlsafe_b64encode(json.dumps(claims, sort_keys=True, separators=(',', ':')).encode()).decode().rstrip('=')
    signature = base64.urlsafe_b64encode(hmac.new(bytes.fromhex(keys['capability_secret']), b'outbound-v1.' + encoded.encode(), hashlib.sha256).digest()).decode().rstrip('=')
    return 's1.' + encoded + '.' + signature


def _claims(capability, keys, now):
    try:
        _prefix, encoded, signature = capability.split('.')
        expected = base64.urlsafe_b64encode(hmac.new(bytes.fromhex(keys['capability_secret']), b'outbound-v1.' + encoded.encode(), hashlib.sha256).digest()).decode().rstrip('=')
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        claims = json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)))
        if (not _exact(claims, ('v', 'route_id', 'operation_id', 'workspace_id', 'personal_email_sha256', 'account', 'request_id', 'message_digest', 'issued_at', 'expires_at'))
                or type(claims['v']) is not int or claims['v'] != 1 or not isinstance(claims['route_id'], str) or claims['route_id'] not in ROUTES
                or any(not isinstance(claims[key], str) or not OP.fullmatch(claims[key]) for key in ('operation_id', 'workspace_id'))
                or any(not isinstance(claims[key], str) or not DIGEST.fullmatch(claims[key]) for key in ('personal_email_sha256', 'account', 'message_digest'))
                or not isinstance(claims['request_id'], str) or not re.fullmatch(r'[a-f0-9]{32}', claims['request_id'])
                or type(claims['issued_at']) is not int or type(claims['expires_at']) is not int
                or claims['issued_at'] < 0 or claims['expires_at'] - claims['issued_at'] != LIFETIME or claims['issued_at'] > now + 60
                or claims['expires_at'] <= now):
            raise ValueError()
        return claims
    except (ValueError, TypeError, KeyError, UnicodeError):
        raise SenderError('invalid_capability') from None


def _reserve(host, db, request, account, kind, now):
    host._workspace(db, request)
    previous = db.execute('SELECT until_at FROM leases WHERE account=?', (account,)).fetchone()
    if previous and previous['until_at'] > now:
        raise SenderError('busy')
    day = int(now) // 86400
    host._quota(db, 'workspace:' + request['workspace_id'], day, kind, 120 if kind == 'send_status' else 10)
    host._quota(db, 'account:' + account, day, kind, 120 if kind == 'send_status' else 20)
    owner = secrets.token_hex(16)
    db.execute('INSERT INTO leases VALUES (?,?,?) ON CONFLICT(account) DO UPDATE SET owner=excluded.owner,until_at=excluded.until_at', (account, owner, now + 25))
    return owner


def _status(configured=False, enabled=False, mailbox=None):
    result = {'configured': configured, 'enabled': enabled, 'send_enabled': enabled,
        'provider': 'gmail', 'on_demand': True, 'access': 'local_native', 'authorization_required': True,
        'automatic_execution': False, 'routes': list(ROUTES)}
    if enabled:
        result['contact_email'] = mailbox
    return result


def handle(host, request, *, database, transaction, key_loader):
    validate_request(request)
    action, now = request['action'], host.clock()
    keys = key_loader(host.directory)
    with database(host.directory) as db:
        _schema(db)
        if action in ('send-result', 'send-revoke'):
            route, operation = request['route_id'], request['operation_id']
            with transaction(db):
                host._workspace(db, request)
                row = _row(db, request, route, operation)
                if action == 'send-result':
                    return _outcome(row, route, operation)
                if row and row['state'] not in ('preparing', 'ready', 'revoked'):
                    return _outcome(row, route, operation, 'already_started')
                if row:
                    db.execute('UPDATE removal_outbox SET state=? WHERE route=? AND operation=?', ('revoked', route, operation))
                else:
                    if db.execute('SELECT count(*) FROM removal_outbox').fetchone()[0] >= 10000:
                        raise SenderError('local_limit')
                    db.execute('INSERT INTO removal_outbox(route,operation,workspace,personal_hash,state,request_id) VALUES (?,?,?,?,?,?)', (route, operation, request['workspace_id'], request['personal_email_sha256'], 'revoked', secrets.token_hex(16)))
                return _outcome(_row(db, request, route, operation), route, operation)
        try:
            config = oauth.validate_config(host.loader(host.home / '.erase-me-removal-mail' / 'gmail-oauth.json'))
        except (ValueError, OSError, oauth.OAuthError):
            if action == 'send-status':
                return _status()
            raise SenderError('not_configured') from None
        if (not hmac.compare_digest(config['personal_email_sha256'], request['personal_email_sha256'])
                or hmac.compare_digest(private.personal_digest(config['mailbox']), request['personal_email_sha256'])):
            raise SenderError('personal_account_mismatch')
        if frozenset(config['scopes']) != oauth.SEND_SCOPES:
            if action == 'send-status':
                return _status(True)
            raise SenderError('send_permission_required')
        account = private.personal_digest(config['mailbox'])
        owner = None
        route = operation = None
        with transaction(db):
            if action == 'send-status':
                owner = _reserve(host, db, request, account, 'send_status', now)
            elif action == 'send-prepare':
                route, operation = request['route_id'], request['operation_id']
                row = _row(db, request, route, operation)
                if row and (row['state'] != 'ready' or row['expires_at'] <= now or row['account'] != account):
                    raise SenderError('already_started')
                reference = row['request_id'] if row else secrets.token_hex(16)
                preview = _preview(request, config['mailbox'], reference)
                digest = _digest(preview)
                if row and row['digest'] != digest:
                    raise SenderError('changed_preview')
                if not row and db.execute('SELECT count(*) FROM removal_outbox').fetchone()[0] >= 10000:
                    raise SenderError('local_limit')
                owner = _reserve(host, db, request, account, 'send_prepare', now)
                if not row:
                    db.execute('INSERT INTO removal_outbox(route,operation,workspace,personal_hash,account,state,request_id,digest,issued_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
                        (route, operation, request['workspace_id'], request['personal_email_sha256'], account, 'preparing', reference, digest, int(now), int(now) + LIFETIME))
            else:
                claims = _claims(request['capability'], keys, now)
                route, operation = claims['route_id'], claims['operation_id']
                row = _row(db, request, route, operation)
                if (not row or row['account'] != account or claims['account'] != account
                        or claims['workspace_id'] != request['workspace_id'] or claims['personal_email_sha256'] != request['personal_email_sha256']
                        or row['request_id'] != claims['request_id'] or row['digest'] != claims['message_digest']
                        or row['cap_hash'] != hashlib.sha256(request['capability'].encode()).hexdigest()
                        or _digest(request['preview']) != row['digest'] or request['preview']['from'] != config['mailbox']
                        or request['preview']['to'] != ROUTES[route][0]):
                    raise SenderError('grant_mismatch')
                if row['state'] != 'ready':
                    return _outcome(row, route, operation)
                owner = _reserve(host, db, request, account, 'send_once', now)
                db.execute('UPDATE removal_outbox SET state=? WHERE route=? AND operation=?', ('started', route, operation))
        try:
            token = _token(config, time.monotonic() + 25)
            if action == 'send-status':
                return _status(True, True, config['mailbox'])
            if action == 'send-prepare':
                with transaction(db):
                    current = _row(db, request, route, operation)
                    if current['state'] not in ('preparing', 'ready'):
                        raise SenderError('revoked')
                    capability = _capability(current, keys)
                    db.execute('UPDATE removal_outbox SET state=?,cap_hash=? WHERE route=? AND operation=?',
                        ('ready', hashlib.sha256(capability.encode()).hexdigest(), route, operation))
                    return {'status': 'ready', 'route_id': route, 'operation_id': operation, 'request_id': current['request_id'],
                        'capability': capability, 'expires_at': current['expires_at'], 'message_digest': digest,
                        'preview': preview, 'source_url': ROUTES[route][1], 'automatic_execution': False}
            message = EmailMessage(policy=SMTP)
            for key in ('from', 'to', 'subject'):
                message[key.title()] = request['preview'][key]
            message.set_content(request['preview']['body'], charset='utf-8', cte='quoted-printable')
            raw = base64.urlsafe_b64encode(message.as_bytes()).decode().rstrip('=')
            response = request_json(SEND_URL, bearer=token, body={'raw': raw}, deadline=time.monotonic() + 8)
            if (not isinstance(response.get('id'), str) or not OPAQUE.fullmatch(response['id'])
                    or not isinstance(response.get('threadId'), str) or not OPAQUE.fullmatch(response['threadId'])):
                raise SenderError('unknown_result')
            with transaction(db):
                db.execute('UPDATE removal_outbox SET state=?,message_id=?,thread_id=? WHERE route=? AND operation=? AND state=?',
                    ('provider_accepted', response['id'], response['threadId'], route, operation, 'started'))
                return _outcome(_row(db, request, route, operation), route, operation)
        except Exception:
            if route is not None:
                with transaction(db):
                    db.execute('UPDATE removal_outbox SET state=? WHERE route=? AND operation=? AND state IN (?,?)',
                        ('unknown' if action == 'send-once' else 'blocked', route, operation, 'started', 'preparing'))
                    if action == 'send-once':
                        return _outcome(_row(db, request, route, operation), route, operation)
            raise
        finally:
            if owner is not None:
                with transaction(db):
                    db.execute('DELETE FROM leases WHERE account=? AND owner=?', (account, owner))
