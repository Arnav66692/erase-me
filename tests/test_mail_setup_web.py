"""Local setup uses synthetic accounts and loopback fixtures, never real OAuth."""
import http.client
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import threading

import pytest

import mail_setup_web as web
import setup_removal_mail as setup


EXTENSION = 'a' * 32
CLIENT = json.dumps({'installed': {'client_id': 'fixture.apps.googleusercontent.com',
                                 'client_secret': 'fixture-client-secret',
                                 'auth_uri': setup.oauth.AUTH_URL, 'token_uri': setup.oauth.TOKEN_URL}})
RESULT = {'ok': True, 'installed': True, 'reused_connection': False,
          'identity_checked': True, 'messages_read': False, 'scheduled_work': False}


def oauth_config():
    return {'version': 1, 'provider': 'gmail_oauth', 'mailbox': 'removal.fixture@gmail.com',
            'personal_email_sha256': setup.oauth.private.personal_digest('personal.fixture@gmail.com'),
            'client': {key: json.loads(CLIENT)['installed'][key] for key in ('client_id', 'client_secret')},
            'tokens': {'access_token': 'fixture-access', 'refresh_token': 'fixture-refresh', 'expires_at': 2000000000},
            'identity': {'email': 'removal.fixture@gmail.com', 'sub': 'fixture-sub', 'email_verified': True},
            'scopes': sorted(setup.oauth.SCOPES), 'connected_at': '2026-11-05T00:00:00+00:00'}


def payload(**changes):
    return {'personal_email': 'personal.fixture@gmail.com', 'mailbox': 'removal.fixture@gmail.com',
            'extension_id': EXTENSION, 'browser': 'chrome', 'client_json': None,
            'removal_only': True, 'replace_registration': False, 'reconnect': False, **changes}


@pytest.fixture
def local(tmp_path):
    calls = []

    def runner(**kwargs):
        calls.append(kwargs)
        kwargs['ensure_active']('before_identity')
        kwargs['ensure_active']('after_identity')
        kwargs['ensure_active']('before_install')
        kwargs['ensure_active']('complete')
        return dict(RESULT)

    assets = tmp_path / 'assets'
    assets.mkdir()
    for filename, _kind in web.ASSETS.values():
        (assets / filename).write_text('fixture static asset')
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    config = home / '.erase-me-removal-mail' / 'gmail-oauth.json'
    session = web.SetupSession(extension_id=EXTENSION, runner=runner, home=home,
                               config_path=config, platform='linux', assets=assets)
    server = web.make_server(session)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    def request(method='POST', path='/api/connect', body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=5)
        actual_headers = {'X-Erase-Setup': session.token, 'Origin': session.origin,
                          'Content-Type': 'application/json'}
        actual_headers.update(headers or {})
        raw = json.dumps(payload() if body is None else body).encode() if not isinstance(body, bytes) else body
        connection.request(method, path, body=None if method == 'GET' else raw, headers=actual_headers)
        response = connection.getresponse()
        data = response.read()
        result = (response.status, dict(response.getheaders()), json.loads(data) if response.getheader('Content-Type', '').startswith('application/json') else data)
        connection.close()
        return result

    yield session, server, calls, request, config, assets
    session.close()
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)


def test_info_is_explicitly_authenticated_and_performs_no_setup(local):
    session, _server, calls, request, config, _assets = local
    code, headers, data = request('GET', '/api/info')
    assert code == 200 and data == {'ok': True, 'result': {'extension_id': EXTENSION, 'browser': 'chrome'}}
    assert calls == [] and not config.parent.exists()
    assert headers['Cache-Control'] == 'no-store' and 'Access-Control-Allow-Origin' not in headers
    assert session.token not in json.dumps(data)


def test_static_assets_are_allowlisted_and_cannot_read_source_or_credentials(local):
    _session, _server, calls, request, _config, _assets = local
    for path in web.ASSETS:
        code, headers, data = request('GET', path)
        assert code == 200 and data == b'fixture static asset'
        assert "connect-src 'self'" in headers['Content-Security-Policy']
        assert "frame-ancestors 'none'" in headers['Content-Security-Policy']
    for path in ['/mail_setup_web.py', '/../gmail-oauth.json', '/?token=leak', '/api/info?token=leak']:
        assert request('GET', path)[0] == 404
    assert calls == []


@pytest.mark.parametrize('headers', [
    {'Host': 'localhost:1234'}, {'Host': 'evil.example'}, {'Origin': 'https://erase-me-preview.vercel.app'},
    {'Origin': 'null'}, {'Origin': 'http://127.0.0.1:1'}, {'X-Erase-Setup': ''},
    {'X-Erase-Setup': 'b' * 43}, {'X-Erase-Setup': '\x80' * 43},
])
def test_origin_host_and_session_boundaries_prevent_side_effects(local, headers):
    _session, _server, calls, request, config, _assets = local
    code, _headers, data = request(headers=headers)
    assert code == 403 and data['code'] == 'forbidden'
    assert calls == [] and not config.parent.exists()


def test_missing_post_origin_duplicate_host_and_preflight_are_refused(local):
    session, server, calls, request, _config, _assets = local
    connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=5)
    raw = json.dumps(payload()).encode()
    connection.putrequest('POST', '/api/connect')
    connection.putheader('Host', session.origin.removeprefix('http://'))
    connection.putheader('X-Erase-Setup', session.token)
    connection.putheader('Content-Type', 'application/json')
    connection.putheader('Content-Length', str(len(raw)))
    connection.endheaders(raw)
    response = connection.getresponse()
    assert response.status == 403
    response.read()
    connection.close()
    assert request('OPTIONS')[0] == 405 and calls == []


@pytest.mark.parametrize('changes', [
    {'personal_email': 'bad'}, {'mailbox': 'personalfixture+remove@googlemail.com'},
    {'mailbox': 'other@example.test'}, {'removal_only': False}, {'removal_only': 1},
    {'browser': 'edge'}, {'extension_id': 'q' * 32}, {'extension_id': 'a' * 32 + ';cmd'},
    {'replace_registration': 1}, {'reconnect': 'yes'}, {'password': 'never-accept'},
    {'client_json': {'installed': {}}}, {'client_json': 'x' * (web.MAX_CLIENT + 1)},
])
def test_unapproved_invalid_or_personal_account_never_starts_setup(local, changes):
    _session, _server, calls, request, config, _assets = local
    code, _headers, data = request(body=payload(**changes))
    assert code == 400 and data['ok'] is False
    assert calls == [] and not config.parent.exists()


@pytest.mark.parametrize('raw', [b'{"personal_email":"x","personal_email":"y"}', b'{"x":NaN}', b'[]', b'not-json'])
def test_duplicate_or_non_json_request_is_not_accepted(local, raw):
    _session, _server, calls, request, _config, _assets = local
    assert request(body=raw)[0] == 400 and calls == []


def test_deep_json_is_rejected_without_handler_traceback_or_setup(local, capsys):
    _session, _server, calls, request, _config, _assets = local
    code, _headers, data = request(body=b'[' * 2000 + b'0' + b']' * 2000)
    assert code == 400 and data['code'] == 'invalid_request' and calls == []
    assert capsys.readouterr().err == ''


def test_body_limits_and_content_type_fail_before_read_or_setup(local):
    _session, _server, calls, request, _config, _assets = local
    assert request(body=b'{}', headers={'Content-Length': str(web.MAX_BODY + 1)})[0] == 400
    assert request(body=b'{}', headers={'Content-Type': 'text/plain'})[0] == 400
    assert request(body=b'{}', headers={'Transfer-Encoding': 'chunked'})[0] == 400
    assert calls == []


def test_uploaded_client_is_staged_privately_then_deleted_without_returning_secrets(local):
    session, _server, calls, request, config, _assets = local
    paths = []

    def runner(**kwargs):
        assert kwargs['prompt']('Primary email used in your Erase Me profile: ') == payload()['personal_email']
        assert kwargs['prompt']('Separate removal-only Gmail address: ') == payload()['mailbox']
        path = Path(kwargs['prompt']('Private Google Desktop client JSON path: '))
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        assert stat.S_IMODE(path.parent.stat().st_mode) == 0o700
        assert path.read_text() == CLIENT
        paths.append(path)
        return dict(RESULT)

    session.runner = runner
    code, _headers, data = request(body=payload(client_json=CLIENT))
    assert code == 200 and data['ok'] is True and data['result']['messages_read'] is False
    assert paths and all(not path.exists() for path in paths)
    assert list(config.parent.iterdir()) == [config.parent / setup.oauth.private.MARKER]
    for private in ['fixture-client-secret', payload()['personal_email'], payload()['mailbox'], session.token]:
        assert private not in json.dumps(data)
    assert calls == []


def test_upload_rejects_web_clients_arbitrary_endpoints_and_duplicate_keys(local):
    _session, _server, calls, request, config, _assets = local
    for source in [json.dumps({'web': {}}), CLIENT.replace(setup.oauth.TOKEN_URL, 'https://evil.example/token'),
                   '{"installed":{},"installed":{}}']:
        assert request(body=payload(client_json=source))[0] == 400
    assert calls == []
    assert not list(config.parent.glob('.setup-client-*'))


def test_reuse_needs_no_client_and_success_cannot_repeat_setup(local):
    _session, _server, calls, request, _config, _assets = local
    assert request()[0] == 200 and len(calls) == 1
    code, _headers, data = request()
    assert code == 409 and data['code'] == 'already_complete' and len(calls) == 1


def test_optional_send_permission_is_boolean_and_passed_only_after_explicit_opt_in(local):
    _session, _server, calls, request, _config, _assets = local
    assert request(body=payload(allow_sending=1))[0] == 400 and calls == []
    assert request(body=payload(allow_sending=True))[0] == 200
    assert calls[0]['allow_sending'] is True


def test_registration_update_requires_separate_checkbox(local):
    session, _server, _calls, request, _config, _assets = local

    def runner(**kwargs):
        assert kwargs['prompt']('Update the existing local connector registration for this companion? [y/N]: ') == 'yes'
        return dict(RESULT)

    session.runner = runner
    assert request()[2]['code'] == 'registration_approval_required'
    assert request(body=payload(replace_registration=True))[0] == 200


def test_closing_or_expiring_before_install_prevents_setup_or_installation(local):
    session, _server, calls, request, _config, _assets = local
    code, _headers, data = request(path='/api/close', body={})
    assert code == 200 and data['result'] == {'closed': True, 'installation_started': False}
    assert request()[0] == 410 and calls == []
    session.closed = False
    session.deadline = -1
    assert request('GET', '/api/info')[0] == 410 and calls == []


def test_concurrent_connect_is_refused_and_close_wins_before_install(local):
    session, _server, _calls, request, _config, _assets = local
    started, release = threading.Event(), threading.Event()
    installed = []
    responses = []

    def runner(**kwargs):
        started.set()
        assert release.wait(5)
        kwargs['ensure_active']('before_install')
        installed.append(True)
        return dict(RESULT)

    session.runner = runner
    worker = threading.Thread(target=lambda: responses.append(request()))
    worker.start()
    assert started.wait(5)
    assert request()[2]['code'] == 'busy'
    assert request(path='/api/close', body={})[2]['result']['installation_started'] is False
    release.set()
    worker.join(5)
    assert responses[0][0] == 410 and installed == []


def test_close_reports_when_installation_was_already_reserved(local):
    session, _server, _calls, request, _config, _assets = local
    started, release = threading.Event(), threading.Event()
    responses = []

    def runner(**kwargs):
        kwargs['ensure_active']('before_install')
        started.set()
        assert release.wait(5)
        kwargs['ensure_active']('complete')
        return dict(RESULT)

    session.runner = runner
    worker = threading.Thread(target=lambda: responses.append(request()))
    worker.start()
    assert started.wait(5)
    assert request(path='/api/close', body={})[2]['result']['installation_started'] is True
    release.set()
    worker.join(5)
    assert responses[0][0] == 200


def test_errors_and_bad_runner_results_never_disclose_private_provider_details(local, capsys):
    session, _server, _calls, request, _config, _assets = local

    def failed(**_kwargs):
        raise RuntimeError('PRIVATE_TOKEN_AND_EMAIL_NEVER_LOG_THIS')

    session.runner = failed
    code, _headers, data = request()
    assert code == 400 and data['code'] == 'setup_failed'
    assert 'PRIVATE_TOKEN' not in json.dumps(data) and 'PRIVATE_TOKEN' not in capsys.readouterr().err
    session.runner = lambda **_kwargs: {**RESULT, 'private_tokens': 'secret'}
    assert request()[2]['code'] == 'setup_failed'


def test_cli_help_and_launchers_do_not_read_state_or_start_services():
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run([sys.executable, '-I', '-B', str(root / 'tools/mail_setup_web.py'), '--help'],
                            capture_output=True, text=True, check=True)
    assert '--extension-id' in result.stdout and '--browser' in result.stdout
    for filename in ['setup-removal-mail.command', 'setup-removal-mail.sh']:
        path = root / 'tools' / filename
        subprocess.run(['/bin/sh', '-n', str(path)], check=True)
        assert os.access(path, os.X_OK)


def test_canceled_fresh_connection_never_saves_or_revokes_shared_google_consent(tmp_path, monkeypatch):
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    config = home / '.erase-me-removal-mail' / 'gmail-oauth.json'
    client = tmp_path / 'client.json'
    client.write_text(CLIENT)
    client.chmod(0o600)
    answers = iter([payload()['personal_email'], payload()['mailbox'], 'yes', str(client)])
    revoked, saved, installed = [], [], []
    monkeypatch.setattr(setup.oauth, 'connect', lambda *_args, **_kwargs: oauth_config())
    monkeypatch.setattr(setup.oauth, 'revoke', lambda tokens: revoked.append(tokens))
    monkeypatch.setattr(setup.oauth, 'save_config', lambda *_args, **_kwargs: saved.append(True))
    monkeypatch.setattr(setup.installer, 'install', lambda *_args, **_kwargs: installed.append(True))

    def guard(stage):
        if stage == 'after_oauth_identity':
            raise web.WebSetupError('session_closed')

    with pytest.raises(setup.SetupError):
        setup.run_setup(extension_id=EXTENSION, prompt=lambda _question: next(answers), emit=lambda _line: None,
                        home=home, config_path=config, platform='linux', ensure_active=guard)
    assert revoked == [] and saved == [] and installed == []


def test_guard_before_install_runs_after_reuse_but_prevents_registration(tmp_path, monkeypatch):
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    config = home / '.erase-me-removal-mail' / 'gmail-oauth.json'
    config.parent.mkdir(mode=0o700)
    config.write_text('fixture')
    config.chmod(0o600)
    saved = {'personal_email_sha256': setup.oauth.private.personal_digest(payload()['personal_email']),
             'mailbox': payload()['mailbox']}
    monkeypatch.setattr(setup.oauth, 'load_config', lambda _path: saved)
    monkeypatch.setattr(setup.oauth, 'check_token', lambda _path, **_kwargs: saved)
    installed, revoked = [], []
    monkeypatch.setattr(setup.installer, 'install', lambda *_args, **_kwargs: installed.append(True))
    monkeypatch.setattr(setup.oauth, 'revoke', lambda tokens: revoked.append(tokens))
    answers = iter([payload()['personal_email'], payload()['mailbox'], 'yes'])

    def guard(stage):
        if stage == 'before_install':
            raise web.WebSetupError('session_closed')

    with pytest.raises(setup.SetupError):
        setup.run_setup(extension_id=EXTENSION, prompt=lambda _question: next(answers), emit=lambda _line: None,
                        home=home, config_path=config, platform='linux', ensure_active=guard)
    assert installed == [] and revoked == []


@pytest.mark.parametrize('phase', ['during_save', 'after_identity', 'before_connection_activation'])
def test_canceled_oauth_stage_preserves_concurrent_legacy_file_and_shared_consent(tmp_path, monkeypatch, phase):
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    config = home / '.erase-me-removal-mail' / 'gmail-oauth.json'
    client = tmp_path / 'client.json'
    client.write_text(CLIENT)
    client.chmod(0o600)
    answers = iter([payload()['personal_email'], payload()['mailbox'], 'yes', str(client)])
    revoked, saved, installed = [], [], []
    state = {'closed': False}
    monkeypatch.setattr(setup.oauth, 'connect', lambda *_args, **_kwargs: oauth_config())
    monkeypatch.setattr(setup.oauth, 'revoke', lambda tokens: revoked.append(tokens))
    monkeypatch.setattr(setup.installer, 'install', lambda *_args, **_kwargs: installed.append(True))
    monkeypatch.setattr(setup.installer, 'check', lambda _spec: {'installed': True})
    real_stage = setup.app_mail.stage_config

    def replace_legacy():
        config.write_text('independently-replaced-private-config')
        config.chmod(0o600)

    def stage(directory, data):
        path = real_stage(directory, data)
        saved.append(True)
        if phase == 'during_save':
            replace_legacy()
            state['closed'] = True
        return path

    monkeypatch.setattr(setup.app_mail, 'stage_config', stage)

    def guard(stage):
        if phase == 'after_identity' and stage == 'after_identity':
            replace_legacy()
            state['closed'] = True
            return
        if phase == 'before_connection_activation' and stage == phase:
            replace_legacy()
            state['closed'] = True
        if state['closed']:
            raise web.WebSetupError('session_closed')

    with pytest.raises((setup.SetupError, setup.app_mail.AppMailError)):
        setup.run_setup(extension_id=EXTENSION, prompt=lambda _question: next(answers), emit=lambda _line: None,
                        home=home, config_path=config, platform='linux', ensure_active=guard)
    assert saved == ([] if phase == 'after_identity' else [True]) and installed == []
    assert revoked == [] and setup.app_mail.selection(config.parent) is None
    assert not list(config.parent.glob('gmail-oauth-*.json'))
    assert config.read_text() == 'independently-replaced-private-config'


def test_close_after_installation_still_prevents_later_connection_activation(tmp_path, monkeypatch):
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    config = home / '.erase-me-removal-mail' / 'gmail-oauth.json'
    client = tmp_path / 'client.json'
    client.write_text(CLIENT)
    client.chmod(0o600)
    answers = iter([payload()['personal_email'], payload()['mailbox'], 'yes', str(client)])
    installed, revoked = [], []
    monkeypatch.setattr(setup.oauth, 'connect', lambda *_args, **_kwargs: oauth_config())
    monkeypatch.setattr(setup.oauth, 'revoke', lambda tokens: revoked.append(tokens))
    monkeypatch.setattr(setup.installer, 'check', lambda _spec: {'installed': bool(installed)})
    monkeypatch.setattr(setup.installer, 'install', lambda *_args, **_kwargs: installed.append(True))

    def guard(stage):
        if stage == 'before_provider_selection':
            raise web.WebSetupError('session_closed')

    with pytest.raises(setup.SetupError):
        setup.run_setup(extension_id=EXTENSION, prompt=lambda _question: next(answers), emit=lambda _line: None,
                        home=home, config_path=config, platform='linux', ensure_active=guard)
    assert installed == [True] and revoked == []
    assert setup.app_mail.selection(config.parent) is None and not config.exists()
