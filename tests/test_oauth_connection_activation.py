"""Atomic OAuth activation: synthetic private files, no provider or mailbox calls."""
from copy import deepcopy
import json

import pytest

import connect_removal_gmail as oauth
import gmail_app_mail as connections
import native_mail_host as native
import setup_removal_mail as setup


PRIMARY = 'primary.fixture@gmail.com'
MAILBOX = 'removal.fixture@gmail.com'
CLIENT = {'client_id': '123456-fixture.apps.googleusercontent.com', 'client_secret': 'fixture-client-secret'}
ORIGIN = 'chrome-extension://' + 'c' * 32 + '/'


def config(tag='old', mailbox=MAILBOX, sending=False):
    return {'version': 1, 'provider': 'gmail_oauth', 'mailbox': mailbox,
            'personal_email_sha256': oauth.private.personal_digest(PRIMARY), 'client': dict(CLIENT),
            'tokens': {'access_token': 'fixture-access-' + tag, 'refresh_token': 'fixture-refresh-' + tag,
                       'expires_at': 2000000000},
            'identity': {'email': mailbox, 'sub': 'fixture-sub-' + mailbox.split('@')[0], 'email_verified': True},
            'scopes': sorted(oauth.SEND_SCOPES if sending else oauth.SCOPES),
            'connected_at': '2026-11-05T00:00:00+00:00'}


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    directory = home / '.erase-me-removal-mail'
    legacy = directory / oauth.TOKEN_FILE
    old = config()
    oauth.save_config(legacy, old)
    connections.select_config(directory, old)
    state = native.state_directory(home, create=True)
    native._write_new(state / 'allowed-origin.json', json.dumps({'version': 1, 'origin': ORIGIN}))
    host = native.NativeMailHost(ORIGIN, home=home)
    client = tmp_path / 'client.json'
    client.write_text(json.dumps({'installed': {**CLIENT, 'auth_uri': oauth.AUTH_URL, 'token_uri': oauth.TOKEN_URL}}))
    client.chmod(0o600)
    calls, logs, revoked = [], [], []
    issued = [config('fresh', sending=True)]

    def connect(mailbox, primary, _client, **kwargs):
        assert primary == PRIMARY and kwargs.get('revoke_on_failure') is False
        calls.append('identity')
        value = deepcopy(issued[0])
        assert mailbox == value['mailbox']
        return value

    monkeypatch.setattr(oauth, 'connect', connect)
    monkeypatch.setattr(oauth, 'revoke', lambda value, **_kwargs: revoked.append(value))
    monkeypatch.setattr(setup.installer, 'check', lambda _spec: {'installed': True})

    def run(mailbox=MAILBOX, guard=None):
        answers = iter([PRIMARY, mailbox, 'yes', str(client)])
        return setup.run_setup(extension_id='c' * 32, reconnect=True, allow_sending=True,
            prompt=lambda _question: next(answers), emit=logs.append, home=home,
            config_path=legacy, platform='linux', ensure_active=guard)

    return home, directory, legacy, old, host, issued, run, calls, logs, revoked


@pytest.mark.parametrize('initial', ['legacy_selection', 'legacy_fallback', 'versioned_selection'])
@pytest.mark.parametrize('phase', ['after_oauth_identity', 'after_identity', 'before_provider_selection',
                                  'before_save', 'during_stage', 'before_connection_activation'])
def test_canceling_send_upgrade_preserves_old_scope_credentials_and_grant(isolated, monkeypatch, initial, phase):
    _home, directory, legacy, old, host, _issued, run, _calls, logs, revoked = isolated
    if initial == 'legacy_fallback':
        (directory / connections.SELECTION_FILE).unlink()
    elif initial == 'versioned_selection':
        path = connections.stage_config(directory, old)
        connections.select_config(directory, old, config_file=path.name)
    previous = host._load_connection()
    previous_selection = connections.connection_snapshot(directory)
    legacy_bytes = legacy.read_bytes()
    initial_versions = set(directory.glob('gmail-oauth-*.json'))
    canceled = False
    real_stage = connections.stage_config

    def stage(*args):
        nonlocal canceled
        path = real_stage(*args)
        if phase == 'during_stage':
            canceled = True
        return path

    def guard(name):
        # Reading the real native loader before activation must always see old
        # read-only scopes, including after the new credential has been staged.
        assert host._load_connection() == previous
        if canceled or name == phase:
            raise setup.SetupError('canceled fixture')

    monkeypatch.setattr(connections, 'stage_config', stage)
    with pytest.raises(setup.SetupError, match='canceled fixture'):
        run(guard=guard)
    assert host._load_connection() == previous
    assert connections.connection_snapshot(directory) == previous_selection
    assert legacy.read_bytes() == legacy_bytes
    assert set(directory.glob('gmail-oauth-*.json')) == initial_versions
    assert revoked == []
    assert any('Google consent was not revoked' in line for line in logs)


@pytest.mark.parametrize('winner_mailbox', [MAILBOX, 'other.removal@gmail.com'])
def test_concurrent_winner_is_not_overwritten_deleted_or_revoked(isolated, monkeypatch, winner_mailbox):
    _home, directory, legacy, _old, host, issued, run, _calls, _logs, revoked = isolated
    legacy_bytes = legacy.read_bytes()
    real_stage = connections.stage_config
    inside = False
    winner_path = []

    def stage(*args):
        nonlocal inside
        own_path = real_stage(*args)
        if not inside:
            inside = True
            previous = issued[0]
            issued[0] = config('winner', mailbox=winner_mailbox, sending=True)
            run(winner_mailbox)
            winner_path.append(connections.oauth_config_path(directory, connections.selection(directory)))
            issued[0] = previous
        return own_path

    monkeypatch.setattr(connections, 'stage_config', stage)
    with pytest.raises(connections.AppMailError) as failure:
        run()
    assert failure.value.code == 'connection_changed'
    assert legacy.read_bytes() == legacy_bytes
    assert connections.oauth_config_path(directory, connections.selection(directory)) == winner_path[0]
    assert oauth.load_config(winner_path[0]) == config('winner', mailbox=winner_mailbox, sending=True)
    assert host._load_connection() == oauth.load_config(winner_path[0])
    assert set(directory.glob('gmail-oauth-*.json')) == set(winner_path)
    assert revoked == []


@pytest.mark.parametrize('selected', [False, True])
def test_legacy_fixed_file_change_invalidates_the_selector_compare_and_swap(isolated, monkeypatch, selected):
    _home, directory, legacy, _old, host, _issued, run, _calls, _logs, revoked = isolated
    if not selected:
        (directory / connections.SELECTION_FILE).unlink()
    real_stage = connections.stage_config
    concurrent = config('standalone-update', sending=False)

    def stage(*args):
        path = real_stage(*args)
        # A standalone legacy writer uses the same private process lock. Its
        # content change matters even when the selector bytes stay identical.
        oauth.save_config(legacy, concurrent, replace=True)
        return path

    monkeypatch.setattr(connections, 'stage_config', stage)
    with pytest.raises(connections.AppMailError) as failure:
        run()
    assert failure.value.code == 'connection_changed'
    assert oauth.load_config(legacy) == concurrent and host._load_connection() == concurrent
    assert not list(directory.glob('gmail-oauth-*.json')) and revoked == []


def test_reusing_legacy_oauth_is_verified_in_memory_then_migrated_immutably(isolated, monkeypatch):
    home, directory, legacy, old, host, _issued, _run, _calls, _logs, revoked = isolated
    previous = legacy.read_bytes()
    checks = []

    def check(path, **kwargs):
        checks.append((path, kwargs))
        assert kwargs == {'persist': False, 'revoke_on_failure': False}
        value = oauth.load_config(path)
        value['tokens']['access_token'] = 'fixture-refreshed-access'
        return value

    monkeypatch.setattr(oauth, 'check_token', check)
    answers = iter([PRIMARY, MAILBOX, 'yes'])
    result = setup.run_setup(extension_id='c' * 32, prompt=lambda _question: next(answers), emit=lambda _line: None,
        home=home, config_path=legacy, platform='linux')
    assert result['reused_connection'] is True and len(checks) == 1
    path = connections.oauth_config_path(directory, connections.selection(directory))
    assert oauth.VERSIONED_TOKEN_FILE.fullmatch(path.name) and path.stat().st_mode & 0o777 == 0o600
    assert legacy.read_bytes() == previous and host._load_connection()['scopes'] == old['scopes']
    assert host._load_connection()['tokens']['access_token'] == 'fixture-refreshed-access'
    assert revoked == []


def test_oauth_versions_cannot_be_overwritten_or_selected_with_app_password_prefix(isolated):
    _home, directory, _legacy, old, _host, _issued, _run, _calls, _logs, _revoked = isolated
    path = connections.stage_config(directory, old)
    with pytest.raises(oauth.OAuthError):
        oauth.save_config(path, old, replace=True)
    for name in ('../gmail-oauth.json', 'gmail-app-password-' + 'a' * 32 + '.json', 'arbitrary.json'):
        with pytest.raises(connections.AppMailError):
            connections.select_config(directory, old, config_file=name)


def test_advanced_cli_checks_the_selected_version_and_cannot_replace_it_silently(isolated, monkeypatch, tmp_path, capsys):
    _home, directory, legacy, old, _host, _issued, _run, _calls, _logs, _revoked = isolated
    path = connections.stage_config(directory, old)
    connections.select_config(directory, old, config_file=path.name)
    checked = []
    monkeypatch.setattr(oauth, 'check_token', lambda token_path, **kwargs: checked.append((token_path, kwargs)))
    assert oauth.main(['--check-token', '--config', str(legacy)]) == 0
    assert checked == [(path, {'revoke_on_failure': False})]
    client = tmp_path / 'cli-client.json'
    client.write_text(json.dumps({'installed': {**CLIENT, 'auth_uri': oauth.AUTH_URL, 'token_uri': oauth.TOKEN_URL}}))
    client.chmod(0o600)
    monkeypatch.setattr(oauth, 'connect', lambda *_args, **_kwargs: pytest.fail('Versioned selection requires guided setup'))
    assert oauth.main(['--mailbox', MAILBOX, '--personal-email', PRIMARY, '--client-json', str(client),
                       '--config', str(legacy), '--replace']) == 1
    assert 'guided local setup' in capsys.readouterr().out
