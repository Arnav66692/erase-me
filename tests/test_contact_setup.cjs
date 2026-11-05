'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Setup = require('../webapp/static/contact-setup.js');
const Core = require('../webapp/static/workspace-core.js');
const KEY = 'f'.repeat(64), FPS = 'fastpeoplesearch', USPB = 'usphonebook';
const NOW = '2026-11-05T20:00:00.000Z';
const post = (core, path, body) => core.api(path, { method: 'POST', body: JSON.stringify(body) });
function deferred() { let resolve; return { promise: new Promise(done => { resolve = done; }), resolve: value => resolve(value) }; }
function contact(request, count = 1) {
  const request_id = count.toString(16).padStart(32, 'a'), issued_at = Date.parse(NOW) / 1000, expires_at = issued_at + 7 * 86400;
  const contact_email = 'removals+erase-' + request_id + '@example.test';
  const claims = { v: 1, request_id, route_id: request.route_id, operation_id: request.operation_id, recipient: contact_email, issued_at, expires_at };
  return { status: 'ready', capability: Buffer.from(JSON.stringify(claims)).toString('base64url') + '.' + 'c'.repeat(43),
    request_id, route_id: request.route_id, operation_id: request.operation_id, contact_email, expires_at, automatic_execution: false };
}
async function fixture() {
  const values = new Map(), calls = [], updates = []; let sequence = 0, aliases = 0;
  const core = Core.create({ storage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    uuid: () => (++sequence).toString(16).padStart(32, '0'), now: () => NOW });
  assert.equal((await post(core, '/api/signup', { name: 'Example Person', age: 35, email: 'person@example.test', authorized: true })).ok, true);
  assert.equal((await post(core, '/api/profile', { country: 'US', region: 'US-CA', city: 'Example City' })).ok, true);
  for (const id of [FPS, USPB]) core.setEvidence(id, { first_name: 'Example', last_name: 'Person' });
  const workspace = { ...core,
    mailSessionRequest: async id => { calls.push(['authorize', id]); return core.mailSessionRequest(id); },
    bindMailContact: async (id, response) => { calls.push(['bind', id]); return core.bindMailContact(id, response); } };
  const mail = { session: async (request, key) => { assert.equal(key, KEY); calls.push(['session', request.route_id]); return contact(request, ++aliases); },
    check: () => assert.fail('Contact setup must not read mail.'), continuation: () => assert.fail('Contact setup must not release a broker URL.') };
  const setup = Setup.create({ workspace, mail, onUpdate: value => updates.push(value) });
  const options = { authorized: true, operatorKey: KEY };
  return { core, values, calls, updates, workspace, mail, setup, options };
}

test('contact setup requires explicit approval, a valid private key and unique supported routes before effects', async () => {
  for (const selection of [[], [FPS, FPS], [FPS, 'searchpeoplefree'], [FPS, 'apollo'], [FPS, 'peopledatalabs-form'], [null], FPS]) {
    const f = await fixture();
    await assert.rejects(f.setup.prepare(selection, f.options), /supported removal-only/); assert.deepEqual(f.calls, []);
  }
  for (const options of [{ authorized: false, operatorKey: KEY }, { authorized: 1, operatorKey: KEY }, {}, null,
    { authorized: true }, { authorized: true, operatorKey: 'password' }, { authorized: true, operatorKey: 'g'.repeat(64) }]) {
    const f = await fixture(); await assert.rejects(f.setup.prepare([FPS], options), /Authorize|operator key/); assert.deepEqual(f.calls, []);
  }
});

test('one approved setup sequentially authorizes and binds two scoped contacts without starting forms or reading mail', async () => {
  const f = await fixture(), result = await f.setup.prepare([FPS, USPB], f.options);
  assert.deepEqual(f.calls, [['authorize', FPS], ['session', FPS], ['bind', FPS], ['authorize', USPB], ['session', USPB], ['bind', USPB]]);
  assert.equal(result.status, 'finished'); assert.deepEqual(result.entries.map(item => item.status), ['ready', 'ready']);
  for (const id of [FPS, USPB]) {
    const item = f.core.dashboard().items.find(item => item.site_id === id);
    assert.match(item.mail_contact.contact_email, /^removals\+erase-/); assert.equal(item.operation_id, null); assert.equal(item.status, 'ready');
  }
  assert.deepEqual(f.core.dashboard().counts, { found: 0, requested: 0, removed: 0, blocked: 0 });
  assert.equal(f.core.dashboard().campaign.next_check_at, null);
  for (const value of [result, f.setup.snapshot(), f.updates, f.core.snapshot(), f.core.exportData(), [...f.values]]) assert.equal(JSON.stringify(value).includes(KEY), false);
  const publicState = JSON.stringify(f.updates); for (const value of ['person@example.test', 'Example Person', 'removals+', 'capability']) assert.equal(publicState.includes(value), false);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.calls.length, 6);
});

test('existing contacts are kept without another relay request', async () => {
  const f = await fixture(), request = f.core.mailSessionRequest(FPS); f.core.bindMailContact(FPS, contact(request));
  const before = f.core.snapshot().items[FPS].mail_contact;
  const result = await f.setup.prepare([FPS, USPB], f.options);
  assert.deepEqual(result.entries.map(item => item.status), ['existing', 'ready']);
  assert.deepEqual(f.calls, [['authorize', USPB], ['session', USPB], ['bind', USPB]]);
  assert.deepEqual(f.core.snapshot().items[FPS].mail_contact, before);
});

test('all selected routes are checked before any contact call, excluding held, paused, started and out-of-country routes', async () => {
  for (const scenario of ['held', 'paused', 'started', 'country']) {
    const f = await fixture();
    if (scenario === 'held') f.core.holdRoute(USPB);
    if (scenario === 'paused') await post(f.core, '/api/campaign', { action: 'pause' });
    if (scenario === 'started') f.core.prepare(USPB);
    if (scenario === 'country') await post(f.core, '/api/profile', { country: 'CA' });
    await assert.rejects(f.setup.prepare([FPS, USPB], f.options), /paused, held, already started|outside/); assert.deepEqual(f.calls, []);
    assert.equal(f.core.snapshot().items[FPS].mail_contact, undefined);
  }
});

test('a held USPhonebook route never receives a session even when another route is selected first', async () => {
  const f = await fixture(); f.core.holdRoute(USPB);
  await assert.rejects(f.setup.prepare([FPS, USPB], f.options)); assert.deepEqual(f.calls, []);
  const result = await f.setup.prepare([FPS], f.options); assert.equal(result.entries[0].status, 'ready');
  assert.equal(f.core.snapshot().items[USPB].held, true); assert.equal(f.core.snapshot().items[USPB].mail_contact, undefined);
});

test('a route hold applied while authorization is pending prevents external issuance', async () => {
  const f = await fixture(), request = f.workspace.mailSessionRequest;
  f.workspace.mailSessionRequest = async id => { const value = await request(id); f.core.holdRoute(id); return value; };
  const result = await f.setup.prepare([FPS, USPB], f.options);
  assert.equal(result.status, 'stopped'); assert.deepEqual(result.entries.map(item => item.status), ['blocked', 'not_started']);
  assert.deepEqual(f.calls, [['authorize', FPS]]);
});

test('profile, country and field changes during issuance prevent binding or further contact requests', async () => {
  for (const scenario of ['profile', 'country', 'fields', 'held', 'paused']) {
    const f = await fixture(), issue = f.mail.session;
    f.mail.session = async (...args) => {
      const response = await issue(...args);
      if (scenario === 'profile') await post(f.core, '/api/profile', { city: 'Changed City' });
      if (scenario === 'country') await post(f.core, '/api/profile', { country: 'CA' });
      if (scenario === 'fields') f.core.setEvidence(FPS, { first_name: 'Other', last_name: 'Person' });
      if (scenario === 'held') f.core.holdRoute(FPS);
      if (scenario === 'paused') await post(f.core, '/api/campaign', { action: 'pause' });
      return response;
    };
    const result = await f.setup.prepare([FPS, USPB], f.options);
    assert.equal(result.entries[0].status, 'unknown'); assert.equal(result.entries[1].status, 'not_started');
    assert.deepEqual(f.calls, [['authorize', FPS], ['session', FPS]]); assert.equal(f.core.snapshot().items[FPS].mail_contact, undefined);
  }
});

test('a changed profile identity cannot receive an earlier alias result', async () => {
  const f = await fixture(), issue = f.mail.session;
  f.mail.session = async (...args) => {
    const response = await issue(...args); f.core.remove();
    await post(f.core, '/api/signup', { name: 'Another Person', age: 35, email: 'another@example.test', authorized: true });
    await post(f.core, '/api/profile', { country: 'US' }); return response;
  };
  const result = await f.setup.prepare([FPS], f.options);
  assert.equal(result.entries[0].status, 'unknown'); assert.equal(f.core.snapshot().items[FPS].mail_contact, undefined); assert.equal(f.calls.some(call => call[0] === 'bind'), false);
});

test('Stop before authorization and during issuance prevents later stages without scheduling a retry', async () => {
  const initial = await fixture(); let controller;
  controller = Setup.create({ workspace: initial.workspace, mail: initial.mail, onUpdate: value => { if (value.status === 'running') controller.stop(); } });
  assert.equal((await controller.prepare([FPS], initial.options)).status, 'stopped'); assert.deepEqual(initial.calls, []);
  const f = await fixture(), gate = deferred(), issue = f.mail.session;
  f.mail.session = async (...args) => { const response = await issue(...args); await gate.promise; return response; };
  const run = f.setup.prepare([FPS, USPB], f.options); await new Promise(resolve => setImmediate(resolve));
  f.setup.stop(); gate.resolve(); const result = await run;
  assert.deepEqual(result.entries.map(item => item.status), ['unknown', 'not_started']); assert.equal(f.calls.some(call => call[0] === 'bind'), false);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.calls.length, 2);
  await assert.rejects(f.setup.prepare([FPS], f.options), /already finished or stopped/); assert.equal(f.calls.length, 2);
});

test('Stop during local authorization sends no remote request', async () => {
  const f = await fixture(), request = f.workspace.mailSessionRequest;
  f.workspace.mailSessionRequest = async id => { const result = await request(id); f.setup.stop(); return result; };
  const result = await f.setup.prepare([FPS], f.options);
  assert.equal(result.entries[0].status, 'not_started'); assert.deepEqual(f.calls, [['authorize', FPS]]);
});

test('ambiguous relay and persistence failures stop once and never expose raw errors or secrets', async () => {
  for (const scenario of ['relay', 'bind', 'authorize']) {
    const f = await fixture(), fail = () => { throw new Error(KEY + ' private@example.test'); };
    if (scenario === 'relay') f.mail.session = async () => fail();
    if (scenario === 'bind') f.workspace.bindMailContact = async () => fail();
    if (scenario === 'authorize') f.workspace.mailSessionRequest = async () => fail();
    const result = await f.setup.prepare([FPS, USPB], f.options);
    assert.equal(result.status, 'stopped'); assert.equal(result.entries[0].status, scenario === 'authorize' ? 'blocked' : 'unknown');
    assert.equal(result.entries[1].status, 'not_started');
    for (const value of [result, f.updates, f.setup.snapshot()]) { assert.equal(JSON.stringify(value).includes(KEY), false); assert.equal(JSON.stringify(value).includes('private@example.test'), false); }
    await assert.rejects(f.setup.prepare([FPS], f.options), /already finished or stopped/);
  }
});

test('a changed authorization body is rejected before calling the relay', async () => {
  for (const change of [{ route_id: USPB }, { operation_id: 'b'.repeat(32) }, { authorized: false }, { email: 'private@example.test' }]) {
    const f = await fixture(), request = f.workspace.mailSessionRequest;
    f.workspace.mailSessionRequest = async id => ({ ...await request(id), ...change });
    assert.equal((await f.setup.prepare([FPS], f.options)).entries[0].status, 'blocked'); assert.deepEqual(f.calls, [['authorize', FPS]]);
  }
});

test('core validation rejects mismatched or malformed contact responses without binding', async () => {
  for (const change of [{ route_id: USPB }, { operation_id: 'b'.repeat(32) }, { capability: 'bad' }, { contact_email: 'evil@example.test' }]) {
    const f = await fixture(), issue = f.mail.session;
    f.mail.session = async (...args) => ({ ...await issue(...args), ...change });
    assert.equal((await f.setup.prepare([FPS], f.options)).entries[0].status, 'unknown'); assert.equal(f.core.snapshot().items[FPS].mail_contact, undefined);
  }
});

test('later routes retain the context captured before the first asynchronous boundary', async () => {
  const f = await fixture(), bind = f.workspace.bindMailContact;
  f.workspace.bindMailContact = async (...args) => { const result = await bind(...args); f.core.setEvidence(USPB, { first_name: 'Changed' }); return result; };
  const result = await f.setup.prepare([FPS, USPB], f.options);
  assert.deepEqual(result.entries.map(item => item.status), ['ready', 'blocked']);
  assert.deepEqual(f.calls, [['authorize', FPS], ['session', FPS], ['bind', FPS]]);
});

test('workspace drift while waiting for binding prevents later work even if this contact was saved', async () => {
  const f = await fixture(), bind = f.workspace.bindMailContact;
  f.workspace.bindMailContact = async (...args) => { const result = await bind(...args); await post(f.core, '/api/profile', { city: 'Changed City' }); return result; };
  const result = await f.setup.prepare([FPS, USPB], f.options);
  assert.deepEqual(result.entries.map(item => item.status), ['unknown', 'not_started']); assert.equal(f.calls.filter(call => call[0] === 'session').length, 1);
});

test('reviewed route arrays and public snapshots are detached, and overlapping calls cannot duplicate issuance', async () => {
  const f = await fixture(), gate = deferred(), issue = f.mail.session, ids = [FPS, USPB];
  f.mail.session = async (...args) => { const value = await issue(...args); if (args[0].route_id === FPS) await gate.promise; return value; };
  const run = f.setup.prepare(ids, f.options); ids[1] = 'apollo'; await new Promise(resolve => setImmediate(resolve));
  const state = f.setup.snapshot(); state.entries[0].routeId = 'apollo'; state.entries.length = 0;
  await assert.rejects(f.setup.prepare([FPS], f.options), /already running/);
  gate.resolve(); const result = await run;
  assert.deepEqual(result.entries.map(item => item.routeId), [FPS, USPB]); assert.equal(f.calls.filter(call => call[0] === 'session').length, 2);
});
