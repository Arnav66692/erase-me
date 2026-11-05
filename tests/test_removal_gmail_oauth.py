"""Google OAuth tests use fixtures, fake browser/callbacks and mocked HTTPS only."""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
from urllib.parse import parse_qs, urlsplit

import pytest

import connect_removal_gmail as oauth

MAILBOX = 'removal.fixture@gmail.com'
PERSONAL = 'personal.fixture@gmail.com'
CLIENT = {'client_id': 'fixture.apps.googleusercontent.com', 'client_secret': 'fixture-client-secret'}


def response(**changes):
    result = {'access_token': 'fixture-access-token', 'refresh_token': 'fixture-refresh-token',
              'expires_in': 3600, 'token_type': 'Bearer',
              'scope': 'openid https://www.googleapis.com/auth/userinfo.email ' + oauth.GMAIL_READONLY}
    result.update(changes)
    return result


class Receiver:
    instances = []
    def __init__(self, state, timeout):
        self.state, self.timeout = state, timeout
        self.redirect_uri = 'http://127.0.0.1:55432/oauth/callback'
        self.closed = False
        self.instances.append(self)
    def __enter__(self): return self
    def __exit__(self, *args): self.closed = True
    def wait(self): return 'fixture-authorization-code'


class Google:
    def __init__(self, *, address=MAILBOX, verified=True, token=None):
        self.address, self.verified = address, verified
        self.token = response() if token is None else token
        self.calls = []
    def __call__(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if url == oauth.TOKEN_URL: return dict(self.token)
        if url == oauth.IDENTITY_URL: return {'email': self.address, 'sub': 'fixture-google-sub', 'email_verified': self.verified}
        if url == oauth.REVOKE_URL: return {}
        pytest.fail('No Gmail or other endpoint may be reached by OAuth setup')


def connected(google=None, **kwargs):
    google = google or Google()
    opened = []
    result = oauth.connect(MAILBOX, PERSONAL, dict(CLIENT), opener=lambda url: opened.append(url) or True,
                           receiver_factory=Receiver, request=google, **kwargs)
    return result, google, opened


@pytest.fixture
def token_file(tmp_path):
    data, _, _ = connected()
    path = tmp_path / 'private-removal/gmail-oauth.json'
    oauth.save_config(path, data)
    return path


@pytest.fixture
def client_file(tmp_path):
    path = tmp_path / 'desktop-client.json'
    path.write_text(json.dumps({'installed': {**CLIENT, 'auth_uri': oauth.AUTH_URL, 'token_uri': oauth.TOKEN_URL,
                                              'redirect_uris': ['http://localhost']}}))
    path.chmod(0o600)
    return path


def test_pkce_and_consent_are_bound_to_exact_readonly_dedicated_flow():
    verifier, challenge = oauth.pkce()
    assert len(verifier) >= 43
    expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    assert challenge == expected
    url = oauth.authorization_url(CLIENT, MAILBOX, 'http://127.0.0.1:54321/oauth/callback', 'fixture-state', challenge)
    parsed = urlsplit(url)
    query = parse_qs(parsed.query)
    assert parsed.scheme == 'https' and parsed.netloc == 'accounts.google.com'
    assert set(query['scope'][0].split()) == oauth.SCOPES
    assert query['code_challenge_method'] == ['S256'] and query['state'] == ['fixture-state']
    assert query['login_hint'] == [MAILBOX] and query['access_type'] == ['offline']
    assert query['include_granted_scopes'] == ['false']
    assert CLIENT['client_secret'] not in url and verifier not in url


def test_code_exchange_precedes_verified_identity_and_never_calls_gmail():
    data, google, opened = connected()
    assert [url for url, _ in google.calls] == [oauth.TOKEN_URL, oauth.IDENTITY_URL]
    form = google.calls[0][1]['form']
    assert form['code'] == 'fixture-authorization-code' and form['grant_type'] == 'authorization_code'
    challenge = parse_qs(urlsplit(opened[0]).query)['code_challenge'][0]
    assert base64.urlsafe_b64encode(hashlib.sha256(form['code_verifier'].encode()).digest()).rstrip(b'=').decode() == challenge
    assert data['identity']['email'] == MAILBOX
    assert data['scopes'] == sorted(oauth.SCOPES)
    assert Receiver.instances[-1].closed


@pytest.mark.parametrize('path,host', [
    ('/oauth/callback?state=wrong&code=secret', '127.0.0.1:12345'),
    ('/other?state=good&code=secret', '127.0.0.1:12345'),
    ('/oauth/callback?state=good&code=secret', 'evil.example:12345'),
    ('/oauth/callback?state=good&state=good&code=secret', '127.0.0.1:12345'),
    ('/oauth/callback?state=good&code=first&code=second', '127.0.0.1:12345'),
    ('/oauth/callback?state=good&code=', '127.0.0.1:12345'),
    ('https://evil.example/oauth/callback?state=good&code=secret', '127.0.0.1:12345'),
])
def test_callback_rejects_cross_site_wrong_state_and_duplicate_code(path, host):
    assert oauth.callback_code(path, host, 12345, 'good') is None


def test_callback_returns_only_single_matching_code_and_hides_denial():
    assert oauth.callback_code('/oauth/callback?state=good&code=fixture-code', '127.0.0.1:12345', 12345, 'good') == 'fixture-code'
    with pytest.raises(oauth.OAuthError) as error:
        oauth.callback_code('/oauth/callback?state=good&error=denied&error_description=private-secret', '127.0.0.1:12345', 12345, 'good')
    assert 'private-secret' not in str(error.value)


@pytest.mark.parametrize('address,verified', [(PERSONAL, True), (MAILBOX, False)])
def test_wrong_or_unverified_account_revokes_before_any_gmail_data(address, verified):
    google = Google(address=address, verified=verified)
    with pytest.raises(oauth.IdentityMismatch): connected(google)
    assert [url for url, _ in google.calls] == [oauth.TOKEN_URL, oauth.IDENTITY_URL, oauth.REVOKE_URL]
    assert google.calls[-1][1]['form']['token'] == 'fixture-refresh-token'


@pytest.mark.parametrize('mailbox,personal', [
    ('person.name@gmail.com', 'personname+private@googlemail.com'),
    ('person+remove@gmail.com', PERSONAL), ('service@example.com', PERSONAL),
])
def test_personal_alias_or_non_gmail_refusal_happens_before_browser(mailbox, personal):
    with pytest.raises(oauth.OAuthError):
        oauth.connect(mailbox, personal, CLIENT, opener=lambda _: pytest.fail('Browser must not open'))


@pytest.mark.parametrize('change', [
    {'scope': 'openid email https://www.googleapis.com/auth/gmail.modify'},
    {'scope': 'openid email ' + oauth.GMAIL_READONLY + ' https://mail.google.com/'},
    {'refresh_token': ''}, {'token_type': 'Basic'}, {'token_type': 1},
    {'expires_in': float('inf')}, {'expires_in': True}, {'access_token': 'bad\nsecret'},
])
def test_permission_escalation_or_bad_tokens_are_refused_and_revoked(change):
    google = Google(token=response(**change))
    with pytest.raises(oauth.OAuthError): connected(google)
    assert oauth.IDENTITY_URL not in [url for url, _ in google.calls]
    assert google.calls[-1][0] == oauth.REVOKE_URL


def test_no_browser_open_or_callback_failure_leaks_code():
    class FailingReceiver(Receiver):
        def wait(self): raise oauth.OAuthError('Authorization timed out.')
    google = Google()
    with pytest.raises(oauth.OAuthError):
        oauth.connect(MAILBOX, PERSONAL, CLIENT, opener=lambda _: False, receiver_factory=Receiver, request=google)
    with pytest.raises(oauth.OAuthError):
        oauth.connect(MAILBOX, PERSONAL, CLIENT, opener=lambda _: True, receiver_factory=FailingReceiver, request=google)
    assert google.calls == [] and FailingReceiver.instances[-1].closed


def test_desktop_client_config_requires_private_google_installed_file(client_file):
    assert oauth.load_client(client_file) == CLIENT
    client_file.chmod(0o644)
    with pytest.raises(oauth.OAuthError): oauth.load_client(client_file)
    client_file.chmod(0o600)
    raw = json.loads(client_file.read_text());raw['installed']['token_uri'] = 'https://evil.example/token'
    client_file.write_text(json.dumps(raw))
    with pytest.raises(oauth.OAuthError): oauth.load_client(client_file)


@pytest.mark.parametrize('target', ['client', 'tokens'])
def test_private_credential_files_reject_symlinks_and_hardlinks(client_file, token_file, tmp_path, target):
    path = client_file if target == 'client' else token_file
    load = oauth.load_client if target == 'client' else oauth.load_config
    original = path.with_name('original-private.json');path.rename(original);path.symlink_to(original)
    with pytest.raises(oauth.OAuthError): load(path)
    path.unlink();original.rename(path);os.link(path, tmp_path / ('hard-' + target))
    with pytest.raises(oauth.OAuthError): load(path)


def test_saved_tokens_are_private_and_cannot_adopt_repository_or_unrelated_data(token_file, tmp_path):
    data = oauth.load_config(token_file)
    assert stat.S_IMODE(token_file.stat().st_mode) == 0o600
    assert stat.S_IMODE(token_file.parent.stat().st_mode) == 0o700
    with pytest.raises(oauth.OAuthError): oauth.save_config(token_file, data)
    oauth.save_config(token_file, data, replace=True)
    assert not list(token_file.parent.glob('.gmail-oauth-*'))
    unrelated = tmp_path / 'unrelated';unrelated.mkdir(mode=0o700);(unrelated / 'keep.txt').write_text('keep')
    with pytest.raises(oauth.OAuthError): oauth.save_config(unrelated / oauth.TOKEN_FILE, data)
    with pytest.raises(oauth.OAuthError): oauth.save_config(oauth.private.ROOT / 'private' / oauth.TOKEN_FILE, data)


def test_config_cannot_retarget_personal_inbox_or_expand_permissions(token_file):
    data = oauth.load_config(token_file)
    data['personal_email_sha256'] = oauth.private.personal_digest(MAILBOX)
    with pytest.raises(oauth.OAuthError): oauth.validate_config(data)
    data = oauth.load_config(token_file);data['scopes'].append('https://mail.google.com/')
    with pytest.raises(oauth.OAuthError): oauth.validate_config(data)


def test_check_unexpired_token_only_checks_identity_without_gmail(token_file):
    google = Google()
    original = oauth.load_config(token_file)
    result = oauth.check_token(token_file, request=google, now=original['tokens']['expires_at'] - 100)
    assert [url for url, _ in google.calls] == [oauth.IDENTITY_URL]
    assert result['tokens']['refresh_token'] == original['tokens']['refresh_token']


def test_expired_token_refreshes_on_explicit_check_and_rechecks_identity(token_file):
    original = oauth.load_config(token_file)
    refreshed = response(access_token='fixture-new-access');refreshed.pop('scope');refreshed.pop('refresh_token')
    google = Google(token=refreshed)
    result = oauth.check_token(token_file, request=google, now=original['tokens']['expires_at'])
    assert [url for url, _ in google.calls] == [oauth.TOKEN_URL, oauth.IDENTITY_URL]
    assert result['tokens']['access_token'] == 'fixture-new-access'
    assert result['tokens']['refresh_token'] == original['tokens']['refresh_token']
    assert google.calls[0][1]['form']['grant_type'] == 'refresh_token'


def test_check_identity_mismatch_revokes_and_does_not_replace_private_file(token_file):
    original = token_file.read_bytes();google = Google(address=PERSONAL)
    with pytest.raises(oauth.IdentityMismatch): oauth.check_token(token_file, request=google, now=0)
    assert google.calls[-1][0] == oauth.REVOKE_URL
    assert token_file.read_bytes() == original


def test_transient_identity_network_failure_does_not_revoke_saved_grant(token_file):
    calls = []
    def unavailable(url, **kwargs): calls.append(url);raise oauth.OAuthError('Provider unavailable.')
    with pytest.raises(oauth.OAuthError): oauth.check_token(token_file, request=unavailable, now=0)
    assert calls == [oauth.IDENTITY_URL]


def test_http_client_uses_verified_tls_fixed_endpoints_no_redirects_and_bounded_body(monkeypatch):
    captured = {}
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self, size): captured['size'] = size;return b'{"ok":true}'
    class Opener:
        def open(self, request, timeout): captured.update(request=request, timeout=timeout);return Response()
    def opener(*handlers): captured['handlers'] = handlers;return Opener()
    monkeypatch.setattr(oauth, 'build_opener', opener)
    assert oauth.request_json(oauth.IDENTITY_URL, bearer='fixture-access') == {'ok': True}
    assert captured['size'] == oauth.MAX_RESPONSE + 1 and captured['timeout'] == 15
    assert any(isinstance(h, oauth._NoRedirect) for h in captured['handlers'])
    assert captured['request'].get_header('Authorization') == 'Bearer fixture-access'
    with pytest.raises(oauth.OAuthError): oauth.request_json('https://evil.example/token', form={'secret': 'not-sent'})


def test_http_provider_errors_do_not_leak_credentials(monkeypatch):
    class Opener:
        def open(self, *a, **kw): raise oauth.URLError('fixture-access-token private-provider-response')
    monkeypatch.setattr(oauth, 'build_opener', lambda *a: Opener())
    with pytest.raises(oauth.OAuthError) as error: oauth.request_json(oauth.TOKEN_URL, form={'code': 'fixture-code-secret'})
    assert 'fixture-access-token' not in str(error.value) and 'fixture-code-secret' not in str(error.value)


def test_cli_connection_and_check_never_print_codes_or_tokens(client_file, tmp_path, monkeypatch, capsys):
    data, _, _ = connected()
    path = tmp_path / 'removal/gmail-oauth.json'
    monkeypatch.setattr(oauth, 'connect', lambda *a, **kw: data)
    assert oauth.main(['--mailbox', MAILBOX, '--personal-email', PERSONAL, '--client-json', str(client_file), '--config', str(path)]) == 0
    monkeypatch.setattr(oauth, 'check_token', lambda *a: data)
    assert oauth.main(['--check-token', '--config', str(path)]) == 0
    out = capsys.readouterr().out
    for secret in ('fixture-access-token', 'fixture-refresh-token', 'fixture-client-secret', 'fixture-authorization-code'):
        assert secret not in out
    assert 'No Gmail messages were accessed' in out


def test_cli_provider_error_is_generic_and_does_not_write_credentials(client_file, tmp_path, monkeypatch, capsys):
    path = tmp_path / 'removal/gmail-oauth.json'
    def denied(*a, **kw): raise oauth.OAuthError('fixture-access-token private-provider-response')
    monkeypatch.setattr(oauth, 'connect', denied)
    assert oauth.main(['--mailbox', MAILBOX, '--personal-email', PERSONAL, '--client-json', str(client_file), '--config', str(path)]) == 1
    assert not path.exists()
    assert 'fixture-access-token' not in capsys.readouterr().out


def test_standard_downloaded_google_client_legacy_auth_uri_is_accepted(client_file):
    raw = json.loads(client_file.read_text())
    raw['installed']['auth_uri'] = 'https://accounts.google.com/o/oauth2/auth'
    client_file.write_text(json.dumps(raw))
    assert oauth.load_client(client_file) == CLIENT
