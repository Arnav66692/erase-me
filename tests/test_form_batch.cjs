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
  const batch = Batch.create({ workspace, companion, onUpdate: update => { updates.push(update); overrides.onUpdate?.(update); },
    ...(overrides.afterResult ? { afterResult: overrides.afterResult } : {}), ...(overrides.afterForms ? { afterForms: overrides.afterForms } : {}) });
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

test('new submission contracts reject an old companion before reserving even an earlier supported route',async()=>{
  for(const routeId of ['advancedbackgroundchecks','tr-nosorgulama','tr-numarasor','fastpeoplesearch','tr-numaraara']){
    let prepared=0,dispatched=0;
    const ids=['peopledatalabs-form',routeId];
    const workspace={routes:()=>ids.map(id=>({id,automationLevel:'companion',requiredAffirmations:[]})),prepareReviewed:async()=>{prepared++;throw new Error('Must not reserve.');}};
    const batch=Batch.create({workspace,companion:async payload=>{if(payload.action==='ping')return{routes:ids,capabilities:['automatic-submit-v1','structured-fields-v1']};dispatched++;}});
    const result=await batch.run(ids.map(id=>({routeId:id})),{authorized:true,automate:true});
    assert.equal(result.status,'stopped',routeId);assert.match(result.detail,/Update the companion/);assert.equal(prepared,0,routeId);assert.equal(dispatched,0,routeId);
  }
});

test('new companion capability allows reviewed new submissions while ordinary filling remains compatible',async()=>{
  for(const automate of [false,true]){
    let prepared=0,dispatched=0;
    const routeId='advancedbackgroundchecks';
    const workspace={routes:()=>[{id:routeId,automationLevel:'companion',requiredAffirmations:['own_request']}],prepareReviewed:async()=>{prepared++;return{routeId,operationId:'a'.repeat(32),fields:{}};},recordCompanion:async()=>{}};
    const batch=Batch.create({workspace,companion:async payload=>{
      if(payload.action==='ping')return{routes:[routeId],capabilities:['automatic-submit-v1','structured-fields-v1',...(automate?['reviewed-initial-submit-v2']:[])]};
      dispatched++;assert.equal(payload.autoSubmit,automate?true:undefined);
      return automate?{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'}:{status:'prepared'};
    }});
    const result=await batch.run([{routeId}],{authorized:true,automate});
    assert.equal(result.status,'finished');assert.equal(prepared,1);assert.equal(dispatched,1);
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

test('automatic submission is opt-in and binds the exact supported agreement',async()=>{
  const Auto=require('../extension/automatic-executor.js');
  for(const automate of [false,true]){
    const core=await realWorkspace(),runs=[];
    core.setEvidence('fastpeoplesearch',{first_name:'Example',last_name:'Person'});
    const batch=Batch.create({workspace:core,companion:async payload=>{
      if(payload.action==='ping')return{routes:['fastpeoplesearch'],capabilities:['automatic-submit-v1','reviewed-initial-submit-v2']};
      runs.push(payload);return automate?{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'}:{status:'prepared'};
    }});
    const result=await batch.run([core.fillPreview('fastpeoplesearch')],{authorized:true,automate});
    assert.equal(runs[0].autoSubmit,automate?true:undefined);
    assert.equal(runs[0].consentId,automate?Auto.CONTRACTS.fastpeoplesearch.id:undefined);
    assert.equal(result.status,'finished');assert.equal(core.dashboard().counts.requested,0);assert.equal(core.dashboard().counts.removed,0);
  }
});

test('unproven or wrong-stage submission attempts stop without promotion',async()=>{
  for(const proof of [{attempt_verified:false,stage:'verification_initiation'},{attempt_verified:true,stage:'request_submission'}]){
    const core=await realWorkspace();core.setEvidence('fastpeoplesearch',{first_name:'Example',last_name:'Person'});
    const batch=Batch.create({workspace:core,companion:async payload=>payload.action==='ping'?{routes:['fastpeoplesearch'],capabilities:['automatic-submit-v1','reviewed-initial-submit-v2']}:{status:'submission_attempted',...proof}});
    const result=await batch.run([core.fillPreview('fastpeoplesearch')],{authorized:true,automate:true});
    assert.equal(result.status,'stopped');assert.equal(result.entries[0].status,'unknown');assert.equal(core.dashboard().counts.requested,0);
  }
});

test('one after-result step runs only after persisted proof and respects Stop',async()=>{
  for(const stop of [false,true]){
    const core=await realWorkspace();core.setEvidence('fastpeoplesearch',{first_name:'Example',last_name:'Person'});let checks=0,batch;
    batch=Batch.create({workspace:core,companion:async payload=>{
      if(payload.action==='ping')return{routes:['fastpeoplesearch'],capabilities:['automatic-submit-v1','reviewed-initial-submit-v2']};
      if(stop)batch.stop();return{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'};
    },afterResult:async({routeId,isStopped})=>{
      assert.equal(core.snapshot().items[routeId].evidence.result,'submission_attempted');assert.equal(isStopped(),false);checks++;return{status:'awaiting_mail',detail:'No receipt is available yet.'};
    }});
    await batch.run([core.fillPreview('fastpeoplesearch')],{authorized:true,automate:true});assert.equal(checks,stop?0:1);
  }
});

test('automatic mode requires the new companion before reserving any form',async()=>{
  const f=fixture();const result=await f.batch.run(f.previews,{authorized:true,automate:true});
  assert.equal(result.status,'stopped');assert.deepEqual(f.calls,[['ping',undefined]]);
});

test('one final callback follows all persisted forms and receives detached minimal qualifying outcomes', async () => {
  let callbacks = 0, f;
  const verified = { status: 'verification_sent', route_verified: true, evidence: 'fresh_visible_success', detail: 'Broker receipt',
    fields: { email: 'never-pass@example.test' }, privateValue: 'do not forward' };
  f = fixture({ companion: async payload => {
    if (payload.action === 'ping') return { routes: ['first', 'second'], capabilities: [] };
    return payload.routeId === 'first' ? verified : { status: 'blocked' };
  }, afterForms: async ({ entries, isStopped }) => {
    callbacks++;
    assert.deepEqual(f.calls.filter(call => call[0] === 'record'), [['record', 'first', 'verification_sent'], ['record', 'second', 'blocked']]);
    assert.equal(isStopped(), false);
    assert.deepEqual(entries, [{ routeId: 'first', operationId: '1'.repeat(32),
      result: { status: 'verification_sent', route_verified: true, evidence: 'fresh_visible_success' } }]);
    entries[0].routeId = 'changed'; entries[0].result.status = 'removed'; entries.push({ routeId: 'injected' });
    assert.equal(verified.status, 'verification_sent');
    return { detail: 'One explicit final pass finished.' };
  } });
  const result = await f.batch.run(f.previews, { authorized: true });
  assert.equal(callbacks, 1);
  assert.equal(result.status, 'finished');
  assert.equal(result.detail, 'One explicit final pass finished.');
  assert.deepEqual(result.entries.map(entry => [entry.routeId, entry.status]), [['first', 'verification_sent'], ['second', 'blocked']]);
  assert.equal(JSON.stringify(f.updates).includes('never-pass@example.test'), false);
  assert.equal(JSON.stringify(f.updates).includes('do not forward'), false);
});

test('normal prepared and blocked forms complete a final pass with no invented qualifying mail operations', async () => {
  let callbacks = 0;
  const f = fixture({ companion: async payload => payload.action === 'ping' ? { routes: ['first', 'second'], capabilities: [] } :
    { status: payload.routeId === 'first' ? 'prepared' : 'blocked' },
  afterForms: async ({ entries }) => { callbacks++; assert.deepEqual(entries, []); return { detail: 'Nothing required a receipt check.' }; } });
  const result = await f.batch.run(f.previews, { authorized: true });
  assert.equal(callbacks, 1); assert.equal(result.status, 'finished');
});

test('preflight, preparation, persistence, unknown outcomes and after-result failures prevent the final pass', async () => {
  for (const failure of ['preflight', 'prepare', 'persist', 'unknown', 'afterResultUnknown', 'afterResultThrows']) {
    let callbacks = 0;
    const options = { companion: async payload => {
      if (payload.action === 'ping') return { routes: failure === 'preflight' ? ['first'] : ['first', 'second'], capabilities: [] };
      return payload.routeId === 'second' && failure === 'unknown' ? { status: 'unknown' } :
        { status: 'verification_sent', route_verified: true, evidence: 'fresh_visible_success' };
    }, afterForms: async () => { callbacks++; } };
    if (failure === 'prepare') options.workspace = { prepareReviewed: async () => { throw new Error('Held'); } };
    if (failure === 'persist') options.workspace = { recordCompanion: async id => { if (id === 'second') throw new Error('Storage unavailable'); } };
    if (failure === 'afterResultUnknown') options.afterResult = async () => ({ status: 'unknown' });
    if (failure === 'afterResultThrows') options.afterResult = async () => { throw new Error('Relay unavailable'); };
    const f = fixture(options), result = await f.batch.run(f.previews, { authorized: true });
    assert.equal(callbacks, 0, failure); assert.equal(result.status, 'stopped', failure);
  }
});

test('Stop during the last persisted form or final-pass announcement prevents the final callback', async () => {
  for (const timing of ['record', 'announce']) {
    let callbacks = 0, f;
    const options = { afterForms: async () => { callbacks++; } };
    if (timing === 'record') options.workspace = { recordCompanion: async id => { if (id === 'second') f.batch.stop(); } };
    if (timing === 'announce') options.onUpdate = update => { if (update.detail === 'Checking the approved final session steps.') f.batch.stop(); };
    f = fixture(options);
    const result = await f.batch.run(f.previews, { authorized: true });
    assert.equal(callbacks, 0, timing); assert.equal(result.status, 'stopped', timing);
    assert.deepEqual(result.entries.map(entry => entry.status), ['prepared', 'prepared']);
  }
});

test('Stop while a final pass is pending is visible through isStopped and never resumes forms', async () => {
  const gate = deferred(); let callbacks = 0, stopped;
  const f = fixture({ afterForms: async ({ isStopped }) => {
    callbacks++; assert.equal(isStopped(), false); await gate.promise; stopped = isStopped(); return { detail: 'The session stopped.' };
  } });
  const run = f.batch.run(f.previews, { authorized: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(callbacks, 1); assert.equal(f.batch.isRunning(), true);
  f.batch.stop(); gate.resolve(); const result = await run;
  assert.equal(stopped, true); assert.equal(result.status, 'stopped');
  assert.equal(f.calls.filter(call => call[0] === 'prepare').length, 2);
});

test('a final-pass unknown result or exception stops without repeating or replacing persisted form outcomes', async () => {
  for (const throws of [false, true]) {
    const f = fixture({ afterForms: async () => {
      if (throws) throw new Error('private relay error must not leak');
      return { status: 'unknown', detail: 'Check the existing operations.' };
    } });
    const result = await f.batch.run(f.previews, { authorized: true });
    assert.equal(result.status, 'stopped');
    assert.deepEqual(result.entries.map(entry => entry.status), ['prepared', 'prepared']);
    assert.equal(f.calls.filter(call => call[0] === 'run').length, 2);
    assert.doesNotMatch(result.detail, /private relay error/);
  }
});

test('final-pass summaries stay bounded and do not change request or deletion evidence', async () => {
  const core = await realWorkspace(); let callbacks = 0;
  core.setEvidence('fastpeoplesearch', { first_name: 'Example', last_name: 'Person' });
  const ids = ['peopledatalabs-form', 'fastpeoplesearch'];
  const batch = Batch.create({ workspace: core, companion: async payload => {
    if (payload.action === 'ping') return { routes: ids, capabilities: ['automatic-submit-v1','reviewed-initial-submit-v2'] };
    return payload.routeId === 'peopledatalabs-form' ? { status: 'verification_sent', route_verified: true, evidence: 'fresh_visible_success' } :
      { status: 'submission_attempted', attempt_verified: true, stage: 'verification_initiation' };
  }, afterForms: async ({ entries, isStopped }) => {
    callbacks++; assert.equal(isStopped(), false);
    assert.deepEqual(entries, [
      { routeId: 'peopledatalabs-form', operationId: core.snapshot().items['peopledatalabs-form'].operation_id,
        result: { status: 'verification_sent', route_verified: true, evidence: 'fresh_visible_success' } },
      { routeId: 'fastpeoplesearch', operationId: core.snapshot().items.fastpeoplesearch.operation_id,
        result: { status: 'submission_attempted', attempt_verified: true, stage: 'verification_initiation' } }
    ]);
    assert.equal(core.snapshot().items['peopledatalabs-form'].evidence.result, 'verification_sent');
    assert.equal(core.snapshot().items.fastpeoplesearch.evidence.result, 'submission_attempted');
    return { detail: 'x'.repeat(800) };
  } });
  const result = await batch.run(ids.map(id => core.fillPreview(id)), { authorized: true, automate: true });
  assert.equal(callbacks, 1); assert.equal(result.status, 'finished'); assert.equal(result.detail.length, 600);
  assert.equal(core.dashboard().counts.requested, 0); assert.equal(core.dashboard().counts.removed, 0);
});
