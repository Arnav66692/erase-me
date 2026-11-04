"""Private service setup tests: no real provider, mailbox or service manager is used."""
from __future__ import annotations

import json
import os
from pathlib import Path
import plistlib
import stat
import sys

import pytest

import configure_service as configure
import install_service as install
import run_service as service


def settings(**updates):
    env = {
        'ERASE_SMTP_HOST': 'smtp.mail.example', 'ERASE_SMTP_PORT': '587',
        'ERASE_SMTP_FROM': 'sender@mail.example', 'ERASE_SMTP_USER': 'sender@mail.example',
        'ERASE_SMTP_PASSWORD': 'fake-smtp-secret', 'ERASE_SMTP_SSL': 'false',
        'ERASE_REMOVAL_INBOX': 'removals@mail.example', 'ERASE_IMAP_HOST': 'imap.mail.example',
        'ERASE_IMAP_PORT': '993', 'ERASE_IMAP_USER': 'removals@mail.example',
        'ERASE_IMAP_PASSWORD': 'fake-imap-secret', 'ERASE_IMAP_AUTHSERV_ID': 'mx.mail.example',
    }
    env.update(updates)
    return {'version': 1, 'port': 8766, 'environment': env}


@pytest.fixture
def config_file(tmp_path):
    path = tmp_path.resolve() / 'private-service/config.json'
    configure.save_config(path, settings())
    return path


def test_private_config_round_trip_and_explicit_replacement(config_file):
    assert configure.load_config(config_file) == settings()
    assert stat.S_IMODE(config_file.stat().st_mode) == 0o600
    assert stat.S_IMODE(config_file.parent.stat().st_mode) == 0o700
    assert stat.S_IMODE((config_file.parent / configure.MARKER).stat().st_mode) == 0o600
    with pytest.raises(ValueError, match='--replace'):
        configure.save_config(config_file, settings())
    updated = settings(ERASE_SMTP_PASSWORD='different-fake-secret')
    configure.save_config(config_file, updated, replace=True)
    assert configure.load_config(config_file) == updated
    assert not list(config_file.parent.glob('.config-*'))


@pytest.mark.parametrize('kind', ['file', 'directory', 'marker', 'parent'])
def test_symlinks_are_rejected(config_file, tmp_path, kind):
    if kind == 'file':
        destination = tmp_path / 'unrelated.json'
        config_file.rename(destination)
        config_file.symlink_to(destination)
    elif kind == 'marker':
        marker = config_file.parent / configure.MARKER
        marker.unlink()
        marker.symlink_to(config_file)
    elif kind == 'directory':
        alias = tmp_path / 'alias'
        alias.symlink_to(config_file.parent, target_is_directory=True)
        config_file = alias / 'config.json'
    else:
        alias = tmp_path / 'alias'
        alias.symlink_to(tmp_path, target_is_directory=True)
        config_file = alias / config_file.parent.name / 'config.json'
    with pytest.raises(ValueError):
        configure.load_config(config_file)
    with pytest.raises(ValueError):
        configure.save_config(config_file, settings(), replace=True)


def test_hard_linked_config_is_rejected(config_file, tmp_path):
    os.link(config_file, tmp_path / 'linked-config.json')
    with pytest.raises(ValueError, match='regular files'):
        configure.load_config(config_file)


@pytest.mark.parametrize('mode', [0o644, 0o660, 0o777])
def test_insecure_file_permissions_rejected(config_file, mode):
    config_file.chmod(mode)
    with pytest.raises(ValueError, match='private file'):
        configure.load_config(config_file)


def test_insecure_directory_permissions_rejected(config_file):
    config_file.parent.chmod(0o755)
    with pytest.raises(ValueError, match='private'):
        configure.load_config(config_file)


def test_nonempty_directory_is_not_adopted(tmp_path):
    unrelated = tmp_path / 'unrelated'
    unrelated.mkdir()
    (unrelated / 'important.txt').write_text('leave this alone')
    with pytest.raises(ValueError, match='unmarked'):
        configure.save_config(unrelated / 'config.json', settings())
    assert not (unrelated / configure.MARKER).exists()
    assert (unrelated / 'important.txt').read_text() == 'leave this alone'


def test_home_ancestor_and_repo_paths_rejected(monkeypatch, tmp_path):
    home = tmp_path / 'home'
    home.mkdir()
    monkeypatch.setattr(Path, 'home', classmethod(lambda cls: home))
    for directory in (home, tmp_path, Path('/'), configure.ROOT, configure.ROOT / 'service-test'):
        with pytest.raises(ValueError):
            configure.safe_directory(directory, create=True)


def test_bad_filename_has_no_side_effect(tmp_path):
    directory = tmp_path / 'never-created'
    with pytest.raises(ValueError, match='config.json'):
        configure.save_config(directory / 'passwords.txt', settings())
    assert not directory.exists()


def test_service_directory_refuses_newline_before_creation(tmp_path):
    directory = tmp_path / 'unsafe\nservice'
    with pytest.raises(ValueError, match='control characters'):
        configure.save_config(directory / 'config.json', settings())
    assert not directory.exists()


@pytest.mark.parametrize('key,value', [
    ('LD_PRELOAD', '/tmp/bad.so'), ('ERASE_SMTP_HOST', 'https://smtp.mail.example'),
    ('ERASE_SMTP_HOST', 'smtp.mail.example\r\nInjected: true'),
    ('ERASE_SMTP_HOST', 'smtp..mail.example'), ('ERASE_SMTP_PORT', '0'),
    ('ERASE_IMAP_PORT', '65536'), ('ERASE_SMTP_SSL', 'yes'),
    ('ERASE_SMTP_FROM', 'Sender <sender@mail.example>'),
    ('ERASE_REMOVAL_INBOX', 'remove+tag@mail.example'),
    ('ERASE_REMOVAL_INBOX', 'x' * 26 + '@mail.example'),
    ('ERASE_WEB_HOME', 'relative/path'), ('ERASE_SMTP_PASSWORD', 'secret\nnext-line'),
    ('ERASE_WEB_ORIGIN', 'http://public.example'),
    ('ERASE_WEB_ORIGIN', 'https://person:password@public.example'),
    ('ERASE_WEB_ORIGIN', 'https://public.example/path'),
    ('ERASE_WEB_ORIGIN', 'https://public.example:badport'),
])
def test_invalid_settings_do_not_echo_values(key, value):
    with pytest.raises(ValueError) as raised:
        configure.validate_config(settings(**{key: value}))
    assert value not in str(raised.value)


@pytest.mark.parametrize('key,value', [('version', True), ('version', 2), ('port', True), ('port', 80), ('port', 65536)])
def test_invalid_structure(key, value):
    config = settings()
    config[key] = value
    with pytest.raises(ValueError):
        configure.validate_config(config)


def test_prompt_keeps_secrets_hidden_and_can_keep_existing(capsys):
    prompts = []
    secret_prompts = []
    def ask(prompt):
        prompts.append(prompt)
        return ''
    def secret(prompt):
        secret_prompts.append(prompt)
        return ''
    result = configure.prompt_config(settings(), ask=ask, secret=secret)
    assert result == settings()
    assert len(secret_prompts) == 2
    display = capsys.readouterr().out + ''.join(prompts + secret_prompts)
    assert 'fake-smtp-secret' not in display
    assert 'fake-imap-secret' not in display


def test_configure_cli_refuses_piped_credentials(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(sys, 'argv', ['configure_service.py', '--config', str(tmp_path / 'private/config.json')])
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: False)
    monkeypatch.setattr(configure, 'prompt_config', lambda *a: pytest.fail('credential prompt opened'))
    assert configure.main() == 1
    assert 'interactive terminal' in capsys.readouterr().out
    assert not (tmp_path / 'private').exists()


def test_environment_ignores_stale_mode_and_adapter(monkeypatch):
    monkeypatch.setenv('ERASE_WEB_DEMO', '1')
    monkeypatch.setenv('ERASE_ME_ADAPTER', '/old/adapter')
    env = service.service_environment(settings())
    assert 'ERASE_WEB_DEMO' not in env
    assert 'ERASE_ME_ADAPTER' not in env
    assert env['ERASE_SMTP_PASSWORD'] == 'fake-smtp-secret'
    assert env['PYTHONPATH'] == str(configure.ROOT)
    assert service.command(settings())[-4:] == ['--host', '127.0.0.1', '--port', '8766']


def runnable_settings(tmp_path, monkeypatch):
    # A complete synthetic route is used only inside this test's isolated catalog.
    # No test attributes fabricated live evidence to a real broker.
    root = tmp_path / 'fixture-project'
    catalog = root / 'skills/erase-me/references/countries/zz'
    catalog.mkdir(parents=True)
    (catalog / 'fixture-broker.json').write_text(json.dumps({
        'id': 'fixture-broker', 'domain': 'broker.example',
        'search': {'method': 'url_template', 'url_template': 'https://broker.example/search?name={full}'},
        'optout': {'method': 'web_form', 'url': 'https://broker.example/remove',
                   'fields_needed': ['full_name', 'email', 'listing_url'], 'requires': ['email_verification']},
    }))
    monkeypatch.setattr(service, 'ROOT', root)
    adapter = tmp_path / 'adapter'
    adapter.write_text('#!/bin/sh\nexit 1\n')
    adapter.chmod(0o700)
    recipes = tmp_path / 'recipes.json'
    recipes.write_text(json.dumps({'fixture-broker': {
        'domain': 'broker.example', 'enabled': True,
        'optout_url': 'https://broker.example/remove',
        'supported_actions': ['scan', 'submit', 'confirm', 'check'],
        'listing_links': '.listing-link', 'name': '.record-name', 'age': '.record-age',
        'city': '.record-city', 'absent': '.removed-record',
        'fields': {'full_name': '#full-name', 'email': '#email', 'listing_url': '#listing-url'},
        'submit': '#submit-removal', 'success': '.submitted',
        'confirmation_path_prefix': '/confirm/removal', 'confirmation_success': '.confirmed',
        'verification': {'inspected': True, 'live_submitted': True, 'removal_verified': True},
    }}))
    monkeypatch.setattr(service.shutil, 'which', lambda *args, **kwargs: '/fake/bun')
    return settings(ERASE_ME_ADAPTER=str(adapter), ERASE_BROWSE_BIN=str(adapter),
                    ERASE_BROWSER_RECIPES=str(recipes))


def test_readiness_inspects_without_running_binaries(tmp_path, monkeypatch):
    config = runnable_settings(tmp_path, monkeypatch)
    checks = service.readiness(config)
    assert service.can_start(checks)
    assert 'fake-smtp-secret' not in str(checks)
    Path(config['environment']['ERASE_BROWSER_RECIPES']).write_text('{}')
    assert not next(check for check in service.readiness(config) if check['name'] == 'live_removals_ready')['ready']


@pytest.mark.parametrize('change', [
    {'enabled': False}, {'supported_actions': []},
    {'supported_actions': ['scan', 'submit', 'check']},
    {'verification': {'inspected': True, 'live_submitted': True, 'removal_verified': False}},
    {'domain': 'wrong.example'},
    {'optout_url': 'https://broker.example/wrong'},
    {'supported_actions': ['scan', 'submit', 'confirm', 'check', 'unknown']},
    {'fields': {}}, {'fields': {'full_name': '#name'}},
    {'fields': {'first_name': '#first', 'last_name': '#last', 'email': '#email'}},
    {'fields': {'full_name': '#same', 'email': '#same', 'listing_url': '#listing'}},
    {'controls': [{'control': 'checkbox', 'selector': '#agreement', 'checked': 'true'}]},
    {'controls': [{'control': 'fill', 'selector': '#first-name', 'value': 'Invented'}]},
    {'confirmation_path_prefix': '/'}, {'confirmation_path_prefix': '//evil.example/confirm'},
    {'confirmation_path_prefix': '/confirm?redirect=other'},
    {'confirmation_path_prefix': '/confirm/../account'},
])
def test_inspection_or_partial_route_does_not_claim_live_readiness(tmp_path, monkeypatch, change):
    config = runnable_settings(tmp_path, monkeypatch)
    path = Path(config['environment']['ERASE_BROWSER_RECIPES'])
    recipes = json.loads(path.read_text())
    recipes['fixture-broker'].update(change)
    path.write_text(json.dumps(recipes))
    check = service.broker_readiness(path)
    assert check['ready'] is False
    assert '0 complete live-tested routes' in check['detail']


@pytest.mark.parametrize('key', ['listing_links', 'name', 'age', 'city', 'absent',
                                'fields', 'submit', 'success',
                                'confirmation_path_prefix', 'confirmation_success'])
def test_missing_recipe_contract_field_never_counts_as_ready(tmp_path, monkeypatch, key):
    config = runnable_settings(tmp_path, monkeypatch)
    path = Path(config['environment']['ERASE_BROWSER_RECIPES'])
    recipes = json.loads(path.read_text())
    del recipes['fixture-broker'][key]
    path.write_text(json.dumps(recipes))
    assert service.broker_readiness(path)['ready'] is False


@pytest.mark.parametrize('key', ['listing_links', 'name', 'age', 'city', 'absent', 'submit', 'success', 'confirmation_success'])
@pytest.mark.parametrize('bad_selector', [None, {}, '', '   ', '#unsafe\nnext'])
def test_malformed_selectors_are_not_ready(tmp_path, monkeypatch, key, bad_selector):
    config = runnable_settings(tmp_path, monkeypatch)
    path = Path(config['environment']['ERASE_BROWSER_RECIPES'])
    recipes = json.loads(path.read_text())
    recipes['fixture-broker'][key] = bad_selector
    path.write_text(json.dumps(recipes))
    assert service.broker_readiness(path)['ready'] is False


def test_valid_email_identity_route_does_not_require_age_city(tmp_path, monkeypatch):
    config = runnable_settings(tmp_path, monkeypatch)
    path = Path(config['environment']['ERASE_BROWSER_RECIPES'])
    recipes = json.loads(path.read_text())
    recipe = recipes['fixture-broker']
    del recipe['age']
    del recipe['city']
    recipe['email'] = '.record-email'
    path.write_text(json.dumps(recipes))
    assert service.broker_readiness(path)['ready'] is True


@pytest.mark.parametrize('change', [
    {'url': 'http://broker.example/remove'},
    {'fields_needed': ['first_name', 'last_name', 'email']},
    {'fields_needed': ['full_name', 'email', 'listing_url', 'phone']},
    {'fields_needed': ['full_name', 'full_name', 'email']},
    {'fields_needed': None}, {'requires': 42}, {'requires': ['id_upload']},
    {'requires': ['phone_verification']}, {'method': 'email'},
])
def test_catalog_route_worker_cannot_fulfill_is_not_ready(tmp_path, monkeypatch, change):
    config = runnable_settings(tmp_path, monkeypatch)
    catalog = service.ROOT / 'skills/erase-me/references/countries/zz/fixture-broker.json'
    site = json.loads(catalog.read_text())
    site['optout'].update(change)
    catalog.write_text(json.dumps(site))
    assert service.broker_readiness(Path(config['environment']['ERASE_BROWSER_RECIPES']))['ready'] is False


@pytest.mark.parametrize('search', [{}, {'url_template': 'https://other.example/search?name={full}'},
                                  {'url_template': 'https://broker.example/search?phone={phone}'}])
def test_unusable_search_cannot_be_called_ready(tmp_path, monkeypatch, search):
    config = runnable_settings(tmp_path, monkeypatch)
    catalog = service.ROOT / 'skills/erase-me/references/countries/zz/fixture-broker.json'
    site = json.loads(catalog.read_text())
    site['search'] = search
    catalog.write_text(json.dumps(site))
    assert service.broker_readiness(Path(config['environment']['ERASE_BROWSER_RECIPES']))['ready'] is False


def test_doctor_field_contract_matches_real_worker_payload(monkeypatch):
    from contextlib import contextmanager
    from webapp import automation
    class FakeDB:
        def execute(self, *args):
            return self
        def fetchone(self):
            return {'url': 'https://broker.example/listing/fixture'}
    @contextmanager
    def connect():
        yield FakeDB()
    monkeypatch.setattr(automation.store, 'connect', connect)
    worker = object.__new__(automation.Worker)
    worker.demo = True
    user = {'id': 'fixture', 'name': 'Fixture Person', 'email': 'fixture@example.invalid',
            'age': 30, 'city': 'Fixture City', 'region': 'US-CA', 'country': 'US'}
    site = {'id': 'fixture-broker', 'fields_needed': [*service.WORKER_FIELD_EXAMPLES, 'first_name', 'last_name', 'phone']}
    job = {'phase': 'submit', 'request_id': '0' * 32, 'submitted_at': None, 'confirmation_ref': None}
    payload = worker._payload(user, site, job)
    assert payload['fields'] == service.WORKER_FIELD_EXAMPLES


def test_gmail_defaults_are_offered_without_saving_credentials(capsys):
    prompts = []
    def ask(prompt):
        prompts.append(prompt)
        if prompt.startswith('Sending email address'):
            return 'sender@gmail.com'
        if prompt.startswith('Dedicated removal inbox'):
            return 'removaltest@gmail.com'
        return ''
    config = configure.prompt_config(ask=ask, secret=lambda prompt: 'fake-token')
    env = config['environment']
    assert env['ERASE_SMTP_HOST'] == 'smtp.gmail.com'
    assert env['ERASE_SMTP_PORT'] == '465'
    assert env['ERASE_SMTP_SSL'] == 'true'
    assert env['ERASE_IMAP_HOST'] == 'imap.gmail.com'
    assert env['ERASE_IMAP_USER'] == 'removaltest@gmail.com'
    assert env['ERASE_IMAP_AUTHSERV_ID'] == 'mx.google.com'
    assert 'fake-token' not in capsys.readouterr().out + ''.join(prompts)


def test_single_user_gmail_prompts_once_and_uses_same_mailbox(capsys):
    prompts = []
    def secret(prompt):
        prompts.append(prompt)
        return 'test-only-app-password'
    config = configure.prompt_gmail('pilot@gmail.com', secret=secret)
    env = config['environment']
    assert len(prompts) == 1
    assert env['ERASE_SMTP_PASSWORD'] == env['ERASE_IMAP_PASSWORD'] == 'test-only-app-password'
    assert env['ERASE_SMTP_FROM'] == env['ERASE_REMOVAL_INBOX'] == 'pilot@gmail.com'
    assert env['ERASE_SMTP_USER'] == env['ERASE_IMAP_USER'] == 'pilot@gmail.com'
    assert env['ERASE_SMTP_SSL'] == 'true'
    assert env['ERASE_IMAP_AUTHSERV_ID'] == 'mx.google.com'
    assert 'test-only-app-password' not in capsys.readouterr().out + ''.join(prompts)


def test_single_user_gmail_replace_preserves_existing_port_paths_and_secrets():
    initial = configure.prompt_gmail('pilot@gmail.com', secret=lambda prompt: 'test-app-password')
    initial['port'] = 8900
    initial['environment']['ERASE_BROWSE_BIN'] = '/custom/browse'
    updated = configure.prompt_gmail('pilot@gmail.com', initial, secret=lambda prompt: '')
    assert updated == initial


def test_single_user_gmail_new_address_requires_new_credential():
    initial = configure.prompt_gmail('pilot@gmail.com', secret=lambda prompt: 'test-app-password')
    with pytest.raises(ValueError, match='required for a new Gmail connection'):
        configure.prompt_gmail('another@gmail.com', initial, secret=lambda prompt: '')


@pytest.mark.parametrize('email', ['person@mail.example', 'Name <pilot@gmail.com>', 'pilot+tag@gmail.com', 'x' * 26 + '@gmail.com'])
def test_single_user_gmail_invalid_mailbox_does_not_prompt(email):
    with pytest.raises(ValueError):
        configure.prompt_gmail(email, secret=lambda prompt: pytest.fail('Invalid email reached password prompt'))


def test_check_cli_never_launches_server_or_connects(config_file, monkeypatch, capsys):
    monkeypatch.setattr(sys, 'argv', ['run_service.py', '--config', str(config_file), '--check'])
    monkeypatch.setattr(service, 'check_connections', lambda *a, **kw: pytest.fail('network'))
    monkeypatch.setattr(service.subprocess, 'call', lambda *a, **kw: pytest.fail('server started'))
    assert service.main() == 1  # Intentionally incomplete runtime configuration.
    assert 'NEEDS SETUP' in capsys.readouterr().out


def test_json_check_with_missing_config_is_structured(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(sys, 'argv', ['run_service.py', '--config', str(tmp_path / 'missing/config.json'), '--json'])
    assert service.main() == 1
    result = json.loads(capsys.readouterr().out)
    assert result['ready'] is False
    assert result['live_removals_ready'] is False
    assert result['checks'][0]['name'] == 'configuration'


@pytest.fixture
def mail_clients(monkeypatch):
    state = {'sent': [], 'tls': 0, 'imap_readonly': None, 'logout': False}
    class SMTP:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False
        def ehlo(self):
            pass
        def starttls(self, **kwargs):
            state['tls'] += 1
            assert kwargs['context'].check_hostname
        def login(self, user, password):
            assert password == 'fake-smtp-secret'
        def send_message(self, message):
            state['sent'].append(message)
    class IMAP:
        def __init__(self, *args, **kwargs):
            assert kwargs['ssl_context'].check_hostname
        def login(self, user, password):
            assert password == 'fake-imap-secret'
        def select(self, folder, readonly):
            state['imap_readonly'] = readonly
            return 'OK', []
        def logout(self):
            state['logout'] = True
    monkeypatch.setattr(service.smtplib, 'SMTP', SMTP)
    monkeypatch.setattr(service.smtplib, 'SMTP_SSL', SMTP)
    monkeypatch.setattr(service.imaplib, 'IMAP4_SSL', IMAP)
    return state


def test_connection_checks_send_nothing_and_use_tls_readonly(mail_clients):
    assert all(item['ready'] for item in service.check_connections(settings()))
    assert mail_clients == {'sent': [], 'tls': 1, 'imap_readonly': True, 'logout': True}


def test_explicit_test_sends_one_tagged_message(mail_clients):
    checks = service.check_connections(settings(), send_test=True)
    assert all(item['ready'] for item in checks)
    assert len(mail_clients['sent']) == 1
    message = mail_clients['sent'][0]
    assert message['To'].startswith('removals+erase-')
    assert message['To'].endswith('@mail.example')
    assert 'fake-smtp-secret' not in message.as_string()


def test_implicit_smtp_tls_does_not_try_starttls(mail_clients):
    assert all(item['ready'] for item in service.check_connections(settings(ERASE_SMTP_SSL='true', ERASE_SMTP_PORT='465')))
    assert mail_clients['tls'] == 0


def test_provider_errors_do_not_expose_secrets(mail_clients, monkeypatch):
    def fail(*args, **kwargs):
        raise OSError('provider response includes fake-smtp-secret and fake-imap-secret')
    monkeypatch.setattr(service.smtplib, 'SMTP', fail)
    monkeypatch.setattr(service.imaplib, 'IMAP4_SSL', fail)
    checks = service.check_connections(settings())
    assert all(not item['ready'] for item in checks)
    assert 'fake-smtp-secret' not in str(checks)
    assert 'fake-imap-secret' not in str(checks)


def test_manifests_reference_private_config_only(config_file):
    name, content = install.manifest(config_file, 'Darwin')
    plist = plistlib.loads(content)
    assert name == 'org.erase-me.worker.plist'
    assert plist['ProgramArguments'][-2:] == ['--config', str(config_file)]
    assert 'EnvironmentVariables' not in plist
    name, systemd = install.manifest(config_file, 'Linux')
    assert name == 'org.erase-me.worker.service'
    assert 'ExecStart=' in systemd.decode()
    assert 'fake-smtp-secret' not in content.decode() + systemd.decode()


def test_systemd_paths_escape_percent_quotes_dollars_and_spaces(monkeypatch):
    monkeypatch.setattr(install, 'arguments', lambda path: ['/some path/100%/python', '/a"quoted"path', '/literal/$HOME'])
    _, data = install.manifest(Path('/unused'), 'Linux')
    assert '"/some path/100%%/python"' in data.decode()
    assert '"/a\\"quoted\\"path"' in data.decode()
    assert '"/literal/$$HOME"' in data.decode()


def test_systemd_rejects_newlines_in_command_paths():
    with pytest.raises(ValueError, match='control characters'):
        install.manifest(Path('/unsafe\nExecStart=/fake/config.json'), 'Linux')


def test_default_manifest_generation_does_not_install_or_start(config_file, monkeypatch, capsys):
    monkeypatch.setattr(sys, 'argv', ['install_service.py', '--config', str(config_file), '--platform', 'Darwin'])
    monkeypatch.setattr(install, 'install_directory', lambda *a: pytest.fail('service installed'))
    monkeypatch.setattr(install.subprocess, 'run', lambda *a, **kw: pytest.fail('service command ran'))
    assert install.main() == 0
    target = config_file.parent / 'org.erase-me.worker.plist'
    assert target.is_file()
    assert stat.S_IMODE(target.stat().st_mode) == 0o600
    assert 'Nothing installed or started' in capsys.readouterr().out


def test_start_requires_install(config_file, monkeypatch, capsys):
    monkeypatch.setattr(sys, 'argv', ['install_service.py', '--config', str(config_file), '--start'])
    assert install.main() == 1
    assert '--start requires --install' in capsys.readouterr().out
    assert list(config_file.parent.glob('*.plist')) == []


def test_linux_install_and_start_are_only_explicit(config_file, monkeypatch, tmp_path):
    destination = tmp_path / 'fake-systemd'
    destination.mkdir()
    calls = []
    monkeypatch.setattr(install.platform, 'system', lambda: 'Linux')
    monkeypatch.setattr(install, 'install_directory', lambda *a: destination)
    monkeypatch.setattr(install, 'readiness', lambda config: [])
    monkeypatch.setattr(install, 'can_start', lambda checks: True)
    monkeypatch.setattr(install.subprocess, 'run', lambda args, **kwargs: calls.append(args))
    monkeypatch.setattr(sys, 'argv', ['install_service.py', '--config', str(config_file), '--install'])
    assert install.main() == 0
    assert calls == [['systemctl', '--user', 'daemon-reload'],
                     ['systemctl', '--user', 'enable', 'org.erase-me.worker.service']]
    calls.clear()
    monkeypatch.setattr(sys, 'argv', ['install_service.py', '--config', str(config_file), '--install', '--start', '--replace'])
    assert install.main() == 0
    assert calls[-1] == ['systemctl', '--user', 'start', 'org.erase-me.worker.service']


def test_manifest_write_refuses_symlink(tmp_path):
    target = tmp_path / 'target'
    target.write_text('unchanged')
    link = tmp_path / 'link'
    link.symlink_to(target)
    with pytest.raises(ValueError):
        install.write_private(link, b'replacement', replace=True)
    assert target.read_text() == 'unchanged'


def test_configured_mailbox_does_not_enable_disabled_email_routes(tmp_path):
    config = settings(ERASE_SMTP_FROM='pilot@gmail.com', ERASE_REMOVAL_INBOX='pilot@gmail.com')
    checks = service.readiness(config)
    flags = {check['name']: check['ready'] for check in checks}
    assert flags['email_requests_ready'] is False
    assert flags['live_removals_ready'] is False
    assert flags['erase_me_adapter'] is False
    assert service.can_start(checks) is False
    assert '--manual' in service.command(config)


def test_mismatched_inbox_does_not_enable_email_only_service():
    checks = service.readiness(settings())
    assert not next(c['ready'] for c in checks if c['name'] == 'email_requests_ready')
    assert service.can_start(checks) is False


def test_email_only_requires_mail_settings_and_respects_connection_failures():
    config = settings(ERASE_SMTP_FROM='pilot@gmail.com', ERASE_REMOVAL_INBOX='pilot@gmail.com')
    checks = service.readiness(config)
    assert not service.can_start(checks + [{'name': 'imap_connection', 'ready': False}])
    config['environment'].pop('ERASE_SMTP_PASSWORD')
    assert not service.can_start(service.readiness(config))


def test_email_only_json_truthfully_distinguishes_request_and_removal_capability(tmp_path, monkeypatch, capsys):
    path = tmp_path.resolve() / 'own-mail/config.json'
    configure.save_config(path, settings(ERASE_SMTP_FROM='pilot@gmail.com', ERASE_REMOVAL_INBOX='pilot@gmail.com'))
    monkeypatch.setattr(sys, 'argv', ['run_service.py', '--config', str(path), '--json'])
    monkeypatch.setattr(service.subprocess, 'call', lambda *a, **kw: pytest.fail('server started'))
    assert service.main() == 1
    result = json.loads(capsys.readouterr().out)
    assert not result['ready'] and not result['email_requests_ready'] and result['manual']
    assert result['live_removals_ready'] is False


def test_local_setup_needs_no_terminal_password_or_mail_account(tmp_path, monkeypatch, capsys):
    path = tmp_path.resolve() / 'local-service/config.json'
    monkeypatch.setattr(sys, 'argv', ['configure_service.py', '--config', str(path), '--local'])
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: False)
    monkeypatch.setattr(configure, 'prompt_config', lambda *a: pytest.fail('mail prompt'))
    monkeypatch.setattr(configure, 'prompt_gmail', lambda *a: pytest.fail('mail prompt'))
    assert configure.main() == 0
    saved = configure.load_config(path)
    assert saved['environment']['ERASE_LOCAL_INTAKE'] == 'true'
    assert saved['environment']['ERASE_WEB_HOME'].endswith('/.erase-me-web-local')
    assert not any('SMTP' in k or 'IMAP' in k for k in saved['environment'])
    assert '--local' in service.command(saved)
    assert service.can_start(service.readiness(saved))


def test_local_mode_never_runs_mail_connection_tests(tmp_path, monkeypatch, capsys):
    path = tmp_path.resolve() / 'local-service/config.json'
    configure.save_config(path, {'version': 1, 'port': 8766, 'environment': {'ERASE_LOCAL_INTAKE': 'true'}})
    monkeypatch.setattr(sys, 'argv', ['run_service.py', '--config', str(path), '--check-connections'])
    monkeypatch.setattr(service, 'check_connections', lambda *a, **kw: pytest.fail('mail connection'))
    assert service.main() == 1
    assert 'does not connect to an inbox' in capsys.readouterr().out


def test_local_mode_rejects_public_origin():
    with pytest.raises(ValueError, match='public origin'):
        configure.validate_config(settings(ERASE_LOCAL_INTAKE='true', ERASE_WEB_ORIGIN='https://privacy.example'))
