"""Local removal-mail tests use synthetic accounts, local files and mocked Google only."""
import io
import json
import os
from pathlib import Path
import stat
import struct
import sys

import pytest

import configure_removal_mailbox as private
import connect_removal_gmail as oauth
import install_mail_host as installer
import native_mail_host as host

ORIGIN = 'chrome-extension://' + 'a' * 32 + '/'
OTHER_ORIGIN = 'chrome-extension://' + 'b' * 32 + '/'
PERSONAL = 'personal.fixture@gmail.com'
MAILBOX = 'removal.fixture@gmail.com'
PRIMARY_HASH = private.personal_digest(PERSONAL)
WORKSPACE = '1' * 32
NOW = 1793836800


def config():
    return {'version': 1, 'provider': 'gmail_oauth', 'mailbox': MAILBOX,
            'personal_email_sha256': PRIMARY_HASH,
            'client': {'client_id': 'fixture.apps.googleusercontent.com', 'client_secret': 'fixture-client-secret'},
            'tokens': {'access_token': 'fixture-access-token', 'refresh_token': 'fixture-refresh-token', 'expires_at': NOW + 3600},
            'scopes': sorted(oauth.SCOPES), 'identity': {'email': MAILBOX, 'sub': 'fixture-google-sub', 'email_verified': True},
            'connected_at': '2026-11-05T00:00:00+00:00'}


def request(action, **values):
    return {'action': action, 'workspace_id': WORKSPACE, 'personal_email_sha256': PRIMARY_HASH,
            **({'authorized': True} if action in ('status', 'session') else {'explicit': True}), **values}


def session_request(number=1, route='fastpeoplesearch', **values):
    return request('session', **{'route_id': route, 'operation_id': f'{number:032x}', **values})


class Google:
    def __init__(self):
        self.identity = MAILBOX
        self.verified = True
        self.calls = []
        self.mail_reads = 0
        self.fail_receipt = False
        self.receipt_hook = None

    def __call__(self, url, **kwargs):
        self.calls.append(url)
        if url == oauth.TOKEN_URL:
            assert kwargs['form']['refresh_token'] == 'fixture-refresh-token'
            return {'access_token': 'fixture-refreshed-token'}
        if url == oauth.IDENTITY_URL:
            return {'email': self.identity, 'email_verified': self.verified}
        pytest.fail('A native test reached an unapproved Google or broker endpoint')

    def receipt(self, claims, *, now=None, pilot_key=None, receipt_ref=None):
        host.relay._gmail_token(1e20, pilot_key)
        self.mail_reads += 1
        if self.receipt_hook:
            self.receipt_hook()
        if self.fail_receipt:
            raise host.relay.MailError('fixture private provider body must not escape')
        available = claims['route_id'] in host.relay.CONFIRMATION_CONTRACTS
        result = {'status': 'held', 'route_id': claims['route_id'], 'operation_id': claims['operation_id'],
                  'request_id': claims['request_id'], 'automatic_execution': False,
                  'reason': 'route_validation_required' if available else 'confirmation_link_unvalidated',
                  'received_at': int(now), 'authenticated': True, 'receipt_ref': 'c' * 64,
                  'continuation_available': available}
        if receipt_ref and receipt_ref != result['receipt_ref']:
            return None
        return result, 'https://www.fastpeoplesearch.com/optout/removal?private-fixture' if available else None


@pytest.fixture
def ready(tmp_path, monkeypatch):
    home = (tmp_path / 'home').resolve()
    home.mkdir(mode=0o700)
    spec = installer.plan('a' * 32, home=home, platform='linux', python=Path(sys.executable))
    installer.install(spec)
    google = Google()
    monkeypatch.setattr(host.relay, '_request_json', google)
    monkeypatch.setattr(host.relay, '_find_receipt', google.receipt)
    clock = [float(NOW)]
    native = host.NativeMailHost(ORIGIN, home=home, loader=lambda _path: config(), clock=lambda: clock[0])
    return native, home, spec, google, clock


def call(native, value):
    return host.dispatch(value, native)


def session(native, number=1, route='fastpeoplesearch', **values):
    answer = call(native, session_request(number, route, **values))
    assert answer['ok'], answer
    return answer['result']


def test_status_checks_only_the_separate_google_identity_and_preserves_environment(ready, monkeypatch):
    native, home, _spec, google, _clock = ready
    monkeypatch.setenv('ERASE_GMAIL_REFRESH_TOKEN', 'unrelated-hosted-operator-token')
    answer = call(native, request('status'))
    assert answer == {'ok': True, 'result': {'configured': True, 'enabled': True, 'provider': 'gmail',
        'on_demand': True, 'access': 'local_native', 'authorization_required': True,
        'automatic_execution': False, 'routes': list(host.ROUTES), 'contact_email': MAILBOX}}
    assert google.calls == [oauth.TOKEN_URL, oauth.IDENTITY_URL]
    assert google.mail_reads == 0
    assert os.environ['ERASE_GMAIL_REFRESH_TOKEN'] == 'unrelated-hosted-operator-token'
    for path in (home / host.STATE_DIRECTORY).iterdir():
        assert stat.S_IMODE(path.stat().st_mode) == (0o700 if path.name.startswith('run-') else 0o600)
    assert stat.S_IMODE((home / host.STATE_DIRECTORY).stat().st_mode) == 0o700


def test_missing_setup_is_read_only_and_does_not_disclose_any_address(ready):
    native, _home, _spec, google, _clock = ready
    def missing(_path):
        raise oauth.OAuthError()
    native.loader = missing
    answer = call(native, request('status'))
    assert answer['ok'] and answer['result']['configured'] is False
    assert 'contact_email' not in answer['result']
    assert not google.calls
    assert call(native, session_request())['code'] == 'not_configured'


@pytest.mark.parametrize('action', ['status', 'session', 'check', 'continue'])
def test_primary_fingerprint_mismatch_stops_before_google_or_message_access(ready, action):
    native, _home, _spec, google, _clock = ready
    values = {'route_id': 'fastpeoplesearch', 'operation_id': '2' * 32} if action == 'session' else {}
    if action in ('check', 'continue'):
        values['capability'] = 'a.' + 'a' * 43
    if action == 'continue':
        values['receipt_ref'] = 'c' * 64
    answer = call(native, request(action, personal_email_sha256='d' * 64, **values))
    assert answer['code'] == 'personal_account_mismatch'
    assert not google.calls and not google.mail_reads


def test_a_configured_personal_gmail_alias_is_rejected_before_google(ready):
    native, _home, _spec, google, _clock = ready
    bad = config()
    bad['mailbox'] = 'p.e.r.s.o.n.a.l.fixture@googlemail.com'
    bad['identity']['email'] = bad['mailbox']
    native.loader = lambda _path: bad
    assert call(native, session_request())['code'] == 'not_configured'
    assert not google.calls


@pytest.mark.parametrize('action', ['status', 'session', 'check', 'continue'])
def test_changed_google_account_cannot_read_mail(ready, action):
    native, _home, _spec, google, clock = ready
    contact = session(native)
    receipt = call(native, request('check', capability=contact['capability']))['result']
    google.identity = PERSONAL
    reads = google.mail_reads
    clock[0] += 61
    values = {} if action == 'status' else {'route_id': 'fastpeoplesearch', 'operation_id': '9' * 32} if action == 'session' else {'capability': contact['capability']}
    if action == 'continue':
        values['receipt_ref'] = receipt['receipt_ref']
    assert call(native, request(action, **values))['ok'] is False
    assert google.mail_reads == reads


def test_session_is_idempotent_and_grant_is_bound_to_workspace_profile_and_operation(ready):
    native, home, _spec, google, _clock = ready
    first = session(native)
    again = session(native)
    assert again == first
    assert google.mail_reads == 0
    assert call(native, session_request(workspace_id='2' * 32))['code'] == 'grant_mismatch'
    assert call(native, request('check', capability=first['capability'], workspace_id='2' * 32))['code'] == 'grant_mismatch'
    with host._database(home / host.STATE_DIRECTORY) as db:
        assert db.execute('SELECT count(*) FROM grants').fetchone()[0] == 1
        assert db.execute('SELECT state FROM grants').fetchone()[0] == 'ready'
        assert 'capability' not in [row[1] for row in db.execute('PRAGMA table_info(grants)')]


def test_local_owned_searchpeoplefree_contact_does_not_weaken_hosted_shared_gate(ready):
    native, _home, _spec, google, _clock = ready
    contact = session(native, route='searchpeoplefree')
    assert contact['route_id'] == 'searchpeoplefree'
    assert '+erase-' in contact['contact_email'] and contact['contact_email'].endswith('@gmail.com')
    result = call(native, request('check', capability=contact['capability']))['result']
    assert result['authenticated'] is True and result['continuation_available'] is False
    before = google.mail_reads
    assert call(native, request('continue', capability=contact['capability'], receipt_ref=result['receipt_ref']))['code'] == 'unsupported_continuation'
    assert google.mail_reads == before
    keys = host._keys(native.directory)
    with host._environment(config(), keys):
        with pytest.raises(host.relay.MailError, match='shared removal contact'):
            host.relay.session({'route_id': 'searchpeoplefree', 'operation_id': '7' * 32, 'authorized': True},
                               now=NOW, pilot_key=keys['pilot_key'])


def test_check_cooldown_and_continuation_use_one_scoped_read_each_without_storing_url_or_body(ready):
    native, home, _spec, google, clock = ready
    contact = session(native)
    checked = call(native, request('check', capability=contact['capability']))
    assert checked['result']['authenticated'] is True and google.mail_reads == 1
    before = len(google.calls)
    assert call(native, request('check', capability=contact['capability']))['code'] == 'cooldown'
    assert len(google.calls) == before
    continued = call(native, request('continue', capability=contact['capability'], receipt_ref='c' * 64))
    assert continued['ok'] and continued['result']['status'] == 'confirmation_ready'
    assert google.mail_reads == 2
    before = len(google.calls)
    assert call(native, request('continue', capability=contact['capability'], receipt_ref='c' * 64))['code'] == 'already_started'
    assert len(google.calls) == before
    clock[0] += 61
    assert call(native, request('check', capability=contact['capability']))['ok']
    raw = (home / host.STATE_DIRECTORY / 'grants.sqlite3').read_bytes()
    for value in (b'private-fixture', b'https://', b'fixture-access-token', b'fixture-refresh-token', contact['capability'].encode(), MAILBOX.encode()):
        assert value not in raw


def test_unmatched_receipt_cannot_consume_continuation_or_contact_broker(ready):
    native, home, _spec, google, _clock = ready
    contact = session(native)
    before = len(google.calls)
    assert call(native, request('continue', capability=contact['capability'], receipt_ref='c' * 64))['code'] == 'receipt_mismatch'
    assert len(google.calls) == before
    call(native, request('check', capability=contact['capability']))
    assert call(native, request('continue', capability=contact['capability'], receipt_ref='d' * 64))['code'] == 'receipt_mismatch'
    with host._database(home / host.STATE_DIRECTORY) as db:
        assert db.execute('SELECT continuation_state FROM grants').fetchone()[0] is None


def test_failed_or_lost_continuation_is_reserved_before_network_and_never_repeated(ready):
    native, home, _spec, google, _clock = ready
    contact = session(native)
    call(native, request('check', capability=contact['capability']))
    google.fail_receipt = True
    first = call(native, request('continue', capability=contact['capability'], receipt_ref='c' * 64))
    assert first['ok'] is False
    assert 'private provider' not in json.dumps(first)
    reads = google.mail_reads
    assert call(native, request('continue', capability=contact['capability'], receipt_ref='c' * 64))['code'] == 'already_started'
    assert google.mail_reads == reads
    with host._database(home / host.STATE_DIRECTORY) as db:
        assert db.execute('SELECT continuation_state FROM grants').fetchone()[0] == 'started'


def test_failed_session_is_durably_reserved_before_network_and_does_not_issue_another_alias(ready):
    native, home, _spec, google, _clock = ready
    google.identity = PERSONAL
    assert call(native, session_request())['ok'] is False
    before = len(google.calls)
    google.identity = MAILBOX
    assert call(native, session_request())['code'] == 'already_started'
    assert len(google.calls) == before
    with host._database(home / host.STATE_DIRECTORY) as db:
        assert db.execute('SELECT state FROM grants').fetchone()[0] == 'issuing'


def test_revoke_is_irreversible_idempotent_and_requires_no_provider_access_even_after_expiry(ready):
    native, _home, _spec, google, clock = ready
    contact = session(native)
    before = len(google.calls)
    native.loader = lambda _path: (_ for _ in ()).throw(oauth.OAuthError())
    clock[0] += 8 * 86400
    first = call(native, request('revoke', capability=contact['capability']))
    again = call(native, request('revoke', capability=contact['capability']))
    assert first == again and first['result']['status'] == 'revoked'
    assert len(google.calls) == before
    native.loader = lambda _path: config()
    assert call(native, session_request())['code'] == 'revoked'
    clock[0] = NOW
    assert call(native, request('check', capability=contact['capability']))['code'] == 'revoked'


def test_revoke_during_receipt_work_suppresses_late_receipt_and_link_release(ready):
    native, _home, _spec, google, _clock = ready
    contact = session(native)
    google.receipt_hook = lambda: call(native, request('revoke', capability=contact['capability']))
    assert call(native, request('check', capability=contact['capability']))['code'] == 'revoked'
    assert call(native, session_request())['code'] == 'revoked'


def test_ten_aliases_per_workspace_and_twenty_per_account_are_durable(ready):
    native, home, _spec, google, _clock = ready
    for number in range(1, 11):
        session(native, number)
    before = len(google.calls)
    assert call(native, session_request(11))['code'] == 'quota_exceeded'
    assert len(google.calls) == before
    for number in range(11, 21):
        session(native, number, workspace_id='2' * 32)
    before = len(google.calls)
    restarted = host.NativeMailHost(ORIGIN, home=home, loader=lambda _path: config(), clock=lambda: NOW)
    assert call(restarted, session_request(21, workspace_id='3' * 32))['code'] == 'quota_exceeded'
    assert len(google.calls) == before


def test_workspace_and_account_check_budgets_are_reserved_before_network(ready):
    native, home, _spec, google, clock = ready
    contact = session(native)
    with host._database(home / host.STATE_DIRECTORY) as db:
        day = NOW // 86400
        db.execute('INSERT INTO counters VALUES (?,?,?,?)', ('workspace:' + WORKSPACE, day, 'check', 29))
    assert call(native, request('check', capability=contact['capability']))['ok']
    clock[0] += 61
    before = len(google.calls)
    assert call(native, request('check', capability=contact['capability']))['code'] == 'quota_exceeded'
    assert len(google.calls) == before
    with host._database(home / host.STATE_DIRECTORY) as db:
        db.execute('DELETE FROM counters WHERE kind=?', ('check',))
        db.execute('INSERT INTO counters VALUES (?,?,?,?)', ('account:' + private.personal_digest(MAILBOX), day, 'check', 100))
    assert call(native, request('check', capability=contact['capability']))['code'] == 'quota_exceeded'
    assert len(google.calls) == before


def test_inflight_account_lease_refuses_parallel_google_actions_and_recovers_only_on_next_action(ready):
    native, home, _spec, google, clock = ready
    account = private.personal_digest(MAILBOX)
    with host._database(home / host.STATE_DIRECTORY) as db:
        db.execute('INSERT INTO leases VALUES (?,?,?)', (account, 'fixture-owner', NOW + 25))
    assert call(native, request('status'))['code'] == 'busy'
    assert not google.calls
    clock[0] += 26
    assert call(native, request('status'))['ok']
    with host._database(home / host.STATE_DIRECTORY) as db:
        assert db.execute('SELECT count(*) FROM leases').fetchone()[0] == 0


@pytest.mark.parametrize('bad', [None, [], {}, {'action': 'run'},
    request('status', authorized=False), request('status', extra='private-path'),
    request('status', workspace_id='../profile'), request('status', personal_email_sha256='A' * 64),
    session_request(route='apollo'), session_request(operation_id='bad'),
    request('check', capability='bad'), request('check', capability='a.' + 'a' * 43, explicit=False),
    request('continue', capability='a.' + 'a' * 43, receipt_ref='bad'),
    request('status', config='/private/other.json')])
def test_invalid_payload_never_loads_credentials_or_calls_google(ready, bad):
    native, _home, _spec, google, _clock = ready
    native.loader = lambda _path: pytest.fail('Invalid payload loaded OAuth credentials')
    assert call(native, bad)['code'] == 'invalid_request'
    assert not google.calls


def test_origin_registration_and_private_file_permissions_are_required(ready):
    _native, home, _spec, google, _clock = ready
    with pytest.raises(host.MailHostError, match='local removal-only'):
        host.NativeMailHost(OTHER_ORIGIN, home=home)
    directory = home / host.STATE_DIRECTORY
    (directory / 'allowed-origin.json').chmod(0o644)
    with pytest.raises(host.MailHostError):
        host.NativeMailHost(ORIGIN, home=home)
    assert not google.calls


@pytest.mark.parametrize('name', ['keys.json', 'grants.sqlite3'])
def test_state_symlinks_are_rejected_before_provider_access(ready, tmp_path, name):
    native, home, _spec, google, _clock = ready
    path = home / host.STATE_DIRECTORY / name
    outside = tmp_path / 'unrelated'
    outside.write_text('do not read or change')
    path.symlink_to(outside)
    assert call(native, request('status'))['ok'] is False
    assert outside.read_text() == 'do not read or change'
    assert not google.calls


def framed(value):
    raw = json.dumps(value).encode()
    return struct.pack('<I', len(raw)) + raw


@pytest.mark.parametrize('data', [b'', b'\x01', struct.pack('<I', 0), struct.pack('<I', 8193),
    struct.pack('<I', 1) + b'\xff', struct.pack('<I', 7) + b'{"x":1}',
    struct.pack('<I', 1) + b'{'])
def test_bounded_native_protocol_rejects_bad_frames_before_host_creation(data):
    output = io.BytesIO()
    host.serve_once(io.BytesIO(data), output, origin=ORIGIN,
                    host_factory=lambda _origin: pytest.fail('Bad frame created a mail host'))
    raw = output.getvalue()
    assert struct.unpack('<I', raw[:4])[0] == len(raw) - 4
    assert json.loads(raw[4:])['ok'] is False
    assert len(raw) < 512


def test_duplicate_json_keys_and_nonfinite_values_never_create_host():
    for text in ['{"action":"status","action":"session"}', '{"action":NaN}']:
        output = io.BytesIO()
        raw = text.encode()
        host.serve_once(io.BytesIO(struct.pack('<I', len(raw)) + raw), output, origin=ORIGIN,
                        host_factory=lambda _origin: pytest.fail('Invalid JSON created host'))
        assert json.loads(output.getvalue()[4:])['code'] == 'invalid_request'


def test_native_protocol_returns_one_bounded_frame_and_never_echoes_private_exceptions(ready):
    native, _home, _spec, _google, _clock = ready
    output = io.BytesIO()
    host.serve_once(io.BytesIO(framed(request('status'))), output, origin=ORIGIN, host_factory=lambda _origin: native)
    assert json.loads(output.getvalue()[4:])['ok'] is True
    native.loader = lambda _path: (_ for _ in ()).throw(RuntimeError('fixture refresh_token and private message'))
    answer = call(native, request('status'))
    assert answer['code'] == 'unavailable'
    assert 'refresh_token' not in json.dumps(answer)


def test_installer_plan_install_check_replace_uninstall_preserve_private_credentials_and_grants(ready):
    native, home, spec, google, _clock = ready
    assert installer.check(spec)['installed'] is True
    assert '"$@"' in spec['wrapper_text']
    assert spec['manifest']['allowed_origins'] == [ORIGIN]
    session(native)
    with pytest.raises(ValueError):
        installer.install(spec)
    installer.install(spec, replace=True)
    assert installer.check(spec)['installed'] is True
    result = installer.uninstall(spec)
    assert result['scheduled_work'] is False and result['private_mail_data_retained'] is True
    assert (home / host.STATE_DIRECTORY / 'grants.sqlite3').exists()
    assert (home / host.STATE_DIRECTORY / 'keys.json').exists()
    assert not Path(spec['manifest_path']).exists()
    assert not (home / host.STATE_DIRECTORY / 'allowed-origin.json').exists()
    assert installer.check(spec)['installed'] is False
    assert google.mail_reads == 0


def test_unrelated_native_manifest_and_symlink_installation_paths_are_refused(ready, tmp_path):
    _native, home, spec, google, _clock = ready
    manifest = Path(spec['manifest_path'])
    value = json.loads(manifest.read_text())
    value['path'] = '/tmp/unrelated-command'
    manifest.write_text(json.dumps(value))
    with pytest.raises(ValueError):
        installer.install(spec, replace=True)
    assert not google.calls
    with pytest.raises(ValueError):
        installer.plan('../bad', home=home, platform='linux')
    assert installer.main(['--extension-id', 'bad', '--check']) == 2
