"""Status emails use a fake sender and private temporary SQLite database."""
import pytest

from webapp import auth, notifications, store


@pytest.fixture
def state(tmp_path, monkeypatch):
    store.init_db(tmp_path / 'data', mode='live')
    notifications.initialize()
    with store.connect() as db:
        db.execute("INSERT INTO users(id,name,age,email,verified,authorized_at,created_at) "
                   "VALUES('u','Example Person',35,'example@example.test',1,'now','now')")
        db.execute("INSERT INTO items(id,user_id,site_id,name,domain,status,updated_at) "
                   "VALUES('i','u','broker','Broker','broker.example','requested','now')")
        store.event(db, 'u', 'Broker: request sent.')
    clock = [100000.0]
    messages = []
    monkeypatch.setattr(notifications.time, 'time', lambda: clock[0])
    monkeypatch.setattr(auth, 'email_configured', lambda: True)
    monkeypatch.setattr(auth, 'send_mail', lambda *args: messages.append(args))
    return clock, messages


def test_digest_waits_then_sends_once_for_changes(state):
    clock, messages = state
    notifications.deliver()
    assert not messages
    clock[0] += 61
    notifications.deliver()
    assert len(messages) == 1
    assert messages[0][0] == 'example@example.test'
    assert 'Requests awaiting removal: 1' in messages[0][2]
    assert 'Example Person' not in messages[0][2]
    clock[0] += 86400
    notifications.deliver()
    assert len(messages) == 1


def test_new_events_are_batched_and_rate_limited(state):
    clock, messages = state
    notifications.deliver()
    clock[0] += 61
    notifications.deliver()
    with store.connect() as db:
        store.event(db, 'u', 'Another site updated.')
    notifications.deliver()
    clock[0] += 61
    notifications.deliver()
    assert len(messages) == 1
    clock[0] += 86400
    notifications.deliver()
    assert len(messages) == 2


@pytest.mark.parametrize('flag', ['paused', 'unverified', 'deleted'])
def test_inactive_users_receive_nothing(state, flag):
    clock, messages = state
    notifications.deliver()
    with store.connect() as db:
        if flag == 'paused':
            db.execute("UPDATE users SET status='paused'")
        elif flag == 'unverified':
            db.execute('UPDATE users SET verified=0')
        else:
            db.execute('DELETE FROM users')
            assert db.execute('SELECT COUNT(*) FROM notification_delivery').fetchone()[0] == 0
    clock[0] += 61
    notifications.deliver()
    assert not messages


def test_ambiguous_delivery_is_not_repeated_after_restart(state, monkeypatch):
    clock, messages = state
    notifications.deliver()
    clock[0] += 61
    def failed(*args):
        messages.append(args)
        raise auth.AuthError('SMTP disconnect')
    monkeypatch.setattr(auth, 'send_mail', failed)
    notifications.deliver()
    notifications.initialize()
    clock[0] += 86400
    notifications.deliver()
    assert len(messages) == 1
    with store.connect() as db:
        assert db.execute('SELECT state FROM notification_delivery').fetchone()[0] == 'uncertain'


def test_crashed_send_is_not_repeated(state):
    clock, messages = state
    with store.connect() as db:
        db.execute("INSERT INTO notification_delivery(user_id,state,claimed_cursor) VALUES('u','sending',1)")
    notifications.initialize()
    notifications.deliver()
    assert not messages


def test_unconfigured_sender_does_not_claim_delivery(state, monkeypatch):
    monkeypatch.setattr(auth, 'email_configured', lambda: False)
    notifications.deliver()
    with store.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM notification_delivery').fetchone()[0] == 0


def test_pause_during_another_recipients_delivery_prevents_later_send(state, monkeypatch):
    clock, messages = state
    with store.connect() as db:
        db.execute("INSERT INTO users(id,name,age,email,verified,authorized_at,created_at) "
                   "VALUES('v','Another Person',40,'another@example.test',1,'now','now')")
        store.event(db, 'v', 'A site updated.')
    notifications.deliver()
    clock[0] += 61
    def send_and_pause_other(*args):
        messages.append(args)
        with store.connect() as db:
            db.execute("UPDATE users SET status='paused' WHERE email<>?", (args[0],))
    monkeypatch.setattr(auth, 'send_mail', send_and_pause_other)
    notifications.deliver()
    assert len(messages) == 1
