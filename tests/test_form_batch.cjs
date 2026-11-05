'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Batch = require('../webapp/static/form-batch.js');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(overrides = {}) {
  const calls = [], updates = [];
  const routes = ['first', 'second'].map(id => ({ id, automationLevel: 'companion', requiredAffirmations: [] }));
  const workspace = {
    routes: () => routes,
    prepareReviewed: async preview => { calls.push(['prepare', preview.routeId, preview.fields.email]); return { routeId: preview.routeId, operationId: preview.operationId, fields: preview.fields, authorized: true }; },
    recordCompanion: async (id, operationId, result) => { calls.push(['record', id, result.status]); },
    ...overrides.workspace
  };
  const companion = overrides.companion || (async payload => {
    calls.push([payload.action, payload.routeId]);
    return payload.action === 'ping' ? { routes: ['first', 'second'], capabilities: [] } : { status: 'prepared', detail: 'Fields filled; broker steps remain.' };
  });
  const batch = Batch.create({ workspace, companion, onUpdate: update => updates.push(update) });
  const previews = routes.map((route, index) => ({ routeId: route.id, operationId: String(index + 1).repeat(32), profileId: 'p'.repeat(32), country: 'US', fields: { email: 'person@example.test' }, reviewed: { fields: {}, affirmations: {} } }));
  return { batch, calls, updates, previews, routes };
}

test('batch requires explicit approval and unique supported routes before any effect', async () => {
  for (const change of ['unauthorized', 'empty', 'duplicate', 'manual', 'unknown']) {
    const f = fixture();
    if (change === 'manual') f.routes[0].automationLevel = 'manual';
    let previews = f.previews;
    if (change === 'empty') previews = [];
    if (change === 'duplicate') previews = [previews[0], previews[0]];
    if (change === 'unknown') previews[0].routeId = 'not-reviewed';
    await assert.rejects(f.batch.run(previews, { authorized: change !== 'unauthorized' }));
    assert.deepEqual(f.calls, []);
  }
});

test('batch reserves and persists each form sequentially, never all operations upfront', async () => {
  const f = fixture();
  const result = await f.batch.run(f.previews, { authorized: true });
  assert.deepEqual(f.calls.map(call => call.slice(0, 2)), [['ping', undefined], ['prepare', 'first'], ['run', 'first'], ['record', 'first'], ['prepare', 'second'], ['run', 'second'], ['record', 'second']]);
  assert.equal(result.status, 'finished');
  assert.deepEqual(result.entries.map(entry => entry.status), ['prepared', 'prepared']);
  assert.equal(JSON.stringify(f.updates).includes('person@example.test'), false);
  assert.equal(f.batch.isRunning(), false);
});

test('an earlier result must be saved before the next form can start', async () => {
  const gate = deferred();
  const f = fixture({ workspace: { recordCompanion: () => gate.promise } });
  const run = f.batch.run(f.previews, { authorized: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.batch.isRunning(), true);
  assert.equal(f.calls.filter(call => call[0] === 'prepare').length, 1);
  gate.resolve(); await run;
  assert.equal(f.calls.filter(call => call[0] === 'prepare').length, 2);
});

test('stop during the current form leaves later entries unstarted and never auto resumes', async () => {
  const gate = deferred();
  const f = fixture({ companion: async payload => payload.action === 'ping' ? { routes: ['first', 'second'], capabilities: [] } : gate.promise });
  const run = f.batch.run(f.previews, { authorized: true });
  await new Promise(resolve => setImmediate(resolve));
  f.batch.stop(); gate.resolve({ status: 'prepared' });
  const result = await run;
  assert.equal(result.status, 'stopped');
  assert.deepEqual(result.entries.map(entry => entry.status), ['prepared', 'not_started']);
  assert.equal(f.calls.filter(call => call[0] === 'prepare').length, 1);
});

test('cancel during companion preflight starts no broker operation', async () => {
  const gate = deferred();
  const f = fixture({ companion: () => gate.promise });
  const run = f.batch.run(f.previews, { authorized: true });
  f.batch.stop(); gate.resolve({ routes: ['first', 'second'], capabilities: [] });
  const result = await run;
  assert.deepEqual(f.calls, []);
  assert.equal(result.status, 'stopped');
  assert.ok(result.entries.every(entry => entry.status === 'not_started'));
});

test('known blocked forms leave attention outcomes while unrelated forms continue', async () => {
  const f = fixture({ companion: async payload => payload.action === 'ping' ? { routes: ['first', 'second'], capabilities: [] } : { status: payload.routeId === 'first' ? 'blocked' : 'prepared' } });
  const result = await f.batch.run(f.previews, { authorized: true });
  assert.deepEqual(result.entries.map(entry => entry.status), ['blocked', 'prepared']);
  assert.equal(result.status, 'finished');
});

test('unknown transport outcomes are saved once and stop later dispatches without retry', async () => {
  let runCalls = 0;
  const f = fixture({ companion: async payload => {
    if (payload.action === 'ping') return { routes: ['first', 'second'], capabilities: [] };
    runCalls++; throw new Error('Connection closed');
  } });
  const result = await f.batch.run(f.previews, { authorized: true });
  assert.equal(runCalls, 1);
  assert.deepEqual(f.calls.filter(call => call[0] === 'record'), [['record', 'first', 'unknown']]);
  assert.deepEqual(result.entries.map(entry => entry.status), ['unknown', 'not_started']);
});

test('failed result persistence stops the queue after its already reserved operation', async () => {
  const f = fixture({ workspace: { recordCompanion: async () => { throw new Error('Storage unavailable'); } } });
  const result = await f.batch.run(f.previews, { authorized: true });
  assert.equal(result.status, 'stopped');
  assert.equal(f.calls.filter(call => call[0] === 'prepare').length, 1);
  assert.deepEqual(result.entries.map(entry => entry.status), ['unknown', 'not_started']);
  assert.match(result.entries[0].detail, /save|storage/i);
});

test('stale review, pause or hold at final preparation prevents dispatch and stops remaining forms', async () => {
  const f = fixture({ workspace: { prepareReviewed: async () => { throw new Error('This route is on hold.'); } } });
  const result = await f.batch.run(f.previews, { authorized: true });
  assert.deepEqual(f.calls.map(call => call[0]), ['ping']);
  assert.deepEqual(result.entries.map(entry => entry.status), ['failed', 'not_started']);
});

test('review snapshots are detached before companion preflight awaits', async () => {
  const gate = deferred();
  const f = fixture({ companion: async payload => payload.action === 'ping' ? gate.promise : { status: 'prepared' } });
  const run = f.batch.run(f.previews, { authorized: true });
  f.previews[0].fields.email = 'changed@example.test';
  gate.resolve({ routes: ['first', 'second'], capabilities: [] }); await run;
  assert.equal(f.calls.find(call => call[0] === 'prepare')[2], 'person@example.test');
});

test('a second run cannot overlap a running batch', async () => {
  const gate = deferred();
  const f = fixture({ companion: () => gate.promise });
  const first = f.batch.run(f.previews, { authorized: true });
  await assert.rejects(f.batch.run(f.previews, { authorized: true }), /running/i);
  f.batch.stop(); gate.resolve({ routes: ['first', 'second'], capabilities: [] }); await first;
});

test('missing host permissions or required companion capabilities reserve no operations', async () => {
  for (const missing of ['permission', 'capability']) {
    const f = fixture({ companion: async () => ({ routes: missing === 'permission' ? ['first'] : ['first', 'second'], capabilities: [] }) });
    if (missing === 'capability') { f.routes[0].requiredAffirmations = ['own_request']; }
    const result = await f.batch.run(f.previews, { authorized: true });
    assert.equal(result.status, 'stopped');
    assert.deepEqual(f.calls, []);
  }
});

test('forged success states cannot become deletion or unproven verification outcomes', async () => {
  for (const status of ['removed', 'submitted', 'verification_sent']) {
    const f = fixture({ companion: async payload => payload.action === 'ping' ? { routes: ['first', 'second'], capabilities: [] } : { status } });
    const result = await f.batch.run(f.previews, { authorized: true });
    assert.equal(result.entries[0].status, 'unknown');
    assert.equal(result.status, 'stopped');
  }
});

async function realWorkspace() {
  const Core = require('../webapp/static/workspace-core.js');
  const values = new Map(); let sequence = 0;
  const core = Core.create({ storage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    uuid: () => (++sequence).toString(16).padStart(32, '0') });
  await core.api('/api/signup', { method: 'POST', body: JSON.stringify({ name: 'Example Person', age: 35, email: 'person@example.test', authorized: true }) });
  await core.api('/api/profile', { method: 'POST', body: JSON.stringify({ country: 'US' }) });
  core.setEvidence('searchpeoplefree', { first_name: 'Example', last_name: 'Person' });
  return core;
}

test('real workspace batch fills two reviewed routes while acceptance and deletion stay unverified', async () => {
  const core = await realWorkspace(), runs = [];
  const ids = ['peopledatalabs-form', 'searchpeoplefree'];
  const batch = Batch.create({ workspace: core, companion: async payload => {
    if (payload.action === 'ping') return { routes: ids, capabilities: [] };
    runs.push(payload); return { status: 'prepared' };
  } });
  const result = await batch.run(ids.map(id => core.fillPreview(id)), { authorized: true });
  assert.equal(result.status, 'finished');
  assert.equal(runs.length, 2);
  assert.deepEqual(runs[1].fields, { first_name: 'Example', last_name: 'Person', email: 'person@example.test' });
  assert.equal(core.dashboard().counts.requested, 0);
  assert.equal(core.dashboard().counts.removed, 0);
  assert.ok(core.dashboard().items.filter(item => ids.includes(item.site_id)).every(item => item.operation_id && item.status === 'needs_broker_step'));
});

test('a hold applied between real batch entries stops the later route before external disclosure', async () => {
  const core = await realWorkspace(), runs = [];
  const ids = ['peopledatalabs-form', 'searchpeoplefree'];
  const batch = Batch.create({ workspace: core, companion: async payload => {
    if (payload.action === 'ping') return { routes: ids, capabilities: [] };
    runs.push(payload.routeId); core.holdRoute('searchpeoplefree'); return { status: 'prepared' };
  } });
  const result = await batch.run(ids.map(id => core.fillPreview(id)), { authorized: true });
  assert.equal(result.status, 'stopped');
  assert.deepEqual(runs, ['peopledatalabs-form']);
  const held = core.dashboard().items.find(item => item.site_id === 'searchpeoplefree');
  assert.equal(held.held, true); assert.equal(held.operation_id, null);
});

test('separate concurrent batch controllers cannot repeat a real workspace operation', async () => {
  const core = await realWorkspace(); let runs = 0;
  const companion = async payload => {
    if (payload.action === 'ping') return { routes: ['peopledatalabs-form'], capabilities: [] };
    runs++; return { status: 'prepared' };
  };
  const previews = [core.fillPreview('peopledatalabs-form')];
  const a = Batch.create({ workspace: core, companion }), b = Batch.create({ workspace: core, companion });
  await Promise.all([a.run(previews, { authorized: true }), b.run(previews, { authorized: true })]);
  assert.equal(runs, 1);
});
