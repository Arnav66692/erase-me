"""Explicit local runs do not start timers, poll inboxes, or process other profiles."""
import datetime as dt
import threading
from pathlib import Path

import pytest

from webapp import auth, automation, store
from webapp.server import create_server


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.delenv('ERASE_WEB_ORIGIN', raising=False)
    monkeypatch.setattr(automation.Worker, 'start', lambda self: pytest.fail('recurring worker started'))
    server = create_server(port=0, local_only=True, data_dir=tmp_path / 'local', start_worker=True)
    yield server
    if server._manual_thread:
        server._manual_thread.join(timeout=2)
    server.server_close()


def test_default_local_start_has_no_worker_loop_and_isolated_mode(app):
    assert app.manual and app.local_only
    assert app.worker._thread is None
    with store.connect() as db:
        assert db.execute("SELECT value FROM settings WHERE key='mode'").fetchone()[0] == 'local'


def test_implicit_events_never_start_a_run(app, monkeypatch):
    monkeypatch.setattr(app.worker, 'request_run', lambda *a: pytest.fail('implicit request'))
    assert app.trigger() is False
    assert app.trigger('person') is False
    assert app._manual_thread is None


def test_explicit_batch_is_bounded_and_targets_only_requesting_user(app, monkeypatch):
    calls = []
    monkeypatch.setattr(app.worker, 'request_run', lambda user: calls.append(('request', user)))
    def run_once(**kwargs):
        assert kwargs['user_id'] == 'person'
        assert kwargs['immediate'] is True
        assert 0 < kwargs['max_seconds'] <= 120
        calls.append(('cycle', kwargs['user_id']))
        return 1
    monkeypatch.setattr(app.worker, 'run_once', run_once)
    assert app.trigger('person', explicit=True)
    app._manual_thread.join(timeout=2)
    assert calls == [('request', 'person')] + [('cycle', 'person')] * 4
    assert app._manual_user is None
    assert not app._manual_thread.is_alive()


def test_overlapping_explicit_run_is_rejected(app, monkeypatch):
    entered, release = threading.Event(), threading.Event()
    monkeypatch.setattr(app.worker, 'request_run', lambda user: None)
    def run_once(**kwargs):
        entered.set()
        release.wait(2)
        return 0
    monkeypatch.setattr(app.worker, 'run_once', run_once)
    try:
        app.trigger('person', explicit=True)
        assert entered.wait(1)
        with pytest.raises(auth.AuthError, match='already running'):
            app.trigger('other', explicit=True)
    finally:
        release.set()
        app._manual_thread.join(timeout=2)


def test_explicit_worker_scope_and_future_deadlines(app, monkeypatch):
    worker = automation.Worker(demo=True)
    stamp = automation.iso(automation.now())
    with store.connect() as db:
        for user in ('first', 'second'):
            db.execute('INSERT INTO users(id,name,age,email,verified,authorized_at,created_at) '
                       'VALUES(?,?,?,?,1,?,?)', (user, 'Example Person', 35, user+'@example.test', stamp, stamp))
    assert worker.run_once(user_id='first', immediate=True) > 0
    with store.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM jobs WHERE user_id='second'").fetchone()[0] == 0
        future = automation.iso(automation.now() + dt.timedelta(days=1))
        db.execute("UPDATE jobs SET phase='check',next_at=? WHERE user_id='first'", (future,))
    monkeypatch.setattr(worker, '_run_job', lambda *a: pytest.fail('future check ran early'))
    assert worker.run_once(user_id='first', immediate=True) == 0


@pytest.mark.parametrize('host,origin', [('0.0.0.0', None), ('127.0.0.1','https://privacy.example')])
def test_local_profiles_cannot_be_exposed_publicly(tmp_path, monkeypatch, host, origin):
    if origin:
        monkeypatch.setenv('ERASE_WEB_ORIGIN', origin)
    else:
        monkeypatch.delenv('ERASE_WEB_ORIGIN', raising=False)
    with pytest.raises(ValueError, match='loopback'):
        create_server(host=host,port=0,local_only=True,data_dir=tmp_path/'local')


def test_local_signup_and_recovery_api_do_not_send_or_verify_email(app, monkeypatch):
    import http.client
    import json
    monkeypatch.setattr(auth, 'send_mail', lambda *a, **kw: pytest.fail('mail sent'))
    listener = threading.Thread(target=app.serve_forever, daemon=True)
    listener.start()
    def request(path, body=None, cookie=None):
        conn = http.client.HTTPConnection('127.0.0.1', app.server_port, timeout=5)
        headers = {'Origin': f'http://127.0.0.1:{app.server_port}',
                   'Content-Type': 'application/json', 'X-Erase-Me': '1'}
        if cookie:
            headers['Cookie'] = cookie
        conn.request('POST' if body is not None else 'GET', path,
                     json.dumps(body) if body is not None else None, headers)
        response = conn.getresponse()
        result = response.status, json.loads(response.read()), response.getheader('Set-Cookie')
        conn.close()
        return result
    try:
        _, config, _ = request('/api/config')
        assert config['local_only'] and config['manual']
        assert config['authorization_statement'] == auth.LOCAL_AUTHORIZATION
        payload = {'name': 'Fixture Person', 'age': 35, 'email': 'fixture@example.test', 'authorized': True}
        status, result, cookie = request('/api/signup', payload)
        assert status == 200 and result == {'ok': True}
        assert 'verification_required' not in result
        assert app._manual_thread is None
        assert request('/api/login', {'email': payload['email']})[0] == 403
        assert request('/api/verify', {'email': payload['email'], 'code': '123456'})[0] == 403
        assert request('/api/signup', payload)[0] == 409
        token = cookie.split(';')[0].split('=', 1)[1]
        assert request('/api/local-session', {'token': 'invalid'})[0] == 401
        assert request('/api/local-session', {'token': token})[0] == 200
        dashboard = request('/api/dashboard', cookie=cookie.split(';')[0])[1]
        assert dashboard['campaign']['run_in_progress'] is False
        assert dashboard['campaign']['next_check_at'] is None
        assert dashboard['items'] == []
    finally:
        app.shutdown()
        listener.join(timeout=2)
