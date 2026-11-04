"""Mailbox access and automatic email requests are disabled in the form-only app."""
import datetime as dt

import pytest

from webapp import adapters, auth, automation, email_routes, engine, notifications, store


@pytest.fixture
def setup(tmp_path, monkeypatch):
    store.init_db(tmp_path / 'live', mode='live')
    stamp = dt.datetime(2026, 10, 28, 12, tzinfo=dt.timezone.utc)
    monkeypatch.setattr(automation, 'now', lambda: stamp)
    monkeypatch.setattr(engine, 'plan', lambda user: email_routes.plans())
    monkeypatch.setattr(notifications, 'deliver', lambda: None)
    monkeypatch.setenv('ERASE_SMTP_HOST', 'smtp.example.test')
    monkeypatch.setenv('ERASE_SMTP_FROM', 'person@example.test')
    monkeypatch.setenv('ERASE_REMOVAL_INBOX', 'person@example.test')
    monkeypatch.setattr(adapters, 'invoke', lambda payload: pytest.fail('Archived email route opened a browser'))
    monkeypatch.setattr(auth, 'send_mail', lambda *args, **kwargs: pytest.fail('Email sending is disabled'))
    with store.connect() as db:
        db.execute('INSERT INTO users(id,name,age,email,verified,authorized_at,created_at,country,city) '
                   "VALUES('u','Example Person',35,'person@example.test',1,?,?, 'US','Testville')",
                   (stamp.isoformat(), stamp.isoformat()))
    return automation.Worker(demo=False)


def test_archived_email_routes_do_not_send_even_with_credentials(setup):
    setup.run_once()
    with store.connect() as db:
        jobs = list(db.execute('SELECT * FROM jobs'))
        assert len(jobs) == 2
        assert all(job['phase'] == 'blocked' and not job['first_submitted_at'] for job in jobs)
        assert all(not job['matched'] and not job['last_verified_removed'] for job in jobs)
    setup.request_run('u')
    setup.run_once()


def test_historical_email_job_never_resends_or_opens_inbox(setup, monkeypatch):
    from tools import mailbox_adapter
    monkeypatch.setattr(mailbox_adapter, 'find_confirmation', lambda *args: pytest.fail('Inbox was opened'))
    setup.run_once()
    with store.connect() as db:
        db.execute("UPDATE jobs SET phase='email_reply',first_submitted_at=?,submitted_at=?,next_at=?",
                   (automation.iso(automation.now()),) * 3)
    setup.run_once()
    with store.connect() as db:
        assert all(row['phase'] == 'blocked' for row in db.execute('SELECT * FROM jobs'))
        assert all(row['status'] == 'blocked' for row in db.execute('SELECT * FROM items'))


def test_apollo_and_pdl_email_channels_disabled():
    assert not any(email_routes.send_enabled(route) for route in email_routes.plans())
    apollo = next(route for route in email_routes.plans() if route['id'] == 'apollo-email')
    assert 'rejected' in apollo['disabled_reason']
    # Stale configuration cannot reenable a disabled route.
    assert not email_routes.send_enabled(dict(apollo, enabled=True))


def test_normal_plan_does_not_include_email_requests():
    plans = engine.plan({'id': 'u', 'name': 'Example Person', 'age': 35,
                         'email': 'person@example.test', 'country': 'US', 'city': 'Testville', 'region': 'US-CA'})
    assert all(not email_routes.handles(site) for site in plans)


def test_catalog_copy_and_recipient_binding():
    routes = email_routes.plans()
    routes[0]['fields_needed'].append('phone')
    assert 'phone' not in email_routes.plans()[0]['fields_needed']
    route = email_routes.plans()[0]
    assert email_routes.valid_route(route)
    assert not email_routes.valid_route(dict(route, email='privacy@attacker.test'))
