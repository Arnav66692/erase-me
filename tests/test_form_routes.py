"""PDL initiation is email verification, not proof of a submitted deletion."""
import datetime as dt
import json

import pytest

from browser_adapter import VISIBILITY_JS, execute as adapter_execute
import pdl_adapter
from webapp import adapters, auth, automation, engine, form_routes, store


class FakeBrowser:
    def __init__(self, *, initial_success=False, redirect=None, form=None, accepted=True,
                 url=None, post_click_url=None):
        self.calls = []
        self.address = ''
        self.clicked = False
        self.initial_success = initial_success
        self.redirect = redirect
        self.form = form or pdl_adapter.URL
        self.accepted = accepted
        self.url = url or pdl_adapter.URL
        self.post_click_url = post_click_url

    def goto(self, url, domain):
        self.calls.append(('goto', url, domain))

    def js(self, expression):
        current = self.redirect if self.address and self.redirect else self.url
        if self.clicked and self.post_click_url:
            current = self.post_click_url
        return {'url': current,
                'form': self.form, 'ready': True, 'id_required': False, 'email': self.address,
                'success': self.initial_success or self.clicked and self.accepted}

    def run(self, *args):
        self.calls.append(args)
        if args[0] == 'fill':
            self.address = args[2]
        elif args[0] == 'click':
            self.clicked = True


def payload():
    return {'site': form_routes.plans()[0], 'action': 'submit', 'request_id': 'a' * 32,
            'fields': {'email': 'person@example.test'}, 'person': {'email': 'person@example.test'}}


def test_verified_success_is_only_an_email_step():
    browser = FakeBrowser()
    result = adapter_execute(payload(), {}, browser)
    assert result == {'status': 'verification_sent', 'request_id': 'a' * 32, 'route_verified': True}
    assert browser.calls == [('goto', pdl_adapter.URL, pdl_adapter.DOMAIN),
                             ('fill', '#pc-email-login-input', 'person@example.test'),
                             ('click', '#email-login-submit')]


@pytest.mark.parametrize('change', ['site', 'extra', 'email', 'action', 'request', 'identity'])
def test_unapproved_payload_does_not_navigate(change):
    p = payload()
    if change == 'site':
        p['site']['optout_url'] = 'https://evil.example/remove'
    elif change == 'extra':
        p['fields']['name'] = 'Example Person'
    elif change == 'email':
        p['fields']['email'] = 'bad\n@example.test'
    elif change == 'action':
        p['action'] = 'confirm'
    elif change == 'request':
        p['request_id'] = 'invalid'
    else:
        p['person']['email'] = 'different@example.test'
    browser = FakeBrowser()
    assert pdl_adapter.execute(p, browser, VISIBILITY_JS)['status'] == 'unsupported'
    assert not browser.calls


def test_old_success_cannot_claim_a_new_email():
    browser = FakeBrowser(initial_success=True)
    assert adapter_execute(payload(), {}, browser)['status'] == 'unsupported'
    assert not any(call[0] in ('fill', 'click') for call in browser.calls)


def test_cross_origin_form_does_not_receive_email():
    browser = FakeBrowser(form='https://evil.example/remove')
    assert adapter_execute(payload(), {}, browser)['status'] == 'unsupported'
    assert not browser.address


def test_redirect_after_fill_prevents_submit():
    browser = FakeBrowser(redirect='https://evil.example/remove')
    assert adapter_execute(payload(), {}, browser)['status'] == 'unsupported'
    assert not browser.clicked


def test_unconfirmed_write_does_not_claim_success(monkeypatch):
    monkeypatch.setattr(pdl_adapter.time, 'sleep', lambda _: None)
    assert adapter_execute(payload(), {}, FakeBrowser(accepted=False))['status'] == 'pending'


@pytest.mark.parametrize('url', ['http://privacy.peopledatalabs.com/policies',
    'https://privacy.peopledatalabs.com.evil.example/policies',
    'https://evil.privacy.peopledatalabs.com/policies',
    'https://user@privacy.peopledatalabs.com/policies',
    'https://privacy.peopledatalabs.com:444/policies', 'https://privacy.peopledatalabs.com/account'])
def test_portal_origin_is_exact(url):
    assert not pdl_adapter.on_portal(url)


@pytest.mark.parametrize('query', ['', '?modal=log-in', '?action=ERASURE',
    '?action=ACCESS&modal=log-in', '?action=ERASURE&action=ACCESS&modal=log-in',
    '?action=ERASURE&action=ERASURE&modal=log-in', '?action=&modal=log-in',
    '?action=ERASURE&modal=log-in&modal=log-in', '?action=ERASURE&modal=access',
    '?action=ERASURE&modal=log-in&redirect=ACCESS', '?action=ERASURE&modal=log-in#ACCESS'])
@pytest.mark.parametrize('target', ['url', 'form'])
def test_wrong_portal_action_never_receives_email(query, target):
    url = 'https://privacy.peopledatalabs.com/policies' + query
    browser = FakeBrowser(**{target: url})
    assert adapter_execute(payload(), {}, browser)['status'] == 'unsupported'
    assert not browser.address and not browser.clicked


def test_portal_query_order_does_not_change_approved_action():
    assert pdl_adapter.on_portal('https://privacy.peopledatalabs.com/policies?modal=log-in&action=ERASURE')


def test_action_change_after_fill_prevents_submit():
    browser = FakeBrowser(redirect='https://privacy.peopledatalabs.com/policies?action=ACCESS&modal=log-in')
    assert adapter_execute(payload(), {}, browser)['status'] == 'unsupported'
    assert not browser.clicked


def test_wrong_action_success_after_click_is_not_accepted():
    browser = FakeBrowser(post_click_url='https://privacy.peopledatalabs.com/policies?action=ACCESS&modal=log-in')
    assert adapter_execute(payload(), {}, browser)['status'] == 'pending'


@pytest.fixture
def worker(tmp_path, monkeypatch):
    store.init_db(tmp_path / 'live', mode='live')
    clock = [dt.datetime(2026, 10, 29, tzinfo=dt.timezone.utc)]
    monkeypatch.setattr(automation, 'now', lambda: clock[0])
    monkeypatch.setattr(engine, 'plan', lambda user: form_routes.plans())
    monkeypatch.setattr(adapters, 'configured', lambda: True)
    monkeypatch.setattr(auth, 'send_mail', lambda *a, **kw: pytest.fail('SMTP must not run'))
    with store.connect() as db:
        db.execute("INSERT INTO users(id,name,age,email,verified,authorized_at,created_at) "
                   "VALUES('u','Example Person',35,'person@example.test',1,?,?)", (clock[0].isoformat(),) * 2)
    calls = []
    def invoke(p):
        calls.append(p)
        return {'status': 'verification_sent', 'request_id': p['request_id'], 'route_verified': True}
    monkeypatch.setattr(adapters, 'invoke', invoke)
    return automation.Worker(), clock, calls


def row(table):
    with store.connect() as db:
        return dict(db.execute('SELECT * FROM ' + table).fetchone())


def initiate(worker):
    service, clock, calls = worker
    service.run_once()
    clock[0] += dt.timedelta(seconds=3)
    service.run_once()
    return service, clock, calls


def test_initiation_has_no_discovery_request_or_removal_count(worker):
    service, clock, calls = initiate(worker)
    job, item = row('jobs'), row('items')
    assert len(calls) == 1 and calls[0]['fields'] == {'email': 'person@example.test'}
    assert item['status'] == 'needs_broker_step' and item['url'] == pdl_adapter.URL
    assert job['form_started_at'] and not job['first_submitted_at'] and not job['submitted_at']
    assert not job['matched'] and not job['last_verified_removed']
    assert job['next_at'] is None
    service.request_run('u')
    service.profile_changed('u')
    service.run_once()
    assert len(calls) == 1


def test_user_report_is_not_verified_removal(worker):
    service, _, calls = initiate(worker)
    assert service.confirmation_completed('u', form_routes.PDL['id'])
    assert row('items')['status'] == 'unverified'
    assert row('jobs')['phase'] == 'done'
    assert not row('jobs')['first_submitted_at'] and not row('jobs')['last_verified_removed']
    service.request_run('u')
    service.run_once()
    assert len(calls) == 1


def test_unstarted_or_wrong_user_cannot_report_completion(worker):
    service, _, _ = worker
    service.run_once()
    assert not service.confirmation_completed('u', form_routes.PDL['id'])
    assert not service.confirmation_completed('another', form_routes.PDL['id'])


def test_unknown_write_result_is_held_without_repeat(worker, monkeypatch):
    service, clock, calls = worker
    def fail(p):
        calls.append(p)
        raise adapters.AdapterError('private provider failure')
    monkeypatch.setattr(adapters, 'invoke', fail)
    service.run_once()
    clock[0] += dt.timedelta(seconds=3)
    service.run_once()
    assert row('jobs')['phase'] == 'uncertain'
    service.request_run('u')
    service.run_once()
    assert len(calls) == 1
