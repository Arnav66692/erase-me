'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../webapp/static/workspace-core.js');
const PDL = 'peopledatalabs-form';

async function fixture(country = 'US') {
  const values = new Map();
  let sequence = 0, writes = 0;
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => { writes++; values.set(key, value); },
    removeItem: key => values.delete(key)
  };
  const options = { storage, uuid: () => (++sequence).toString(16).padStart(32, '0'), now: () => '2026-11-05T00:00:00.000Z' };
  const core = Core.create(options);
  await core.api('/api/signup', { method: 'POST', body: JSON.stringify({ name: 'Example Person', age: 35, email: 'person@example.test', authorized: true }) });
  if (country) await core.api('/api/profile', { method: 'POST', body: JSON.stringify({ country }) });
  return { core, options, storage, values, writes: () => writes };
}
const post = (core, path, body) => core.api(path, { method: 'POST', body: JSON.stringify(body) });
function editStored(f, callback) {
  const saved = JSON.parse(f.values.get(Core.KEY)); callback(saved);
  f.storage.setItem(Core.KEY, JSON.stringify(saved));
}
function contact(core) {
  const request_id = 'b'.repeat(32), operation_id = core.snapshot().items.usphonebook.id;
  const issued_at = Date.parse('2026-11-05T00:00:00.000Z') / 1000, expires_at = issued_at + 7 * 86400;
  const contact_email = 'erase.contact+erase-' + request_id + '@example.test';
  const claims = { v: 1, request_id, route_id: 'usphonebook', operation_id, recipient: contact_email, issued_at, expires_at };
  return { status: 'ready', request_id, route_id: 'usphonebook', operation_id, contact_email, expires_at,
    capability: Buffer.from(JSON.stringify(claims)).toString('base64url') + '.' + 'a'.repeat(43), automatic_execution: false };
}

test('fill preview is read-only, complete, isolated from state and reserves nothing', async () => {
  const f = await fixture();
  const before = f.values.get(Core.KEY), writes = f.writes();
  const preview = f.core.fillPreview(PDL);
  assert.deepEqual(preview, { routeId: PDL, operationId: f.core.snapshot().items[PDL].id,
    profileId: f.core.profile().id, country: 'US', fields: { email: 'person@example.test' }, reviewed: { fields: {}, affirmations: {} } });
  assert.equal(f.writes(), writes); assert.equal(f.values.get(Core.KEY), before);
  preview.fields.email = 'other@example.test'; preview.reviewed.fields.full_name = 'Other';
  assert.equal(f.core.fillPreview(PDL).fields.email, 'person@example.test');
  assert.deepEqual(f.core.fillPreview(PDL).reviewed.fields, {});
  assert.equal(f.core.snapshot().items[PDL].operation_id, null);
});

test('a current reviewed preview reserves exactly its route and cannot be replayed', async () => {
  const f = await fixture(); const preview = f.core.fillPreview(PDL);
  const operation = f.core.prepareReviewed(preview);
  assert.equal(operation.operationId, preview.operationId); assert.deepEqual(operation.fields, preview.fields);
  assert.equal(operation.authorized, true); assert.equal(f.core.snapshot().items[PDL].operation_id, operation.operationId);
  assert.equal(f.core.snapshot().items.apollo.operation_id, null);
  assert.throws(() => f.core.prepareReviewed(preview), /already started/);
});

test('preview rejects manual routes, missing fields, missing ownership approval and foreign country', async () => {
  const f = await fixture();
  assert.throws(() => f.core.fillPreview('smartbackgroundchecks'), /companion|supported form/i);
  assert.throws(() => f.core.fillPreview('usphonebook'), /first name/);
  assert.throws(() => f.core.fillPreview('apollo'), /Confirm/);
  f.core.setEvidence('usphonebook', { first_name: 'Example', last_name: 'Person' });
  await post(f.core, '/api/profile', { country: 'CA' });
  assert.throws(() => f.core.fillPreview('usphonebook'), /outside your selected country/);
});

test('changes to identity, country, operation reference or effective email invalidate a reviewed batch entry', async () => {
  for (const mutate of [
    state => { state.profile.id = 'c'.repeat(32); },
    state => { state.profile.country = 'CA'; },
    state => { state.profile.email = 'different@example.test'; },
    state => { state.items[PDL].id = 'd'.repeat(32); }
  ]) {
    const f = await fixture(), preview = f.core.fillPreview(PDL); editStored(f, mutate);
    const before = f.values.get(Core.KEY), writes = f.writes();
    assert.throws(() => f.core.prepareReviewed(preview), /changed|Review/i);
    assert.equal(f.values.get(Core.KEY), before); assert.equal(f.writes(), writes);
    assert.equal(f.core.snapshot().items[PDL].operation_id, null);
  }
});

test('changed editable fields or required affirmations never dispatch the previous review', async () => {
  for (const change of [
    core => core.setEvidence('apollo', { business_email: 'second@example.test' }, { business_email: true }),
    core => core.setEvidence('apollo', { business_email: 'first@example.test' }, { business_email: false })
  ]) {
    const f = await fixture(); f.core.setEvidence('apollo', { business_email: 'first@example.test' }, { business_email: true });
    const preview = f.core.fillPreview('apollo'); change(Core.create(f.options));
    assert.throws(() => f.core.prepareReviewed(preview), /changed|Confirm/);
    assert.equal(f.core.snapshot().items.apollo.operation_id, null);
  }
});

test('removal-only contact email is disclosed and a changed or expired contact invalidates review', async () => {
  const f = await fixture(); f.core.setEvidence('usphonebook', { first_name: 'Example', last_name: 'Person' });
  f.core.mailSessionRequest('usphonebook'); f.core.bindMailContact('usphonebook', contact(f.core));
  const preview = f.core.fillPreview('usphonebook');
  assert.match(preview.fields.email, /^erase\.contact\+erase-/); assert.equal('capability' in preview, false);
  assert.equal(JSON.stringify(preview).includes('capability'), false);
  f.core.clearMailContact('usphonebook');
  assert.throws(() => f.core.prepareReviewed(preview), /changed/);
  f.core.mailSessionRequest('usphonebook'); f.core.bindMailContact('usphonebook', contact(f.core));
  const later = Core.create({ ...f.options, now: () => '2026-11-13T00:00:00.000Z' });
  assert.throws(() => later.fillPreview('usphonebook'), /expired/);
  assert.throws(() => later.prepareReviewed(preview), /expired/);
  assert.equal(later.snapshot().items.usphonebook.operation_id, null);
});

test('held and paused routes reject preview and previously reviewed work without new reservations', async () => {
  for (const block of [core => core.holdRoute(PDL), core => post(core, '/api/campaign', { action: 'pause' })]) {
    const f = await fixture(), preview = f.core.fillPreview(PDL); await block(Core.create(f.options));
    const before = f.values.get(Core.KEY), writes = f.writes();
    assert.throws(() => f.core.fillPreview(PDL), /hold|Allow checks/);
    assert.throws(() => f.core.prepareReviewed(preview), /hold|Allow checks/);
    assert.equal(f.values.get(Core.KEY), before); assert.equal(f.writes(), writes);
  }
});

test('strict review schema rejects extra, missing, malformed and tampered outbound fields', async () => {
  const mutations = [
    value => { value.extra = true; }, value => { delete value.country; },
    value => { value.reviewed.extra = true; }, value => { value.fields.email = 'other@example.test'; },
    value => { value.fields.phone = '+15555550100'; }, value => { value.reviewed.affirmations.other = true; },
    value => { value.reviewed.fields = []; }, value => { value.operationId = null; }
  ];
  for (const mutate of mutations) {
    const f = await fixture(), preview = f.core.fillPreview(PDL); mutate(preview);
    const before = f.values.get(Core.KEY);
    assert.throws(() => f.core.prepareReviewed(preview), /Review|changed/);
    assert.equal(f.values.get(Core.KEY), before);
  }
});

test('a failed reservation write leaves the operation unavailable for dispatch', async () => {
  const f = await fixture(), preview = f.core.fillPreview(PDL), before = f.values.get(Core.KEY);
  f.storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => f.core.prepareReviewed(preview), /could not save/);
  assert.equal(f.values.get(Core.KEY), before);
  assert.equal(f.core.snapshot().items[PDL].operation_id, null);
});

test('preview never writes interrupted-state recovery during a read-only review', async () => {
  const f = await fixture(); const operation = f.core.prepare(PDL);
  const before = f.values.get(Core.KEY), writes = f.writes();
  const reopened = Core.create(f.options);
  assert.throws(() => reopened.fillPreview(PDL), /already started/);
  assert.equal(f.values.get(Core.KEY), before); assert.equal(f.writes(), writes);
  const recovered = reopened.dashboard().items.find(item => item.site_id === PDL);
  assert.equal(recovered.status, 'uncertain'); assert.equal(recovered.operation_id, operation.operationId);
  assert.equal(f.writes(), writes + 1, 'A normal read must persist the deferred recovery once');
  assert.equal(JSON.parse(f.values.get(Core.KEY)).items[PDL].status, 'uncertain');
  assert.throws(() => reopened.fillPreview(PDL), /already started/);
  assert.equal(reopened.dashboard().items.find(item => item.site_id === PDL).status, 'uncertain');
  assert.equal(f.writes(), writes + 1);
});

test('default browser review is read-only and reservations share the exclusive mutation lock', async () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const values = new Map(); let inside = false, lockCalls = 0, tail = Promise.resolve(), sequence = 0;
  const context = {
    URL, EraseBrokerRoutes: require('../webapp/static/broker-routes.js'),
    crypto: { randomUUID: () => (++sequence).toString(16).padStart(32, '0') },
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => { assert.equal(inside, true, 'All mutation writes must hold the lock'); values.set(key, value); },
      removeItem: key => values.delete(key)
    },
    navigator: { locks: { request(_key, options, callback) {
      assert.equal(options.mode, 'exclusive'); lockCalls++;
      const task = tail.then(async () => { inside = true; try { return await callback(); } finally { inside = false; } });
      tail = task.catch(() => {}); return task;
    } } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../webapp/static/workspace-core.js'), 'utf8'), context);
  const core = context.EraseWorkspace;
  assert.equal((await core.api('/api/signup', { method: 'POST', body: JSON.stringify({ name: 'Example Person', age: 35, email: 'person@example.test', authorized: true }) })).ok, true);
  const calls = lockCalls, before = values.get(Core.KEY), preview = core.fillPreview(PDL);
  assert.equal(lockCalls, calls); assert.equal(values.get(Core.KEY), before);
  const results = await Promise.allSettled([core.prepareReviewed(preview), core.prepareReviewed(preview)]);
  assert.equal(lockCalls, calls + 2);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(JSON.parse(values.get(Core.KEY)).items[PDL].operation_id, preview.operationId);
});
