const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the browser entry point with a small DOM and a fake local API. No
// browser timers execute, and no broker or mailbox is contacted.
class Element {
  constructor(id = '') {
    this.id = id;
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.value = '';
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.queries = new Map();
    this.classList = { toggle() {} };
    this.dataset = {};
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  removeAttribute(key) { this.attributes.delete(key); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  querySelector(selector) {
    if (!this.queries.has(selector)) this.queries.set(selector, new Element(selector));
    return this.queries.get(selector);
  }
  focus() {}
  closest(selector) { return this.querySelector(selector); }
}

async function boot({ manual = true, localOnly = false, signedIn = true, fragment = '', questions = [], items = [] } = {}) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  const filters = ['all', 'pending', 'removed', 'blocked'].map(name => {
    const e = new Element(name); e.dataset.filter = name; return e;
  });
  const counters = { scheduled: 0, dashboardReads: 0, runs: 0, exchanges: 0, confirmations: 0 };
  const location = { hash: fragment, pathname: '/', search: '' };
  const history = { replaceState(_state, _title, url) { assert.equal(url, '/'); location.hash = ''; } };
  const campaign = { status: 'active', run_in_progress: false, next_check_at: '2027-01-01T00:00:00Z' };
  const document = {
    hidden: false, activeElement: null,
    getElementById: get,
    createElement: () => new Element(),
    createDocumentFragment: () => new Element(),
    querySelectorAll: selector => selector === '[data-filter]' ? filters : [],
    addEventListener() {}
  };
  const context = {
    document, URL, console, location, history,
    setTimeout: () => { counters.scheduled += 1; return counters.scheduled; },
    clearTimeout() {},
    fetch: async (url, options = {}) => {
      let data;
      if (url === '/api/config') {
        if (fragment.startsWith('#local-session=')) assert.equal(location.hash, '', 'Token must be removed before any request');
        data = { manual, local_only: localOnly, mode: manual ? 'live' : 'demo', email_configured: !localOnly, automation_configured: true };
      } else if (url === '/api/dashboard') {
        counters.dashboardReads += 1;
        if (!signedIn) return { ok: false, status: 401, json: async () => ({ error: 'No profile yet' }) };
        data = { profile: { name: 'Example Person', email: 'person@example.test' }, campaign: { ...campaign },
          mode: manual ? 'live' : 'demo', counts: { removed: 0 }, items, questions, activity: [] };
      } else if (url === '/api/local-session') {
        assert.equal(localOnly, true);
        counters.exchanges += 1;
        assert.match(JSON.parse(options.body).token, /^[A-Za-z0-9_-]{20,100}$/);
        signedIn = true; data = { ok: true };
      } else if (url === '/api/confirmation') {
        assert.equal(JSON.parse(options.body).site_id, 'example-broker');
        counters.confirmations += 1;
        const item = items.find(entry => entry.site_id === JSON.parse(options.body).site_id);
        if (item?.status === 'needs_broker_step') item.status = 'unverified';
        else campaign.run_in_progress = true;
        data = { ok: true };
      } else if (url === '/api/signup') {
        signedIn = true; data = { ok: true };
      } else if (url === '/api/campaign' && options.method === 'POST') {
        counters.runs += 1;
        campaign.run_in_progress = true;
        data = { ok: true };
      } else throw new Error(`Unexpected request: ${url}`);
      return { ok: true, json: async () => data };
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../webapp/static/app.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { get, counters, campaign, filters };
}

test('manual mode never schedules polling and refresh only reads status', async () => {
  const { get, counters } = await boot();
  assert.equal(counters.scheduled, 0);
  assert.equal(get('campaign-status').textContent, 'On demand');
  assert.equal(get('next-check-label').textContent, 'CHECKS ON DEMAND');
  assert.match(get('next-check-date').textContent, /No recurring checks/);
  assert.equal(get('refresh-button').hidden, false);
  await get('refresh-button').listeners.get('click')();
  assert.equal(counters.dashboardReads, 2);
  assert.equal(counters.runs, 0);
  assert.equal(counters.scheduled, 0);
});

test('explicit run stays disabled while backend reports the batch active', async () => {
  const { get, counters } = await boot();
  await get('run-button').listeners.get('click')();
  assert.equal(counters.runs, 1);
  assert.equal(get('run-button').disabled, true);
  assert.equal(get('run-button').textContent, 'Check running');
  assert.equal(counters.scheduled, 0);
});

test('broker reply questions do not display an unrelated location form', async () => {
  const { get } = await boot({ questions: [{ field: 'email_reply_pdl', prompt: 'Review the broker reply.' }] });
  assert.equal(get('reply-attention-panel').hidden, false);
  assert.equal(get('clarification-panel').hidden, true);
  assert.equal(get('reply-questions').children[0].textContent, 'Review the broker reply.');
});

test('broker-reported completion remains separate from verified removals', async () => {
  const { get, filters } = await boot({ items: [{ name: 'Example Broker', status: 'broker_reported_completed' }] });
  const row = get('listing-items').children[0].children[0];
  assert.equal(row.children[2].children[0].textContent, 'Broker reports completion');
  assert.equal(get('count-removed').textContent, '0');
  filters.find(e => e.dataset.filter === 'removed').listeners.get('click')();
  assert.equal(get('listing-items').children[0].children.length, 0);
});

test('synthetic demonstration may still refresh its simulated progress', async () => {
  const { counters } = await boot({ manual: false });
  assert.equal(counters.scheduled, 1);
});


test('local-only signup creates a profile without inbox verification or login links', async () => {
  const { get, counters } = await boot({ localOnly: true, signedIn: false });
  assert.equal(get('show-login').closest('.login-switch').hidden, true);
  assert.match(get('signup-panel').querySelector('.card-footnote').textContent, /No inbox connection/);
  get('signup-name').value = 'Example Person';
  get('signup-age').value = '30';
  get('signup-email').value = 'example@example.test';
  get('signup-consent').checked = true;
  await get('signup-form').listeners.get('submit')({ preventDefault() {}, submitter: new Element() });
  assert.equal(get('dashboard-view').hidden, false);
  assert.equal(get('verification-panel').hidden, true);
  assert.equal(get('logout-button').hidden, true);
  assert.equal(counters.scheduled, 0);
});


test('local recovery exchanges a fragment token only after clearing the address bar', async () => {
  const { get, counters } = await boot({ localOnly: true, signedIn: false,
    fragment: '#local-session=fixture-token-not-a-secret-1234567890' });
  assert.equal(counters.exchanges, 1);
  assert.equal(get('dashboard-view').hidden, false);
  assert.equal(counters.scheduled, 0);
});

test('non-local mode never exchanges a recovery fragment credential', async () => {
  const { counters } = await boot({ localOnly: false,
    fragment: '#local-session=fixture-token-not-a-secret-1234567890' });
  assert.equal(counters.exchanges, 0);
});

test('broker email-step acknowledgment starts a check without claiming removal', async () => {
  const { get, counters } = await boot({ localOnly: true, items: [
    { site_id: 'example-broker', name: 'Example Broker', status: 'awaiting_confirmation' }
  ] });
  const row = get('listing-items').children[0].children[0];
  const confirmation = row.children[1].children.at(-1);
  assert.equal(confirmation.textContent, 'I completed the broker email step');
  await confirmation.listeners.get('click')();
  assert.equal(counters.confirmations, 1);
  assert.equal(get('count-removed').textContent, '0');
  assert.match(get('campaign-feedback').textContent, /removal is not yet verified/);
  assert.equal(counters.scheduled, 0);
});

test('broker portal completion stays unverified without a request or removal count', async () => {
  const { get, counters, filters } = await boot({ localOnly: true, items: [
    { site_id: 'example-broker', name: 'Example Broker', status: 'needs_broker_step', url: 'https://privacy.example.test/portal' }
  ] });
  filters.find(e => e.dataset.filter === 'blocked').listeners.get('click')();
  const row = get('listing-items').children[0].children[0];
  assert.equal(row.children[2].children[0].textContent, 'Complete broker steps');
  assert.equal(row.children[1].children[0].href, 'https://privacy.example.test/portal');
  const confirmation = row.children[1].children.at(-1);
  assert.equal(confirmation.textContent, 'I completed the broker steps');
  await confirmation.listeners.get('click')();
  assert.equal(counters.confirmations, 1);
  assert.equal(get('count-found').textContent, '0');
  assert.equal(get('count-requested').textContent, '0');
  assert.equal(get('count-removed').textContent, '0');
  assert.match(get('campaign-feedback').textContent, /Your report.*recorded.*Deletion has not been verified/);
  assert.doesNotMatch(get('campaign-feedback').textContent, /check has started/);
  filters.find(e => e.dataset.filter === 'all').listeners.get('click')();
  const updated = get('listing-items').children[0].children[0];
  assert.equal(updated.children[2].children[0].textContent, 'Completion not verified');
  assert.equal(updated.children[1].children.some(e => e.className?.includes('broker-confirmation')), false);
  filters.find(e => e.dataset.filter === 'removed').listeners.get('click')();
  assert.equal(get('listing-items').children[0].children.length, 0);
  assert.equal(counters.scheduled, 0);
});
