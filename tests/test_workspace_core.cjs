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
  assert.equal(core.dashboard().items.length, Routes.length);
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
  const { core } = fixture(); await signup(core);
  assert.throws(() => core.prepare('usphonebook'), /first name/);
  core.setEvidence('usphonebook', { first_name: 'Example', last_name: 'Person' });
  const operation = core.prepare('usphonebook');
  assert.deepEqual(operation.fields, { first_name: 'Example', last_name: 'Person', email: 'person@example.test' });
  assert.throws(() => core.setEvidence('usphonebook', { first_name: 'Other' }), /already started/);
});

test('only exact approved broker listing origins and safe paths are accepted', async () => {
  const { core } = fixture(); await signup(core);
  for (const listing_url of ['http://www.spokeo.com/Example-Person', 'https://www.spokeo.com.evil.test/Example-Person', 'https://evil.spokeo.com/Example-Person', 'https://person@www.spokeo.com/Example-Person', 'https://www.spokeo.com/optout', 'https://www.spokeo.com/Example-Person?token=secret', 'https://www.spokeo.com:444/Example-Person']) {
    assert.throws(() => core.setEvidence('spokeo', { listing_url }));
  }
  core.setEvidence('spokeo', { listing_url: 'https://www.spokeo.com/Example-Person/California/Example-City' });
  assert.equal(core.prepare('spokeo').fields.listing_url, 'https://www.spokeo.com/Example-Person/California/Example-City');
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
  const { core, options } = fixture(); await signup(core);
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
  source.core.setEvidence('spokeo', { listing_url: 'https://www.spokeo.com/Example-Person/California/Example-City' });
  const restored = fixture(); restored.core.importData(source.core.exportData());
  const profile = restored.core.profile();
  assert.equal(profile.country, 'US'); assert.equal(profile.region, 'US-CA'); assert.equal(profile.city, 'Example City');
  assert.equal(profile.email_verified, false);
  const item = restored.core.dashboard().items.find(row => row.site_id === 'usphonebook');
  assert.deepEqual(item.input_fields, { first_name: 'Example', last_name: 'Person' });
  assert.equal(item.status, 'user_reported_requested'); assert.throws(() => restored.core.prepare('usphonebook'), /already started/);
  assert.equal(restored.core.prepare('spokeo').fields.listing_url, 'https://www.spokeo.com/Example-Person/California/Example-City');
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
