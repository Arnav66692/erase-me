"""No live brokers, inboxes, or real home folders are used by these tests."""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import uuid
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from webapp import adapters, auth, automation, store


@pytest.fixture
def setup(tmp_path, monkeypatch):
    store.init_db(tmp_path / 'web', mode='demo')
    stamp = dt.datetime(2026, 10, 28, 12, tzinfo=dt.timezone.utc)
    clock = {'now': stamp}
    monkeypatch.setattr(automation, 'now', lambda: clock['now'])
    with store.connect() as db:
        db.execute('INSERT INTO users(id,name,age,email,verified,authorized_at,created_at,country,city) '
                   "VALUES('user-a','Example Person',35,'person@example.test',1,?,?, 'US','Testville')",
                   (stamp.isoformat(), stamp.isoformat()))
    worker = automation.Worker(demo=True)
    return worker, clock


def tick(worker, clock, seconds=3):
    clock['now'] += dt.timedelta(seconds=seconds)
    worker.run_once()


def rows():
    with store.connect() as db:
        return {r['site_id']: dict(r) for r in db.execute('SELECT * FROM items')}


def job(site='demo-atlas'):
    with store.connect() as db:
        return dict(db.execute('SELECT * FROM jobs WHERE site_id=?', (site,)).fetchone())


def test_demo_full_lifecycle_and_90_day_monitoring(setup):
    worker, clock = setup
    worker.run_once()
    assert rows()['demo-atlas']['status'] == 'found'
    tick(worker, clock)
    assert rows()['demo-atlas']['status'] == 'awaiting_confirmation'
    assert rows()['demo-openbook']['status'] == 'requested'
    assert rows()['demo-northstar']['status'] == 'blocked'
    tick(worker, clock)
    assert rows()['demo-atlas']['status'] == 'requested'
    assert rows()['demo-openbook']['status'] == 'removed'
    tick(worker, clock)
    assert rows()['demo-atlas']['status'] == 'removed'
    origin = automation.parse(job()['first_submitted_at'])
    assert automation.parse(job()['next_at']) == origin + dt.timedelta(days=30)
    clock['now'] = origin + dt.timedelta(days=30, seconds=1)
    worker.run_once()
    assert automation.parse(job()['next_at']) == origin + dt.timedelta(days=45)
    clock['now'] = origin + dt.timedelta(days=90, seconds=1)
    worker.run_once()
    assert job()['phase'] == 'done'


def test_unverified_and_paused_users_never_run(setup):
    worker, clock = setup
    with store.connect() as db:
        db.execute('UPDATE users SET verified=0')
    worker.run_once()
    assert not rows()
    with store.connect() as db:
        db.execute("UPDATE users SET verified=1,status='paused'")
    worker.run_once()
    assert not rows()
    with store.connect() as db:
        db.execute("UPDATE users SET status='active'")
    worker.run_once()
    with store.connect() as db:
        db.execute("UPDATE users SET status='paused'")
    tick(worker, clock)
    assert rows()['demo-atlas']['status'] == 'found'


def test_uncertain_submission_is_not_retried_even_after_restart(setup, monkeypatch):
    worker, clock = setup
    worker.run_once()
    def timeout(payload):
        raise adapters.AdapterError('private underlying error')
    monkeypatch.setattr(adapters, 'demo_invoke', timeout)
    tick(worker, clock)
    assert job()['phase'] == 'uncertain'
    replacement = automation.Worker(demo=True)
    replacement.request_run('user-a')
    tick(replacement, clock, 3600)
    assert job()['phase'] == 'uncertain'
    assert 'private underlying error' not in rows()['demo-atlas']['detail']


def test_interrupted_submission_held_for_reconciliation(setup):
    worker, clock = setup
    worker.run_once()
    with store.connect() as db:
        db.execute("UPDATE jobs SET in_flight=1,claim_at=?,phase='submit' WHERE site_id='demo-atlas'",
                   ((clock['now'] - dt.timedelta(minutes=5)).isoformat(),))
    worker.run_once()
    assert job()['phase'] == 'uncertain'
    assert 'interrupted' in rows()['demo-atlas']['detail'].lower()


def test_weak_match_does_not_send_request(setup, monkeypatch):
    worker, clock = setup
    monkeypatch.setattr(adapters, 'demo_invoke', lambda p: {
        'status': 'found', 'listing_url': f"https://{p['site']['domain']}/person",
        'match': {'name': p['person']['name'], 'age': p['person']['age']},
    })
    worker.run_once()
    assert all(r['status'] == 'needs_info' for r in rows().values())
    assert not job()['first_submitted_at']


def test_malicious_evidence_domain_does_not_authorize_removal(setup, monkeypatch):
    worker, _ = setup
    monkeypatch.setattr(adapters, 'demo_invoke', lambda p: {
        'status': 'found', 'listing_url': f"https://{p['site']['domain']}.evil.test/person",
        'match': {'name': p['person']['name'], 'email': p['person']['email']},
    })
    worker.run_once()
    assert all(r['status'] == 'needs_info' for r in rows().values())


def test_confirmation_wrong_request_or_sender_never_counts(setup, monkeypatch):
    worker, clock = setup
    worker.run_once()
    tick(worker, clock)
    original = adapters.demo_invoke
    def forged(payload):
        result = original(payload)
        if payload['action'] == 'confirm':
            result['sender_domain'] = 'attacker.example'
        return result
    monkeypatch.setattr(adapters, 'demo_invoke', forged)
    tick(worker, clock)
    assert job()['phase'] == 'uncertain'
    assert rows()['demo-atlas']['status'] == 'blocked'


def test_not_found_on_recheck_is_not_verified_removed(setup, monkeypatch):
    worker, clock = setup
    worker.run_once()
    tick(worker, clock)
    monkeypatch.setattr(adapters, 'demo_invoke', lambda _: {'status': 'not_found'})
    tick(worker, clock)
    assert rows()['demo-openbook']['status'] != 'removed'


def test_account_deletion_cascades_jobs(setup):
    worker, _ = setup
    worker.run_once()
    with store.connect() as db:
        db.execute("DELETE FROM users WHERE id='user-a'")
        assert db.execute('SELECT COUNT(*) FROM jobs').fetchone()[0] == 0
        assert db.execute('SELECT COUNT(*) FROM items').fetchone()[0] == 0
    worker.run_once()
    assert not rows()


def test_missing_adapter_explicit_and_no_synthetic_results(setup, monkeypatch):
    _, clock = setup
    monkeypatch.delenv('ERASE_ME_ADAPTER', raising=False)
    worker = automation.Worker(demo=False)
    worker.run_once()
    # The live catalog may exceed the bounded 30-job batch; drain its remainder.
    worker.run_once()
    assert rows()
    assert all(r['status'] == 'blocked' for r in rows().values())
    assert not any(r['site_id'].startswith('demo-') for r in rows().values())
    assert all(r['url'] is None for r in rows().values())


@pytest.mark.parametrize('url', [
    'http://broker.example/listing', 'https://broker.example.evil.test/x',
    'https://broker.example@evil.test/x', 'https://broker.example:8080/x',
    'https://broker.example/x\nInjected', 'javascript:alert(1)', 'https://[bad/',
])
def test_url_boundary_rejects_unsafe_targets(url):
    assert not adapters.allowed_url(url, 'broker.example')


def test_url_boundary_accepts_subdomain():
    assert adapters.allowed_url('https://www.broker.example/listing/1', 'broker.example')


def test_subprocess_adapter_uses_json_stdin_and_reports_safe_errors(tmp_path, monkeypatch):
    script = tmp_path / 'adapter'
    script.write_text('#!' + sys.executable + '\nimport json,sys\np=json.load(sys.stdin)\nprint(json.dumps({"status":"not_found","request_id":p["request_id"]}))\n')
    script.chmod(0o700)
    monkeypatch.setenv('ERASE_ME_ADAPTER', str(script))
    assert adapters.configured()
    assert adapters.invoke({'request_id': 'test'}) == {'status': 'not_found', 'request_id': 'test'}
    script.write_text('#!' + sys.executable + '\nimport sys\nprint("private",file=sys.stderr)\nsys.exit(1)\n')
    with pytest.raises(adapters.AdapterError, match='could not complete') as exc:
        adapters.invoke({'request_id': 'test'})
    assert 'private' not in str(exc.value)


def test_pause_still_allows_explicit_resume_run(setup):
    worker, clock = setup
    worker.run_once()
    with store.connect() as db:
        db.execute("UPDATE users SET status='paused'")
    worker.request_run('user-a')
    tick(worker, clock)
    assert rows()['demo-atlas']['status'] == 'found'
    with store.connect() as db:
        db.execute("UPDATE users SET status='active'")
    tick(worker, clock)
    assert rows()['demo-atlas']['status'] == 'awaiting_confirmation'


def test_legacy_email_route_is_disabled_even_with_sender_configured(setup, monkeypatch):
    worker, clock = setup
    worker.run_once()
    monkeypatch.setenv('ERASE_SMTP_HOST', 'smtp.example.test')
    monkeypatch.setenv('ERASE_SMTP_FROM', 'person@example.test')
    monkeypatch.setattr(auth, 'send_mail', lambda *args, **kwargs: pytest.fail('SMTP is disabled'))
    with store.connect() as db:
        user = dict(db.execute("SELECT * FROM users WHERE id='user-a'").fetchone())
    current = job()
    site = json.loads(current['site_json'])
    site.update(method='email', email='privacy@atlas.example', verified=True)
    worker._email_route(user, site, current)
    assert job()['phase'] == 'blocked'
    assert 'disabled' in rows()['demo-atlas']['detail']


def test_email_address_domain_mismatch_is_not_sent(setup, monkeypatch):
    worker, _ = setup
    worker.run_once()
    worker.demo = False
    monkeypatch.setattr(adapters, 'configured', lambda: True)
    monkeypatch.setattr(auth, 'email_configured', lambda: True)
    def forbidden(*args, **kwargs):
        pytest.fail('Cross-domain unverified email must never be sent.')
    monkeypatch.setattr(auth, 'send_mail', forbidden)
    current = job()
    site = json.loads(current['site_json'])
    site.update(method='email', email='privacy@attacker.example')
    current['site_json'] = json.dumps(site)
    worker._run_job(current)
    assert job()['phase'] == 'blocked'
    assert not job()['first_submitted_at']


def test_relisting_resubmits_after_transient_check_failure(setup, monkeypatch):
    worker, clock = setup
    worker.run_once()
    for _ in range(3):
        tick(worker, clock)
    original = job()
    assert original['last_verified_removed'] == 1
    monkeypatch.setattr(adapters, 'demo_invoke', lambda p: {'status': 'error'})
    clock['now'] = automation.parse(original['next_at'])
    worker.run_once()
    assert job()['last_verified_removed'] == 1
    assert rows()['demo-atlas']['status'] == 'blocked'
    def found(p):
        return {'status': 'found', 'listing_url': f"https://{p['site']['domain']}/listing/demo",
                'match': {'name': p['person']['name'], 'email': p['person']['email']}}
    monkeypatch.setattr(adapters, 'demo_invoke', found)
    clock['now'] = automation.parse(job()['next_at'])
    worker.run_once()
    assert job()['phase'] == 'submit'
    assert job()['request_id'] != original['request_id']
    assert job()['first_submitted_at'] == original['first_submitted_at']


def test_name_age_and_city_can_authorize_but_name_age_alone_cannot():
    person = {'name': 'Example Person', 'age': 35, 'city': 'Testville', 'email': 'person@example.test'}
    assert adapters.same_person(person, {'name': 'Example Person', 'age': 35, 'city': 'Testville'})
    assert not adapters.same_person(person, {'name': 'Example Person', 'age': 35})
    assert not adapters.same_person(person, {'name': 'Different Person', 'email': person['email']})
    assert not adapters.same_person(person, {'name': person['name'], 'age': True, 'city': person['city']})


def test_ambiguous_result_creates_question(setup, monkeypatch):
    worker, _ = setup
    monkeypatch.setattr(adapters, 'demo_invoke', lambda p: {'status': 'ambiguous'})
    worker.run_once()
    with store.connect() as db:
        questions = db.execute('SELECT * FROM questions').fetchall()
    assert len(questions) == 1
    assert questions[0]['field'] == 'city'


def test_profile_change_after_match_requires_new_scan(setup, monkeypatch):
    worker, clock = setup
    worker.run_once()
    assert job()['phase'] == 'submit'
    with store.connect() as db:
        db.execute("UPDATE users SET city='Different City'")
    original = adapters.demo_invoke
    calls = []
    def tracked(payload):
        calls.append(payload['action'])
        return original(payload)
    monkeypatch.setattr(adapters, 'demo_invoke', tracked)
    tick(worker, clock)
    assert not calls  # Every pending submit was invalidated before contacting the adapter.
    assert job()['phase'] == 'scan'
    assert not job()['first_submitted_at']


def test_profile_change_during_scan_discards_stale_evidence(setup, monkeypatch):
    worker, clock = setup
    original = adapters.demo_invoke
    def changing(payload):
        with store.connect() as db:
            db.execute("UPDATE users SET city='Different City'")
        return original(payload)
    monkeypatch.setattr(adapters, 'demo_invoke', changing)
    worker.run_once()
    assert job()['phase'] == 'scan'
    assert job()['matched'] == 0


def test_profile_changed_clears_idle_unsent_matches(setup):
    worker, _ = setup
    worker.run_once()
    worker.profile_changed('user-a')
    assert job()['phase'] == 'scan'
    assert job()['matched'] == 0
    assert rows()['demo-atlas']['url'] is None


def test_configured_mailbox_never_replaces_supplied_form_email(setup, monkeypatch):
    worker, _ = setup
    worker.run_once()
    worker.demo = False
    monkeypatch.setenv('ERASE_REMOVAL_INBOX', 'removals@service.example')
    monkeypatch.setattr(adapters, 'configured', lambda: True)
    monkeypatch.setattr(adapters, 'invoke', lambda p: {
        'status': 'awaiting_confirmation', 'request_id': p['request_id'], 'route_verified': True,
    })
    current = job()
    worker._run_job(current)
    pending = job()
    assert pending['confirmation_address'] is None
    monkeypatch.setenv('ERASE_REMOVAL_INBOX', 'changed@service.example')
    with store.connect() as db:
        user = dict(db.execute("SELECT * FROM users WHERE id='user-a'").fetchone())
    payload = worker._payload(user, json.loads(pending['site_json']), pending)
    assert payload['person']['email'] == 'person@example.test'
    assert payload['fields']['email'] == 'person@example.test'
    assert payload['confirmation_recipient'] is None


def mailbox_fixture():
    from email.message import EmailMessage
    stamp = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1)
    request_id = 'a' * 32
    payload = {'request_id': request_id, 'site': {'domain': 'broker.example'},
               'confirmation_recipient': f'removals+erase-{request_id}@service.example',
               'submitted_at': (stamp - dt.timedelta(minutes=1)).isoformat()}
    message = EmailMessage()
    message['From'] = 'privacy@broker.example'
    message['To'] = payload['confirmation_recipient']
    message['Subject'] = 'Confirm your removal request'
    message['Authentication-Results'] = (
        'mx.service.example; dkim=pass header.d=broker.example; dmarc=pass header.from=broker.example')
    message.set_content('Confirm removal of your listing: https://broker.example/confirm/abc')
    return payload, message, stamp


def test_mailbox_accepts_only_correlated_authenticated_confirmation():
    from tools import mailbox_adapter
    payload, message, stamp = mailbox_fixture()
    result = mailbox_adapter.candidate(message.as_bytes(), payload, stamp, 'mx.service.example')
    assert result['confirmation_url'] == 'https://broker.example/confirm/abc'
    assert result['request_id'] == payload['request_id']
    assert result['authenticated'] is True


@pytest.mark.parametrize('attack', ['sender', 'recipient', 'authserv', 'authfail', 'old', 'redirect', 'password', 'multiple'])
def test_mailbox_rejects_unrelated_or_unsafe_messages(attack):
    from tools import mailbox_adapter
    payload, message, stamp = mailbox_fixture()
    if attack == 'sender':
        message.replace_header('From', 'privacy@attacker.example')
    elif attack == 'recipient':
        message.replace_header('To', 'someone@service.example')
    elif attack == 'authserv':
        message.replace_header('Authentication-Results', 'evil; dkim=pass header.d=broker.example; dmarc=pass header.from=broker.example')
    elif attack == 'authfail':
        message.replace_header('Authentication-Results', 'mx.service.example; dkim=fail header.d=broker.example; dmarc=fail header.from=broker.example')
    elif attack == 'old':
        stamp -= dt.timedelta(days=1)
    elif attack == 'redirect':
        message.set_content('Confirm removal: https://broker.example/confirm?next=https://evil.test')
    elif attack == 'password':
        message.set_content('Confirm removal: https://broker.example/account/confirm')
    elif attack == 'multiple':
        message.set_content('Confirm removal: https://broker.example/confirm/1 https://broker.example/confirm/2')
    assert mailbox_adapter.candidate(message.as_bytes(), payload, stamp, 'mx.service.example') is None


def test_mailbox_connector_uses_tls_readonly_and_bounded_peek(monkeypatch):
    from tools import mailbox_adapter
    payload, message, stamp = mailbox_fixture()
    raw = message.as_bytes()
    for name, value in {'ERASE_IMAP_HOST':'imap.service.example', 'ERASE_IMAP_USER':'removals',
                        'ERASE_IMAP_PASSWORD':'test-only', 'ERASE_IMAP_AUTHSERV_ID':'mx.service.example',
                        'ERASE_REMOVAL_INBOX':'removals@service.example'}.items():
        monkeypatch.setenv(name, value)
    calls = []
    class FakeIMAP:
        def __init__(self, host, port, ssl_context, timeout):
            assert ssl_context.check_hostname
            assert timeout == 20
        def login(self, username, password):
            assert password == 'test-only'
        def select(self, mailbox, readonly):
            assert readonly is True
            return 'OK', []
        def uid(self, action, *args):
            calls.append((action, args))
            if action == 'search':
                assert payload['confirmation_recipient'] in args[-1]
                return 'OK', [b'100']
            assert 'BODY.PEEK[]<0.262145>' in args[-1]
            metadata = f'100 (INTERNALDATE "{stamp.strftime("%d-%b-%Y %H:%M:%S %z")}" RFC822.SIZE {len(raw)})'.encode()
            return 'OK', [(metadata, raw)]
        def logout(self):
            pass
    monkeypatch.setattr(mailbox_adapter.imaplib, 'IMAP4_SSL', FakeIMAP)
    assert mailbox_adapter.find_confirmation(payload)['purpose'] == 'removal'
    assert len(calls) == 2


def test_live_confirmation_never_opens_mailbox(setup, monkeypatch):
    worker, clock = setup
    worker.run_once()
    tick(worker, clock)
    worker.demo = False
    monkeypatch.setattr(adapters, 'invoke', lambda *args: pytest.fail('Live confirm opened inbox or browser'))
    worker._run_job(job())
    assert job()['phase'] == 'confirm'
    assert job()['next_at'] is None
    assert rows()['demo-atlas']['status'] == 'awaiting_confirmation'


def test_user_reported_confirmation_only_queues_independent_check(setup):
    worker, clock = setup
    worker.run_once()
    tick(worker, clock)
    assert worker.confirmation_completed('user-a', 'demo-atlas')
    assert job()['phase'] == 'check'
    assert rows()['demo-atlas']['status'] == 'requested'
    assert not job()['last_verified_removed']
    assert not worker.confirmation_completed('user-a', 'demo-atlas')


@pytest.mark.parametrize('case', ['other_user', 'unsent', 'paused', 'inflight', 'unauthorized'])
def test_confirmation_report_requires_existing_eligible_request(setup, case):
    worker, clock = setup
    worker.run_once()
    if case != 'unsent':
        tick(worker, clock)
    with store.connect() as db:
        if case == 'paused':
            db.execute("UPDATE users SET status='paused'")
        elif case == 'inflight':
            db.execute('UPDATE jobs SET in_flight=1')
        elif case == 'unauthorized':
            db.execute("UPDATE users SET authorized_at=''")
    assert not worker.confirmation_completed('other' if case == 'other_user' else 'user-a', 'demo-atlas')


def test_worker_never_sends_status_email(setup, monkeypatch):
    from webapp import notifications
    worker, _ = setup
    worker.demo = False
    monkeypatch.setattr(notifications, 'deliver', lambda: pytest.fail('Status email sent'))
    monkeypatch.setattr(automation.engine, 'plan', lambda user: [])
    worker.run_once()
