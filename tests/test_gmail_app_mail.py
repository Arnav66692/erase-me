"""Dedicated app-password transport: synthetic files and fake Gmail only."""
from copy import deepcopy
from datetime import datetime, timezone
from email.message import EmailMessage
from email.policy import SMTP
import hashlib
import json
from pathlib import Path
import sqlite3
import ssl
from urllib.parse import urlencode

import pytest

import gmail_app_mail as app
import native_mail_host as native
import removal_sender as sender
import setup_removal_mail as setup
import mail_setup_web as web

PRIMARY = 'primary.fixture@gmail.com'
MAILBOX = 'removal.fixture@gmail.com'
PASSWORD = 'abcdefghijklmnop'
WORKSPACE, OPERATION = 'a' * 32, 'b' * 32
ORIGIN = 'chrome-extension://' + 'c' * 32 + '/'
NOW = int(datetime(2026, 11, 5, tzinfo=timezone.utc).timestamp())


def config(sending=True):
    return app.make_config(MAILBOX, PRIMARY, PASSWORD, allow_sending=sending)


def request(action='send-prepare', **changes):
    fields = {'send-status': {'authorized': True},
              'send-prepare': {'route_id': 'beenverified', 'operation_id': OPERATION, 'name': 'Example Person',
                               'record_reference': 'My own fixture record', 'authorized': True, 'own_request': True},
              'send-once': {'authorized': True, 'own_request': True},
              'send-result': {'route_id': 'beenverified', 'operation_id': OPERATION, 'explicit': True},
              'send-revoke': {'route_id': 'beenverified', 'operation_id': OPERATION, 'explicit': True},
              'status': {'authorized': True},
              'session': {'authorized': True, 'route_id': 'fastpeoplesearch', 'operation_id': OPERATION},
              'check': {'explicit': True}, 'continue': {'explicit': True}, 'revoke': {'explicit': True}}
    return {'action': action, 'workspace_id': WORKSPACE,
            'personal_email_sha256': app.private.personal_digest(PRIMARY), **fields[action], **changes}


@pytest.fixture
def fake(tmp_path, monkeypatch):
    calls = []
    state = {'imap_ok': True, 'smtp_ok': True, 'data': 250, 'listing': b'', 'messages': {},
             'after_data': None, 'read': 0}

    class IMAP:
        def __init__(self, host, port, *, ssl_context, timeout):
            assert (host, port) == ('imap.gmail.com', 993)
            assert ssl_context.verify_mode == ssl.CERT_REQUIRED and ssl_context.check_hostname
            assert 0 < timeout <= 8
            calls.append(('imap-connect',))

        def login(self, user, password):
            calls.append(('imap-login', user))
            assert password == PASSWORD
            return ('OK' if state['imap_ok'] and user == MAILBOX else 'NO'), []

        def select(self, folder, *, readonly):
            calls.append(('imap-select', folder, readonly))
            assert state['imap_ok'] and folder == 'INBOX' and readonly is True
            return 'OK', []

        def uid(self, action, *args):
            calls.append(('imap-' + action, *args))
            if action == 'search':
                assert args[0] is None and args[1] == 'X-GM-RAW'
                assert args[2].startswith('"to:' + MAILBOX.split('@')[0] + '+erase-')
                assert ' after:' in args[2] and args[2].endswith('"')
                return 'OK', [state['listing']]
            assert action == 'fetch' and 'BODY.PEEK[]<0.' in args[1] and 'RFC822 ' not in args[1]
            state['read'] += 1
            raw = state['messages'][args[0]]
            meta = b'1 (UID ' + args[0] + b' INTERNALDATE "05-Nov-2026 00:03:00 +0000" RFC822.SIZE ' + str(len(raw)).encode() + b')'
            return 'OK', [(meta, raw)]

        def logout(self):
            calls.append(('imap-logout',))
            return 'BYE', []

    class SMTPClient:
        def __init__(self, host, port, *, context, timeout):
            assert (host, port) == ('smtp.gmail.com', 465)
            assert context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname
            assert 0 < timeout <= 8
            calls.append(('smtp-connect',))

        def login(self, user, password):
            calls.append(('smtp-login', user))
            assert password == PASSWORD and user == MAILBOX
            if not state['smtp_ok']:
                raise OSError('synthetic-private-provider-response')
            return 235, b'Authenticated'

        def mail(self, address):
            calls.append(('smtp-mail', address))
            assert address == MAILBOX
            return 250, b'OK'

        def rcpt(self, recipient):
            calls.append(('smtp-rcpt', recipient))
            assert recipient == sender.ROUTES['beenverified'][0]
            return 250, b'OK'

        def data(self, raw):
            calls.append(('smtp-data',))
            assert b'Example Person' in raw and b'My own fixture record' in raw
            assert b'Bcc:' not in raw and b'Cc:' not in raw
            if state['after_data']:
                state['after_data']()
            if isinstance(state['data'], Exception):
                raise state['data']
            return state['data'], b'fixture server response must not be logged'

        def quit(self):
            calls.append(('smtp-quit',))
            return 221, b'Bye'

        def close(self):
            calls.append(('smtp-close',))

    monkeypatch.setattr(app.imaplib, 'IMAP4_SSL', IMAP)
    monkeypatch.setattr(app.smtplib, 'SMTP_SSL', SMTPClient)
    monkeypatch.setattr(sender, 'request_json', lambda *_args, **_kwargs: pytest.fail('App-password transport must not call OAuth/Gmail REST'))
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    directory = native.state_directory(home, create=True)
    native._write_new(directory / 'allowed-origin.json', json.dumps({'version': 1, 'origin': ORIGIN}))
    saved = config()
    app.save_config(home / '.erase-me-removal-mail' / app.CONFIG_FILE, saved)
    app.select_config(home / '.erase-me-removal-mail', saved)
    host = native.NativeMailHost(ORIGIN, home=home, loader=lambda _path: pytest.fail('Selected app-password connection must not fall back to OAuth'), clock=lambda: NOW + 120)
    return home, host, calls, state, saved


def test_private_config_is_strict_and_normalizes_only_google_display_spaces(tmp_path):
    assert app.password('abcd efgh ijkl mnop') == PASSWORD
    for value in ['Google-account-password', PASSWORD + '\n', 'abcd\tefghijklmnop', '', None, 123, 'ABCDEFGHIJKLMNOP']:
        with pytest.raises(app.AppMailError):
            app.password(value)
    for changes in [{'mailbox': 'p.r.i.m.a.r.y.fixture+alias@googlemail.com'}, {'allow_sending': 1}, {'imap_host': 'evil.example'}, {'provider': 'other'}]:
        value = {**config(), **changes}
        with pytest.raises(app.AppMailError):
            app.validate_config(value)
    p = tmp_path / 'private' / app.CONFIG_FILE
    expected = config()
    app.save_config(p, expected)
    assert app.load_config(p) == expected
    assert p.stat().st_mode & 0o777 == 0o600 and p.parent.stat().st_mode & 0o777 == 0o700
    p.chmod(0o644)
    with pytest.raises(ValueError):
        app.load_config(p)


def test_status_and_contact_creation_authenticate_but_never_select_search_or_read(fake):
    _home, host, calls, state, _saved = fake
    assert host.handle(request('status'))['contact_email'] == MAILBOX
    contact = host.handle(request('session'))
    assert contact['contact_email'].startswith(MAILBOX.split('@')[0] + '+erase-')
    assert [c[0] for c in calls].count('imap-login') == 2
    assert not any(c[0] in ('imap-select', 'imap-search', 'imap-fetch', 'smtp-connect') for c in calls)
    assert state['read'] == 0


def test_wrong_primary_or_gmail_username_stops_before_inbox_access(fake):
    home, host, calls, state, saved = fake
    assert native.dispatch(request('status', personal_email_sha256='f' * 64), host)['code'] == 'personal_account_mismatch'
    assert calls == []
    changed = {**saved, 'mailbox': 'wrong.fixture@gmail.com'}
    app.save_config(home / '.erase-me-removal-mail' / app.CONFIG_FILE, changed, replace=True)
    app.select_config(home / '.erase-me-removal-mail', changed)
    assert native.dispatch(request('status'), host)['ok'] is False
    assert not any(c[0] in ('imap-select', 'imap-search', 'imap-fetch') for c in calls)
    assert state['read'] == 0


def test_explicit_selection_never_silently_falls_back_or_accepts_a_changed_config(fake):
    home, host, calls, _state, saved = fake
    app.save_config(home / '.erase-me-removal-mail' / app.CONFIG_FILE, {**saved, 'mailbox': 'changed.fixture@gmail.com'}, replace=True)
    assert host.handle(request('status'))['configured'] is False
    assert calls == []


def test_readonly_local_permission_cannot_prepare_or_send(fake):
    home, host, calls, _state, saved = fake
    saved['allow_sending'] = False
    app.save_config(home / '.erase-me-removal-mail' / app.CONFIG_FILE, saved, replace=True)
    assert host.handle(request('send-status'))['send_enabled'] is False
    assert calls == []
    with pytest.raises(native.MailHostError) as failure:
        host.handle(request())
    assert failure.value.code == 'send_permission_required' and calls == []


def test_smtp_acceptance_uses_real_data_250_and_durable_started_state_without_fake_google_ids(fake):
    home, host, calls, state, _saved = fake
    draft = host.handle(request())
    assert not any(c[0] == 'smtp-data' for c in calls)

    def durable_before_data():
        with sqlite3.connect(home / native.STATE_DIRECTORY / 'grants.sqlite3') as db:
            assert db.execute('SELECT state FROM removal_outbox').fetchone()[0] == 'started'
    state['after_data'] = durable_before_data
    value = host.handle(request('send-once', capability=draft['capability'], preview=draft['preview']))
    assert value['status'] == 'smtp_accepted' and value['acceptance_kind'] == 'smtp_250'
    assert len(value['receipt_ref']) == 64 and 'message_id' not in value and 'thread_id' not in value
    assert value['delivery_verified'] is value['acceptance_verified'] is value['deletion_verified'] is False
    assert host.handle(request('send-result')) == value
    again = host.handle(request('send-once', capability=draft['capability'], preview=draft['preview']))
    assert again == value and sum(c[0] == 'smtp-data' for c in calls) == 1
    assert host.handle(request('send-revoke'))['status'] == 'already_started'
    database = (home / native.STATE_DIRECTORY / 'grants.sqlite3').read_bytes()
    for private_value in (PASSWORD, 'Example Person', 'My own fixture record', draft['preview']['body']):
        assert private_value.encode() not in database


@pytest.mark.parametrize('failure', [550, OSError('synthetic uncertain SMTP response')])
def test_smtp_rejection_or_interruption_remains_unknown_and_never_retries(fake, failure):
    _home, host, calls, state, _saved = fake
    draft = host.handle(request())
    state['data'] = failure
    once = request('send-once', capability=draft['capability'], preview=draft['preview'])
    assert host.handle(once)['status'] == 'unknown'
    assert host.handle(once)['status'] == 'unknown'
    assert sum(c[0] == 'smtp-data' for c in calls) == 1


def test_revoke_before_send_and_invalid_recipient_never_open_smtp(fake):
    _home, host, calls, _state, _saved = fake
    draft = host.handle(request())
    calls.clear()
    assert host.handle(request('send-revoke'))['status'] == 'revoked'
    assert host.handle(request('send-once', capability=draft['capability'], preview=draft['preview']))['status'] == 'revoked'
    assert calls == []
    value = request('send-once', capability=draft['capability'], preview={**draft['preview'], 'to': 'unrelated@example.test'})
    assert native.dispatch(value, host)['ok'] is False and calls == []


def receipt(contact, *, authenticated=True, recipient=None):
    msg = EmailMessage(policy=SMTP)
    msg['From'] = 'privacy@fastpeoplesearch.com'
    msg['To'] = recipient or contact['contact_email']
    msg['Date'] = 'Thu, 05 Nov 2026 00:03:00 +0000'
    msg['Subject'] = 'Confirm your removal request'
    msg['Authentication-Results'] = ('mx.google.com; dmarc=pass header.from=fastpeoplesearch.com; dkim=pass header.d=fastpeoplesearch.com'
                                     if authenticated else 'untrusted.example; dmarc=pass header.from=fastpeoplesearch.com; dkim=pass header.d=fastpeoplesearch.com')
    msg.set_content('Confirm removal: https://www.fastpeoplesearch.com/optout/removal?' + urlencode({'firstname': 'Example', 'middlename': '', 'lastname': 'Person', 'email': contact['contact_email'], 'ticketid': '123456'}))
    return msg.as_bytes()


def test_alias_only_reader_reuses_authentication_purpose_and_once_continuation(fake):
    _home, host, calls, state, _saved = fake
    contact = host.handle(request('session'))
    state['listing'], state['messages'] = b'91', {b'91': receipt(contact)}
    checked = host.handle(request('check', capability=contact['capability']))
    assert checked['status'] == 'held' and checked['authenticated'] is True
    assert checked['continuation_available'] is True and 'confirmation_url' not in checked
    continued = host.handle(request('continue', capability=contact['capability'], receipt_ref=checked['receipt_ref']))
    assert continued['status'] == 'confirmation_ready'
    assert continued['confirmation_url'].startswith('https://www.fastpeoplesearch.com/optout/removal?')
    assert native.dispatch(request('continue', capability=contact['capability'], receipt_ref=checked['receipt_ref']), host)['code'] == 'already_started'
    assert state['read'] == 2
    assert sum(c[0] == 'imap-select' and c[2] is True for c in calls) == 2


@pytest.mark.parametrize('kind', ['provenance', 'recipient', 'size', 'search'])
def test_untrusted_or_uncorrelated_imap_data_cannot_release_confirmation(fake, kind):
    _home, host, _calls, state, _saved = fake
    contact = host.handle(request('session'))
    state['listing'] = b'91'
    state['messages'][b'91'] = receipt(contact, authenticated=kind != 'provenance', recipient='other@example.test' if kind == 'recipient' else None)
    if kind == 'size':
        state['messages'][b'91'] = b'x' * (app.relay.MAX_BYTES + 1)
    if kind == 'search':
        state['listing'] = b'91 NOOP\r\n'
        assert native.dispatch(request('check', capability=contact['capability']), host)['ok'] is False
    else:
        assert host.handle(request('check', capability=contact['capability']))['status'] == 'pending'


def test_local_app_password_setup_needs_no_cloud_client_and_selects_only_after_authenticated_install(fake):
    home, _host, calls, state, _saved = fake
    # Reuse the same synthetic private home, but a new Chrome registration.
    answers = iter([PRIMARY, MAILBOX, 'yes', 'yes'])
    result = setup.run_setup(extension_id='c' * 32, connection_method='app_password', app_password=PASSWORD,
        allow_sending=True, prompt=lambda _question: next(answers), emit=lambda _line: None,
        home=home, config_path=home / '.erase-me-removal-mail' / 'gmail-oauth.json', platform='linux')
    assert result['reused_connection'] is True and result['identity_checked'] is True
    assert app.selection(home / '.erase-me-removal-mail')['provider'] == app.PROVIDER
    assert not any(c[0] in ('imap-select', 'imap-search', 'smtp-data') for c in calls)
    assert state['read'] == 0 and not (home / '.erase-me-removal-mail' / 'gmail-oauth.json').exists()


def test_web_app_password_schema_is_local_strict_and_cannot_mix_google_secrets():
    value = {'personal_email': PRIMARY, 'mailbox': MAILBOX, 'extension_id': 'c' * 32, 'browser': 'chrome',
             'client_json': None, 'removal_only': True, 'replace_registration': False, 'reconnect': False,
             'allow_sending': False, 'connection_method': 'app_password', 'app_password': PASSWORD}
    assert web.validate_request(deepcopy(value)) == value
    for changes in [{'client_json': '{}'}, {'connection_method': 'oauth'}, {'app_password': 'account password'}, {'imap_host': 'arbitrary.example'}]:
        with pytest.raises(web.WebSetupError):
            web.validate_request({**value, **changes})


def test_first_app_password_connection_has_no_google_cloud_file_or_oauth_calls(fake):
    home, _host, calls, _state, _saved = fake
    directory = home / '.erase-me-removal-mail'
    (directory / app.CONFIG_FILE).unlink()
    (directory / app.SELECTION_FILE).unlink()
    answers = iter([PRIMARY, MAILBOX, 'yes', 'yes'])
    result = setup.run_setup(extension_id='c' * 32, connection_method='app_password', app_password=PASSWORD,
        allow_sending=False, prompt=lambda _question: next(answers), emit=lambda _line: None,
        home=home, config_path=directory / 'gmail-oauth.json', platform='linux')
    assert result['reused_connection'] is False and result['messages_read'] is False and result['scheduled_work'] is False
    active_path = app.config_path(directory, app.selection(directory))
    assert app.VERSIONED_CONFIG.fullmatch(active_path.name)
    assert app.load_config(active_path)['allow_sending'] is False
    assert app.selection(directory)['provider'] == app.PROVIDER
    assert not (directory / 'gmail-oauth.json').exists()
    assert [c[0] for c in calls].count('imap-login') == 1
    assert not any(c[0] in ('imap-select', 'imap-search', 'smtp-connect', 'smtp-data') for c in calls)
    previous = active_path.read_bytes()
    answers = iter([PRIMARY, MAILBOX, 'yes'])
    reused = setup.run_setup(extension_id='c' * 32, connection_method='app_password',
        prompt=lambda _question: next(answers), emit=lambda _line: None,
        home=home, config_path=directory / 'gmail-oauth.json', platform='linux')
    assert reused['reused_connection'] is True
    assert app.config_path(directory, app.selection(directory)) == active_path
    assert active_path.read_bytes() == previous


def test_provider_authentication_failure_creates_no_active_new_connection(fake):
    home, _host, calls, state, _saved = fake
    directory = home / '.erase-me-removal-mail'
    (directory / app.CONFIG_FILE).unlink()
    (directory / app.SELECTION_FILE).unlink()
    state['imap_ok'] = False
    answers = iter([PRIMARY, MAILBOX, 'yes', 'yes'])
    with pytest.raises(app.AppMailError):
        setup.run_setup(extension_id='c' * 32, connection_method='app_password', app_password=PASSWORD,
            prompt=lambda _question: next(answers), emit=lambda _line: None,
            home=home, config_path=directory / 'gmail-oauth.json', platform='linux')
    assert not (directory / app.CONFIG_FILE).exists() and not (directory / app.SELECTION_FILE).exists()
    assert not any(c[0] in ('imap-select', 'imap-search', 'smtp-connect') for c in calls)


def test_changed_method_and_sending_permission_require_explicit_replacement(fake):
    home, _host, calls, _state, saved = fake
    directory = home / '.erase-me-removal-mail'
    answers = lambda: iter([PRIMARY, MAILBOX, 'yes', 'yes'])
    reply = answers()
    with pytest.raises(setup.SetupError, match='Switching connection methods'):
        setup.run_setup(extension_id='c' * 32, prompt=lambda _question: next(reply), emit=lambda _line: None,
                        home=home, config_path=directory / 'gmail-oauth.json', platform='linux')
    saved['allow_sending'] = False
    app.save_config(directory / app.CONFIG_FILE, saved, replace=True)
    reply = answers()
    with pytest.raises(setup.SetupError, match='Adding sending permission'):
        setup.run_setup(extension_id='c' * 32, connection_method='app_password', allow_sending=True,
                        prompt=lambda _question: next(reply), emit=lambda _line: None,
                        home=home, config_path=directory / 'gmail-oauth.json', platform='linux')
    assert calls == []


def test_closed_setup_cannot_select_a_late_app_password_connection(fake):
    home, _host, _calls, _state, _saved = fake
    directory = home / '.erase-me-removal-mail'
    old_selection = (directory / app.SELECTION_FILE).read_bytes()
    answers = iter([PRIMARY, MAILBOX, 'yes', 'yes'])
    def guard(stage):
        if stage == 'before_provider_selection':
            raise setup.SetupError('closed fixture')
    with pytest.raises(setup.SetupError, match='closed fixture'):
        setup.run_setup(extension_id='c' * 32, connection_method='app_password', app_password=PASSWORD,
            prompt=lambda _question: next(answers), emit=lambda _line: None,
            home=home, config_path=directory / 'gmail-oauth.json', platform='linux', ensure_active=guard)
    assert (directory / app.SELECTION_FILE).read_bytes() == old_selection


@pytest.mark.parametrize('phase', ['after_app_identity', 'after_app_send_identity', 'after_identity',
                                  'before_provider_selection', 'before_save', 'during_stage',
                                  'before_connection_activation'])
def test_canceled_replacement_never_activates_new_credentials_or_sending(fake, monkeypatch, phase):
    home, host, calls, _state, saved = fake
    directory = home / '.erase-me-removal-mail'
    saved['allow_sending'] = False
    app.save_config(directory / app.CONFIG_FILE, saved, replace=True)
    previous_config = (directory / app.CONFIG_FILE).read_bytes()
    previous_selection = (directory / app.SELECTION_FILE).read_bytes()
    monkeypatch.setattr(setup.installer, 'check', lambda _spec: {'installed': True})
    canceled = False
    real_stage = app.stage_config

    def stage(*args):
        nonlocal canceled
        staged = real_stage(*args)
        if phase == 'during_stage':
            canceled = True
        return staged

    def guard(stage_name):
        if canceled or phase == stage_name:
            raise setup.SetupError('canceled fixture')

    monkeypatch.setattr(app, 'stage_config', stage)
    answers = iter([PRIMARY, MAILBOX, 'yes'])
    with pytest.raises(setup.SetupError, match='canceled fixture'):
        setup.run_setup(extension_id='c' * 32, connection_method='app_password', app_password=PASSWORD,
            reconnect=True, allow_sending=True, prompt=lambda _question: next(answers), emit=lambda _line: None,
            home=home, config_path=directory / 'gmail-oauth.json', platform='linux', ensure_active=guard)
    assert (directory / app.CONFIG_FILE).read_bytes() == previous_config
    assert (directory / app.SELECTION_FILE).read_bytes() == previous_selection
    assert not list(directory.glob('gmail-app-password-*.json'))
    assert host.handle(request('send-status'))['send_enabled'] is False
    assert not any(call[0] == 'smtp-data' for call in calls)
    if phase == 'after_app_identity':
        assert not any(call[0] == 'smtp-connect' for call in calls)


def test_reserved_activation_may_finish_when_close_loses_the_session_lock(fake, monkeypatch):
    home, host, _calls, _state, saved = fake
    directory = home / '.erase-me-removal-mail'
    saved['allow_sending'] = False
    app.save_config(directory / app.CONFIG_FILE, saved, replace=True)
    previous_config = (directory / app.CONFIG_FILE).read_bytes()
    monkeypatch.setattr(setup.installer, 'check', lambda _spec: {'installed': True})
    session = web.SetupSession(home=home, config_path=directory / 'gmail-oauth.json', platform='linux')
    real_save = app._save
    closed = []

    def close_during_selection(path, name, value, **kwargs):
        if name == app.SELECTION_FILE:
            closed.append(session.close())
        return real_save(path, name, value, **kwargs)

    monkeypatch.setattr(app, '_save', close_during_selection)
    value = {'personal_email': PRIMARY, 'mailbox': MAILBOX, 'extension_id': 'c' * 32, 'browser': 'chrome',
             'client_json': None, 'removal_only': True, 'replace_registration': False, 'reconnect': True,
             'allow_sending': True, 'connection_method': 'app_password', 'app_password': PASSWORD}
    assert session.run(value)['installed'] is True
    assert closed == [{'closed': True, 'installation_started': True}]
    assert (directory / app.CONFIG_FILE).read_bytes() == previous_config
    selected = app.selection(directory)
    assert selected['version'] == 2
    assert app.load_config(app.config_path(directory, selected))['allow_sending'] is True
    assert host.handle(request('send-status'))['send_enabled'] is True


def test_concurrent_activation_is_preserved_and_only_own_inactive_stage_is_removed(fake, monkeypatch):
    home, host, _calls, _state, saved = fake
    directory = home / '.erase-me-removal-mail'
    saved['allow_sending'] = False
    app.save_config(directory / app.CONFIG_FILE, saved, replace=True)
    previous_config = (directory / app.CONFIG_FILE).read_bytes()
    monkeypatch.setattr(setup.installer, 'check', lambda _spec: {'installed': True})
    real_stage = app.stage_config
    concurrent_path = []

    def concurrent_stage(*args):
        own_path = real_stage(*args)
        other = real_stage(directory, saved)
        app.select_config(directory, saved, config_file=other.name)
        concurrent_path.append(other)
        return own_path

    monkeypatch.setattr(app, 'stage_config', concurrent_stage)
    answers = iter([PRIMARY, MAILBOX, 'yes'])
    with pytest.raises(app.AppMailError) as failure:
        setup.run_setup(extension_id='c' * 32, connection_method='app_password', app_password=PASSWORD,
            reconnect=True, allow_sending=True, prompt=lambda _question: next(answers), emit=lambda _line: None,
            home=home, config_path=directory / 'gmail-oauth.json', platform='linux')
    assert failure.value.code == 'connection_changed'
    assert (directory / app.CONFIG_FILE).read_bytes() == previous_config
    assert app.config_path(directory, app.selection(directory)) == concurrent_path[0]
    assert list(directory.glob('gmail-app-password-*.json')) == concurrent_path
    assert host.handle(request('send-status'))['send_enabled'] is False


def test_versioned_configs_are_immutable_and_selection_rejects_arbitrary_paths(fake):
    home, host, calls, _state, saved = fake
    directory = home / '.erase-me-removal-mail'
    staged = app.stage_config(directory, saved)
    assert staged.stat().st_mode & 0o777 == 0o600
    with pytest.raises(app.AppMailError):
        app.save_config(staged, saved, replace=True)
    for filename in ('../gmail-app-password.json', 'gmail-oauth.json', 'arbitrary.json'):
        with pytest.raises(app.AppMailError):
            app.select_config(directory, saved, config_file=filename)
    app.select_config(directory, saved, config_file=staged.name)
    staged.unlink()
    assert host.handle(request('status'))['configured'] is False
    assert calls == []


def test_secret_selection_files_and_capabilities_are_not_exposed_in_local_setup_results(fake):
    home, _host, calls, _state, _saved = fake
    value = {'personal_email': PRIMARY, 'mailbox': MAILBOX, 'extension_id': 'c' * 32, 'browser': 'chrome',
             'client_json': None, 'removal_only': True, 'replace_registration': True, 'reconnect': False,
             'allow_sending': True, 'connection_method': 'app_password', 'app_password': PASSWORD}
    session = web.SetupSession(home=home, config_path=home / '.erase-me-removal-mail' / 'gmail-oauth.json', platform='linux')
    assert set(session.info()) == {'extension_id', 'browser'}
    result = session.run(value)
    assert result['installed'] is True and result['identity_checked'] is True
    assert value['app_password'] is None and PASSWORD not in json.dumps(result)
    assert not any(c[0] in ('imap-select', 'imap-fetch', 'smtp-data') for c in calls)


def test_expired_or_removed_credentials_do_not_prevent_local_revocation(fake):
    home, host, calls, _state, _saved = fake
    contact = host.handle(request('session'))
    app_file = home / '.erase-me-removal-mail' / app.CONFIG_FILE
    app_file.unlink()
    calls.clear()
    assert host.handle(request('revoke', capability=contact['capability']))['status'] == 'revoked'
    assert host.handle(request('send-revoke'))['status'] == 'revoked'
    assert calls == []
