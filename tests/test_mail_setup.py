"""Guided setup uses isolated files, synthetic accounts and fake Google only."""
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

import pytest

import connect_removal_gmail as oauth
import install_mail_host as installer
import setup_removal_mail as setup
import gmail_app_mail as connections


PERSONAL = 'personal.fixture@gmail.com'
MAILBOX = 'removal.fixture@gmail.com'
EXTENSION = 'a' * 32
CLIENT = {'client_id': 'fixture.apps.googleusercontent.com', 'client_secret': 'fixture-client-secret'}


class Receiver:
    def __init__(self, state, timeout):
        self.redirect_uri = 'http://127.0.0.1:54321/oauth/callback'

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def wait(self):
        return 'fixture-callback-code'


class Google:
    def __init__(self):
        self.calls = []
        self.email = MAILBOX
        self.fail = False

    def __call__(self, url, **kwargs):
        self.calls.append(url)
        if self.fail:
            raise oauth.OAuthError('fixture-private-provider-details')
        if url == oauth.TOKEN_URL:
            return {'access_token': 'fixture-access-token', 'refresh_token': 'fixture-refresh-token',
                    'expires_in': 3600, 'token_type': 'Bearer', 'scope': ' '.join(sorted(oauth.SCOPES))}
        if url == oauth.IDENTITY_URL:
            return {'email': self.email, 'email_verified': True, 'sub': 'fixture-google-sub'}
        if url == oauth.REVOKE_URL:
            return {}
        pytest.fail('Setup must never read Gmail messages or contact a broker')


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    home = tmp_path / 'isolated-user'
    home.mkdir(mode=0o700)
    path = home / '.erase-me-removal-mail' / oauth.TOKEN_FILE
    client = tmp_path / 'client with spaces.json'
    client.write_text(json.dumps({'installed': {**CLIENT, 'auth_uri': oauth.AUTH_URL, 'token_uri': oauth.TOKEN_URL}}))
    client.chmod(0o600)
    google = Google()
    opened = []
    real_connect, real_check = oauth.connect, oauth.check_token
    monkeypatch.setattr(oauth, 'connect', lambda mailbox, personal, data, **kwargs: real_connect(
        mailbox, personal, data, opener=lambda url: opened.append(url) or True,
        receiver_factory=Receiver, request=google, **kwargs))
    monkeypatch.setattr(oauth, 'check_token', lambda p, **kwargs: real_check(p, request=google, **kwargs))
    monkeypatch.setattr(oauth, 'revoke', lambda data, **kwargs: google(oauth.REVOKE_URL, form={'token': data['refresh_token']}))
    logs = []

    def run(answers=None, **kwargs):
        values = iter([PERSONAL, MAILBOX, 'yes', str(client)] if answers is None else answers)
        return setup.run_setup(extension_id=EXTENSION, prompt=lambda _: next(values), emit=logs.append,
                               home=home, config_path=path, platform='linux', **kwargs)

    return run, home, path, client, google, opened, logs


def active_path(path):
    return connections.oauth_config_path(path.parent, connections.selection(path.parent))


def test_single_command_connects_then_installs_without_mail_or_schedule(isolated):
    run, home, path, _client, google, opened, logs = isolated
    result = run()
    assert result == {'ok': True, 'installed': True, 'reused_connection': False,
                      'identity_checked': True, 'messages_read': False, 'scheduled_work': False}
    assert google.calls == [oauth.TOKEN_URL, oauth.IDENTITY_URL]
    assert len(opened) == 1 and opened[0].startswith(oauth.AUTH_URL + '?')
    assert installer.check(installer.plan(EXTENSION, home=home, platform='linux'))['installed']
    assert stat.S_IMODE(active_path(path).stat().st_mode) == 0o600
    assert stat.S_IMODE(path.parent.stat().st_mode) == 0o700
    text = '\n'.join(logs)
    assert 'No Gmail messages were read' in text
    assert all(value not in text for value in (PERSONAL, MAILBOX, CLIENT['client_secret'],
                                               'fixture-access-token', 'fixture-refresh-token', 'fixture-callback-code'))
    assert not list(home.rglob('*.plist')) and not list(home.rglob('*systemd*'))


def test_matching_connection_is_reused_with_identity_only_and_no_registration_rewrite(isolated):
    run, home, path, _client, google, opened, _logs = isolated
    run()
    spec = installer.plan(EXTENSION, home=home, platform='linux')
    before = Path(spec['manifest_path']).stat().st_mtime_ns
    google.calls.clear()
    result = run([PERSONAL, MAILBOX, 'yes'])
    assert result['reused_connection'] is True
    assert google.calls == [oauth.IDENTITY_URL] and len(opened) == 1
    assert Path(spec['manifest_path']).stat().st_mtime_ns == before
    assert oauth.load_config(active_path(path))['personal_email_sha256'] == oauth.private.personal_digest(PERSONAL)


def test_reuse_normalizes_primary_and_dedicated_gmail_alias_equivalence(isolated):
    run, _home, _path, _client, google, _opened, _logs = isolated
    run()
    google.calls.clear()
    result = run(['personalfixture+profile@googlemail.com', 'removalfixture@gmail.com', 'yes'])
    assert result['reused_connection'] is True
    assert google.calls == [oauth.IDENTITY_URL]


def test_saved_expired_token_is_refreshed_only_during_explicit_setup(isolated, monkeypatch):
    run, _home, path, _client, google, _opened, _logs = isolated
    run()
    saved = oauth.load_config(active_path(path))
    monkeypatch.setattr(oauth.time, 'time', lambda: saved['tokens']['expires_at'] + 1)
    google.calls.clear()
    assert run([PERSONAL, MAILBOX, 'yes'])['reused_connection'] is True
    assert google.calls == [oauth.TOKEN_URL, oauth.IDENTITY_URL]


@pytest.mark.parametrize('personal,mailbox,assertion', [
    (PERSONAL, PERSONAL, 'yes'),
    (PERSONAL, 'personalfixture+remove@googlemail.com', 'yes'),
    (PERSONAL, 'tagged+remove@gmail.com', 'yes'),
    (PERSONAL, 'removal@example.com', 'yes'),
    ('bad-email', MAILBOX, 'yes'),
    (PERSONAL, MAILBOX, 'no'),
    (PERSONAL, MAILBOX, ''),
])
def test_invalid_or_unaffirmed_account_never_connects_or_writes(isolated, personal, mailbox, assertion):
    run, home, _path, _client, google, opened, _logs = isolated
    with pytest.raises(setup.SetupError):
        run([personal, mailbox, assertion])
    assert google.calls == [] and opened == [] and list(home.iterdir()) == []


@pytest.mark.parametrize('extension', ['b' * 31, 'q' * 32, '../' + 'a' * 29, 'a' * 32 + '\n'])
def test_invalid_extension_is_refused_before_provider_or_file_mutation(isolated, extension):
    _run, home, path, _client, google, opened, _logs = isolated
    answers = iter([PERSONAL, MAILBOX, 'yes'])
    with pytest.raises(setup.SetupError):
        setup.run_setup(extension_id=extension, prompt=lambda _: next(answers), emit=lambda _: None,
                        home=home, config_path=path, platform='linux')
    assert google.calls == [] and opened == [] and list(home.iterdir()) == []


def test_prompted_extension_id_can_replace_command_flag(isolated):
    _run, home, path, client, _google, _opened, _logs = isolated
    answers = iter([PERSONAL, MAILBOX, 'yes', EXTENSION, str(client)])
    result = setup.run_setup(prompt=lambda _: next(answers), emit=lambda _: None,
                             home=home, config_path=path, platform='linux')
    assert result['installed'] is True


def test_unsupported_platform_precedes_google(isolated):
    _run, home, path, _client, google, opened, _logs = isolated
    answers = iter([PERSONAL, MAILBOX, 'yes'])
    with pytest.raises(setup.SetupError):
        setup.run_setup(extension_id=EXTENSION, prompt=lambda _: next(answers), emit=lambda _: None,
                        home=home, config_path=path, platform='win32')
    assert google.calls == [] and opened == [] and list(home.iterdir()) == []


@pytest.mark.parametrize('personal,mailbox', [('different@example.com', MAILBOX), (PERSONAL, 'other.fixture@gmail.com')])
def test_saved_binding_mismatch_does_not_overwrite_or_contact_google(isolated, personal, mailbox):
    run, _home, path, _client, google, opened, _logs = isolated
    run()
    before_path = active_path(path)
    before = before_path.read_bytes()
    google.calls.clear()
    with pytest.raises(setup.SetupError, match='different profile or mailbox'):
        run([personal, mailbox, 'yes'])
    assert google.calls == [] and len(opened) == 1 and before_path.read_bytes() == before


def test_check_only_never_creates_missing_connection_or_registration(isolated):
    run, home, _path, _client, google, opened, _logs = isolated
    with pytest.raises(setup.SetupError, match='No saved'):
        run([PERSONAL, MAILBOX, 'yes'], check_only=True)
    assert google.calls == [] and opened == [] and list(home.iterdir()) == []


def test_check_only_uses_existing_registration_without_install(isolated, monkeypatch):
    run, _home, _path, _client, google, _opened, _logs = isolated
    run()
    monkeypatch.setattr(installer, 'install', lambda *args, **kwargs: pytest.fail('Check cannot install'))
    google.calls.clear()
    assert run([PERSONAL, MAILBOX, 'yes'], check_only=True)['reused_connection'] is True
    assert google.calls == [oauth.IDENTITY_URL]


def test_explicit_reconnection_replaces_only_after_new_dedicated_identity(isolated):
    run, _home, path, client, google, opened, _logs = isolated
    run()
    google.email = 'other.fixture@gmail.com'
    result = run([PERSONAL, google.email, 'yes', str(client)], reconnect=True)
    assert result['reused_connection'] is False and len(opened) == 2
    assert oauth.load_config(active_path(path))['mailbox'] == google.email


def test_failed_reconnection_preserves_original_credentials(isolated):
    run, _home, path, client, google, _opened, _logs = isolated
    run()
    previous = active_path(path)
    before = previous.read_bytes()
    google.email = PERSONAL
    with pytest.raises(oauth.IdentityMismatch):
        run([PERSONAL, MAILBOX, 'yes', str(client)], reconnect=True)
    assert previous.read_bytes() == before and active_path(path) == previous
    assert oauth.REVOKE_URL not in google.calls


def test_failed_staging_does_not_activate_or_revoke_a_shared_google_grant(isolated, monkeypatch):
    run, _home, path, _client, google, _opened, logs = isolated
    monkeypatch.setattr(oauth, 'save_config', lambda *args, **kwargs: (_ for _ in ()).throw(oauth.OAuthError('fixture-save-failure')))
    with pytest.raises(oauth.OAuthError):
        run()
    assert google.calls == [oauth.TOKEN_URL, oauth.IDENTITY_URL]
    assert not path.exists() and connections.selection(path.parent) is None
    assert any('Google consent was not revoked' in line for line in logs)


def test_existing_other_extension_registration_requires_explicit_update(isolated):
    run, home, _path, _client, google, opened, _logs = isolated
    installer.install(installer.plan('b' * 32, home=home, platform='linux'))
    with pytest.raises(setup.SetupError):
        run([PERSONAL, MAILBOX, 'yes', 'no'])
    assert google.calls == [] and opened == []
    assert installer.check(installer.plan('b' * 32, home=home, platform='linux'))['installed']


def test_explicit_update_registration_is_single_command(isolated):
    run, home, _path, client, _google, _opened, _logs = isolated
    installer.install(installer.plan('b' * 32, home=home, platform='linux'))
    assert run([PERSONAL, MAILBOX, 'yes', 'yes', str(client)])['installed']
    assert installer.check(installer.plan(EXTENSION, home=home, platform='linux'))['installed']


def test_unsafe_existing_launcher_is_refused_before_google(isolated, tmp_path):
    run, home, _path, _client, google, opened, _logs = isolated
    directory = home / '.erase-me-mail-native'
    directory.mkdir(mode=0o700)
    (directory / 'run-chrome').symlink_to(tmp_path / 'absent-file')
    with pytest.raises(setup.SetupError, match='installation paths'):
        run([PERSONAL, MAILBOX, 'yes'])
    assert google.calls == [] and opened == []


def test_nonprivate_native_state_is_refused_before_google_without_traceback(isolated):
    run, home, _path, _client, google, opened, _logs = isolated
    installer.install(installer.plan(EXTENSION, home=home, platform='linux'))
    (home / '.erase-me-mail-native').chmod(0o755)
    with pytest.raises(setup.SetupError, match='private installation paths'):
        run([PERSONAL, MAILBOX, 'yes'])
    assert google.calls == [] and opened == []


def test_native_install_failure_gives_fixed_guidance_and_no_secret(isolated, monkeypatch):
    run, _home, _path, _client, google, _opened, _logs = isolated
    monkeypatch.setattr(installer, 'install', lambda *args, **kwargs: (_ for _ in ()).throw(
        installer.host.MailHostError('fixture-private-native-details')))
    with pytest.raises(setup.SetupError, match='local connector installation did not finish') as failure:
        run()
    assert 'fixture-private-native-details' not in str(failure.value)
    assert google.calls == [oauth.TOKEN_URL, oauth.IDENTITY_URL]


def test_saved_configuration_change_during_identity_check_prevents_install(isolated, monkeypatch):
    run, home, path, _client, _google, _opened, _logs = isolated
    run()
    installer.uninstall(installer.plan(EXTENSION, home=home, platform='linux'))
    data = oauth.load_config(active_path(path))
    data['personal_email_sha256'] = oauth.private.personal_digest('different@example.com')
    monkeypatch.setattr(oauth, 'check_token', lambda _, **kwargs: data)
    with pytest.raises(setup.SetupError, match='changed during'):
        run([PERSONAL, MAILBOX, 'yes'])
    assert not installer.check(installer.plan(EXTENSION, home=home, platform='linux'))['installed']


def test_selected_nonprivate_client_can_be_tightened_without_exposing_contents(isolated):
    run, _home, _path, client, _google, _opened, logs = isolated
    client.chmod(0o644)
    result = run([PERSONAL, MAILBOX, 'yes', '"' + str(client) + '"', 'yes'])
    assert result['installed'] is True
    assert stat.S_IMODE(client.stat().st_mode) == 0o600
    assert CLIENT['client_secret'] not in '\n'.join(logs)


def test_declined_client_permissions_never_connects(isolated):
    run, _home, _path, client, google, opened, _logs = isolated
    client.chmod(0o644)
    with pytest.raises(setup.SetupError):
        run([PERSONAL, MAILBOX, 'yes', str(client), 'no'])
    assert stat.S_IMODE(client.stat().st_mode) == 0o644
    assert google.calls == [] and opened == []


@pytest.mark.parametrize('link', ['symlink', 'hardlink'])
def test_client_links_are_refused_before_google(isolated, tmp_path, link):
    run, _home, _path, client, google, opened, _logs = isolated
    candidate = tmp_path / 'linked-client.json'
    if link == 'symlink':
        candidate.symlink_to(client)
    else:
        os.link(client, candidate)
    with pytest.raises((setup.SetupError, oauth.OAuthError)):
        run([PERSONAL, MAILBOX, 'yes', str(candidate)])
    assert google.calls == [] and opened == []


@pytest.mark.parametrize('value', ['bad\nanswer', 'x' * 1025, '', 'bad\x7fanswer'])
def test_prompt_rejects_controls_empty_or_unbounded_input(value):
    with pytest.raises(setup.SetupError):
        setup.answer(lambda _: value, 'Question: ')


def test_help_is_available_without_account_access_or_prompt():
    script = Path(setup.__file__)
    result = subprocess.run([sys.executable, '-B', str(script), '--help'],
                            capture_output=True, text=True, check=True)
    assert '--extension-id' in result.stdout and '--check' in result.stdout
    assert '--reconnect' in result.stdout and 'password' in result.stdout


def test_main_cancellation_and_provider_failure_do_not_print_private_details(monkeypatch, capsys):
    monkeypatch.setattr(setup, 'run_setup', lambda **kwargs: (_ for _ in ()).throw(oauth.OAuthError('fixture-private-provider-secret')))
    assert setup.main([]) == 1
    text = capsys.readouterr().out
    assert 'fixture-private-provider-secret' not in text and 'No provider response' in text
    monkeypatch.setattr(setup, 'run_setup', lambda **kwargs: (_ for _ in ()).throw(KeyboardInterrupt()))
    assert setup.main([]) == 1
    assert 'cancelled' in capsys.readouterr().out


def test_main_native_state_error_is_generic_without_traceback(monkeypatch, capsys):
    monkeypatch.setattr(setup, 'run_setup', lambda **kwargs: (_ for _ in ()).throw(
        installer.host.MailHostError('fixture-private-native-details')))
    assert setup.main([]) == 1
    captured = capsys.readouterr()
    assert 'Setup did not finish' in captured.out
    assert 'fixture-private-native-details' not in captured.out and captured.err == ''
