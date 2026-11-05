'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../webapp/static/workspace-core.js');
const Routes = require('../webapp/static/broker-routes.js');

function fixture() {
  const values = new Map([['unrelated-key', 'keep']]);
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  let id = 0;
  const options = { storage, uuid: () => 'test-operation-' + ++id, now: () => '2026-11-04T23:00:00.000Z' };
  return { storage, values, options, core: Core.create(options) };
}
const signup = core => core.api('/api/signup', { method: 'POST', body: JSON.stringify({ name: 'Example Person', age: 35, email: 'person@example.test', authorized: true }) });
const post = (core, path, value) => core.api(path, { method: 'POST', body: JSON.stringify(value) });
const PDL = 'peopledatalabs-form';

test('public config is real browser-only, manual and does not claim an inbox connection', async () => {
  const { core, values } = fixture();
  const config = await (await core.api('/api/config')).json();
  assert.equal(config.browser_workspace, true); assert.equal(config.mode, 'browser');
  assert.equal(config.manual, true); assert.equal(config.synthetic_only, false); assert.equal(config.email_configured, false);
  assert.equal(values.has(Core.KEY), false);
});

test('signup accepts a real typed profile locally without OTP, ownership proof or external effects', async () => {
  const { core, values } = fixture();
  assert.equal((await signup(core)).ok, true);
  const profile = core.profile();
  assert.equal(profile.email, 'person@example.test'); assert.equal(profile.email_verified, false);
  assert.equal(profile.verification_method, 'self_attested_browser'); assert.equal(profile.id, 'test-operation-1');
  assert.equal(core.dashboard().items.length, Routes.filter(route => route.countries.includes('*')).length);
  assert.deepEqual(core.dashboard().counts, { found: 0, requested: 0, removed: 0, blocked: 0 });
  assert.equal(core.dashboard().campaign.next_check_at, null);
  assert.equal(JSON.parse(values.get(Core.KEY)).profile.email, profile.email);
});

test('consent, adult age and valid email are required and validation leaves no profile', async () => {
  for (const change of [{ authorized: false }, { age: 17 }, { age: 35.5 }, { email: 'a\n@example.test' }]) {
    const { core } = fixture();
    const response = await post(core, '/api/signup', { name: 'Example Person', age: 35, email: 'person@example.test', authorized: true, ...change });
    assert.equal(response.status, 400); assert.equal(core.snapshot().profile, null);
  }
});

test('an existing local profile cannot be replaced just by entering its email', async () => {
  const { core } = fixture(); await signup(core);
  assert.equal((await signup(core)).status, 409);
  assert.equal((await post(core, '/api/login', { email: 'person@example.test' })).status, 404);
});

test('run, resume, location and refresh never create a broker operation', async () => {
  const { core } = fixture(); await signup(core);
  await post(core, '/api/campaign', { action: 'run' });
  await post(core, '/api/campaign', { action: 'pause' });
  await post(core, '/api/campaign', { action: 'resume' });
  await post(core, '/api/profile', { country: 'us', region: 'US-CA', city: 'Example City' });
  await core.api('/api/dashboard');
  assert.ok(core.dashboard().items.every(item => item.status === 'ready' && item.operation_id === null));
  assert.equal(core.profile().country, 'US');
});

test('opening a portal does not count as discovery, submission or deletion', async () => {
  const { core } = fixture(); await signup(core); core.opened(PDL);
  assert.equal(core.dashboard().items[0].status, 'opened');
  assert.deepEqual(core.dashboard().counts, { found: 0, requested: 0, removed: 0, blocked: 0 });
});

test('preparation saves operation identity before companion dispatch and cannot be repeated', async () => {
  const { core, values } = fixture(); await signup(core);
  const operation = core.prepare(PDL);
  assert.deepEqual(operation.fields, { email: 'person@example.test' });
  assert.equal(operation.routeId, PDL); assert.equal(operation.authorized, true);
  assert.equal(JSON.parse(values.get(Core.KEY)).items[PDL].operation_id, operation.operationId);
  assert.equal(core.dashboard().items[0].status, 'running');
  assert.throws(() => core.prepare(PDL), /already started/);
});

test('reopening an interrupted action becomes uncertain and preserves the no-resend guard', async () => {
  const { core, options } = fixture(); await signup(core); const operation = core.prepare(PDL);
  const reopened = Core.create(options);
  assert.equal(reopened.dashboard().items[0].status, 'uncertain');
  assert.equal(reopened.dashboard().items[0].operation_id, operation.operationId);
  assert.throws(() => reopened.prepare(PDL), /already started/);
});

test('companion preparation is a manual broker step with no request acceptance', async () => {
  const { core } = fixture(); await signup(core); const operation = core.prepare(PDL);
  core.recordCompanion(PDL, operation.operationId, { status: 'prepared' });
  assert.equal(core.dashboard().items[0].status, 'needs_broker_step');
  assert.equal(core.dashboard().counts.requested, 0); assert.equal(core.dashboard().counts.removed, 0);
});

test('verification initiation requires fresh visible evidence and is not a deletion request', async () => {
  const { core } = fixture(); await signup(core); const operation = core.prepare(PDL);
  core.recordCompanion(PDL, operation.operationId, { status: 'verification_sent', route_verified: true, evidence: 'fresh_visible_success' });
  assert.equal(core.dashboard().items[0].status, 'verification_sent');
  assert.equal(core.dashboard().counts.requested, 0); assert.equal(core.dashboard().counts.removed, 0);
  assert.throws(() => core.prepare(PDL), /already started/);
});

test('missing success evidence, wrong operation and forged removed results cannot establish removal', async () => {
  const { core } = fixture(); await signup(core); const operation = core.prepare(PDL);
  assert.throws(() => core.recordCompanion(PDL, 'wrong', { status: 'submitted' }), /does not match/);
  assert.throws(() => core.recordCompanion(PDL, operation.operationId, { status: 'removed', route_verified: true }), /unsupported result/);
  core.recordCompanion(PDL, operation.operationId, { status: 'submitted' });
  assert.equal(core.dashboard().items[0].status, 'uncertain');
  assert.equal(core.dashboard().counts.requested, 0); assert.equal(core.dashboard().counts.removed, 0);
});

test('a matching delayed companion result can settle an unknown operation without resubmission', async () => {
  const { core } = fixture(); await signup(core); const operation = core.prepare(PDL);
  core.recordCompanion(PDL, operation.operationId, { status: 'unknown' });
  core.recordCompanion(PDL, operation.operationId, { status: 'verification_sent', route_verified: true, evidence: 'fresh_visible_success' });
  assert.equal(core.dashboard().items[0].status, 'verification_sent');
  assert.throws(() => core.prepare(PDL), /already started/);
});

test('submission acceptance is separate from user completion and verified removal', async () => {
  const { core } = fixture(); await signup(core); const operation = core.prepare(PDL);
  core.recordCompanion(PDL, operation.operationId, { status: 'submitted', route_verified: true, evidence: 'fresh_visible_success' });
  assert.equal(core.dashboard().counts.requested, 1);
  core.recordUser(PDL, 'user_reported_completed');
  assert.equal(core.dashboard().items[0].status, 'user_reported_completed');
  assert.equal(core.dashboard().counts.requested, 1); assert.equal(core.dashboard().counts.removed, 0);
});

test('user reports never become verified or accepted broker evidence', async () => {
  const { core } = fixture(); await signup(core);
  core.recordUser(PDL, 'user_reported_requested');
  assert.equal(core.dashboard().counts.requested, 0);
  core.recordUser(PDL, 'user_reported_completed');
  assert.equal(core.dashboard().counts.removed, 0);
  assert.throws(() => core.recordUser(PDL, 'removed'), /cannot establish/);
});

test('names are explicit broker fields, never inferred from a full name', async () => {
  const { core } = fixture(); await signup(core); await post(core, '/api/profile', { country: 'US' });
  assert.throws(() => core.prepare('usphonebook'), /first name/);
  core.setEvidence('usphonebook', { first_name: 'Example', last_name: 'Person' });
  const operation = core.prepare('usphonebook');
  assert.deepEqual(operation.fields, { first_name: 'Example', last_name: 'Person', email: 'person@example.test' });
  assert.throws(() => core.setEvidence('usphonebook', { first_name: 'Other' }), /already started/);
});

test('only exact approved broker listing origins and safe paths are accepted', async () => {
  const { core } = fixture(); await signup(core); await post(core, '/api/profile', { country: 'US' });
  for (const listing_url of ['http://www.spokeo.com/Example-Person', 'https://www.spokeo.com.evil.test/Example-Person', 'https://evil.spokeo.com/Example-Person', 'https://person@www.spokeo.com/Example-Person', 'https://www.spokeo.com/optout', 'https://www.spokeo.com/Example-Person?token=secret', 'https://www.spokeo.com:444/Example-Person']) {
    assert.throws(() => core.setEvidence('spokeo', { listing_url }));
  }
  core.setEvidence('spokeo', { listing_url: 'https://www.spokeo.com/Example-Person/California/Example-City/p12345678' },{own_listing:true});
  assert.equal(core.prepare('spokeo').fields.listing_url, 'https://www.spokeo.com/Example-Person/California/Example-City/p12345678');
  assert.throws(() => core.setEvidence('unknown', {}), /supported broker/);
});

test('a paused workspace refuses companion writes and portal launches', async () => {
  const { core } = fixture(); await signup(core); await post(core, '/api/campaign', { action: 'pause' });
  assert.throws(() => core.prepare(PDL), /Allow checks/);
  assert.throws(() => core.opened(PDL), /Allow checks/);
});

test('storage failures surface before a broker operation can be dispatched', async () => {
  const { core, storage } = fixture(); await signup(core);
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => core.prepare(PDL), /could not save/);
  const denied = Core.create({ storage: { getItem() { throw new Error('disabled'); } } });
  assert.equal((await denied.api('/api/dashboard')).status, 503);
});

test('deleting removes only this workspace key and clears the profile', async () => {
  const { core, values } = fixture(); await signup(core);
  const response = await core.api('/api/account', { method: 'DELETE', body: '{"confirm":true}' });
  assert.equal(response.ok, true); assert.equal(values.get('unrelated-key'), 'keep'); assert.equal(values.has(Core.KEY), false);
  assert.equal((await core.api('/api/dashboard')).status, 401);
});

test('export/import retains only self-reported history and cannot import verified deletion', async () => {
  const first = fixture(); await signup(first.core); first.core.opened(PDL);
  const exported = first.core.exportData();
  const second = fixture(); second.core.importData(exported);
  assert.equal(second.core.profile().email_verified, false);
  assert.equal(second.core.dashboard().items[0].status, 'opened');
  assert.equal(second.core.dashboard().counts.requested, 0); assert.equal(second.core.dashboard().counts.removed, 0);
  assert.doesNotThrow(() => second.core.prepare(PDL));
  const data = JSON.parse(exported); data.items[PDL].status = 'removed';
  assert.throws(() => fixture().core.importData(JSON.stringify(data)), /cannot establish/);
  data.items[PDL].status = 'constructor';
  assert.throws(() => fixture().core.importData(JSON.stringify(data)), /cannot establish/);
  data.items.unknown = { status: 'ready' };
  assert.throws(() => fixture().core.importData(JSON.stringify(data)));
});

test('explicit name fields survive a reload and are exposed without sharing mutable state', async () => {
  const { core, options } = fixture(); await signup(core); await post(core, '/api/profile', { country: 'US' });
  core.setEvidence('usphonebook', { first_name: 'Example', last_name: 'Person' });
  const reopened = Core.create(options);
  const item = reopened.dashboard().items.find(row => row.site_id === 'usphonebook');
  assert.deepEqual(item.input_fields, { first_name: 'Example', last_name: 'Person' });
  item.input_fields.first_name = 'Changed';
  assert.equal(reopened.dashboard().items.find(row => row.site_id === 'usphonebook').input_fields.first_name, 'Example');
});

test('another tab deleting the workspace prevents a stale cached profile dispatch', async () => {
  const { core, options } = fixture(); await signup(core);
  const otherTab = Core.create(options); otherTab.dashboard();
  core.remove();
  assert.throws(() => otherTab.prepare(PDL), /Create a workspace/);
  assert.equal((await otherTab.api('/api/dashboard')).status, 401);
});

test('a broker action started in another tab is not resent by a stale cached tab', async () => {
  const { core, options } = fixture(); await signup(core);
  const otherTab = Core.create(options); otherTab.dashboard();
  const routeId = core.snapshot().items[PDL].id;
  const operation = core.prepare(PDL);
  assert.equal(operation.operationId, routeId);
  assert.throws(() => otherTab.prepare(PDL), /already started/);
  assert.equal(otherTab.dashboard().items[0].operation_id, operation.operationId);
});


test('a manual submission report reserves its stable operation and prevents another start', async () => {
  for (const report of ['user_reported_requested', 'user_reported_completed']) {
    const { core, options, values } = fixture(); await signup(core);
    const stableId = core.snapshot().items[PDL].id;
    core.recordUser(PDL, report);
    assert.equal(core.snapshot().items[PDL].operation_id, stableId);
    assert.equal(core.snapshot().items[PDL].operation_started_at, '2026-11-04T23:00:00.000Z');
    assert.throws(() => core.prepare(PDL), /already started/);
    // Legacy/corrupt history must remain held even if its operation field is absent.
    const saved = JSON.parse(values.get(Core.KEY));
    saved.items[PDL].operation_id = null;
    values.set(Core.KEY, JSON.stringify(saved));
    assert.throws(() => Core.create(options).prepare(PDL), /already started/);
  }
});

test('backup roundtrip retains validated location and approved broker inputs before report holds', async () => {
  const source = fixture(); await signup(source.core);
  await post(source.core, '/api/profile', { country: 'us', region: 'US-CA', city: 'Example City' });
  source.core.setEvidence('usphonebook', { first_name: 'Example', last_name: 'Person' });
  source.core.recordUser('usphonebook', 'user_reported_requested');
  source.core.setEvidence('spokeo', { listing_url: 'https://www.spokeo.com/Example-Person/California/Example-City/p12345678' },{own_listing:true});
  const restored = fixture(); restored.core.importData(source.core.exportData());
  const profile = restored.core.profile();
  assert.equal(profile.country, 'US'); assert.equal(profile.region, 'US-CA'); assert.equal(profile.city, 'Example City');
  assert.equal(profile.email_verified, false);
  const item = restored.core.dashboard().items.find(row => row.site_id === 'usphonebook');
  assert.deepEqual(item.input_fields, { first_name: 'Example', last_name: 'Person' });
  assert.equal(item.status, 'user_reported_requested'); assert.throws(() => restored.core.prepare('usphonebook'), /already started/);
  assert.throws(()=>restored.core.prepare('spokeo'),/Confirm that this exact listing/);
  restored.core.setEvidence('spokeo',restored.core.snapshot().items.spokeo.fields,{own_listing:true});
  assert.equal(restored.core.prepare('spokeo').fields.listing_url, 'https://www.spokeo.com/Example-Person/California/Example-City/p12345678');
  assert.equal(restored.core.dashboard().counts.requested, 0); assert.equal(restored.core.dashboard().counts.removed, 0);
});

test('import rejects unknown broker inputs, invalid listing URLs and invalid location before creating a profile', async () => {
  const source = fixture(); await signup(source.core); const exported = JSON.parse(source.core.exportData());
  for (const mutate of [
    data => { data.items.usphonebook.fields = { first_name: 'Example', secret: 'bad' }; },
    data => { data.items.spokeo.fields = { listing_url: 'https://evil.example/Example-Person' }; },
    data => { data.items.usphonebook.fields = { first_name: { value: 'Example' } }; },
    data => { data.profile.country = 'USA'; },
    data => { data.profile.city = { value: 'Example City' }; }
  ]) {
    const data = JSON.parse(JSON.stringify(exported)); mutate(data); const target = fixture();
    assert.throws(() => target.core.importData(JSON.stringify(data)));
    assert.equal(target.core.snapshot().profile, null);
    assert.equal(target.values.has(Core.KEY), false);
  }
});


test('email keeps the local part while normalizing the international domain', async () => {
  const { core } = fixture();
  const response = await post(core, '/api/signup', { name: 'Example Person', age: 35, email: 'CaseSensitive@EXÄMPLE.test', authorized: true });
  assert.equal(response.ok, true);
  assert.equal(core.profile().email, 'CaseSensitive@xn--exmple-cua.test');
  assert.equal(core.prepare(PDL).fields.email, 'CaseSensitive@xn--exmple-cua.test');
  for (const invalid of ['Case@example.test/path', 'Case@example..test', 'Case@example.test:443']) {
    assert.equal((await post(fixture().core, '/api/signup', { name: 'Example Person', age: 35, email: invalid, authorized: true })).status, 400);
  }
});

test('backup retains a valid held operation reference without importing accepted evidence', async () => {
  const source = fixture(); let sequence = 0;
  source.core = Core.create({ ...source.options, uuid: () => (++sequence).toString(16).padStart(32, '0') });
  await signup(source.core); const original = source.core.prepare(PDL);
  source.core.recordCompanion(PDL, original.operationId, { status: 'unknown' });
  const restored = fixture(); restored.core.importData(source.core.exportData());
  const item = restored.core.dashboard().items.find(item => item.site_id === PDL);
  assert.equal(item.operation_id, original.operationId);
  assert.equal(restored.core.snapshot().items[PDL].operation_started_at, source.core.snapshot().items[PDL].operation_started_at);
  assert.equal(item.status, 'uncertain'); assert.equal(item.evidence, null);
  assert.equal(restored.core.dashboard().counts.requested, 0);
  restored.core.recordCompanion(PDL, original.operationId, { status: 'verification_sent', route_verified: true, evidence: 'fresh_visible_success' });
  assert.equal(restored.core.dashboard().items.find(item => item.site_id === PDL).status, 'verification_sent');
  assert.throws(() => restored.core.prepare(PDL), /already started/);
});

function browserTab(storage, locks, uuid) {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const context = { localStorage: storage, crypto: { randomUUID: uuid }, navigator: locks ? { locks } : {}, URL, EraseBrokerRoutes: Routes };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../webapp/static/workspace-core.js'), 'utf8'), context);
  return context.EraseWorkspace;
}
function sharedLocks() {
  let tail = Promise.resolve(), active = 0, maxActive = 0, calls = 0;
  return { manager: { request(name, options, callback) {
    assert.equal(name, Core.KEY + '-write'); assert.equal(options.mode, 'exclusive'); calls += 1;
    const task = tail.then(async () => {
      active += 1; maxActive = Math.max(maxActive, active);
      try { await new Promise(resolve => setImmediate(resolve)); return await callback(); }
      finally { active -= 1; }
    }); tail = task.catch(() => {}); return task;
  } }, maxActive: () => maxActive, calls: () => calls };
}
test('default browser mutations hold one shared cross-tab lock and reread inside it', async () => {
  const { storage, values } = fixture(), locks = sharedLocks(); let sequence = 0;
  const uuid = () => (++sequence).toString(16).padStart(32, '0');
  const a = browserTab(storage, locks.manager, uuid), b = browserTab(storage, locks.manager, uuid);
  assert.equal((await signup(a)).ok, true); b.dashboard();
  const results = await Promise.all([
    post(a, '/api/profile', { country: 'GB', region: 'GB-LND', city: 'London' }),
    b.prepare(PDL),
    a.setEvidence('usphonebook', { first_name: 'Example', last_name: 'Person' })
  ]);
  assert.equal(results[0].ok, true); assert.equal(locks.maxActive(), 1);
  const saved = JSON.parse(values.get(Core.KEY));
  assert.equal(saved.profile.city, 'London'); assert.equal(saved.items[PDL].operation_id, results[1].operationId);
  assert.equal(saved.items.usphonebook.fields.first_name, 'Example');
  await assert.rejects(a.prepare(PDL), /already started/);
  assert.ok(locks.calls() >= 5);
});
test('a browser without Web Locks fails closed before changing workspace state', async () => {
  const { storage, values } = fixture(); const browser = browserTab(storage, null, () => 'a'.repeat(32));
  const response = await signup(browser);
  assert.equal(response.ok, false); assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Web Locks/);
  assert.equal(values.has(Core.KEY), false);
  await assert.rejects(browser.prepare(PDL), /Web Locks/);
});
test('default read-only access does not write recovery state outside the lock', async () => {
  const { core, storage, values } = fixture(); await signup(core); const operation = core.prepare(PDL);
  const before = values.get(Core.KEY), browser = browserTab(storage, sharedLocks().manager, () => 'b'.repeat(32));
  assert.equal(browser.dashboard().items.find(item => item.site_id === PDL).operation_id, operation.operationId);
  assert.equal(values.get(Core.KEY), before);
});

function workspaceUIFixture(config={}) {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  class Element {
    constructor() { this.children = []; this.listeners = {}; this.className = ''; this.textContent = ''; this.value = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children=[...nodes]; }
    addEventListener(type, action) { this.listeners[type] = action; }
    setAttribute(key,value) { (this.attributes ||= new Map()).set(key,value); }
  }
  const route = Routes.find(route => route.id === (config.routeId||'usphonebook'));
  const title = new Element(); title.textContent = route.name;
  const info = new Element(), row = new Element(); row.querySelector = selector => selector === '.listing-title' ? title : info;
  const listing = new Element(); listing.children = [row];
  const feedback = new Element(), toolbox=new Element(), elements = new Map([['listing-items', listing], ['campaign-feedback', feedback],['public-tools',toolbox]]);
  const posted = [], changes = [], opened = [], listeners = new Map();
  let resolveSave, resolvePrepare, resolveResult, resolveOpen, rejectOpen;
  const saveGate = new Promise(resolve => { resolveSave = resolve; });
  const prepareGate = new Promise(resolve => { resolvePrepare = resolve; });
  const resultGate = new Promise(resolve => { resolveResult = resolve; });
  const openGate = new Promise((resolve, reject) => { resolveOpen = resolve; rejectOpen = reject; });
  const calls = { saves: 0, prepares: 0, results: 0 };
  const workspace = { routes: () => [route], profile: () => ({ email: 'person@example.test' }),
    setEvidence: () => { calls.saves++; return saveGate; }, prepare: () => { calls.prepares++; return prepareGate; },
    recordCompanion: () => { calls.results++; return resultGate; }, opened: () => openGate,
    dashboard:()=>({coverage:null}),...config.workspace };
  const window = {
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: type => listeners.delete(type),
    postMessage(data, origin) {
      posted.push(data.payload.action);
      queueMicrotask(() => listeners.get('message')?.({ source: window, origin, data: { source: 'erase-companion', requestId: data.requestId,
        reply: { ok: true, result: data.payload.action === 'ping' ? { routes: [route.id], capabilities:config.capabilities||['usphonebook-continuation-v1','explicit-fields-v1','broker-observation-v1'] } : { status: 'prepared', detail: 'Prepared fixture.' } } } }));
    },
    open: url => opened.push(url)
  };
  const context = { window, location: { origin: 'https://erase-me-preview.vercel.app' }, crypto: { randomUUID: () => 'a'.repeat(32) },
    setTimeout, clearTimeout, CustomEvent: class { constructor(type) { this.type = type; } },
    document: { getElementById: id => elements.get(id), createElement: () => new Element(), dispatchEvent: event => changes.push(event.type) },
    EraseWorkspace: workspace,EraseRemovalMail:config.mail };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../webapp/static/workspace-ui.js'), 'utf8'), context);
  const item={ site_id: route.id, status: 'ready', input_fields: { first_name: 'Example', last_name: 'Person' },...config.item };
  const render=()=>{info.replaceChildren();context.EraseWorkspaceUI.decorate([item]);};render();
  function find(element, predicate) { if (predicate(element)) return element; for (const child of element.children) { const found = find(child, predicate); if (found) return found; } }
  const findText=text=>find(info,element=>element.textContent===text)||find(toolbox,element=>element.textContent===text);
  const click = text => findText(text).listeners.click();
  return { click, calls, posted, changes, opened, feedback, resolveSave, resolvePrepare, resolveResult, resolveOpen, rejectOpen,
    tools:()=>context.EraseWorkspaceUI.tools(),render,findText,keyInput:()=>find(info,element=>element.type==='password'),input:label=>find(info,element=>element.attributes?.get('aria-label')===label) };
}
test('workspace UI waits for saved fields, operation reservation and result persistence', async () => {
  const ui = workspaceUIFixture(), pending = ui.click('Fill with companion');
  assert.equal(ui.calls.saves, 1); assert.deepEqual(ui.posted, []);
  ui.resolveSave(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.calls.prepares, 1); assert.deepEqual(ui.posted, ['ping']);
  ui.resolvePrepare({ operationId: 'b'.repeat(32), routeId: 'usphonebook', fields: { email: 'person@example.test' }, authorized: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.calls.results, 1); assert.deepEqual(ui.posted, ['ping', 'run']);
  assert.equal(ui.feedback.textContent, ''); assert.equal(ui.changes.length, 1);
  ui.resolveResult(); await pending;
  assert.equal(ui.feedback.textContent, 'Prepared fixture.'); assert.equal(ui.changes.length, 2);
});
test('workspace UI never opens a broker before paused or failed-storage validation', async () => {
  const ui = workspaceUIFixture(), pending = ui.click('Open official form');
  assert.deepEqual(ui.opened, []);
  ui.rejectOpen(new Error('Allow checks before opening a broker action.')); await pending;
  assert.deepEqual(ui.opened, []); assert.match(ui.feedback.textContent, /Allow checks/);
});


test('country is requested before regional routes appear and global portals remain available', async () => {
  const { core } = fixture(); await signup(core); const data = core.dashboard();
  assert.deepEqual(data.items.map(item => item.site_id), ['peopledatalabs-form', 'apollo']);
  assert.equal(data.questions[0].field, 'country'); assert.equal(data.coverage.country, null);
  assert.equal(data.coverage.globalRouteCount, 2); assert.equal(data.coverage.countryRouteCount, 0);
  assert.equal(data.coverage.independentDeletionVerification, false);
  assert.throws(() => core.opened('usphonebook'), /outside your selected country/);
  assert.throws(() => core.prepare('usphonebook'), /outside your selected country/);
});
test('US location selects only global and US routes without claiming more automation', async () => {
  const { core } = fixture(); await signup(core); await post(core, '/api/profile', { country: 'us' });
  const data = core.dashboard(), expected = Routes.filter(route => route.countries.includes('*') || route.countries.includes('US'));
  assert.equal(data.items.length, expected.length); assert.equal(data.coverage.countryRouteCount, 23);
  assert.equal(data.coverage.companionRouteCount, 6); assert.equal(data.coverage.hasCountryPack, true);
  assert.equal(data.questions.length, 0); assert.equal(data.items.some(item => item.site_id === 'canada411'), false);
  assert.equal(data.items.every(item => item.operation_id === null), true);
});
test('non-US packs expose their manual routes and block new actions outside that country', async () => {
  for (const [country, selected] of [['CA', 'canada411'], ['GB', '192com'], ['DE', 'de-11880'], ['TR', 'tr-numaraara']]) {
    const { core } = fixture(); await signup(core); await post(core, '/api/profile', { country }); const data = core.dashboard();
    assert.ok(data.items.some(item => item.site_id === selected)); assert.equal(data.items.some(item => item.site_id === 'spokeo'), false);
    assert.equal(data.coverage.hasCountryPack, true); assert.equal(data.coverage.companionRouteCount, 2);
    core.opened(selected); assert.equal(core.dashboard().counts.requested, 0);
    assert.throws(() => core.prepare('usphonebook'), /outside your selected country/);
    assert.throws(() => core.opened('usphonebook'), /outside your selected country/);
  }
});
test('a country without a pack has explicit limited coverage and keeps Unicode profiles intact', async () => {
  const { core } = fixture();
  const created = await post(core, '/api/signup', { name: '李 小龙', age: 35, email: 'Li.Person@EXAMPLE.test', authorized: true });
  assert.equal(created.ok, true); await post(core, '/api/profile', { country: 'JP', city: '東京都' });
  const data = core.dashboard(); assert.equal(data.coverage.hasCountryPack, false); assert.equal(data.coverage.countryRouteCount, 0);
  assert.equal(data.coverage.routeCount, 2); assert.equal(data.items.length, 2);
  assert.equal(data.profile.name, '李 小龙'); assert.equal(data.profile.city, '東京都'); assert.equal(data.profile.email, 'Li.Person@example.test');
  assert.equal(data.questions.length, 0); assert.equal(data.coverage.country, 'JP');
});
test('changing country retains started operations for follow-up and keeps other history in the backup', async () => {
  const { core } = fixture(); await signup(core); await post(core, '/api/profile', { country: 'US' });
  core.setEvidence('usphonebook', { first_name: 'Example', last_name: 'Person' });
  const operation = core.prepare('usphonebook'); core.opened('spokeo');
  await post(core, '/api/profile', { country: 'CA' });
  let data = core.dashboard(); assert.equal(data.coverage.historicalRouteCount, 1);
  assert.ok(data.items.some(item => item.site_id === 'usphonebook')); assert.equal(data.items.some(item => item.site_id === 'spokeo'), false);
  assert.equal(core.snapshot().items.spokeo.status, 'opened');
  assert.doesNotThrow(() => core.opened('usphonebook'));
  assert.throws(() => core.prepare('usphonebook'), /already started/);
  core.recordCompanion('usphonebook', operation.operationId, { status: 'unknown' });
  assert.equal(core.dashboard().counts.blocked, 1);
  await post(core, '/api/profile', { country: 'JP' }); data = core.dashboard();
  assert.equal(data.coverage.hasCountryPack, false); assert.equal(data.coverage.historicalRouteCount, 1);
  assert.equal(data.items.length, 3);
  const exported = JSON.parse(core.exportData()); assert.equal(exported.items.usphonebook.operation_id, operation.operationId);
  await post(core, '/api/profile', { country: 'US' });
  assert.equal(core.dashboard().items.find(item => item.site_id === 'spokeo').status, 'opened');
});


test('an older workspace reports new country routes until an explicit plan refresh adds them', async () => {
  const { core, values, options } = fixture(); await signup(core); await post(core, '/api/profile', { country: 'US' });
  const old = JSON.parse(values.get(Core.KEY));
  for (const route of Routes.filter(route => route.sourceCatalog)) delete old.items[route.id];
  values.set(Core.KEY, JSON.stringify(old)); const reopened = Core.create(options);
  assert.equal(reopened.dashboard().coverage.unplannedRouteCount, 18);
  const before = values.get(Core.KEY); reopened.dashboard(); assert.equal(values.get(Core.KEY), before);
  await post(reopened, '/api/campaign', { action: 'run' });
  assert.equal(reopened.dashboard().coverage.unplannedRouteCount, 0);
  assert.equal(reopened.dashboard().items.length, 25);
  assert.ok(reopened.dashboard().items.every(item => item.operation_id === null));
});

async function mailFixture() {
  const fixtureData=fixture();let sequence=0;
  fixtureData.core=Core.create({...fixtureData.options,uuid:()=> (++sequence).toString(16).padStart(32,'0')});
  await signup(fixtureData.core);await post(fixtureData.core,'/api/profile',{country:'US'});
  fixtureData.core.setEvidence('usphonebook',{first_name:'Example',last_name:'Person'});
  return fixtureData;
}
function contactSession(core,routeId='usphonebook',changes={}) {
  const request_id='b'.repeat(32),operation_id=core.snapshot().items[routeId].id;
  const issued_at=Math.floor(Date.parse('2026-11-04T23:00:00.000Z')/1000),expires_at=issued_at+7*86400;
  const contact_email='erase.contact+erase-'+request_id+'@example.test';
  const claims={v:1,request_id,route_id:routeId,operation_id,recipient:contact_email,issued_at,expires_at,...changes};
  return {status:'ready',request_id,route_id:routeId,operation_id,contact_email,expires_at,
    capability:Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43),automatic_execution:false};
}
test('new dedicated contact is explicit, scoped to two directories and never replaces identity email',async()=>{
  const {core}=await mailFixture();const contact=contactSession(core);
  assert.throws(()=>core.bindMailContact('usphonebook',contact),/Explicitly authorize/);
  const request=core.mailSessionRequest('usphonebook');
  assert.deepEqual(request,{route_id:'usphonebook',operation_id:core.snapshot().items.usphonebook.id,authorized:true});
  core.bindMailContact('usphonebook',contact);
  const item=core.dashboard().items.find(row=>row.site_id==='usphonebook');
  assert.equal(item.mail_contact.contact_email,contact.contact_email);assert.equal(item.mail_contact.capability,undefined);
  assert.equal(core.profile().email,'person@example.test');assert.equal(item.operation_id,null);
  assert.equal(core.prepare('usphonebook').fields.email,contact.contact_email);
  assert.throws(()=>core.mailSessionRequest('usphonebook'),/already started/);
  assert.throws(()=>core.bindMailContact('usphonebook',contact),/already started/);
  assert.throws(()=>core.clearMailContact('usphonebook'),/already started/);
  for(const route of [PDL,'apollo','spokeo'])assert.throws(()=>core.mailSessionRequest(route),/record-associated email/);
  assert.equal(core.prepare(PDL).fields.email,'person@example.test');
});
test('a removal contact can be declined before starting, without changing the profile',async()=>{
  const {core}=await mailFixture();core.mailSessionRequest('usphonebook');core.bindMailContact('usphonebook',contactSession(core));
  core.clearMailContact('usphonebook');assert.equal(core.snapshot().items.usphonebook.mail_contact,undefined);
  assert.equal(core.prepare('usphonebook').fields.email,'person@example.test');assert.equal(core.profile().email,'person@example.test');
});
test('contact capability and expiry validation rejects mismatched routes, operations and aliases',async()=>{
  for(const change of [
    {route_id:'fastpeoplesearch'},{operation_id:'c'.repeat(32)},{request_id:'c'.repeat(32)},
    {recipient:'personal@example.test'},{expires_at:0},{issued_at:0},{v:2}
  ]){
    const {core}=await mailFixture();core.mailSessionRequest('usphonebook');
    assert.throws(()=>core.bindMailContact('usphonebook',contactSession(core,'usphonebook',change)),/does not match/);
    assert.equal(core.snapshot().items.usphonebook.mail_contact,undefined);
  }
  const {core}=await mailFixture();core.mailSessionRequest('usphonebook');
  const malformed=contactSession(core);malformed.capability='not-a-capability';
  assert.throws(()=>core.bindMailContact('usphonebook',malformed),/does not match/);
  const expired=contactSession(core);expired.expires_at-=8*86400;
  const payload=JSON.parse(Buffer.from(expired.capability.split('.')[0],'base64url').toString());
  payload.issued_at-=8*86400;payload.expires_at=expired.expires_at;
  expired.capability=Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+'a'.repeat(43);
  assert.throws(()=>core.bindMailContact('usphonebook',expired),/expired/);
});
test('receipt checks require a saved started operation and held mail never establishes removal',async()=>{
  const {core}=await mailFixture();core.mailSessionRequest('usphonebook');const contact=contactSession(core);core.bindMailContact('usphonebook',contact);
  assert.throws(()=>core.mailCheckRequest('usphonebook'),/Start the matching/);
  const operation=core.prepare('usphonebook');core.recordCompanion('usphonebook',operation.operationId,{status:'prepared'});
  assert.deepEqual(core.mailCheckRequest('usphonebook'),{capability:contact.capability,explicit:true});
  const result={status:'held',route_id:'usphonebook',operation_id:operation.operationId,request_id:contact.request_id,
    reason:'route_validation_required',received_at:Math.floor(Date.parse('2026-11-04T23:00:00.000Z')/1000),
    receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:false};
  assert.throws(()=>core.recordMailReceipt('usphonebook',{...result,request_id:'d'.repeat(32)}),/does not match/);
  assert.throws(()=>core.recordMailReceipt('usphonebook',{...result,authenticated:false}),/could not be validated/);
  assert.throws(()=>core.recordMailReceipt('usphonebook',{...result,status:'removed'}),/does not match/);
  core.recordMailReceipt('usphonebook',result);
  assert.equal(core.snapshot().items.usphonebook.status,'blocked');assert.equal(core.snapshot().items.usphonebook.mail_receipt.authenticated,true);
  assert.deepEqual(core.dashboard().counts,{found:0,requested:0,removed:0,blocked:1});
  core.recordMailReceipt('usphonebook',{status:'pending',route_id:'usphonebook',operation_id:operation.operationId,request_id:contact.request_id,automatic_execution:false});
  assert.equal(core.snapshot().items.usphonebook.mail_receipt.status,'held');assert.throws(()=>core.prepare('usphonebook'),/already started/);
});
test('private backup preserves scoped contact and original operation but never authenticated receipt evidence',async()=>{
  const {core}=await mailFixture();core.mailSessionRequest('usphonebook');const contact=contactSession(core);core.bindMailContact('usphonebook',contact);
  const waiting=fixture().core;waiting.importData(core.exportData());
  assert.equal(waiting.snapshot().items.usphonebook.id,contact.operation_id);
  assert.equal(waiting.prepare('usphonebook').fields.email,contact.contact_email);
  core.recordUser('usphonebook','user_reported_requested');
  core.recordMailReceipt('usphonebook',{status:'held',route_id:'usphonebook',operation_id:contact.operation_id,request_id:contact.request_id,
    reason:'route_validation_required',received_at:Math.floor(Date.parse('2026-11-04T23:00:00.000Z')/1000),receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:false});
  const restored=fixture().core;restored.importData(core.exportData());const item=restored.snapshot().items.usphonebook;
  assert.equal(item.operation_id,contact.operation_id);assert.equal(item.mail_contact.capability,contact.capability);
  assert.equal(item.mail_receipt.authenticated,false);assert.equal(item.mail_receipt.source,'imported_user_history');
  assert.equal(item.evidence,null);assert.equal(restored.dashboard().counts.requested,0);assert.equal(restored.dashboard().counts.removed,0);
  assert.equal(restored.mailCheckRequest('usphonebook').capability,contact.capability);
  const malicious=JSON.parse(core.exportData());malicious.items.searchpeoplefree.mail_contact=malicious.items.usphonebook.mail_contact;
  const target=fixture();assert.throws(()=>target.core.importData(JSON.stringify(malicious)),/does not match/);
  assert.equal(target.values.has(Core.KEY),false);
});
test('expired backup is recoverable but cannot dispatch with its expired contact',async()=>{
  const {core,options}=await mailFixture();core.mailSessionRequest('usphonebook');core.bindMailContact('usphonebook',contactSession(core));
  const restored=Core.create({...fixture().options,now:()=> '2026-11-13T23:00:00.000Z'});restored.importData(core.exportData());
  assert.throws(()=>restored.prepare('usphonebook'),/expired/);
  assert.ok(restored.exportData().includes('erase.contact+erase-'));
  assert.doesNotThrow(()=>restored.mailSessionRequest('usphonebook'));
});
test('mail dispatch preflights respect paused campaigns and storage failure',async()=>{
  const {core,storage}=await mailFixture();await post(core,'/api/campaign',{action:'pause'});
  assert.throws(()=>core.mailSessionRequest('usphonebook'),/Allow checks/);
  await post(core,'/api/campaign',{action:'resume'});storage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>core.mailSessionRequest('usphonebook'),/could not save/);
});
test('pilot UI requires explicit availability and clears the key before a storage failure can block dispatch',async()=>{
  let statusCalls=0,sessionCalls=0;
  const ui=workspaceUIFixture({mail:{status:async()=>{statusCalls++;return {configured:true,enabled:true};},session:async()=>{sessionCalls++;}},
    workspace:{mailSessionRequest:async()=>{throw new Error('Your browser could not save this change.');}}});
  assert.equal(statusCalls,0);assert.equal(ui.findText('Use removal-only contact email'),undefined);
  ui.tools();await ui.click('Check removal-mail availability');ui.render();assert.equal(statusCalls,1);
  const key=ui.keyInput();key.value='f'.repeat(64);await ui.click('Use removal-only contact email');
  assert.equal(key.value,'');assert.equal(sessionCalls,0);assert.match(ui.feedback.textContent,/could not save/);
  assert.deepEqual(ui.posted,[]);
});
test('pilot UI waits for receipt persistence before showing a mailbox outcome',async()=>{
  let recordCalls=0,releaseRecord;
  const recordGate=new Promise(resolve=>{releaseRecord=resolve;});
  const ui=workspaceUIFixture({item:{operation_id:'a'.repeat(32),mail_contact:{contact_email:'erase@example.test',expires_at:1800000000}},
    mail:{status:async()=>({configured:true,enabled:true}),check:async()=>({status:'held'})},
    workspace:{mailCheckRequest:async()=>({capability:'private',explicit:true}),recordMailReceipt:async()=>{recordCalls++;return recordGate;}}});
  ui.tools();await ui.click('Check removal-mail availability');ui.render();
  const previous=ui.feedback.textContent,key=ui.keyInput();key.value='f'.repeat(64);const pending=ui.click('Check confirmation email');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(recordCalls,1);assert.equal(key.value,'');assert.equal(ui.feedback.textContent,previous);
  releaseRecord();await pending;assert.match(ui.feedback.textContent,/held for broker-route validation/);assert.deepEqual(ui.posted,[]);
});

async function readyContinuation(){
  const f=await mailFixture(),{core}=f;core.mailSessionRequest('usphonebook');const contact=contactSession(core);core.bindMailContact('usphonebook',contact);
  const op=core.prepare('usphonebook');core.recordCompanion('usphonebook',op.operationId,{status:'prepared'});
  const receipt={status:'held',route_id:'usphonebook',operation_id:op.operationId,request_id:contact.request_id,reason:'route_validation_required',
    received_at:Math.floor(Date.parse('2026-11-04T23:00:00.000Z')/1000),receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:true};
  core.recordMailReceipt('usphonebook',receipt);
  const response={status:'confirmation_ready',route_id:'usphonebook',operation_id:op.operationId,request_id:contact.request_id,receipt_ref:receipt.receipt_ref,
    confirmation_url:'https://www.usphonebook.com/removal/validate-record-info?key=fixture%3D%3D&ticketid=12345678',automatic_execution:false};
  return {...f,contact,op,receipt,response};
}
const CONFIRM_FIELDS={city:'Example City',state:'CA',zip_code:'92101'};
test('a second tab cannot replace the fields reviewed by an in-flight continuation',async()=>{
  const f=await readyContinuation();
  f.core.mailContinuationRequest('usphonebook',CONFIRM_FIELDS);
  const otherFields={...CONFIRM_FIELDS,city:'Another City',zip_code:'10001',state:'NY'};
  Core.create(f.options).mailContinuationRequest('usphonebook',otherFields);
  const fresh=Core.create(f.options);
  assert.throws(()=>fresh.prepareMailContinuation('usphonebook',f.response,CONFIRM_FIELDS),/changed in another tab/);
  assert.equal(fresh.snapshot().items.usphonebook.continuation,undefined);
  const operation=Core.create(f.options).prepareMailContinuation('usphonebook',f.response,otherFields);
  assert.equal(operation.fields.zip_code,'10001');
  assert.equal(operation.fields.city,'Another City');
});
test('reviewed confirmation requires real required fields and writes a no-replay boundary without storing its private URL',async()=>{
  const {core,response,contact,values,options}=await readyContinuation();
  assert.throws(()=>core.mailContinuationRequest('usphonebook',{...CONFIRM_FIELDS,zip_code:''}),/required profile field/);
  assert.throws(()=>core.mailContinuationRequest('usphonebook',{...CONFIRM_FIELDS,zip_code:'9210'}),/five-digit/);
  assert.throws(()=>core.mailContinuationRequest('usphonebook',{...CONFIRM_FIELDS,phone:'5555555555'}),/Review the city/);
  const request=core.mailContinuationRequest('usphonebook',CONFIRM_FIELDS);
  assert.deepEqual(request,{capability:contact.capability,explicit:true,receipt_ref:response.receipt_ref});
  assert.equal(JSON.stringify(request).includes('92101'),false);
  assert.throws(()=>core.prepareMailContinuation('usphonebook',{...response,operation_id:'f'.repeat(32)},CONFIRM_FIELDS),/does not match/);
  const operation=core.prepareMailContinuation('usphonebook',response,CONFIRM_FIELDS);
  assert.equal(operation.confirmationUrl,response.confirmation_url);assert.equal(operation.fields.zip_code,'92101');
  assert.equal(operation.fields.email,contact.contact_email);assert.equal(operation.fields.phone,undefined);
  assert.equal(values.get(Core.KEY).includes('confirmation_url'),false);assert.equal(values.get(Core.KEY).includes('ticketid'),false);
  assert.equal(core.exportData().includes(response.confirmation_url),false);assert.equal(JSON.stringify(core.dashboard()).includes('ticketid'),false);
  assert.equal(core.dashboard().counts.requested,0);assert.equal(core.dashboard().counts.removed,0);
  assert.throws(()=>Core.create(options).mailContinuationRequest('usphonebook',CONFIRM_FIELDS),/already started/);
  assert.throws(()=>core.prepareMailContinuation('usphonebook',response,CONFIRM_FIELDS),/already started/);
  core.recordMailContinuation('usphonebook',operation.operationId,{status:'prepared'});
  assert.equal(core.snapshot().items.usphonebook.status,'needs_broker_step');assert.equal(core.dashboard().counts.requested,0);
  assert.equal(core.dashboard().counts.blocked,1,'A prepared form still needs the user’s final broker steps');
});
test('continuation honors pause, storage failure, changed receipt and imported no-replay history',async()=>{
  const f=await readyContinuation();await post(f.core,'/api/campaign',{action:'pause'});
  assert.throws(()=>f.core.mailContinuationRequest('usphonebook',CONFIRM_FIELDS),/active operation/);
  await post(f.core,'/api/campaign',{action:'resume'});f.core.mailContinuationRequest('usphonebook',CONFIRM_FIELDS);
  assert.throws(()=>f.core.prepareMailContinuation('usphonebook',{...f.response,receipt_ref:'f'.repeat(64)},CONFIRM_FIELDS),/does not match/);
  const originalSet=f.storage.setItem;f.storage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>f.core.prepareMailContinuation('usphonebook',f.response,CONFIRM_FIELDS),/could not save/);
  f.storage.setItem=originalSet;f.core.prepareMailContinuation('usphonebook',f.response,CONFIRM_FIELDS);
  const restored=fixture().core;restored.importData(f.core.exportData());
  assert.equal(restored.snapshot().items.usphonebook.continuation.result,'unknown');
  assert.equal(restored.snapshot().items.usphonebook.mail_receipt.authenticated,false);
  restored.recordMailReceipt('usphonebook',f.receipt);
  assert.throws(()=>restored.mailContinuationRequest('usphonebook',CONFIRM_FIELDS),/already started/);
});

test('continuation UI requires field review and awaits its persisted navigation boundary before contacting the companion',async()=>{
  let apiCalls=0,prepareCalls=0,recordCalls=0,releasePrepare;
  const gate=new Promise(resolve=>{releasePrepare=resolve;});
  const ui=workspaceUIFixture({item:{operation_id:'a'.repeat(32),mail_contact:{contact_email:'erase@example.test',expires_at:1800000000},
      mail_receipt:{authenticated:true,continuation_available:true}},
    mail:{status:async()=>({configured:true,enabled:true}),continuation:async()=>{apiCalls++;return {fixture:true};}},
    workspace:{profile:()=>({email:'person@example.test',city:'Example City',region:'US-CA'}),mailContinuationRequest:async(_id,fields)=>{assert.deepEqual(JSON.parse(JSON.stringify(fields)),CONFIRM_FIELDS);return{capability:'private',explicit:true,receipt_ref:'c'.repeat(64)};},
      prepareMailContinuation:async()=>{prepareCalls++;return gate;},recordMailContinuation:async()=>{recordCalls++;}}});
  ui.tools();await ui.click('Check removal-mail availability');ui.render();ui.keyInput().value='f'.repeat(64);
  await ui.click('Continue broker form');assert.equal(apiCalls,0);assert.deepEqual(ui.posted,[]);assert.match(ui.feedback.textContent,/Review the fields/);
  ui.findText('I reviewed these fields and authorize filling this broker confirmation form.').children[0].checked=true;
  ui.findText('Current ZIP code').children[0].value='92101';const pending=ui.click('Continue broker form');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(apiCalls,1);assert.equal(prepareCalls,1);assert.deepEqual(ui.posted,['ping']);assert.equal(ui.keyInput().value,'');
  releasePrepare({operationId:'a'.repeat(32),routeId:'usphonebook',fields:{},authorized:true});await pending;
  assert.deepEqual(ui.posted,['ping','continue']);assert.equal(recordCalls,1);assert.match(ui.feedback.textContent,/Prepared fixture/);
});

test('Apollo requires an explicit record-associated business address and authorization without a profile-email fallback',async()=>{
  const f=fixture();await signup(f.core);
  assert.throws(()=>f.core.prepare('apollo'),/business email associated/);
  assert.equal(f.core.snapshot().items.apollo.operation_id,null);
  assert.throws(()=>f.core.setEvidence('apollo',{email:'someone@example.test'}),/not editable/);
  f.core.setEvidence('apollo',{business_email:'work@example.test'});
  assert.throws(()=>f.core.prepare('apollo'),/Confirm this is the business email/);
  f.core.setEvidence('apollo',{business_email:'work@example.test'},{business_email:true});
  const op=f.core.prepare('apollo');assert.deepEqual(op.fields,{business_email:'work@example.test'});
  assert.equal(op.businessEmailConfirmed,true);assert.equal(Object.hasOwn(op.fields,'email'),false);
  assert.equal(f.core.profile().email,'person@example.test');assert.equal(f.core.dashboard().counts.requested,0);
});
test('Spokeo requires a specific record path and fresh ownership confirmation for either observed URL layout',async()=>{
  const valid=['https://www.spokeo.com/Example-Person/California/Example-City/p12345678','https://www.spokeo.com/Example-Person/Example-City/CA/p123456789012345678901234'];
  for(const url of valid){
    const {core}=fixture();await signup(core);await post(core,'/api/profile',{country:'US'});
    core.setEvidence('spokeo',{listing_url:url});assert.throws(()=>core.prepare('spokeo'),/Confirm that this exact listing/);
    core.setEvidence('spokeo',{listing_url:url},{own_listing:true});const op=core.prepare('spokeo');
    assert.equal(op.fields.listing_url,url);assert.equal(op.listingConfirmed,true);assert.equal(core.dashboard().counts.found,0);
  }
  const {core}=fixture();await signup(core);await post(core,'/api/profile',{country:'US'});
  for(const path of ['/Example-Person','/Example-Person/California/Example-City','/Example-Person/Imaginary-State/Example-City/p12','/Example-Person/Example-City/ZZ/p12','/Example-Person/California/Example-City/p12/purchase','/Example-Person/California/Example-City/p'+ '1'.repeat(65)])
    assert.throws(()=>core.setEvidence('spokeo',{listing_url:'https://www.spokeo.com'+path},{own_listing:true}),/record URL/);
  core.setEvidence('spokeo',{listing_url:valid[0]},{own_listing:true});
  core.setEvidence('spokeo',{listing_url:valid[1]});assert.throws(()=>core.prepare('spokeo'),/Confirm that this exact listing/);
});
test('an in-flight prefill cannot replace the exact fields reviewed before the companion ping',async()=>{
  const f=fixture();await signup(f.core);const fields={business_email:'first@example.test'},affirmations={business_email:true};
  f.core.setEvidence('apollo',fields,affirmations);
  Core.create(f.options).setEvidence('apollo',{business_email:'second@example.test'},affirmations);
  assert.throws(()=>f.core.prepare('apollo',{fields,affirmations}),/changed in another tab/);
  assert.equal(f.core.snapshot().items.apollo.operation_id,null);
});
test('route holds gate new dispatches and survive campaign resume and private backup restoration',async()=>{
  const f=await mailFixture();Core.create(f.options).holdRoute('usphonebook');
  for(const action of [()=>f.core.prepare('usphonebook'),()=>f.core.opened('usphonebook'),()=>f.core.searchRequest('usphonebook'),()=>f.core.mailSessionRequest('usphonebook'),()=>f.core.setEvidence('usphonebook',{first_name:'Other'}),()=>f.core.recordUser('usphonebook','user_reported_requested')])assert.throws(action,/on hold/);
  await post(f.core,'/api/campaign',{action:'resume'});assert.equal(f.core.dashboard().items.find(i=>i.site_id==='usphonebook').status,'held');
  assert.equal(f.core.dashboard().counts.blocked,1);
  const restored=fixture().core;restored.importData(f.core.exportData());assert.equal(restored.snapshot().items.usphonebook.held,true);
  assert.throws(()=>restored.prepare('usphonebook'),/on hold/);restored.resumeRoute('usphonebook');
  assert.equal(restored.prepare('usphonebook').routeId,'usphonebook');
});
test('a held started operation accepts existing result reconciliation without clearing its hold or allowing a repeat',async()=>{
  const {core}=fixture();await signup(core);const op=core.prepare(PDL);core.holdRoute(PDL);
  core.recordCompanion(PDL,op.operationId,{status:'verification_sent',route_verified:true,evidence:'fresh_visible_success'});
  assert.equal(core.snapshot().items[PDL].status,'verification_sent');assert.equal(core.dashboard().items.find(i=>i.site_id===PDL).status,'held');
  assert.throws(()=>core.observationRequest(PDL),/on hold/);core.resumeRoute(PDL);assert.throws(()=>core.prepare(PDL),/already started/);
});
test('a held confirmation stops mailbox reads and both continuation authorization and navigation',async()=>{
  const f=await readyContinuation();f.core.mailContinuationRequest('usphonebook',CONFIRM_FIELDS);f.core.holdRoute('usphonebook');
  for(const action of [()=>f.core.mailCheckRequest('usphonebook'),()=>f.core.mailContinuationRequest('usphonebook',CONFIRM_FIELDS),()=>f.core.prepareMailContinuation('usphonebook',f.response,CONFIRM_FIELDS)])assert.throws(action,/on hold/);
  assert.equal(f.core.snapshot().items.usphonebook.continuation,undefined);
});
test('legacy SearchPeopleFree contacts can be explicitly cleared or checked but never silently reused for a new action',async()=>{
  const f=await mailFixture();f.core.setEvidence('searchpeoplefree',{first_name:'Example',last_name:'Person'});
  assert.throws(()=>f.core.mailSessionRequest('searchpeoplefree'),/requires an email you own/);
  const d=f.core.snapshot(),contact=contactSession(f.core,'searchpeoplefree');d.items.searchpeoplefree.mail_contact=contact;
  f.values.set(Core.KEY,JSON.stringify(d));const legacy=Core.create(f.options);
  assert.throws(()=>legacy.prepare('searchpeoplefree'),/old shared contact/);assert.equal(legacy.snapshot().items.searchpeoplefree.operation_id,null);
  legacy.clearMailContact('searchpeoplefree');assert.equal(legacy.prepare('searchpeoplefree').fields.email,'person@example.test');
  const started=legacy.snapshot();started.items.searchpeoplefree.mail_contact=contact;f.values.set(Core.KEY,JSON.stringify(started));
  assert.deepEqual(Core.create(f.options).mailCheckRequest('searchpeoplefree'),{capability:contact.capability,explicit:true});
});
test('listing search is an explicit persisted disclosure without match, submission or removal evidence',async()=>{
  const f=fixture();await signup(f.core);await post(f.core,'/api/profile',{country:'US',city:'Example City'});
  const request=f.core.searchRequest('spokeo'),url=new URL(request.url);assert.equal(url.origin,'https://www.google.com');assert.equal(url.pathname,'/search');
  assert.equal(url.searchParams.get('q'),'site:spokeo.com "Example Person" "Example City"');
  assert.equal(url.href.includes('person%40'),false);assert.equal(f.core.snapshot().items.spokeo.operation_id,null);
  assert.deepEqual(f.core.dashboard().counts,{found:0,requested:0,removed:0,blocked:0});
  assert.throws(()=>f.core.searchRequest('apollo'),/unavailable/);f.core.holdRoute('spokeo');assert.throws(()=>f.core.searchRequest('spokeo'),/on hold/);
  const other=fixture();await signup(other.core);await post(other.core,'/api/profile',{country:'GB'});assert.throws(()=>other.core.searchRequest('spokeo'),/outside your selected country/);
  const failed=fixture();await signup(failed.core);await post(failed.core,'/api/profile',{country:'US'});failed.storage.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>failed.core.searchRequest('spokeo'),/could not save/);
});
test('existing-tab observations require a matching authorization and preserve preparation when proof is unknown',async()=>{
  const f=await mailFixture(),op=f.core.prepare('usphonebook');f.core.recordCompanion('usphonebook',op.operationId,{status:'prepared'});
  assert.throws(()=>f.core.recordObservation('usphonebook',op.operationId,{status:'unknown'}),/authorized existing operation/);
  f.core.observationRequest('usphonebook');f.core.recordObservation('usphonebook',op.operationId,{status:'unknown'});
  assert.equal(f.core.snapshot().items.usphonebook.status,'needs_broker_step');
  assert.throws(()=>f.core.recordObservation('usphonebook',op.operationId,{status:'verification_sent',route_verified:true,evidence:'fresh_visible_success'}),/unverified/);
  f.core.holdRoute('usphonebook');f.core.recordObservation('usphonebook',op.operationId,{status:'verification_sent',observation_verified:true,route_verified:true,evidence:'fresh_visible_success'});
  assert.equal(f.core.dashboard().items.find(i=>i.site_id==='usphonebook').status,'held');assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);
});
test('held UI exposes only explicit resume and local result reconciliation',async()=>{
  const ui=workspaceUIFixture({item:{held:true,operation_id:'a'.repeat(32),status:'held'}});
  assert.ok(ui.findText('Resume this route'));assert.ok(ui.findText('Read companion result'));
  for(const label of ['Open official form','Fill with companion','Find my listing','Check existing broker tab','I submitted the request','I finished the broker steps'])assert.equal(ui.findText(label),undefined);
});
test('new-route UI clears confirmation on field changes and rejects an old companion before operation preparation',async()=>{
  const ui=workspaceUIFixture({routeId:'apollo',capabilities:[],item:{input_fields:{business_email:'work@example.test'}},workspace:{setEvidence:async()=>({business_email:'work@example.test'}),prepare:()=>{throw new Error('must not prepare');}}});
  const email=ui.input('Apollo Business email associated with your Apollo record'),confirmed=ui.input('Apollo business email authorization');
  confirmed.checked=true;email.listeners.input();assert.equal(confirmed.checked,false);confirmed.checked=true;
  await ui.click('Fill with companion');assert.deepEqual(ui.posted,['ping']);assert.match(ui.feedback.textContent,/Update the companion/);
});
test('a late verification acknowledgment preserves user reports and stores its earlier-stage proof separately',async()=>{
  for(const reported of ['user_reported_requested','user_reported_completed']){
    const f=fixture();await signup(f.core);const op=f.core.prepare(PDL);
    f.core.recordCompanion(PDL,op.operationId,{status:'prepared'});f.core.recordUser(PDL,reported);
    const prior=f.core.snapshot().items[PDL].evidence;f.core.observationRequest(PDL);
    f.core.recordObservation(PDL,op.operationId,{status:'verification_sent',observation_verified:true,route_verified:true,evidence:'fresh_visible_success'});
    const item=f.core.snapshot().items[PDL];assert.equal(item.status,reported);assert.deepEqual(item.evidence,prior);
    assert.equal(item.verification_evidence.result,'verification_sent');assert.equal(item.verification_evidence.acceptance_verified,false);
    assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);
  }
});
test('an email-initiation observation cannot replace acceptance evidence or a later confirmation-form outcome',async()=>{
  const accepted=fixture();await signup(accepted.core);const op=accepted.core.prepare(PDL);
  accepted.core.recordCompanion(PDL,op.operationId,{status:'submitted',route_verified:true,evidence:'fresh_visible_success'});accepted.core.observationRequest(PDL);
  const acknowledgment={status:'verification_sent',observation_verified:true,route_verified:true,evidence:'fresh_visible_success'};
  accepted.core.recordObservation(PDL,op.operationId,acknowledgment);assert.equal(accepted.core.snapshot().items[PDL].status,'requested');
  assert.equal(accepted.core.dashboard().counts.requested,1);assert.equal(accepted.core.snapshot().items[PDL].evidence.acceptance_verified,true);
  const later=await readyContinuation();later.core.mailContinuationRequest('usphonebook',CONFIRM_FIELDS);
  const continuation=later.core.prepareMailContinuation('usphonebook',later.response,CONFIRM_FIELDS);later.core.recordMailContinuation('usphonebook',continuation.operationId,{status:'prepared'});
  later.core.observationRequest('usphonebook');later.core.recordObservation('usphonebook',continuation.operationId,acknowledgment);
  assert.equal(later.core.snapshot().items.usphonebook.status,'needs_broker_step');assert.equal(later.core.snapshot().items.usphonebook.continuation.result,'prepared');
});
test('a manual submission report does not require or save prefill fields left empty in the app',async()=>{
  for(const routeId of ['apollo','spokeo','usphonebook']){
    let reports=0;
    const ui=workspaceUIFixture({routeId,item:{input_fields:{}},workspace:{
      setEvidence:async()=>{throw new Error('Prefill validation must not run for a manual report');},
      recordUser:async(id,state)=>{assert.equal(id,routeId);assert.equal(state,'user_reported_requested');reports++;}
    }});
    await ui.click('I submitted the request');assert.equal(reports,1);assert.deepEqual(ui.posted,[]);assert.deepEqual(ui.opened,[]);
    assert.match(ui.feedback.textContent,/Broker acceptance and deletion remain unverified/);
  }
});
