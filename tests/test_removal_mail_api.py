"""Dedicated receipt API fixtures only. No account, token or live mail is used."""
import base64
from email import message_from_bytes, policy
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
from urllib.parse import parse_qs, urlencode, urlsplit

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
FORM = 'https://www.usphonebook.com/removal/validate-record-info?key=fixtureKey_01%3D%3D&ticketid=12345678'


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


@pytest.mark.parametrize('route', ['usphonebook', 'fastpeoplesearch'])
def test_session_binds_random_alias_route_operation_and_expiry(connected, route):
    result = issued(route)
    claims = mail.verify_capability(result['capability'])
    assert claims['route_id'] == route and claims['operation_id'] == OPERATION
    assert result['contact_email'] == 'removals+erase-' + result['request_id'] + '@example.test'
    assert len(result['request_id']) == 32 and claims['expires_at'] == NOW + mail.CAPABILITY_LIFETIME
    assert result['capability'] != issued(route)['capability']
    for secret in ('fixture-secret', 'fixture-refresh', 'abababab'):
        assert secret not in json.dumps(result)


def test_searchpeoplefree_new_alias_is_rejected_before_google_access(connected, monkeypatch, http_client):
    def unexpected_google(*args, **kwargs):
        pytest.fail('A new SearchPeopleFree contact must be rejected before Google access')
    monkeypatch.setattr(mail, '_request_json', unexpected_google)
    with pytest.raises(mail.MailError) as error:
        issued('searchpeoplefree')
    assert error.value.status == 400
    assert 'typed email' in str(error.value)
    code, answer = http_client('/api/removal-mail/session', {
        'route_id': 'searchpeoplefree', 'operation_id': OPERATION, 'authorized': True})
    assert code == 400 and 'typed email' in answer['error']


def test_existing_searchpeoplefree_capability_can_check_held_receipts_without_continuation(connected, monkeypatch):
    claims = mail.verify_capability(issued()['capability'])
    claims['route_id'] = 'searchpeoplefree'
    legacy_capability = resign(claims)
    assert mail.verify_capability(legacy_capability)['route_id'] == 'searchpeoplefree'
    raw = raw_message(claims, sender='privacy@searchpeoplefree.com',
                      auth='mx.google.com; dmarc=pass header.from=searchpeoplefree.com; dkim=pass header.d=searchpeoplefree.com',
                      link='https://www.searchpeoplefree.com/opt-out/confirm?token=private-fixture-token')
    calls = google_fixture(monkeypatch, claims, [raw])
    result = mail.check({'capability': legacy_capability, 'explicit': True}, pilot_key=PILOT)
    assert result['status'] == 'held' and result['authenticated'] is True
    assert result['continuation_available'] is False and 'confirmation_url' not in result
    provider_calls = len(calls)
    with pytest.raises(mail.MailError) as error:
        mail.continue_confirmation({'capability': legacy_capability, 'explicit': True,
                                    'receipt_ref': result['receipt_ref']}, pilot_key=PILOT)
    assert error.value.status == 409 and len(calls) == provider_calls


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
    assert answer['continuation_available'] is False
    assert set(mail.CONFIRMATION_CONTRACTS) == {'usphonebook', 'fastpeoplesearch'}


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


def test_reviewed_form_is_advertised_without_link_or_navigation_during_check(connected, monkeypatch):
    result = issued(); claims = mail.verify_capability(result['capability'])
    calls = google_fixture(monkeypatch, claims, [raw_message(claims, link=FORM)])
    answer = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    assert answer['status'] == 'held' and answer['continuation_available'] is True
    assert 'confirmation_url' not in answer and 'fixtureKey' not in json.dumps(answer)
    assert all(urlsplit(url).hostname in {'oauth2.googleapis.com', 'openidconnect.googleapis.com', 'gmail.googleapis.com'} for url, _ in calls)


def test_explicit_continuation_rechecks_same_receipt_and_returns_only_reviewed_form(connected, monkeypatch):
    result = issued(); claims = mail.verify_capability(result['capability'])
    calls = google_fixture(monkeypatch, claims, [raw_message(claims, link=FORM)])
    receipt = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    answer = mail.continue_confirmation({'capability': result['capability'], 'explicit': True,
                                         'receipt_ref': receipt['receipt_ref']}, pilot_key=PILOT)
    assert answer == {'status': 'confirmation_ready', 'route_id': 'usphonebook', 'operation_id': OPERATION,
                      'request_id': claims['request_id'], 'receipt_ref': receipt['receipt_ref'],
                      'confirmation_url': FORM, 'automatic_execution': False}
    assert sum('/messages?' in url for url, _ in calls) == 2
    assert sum('/messages/message' in url for url, _ in calls) == 2
    assert all(urlsplit(url).hostname != 'www.usphonebook.com' for url, _ in calls)
    assert all(secret not in json.dumps(answer) for secret in ('fixture-secret', 'fixture-refresh', 'fixture-access', claims['recipient']))


@pytest.mark.parametrize('url', [
    FORM.replace('https:', 'http:'), FORM.replace('www.usphonebook.com', 'usphonebook.com'),
    FORM.replace('www.usphonebook.com', 'www.usphonebook.com.evil.test'),
    FORM.replace('www.usphonebook.com', 'user@www.usphonebook.com'),
    FORM.replace('www.usphonebook.com', '@www.usphonebook.com'),
    FORM.replace('www.usphonebook.com', 'www.usphonebook.com:444'),
    FORM.replace('www.usphonebook.com', 'www.usphonebook.com:'),
    FORM.replace('/removal/', '/login/'), FORM.replace('validate-record-info', 'validate-record-info/'),
    FORM.replace('validate-record-info', '%76alidate-record-info'),
    FORM + '#', FORM + '#fragment', FORM + '&next=https://evil.test',
    FORM + '&key=another', FORM + '&ticketid=1', FORM + '&',
    FORM.replace('fixtureKey_01%3D%3D', ''), FORM.replace('fixtureKey_01%3D%3D', 'x' * 513),
    FORM.replace('fixtureKey_01%3D%3D', '=inside=padding'),
    FORM.replace('fixtureKey_01%3D%3D', 'x%0d%0aHeader'),
    FORM.replace('fixtureKey_01%3D%3D', 'x%252Fother'),
    FORM.replace('12345678', ''), FORM.replace('12345678', '1' * 33), FORM.replace('12345678', 'NaN'),
    FORM.replace('&ticketid=', '&amp;amp;ticketid='),
])
def test_unreviewed_or_ambiguous_link_shapes_never_allow_continuation(connected, monkeypatch, url):
    result = issued(); claims = mail.verify_capability(result['capability'])
    google_fixture(monkeypatch, claims, [raw_message(claims, link=url)])
    receipt = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    assert receipt['status'] == 'held' and receipt['continuation_available'] is False
    with pytest.raises(mail.MailError) as error:
        mail.continue_confirmation({'capability': result['capability'], 'explicit': True,
                                   'receipt_ref': receipt['receipt_ref']}, pilot_key=PILOT)
    assert error.value.status == 409 and 'fixtureKey' not in str(error.value)


def test_html_and_plain_links_decode_entities_once_and_collapse_to_one_destination(connected):
    claims = mail.verify_capability(issued()['capability'])
    msg = message_from_bytes(raw_message(claims, link=FORM.replace('&', '&amp;')), policy=policy.default)
    msg.add_alternative('<p>Verify your removal request.</p><a href="' + FORM.replace('&', '&amp;') + '">Complete form</a>', subtype='html')
    receipt = mail._receipt(msg.as_bytes(), (NOW + 1) * 1000, claims)
    assert receipt['continuation_available'] is True
    # HTMLParser already decodes an attribute once. A second decode must not turn
    # double-encoded query separators into a different accepted request.
    msg = message_from_bytes(raw_message(claims, link=FORM), policy=policy.default)
    msg.add_alternative('<p>Verify your removal request.</p><a href="' + FORM.replace('&', '&amp;amp;') + '">Complete form</a>', subtype='html')
    assert mail._receipt(msg.as_bytes(), (NOW + 1) * 1000, claims)['continuation_available'] is False


def test_plain_prose_wrapper_can_trim_punctuation_but_html_href_is_exact(connected):
    claims = mail.verify_capability(issued()['capability'])
    assert mail._receipt(raw_message(claims, link='(' + FORM + ').'), (NOW + 1) * 1000, claims)['continuation_available'] is True
    msg = message_from_bytes(raw_message(claims, link=FORM), policy=policy.default)
    msg.add_alternative('<p>Verify your removal request.</p><a href="' + FORM.replace('&', '&amp;') + ')">Complete form</a>', subtype='html')
    assert mail._receipt(msg.as_bytes(), (NOW + 1) * 1000, claims)['continuation_available'] is False


def test_conflicting_or_unrecognized_additional_links_hold_the_receipt(connected):
    claims = mail.verify_capability(issued()['capability'])
    for other in (FORM.replace('12345678', '87654321'), 'https://www.usphonebook.com/login', 'https://evil.test/confirm'):
        receipt = mail._receipt(raw_message(claims, link=FORM + '\n' + other), (NOW + 1) * 1000, claims)
        assert receipt['continuation_available'] is False


@pytest.mark.parametrize('extra', ['<a href="' + 'x' * 2049 + '">Oversized</a>',
                                 '<a href>Missing destination</a>',
                                 '<a href="https://evil.test/confirm">Extra</a>' * 21])
def test_ignored_or_excess_html_links_cannot_hide_an_ambiguous_destination(connected, extra):
    claims = mail.verify_capability(issued()['capability'])
    msg = message_from_bytes(raw_message(claims, link=FORM), policy=policy.default)
    msg.add_alternative('<p>Verify your removal request.</p><a href="' + FORM.replace('&', '&amp;') + '">Complete form</a>' + extra, subtype='html')
    assert mail._receipt(msg.as_bytes(), (NOW + 1) * 1000, claims)['continuation_available'] is False


def test_observed_long_padded_key_and_default_https_port_are_supported(connected):
    claims = mail.verify_capability(issued()['capability'])
    url = FORM.replace('fixtureKey_01%3D%3D', 'x' * 418 + '%3D%3D').replace('www.usphonebook.com/', 'www.usphonebook.com:443/')
    assert mail._receipt(raw_message(claims, link=url), (NOW + 1) * 1000, claims)['continuation_available'] is True


def test_receipt_ref_binds_exact_message_contents_and_capability(connected, monkeypatch):
    result = issued(); claims = mail.verify_capability(result['capability'])
    google_fixture(monkeypatch, claims, [raw_message(claims, link=FORM)])
    receipt = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    # Same synthetic Gmail ID with changed authenticated contents cannot inherit
    # a previously checked reference.
    google_fixture(monkeypatch, claims, [raw_message(claims, link=FORM.replace('12345678', '87654321'))])
    with pytest.raises(mail.MailError) as error:
        mail.continue_confirmation({'capability': result['capability'], 'explicit': True,
                                   'receipt_ref': receipt['receipt_ref']}, pilot_key=PILOT)
    assert error.value.status == 409
    other = issued(); other_claims = mail.verify_capability(other['capability'])
    google_fixture(monkeypatch, other_claims, [raw_message(other_claims, link=FORM)])
    with pytest.raises(mail.MailError) as error:
        mail.continue_confirmation({'capability': other['capability'], 'explicit': True,
                                   'receipt_ref': receipt['receipt_ref']}, pilot_key=PILOT)
    assert error.value.status == 409


@pytest.mark.parametrize('body', [
    {}, {'capability': 'fixture', 'explicit': False, 'receipt_ref': 'a' * 64},
    {'capability': 'fixture', 'explicit': True, 'receipt_ref': 'bad'},
    {'capability': 'fixture', 'explicit': True, 'receipt_ref': 'a' * 64, 'confirmation_url': FORM},
])
def test_continuation_shape_is_strict_before_any_mail_read(connected, monkeypatch, body):
    monkeypatch.setattr(mail, '_request_json', lambda *args, **kwargs: pytest.fail('Invalid continuation must not read mail'))
    with pytest.raises(mail.MailError) as error:
        mail.continue_confirmation(body, pilot_key=PILOT)
    assert error.value.status == 400


def test_continuation_requires_pilot_authorization_and_supported_route(connected, monkeypatch):
    claims = mail.verify_capability(issued()['capability'])
    claims['route_id'] = 'searchpeoplefree'
    body = {'capability': resign(claims), 'explicit': True, 'receipt_ref': 'a' * 64}
    monkeypatch.setattr(mail, '_request_json', lambda *args, **kwargs: pytest.fail('Unsupported continuation must not read mail'))
    for key in (None, 'ef' * 32):
        with pytest.raises(mail.MailError) as error:
            mail.continue_confirmation(body, pilot_key=key)
        assert error.value.status == 403
    with pytest.raises(mail.MailError) as error:
        mail.continue_confirmation(body, pilot_key=PILOT)
    assert error.value.status == 409


def test_http_continuation_enforces_origin_key_shape_and_checked_receipt(connected, monkeypatch, http_client):
    result = issued(); claims = mail.verify_capability(result['capability'])
    google_fixture(monkeypatch, claims, [raw_message(claims, link=FORM)])
    receipt = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    body = {'capability': result['capability'], 'explicit': True, 'receipt_ref': receipt['receipt_ref']}
    path = '/api/removal-mail/continue'
    assert http_client(path, body, origin='https://evil.test')[0] == 403
    assert http_client(path, body, pilot_key=None)[0] == 403
    assert http_client(path, {**body, 'email': 'person@example.test'})[0] == 400
    assert http_client(path, {**body, 'receipt_ref': 'a' * 64})[0] == 409
    code, answer = http_client(path, body)
    assert code == 200 and answer['status'] == 'confirmation_ready' and answer['confirmation_url'] == FORM


def fps_form(claims, **changes):
    fields = {'firstname': 'Example', 'middlename': '', 'lastname': 'Person',
              'email': claims['recipient'], 'ticketid': '12345678'}
    fields.update(changes)
    return 'https://www.fastpeoplesearch.com/optout/removal?' + urlencode(fields)


def fps_message(claims, **changes):
    return raw_message(claims, sender='privacy@fastpeoplesearch.com',
                       auth='mx.google.com; dmarc=pass header.from=fastpeoplesearch.com; dkim=pass header.d=fastpeoplesearch.com',
                       link=changes.pop('link', fps_form(claims)), **changes)


def test_fastpeoplesearch_check_hides_fields_and_explicit_continuation_reauthenticates_exact_receipt(connected, monkeypatch):
    result = issued('fastpeoplesearch'); claims = mail.verify_capability(result['capability'])
    calls = google_fixture(monkeypatch, claims, [fps_message(claims)])
    receipt = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    assert receipt['status'] == 'held' and receipt['authenticated'] is True
    assert receipt['continuation_available'] is True and receipt['route_id'] == 'fastpeoplesearch'
    for private in ('Example', 'Person', claims['recipient'], 'ticketid', '12345678', 'confirmation_url'):
        assert private not in json.dumps(receipt)
    response = mail.continue_confirmation({'capability': result['capability'], 'explicit': True,
                                          'receipt_ref': receipt['receipt_ref']}, pilot_key=PILOT)
    assert response['status'] == 'confirmation_ready' and response['route_id'] == 'fastpeoplesearch'
    assert response['operation_id'] == OPERATION and response['request_id'] == claims['request_id']
    assert response['receipt_ref'] == receipt['receipt_ref'] and response['automatic_execution'] is False
    query = parse_qs(urlsplit(response['confirmation_url']).query, keep_blank_values=True)
    assert query == {'firstname': ['Example'], 'middlename': [''], 'lastname': ['Person'],
                     'email': [claims['recipient']], 'ticketid': ['12345678']}
    assert '%2B' in response['confirmation_url']
    assert sum('/messages?' in url for url, _ in calls) == 2
    assert sum('/messages/message' in url for url, _ in calls) == 2
    assert all(urlsplit(url).hostname in {'oauth2.googleapis.com', 'openidconnect.googleapis.com', 'gmail.googleapis.com'} for url, _ in calls)


def test_fastpeoplesearch_html_and_plain_entities_decode_once_to_the_same_bound_destination(connected):
    claims = mail.verify_capability(issued('fastpeoplesearch')['capability'])
    url = fps_form(claims)
    message = message_from_bytes(fps_message(claims, link=url.replace('&', '&amp;')), policy=policy.default)
    message.add_alternative('<p>Verify your removal request.</p><a href="' + url.replace('&', '&amp;') + '">Complete form</a>', subtype='html')
    receipt = mail._receipt(message.as_bytes(), (NOW + 1) * 1000, claims)
    assert receipt['continuation_available'] is True
    message = message_from_bytes(fps_message(claims), policy=policy.default)
    message.add_alternative('<p>Verify your removal request.</p><a href="' + url.replace('&', '&amp;amp;') + '">Complete form</a>', subtype='html')
    assert mail._receipt(message.as_bytes(), (NOW + 1) * 1000, claims)['continuation_available'] is False


@pytest.mark.parametrize('change', [
    {'firstname': ''}, {'lastname': ''}, {'firstname': ' Example'}, {'lastname': 'Person '},
    {'firstname': 'x' * 121}, {'lastname': 'x' * 121}, {'firstname': 'Ex\x00ample'},
    {'lastname': 'Per\x1fson'}, {'firstname': 'Exam\x7fple'}, {'lastname': 'Per\r\nson'},
    {'firstname': '<Example>'}, {'lastname': 'Person>'}, {'middlename': 'Middle'},
    {'email': 'other@example.test'}, {'email': ''}, {'ticketid': ''},
    {'ticketid': '1' * 33}, {'ticketid': 'NaN'}, {'ticketid': '１２３'},
])
def test_fastpeoplesearch_invalid_identity_fields_recipient_and_ticket_stay_held(connected, change):
    claims = mail.verify_capability(issued('fastpeoplesearch')['capability'])
    receipt = mail._receipt(fps_message(claims, link=fps_form(claims, **change)), (NOW + 1) * 1000, claims)
    assert receipt['status'] == 'held' and receipt['authenticated'] is True
    assert receipt['continuation_available'] is False


@pytest.mark.parametrize('change', [
    'http', 'bare_host', 'foreign_host', 'credentials', 'empty_credentials', 'port', 'empty_port',
    'login', 'trailing_path', 'encoded_path', 'fragment', 'empty_fragment', 'backslash',
    'extra', 'duplicate_firstname', 'duplicate_middle', 'duplicate_ticket', 'missing_middle',
    'trailing_separator', 'double_entities', 'unencoded_plus', 'bare_percent', 'invalid_percent', 'short_percent',
])
def test_fastpeoplesearch_ambiguous_or_unreviewed_link_shapes_cannot_continue(connected, monkeypatch, change):
    result = issued('fastpeoplesearch'); claims = mail.verify_capability(result['capability'])
    url = fps_form(claims)
    transformations = {
        'http': lambda value: value.replace('https:', 'http:'),
        'bare_host': lambda value: value.replace('www.fastpeoplesearch.com', 'fastpeoplesearch.com'),
        'foreign_host': lambda value: value.replace('www.fastpeoplesearch.com', 'www.fastpeoplesearch.com.evil.test'),
        'credentials': lambda value: value.replace('www.fastpeoplesearch.com', 'user@www.fastpeoplesearch.com'),
        'empty_credentials': lambda value: value.replace('www.fastpeoplesearch.com', '@www.fastpeoplesearch.com'),
        'port': lambda value: value.replace('www.fastpeoplesearch.com', 'www.fastpeoplesearch.com:444'),
        'empty_port': lambda value: value.replace('www.fastpeoplesearch.com', 'www.fastpeoplesearch.com:'),
        'login': lambda value: value.replace('/optout/removal', '/login'),
        'trailing_path': lambda value: value.replace('/optout/removal', '/optout/removal/'),
        'encoded_path': lambda value: value.replace('/optout/removal', '/optout/%72emoval'),
        'fragment': lambda value: value + '#fragment', 'empty_fragment': lambda value: value + '#',
        'backslash': lambda value: value.replace('/optout/removal', '/optout\\removal'),
        'extra': lambda value: value + '&next=https://evil.test',
        'duplicate_firstname': lambda value: value + '&firstname=Other',
        'duplicate_middle': lambda value: value + '&middlename=',
        'duplicate_ticket': lambda value: value + '&ticketid=2',
        'missing_middle': lambda value: value.replace('&middlename=', ''),
        'trailing_separator': lambda value: value + '&',
        'double_entities': lambda value: value.replace('&', '&amp;amp;'),
        'unencoded_plus': lambda value: value.replace('%2B', '+'),
        'bare_percent': lambda value: value.replace('firstname=Example', 'firstname=Example%'),
        'invalid_percent': lambda value: value.replace('firstname=Example', 'firstname=Example%G0'),
        'short_percent': lambda value: value.replace('firstname=Example', 'firstname=Example%0'),
    }
    url = transformations[change](url)
    google_fixture(monkeypatch, claims, [fps_message(claims, link=url)])
    receipt = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    assert receipt['status'] == 'held' and receipt['continuation_available'] is False
    with pytest.raises(mail.MailError) as error:
        mail.continue_confirmation({'capability': result['capability'], 'explicit': True,
                                   'receipt_ref': receipt['receipt_ref']}, pilot_key=PILOT)
    assert error.value.status == 409


def test_fastpeoplesearch_must_have_bound_recipient_even_for_a_structurally_valid_destination(connected):
    claims = mail.verify_capability(issued('fastpeoplesearch')['capability'])
    url = fps_form(claims)
    assert mail._continuation_url([url], 'fastpeoplesearch') is None
    assert mail._continuation_url([url], 'fastpeoplesearch', recipient='other@example.test') is None
    assert mail._continuation_url([url], 'fastpeoplesearch', recipient=claims['recipient']) is not None
    wrong_case = fps_form(claims, email=claims['recipient'].upper())
    assert mail._continuation_url([wrong_case], 'fastpeoplesearch', recipient=claims['recipient']) is None


def test_fastpeoplesearch_unicode_names_are_preserved_and_default_https_port_is_canonicalized(connected):
    claims = mail.verify_capability(issued('fastpeoplesearch')['capability'])
    url = fps_form(claims, firstname='Örnek', lastname='Örnek Kişi').replace('www.fastpeoplesearch.com/', 'www.fastpeoplesearch.com:443/')
    result = mail._continuation_url([url], 'fastpeoplesearch', recipient=claims['recipient'])
    assert urlsplit(result).netloc == 'www.fastpeoplesearch.com'
    fields = parse_qs(urlsplit(result).query, keep_blank_values=True)
    assert fields['firstname'] == ['Örnek'] and fields['lastname'] == ['Örnek Kişi']


def test_fastpeoplesearch_unrelated_extra_links_and_conflicting_destinations_hold_the_receipt(connected):
    claims = mail.verify_capability(issued('fastpeoplesearch')['capability'])
    for other in (fps_form(claims, firstname='Other'), fps_form(claims, ticketid='87654321'),
                  'https://www.fastpeoplesearch.com/login', 'https://www.fastpeoplesearch.com/export',
                  'https://evil.test/confirmation'):
        receipt = mail._receipt(fps_message(claims, link=fps_form(claims) + '\n' + other), (NOW + 1) * 1000, claims)
        assert receipt['continuation_available'] is False


def test_fastpeoplesearch_requires_its_own_sender_provenance_and_matching_recipient(connected):
    claims = mail.verify_capability(issued('fastpeoplesearch')['capability'])
    for raw in (raw_message(claims, link=fps_form(claims)),
                fps_message(claims, recipient='other@example.test'),
                raw_message(claims, sender='privacy@fastpeoplesearch.com', link=fps_form(claims))):
        assert mail._receipt(raw, (NOW + 1) * 1000, claims) is None


def test_fastpeoplesearch_reference_cannot_release_changed_mail_or_another_operation(connected, monkeypatch):
    result = issued('fastpeoplesearch'); claims = mail.verify_capability(result['capability'])
    google_fixture(monkeypatch, claims, [fps_message(claims)])
    receipt = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    google_fixture(monkeypatch, claims, [fps_message(claims, link=fps_form(claims, ticketid='87654321'))])
    with pytest.raises(mail.MailError) as error:
        mail.continue_confirmation({'capability': result['capability'], 'explicit': True,
                                   'receipt_ref': receipt['receipt_ref']}, pilot_key=PILOT)
    assert error.value.status == 409
    other = issued('fastpeoplesearch'); other_claims = mail.verify_capability(other['capability'])
    google_fixture(monkeypatch, other_claims, [fps_message(other_claims)])
    with pytest.raises(mail.MailError) as error:
        mail.continue_confirmation({'capability': other['capability'], 'explicit': True,
                                   'receipt_ref': receipt['receipt_ref']}, pilot_key=PILOT)
    assert error.value.status == 409


def test_fastpeoplesearch_http_continuation_retains_origin_private_key_and_response_boundaries(connected, monkeypatch, http_client):
    result = issued('fastpeoplesearch'); claims = mail.verify_capability(result['capability'])
    google_fixture(monkeypatch, claims, [fps_message(claims)])
    receipt = mail.check({'capability': result['capability'], 'explicit': True}, pilot_key=PILOT)
    body = {'capability': result['capability'], 'explicit': True, 'receipt_ref': receipt['receipt_ref']}
    path = '/api/removal-mail/continue'
    assert http_client(path, body, origin='https://evil.test')[0] == 403
    assert http_client(path, body, pilot_key=None)[0] == 403
    assert http_client(path, {**body, 'email': claims['recipient']})[0] == 400
    status, response = http_client(path, body)
    assert status == 200 and response['route_id'] == 'fastpeoplesearch'
    assert response['status'] == 'confirmation_ready' and response['automatic_execution'] is False
