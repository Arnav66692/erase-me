"""Outbound privacy mail is reviewed once and tested with fake Google only."""
import base64
from copy import deepcopy
import email
import email.policy
import json
import sqlite3
from urllib.parse import parse_qs, urlsplit

import pytest

import connect_removal_gmail as oauth
import native_mail_host as native
import removal_sender as sender
import setup_removal_mail as setup

REAL_REQUEST_JSON = sender.request_json


PERSONAL = 'primary.fixture@gmail.com'
MAILBOX = 'removal.fixture@gmail.com'
NAME = 'Example Person'
REFERENCE = 'https://www.beenverified.com/record/example-fixture'
WORKSPACE = 'a' * 32
OPERATION = 'b' * 32
ORIGIN = 'chrome-extension://' + 'c' * 32 + '/'
CLIENT = {'client_id': 'fixture.apps.googleusercontent.com', 'client_secret': 'fixture-client-secret'}


def config(send=True):
    return {'version': 1, 'provider': 'gmail_oauth', 'mailbox': MAILBOX,
            'personal_email_sha256': oauth.private.personal_digest(PERSONAL), 'client': dict(CLIENT),
            'tokens': {'access_token': 'fixture-access-token', 'refresh_token': 'fixture-refresh-token', 'expires_at': 2000000000},
            'scopes': sorted(oauth.SEND_SCOPES if send else oauth.SCOPES),
            'identity': {'email': MAILBOX, 'email_verified': True, 'sub': 'fixture-google-sub'},
            'connected_at': '2026-11-05T00:00:00+00:00'}


def request(action='send-prepare', **changes):
    extra = {'send-status': {'authorized': True},
             'send-prepare': {'route_id': 'beenverified', 'operation_id': OPERATION, 'authorized': True,
                              'own_request': True, 'name': NAME, 'record_reference': REFERENCE},
             'send-result': {'route_id': 'beenverified', 'operation_id': OPERATION, 'explicit': True},
             'send-revoke': {'route_id': 'beenverified', 'operation_id': OPERATION, 'explicit': True},
             'send-once': {'authorized': True, 'own_request': True}}
    return {'action': action, 'workspace_id': WORKSPACE, 'personal_email_sha256': oauth.private.personal_digest(PERSONAL),
            **extra[action], **changes}


class Google:
    def __init__(self, directory):
        self.calls, self.messages = [], []
        self.directory = directory
        self.email, self.sub = MAILBOX, 'fixture-google-sub'
        self.fail_send = False
        self.before_identity = None
        self.bad_response = False
        self.token_scopes = oauth.SEND_SCOPES

    def __call__(self, url, **kwargs):
        self.calls.append((url, deepcopy(kwargs)))
        if url == oauth.TOKEN_URL:
            return {'access_token': 'fixture-fresh-access', 'expires_in': 3600, 'token_type': 'Bearer',
                    'scope': ' '.join(sorted(self.token_scopes))}
        if url == oauth.IDENTITY_URL:
            if self.before_identity:
                self.before_identity()
            return {'email': self.email, 'email_verified': True, 'sub': self.sub}
        if url == sender.SEND_URL:
            with sqlite3.connect(self.directory / 'grants.sqlite3') as db:
                assert db.execute('SELECT state FROM removal_outbox WHERE route=? AND operation=?',
                                  ('beenverified', OPERATION)).fetchone()[0] == 'started'
            raw = kwargs['body']['raw']
            message = email.message_from_bytes(base64.urlsafe_b64decode(raw + '=' * (-len(raw) % 4)), policy=email.policy.default)
            self.messages.append(message)
            if self.fail_send:
                raise sender.SenderError('provider_unavailable')
            return {} if self.bad_response else {'id': 'fixture-message-id', 'threadId': 'fixture-thread-id'}
        pytest.fail('No other provider, broker or Gmail read endpoint may be called')


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    directory = native.state_directory(home, create=True)
    native._write_new(directory / 'allowed-origin.json', json.dumps({'version': 1, 'origin': ORIGIN}))
    saved = config()
    clock = [1800000000]
    host = native.NativeMailHost(ORIGIN, home=home, loader=lambda _path: deepcopy(saved), clock=lambda: clock[0])
    google = Google(directory)
    monkeypatch.setattr(sender, 'request_json', google)
    return host, saved, google, clock, directory


def prepared(isolated):
    return isolated[0].handle(request())


def send_request(draft, **changes):
    return request('send-once', capability=draft['capability'], preview=deepcopy(draft['preview']), **changes)


def test_readonly_accounts_remain_compatible_and_cannot_send_or_prepare(isolated):
    host, saved, google, _clock, _directory = isolated
    saved['scopes'] = sorted(oauth.SCOPES)
    assert oauth.validate_config(saved)['scopes'] == sorted(oauth.SCOPES)
    status = host.handle(request('send-status'))
    assert status['configured'] is True and status['send_enabled'] is False
    assert 'contact_email' not in status and google.calls == []
    with pytest.raises(native.MailHostError, match='removal-only') as error:
        host.handle(request())
    assert error.value.code == 'send_permission_required' and google.calls == []


def test_prepare_checks_only_separate_identity_and_returns_exact_private_preview(isolated):
    host, _saved, google, _clock, directory = isolated
    draft = host.handle(request())
    assert draft['status'] == 'ready' and draft['automatic_execution'] is False
    assert draft['preview']['from'] == MAILBOX and draft['preview']['to'] == 'privacy@beenverified.com'
    assert NAME in draft['preview']['body'] and REFERENCE in draft['preview']['body']
    assert PERSONAL not in json.dumps(draft) and len(google.messages) == 0
    assert [url for url, _args in google.calls] == [oauth.TOKEN_URL, oauth.IDENTITY_URL]
    assert draft['message_digest'] == sender._digest(draft['preview'])
    stored = (directory / 'grants.sqlite3').read_bytes()
    for value in [PERSONAL, MAILBOX, NAME, REFERENCE, draft['preview']['subject'], draft['preview']['body']]:
        assert value.encode() not in stored


def test_send_is_reserved_before_google_and_records_only_provider_acceptance(isolated):
    host, _saved, google, _clock, directory = isolated
    draft = prepared(isolated)
    result = host.handle(send_request(draft))
    assert result['status'] == 'provider_accepted'
    assert result['message_id'] == 'fixture-message-id' and result['thread_id'] == 'fixture-thread-id'
    assert result['delivery_verified'] is result['acceptance_verified'] is result['deletion_verified'] is False
    assert len(google.messages) == 1
    message = google.messages[0]
    assert message['From'] == MAILBOX and message['To'] == 'privacy@beenverified.com'
    assert message['Subject'] == draft['preview']['subject']
    assert message.get_content().replace('\r\n', '\n') == draft['preview']['body']
    assert message['Cc'] is None and message['Bcc'] is None and message['Reply-To'] is None
    assert not list(message.iter_attachments())
    before = len(google.calls)
    assert host.handle(send_request(draft)) == result
    assert len(google.calls) == before
    assert host.handle(request('send-result')) == result
    stored = (directory / 'grants.sqlite3').read_bytes()
    assert NAME.encode() not in stored and REFERENCE.encode() not in stored


@pytest.mark.parametrize('kind', ['timeout', 'malformed'])
def test_unknown_delivery_is_held_and_never_retried(isolated, kind):
    host, _saved, google, _clock, _directory = isolated
    draft = prepared(isolated)
    google.fail_send = kind == 'timeout'
    google.bad_response = kind == 'malformed'
    result = host.handle(send_request(draft))
    assert result['status'] == 'unknown' and len(google.messages) == 1
    before = len(google.calls)
    assert host.handle(send_request(draft))['status'] == 'unknown'
    assert host.handle(request('send-result'))['status'] == 'unknown'
    assert len(google.calls) == before and len(google.messages) == 1


@pytest.mark.parametrize('field,value', [('to', 'attacker@example.test'), ('from', PERSONAL),
    ('subject', 'Export data'), ('body', 'Unreviewed replacement')])
def test_preview_tampering_never_reserves_or_sends(isolated, field, value):
    host, _saved, google, _clock, _directory = isolated
    draft = prepared(isolated)
    changed = send_request(draft)
    changed['preview'][field] = value
    before = len(google.calls)
    with pytest.raises(native.MailHostError):
        host.handle(changed)
    assert len(google.calls) == before and google.messages == []
    assert host.handle(request('send-result'))['status'] == 'ready'


@pytest.mark.parametrize('changes', [
    {'authorized': False}, {'own_request': False}, {'route_id': 'fastpeoplesearch'},
    {'route_id': 'usphonebook'}, {'route_id': 'tr-mobile-operator-rehber'}, {'route_id': 'smartbackgroundchecks'},
    {'name': 'Example\r\nBcc: attacker@example.test'},
    {'personal_email_sha256': 'd' * 64}, {'destination': 'attacker@example.test'},
])
def test_unapproved_primary_held_pilot_and_support_routes_do_not_contact_google(isolated, changes):
    host, _saved, google, _clock, _directory = isolated
    with pytest.raises(native.MailHostError):
        host.handle(request(**changes))
    assert google.calls == []


def test_same_draft_is_idempotent_but_changed_content_or_workspace_cannot_rebind(isolated):
    host, _saved, google, _clock, _directory = isolated
    first = prepared(isolated)
    assert host.handle(request()) == first
    before = len(google.calls)
    for changed in [request(record_reference='another exact record'), request(workspace_id='d' * 32)]:
        with pytest.raises(native.MailHostError):
            host.handle(changed)
    assert len(google.calls) == before


def test_hold_tombstone_can_precede_or_interrupt_preparation(isolated):
    host, _saved, google, _clock, _directory = isolated
    result = host.handle(request('send-revoke'))
    assert result['status'] == 'revoked' and google.calls == []
    with pytest.raises(native.MailHostError):
        host.handle(request())
    assert google.calls == []
    other = 'e' * 32
    google.before_identity = lambda: host.handle(request('send-revoke', operation_id=other))
    with pytest.raises(native.MailHostError):
        host.handle(request(operation_id=other))
    assert host.handle(request('send-result', operation_id=other))['status'] == 'revoked'
    assert google.messages == []


def test_revoked_capability_never_sends_and_revoke_works_without_google_config(isolated):
    host, saved, google, _clock, _directory = isolated
    draft = prepared(isolated)
    saved.clear()
    before = len(google.calls)
    assert host.handle(request('send-revoke'))['status'] == 'revoked'
    assert host.handle(request('send-result'))['status'] == 'revoked'
    assert len(google.calls) == before
    saved.update(config())
    assert host.handle(send_request(draft))['status'] == 'revoked' and len(google.calls) == before


def test_foreign_identity_or_ungranted_scope_stops_before_gmail_send(isolated):
    host, _saved, google, _clock, _directory = isolated
    draft = prepared(isolated)
    google.email = PERSONAL
    assert host.handle(send_request(draft))['status'] == 'unknown' and google.messages == []
    google.email = MAILBOX
    google.token_scopes = oauth.SCOPES
    with pytest.raises(Exception):
        host.handle(request(operation_id='f' * 32))
    assert google.messages == []


def test_expired_or_forged_capabilities_never_contact_google(isolated):
    host, _saved, google, clock, _directory = isolated
    draft = prepared(isolated)
    before = len(google.calls)
    changed = send_request(draft)
    changed['capability'] = changed['capability'][:-1] + ('a' if changed['capability'][-1] != 'a' else 'b')
    with pytest.raises(native.MailHostError):
        host.handle(changed)
    clock[0] += sender.LIFETIME
    with pytest.raises(native.MailHostError):
        host.handle(send_request(draft))
    assert len(google.calls) == before


def test_daily_prepare_quota_is_durable_before_provider_work(isolated):
    host, _saved, google, _clock, _directory = isolated
    for index in range(10):
        host.handle(request(operation_id=f'{index:032x}'))
    before = len(google.calls)
    with pytest.raises(native.MailHostError) as error:
        host.handle(request(operation_id='f' * 32))
    assert error.value.code == 'quota_exceeded' and len(google.calls) == before


def test_endpoint_and_native_protocol_are_fixed_and_secret_free(isolated):
    host, _saved, google, _clock, _directory = isolated
    for url, kwargs in [('https://evil.example/send', {'bearer': 'fixture', 'body': {'raw': 'fixture'}}),
                        (sender.SEND_URL, {'form': {'raw': 'fixture'}, 'bearer': 'fixture'}),
                        (sender.SEND_URL, {'bearer': 'fixture', 'body': {'raw': 'fixture', 'to': 'other'}})]:
        with pytest.raises(sender.SenderError, match='removal-only'):
            REAL_REQUEST_JSON(url, **kwargs)
    malformed = request(route_id='usphonebook')
    result = native.dispatch(malformed, host)
    assert result['ok'] is False
    assert all(value not in json.dumps(result) for value in [PERSONAL, MAILBOX, NAME, 'fixture-refresh-token'])
    assert google.calls == []


def test_transport_posts_only_exact_gmail_endpoint_and_rejects_redirects(monkeypatch):
    seen = []

    class Response:
        url = sender.SEND_URL

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            pass

        def geturl(self):
            return self.url

        def read(self, _maximum):
            return b'{"id":"fixture-message","threadId":"fixture-thread"}'

    class Opener:
        def open(self, request, **kwargs):
            seen.append((request, kwargs))
            return Response()

    monkeypatch.setattr(sender, 'build_opener', lambda *_handlers: Opener())
    assert REAL_REQUEST_JSON(sender.SEND_URL, bearer='fixture-access', body={'raw': 'fixture-body'})['id'] == 'fixture-message'
    request, options = seen[0]
    assert request.full_url == sender.SEND_URL and request.method == 'POST'
    assert json.loads(request.data) == {'raw': 'fixture-body'}
    assert request.get_header('Authorization') == 'Bearer fixture-access' and options['timeout'] == 8
    Response.url = 'https://evil.example/redirect'
    with pytest.raises(sender.SenderError):
        REAL_REQUEST_JSON(sender.SEND_URL, bearer='fixture-access', body={'raw': 'fixture-body'})


def test_review_accepts_bounded_international_names_without_header_or_body_injection(isolated):
    host, _saved, google, _clock, _directory = isolated
    draft = host.handle(request(name='名' * 120))
    assert '名' * 120 in draft['preview']['body'] and google.messages == []


def test_typed_identity_email_can_be_reviewed_as_a_reference_without_connecting_its_inbox(isolated):
    host, _saved, google, _clock, _directory = isolated
    draft = host.handle(request(record_reference=PERSONAL))
    assert 'Record reference: '+PERSONAL in draft['preview']['body']
    assert draft['preview']['from'] == MAILBOX and google.messages == []
    assert [url for url, _args in google.calls] == [oauth.TOKEN_URL, oauth.IDENTITY_URL]


def test_oauth_send_scope_is_optional_and_exact():
    old = oauth.authorization_url(CLIENT, MAILBOX, 'http://127.0.0.1:1234/oauth/callback', 'state', 'challenge')
    new = oauth.authorization_url(CLIENT, MAILBOX, 'http://127.0.0.1:1234/oauth/callback', 'state', 'challenge', allow_sending=True)
    assert set(parse_qs(urlsplit(old).query)['scope'][0].split()) == oauth.SCOPES
    assert set(parse_qs(urlsplit(new).query)['scope'][0].split()) == oauth.SEND_SCOPES
    assert oauth.validate_config(config(False))['scopes'] == sorted(oauth.SCOPES)
    assert oauth.validate_config(config(True))['scopes'] == sorted(oauth.SEND_SCOPES)
    with pytest.raises(oauth.OAuthError):
        oauth.scopes(' '.join(oauth.SEND_SCOPES))
    with pytest.raises(oauth.OAuthError):
        oauth.scopes(' '.join(oauth.SEND_SCOPES | {'https://www.googleapis.com/auth/gmail.modify'}), expected=oauth.SEND_SCOPES)


def test_enabling_send_on_saved_readonly_setup_requires_explicit_reconnect(tmp_path, monkeypatch):
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    path = home / '.erase-me-removal-mail' / oauth.TOKEN_FILE
    oauth.save_config(path, config(False))
    calls = []
    monkeypatch.setattr(oauth, 'check_token', lambda _path: calls.append('identity'))
    monkeypatch.setattr(oauth, 'connect', lambda *_args, **_kwargs: calls.append('consent'))
    answers = iter([PERSONAL, MAILBOX, 'yes'])
    with pytest.raises(setup.SetupError, match='fresh Google consent'):
        setup.run_setup(extension_id='a' * 32, prompt=lambda _question: next(answers), emit=lambda _line: None,
                        home=home, config_path=path, platform='linux', allow_sending=True)
    assert calls == [] and oauth.load_config(path)['scopes'] == sorted(oauth.SCOPES)


def test_explicit_send_upgrade_can_reuse_only_same_profile_private_client(tmp_path, monkeypatch):
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    path = home / '.erase-me-removal-mail' / oauth.TOKEN_FILE
    oauth.save_config(path, config(False))
    calls = []

    def connect(mailbox, personal, client, **kwargs):
        calls.append((mailbox, personal, client, kwargs))
        return config(True)

    monkeypatch.setattr(oauth, 'connect', connect)
    answers = iter([PERSONAL, MAILBOX, 'yes'])
    result = setup.run_setup(extension_id='a' * 32, prompt=lambda _question: next(answers), emit=lambda _line: None,
                            home=home, config_path=path, platform='linux', allow_sending=True,
                            reconnect=True, reuse_saved_client=True)
    assert result['installed'] is True
    assert calls == [(MAILBOX, PERSONAL, CLIENT, {'allow_sending': True})]
    assert oauth.load_config(path)['scopes'] == sorted(oauth.SEND_SCOPES)


def test_private_client_reuse_cannot_silently_apply_to_another_account(tmp_path, monkeypatch):
    home = tmp_path / 'user'
    home.mkdir(mode=0o700)
    path = home / '.erase-me-removal-mail' / oauth.TOKEN_FILE
    oauth.save_config(path, config(False))
    prompts = []

    def answer(question):
        prompts.append(question)
        if question.startswith('Primary'):
            return PERSONAL
        if question.startswith('Separate'):
            return 'another.removal@gmail.com'
        if question.startswith('Does'):
            return 'yes'
        raise setup.SetupError('A newly selected private client is required.')

    monkeypatch.setattr(oauth, 'connect', lambda *_args, **_kwargs: pytest.fail('Consent cannot start without the selected client'))
    with pytest.raises(setup.SetupError, match='private client'):
        setup.run_setup(extension_id='a' * 32, prompt=answer, emit=lambda _line: None, home=home,
                        config_path=path, platform='linux', allow_sending=True, reconnect=True, reuse_saved_client=True)
    assert any(question.startswith('Private Google') for question in prompts)
    assert oauth.load_config(path)['mailbox'] == MAILBOX


@pytest.mark.parametrize('allow_sending,returned_send,accepted', [(False, False, True), (True, True, True), (False, True, False), (True, False, False)])
def test_google_consent_validates_exact_requested_scope_and_revokes_mismatches(allow_sending, returned_send, accepted):
    calls, opened = [], []

    class Receiver:
        def __init__(self, *_args, **_kwargs):
            self.redirect_uri = 'http://127.0.0.1:1234/oauth/callback'

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            pass

        def wait(self):
            return 'fixture-code'

    def google(url, **_kwargs):
        calls.append(url)
        if url == oauth.TOKEN_URL:
            return {'access_token': 'fixture-access', 'refresh_token': 'fixture-refresh', 'expires_in': 3600,
                    'token_type': 'Bearer', 'scope': ' '.join(sorted(oauth.SEND_SCOPES if returned_send else oauth.SCOPES))}
        if url == oauth.IDENTITY_URL:
            return {'email': MAILBOX, 'email_verified': True, 'sub': 'fixture-sub'}
        if url == oauth.REVOKE_URL:
            return {}
        pytest.fail('Consent must not read or send Gmail')

    def connect():
        return oauth.connect(MAILBOX, PERSONAL, CLIENT, opener=lambda url: opened.append(url) or True,
                             receiver_factory=Receiver, request=google, allow_sending=allow_sending)

    if accepted:
        assert connect()['scopes'] == sorted(oauth.SEND_SCOPES if allow_sending else oauth.SCOPES)
        assert calls == [oauth.TOKEN_URL, oauth.IDENTITY_URL]
    else:
        with pytest.raises(oauth.OAuthError):
            connect()
        assert calls == [oauth.TOKEN_URL, oauth.REVOKE_URL]
    assert set(parse_qs(urlsplit(opened[0]).query)['scope'][0].split()) == (oauth.SEND_SCOPES if allow_sending else oauth.SCOPES)
