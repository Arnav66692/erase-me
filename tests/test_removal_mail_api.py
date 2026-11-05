"""Dedicated receipt API fixtures only. No account, token or live mail is used."""
import base64
from email.message import EmailMessage
import hashlib
import hmac
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import threading
from urllib.error import URLError
from urllib.parse import parse_qs, urlsplit

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('removal_mail_test_api', ROOT / 'preview/api/index.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
mail = api.removal_mail
_REAL_REQUEST_JSON = mail._request_json
NOW = 1800000000
OPERATION = 'a' * 32
PILOT = 'cd' * 32


@pytest.fixture
def connected(monkeypatch):
    values = {'ERASE_DEDICATED_MAILBOX': 'true', 'ERASE_MAIL_RELAY_ENABLED': 'true', 'ERASE_MAIL_PILOT_KEY': PILOT, 'ERASE_REMOVAL_INBOX': 'removals@example.test',
              'ERASE_GMAIL_CLIENT_ID': 'fixture-client', 'ERASE_GMAIL_CLIENT_SECRET': 'fixture-secret',
              'ERASE_GMAIL_REFRESH_TOKEN': 'fixture-refresh', 'ERASE_MAIL_CAPABILITY_SECRET': 'ab' * 32}
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setattr(mail.time, 'time', lambda: NOW)
    def identity_only(url, *, pilot_key=None, **kwargs):
        mail.authorize(pilot_key)
        if url == 'https://oauth2.googleapis.com/token':
            return {'access_token': 'fixture-access'}
        if url == 'https://openidconnect.googleapis.com/v1/userinfo':
            return {'email': 'removals@example.test', 'email_verified': True}
        pytest.fail('Unexpected Gmail message call')
    monkeypatch.setattr(mail, '_request_json', identity_only)
    return values


def issued(route='usphonebook'):
    return mail.session({'route_id': route, 'operation_id': OPERATION, 'authorized': True}, pilot_key=PILOT)


def resign(payload):
    encoded = mail._b64(json.dumps(payload, separators=(',', ':')).encode())
    signature = mail._b64(hmac.new(bytes.fromhex('ab' * 32), encoded.encode(), hashlib.sha256).digest())
    return encoded + '.' + signature


def raw_message(claims, *, sender='privacy@usphonebook.com', recipient=None, auth=None, prose=None, link=None):
    message = EmailMessage()
    message['From'] = sender
    message['To'] = recipient or claims['recipient']
    message['Subject'] = 'Confirm your removal request'
    message['Authentication-Results'] = auth or 'mx.google.com; dmarc=pass header.from=usphonebook.com; dkim=pass header.d=usphonebook.com'
    message.set_content((prose or 'Please verify your opt-out removal request.') + '\n' +
                        (link or 'https://www.usphonebook.com/confirm/private-fixture-token'))
    return message.as_bytes()


def google_fixture(monkeypatch, claims, messages=None, *, identity='removals@example.test'):
    calls = []
    raw = messages if messages is not None else [raw_message(claims)]
    def request(url, *, access_token=None, form=None, deadline=None, pilot_key=None):
        mail.authorize(pilot_key)
        calls.append((url, form))
        if url == 'https://oauth2.googleapis.com/token':
            assert form['grant_type'] == 'refresh_token'
            return {'access_token': 'fixture-access'}
        if url == 'https://openidconnect.googleapis.com/v1/userinfo':
            assert access_token == 'fixture-access'
            return {'email': identity, 'email_verified': True}
        if '/messages?' in url:
            q = parse_qs(urlsplit(url).query)
            assert q == {'q': ['to:' + claims['recipient'] + ' after:' + str(NOW)], 'maxResults': ['10']}
            return {'messages': [{'id': 'message' + str(i)} for i in range(len(raw))]}
        if '/messages/message' in url:
            i = int(urlsplit(url).path.rsplit('message', 1)[1])
            return {'raw': mail._b64(raw[i]), 'sizeEstimate': len(raw[i]), 'internalDate': str((NOW + 1) * 1000)}
        pytest.fail('Unapproved provider endpoint')
    monkeypatch.setattr(mail, '_request_json', request)
    return calls


def test_no_configuration_disables_service_without_provider_access(monkeypatch):
    for key in mail.REQUIRED:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.delenv('ERASE_DEDICATED_MAILBOX', raising=False)
    assert mail.status() == {'configured': False, 'enabled': False, 'provider': 'gmail', 'on_demand': True, 'access': 'private_pilot', 'authorization_required': True, 'automatic_execution': False}
    with pytest.raises(mail.MailError) as error:
        issued()
    assert error.value.status == 503


def test_dedicated_attestation_and_valid_private_secret_are_required(connected, monkeypatch):
    monkeypatch.setenv('ERASE_DEDICATED_MAILBOX', 'false')
    assert not mail.configured()
    monkeypatch.setenv('ERASE_DEDICATED_MAILBOX', 'true')
    monkeypatch.setenv('ERASE_MAIL_CAPABILITY_SECRET', 'short')
    assert not mail.configured()


def test_session_binds_random_alias_route_operation_and_expiry(connected):
    result = issued()
    claims = mail.verify_capability(result['capability'])
    assert claims['route_id'] == 'usphonebook' and claims['operation_id'] == OPERATION
    assert result['contact_email'] == 'removals+erase-' + result['request_id'] + '@example.test'
    assert len(result['request_id']) == 32 and claims['expires_at'] == NOW + mail.CAPABILITY_LIFETIME
    assert result['capability'] != issued()['capability']
    for secret in ('fixture-secret', 'fixture-refresh', 'abababab'):
        assert secret not in json.dumps(result)


@pytest.mark.parametrize('route', ['peopledatalabs-form', 'apollo', 'spokeo', 'evil'])
def test_record_email_or_unreviewed_routes_cannot_substitute_contact_mailbox(connected, route):
    with pytest.raises(mail.MailError) as error:
        issued(route)
    assert error.value.status == 400


@pytest.mark.parametrize('body', [
    {'route_id': 'usphonebook', 'operation_id': OPERATION, 'authorized': False},
    {'route_id': 'usphonebook', 'operation_id': OPERATION, 'authorized': True, 'email': 'person@example.test'},
    {'route_id': 'usphonebook', 'operation_id': 'bad', 'authorized': True},
    {'route_id': 'usphonebook', 'authorized': True},
])
def test_session_rejects_extra_profile_fields_missing_consent_and_invalid_operation(connected, body):
    with pytest.raises(mail.MailError):
        mail.session(body, pilot_key=PILOT)


@pytest.mark.parametrize('field,value', [('route_id', 'fastpeoplesearch'), ('operation_id', 'b' * 32),
                                        ('recipient', 'somebody@example.test'), ('request_id', 'b' * 32)])
def test_capability_cannot_be_changed_for_another_route_operation_or_recipient(connected, field, value):
    result = issued()
    encoded, signature = result['capability'].split('.')
    claims = json.loads(mail._unb64(encoded, 1800))
    claims[field] = value
    forged = mail._b64(json.dumps(claims).encode()) + '.' + signature
    with pytest.raises(mail.MailError) as error:
        mail.verify_capability(forged)
    assert error.value.status == 403


def test_signed_but_inconsistent_alias_or_route_is_rejected(connected):
    claims = mail.verify_capability(issued()['capability'])
    claims['recipient'] = 'removals+erase-' + 'f' * 32 + '@example.test'
    with pytest.raises(mail.MailError):
        mail.verify_capability(resign(claims))
    claims['recipient'] = mail._recipient(claims['request_id'])
    claims['route_id'] = 'apollo'
    with pytest.raises(mail.MailError):
        mail.verify_capability(resign(claims))


def test_expired_and_future_capabilities_cannot_open_the_mailbox(connected):
    result = issued()
    with pytest.raises(mail.MailError) as error:
        mail.verify_capability(result['capability'], now=NOW + mail.CAPABILITY_LIFETIME)
    assert error.value.status == 410
    with pytest.raises(mail.MailError):
        mail.verify_capability(result['capability'], now=NOW - 61)


def test_explicit_check_and_no_extra_fields_are_required(connected):
    for body in ({'capability': issued()['capability']},
                 {'capability': issued()['capability'], 'explicit': True, 'route_id': 'usphonebook'}):
        with pytest.raises(mail.MailError):
            mail.check(body, pilot_key=PILOT)


def test_wrong_connected_account_stops_before_any_gmail_message_request(connected, monkeypatch):
    result = issued(); claims = mail.verify_capability(result['capability'])
    calls = google_fixture(monkeypatch, claims, identity='personal@example.test')
    with pytest.raises(mail.MailError) as error:
        mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    assert 'No messages were read' in str(error.value)
    assert len(calls) == 2 and not any('gmail.googleapis' in url for url, _ in calls)


def test_no_matching_mail_is_pending_without_fabricating_acceptance(connected, monkeypatch):
    result = issued(); claims = mail.verify_capability(result['capability'])
    google_fixture(monkeypatch, claims, [])
    answer = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    assert answer['status'] == 'pending' and answer['operation_id'] == OPERATION
    assert 'confirmation_url' not in answer and answer['automatic_execution'] is False


def test_authenticated_correlated_message_is_held_until_route_contract_exists(connected, monkeypatch):
    result = issued(); claims = mail.verify_capability(result['capability'])
    google_fixture(monkeypatch, claims)
    answer = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    assert answer['status'] == 'held' and answer['reason'] == 'route_validation_required'
    assert answer['authenticated'] is True and len(answer['receipt_ref']) == 64
    assert answer['operation_id'] == OPERATION and answer['automatic_execution'] is False
    encoded = json.dumps(answer)
    for private in ('privacy@', 'private-fixture-token', 'Authentication-Results', 'fixture-access', 'Confirm your removal'):
        assert private not in encoded
    assert not mail.CONFIRMATION_CONTRACTS


@pytest.mark.parametrize('change', ['recipient', 'from', 'authentication', 'forged_header', 'old', 'future', 'unrelated', 'large'])
def test_unrelated_unauthenticated_stale_and_oversize_mail_cannot_establish_receipt(connected, change):
    claims = mail.verify_capability(issued()['capability'])
    kwargs, arrival = {}, (NOW + 1) * 1000
    if change == 'recipient': kwargs['recipient'] = 'removals+erase-' + 'b' * 32 + '@example.test'
    elif change == 'from': kwargs['sender'] = 'privacy@usphonebook.com.evil.test'
    elif change == 'authentication': kwargs['auth'] = 'mx.google.com; dmarc=fail header.from=usphonebook.com; dkim=pass header.d=usphonebook.com'
    elif change == 'forged_header': kwargs['auth'] = 'attacker.example; dmarc=pass header.from=usphonebook.com; dkim=pass header.d=usphonebook.com'
    elif change == 'old': arrival = (NOW - 1) * 1000
    elif change == 'future': arrival = (NOW + 301) * 1000
    raw = raw_message(claims, **kwargs)
    if change == 'unrelated':
        msg = EmailMessage(); msg['From'] = 'privacy@usphonebook.com'; msg['To'] = claims['recipient']; msg.set_content('Unrelated account news'); raw = msg.as_bytes()
    if change == 'large': raw = b'x' * (mail.MAX_BYTES + 1)
    assert mail._receipt(raw, arrival, claims) is None


def test_gmail_header_i_alignment_is_supported_and_multiple_dmarc_results_are_not(connected):
    claims = mail.verify_capability(issued()['capability'])
    auth = 'mx.google.com; dmarc=pass header.from=usphonebook.com; dkim=pass header.i=@usphonebook.com'
    assert mail._receipt(raw_message(claims, auth=auth), (NOW + 1) * 1000, claims)['status'] == 'held'
    auth += '; dmarc=fail header.from=usphonebook.com'
    assert mail._receipt(raw_message(claims, auth=auth), (NOW + 1) * 1000, claims) is None


@pytest.mark.parametrize('url', ['https://evil.test/confirm/token', 'https://www.usphonebook.com/login',
                                 'https://www.usphonebook.com/export', 'https://www.usphonebook.com/confirm?next=https://evil.test'])
def test_no_link_is_returned_or_followed_even_with_a_trusted_sender(connected, monkeypatch, url):
    result = issued(); claims = mail.verify_capability(result['capability'])
    google_fixture(monkeypatch, claims, [raw_message(claims, link=url)])
    answer = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    assert answer['status'] == 'held' and 'confirmation_url' not in answer
    assert url not in json.dumps(answer)


def test_message_reads_are_bounded_even_if_provider_returns_too_many(connected, monkeypatch):
    result = issued(); claims = mail.verify_capability(result['capability'])
    calls = google_fixture(monkeypatch, claims, [raw_message(claims, sender='other@evil.test')] * 30)
    assert mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)['status'] == 'pending'
    assert sum('/messages/message' in url for url, _ in calls) == 10


def test_provider_error_does_not_reveal_credentials_or_urls(connected, monkeypatch):
    monkeypatch.setattr(mail, '_request_json', _REAL_REQUEST_JSON)
    monkeypatch.setattr(mail, '_open', lambda *args, **kwargs: (_ for _ in ()).throw(URLError('private token fixture-secret')))
    with pytest.raises(mail.MailError) as error:
        mail._request_json('https://oauth2.googleapis.com/token', form={'refresh_token': 'fixture-secret'}, pilot_key=PILOT)
    assert 'fixture-secret' not in str(error.value) and 'https://' not in str(error.value)


@pytest.fixture
def http_client():
    server = ThreadingHTTPServer(('127.0.0.1', 0), api.handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    def request(path, body=None, *, origin=api.APP_ORIGIN, marker='1', raw=None, method='POST', pilot_key=PILOT):
        connection = HTTPConnection(*server.server_address)
        headers = {'Content-Type': 'application/json', 'X-Erase-Me': marker}
        if origin is not None: headers['Origin'] = origin
        if pilot_key is not None: headers['X-Erase-Mail-Key'] = pilot_key
        connection.request(method, path, body=raw if raw is not None else json.dumps(body or {}), headers=headers)
        response = connection.getresponse(); data = json.loads(response.read()); result = response.status, data
        connection.close(); return result
    yield request
    server.shutdown(); server.server_close(); thread.join()


def test_http_origin_header_and_strict_shape_are_required(connected, http_client):
    body = {'route_id': 'usphonebook', 'operation_id': OPERATION, 'authorized': True}
    for origin in (None, 'https://evil.example'):
        assert http_client('/api/removal-mail/session', body, origin=origin)[0] == 403
    assert http_client('/api/removal-mail/session', body, marker='no')[0] == 403
    assert http_client('/api/removal-mail/session', raw='{"route_id":"usphonebook","route_id":"apollo"}')[0] == 400
    assert http_client('/api/removal-mail/session', {**body, 'email': 'private@example.test'})[0] == 400
    code, answer = http_client('/api/removal-mail/session', body)
    assert code == 200 and answer['operation_id'] == OPERATION


def test_http_offline_status_and_profile_writes_stay_private(monkeypatch, http_client):
    monkeypatch.delenv('ERASE_DEDICATED_MAILBOX', raising=False)
    code, answer = http_client('/api/removal-mail/status', method='GET')
    assert code == 200 and answer['configured'] is False
    assert http_client('/api/removal-mail/session', {'route_id': 'usphonebook', 'operation_id': OPERATION, 'authorized': True})[0] == 503
    code, answer = http_client('/api/signup', {'email': 'private@example.test'})
    assert code == 405 and 'private@example.test' not in json.dumps(answer)


def test_http_internal_failures_are_generic(connected, monkeypatch, http_client):
    monkeypatch.setattr(mail, 'check', lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError('fixture-refresh secret')))
    code, body = http_client('/api/removal-mail/check', {'capability': 'a', 'explicit': True})
    assert code == 503 and 'fixture-refresh' not in json.dumps(body)


@pytest.mark.parametrize('key', [None, '', 'ef' * 32, 'invalid'])
def test_no_private_key_cannot_issue_sessions_or_read_google(connected, key):
    body = {'route_id': 'usphonebook', 'operation_id': OPERATION, 'authorized': True}
    with pytest.raises(mail.MailError) as error:
        mail.session(body, pilot_key=key)
    assert error.value.status == 403
    with pytest.raises(mail.MailError) as error:
        mail.check({'capability': issued()['capability'], 'explicit': True}, pilot_key=key)
    assert error.value.status == 403


def test_ready_credentials_do_not_enable_anonymous_or_private_mail_operations(connected, monkeypatch):
    monkeypatch.delenv('ERASE_MAIL_RELAY_ENABLED', raising=False)
    assert mail.status()['configured'] is True and mail.status()['enabled'] is False
    with pytest.raises(mail.MailError) as error:
        issued()
    assert error.value.status == 503
    monkeypatch.setenv('ERASE_MAIL_RELAY_ENABLED', 'TRUE')
    assert mail.status()['enabled'] is False
    monkeypatch.setenv('ERASE_MAIL_RELAY_ENABLED', 'true')
    monkeypatch.setenv('ERASE_MAIL_PILOT_KEY', 'short')
    assert mail.status()['enabled'] is False


def test_http_private_header_is_required_and_never_replaced_by_query_or_body(connected, http_client):
    body = {'route_id': 'usphonebook', 'operation_id': OPERATION, 'authorized': True}
    assert http_client('/api/removal-mail/session', body, pilot_key=None)[0] == 403
    assert http_client('/api/removal-mail/session', body, pilot_key='ef' * 32)[0] == 403
    assert http_client('/api/removal-mail/session?pilot_key=' + PILOT, body, pilot_key=None)[0] == 403
    assert http_client('/api/removal-mail/session', {**body, 'pilot_key': PILOT}, pilot_key=None)[0] == 403
    assert http_client('/api/removal-mail/session', {**body, 'pilot_key': PILOT})[0] == 400
    session = issued()
    assert http_client('/api/removal-mail/check', {'capability': session['capability'], 'explicit': True}, pilot_key=None)[0] == 403
    code, result = http_client('/api/removal-mail/status', method='GET', pilot_key=None)
    assert code == 200 and result['access'] == 'private_pilot' and result['authorization_required'] is True
    assert PILOT not in json.dumps(result) and connected['ERASE_GMAIL_CLIENT_SECRET'] not in json.dumps(result)


@pytest.mark.parametrize('stop_after', [1, 2, 3])
def test_private_enable_gate_is_rechecked_before_each_google_request(connected, monkeypatch, stop_after):
    session = issued(); calls = []
    monkeypatch.setattr(mail, '_request_json', _REAL_REQUEST_JSON)
    class Response:
        def __init__(self, url): self.url = url
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def geturl(self): return self.url
        def read(self, maximum):
            if self.url.endswith('/token'): result = {'access_token': 'fixture-access'}
            elif self.url.endswith('/userinfo'): result = {'email': 'removals@example.test', 'email_verified': True}
            elif '/messages?' in self.url: result = {'messages': [{'id': 'fixture-message'}]}
            else: pytest.fail('A revoked pilot must not fetch a raw message')
            if len(calls) == stop_after: monkeypatch.setenv('ERASE_MAIL_RELAY_ENABLED', 'false')
            return json.dumps(result).encode()
    def open_request(request, timeout):
        calls.append(request.full_url)
        return Response(request.full_url)
    monkeypatch.setattr(mail, '_open', open_request)
    with pytest.raises(mail.MailError) as error:
        mail.check({'capability': session['capability'], 'explicit': True}, pilot_key=PILOT)
    assert error.value.status == 503 and len(calls) == stop_after


def test_low_level_google_requests_also_require_private_authorization(connected, monkeypatch):
    monkeypatch.setattr(mail, '_open', lambda *args, **kwargs: pytest.fail('Google called without private authorization'))
    with pytest.raises(mail.MailError) as error:
        _REAL_REQUEST_JSON('https://oauth2.googleapis.com/token', form={'grant_type': 'refresh_token'})
    assert error.value.status == 403



def test_deployment_exposes_only_the_handler_entrypoint_and_bundles_helper_outside_api():
    # Vercel's file-based runtime turns every /api/*.py into a function.
    assert sorted(p.name for p in (ROOT / 'preview/api').glob('*.py')) == ['index.py']
    assert (ROOT / 'preview/lib/__init__.py').is_file()
    assert Path(mail.__file__).resolve() == (ROOT / 'preview/lib/removal_mail.py').resolve()



def test_session_identity_preflight_rejects_wrong_account_before_publishing_alias(connected, monkeypatch):
    calls = google_fixture(monkeypatch, {}, [], identity='personal@example.test')
    monkeypatch.setattr(mail.secrets, 'token_hex', lambda _: pytest.fail('Alias must not be generated for wrong identity'))
    with pytest.raises(mail.MailError) as error:
        mail.session({'route_id': 'usphonebook', 'operation_id': OPERATION, 'authorized': True}, pilot_key=PILOT)
    assert error.value.status == 503
    assert len(calls) == 2 and not any('gmail.googleapis' in url for url, _ in calls)
    assert 'personal@example.test' not in str(error.value)


def test_session_runs_fresh_identity_check_before_issuing_capability(connected, monkeypatch):
    calls = google_fixture(monkeypatch, {}, [])
    result = issued()
    assert result['contact_email'].startswith('removals+erase-')
    assert [url for url, _ in calls] == ['https://oauth2.googleapis.com/token', 'https://openidconnect.googleapis.com/v1/userinfo']
