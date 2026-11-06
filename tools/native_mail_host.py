#!/usr/bin/env python3
"""One explicit, per-user removal-only Gmail action over Chrome native messaging.

Credentials stay in the existing private installed-OAuth configuration. This process
does not follow links, submit broker forms, send messages or schedule future work.
"""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import stat
import struct
import sys
import time
from typing import BinaryIO

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
sys.path.insert(0, str(ROOT))
import connect_removal_gmail as oauth  # noqa: E402
import configure_removal_mailbox as private  # noqa: E402
from preview.lib import removal_mail as relay  # noqa: E402

HOST_NAME = 'org.eraseme.mail'
MARKER = '.erase-me-mail-native'
MARKER_TEXT = 'Erase Me per-user removal-only mail host.\n'
STATE_DIRECTORY = '.erase-me-mail-native'
MAX_REQUEST_BYTES = 8192
MAX_RESPONSE_BYTES = 12288
MAX_DB_BYTES = 8 * 1024 * 1024
ROUTES = ('fastpeoplesearch', 'usphonebook', 'searchpeoplefree')
OPERATION = re.compile(r'[a-f0-9-]{32,40}\Z')
DIGEST = re.compile(r'[a-f0-9]{64}\Z')
CAPABILITY = re.compile(r'[A-Za-z0-9_-]{1,1800}\.[A-Za-z0-9_-]{43}\Z')
ORIGIN = re.compile(r'chrome-extension://[a-p]{32}/\Z')
LEASE_SECONDS = 25
CHECK_COOLDOWN = 60
ENV_KEYS = ('ERASE_DEDICATED_MAILBOX', 'ERASE_MAIL_RELAY_ENABLED', 'ERASE_MAIL_PILOT_KEY',
            'ERASE_REMOVAL_INBOX', 'ERASE_GMAIL_CLIENT_ID', 'ERASE_GMAIL_CLIENT_SECRET',
            'ERASE_GMAIL_REFRESH_TOKEN', 'ERASE_MAIL_CAPABILITY_SECRET')


class MailHostError(Exception):
    def __init__(self, code='unavailable'):
        self.code = code
        super().__init__('The local removal-only mailbox action could not be completed.')


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise MailHostError('invalid_request')
        result[key] = value
    return result


def _nonfinite(_value):
    raise MailHostError('invalid_request')


def _regular(path: Path) -> None:
    info = path.lstat()
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1
            or stat.S_IMODE(info.st_mode) != 0o600):
        raise MailHostError('unsafe_local_files')


def _no_symlinks(path: Path) -> None:
    if any(part.is_symlink() for part in (path, *path.parents)):
        raise MailHostError('unsafe_local_files')


def state_directory(home: Path, *, create=False) -> Path:
    home = Path(home).absolute()
    directory = home / STATE_DIRECTORY
    _no_symlinks(directory)
    if directory.resolve() == ROOT or ROOT in directory.resolve().parents:
        raise MailHostError('unsafe_local_files')
    if not directory.exists():
        if not create:
            raise MailHostError('not_installed')
        directory.mkdir(mode=0o700)
    info = directory.stat()
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid()
            or stat.S_IMODE(info.st_mode) != 0o700):
        raise MailHostError('unsafe_local_files')
    marker = directory / MARKER
    if not marker.exists():
        if not create or any(directory.iterdir()):
            raise MailHostError('unsafe_local_files')
        _write_new(marker, MARKER_TEXT)
    _regular(marker)
    if marker.read_text(encoding='utf-8') != MARKER_TEXT:
        raise MailHostError('unsafe_local_files')
    return directory


def _write_new(path: Path, text: str) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
        stream.write(text)
        stream.flush()
        os.fsync(stream.fileno())


def _keys(directory: Path) -> dict:
    path = directory / 'keys.json'
    if not path.exists() and not path.is_symlink():
        try:
            _write_new(path, json.dumps({'version': 1, 'capability_secret': secrets.token_hex(32),
                                         'pilot_key': secrets.token_hex(32)}))
        except FileExistsError:
            pass
    _regular(path)
    if path.stat().st_size > 1024:
        raise MailHostError('unsafe_local_files')
    value = json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=_object)
    if (not isinstance(value, dict) or set(value) != {'version', 'capability_secret', 'pilot_key'}
            or type(value['version']) is not int or value['version'] != 1
            or any(not isinstance(value[key], str) or not DIGEST.fullmatch(value[key])
                   for key in ('capability_secret', 'pilot_key'))):
        raise MailHostError('unsafe_local_files')
    return value


@contextmanager
def _database(directory: Path):
    path = directory / 'grants.sqlite3'
    for candidate in (path, Path(str(path) + '-journal'), Path(str(path) + '-wal'), Path(str(path) + '-shm')):
        _no_symlinks(candidate)
        if candidate.exists():
            _regular(candidate)
    if not path.exists():
        try:
            _write_new(path, '')
        except FileExistsError:
            pass
    _regular(path)
    if path.stat().st_size > MAX_DB_BYTES:
        raise MailHostError('local_limit')
    old_umask = os.umask(0o077)
    connection = None
    try:
        connection = sqlite3.connect(path, timeout=1, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA trusted_schema=OFF')
        connection.execute('PRAGMA journal_mode=DELETE')
        connection.executescript('''
            CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, personal_hash TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS counters (scope TEXT, day INTEGER, kind TEXT, count INTEGER NOT NULL,
                PRIMARY KEY(scope,day,kind));
            CREATE TABLE IF NOT EXISTS leases (account TEXT PRIMARY KEY, owner TEXT, until_at REAL);
            CREATE TABLE IF NOT EXISTS grants (
                route TEXT, operation TEXT, workspace TEXT NOT NULL, personal_hash TEXT NOT NULL,
                account TEXT NOT NULL, state TEXT NOT NULL, request_id TEXT, issued_at INTEGER,
                expires_at INTEGER, cap_hash TEXT, receipt_ref TEXT, continuation_available INTEGER DEFAULT 0,
                continuation_state TEXT, last_check_at REAL, PRIMARY KEY(route,operation));
        ''')
        yield connection
    finally:
        if connection is not None:
            connection.close()
        os.umask(old_umask)


@contextmanager
def _transaction(db):
    db.execute('BEGIN IMMEDIATE')
    try:
        yield
    except Exception:
        db.execute('ROLLBACK')
        raise
    else:
        db.execute('COMMIT')


def _validate(request):
    if isinstance(request, dict) and isinstance(request.get('action'), str) and request['action'].startswith('send-'):
        import removal_sender
        try:
            removal_sender.validate_request(request)
            return
        except removal_sender.SenderError as error:
            raise MailHostError(error.code) from None
    common = {'action', 'workspace_id', 'personal_email_sha256'}
    fields = {'status': {'authorized'}, 'session': {'authorized', 'route_id', 'operation_id'},
              'check': {'explicit', 'capability'}, 'continue': {'explicit', 'capability', 'receipt_ref'},
              'revoke': {'explicit', 'capability'}}
    if (not isinstance(request, dict) or not isinstance(request.get('action'), str)
            or request['action'] not in fields or set(request) != common | fields[request['action']]
            or not isinstance(request['workspace_id'], str) or not OPERATION.fullmatch(request['workspace_id'])
            or not isinstance(request['personal_email_sha256'], str) or not DIGEST.fullmatch(request['personal_email_sha256'])):
        raise MailHostError('invalid_request')
    if request['action'] in ('status', 'session'):
        if request['authorized'] is not True:
            raise MailHostError('invalid_request')
    elif request['explicit'] is not True:
        raise MailHostError('invalid_request')
    if request['action'] == 'session':
        if (request['route_id'] not in ROUTES or not isinstance(request['operation_id'], str)
                or not OPERATION.fullmatch(request['operation_id'])):
            raise MailHostError('invalid_request')
    if 'capability' in request and (not isinstance(request['capability'], str)
                                    or not CAPABILITY.fullmatch(request['capability'])):
        raise MailHostError('invalid_request')
    if 'receipt_ref' in request and (not isinstance(request['receipt_ref'], str)
                                     or not DIGEST.fullmatch(request['receipt_ref'])):
        raise MailHostError('invalid_request')


def _status(ready=False, mailbox=None):
    result = {'configured': ready, 'enabled': ready, 'provider': 'gmail', 'on_demand': True,
              'access': 'local_native', 'authorization_required': True, 'automatic_execution': False,
              'routes': list(ROUTES)}
    if ready:
        result['contact_email'] = mailbox
    return result


@contextmanager
def _environment(config, keys):
    values = dict(zip(ENV_KEYS, ('true', 'true', keys['pilot_key'], config['mailbox'],
        config['client']['client_id'], config['client']['client_secret'], config['tokens']['refresh_token'],
        keys['capability_secret'])))
    old = {key: os.environ.get(key) for key in ENV_KEYS}
    os.environ.update(values)
    try:
        yield
    finally:
        for key, value in old.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


class NativeMailHost:
    def __init__(self, origin: str, *, home: Path | None = None, loader=oauth.load_config, engine=relay, clock=time.time):
        self.home = Path.home() if home is None else Path(home)
        self.directory = state_directory(self.home)
        registration = self.directory / 'allowed-origin.json'
        _regular(registration)
        if registration.stat().st_size > 1024:
            raise MailHostError('untrusted_origin')
        value = json.loads(registration.read_text(encoding='utf-8'), object_pairs_hook=_object)
        if (not isinstance(origin, str) or not ORIGIN.fullmatch(origin) or not isinstance(value, dict)
                or set(value) != {'version', 'origin'} or type(value['version']) is not int or value['version'] != 1
                or value['origin'] != origin):
            raise MailHostError('untrusted_origin')
        self.loader, self.engine, self.clock = loader, engine, clock

    @staticmethod
    def _workspace(db, request):
        previous = db.execute('SELECT personal_hash FROM workspaces WHERE id=?', (request['workspace_id'],)).fetchone()
        if previous and not hmac.compare_digest(previous['personal_hash'], request['personal_email_sha256']):
            raise MailHostError('workspace_mismatch')
        db.execute('INSERT OR IGNORE INTO workspaces VALUES (?,?)',
                   (request['workspace_id'], request['personal_email_sha256']))

    @staticmethod
    def _quota(db, scope, day, kind, maximum):
        row = db.execute('SELECT count FROM counters WHERE scope=? AND day=? AND kind=?', (scope, day, kind)).fetchone()
        if row and row['count'] >= maximum:
            raise MailHostError('quota_exceeded')
        db.execute('INSERT INTO counters VALUES (?,?,?,1) ON CONFLICT(scope,day,kind) DO UPDATE SET count=count+1',
                   (scope, day, kind))

    def _network_reservation(self, db, request, account, kind, now):
        day = int(now) // 86400
        self._workspace(db, request)
        lease = db.execute('SELECT until_at FROM leases WHERE account=?', (account,)).fetchone()
        if lease and lease['until_at'] > now:
            raise MailHostError('busy')
        self._quota(db, 'workspace:' + request['workspace_id'], day, kind,
                    {'issue': 10, 'check': 30, 'status': 120}[kind])
        self._quota(db, 'account:' + account, day, kind, {'issue': 20, 'check': 100, 'status': 120}[kind])
        owner = secrets.token_hex(16)
        db.execute('INSERT INTO leases VALUES (?,?,?) ON CONFLICT(account) DO UPDATE SET owner=excluded.owner,until_at=excluded.until_at',
                   (account, owner, now + LEASE_SECONDS))
        return owner

    @staticmethod
    def _grant(db, request, capability, account=None, *, allow_revoked=False):
        hashed = hashlib.sha256(capability.encode()).hexdigest()
        row = db.execute('SELECT * FROM grants WHERE cap_hash=?', (hashed,)).fetchone()
        if (not row or row['workspace'] != request['workspace_id']
                or not hmac.compare_digest(row['personal_hash'], request['personal_email_sha256'])
                or account is not None and row['account'] != account):
            raise MailHostError('grant_mismatch')
        if row['state'] != 'ready' and not (allow_revoked and row['state'] == 'revoked'):
            raise MailHostError('revoked' if row['state'] == 'revoked' else 'already_started')
        return row

    def _session_result(self, row):
        payload = {'v': 1, 'request_id': row['request_id'], 'route_id': row['route'], 'operation_id': row['operation'],
                   'recipient': self.engine._recipient(row['request_id']), 'issued_at': row['issued_at'], 'expires_at': row['expires_at']}
        encoded = self.engine._b64(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode())
        signature = self.engine._b64(hmac.new(self.engine._secret(), encoded.encode('ascii'), hashlib.sha256).digest())
        return {'status': 'ready', 'capability': encoded + '.' + signature, 'request_id': row['request_id'],
                'route_id': row['route'], 'operation_id': row['operation'], 'contact_email': payload['recipient'],
                'expires_at': row['expires_at'], 'automatic_execution': False}

    def _issue(self, request, now, keys):
        if request['route_id'] != 'searchpeoplefree':
            return self.engine.session({'route_id': request['route_id'], 'operation_id': request['operation_id'],
                                        'authorized': True}, now=now, pilot_key=keys['pilot_key'])
        # This is a privately authenticated account owned by this user, unlike
        # the public relay's shared service alias. Its hosted issuance gate stays
        # unchanged. No SPF continuation destination is enabled by this adapter.
        self.engine._gmail_token(time.monotonic() + self.engine.CHECK_BUDGET_SECONDS, keys['pilot_key'])
        return self._session_result({'request_id': secrets.token_hex(16), 'route': request['route_id'],
            'operation': request['operation_id'], 'issued_at': int(now), 'expires_at': int(now) + self.engine.CAPABILITY_LIFETIME})

    def handle(self, request):
        _validate(request)
        action = request['action']
        if action.startswith('send-'):
            import removal_sender
            try:
                return removal_sender.handle(self, request, database=_database, transaction=_transaction, key_loader=_keys)
            except removal_sender.SenderError as error:
                raise MailHostError(error.code) from None
        if action == 'revoke':
            with _database(self.directory) as db, _transaction(db):
                self._workspace(db, request)
                row = self._grant(db, request, request['capability'], allow_revoked=True)
                db.execute('UPDATE grants SET state=? WHERE route=? AND operation=?', ('revoked', row['route'], row['operation']))
                return {'status': 'revoked', 'route_id': row['route'], 'operation_id': row['operation'],
                        'request_id': row['request_id'], 'automatic_execution': False}
        try:
            config = oauth.validate_config(self.loader(self.home / '.erase-me-removal-mail' / 'gmail-oauth.json'))
        except (oauth.OAuthError, ValueError, OSError):
            if action == 'status':
                return _status()
            raise MailHostError('not_configured') from None
        if not hmac.compare_digest(config['personal_email_sha256'], request['personal_email_sha256']):
            raise MailHostError('personal_account_mismatch')
        if hmac.compare_digest(private.personal_digest(config['mailbox']), request['personal_email_sha256']):
            raise MailHostError('personal_account_mismatch')
        account = private.personal_digest(config['mailbox'])
        keys = _keys(self.directory)
        with _database(self.directory) as db, _environment(config, keys):
            now = self.clock()
            owner = None
            row = None
            with _transaction(db):
                if action == 'session':
                    row = db.execute('SELECT * FROM grants WHERE route=? AND operation=?', (request['route_id'], request['operation_id'])).fetchone()
                    if row:
                        if (row['workspace'] != request['workspace_id'] or row['personal_hash'] != request['personal_email_sha256']
                                or row['account'] != account):
                            raise MailHostError('grant_mismatch')
                        if row['state'] != 'ready':
                            raise MailHostError('revoked' if row['state'] == 'revoked' else 'already_started')
                        if row['expires_at'] <= now:
                            raise MailHostError('expired')
                    elif db.execute('SELECT count(*) FROM grants').fetchone()[0] >= 10000:
                        raise MailHostError('local_limit')
                    owner = self._network_reservation(db, request, account, 'status' if row else 'issue', now)
                    if not row:
                        db.execute('INSERT INTO grants(route,operation,workspace,personal_hash,account,state) VALUES (?,?,?,?,?,?)',
                                   (request['route_id'], request['operation_id'], request['workspace_id'], request['personal_email_sha256'], account, 'issuing'))
                elif action == 'status':
                    owner = self._network_reservation(db, request, account, 'status', now)
                else:
                    claims = self.engine.verify_capability(request['capability'], now=now)
                    row = self._grant(db, request, request['capability'], account)
                    if (row['route'] != claims['route_id'] or row['operation'] != claims['operation_id']
                            or row['request_id'] != claims['request_id']):
                        raise MailHostError('grant_mismatch')
                    if action == 'continue':
                        if claims['route_id'] not in self.engine.CONFIRMATION_CONTRACTS:
                            raise MailHostError('unsupported_continuation')
                        if (row['receipt_ref'] != request['receipt_ref'] or row['continuation_available'] != 1):
                            raise MailHostError('receipt_mismatch')
                        if row['continuation_state'] is not None:
                            raise MailHostError('already_started')
                    elif row['last_check_at'] is not None and now - row['last_check_at'] < CHECK_COOLDOWN:
                        raise MailHostError('cooldown')
                    owner = self._network_reservation(db, request, account, 'check', now)
                    if action == 'continue':
                        db.execute('UPDATE grants SET continuation_state=? WHERE route=? AND operation=?', ('started', row['route'], row['operation']))
                    else:
                        db.execute('UPDATE grants SET last_check_at=? WHERE route=? AND operation=?', (now, row['route'], row['operation']))
            try:
                if action == 'status':
                    self.engine._gmail_token(time.monotonic() + self.engine.CHECK_BUDGET_SECONDS, keys['pilot_key'])
                    return _status(True, config['mailbox'])
                if action == 'session':
                    if row:
                        self.engine._gmail_token(time.monotonic() + self.engine.CHECK_BUDGET_SECONDS, keys['pilot_key'])
                        self._grant(db, request, self._session_result(row)['capability'], account)
                        return self._session_result(row)
                    result = self._issue(request, now, keys)
                    claims = self.engine.verify_capability(result['capability'], now=now)
                    with _transaction(db):
                        updated = db.execute('UPDATE grants SET state=?,request_id=?,issued_at=?,expires_at=?,cap_hash=? WHERE route=? AND operation=? AND state=?',
                                   ('ready', claims['request_id'], claims['issued_at'], claims['expires_at'], hashlib.sha256(result['capability'].encode()).hexdigest(), request['route_id'], request['operation_id'], 'issuing'))
                        if updated.rowcount != 1:
                            raise MailHostError('already_started')
                    return result
                if action == 'check':
                    result = self.engine.check({'capability': request['capability'], 'explicit': True}, now=now, pilot_key=keys['pilot_key'])
                    with _transaction(db):
                        updated = db.execute('UPDATE grants SET receipt_ref=?,continuation_available=? WHERE route=? AND operation=? AND state=?',
                                   (result.get('receipt_ref'), int(result.get('continuation_available') is True), row['route'], row['operation'], 'ready'))
                        if updated.rowcount != 1:
                            raise MailHostError('revoked')
                    return result
                result = self.engine.continue_confirmation({'capability': request['capability'], 'receipt_ref': request['receipt_ref'], 'explicit': True}, now=now, pilot_key=keys['pilot_key'])
                with _transaction(db):
                    updated = db.execute('UPDATE grants SET continuation_state=? WHERE route=? AND operation=? AND state=?', ('released', row['route'], row['operation'], 'ready'))
                    if updated.rowcount != 1:
                        raise MailHostError('revoked')
                return result
            finally:
                if owner is not None:
                    with _transaction(db):
                        db.execute('DELETE FROM leases WHERE account=? AND owner=?', (account, owner))


def _read_exact(stream: BinaryIO, size: int) -> bytes:
    chunks = []
    while size:
        chunk = stream.read(size)
        if not isinstance(chunk, bytes) or not chunk or len(chunk) > size:
            raise MailHostError('invalid_request')
        chunks.append(chunk)
        size -= len(chunk)
    return b''.join(chunks)


def read_request(stream: BinaryIO):
    size = struct.unpack('<I', _read_exact(stream, 4))[0]
    if not 0 < size <= MAX_REQUEST_BYTES:
        raise MailHostError('invalid_request')
    try:
        value = json.loads(_read_exact(stream, size).decode('utf-8'), object_pairs_hook=_object, parse_constant=_nonfinite)
        _validate(value)
        return value
    except (ValueError, TypeError, UnicodeError, RecursionError):
        raise MailHostError('invalid_request') from None


def dispatch(request, host):
    try:
        return {'ok': True, 'result': host.handle(request)}
    except MailHostError as exc:
        return {'ok': False, 'code': exc.code, 'error': 'The local removal-only mailbox action could not be completed.'}
    except Exception:
        return {'ok': False, 'code': 'unavailable', 'error': 'The local removal-only mailbox action could not be completed.'}


def serve_once(source: BinaryIO, destination: BinaryIO, *, origin: str, host_factory=NativeMailHost):
    try:
        request = read_request(source)
        response = dispatch(request, host_factory(origin))
    except MailHostError as exc:
        response = {'ok': False, 'code': exc.code, 'error': 'The local removal-only mailbox action could not be completed.'}
    except Exception:
        response = {'ok': False, 'code': 'unavailable', 'error': 'The local removal-only mailbox action could not be completed.'}
    raw = json.dumps(response, ensure_ascii=True, separators=(',', ':')).encode()
    if len(raw) > MAX_RESPONSE_BYTES:
        raw = b'{"ok":false,"code":"unavailable","error":"The local removal-only mailbox action could not be completed."}'
    destination.write(struct.pack('<I', len(raw)) + raw)
    destination.flush()


def main():
    if len(sys.argv) != 2 or not ORIGIN.fullmatch(sys.argv[1]):
        return 1
    try:
        serve_once(sys.stdin.buffer, sys.stdout.buffer, origin=sys.argv[1])
        return 0
    except Exception:
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
