"""Dedicated mailbox preparation only. Tests use fake secrets and no network."""
import getpass
import json
import os
from pathlib import Path
import stat
import sys

import pytest

import configure_removal_mailbox as setup


def configuration(**updates):
    value = setup.make_config('removal.test@gmail.com', 'personal.test@gmail.com',
                              'imap.gmail.com', 'mx.google.com', password='fixture-only-password',
                              capability_secret='a' * 64)
    value['environment'].update(updates)
    return value


@pytest.fixture
def config_file(tmp_path):
    path = tmp_path / 'removal-mail/config.json'
    setup.save_config(path, configuration())
    return path


def args(path, **updates):
    values = {'mailbox': 'removal.test@gmail.com', 'personal-email': 'personal.test@gmail.com',
              'imap-host': 'imap.gmail.com', 'authserv-id': 'mx.google.com'}
    values.update(updates)
    return ['--config', str(path), '--dedicated', *[part for key, value in values.items() for part in ('--' + key, value)]]


def test_private_files_roundtrip_and_distinct_settings(config_file):
    data = setup.load_config(config_file)
    assert data == configuration()
    assert data['environment']['ERASE_DEDICATED_MAILBOX'] == 'true'
    assert not any('SMTP' in key for key in data['environment'])
    assert 'personal.test@gmail.com' not in config_file.read_text()
    for p, mode in ((config_file, 0o600), (config_file.parent, 0o700),
                    (config_file.parent / setup.MARKER, 0o600)):
        assert stat.S_IMODE(p.stat().st_mode) == mode
    with pytest.raises(ValueError, match='--replace'):
        setup.save_config(config_file, configuration())
    setup.save_config(config_file, configuration(ERASE_IMAP_PASSWORD='new-fixture-password'), replace=True)
    assert setup.load_config(config_file)['environment']['ERASE_IMAP_PASSWORD'] == 'new-fixture-password'
    assert not list(config_file.parent.glob('.mailbox-*'))


@pytest.mark.parametrize('personal,mailbox', [
    ('person.name@gmail.com', 'PERSONNAME@GMAIL.COM'),
    ('personname+private@gmail.com', 'person.name@gmail.com'),
    ('person.name@googlemail.com', 'personname@gmail.com'),
    ('person+private@example.com', 'PERSON@example.com'),
    ('PERSON@example.com', 'person@example.com'),
])
def test_personal_aliases_are_not_separate_mailboxes(personal, mailbox):
    with pytest.raises(ValueError, match='separate'):
        setup.make_config(mailbox, personal, 'imap.example.com', 'mx.example.com', password='fake')


def test_distinct_gmail_accounts_are_accepted():
    data = setup.make_config('removalbox@gmail.com', 'my.personal+alias@gmail.com',
                             'imap.gmail.com', 'mx.google.com', password='fake')
    assert len(data['environment']['ERASE_MAIL_CAPABILITY_SECRET']) == 64


@pytest.mark.parametrize('host', ['https://imap.example.com', 'imap.example.com:993', 'imap..example.com',
                                  'imap.example.com\n', 'localhost', '127.0.0.1', '-imap.example.com', 'imap_.example.com'])
def test_provider_hosts_are_validated_without_echoing_values(host):
    with pytest.raises(ValueError) as error:
        setup.make_config('removals@example.com', 'person@example.com', host, 'mx.example.com', password='fake')
    assert host not in str(error.value)


@pytest.mark.parametrize('mailbox', ['remove+tag@example.com', 'x' * 26 + '@example.com',
                                    'Person <removals@example.com>', 'remove@localhost'])
def test_aliasable_mailbox_rules(mailbox):
    with pytest.raises(ValueError):
        setup.make_config(mailbox, 'person@example.com', 'imap.example.com', 'mx.example.com', password='fake')


@pytest.mark.parametrize('updates', [
    {'ERASE_DEDICATED_MAILBOX': 'false'}, {'ERASE_IMAP_USER': 'person@gmail.com'},
    {'ERASE_IMAP_PASSWORD': 'secret\nvalue'}, {'ERASE_IMAP_PASSWORD': ''},
    {'ERASE_IMAP_PORT': '0'}, {'ERASE_IMAP_PORT': '65536'}, {'ERASE_IMAP_PORT': '９９３'},
    {'ERASE_MAIL_CAPABILITY_SECRET': 'short'}, {'ERASE_SMTP_PASSWORD': 'not-allowed'},
])
def test_invalid_or_extra_configuration_never_echoes_secrets(updates):
    with pytest.raises(ValueError) as error:
        setup.validate_config(configuration(**updates))
    assert 'secret\nvalue' not in str(error.value)
    assert 'not-allowed' not in str(error.value)


@pytest.mark.parametrize('kind', ['file', 'directory', 'parent', 'marker'])
def test_symbolic_links_are_rejected(config_file, tmp_path, kind):
    target = config_file
    if kind == 'file':
        other = tmp_path / 'other.json'
        config_file.rename(other)
        config_file.symlink_to(other)
    elif kind == 'marker':
        marker = config_file.parent / setup.MARKER
        marker.unlink()
        marker.symlink_to(config_file)
    elif kind == 'directory':
        target = tmp_path / 'link/config.json'
        target.parent.symlink_to(config_file.parent, target_is_directory=True)
    else:
        link = tmp_path / 'parent-link'
        link.symlink_to(tmp_path, target_is_directory=True)
        target = link / config_file.parent.name / config_file.name
    with pytest.raises(ValueError):
        setup.load_config(target)
    with pytest.raises(ValueError):
        setup.save_config(target, configuration(), replace=True)


@pytest.mark.parametrize('target', ['file', 'marker'])
def test_hardlinks_rejected(config_file, tmp_path, target):
    path = config_file if target == 'file' else config_file.parent / setup.MARKER
    os.link(path, tmp_path / 'hardlink')
    with pytest.raises(ValueError, match='regular files'):
        setup.load_config(config_file)


@pytest.mark.parametrize('target,mode', [('file', 0o644), ('directory', 0o755), ('marker', 0o644)])
def test_nonprivate_files_and_directory_rejected(config_file, target, mode):
    path = config_file if target == 'file' else config_file.parent if target == 'directory' else config_file.parent / setup.MARKER
    path.chmod(mode)
    with pytest.raises(ValueError, match='private'):
        setup.load_config(config_file)
    with pytest.raises(ValueError):
        setup.save_config(config_file, configuration(), replace=True)


def test_wrong_marker_and_unrelated_directory_rejected(tmp_path, config_file):
    (config_file.parent / setup.MARKER).write_text('unrelated program\n')
    with pytest.raises(ValueError, match='not recognized'):
        setup.load_config(config_file)
    other = tmp_path / 'unrelated'
    other.mkdir(mode=0o700)
    (other / 'existing.txt').write_text('keep')
    with pytest.raises(ValueError, match='unmarked'):
        setup.save_config(other / 'config.json', configuration())
    assert not (other / setup.MARKER).exists()


def test_no_adoption_of_home_ancestor_repository_or_bad_filename(monkeypatch, tmp_path):
    home = tmp_path / 'home'
    home.mkdir()
    monkeypatch.setattr(Path, 'home', classmethod(lambda cls: home))
    for directory in (home, tmp_path, Path('/'), setup.ROOT, setup.ROOT / 'private'):
        with pytest.raises(ValueError):
            setup.safe_directory(directory, create=True)
    with pytest.raises(ValueError, match='config.json'):
        setup.save_config(tmp_path / 'uncreated/secrets.txt', configuration())
    assert not (tmp_path / 'uncreated').exists()


def test_config_dedicated_comparison_is_rechecked_on_load(config_file):
    raw = configuration()
    raw['personal_email_sha256'] = setup.personal_digest('removaltest+personal@gmail.com')
    config_file.write_text(json.dumps(raw))
    with pytest.raises(ValueError, match='separate'):
        setup.load_config(config_file)


def test_cli_requires_dedicated_assertion_before_prompt(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(getpass, 'getpass', lambda *a: pytest.fail('Unexpected credential prompt'))
    assert setup.main(['--config', str(tmp_path / 'not-created/config.json')]) == 1
    assert '--dedicated' in capsys.readouterr().out
    assert not (tmp_path / 'not-created').exists()


def test_cli_invalid_alias_and_piped_credentials_never_prompt(tmp_path, monkeypatch):
    monkeypatch.setattr(getpass, 'getpass', lambda *a: pytest.fail('Unexpected credential prompt'))
    path = tmp_path / 'not-created/config.json'
    assert setup.main(args(path, mailbox='personaltest@gmail.com')) == 1
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: False)
    assert setup.main(args(path)) == 1
    assert not path.parent.exists()


def test_cli_hidden_setup_and_check_reveal_no_secret(tmp_path, monkeypatch, capsys):
    path = tmp_path / 'removal-mail/config.json'
    prompts = []
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(getpass, 'getpass', lambda prompt: prompts.append(prompt) or 'fake-hidden-password')
    assert setup.main(args(path)) == 0
    saved = setup.load_config(path)
    assert saved['environment']['ERASE_IMAP_PASSWORD'] == 'fake-hidden-password'
    assert setup.main(['--config', str(path), '--check']) == 0
    output = capsys.readouterr().out + ''.join(prompts)
    assert 'fake-hidden-password' not in output
    assert saved['environment']['ERASE_MAIL_CAPABILITY_SECRET'] not in output
    assert 'ERASE_IMAP_PASSWORD' not in output
    assert not any(key in output for key in saved['environment'])


def test_hidden_prompt_failure_writes_no_config(tmp_path, monkeypatch, capsys):
    path = tmp_path / 'not-created/config.json'
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: True)
    def failed(_):
        raise getpass.GetPassWarning('input could be echoed')
    monkeypatch.setattr(getpass, 'getpass', failed)
    assert setup.main(args(path)) == 1
    assert not path.exists()
    assert 'could be echoed' not in capsys.readouterr().out


def test_corrupted_marker_is_refused_without_traceback(config_file, capsys):
    (config_file.parent / setup.MARKER).write_bytes(b'\xff\xfe')
    assert setup.main(['--config', str(config_file), '--check']) == 1
    assert 'not recognized' in capsys.readouterr().out


def test_explicit_connection_tests_only_tls_login_readonly_and_logout(config_file, monkeypatch, capsys):
    calls = []
    class Client:
        def __init__(self, host, port, ssl_context, timeout):
            assert host == 'imap.gmail.com' and port == 993 and timeout == 15
            assert ssl_context.check_hostname
            assert ssl_context.verify_mode == setup.ssl.CERT_REQUIRED
            calls.append('connect')
        def login(self, username, password):
            assert username == 'removal.test@gmail.com' and password == 'fixture-only-password'
            calls.append('login')
        def select(self, folder, readonly):
            assert folder == 'INBOX' and readonly is True
            calls.append('select')
            return 'OK', []
        def logout(self):
            calls.append('logout')
        def uid(self, *args):
            pytest.fail('No message search or fetch is authorized by a connection test')
    monkeypatch.setattr(setup.imaplib, 'IMAP4_SSL', Client)
    assert setup.main(['--config', str(config_file), '--check']) == 0
    assert not calls
    assert setup.main(['--config', str(config_file), '--check', '--test-connection']) == 0
    assert calls == ['connect', 'login', 'select', 'logout']
    output = capsys.readouterr().out
    assert 'fixture-only-password' not in output and 'removal.test@gmail.com' not in output
    assert 'a' * 64 not in output


@pytest.mark.parametrize('stage', ['connect', 'login', 'select', 'logout'])
def test_provider_failures_do_not_reveal_messages_or_secrets(config_file, monkeypatch, capsys, stage):
    calls = []
    provider_text = 'provider echoed fixture-only-password and confidential connection data'
    class Client:
        def __init__(self, *args, **kwargs):
            if stage == 'connect':
                raise OSError(provider_text)
        def login(self, *args):
            if stage == 'login':
                raise setup.imaplib.IMAP4.error(provider_text)
        def select(self, *args, **kwargs):
            if stage == 'select':
                return 'NO', [provider_text.encode()]
            return 'OK', []
        def logout(self):
            calls.append('logout')
            if stage == 'logout':
                raise setup.imaplib.IMAP4.error(provider_text)
    monkeypatch.setattr(setup.imaplib, 'IMAP4_SSL', Client)
    assert setup.main(['--config', str(config_file), '--test-connection']) == (0 if stage == 'logout' else 1)
    assert provider_text not in capsys.readouterr().out
    assert calls == ([] if stage == 'connect' else ['logout'])


def test_default_setup_never_connects(tmp_path, monkeypatch):
    monkeypatch.setattr(sys.stdin, 'isatty', lambda: True)
    monkeypatch.setattr(getpass, 'getpass', lambda _: 'fixture-only-password')
    monkeypatch.setattr(setup.imaplib, 'IMAP4_SSL', lambda *a, **kw: pytest.fail('Setup connected to IMAP'))
    assert setup.main(args(tmp_path / 'mail/config.json')) == 0
