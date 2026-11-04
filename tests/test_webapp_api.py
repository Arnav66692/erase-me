"""Web flows using a throwaway database and loopback-only HTTP server."""
from __future__ import annotations

import http.client
import json
import os
import stat
import sys
import threading
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from webapp import auth, store
from webapp.server import create_server


class Client:
    def __init__(self, server):
        self.server = server
        self.cookie = ''

    def request(self, path, body=None, method=None, headers=None):
        method = method or ('POST' if body is not None else 'GET')
        port = self.server.server_port
        fields = {'Host': f'127.0.0.1:{port}', 'Origin': f'http://127.0.0.1:{port}',
                  'Content-Type': 'application/json', 'X-Erase-Me': '1'}
        if self.cookie:
            fields['Cookie'] = self.cookie
        fields.update(headers or {})
        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
        connection.request(method, path, json.dumps(body) if body is not None else None, fields)
        response = connection.getresponse()
        data = response.read()
        cookie = response.getheader('Set-Cookie')
        if cookie:
            self.cookie = cookie.split(';')[0]
        response_headers = dict(response.getheaders())
        connection.close()
        try:
            data = json.loads(data)
        except (ValueError, UnicodeError):
            pass
        return response.status, data, response_headers

    def signup(self, email='jane@example.com'):
        return self.request('/api/signup', {'name': 'Jane Example', 'age': 35, 'email': email, 'authorized': True})

    def login(self, email='jane@example.com'):
        status, data, _ = self.signup(email)
        assert status == 200, data
        status, data, headers = self.request('/api/verify', {'email': email, 'code': data['demo_code'], 'challenge_id': data['challenge_id']})
        assert status == 200, data
        return headers


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.delenv('ERASE_WEB_ORIGIN', raising=False)
    server = create_server(port=0, demo=True, data_dir=tmp_path / 'web')
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield Client(server)
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


def test_full_signup_and_private_dashboard(app):
    status, config, _ = app.request('/api/config')
    assert status == 200 and config['mode'] == 'demo'
    assert config['authorization_statement']
    assert app.request('/api/dashboard')[0] == 401
    headers = app.login()
    assert 'HttpOnly' in headers['Set-Cookie'] and 'SameSite=Strict' in headers['Set-Cookie']
    status, dashboard, _ = app.request('/api/dashboard')
    assert status == 200
    assert dashboard['profile']['name'] == 'Jane Example'
    assert dashboard['campaign']['authorized_at']
    assert dashboard['counts'] == {'found': 0, 'requested': 0, 'removed': 0, 'blocked': 0}
    assert app.request('/api/logout', {})[0] == 200
    assert app.request('/api/dashboard')[0] == 401


@pytest.mark.parametrize('change', [
    {'name': ''}, {'name': 'Jane\nBCC: bad'}, {'email': 'invalid'}, {'age': 17},
    {'age': True}, {'age': 130}, {'age': '35'}, {'authorized': False}, {'authorized': 'yes'},
])
def test_invalid_signup_is_rejected(app, change):
    body = {'name': 'Jane Example', 'email': 'jane@example.com', 'age': 35, 'authorized': True, **change}
    assert app.request('/api/signup', body)[0] == 400
    with store.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0


def test_codes_not_stored_plaintext_and_one_use(app):
    _, response, _ = app.signup()
    code = response['demo_code']
    with store.connect() as db:
        row = dict(db.execute('SELECT * FROM challenges').fetchone())
        assert code not in row.values()
        assert db.execute('SELECT verified FROM users').fetchone()[0] == 0
    assert app.request('/api/verify', {'email': 'jane@example.com', 'code': code, 'challenge_id': response['challenge_id']})[0] == 200
    assert app.request('/api/verify', {'email': 'jane@example.com', 'code': code, 'challenge_id': response['challenge_id']})[0] == 401


def test_preregistered_profile_is_replaced_only_by_verified_signup(app):
    body = {'name': 'Wrong Person', 'age': 70, 'email': 'owner@example.com', 'authorized': True}
    assert app.request('/api/signup', body)[0] == 200
    with store.connect() as db:
        db.execute('UPDATE challenges SET created=0')
    body.update(name='Correct Person', age=35)
    status, response, _ = app.request('/api/signup', body)
    assert status == 200
    assert app.request('/api/verify', {'email': body['email'], 'code': response['demo_code'],
                                      'challenge_id': response['challenge_id']})[0] == 200
    profile = app.request('/api/dashboard')[1]['profile']
    assert (profile['name'], profile['age']) == ('Correct Person', 35)


def test_login_cannot_activate_unverified_preregistration(app):
    _, signup, _ = app.signup()
    with store.connect() as db:
        db.execute('UPDATE challenges SET created=0')
    status, login, _ = app.request('/api/login', {'email': 'jane@example.com'})
    assert status == 200 and 'demo_code' not in login
    assert app.request('/api/verify', {'email': 'jane@example.com', 'code': signup['demo_code'],
                                      'challenge_id': login['challenge_id']})[0] == 401
    with store.connect() as db:
        assert db.execute('SELECT verified FROM users').fetchone()[0] == 0


def test_code_from_different_signup_cannot_switch_the_approved_profile(app):
    _, original, _ = app.signup()
    with store.connect() as db:
        db.execute('UPDATE challenges SET created=0')
    _, replacement, _ = app.request('/api/signup', {
        'name': 'Different Person', 'age': 60, 'email': 'jane@example.com', 'authorized': True})
    assert app.request('/api/verify', {'email': 'jane@example.com', 'code': replacement['demo_code'],
                                      'challenge_id': original['challenge_id']})[0] == 401
    with store.connect() as db:
        assert db.execute('SELECT verified FROM users').fetchone()[0] == 0


def test_verified_profile_is_not_overwritten_by_a_later_signup(app):
    app.login()
    _, response, _ = app.request('/api/signup', {
        'name': 'Different Person', 'age': 60, 'email': 'jane@example.com', 'authorized': True})
    assert app.request('/api/verify', {'email': 'jane@example.com', 'code': response['demo_code'],
                                      'challenge_id': response['challenge_id']})[0] == 200
    profile = app.request('/api/dashboard')[1]['profile']
    assert (profile['name'], profile['age']) == ('Jane Example', 35)


def test_invalid_code_attempts_lock_even_correct_code(app):
    _, response, _ = app.signup()
    correct = response['demo_code']
    wrong = '999999' if correct != '999999' else '111111'
    for _ in range(auth.MAX_ATTEMPTS):
        assert app.request('/api/verify', {'email': 'jane@example.com', 'code': wrong, 'challenge_id': response['challenge_id']})[0] == 401
    assert app.request('/api/verify', {'email': 'jane@example.com', 'code': correct, 'challenge_id': response['challenge_id']})[0] == 401


def test_expired_code_and_session_rejected(app):
    _, response, _ = app.signup()
    with store.connect() as db:
        db.execute('UPDATE challenges SET expires=?', (time.time() - 1,))
    assert app.request('/api/verify', {'email': 'jane@example.com', 'code': response['demo_code'], 'challenge_id': response['challenge_id']})[0] == 401
    app.login('other@example.com')
    with store.connect() as db:
        db.execute('UPDATE sessions SET expires=?', (time.time() - 1,))
    assert app.request('/api/dashboard')[0] == 401


@pytest.mark.parametrize('headers', [
    {'Origin': 'https://evil.example'}, {'Origin': ''}, {'Host': 'evil.example'},
    {'X-Erase-Me': ''}, {'Content-Type': 'text/plain'},
])
def test_csrf_and_host_protection(app, headers):
    assert app.request('/api/signup', {}, headers=headers)[0] in (403, 415)


def test_foreign_host_blocked_even_read(app):
    assert app.request('/api/config', headers={'Host': 'evil.example'})[0] == 403


def test_cross_user_data_isolated(app):
    app.login()
    with store.connect() as db:
        first = db.execute('SELECT id FROM users WHERE email=?', ('jane@example.com',)).fetchone()[0]
        db.execute('INSERT INTO items(id,user_id,site_id,name,domain,status,detail,url,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
                   ('item-1', first, 'broker', 'Secret broker', 'example.com', 'found', '', 'https://example.com/private', store.now()))
    assert len(app.request('/api/dashboard')[1]['items']) == 1
    other = Client(app.server)
    other.login('other@example.com')
    dashboard = other.request('/api/dashboard?user_id=' + first)[1]
    assert dashboard['items'] == []
    assert dashboard['profile']['email'] == 'other@example.com'
    assert other.request('/api/profile', {'user_id': first, 'city': 'Oops'})[0] == 400


def test_pause_resume_and_run_state(app):
    app.login()
    assert app.request('/api/campaign', {'action': 'pause'})[0] == 200
    assert app.request('/api/dashboard')[1]['campaign']['status'] == 'paused'
    assert app.request('/api/campaign', {'action': 'run'})[0] == 409
    assert app.request('/api/campaign', {'action': 'resume'})[0] == 200
    assert app.request('/api/campaign', {'action': 'run'})[0] == 503  # This API-only fixture has no worker.
    assert app.request('/api/campaign', {'action': 'bogus'})[0] == 400


def test_profile_validation_and_question_resolution(app):
    app.login()
    assert app.request('/api/profile', {'country': 'US', 'region': 'CA-ON'})[0] == 400
    assert app.request('/api/profile', {'country': 'us', 'region': 'us-ca', 'city': 'San Diego'})[0] == 200
    profile = app.request('/api/dashboard')[1]['profile']
    assert (profile['country'], profile['region'], profile['city']) == ('US', 'US-CA', 'San Diego')


def test_delete_cascades_and_invalidates_session(app):
    app.login()
    cookie = app.cookie
    assert app.request('/api/account', {}, method='DELETE')[0] == 400
    assert app.request('/api/account', {'confirm': True}, method='DELETE')[0] == 200
    app.cookie = cookie
    assert app.request('/api/dashboard')[0] == 401
    with store.connect() as db:
        for table in ('users', 'challenges', 'sessions', 'activity'):
            assert db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] == 0


@pytest.mark.parametrize('path', ['/../server.py', '/%2e%2e/server.py', '/static/../../auth.py', '/api/nope'])
def test_static_traversal_and_unknown_routes(app, path):
    assert app.request(path)[0] == 404


def test_live_never_returns_verification_code(tmp_path, monkeypatch):
    monkeypatch.delenv('ERASE_WEB_ORIGIN', raising=False)
    monkeypatch.setenv('ERASE_SMTP_HOST', 'smtp.example')
    monkeypatch.setenv('ERASE_SMTP_FROM', 'privacy@example.com')
    sent = []
    monkeypatch.setattr(auth, 'send_mail', lambda *args: sent.append(args))
    server = create_server(port=0, demo=False, data_dir=tmp_path / 'live')
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, result, _ = Client(server).signup()
        assert status == 200 and result['verification_required'] is True
        assert 'demo_code' not in result and result['challenge_id']
        assert len(sent) == 1
        assert sent[0][0] == 'jane@example.com'
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_live_missing_email_cannot_begin(app, monkeypatch):
    app.server.demo = False
    monkeypatch.delenv('ERASE_SMTP_HOST', raising=False)
    monkeypatch.delenv('ERASE_SMTP_FROM', raising=False)
    assert app.signup()[0] == 503
    with store.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0


def test_private_modes_and_demo_live_separation(tmp_path):
    target = tmp_path / 'private'
    database = store.init_db(target, 'demo')
    assert stat.S_IMODE(target.stat().st_mode) == 0o700
    assert stat.S_IMODE(database.stat().st_mode) == 0o600
    with pytest.raises(ValueError, match='separate'):
        store.init_db(target, 'live')


def test_data_directory_does_not_adopt_existing_folder(tmp_path):
    (tmp_path / 'important').write_text('keep')
    with pytest.raises(ValueError, match='nonempty'):
        store.init_db(tmp_path, 'demo')


def test_public_binding_requires_tls_origin(tmp_path, monkeypatch):
    monkeypatch.delenv('ERASE_WEB_ORIGIN', raising=False)
    with pytest.raises(ValueError, match='Public binding'):
        create_server(host='0.0.0.0', port=0, demo=False, data_dir=tmp_path / 'public')

@pytest.mark.parametrize('font', ['instrument-serif.ttf', 'hanken-grotesk.ttf', 'vt323.ttf'])
def test_bundled_display_fonts_are_served_with_font_type(app, font):
    status, body, headers = app.request('/fonts/' + font)
    assert status == 200 and headers['Content-Type'] == 'font/ttf'
    assert isinstance(body, bytes) and len(body) > 1000
