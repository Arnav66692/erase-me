const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the browser entry point with a small DOM and a fake local API. No
// browser timers execute, and no broker or mailbox is contacted.
class Element {
  constructor(id = '', tag = 'div', ownerDocument = null) {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
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
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...children); }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  matches(selector) {
    if (selector.startsWith('.')) return (this.className || '').split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return this.tagName === selector.toUpperCase();
  }
  querySelectorAll(selector) {
    const selectors = selector.split(',').map(value => value.trim());
    const matches = [];
    const visit = parent => {
      for (const child of parent.children) {
        if (selectors.some(value => {
          if (value.includes(' > ')) { const [ancestor, target] = value.split(' > '); return child.matches(target) && child.parentElement.matches(ancestor); }
          return child.matches(value);
        })) matches.push(child);
        visit(child);
      }
    };
    visit(this); return matches;
  }
  querySelector(selector) {
    const actual = this.querySelectorAll(selector)[0];
    if (actual) return actual;
    if (!this.queries.has(selector)) this.queries.set(selector, new Element(selector));
    return this.queries.get(selector);
  }
  contains(element) { return Boolean(element && (element === this || this.children.some(child => child.contains(element)))); }
  focus() { if (this.ownerDocument) { this.ownerDocument.activeElement = this; this.ownerDocument.dispatch('focusin', { target: this }); } }
  closest(selector) {
    for (let element = this; element; element = element.parentElement) if (element.matches(selector)) return element;
    return selector === '.login-switch' ? this.querySelector(selector) : null;
  }
}

async function boot({ publicMarker = false, browserWorkspace = false, manual = true, localOnly = false, signedIn = true, fragment = '', questions = [], items = [], decorate = null, tools = null } = {}) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element(id, 'div', document));
    return elements.get(id);
  };
  const filters = ['all', 'pending', 'removed', 'blocked'].map(name => {
    const e = new Element(name); e.dataset.filter = name; return e;
  });
  const counters = { requests: 0, scheduled: 0, dashboardReads: 0, runs: 0, exchanges: 0, confirmations: 0 };
  const location = { hash: fragment, pathname: '/', search: '' };
  const history = { replaceState(_state, _title, url) { assert.equal(url, '/'); location.hash = ''; } };
  const campaign = { status: 'active', run_in_progress: false, next_check_at: '2027-01-01T00:00:00Z' };
  const documentListeners = new Map();
  let dashboardGate = null;
  const document = {
    hidden: false, activeElement: null, documentElement: { dataset: { browserWorkspace: publicMarker ? 'true' : '' } },
    getElementById: get,
    createElement: tag => new Element('', tag, document),
    createDocumentFragment: () => new Element('', 'fragment', document),
    querySelectorAll: selector => selector === '[data-filter]' ? filters : [],
    addEventListener(type, callback) { documentListeners.set(type, callback); },
    dispatch(type, event = {}) { return documentListeners.get(type)?.(event); }
  };
  document.body = new Element('', 'body', document);
  document.activeElement = document.body;
  for (const button of filters) button.ownerDocument = document;
  const context = {
    document, URL, console, location, history,
    setTimeout: () => { counters.scheduled += 1; return counters.scheduled; },
    clearTimeout() {},
    fetch: async (url, options = {}) => {
      counters.requests += 1;
      let data;
      if (url === '/api/config') {
        if (fragment.startsWith('#local-session=')) assert.equal(location.hash, '', 'Token must be removed before any request');
        data = { manual, browser_workspace: browserWorkspace, local_only: localOnly, mode: manual ? 'live' : 'demo', email_configured: !localOnly, automation_configured: true };
      } else if (url === '/api/dashboard') {
        counters.dashboardReads += 1;
        if (dashboardGate) await dashboardGate;
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
  if (decorate || tools) context.EraseWorkspaceUI = { decorate: () => decorate?.(document, items), tools: () => tools?.(document), configure() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../webapp/static/app.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { get, counters, campaign, filters, document, delayDashboard() {
    let release;
    dashboardGate = new Promise(resolve => { release = resolve; });
    return () => { dashboardGate = null; release(); };
  } };
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

test('preparing a browser route plan keeps its label after the action finishes', async () => {
  const { get, counters } = await boot({ browserWorkspace: true });
  assert.equal(get('run-button').textContent, 'Prepare route plan');
  await get('run-button').listeners.get('click')();
  assert.equal(get('run-button').textContent, 'Prepare route plan');
  assert.match(get('campaign-feedback').textContent, /No broker has been contacted/);
  assert.equal(counters.scheduled, 0);
});

function decorateRoute(document, items) {
  for (const row of document.getElementById('listing-items').querySelectorAll('.listing-item')) {
    const item = items.find(entry => entry.site_id === row.dataset.siteId);
    const details = document.createElement('details'); details.className = 'public-broker-steps';
    const summary = document.createElement('summary'); summary.textContent = 'Request steps';
    const input = document.createElement('input'); input.setAttribute('aria-label', 'Own listing URL');
    const approval = document.createElement('input'); approval.type = 'checkbox'; approval.checked = false;
    const action = document.createElement('button');
    action.textContent = item.held ? 'Resume this route' : 'Hold this route';
    details.append(summary, input, approval, action);
    if (!item.operation_id) {
      const fill = document.createElement('button'); fill.textContent = 'Fill with companion'; details.append(fill);
    }
    const review = document.createElement('details'); review.className = 'public-route-review';
    const reviewSummary = document.createElement('summary'); reviewSummary.textContent = 'Current route review';
    review.append(reviewSummary); details.append(review);
    row.querySelector('.listing-info').append(details);
  }
}
const routeItem = () => ({ site_id: 'example-broker', name: 'Example Broker', status: 'ready', url: 'https://broker.example/optout' });

test('returning to a browser workspace preserves unfinished fields without a status refresh', async () => {
  const { get, counters, document } = await boot({ browserWorkspace: true, items: [routeItem()], decorate: decorateRoute });
  const details = get('listing-items').querySelector('details'); details.open = true;
  const input = details.querySelector('input'); input.value = 'https://broker.example/my-own-record'; input.focus();
  const approval = details.querySelectorAll('input')[1]; approval.checked = true;
  document.hidden = true; document.dispatch('visibilitychange');
  document.hidden = false; await document.dispatch('visibilitychange');
  assert.equal(counters.dashboardReads, 1);
  assert.equal(get('listing-items').querySelector('details'), details);
  assert.equal(input.value, 'https://broker.example/my-own-record');
  assert.equal(approval.checked, true); assert.equal(details.open, true);
  await get('refresh-button').listeners.get('click')();
  assert.equal(counters.dashboardReads, 2, 'Explicit refresh remains available');
});

test('returning to a local service still reads its current status without scheduling work', async () => {
  const { document, counters } = await boot();
  document.hidden = true; document.dispatch('visibilitychange');
  document.hidden = false; await document.dispatch('visibilitychange');
  assert.equal(counters.dashboardReads, 2); assert.equal(counters.runs, 0); assert.equal(counters.scheduled, 0);
});

test('route updates preserve expanded sections and keyboard focus without restoring fields or approvals', async () => {
  const item = routeItem();
  const { get, document, delayDashboard } = await boot({ browserWorkspace: true, items: [item], decorate: decorateRoute });
  const before = get('listing-items').querySelector('details'); before.open = true;
  before.querySelector('.public-route-review').open = true;
  before.querySelector('input').value = 'Unsaved reference';
  before.querySelectorAll('input')[1].checked = true;
  const hold = before.querySelector('button'); hold.focus(); hold.disabled = true;
  document.activeElement = document.body; // Chromium can blur an action when it becomes disabled.
  item.held = true; item.status = 'held';
  const release = delayDashboard(), pending = document.dispatch('erase-workspace-change');
  hold.disabled = false; // The action wrapper finishes before the API response.
  release(); await pending;
  const after = get('listing-items').querySelector('details');
  assert.notEqual(after, before); assert.equal(after.open, true);
  assert.equal(after.querySelector('.public-route-review').open, true);
  assert.equal(document.activeElement.textContent, 'Resume this route');
  assert.equal(after.querySelector('input').value, '');
  assert.equal(after.querySelectorAll('input')[1].checked, false);
  item.held = false; item.status = 'ready';
  await document.dispatch('erase-workspace-change');
  assert.equal(document.activeElement.textContent, 'Hold this route');
});

test('a disappearing route action falls back to its summary without stealing unrelated focus', async () => {
  const item = routeItem();
  const { get, document } = await boot({ browserWorkspace: true, items: [item], decorate: decorateRoute });
  const details = get('listing-items').querySelector('details'); details.open = true;
  details.querySelectorAll('button')[1].focus();
  item.operation_id = 'fixture-operation';
  await document.dispatch('erase-workspace-change');
  assert.equal(document.activeElement.textContent, 'Request steps');
  get('refresh-button').focus();
  await get('refresh-button').listeners.get('click')();
  assert.equal(document.activeElement, get('refresh-button'));
  get('profile-city').focus();
  await document.dispatch('erase-workspace-change');
  assert.equal(document.activeElement, get('profile-city'));
});

test('browser route links are announced as official routes rather than matched listings', async () => {
  const { get } = await boot({ browserWorkspace: true, items: [routeItem()] });
  const title = get('listing-items').querySelector('.listing-title');
  assert.equal(title.getAttribute('aria-label'), 'Example Broker — open official broker route in a new tab');
});

test('an intentional focus change during a route refresh is not replaced by the initiating action', async () => {
  const item = routeItem();
  const { get, document, delayDashboard } = await boot({ browserWorkspace: true, items: [item], decorate: decorateRoute });
  const hold = get('listing-items').querySelector('button'); hold.focus(); hold.disabled = true;
  document.activeElement = document.body;
  const release = delayDashboard(), pending = document.dispatch('erase-workspace-change');
  hold.disabled = false; get('profile-city').focus();
  release(); await pending;
  assert.equal(document.activeElement, get('profile-city'));
});

test('holding the last in-progress route returns focus to its selected filter', async () => {
  const item = routeItem();
  const { get, filters, document, delayDashboard } = await boot({ browserWorkspace: true, items: [item], decorate: decorateRoute });
  const pendingFilter = filters.find(button => button.dataset.filter === 'pending');
  pendingFilter.focus(); pendingFilter.listeners.get('click')();
  const hold = get('listing-items').querySelector('button'); hold.focus(); hold.disabled = true;
  document.activeElement = document.body; item.held = true; item.status = 'held';
  const release = delayDashboard(), pending = document.dispatch('erase-workspace-change');
  hold.disabled = false; release(); await pending;
  assert.equal(get('listing-items').querySelectorAll('.listing-item').length, 0);
  assert.equal(document.activeElement, pendingFilter);
});

test('workspace tools retain button focus after an explicit availability update', async () => {
  const tools = document => {
    const action = document.createElement('button'); action.textContent = 'Check removal-mail availability';
    document.getElementById('public-tools').replaceChildren(action);
  };
  const { get, document, delayDashboard } = await boot({ browserWorkspace: true, tools });
  const before = get('public-tools').querySelector('button'); before.focus(); before.disabled = true;
  document.activeElement = document.body;
  const release = delayDashboard(), pending = document.dispatch('erase-workspace-change');
  before.disabled = false; release(); await pending;
  const after = get('public-tools').querySelector('button');
  assert.notEqual(after, before); assert.equal(document.activeElement, after); assert.equal(after.disabled, false);
  get('profile-city').focus();
  await document.dispatch('erase-workspace-change');
  assert.equal(document.activeElement, get('profile-city'));
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


test('hosted workspace fails closed when its local core script is unavailable', async () => {
  const { get, counters } = await boot({ publicMarker: true, signedIn: false });
  assert.equal(counters.requests, 0);
  get('signup-name').value = 'Example Person';
  get('signup-email').value = 'person@example.test';
  get('signup-age').value = '35';
  get('signup-consent').checked = true;
  await get('signup-form').listeners.get('submit')({ preventDefault() {}, submitter: new Element() });
  assert.equal(counters.requests, 0, 'Personal fields must never fall back to hosting API');
});


test('Needs you includes held routes, broker verification and interrupted outcomes', async () => {
  for (const status of ['held', 'verification_sent', 'uncertain']) {
    const { get, filters } = await boot({ items: [{ site_id: 'example-broker', name: 'Example Broker', status }] });
    filters.find(e => e.dataset.filter === 'blocked').listeners.get('click')();
    assert.equal(get('listing-items').children[0].children.length, 1);
    filters.find(e => e.dataset.filter === 'pending').listeners.get('click')();
    assert.equal(get('listing-items').children[0].children.length, 0);
  }
});

test('a held route title never opens the broker even when its prior outcome remains visible', async () => {
  for (const item of [
    { status: 'held' },
    { status: 'needs_broker_step', held: true }
  ]) {
    const { get } = await boot({ items: [{ site_id: 'example-broker', name: 'Example Broker', url: 'https://broker.example/optout', ...item }] });
    const title = get('listing-items').children[0].children[0].children[1].children[0];
    assert.equal(title.textContent, 'Example Broker');
    assert.equal(title.href, undefined);
    assert.equal(title.target, undefined);
  }
});
