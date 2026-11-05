'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../webapp/static/workspace-core.js');
const Routes = require('../webapp/static/broker-routes.js');
const url = 'https://www.spokeo.com/Example-Person/California/Example-City/p123456';
const otherUrl = 'https://www.spokeo.com/Example-Person/California/Example-City/p654321';
const strong = changes => ({ status: 'matched', candidateUrl: url, match_verified: true, source: 'structured_person_v1',
  evidence: ['structured_person', 'exact_candidate_url', 'name', 'email'], ...changes });

async function fixture() {
  const values = new Map(); let sequence = 0, writes = 0, stamp = '2026-11-05T00:00:00.000Z';
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => { writes++; values.set(key, value); }, removeItem: key => values.delete(key) };
  const options = { storage, uuid: () => (++sequence).toString(16).padStart(32, '0'), now: () => stamp };
  const core = Core.create(options);
  await core.api('/api/signup', { method: 'POST', body: JSON.stringify({ name: 'Example Person', age: 20, email: 'person@example.test', authorized: true }) });
  await core.api('/api/profile', { method: 'POST', body: JSON.stringify({ country: 'US', city: 'Example City' }) });
  return { core, values, storage, options, writes: () => writes, time: value => { stamp = value; },
    row: () => core.dashboard().items.find(item => item.site_id === 'spokeo') };
}
const changeProfile = (core, change) => core.api('/api/profile', { method: 'POST', body: JSON.stringify(change) });

test('matching reserves a separate stable check before navigation without starting removal or changing counts', async () => {
  const f = await fixture(), request = f.core.matchRequest('spokeo', url);
  assert.deepEqual(request.identity, { name: 'Example Person', email: 'person@example.test', age: 20, city: 'Example City' });
  assert.equal(request.authorized, true); assert.equal(request.listingUrl, url);
  const item = JSON.parse(f.values.get(Core.KEY)).items.spokeo;
  assert.equal(item.matching_request.id, request.operationId);
  assert.equal(item.fields.listing_url, url); assert.equal(item.affirmations.own_listing, false);
  assert.equal(item.operation_id, null); assert.equal(f.row().match_status, 'pending');
  assert.equal(f.row().automatic_match, false);
  assert.deepEqual(f.core.dashboard().counts, { found: 0, requested: 0, removed: 0, blocked: 0 });
  assert.throws(() => f.core.matchRequest('spokeo', url), /already started/);
});

test('fresh structured name and typed identity email proof supplies derived approval without a manual claim', async () => {
  const f = await fixture(), request = f.core.matchRequest('spokeo', url);
  f.core.recordMatch('spokeo', request.operationId, strong());
  assert.equal(f.row().automatic_match, true); assert.equal(f.row().match_status, 'matched');
  assert.equal(f.row().affirmations.own_listing, true);
  assert.equal(f.core.snapshot().items.spokeo.affirmations.own_listing, false);
  assert.equal(f.row().matching_request, undefined); assert.equal(f.row().match_result, undefined);
  assert.deepEqual(f.core.dashboard().counts, { found: 0, requested: 0, removed: 0, blocked: 0 });
  const preview = f.core.fillPreview('spokeo');
  assert.equal(preview.reviewed.affirmations.own_listing, true);
  const operation = f.core.prepareReviewed(preview);
  assert.equal(operation.listingConfirmed, true); assert.equal(operation.fields.listing_url, url);
  assert.notEqual(operation.operationId, request.operationId);
});

test('saving the displayed derived checkbox preserves its source, while explicit withdrawal invalidates it', async () => {
  const f = await fixture(), request = f.core.matchRequest('spokeo', url);
  f.core.recordMatch('spokeo', request.operationId, strong());
  f.core.setEvidence('spokeo', { listing_url: url }, { own_listing: true });
  assert.equal(f.row().automatic_match, true);
  assert.notEqual(f.core.snapshot().items.spokeo.affirmations.own_listing, true);
  f.core.setEvidence('spokeo', { listing_url: url }, { own_listing: false });
  assert.equal(f.row().automatic_match, false); assert.equal(f.row().match_status, null);
  assert.equal(f.core.snapshot().items.spokeo.matching_request, undefined);
  assert.throws(() => f.core.prepare('spokeo'), /Confirm/);
  f.core.setEvidence('spokeo', { listing_url: url }, { own_listing: true });
  assert.equal(f.core.prepare('spokeo').listingConfirmed, true);
});

test('a displayed automatic checkbox cannot become a manual claim after proof expiry or context change',async()=>{
  for(const change of ['expiry','city']){
    const f=await fixture(),request=f.core.matchRequest('spokeo',url);f.core.recordMatch('spokeo',request.operationId,strong());
    const rendered=f.row();
    assert.equal(rendered.match_reference,request.operationId);
    if(change==='expiry')f.time('2026-11-05T00:30:00.001Z');
    else await changeProfile(f.core,{city:'Different City'});
    for(const review of [{},{automaticReference:rendered.match_reference}]){
      assert.throws(()=>f.core.setEvidence('spokeo',rendered.input_fields,rendered.affirmations,review),/expired or changed/);
      assert.notEqual(f.core.snapshot().items.spokeo.affirmations.own_listing,true);
      assert.throws(()=>f.core.prepare('spokeo'),/Confirm/);
    }
    f.core.setEvidence('spokeo',rendered.input_fields,{own_listing:true},{manualListingReview:true});
    assert.equal(f.core.prepare('spokeo').listingConfirmed,true);
  }
});

test('automatic editor references are exact and cannot authorize a changed candidate',async()=>{
  const f=await fixture(),request=f.core.matchRequest('spokeo',url);f.core.recordMatch('spokeo',request.operationId,strong());
  for(const [candidate,review]of [[url,{automaticReference:'f'.repeat(32)}],[otherUrl,{automaticReference:request.operationId}]])
    assert.throws(()=>f.core.setEvidence('spokeo',{listing_url:candidate},{own_listing:true},review),/expired or changed/);
  assert.equal(f.row().automatic_match,true);
});

test('changed listing URL invalidates all automatic proof and rejects a delayed old result', async () => {
  const f = await fixture(), request = f.core.matchRequest('spokeo', url);
  f.core.recordMatch('spokeo', request.operationId, strong());
  f.core.setEvidence('spokeo', { listing_url: otherUrl }, { own_listing: false });
  assert.equal(f.row().automatic_match, false); assert.equal(f.row().match_status, null);
  assert.throws(() => f.core.recordMatch('spokeo', request.operationId, strong()), /current authorized/);
  assert.equal(f.row().input_fields.listing_url, otherUrl);
});

test('missing, foreign, phone-only or unverified proof never grants an automatic identity approval', async () => {
  for (const changes of [{ match_verified: false }, { source: 'unreviewed' }, { candidateUrl: undefined }, { evidence: ['name', 'email'] },
    { evidence: ['structured_person', 'exact_candidate_url', 'name', 'phone'] }]) {
    const f = await fixture(), request = f.core.matchRequest('spokeo', url);
    f.core.recordMatch('spokeo', request.operationId, strong(changes));
    assert.equal(f.row().automatic_match, false); assert.equal(f.row().match_status, 'needs_identity');
    assert.throws(() => f.core.prepare('spokeo'), /Confirm/);
  }
});

test('unsupported, unknown and ambiguous checks are terminal unverified outcomes with no raw details stored', async () => {
  for (const status of ['unsupported', 'unknown', 'ambiguous', 'needs_identity', 'not_matched']) {
    const f = await fixture(), request = f.core.matchRequest('spokeo', url);
    f.core.recordMatch('spokeo', request.operationId, { status, detail: 'Private untrusted page text', evidence: [] });
    assert.equal(f.row().automatic_match, false);
    assert.equal(f.row().match_status, status === 'unknown' ? 'unsupported' : status);
    assert.equal(f.values.get(Core.KEY).includes('Private untrusted page text'), false);
    const next = f.core.matchRequest('spokeo', url);
    assert.notEqual(next.operationId, request.operationId);
    assert.throws(() => f.core.recordMatch('spokeo', request.operationId, strong()), /current authorized/);
  }
});

test('matching results are idempotent for the same proof and cannot be replaced by another outcome', async () => {
  const f = await fixture(), request = f.core.matchRequest('spokeo', url);
  f.core.recordMatch('spokeo', request.operationId, strong());
  const before = f.writes(); f.core.recordMatch('spokeo', request.operationId, strong());
  assert.equal(f.writes(), before);
  assert.throws(() => f.core.recordMatch('spokeo', request.operationId, { status: 'not_matched', evidence: [] }), /already recorded/);
  for (const changes of [{ candidateUrl: otherUrl }, { evidence: ['name', 'email', 'raw_profile'] }, { address: 'Unapproved raw identity' }]) {
    const other = await fixture(), pending = other.core.matchRequest('spokeo', url);
    assert.throws(() => other.core.recordMatch('spokeo', pending.operationId, strong(changes)), /invalid/);
    assert.equal(other.row().automatic_match, false);
  }
});

test('identity, country and city changes invalidate an existing request and its result', async () => {
  for (const mutation of [state => { state.profile.id = 'f'.repeat(32); }, state => { state.profile.email = 'changed@example.test'; },
    state => { state.profile.name = 'Different Person'; }, state => { state.profile.age = 21; }, state => { state.profile.city = 'Another City'; },
    state => { state.profile.country = 'CA'; }]) {
    const f = await fixture(), request = f.core.matchRequest('spokeo', url), state = JSON.parse(f.values.get(Core.KEY));
    mutation(state); f.values.set(Core.KEY, JSON.stringify(state));
    const reopened = Core.create(f.options);
    assert.throws(() => reopened.recordMatch('spokeo', request.operationId, strong()));
    assert.equal(reopened.dashboard().items.find(item => item.site_id === 'spokeo')?.automatic_match || false, false);
    assert.equal(reopened.snapshot().items.spokeo.matching_request, undefined);
  }
});

test('country, campaign pause, route hold and started removal guard every new matching stage', async () => {
  for (const mode of ['country', 'pause', 'hold', 'started']) {
    const f = await fixture(), request = f.core.matchRequest('spokeo', url);
    if (mode === 'country') await changeProfile(f.core, { country: 'CA' });
    if (mode === 'pause') await f.core.api('/api/campaign', { method: 'POST', body: JSON.stringify({ action: 'pause' }) });
    if (mode === 'hold') f.core.holdRoute('spokeo');
    if (mode === 'started') { f.core.setEvidence('spokeo', { listing_url: url }, { own_listing: true }); f.core.prepare('spokeo'); }
    assert.throws(() => f.core.matchRequest('spokeo', otherUrl));
    assert.throws(() => f.core.recordMatch('spokeo', request.operationId, strong()));
  }
  const f = await fixture();
  assert.throws(() => f.core.matchRequest('apollo', url), /no reviewed/);
  assert.throws(() => f.core.matchRequest('spokeo', 'https://www.spokeo.com/optout'));
});

test('failed request or result storage returns no executable approval or removal operation', async () => {
  const f = await fixture(), before = f.values.get(Core.KEY), save = f.storage.setItem;
  f.storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => f.core.matchRequest('spokeo', url), /could not save/);
  assert.equal(f.values.get(Core.KEY), before); assert.equal(f.core.snapshot().items.spokeo.matching_request, undefined);
  f.storage.setItem = save; const request = f.core.matchRequest('spokeo', url);
  f.storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => f.core.recordMatch('spokeo', request.operationId, strong()), /could not save/);
  assert.equal(f.row().automatic_match, false); assert.equal(f.row().operation_id, null);
});

test('proof freshness is checked on use and expires without any scheduled work', async () => {
  const f = await fixture(), request = f.core.matchRequest('spokeo', url);
  f.core.recordMatch('spokeo', request.operationId, strong()); const preview = f.core.fillPreview('spokeo');
  f.time('2026-11-05T00:30:00.001Z');
  assert.equal(f.row().automatic_match, false); assert.equal(f.row().match_status, null);
  assert.throws(() => f.core.prepareReviewed(preview), /Confirm/);
  assert.throws(() => f.core.recordMatch('spokeo', request.operationId, strong()), /current authorized/);
  assert.notEqual(f.core.matchRequest('spokeo', url).operationId, request.operationId);
});

test('malformed or stale stored match metadata is ignored without rejecting the whole workspace', async () => {
  for (const mutation of [item => { item.matching_request.identity.email = 'different@example.test'; }, item => { item.match_result.source = 'untrusted'; },
    item => { item.match_result.evidence = ['name']; }, item => { item.match_result.candidate_url = otherUrl; },
    item => { item.match_result.observed_at = '2026-11-06T00:00:00.000Z'; }, item => { item.matching_request.created_at = '2026-02-30T00:00:00.000Z'; },
    item => { item.matching_request = 'invalid'; }, item => { item.match_result.raw_person = { private: true }; }]) {
    const f = await fixture(), request = f.core.matchRequest('spokeo', url);
    f.core.recordMatch('spokeo', request.operationId, strong());
    const state = JSON.parse(f.values.get(Core.KEY)); mutation(state.items.spokeo); f.values.set(Core.KEY, JSON.stringify(state));
    const reopened = Core.create(f.options), row = reopened.dashboard().items.find(item => item.site_id === 'spokeo');
    assert.equal(row.automatic_match, false); assert.equal(row.match_result, undefined); assert.equal(row.matching_request, undefined);
    assert.throws(() => reopened.prepare('spokeo'), /Confirm/);
  }
});

test('backups never import automatic proof or listing approval', async () => {
  const f = await fixture(), request = f.core.matchRequest('spokeo', url);
  f.core.recordMatch('spokeo', request.operationId, strong()); const backup = JSON.parse(f.core.exportData());
  backup.items.spokeo.affirmations.own_listing = true;
  const other = await fixture(); other.core.remove(); other.core.importData(JSON.stringify(backup));
  const row = other.row(); assert.equal(row.automatic_match, false); assert.equal(row.match_status, null);
  assert.notEqual(row.affirmations.own_listing, true);
  assert.equal(other.core.snapshot().items.spokeo.matching_request, undefined);
  assert.throws(() => other.core.prepare('spokeo'), /Confirm/);
});

test('default browser matching methods serialize reservations with the shared mutation lock', async () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const values = new Map(); let sequence = 0, locks = 0, tail = Promise.resolve();
  const context = { URL, Date, EraseBrokerRoutes: Routes, crypto: { randomUUID: () => (++sequence).toString(16).padStart(32, '0') },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    navigator: { locks: { request: (_name, _options, action) => { locks++; const task = tail.then(action); tail = task.catch(() => {}); return task; } } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../webapp/static/workspace-core.js'), 'utf8'), context);
  const core = context.EraseWorkspace;
  await core.api('/api/signup', { method: 'POST', body: JSON.stringify({ name: 'Example Person', age: 20, email: 'person@example.test', authorized: true }) });
  await changeProfile(core, { country: 'US', city: 'Example City' });
  const checks = await Promise.allSettled([core.matchRequest('spokeo', url), core.matchRequest('spokeo', url)]);
  assert.equal(checks.filter(result => result.status === 'fulfilled').length, 1);
  const request = checks.find(result => result.status === 'fulfilled').value, before = locks;
  await core.recordMatch('spokeo', request.operationId, strong()); assert.equal(locks, before + 1);
  assert.equal(core.dashboard().items.find(item => item.site_id === 'spokeo').automatic_match, true);
  assert.equal(locks, before + 1);
});

test('reviewed submit activation is recorded separately from broker acceptance and deletion', async () => {
  for (const [routeId, stage] of [['fastpeoplesearch', 'verification_initiation'], ['tr-numaraara', 'request_submission']]) {
    const f = await fixture();
    if (routeId === 'fastpeoplesearch') f.core.setEvidence(routeId, { first_name: 'Example', last_name: 'Person' });
    else { await changeProfile(f.core, { country: 'TR' }); f.core.setEvidence(routeId, { full_name: 'Example Person', request_text: 'Please remove my own record.' }, { own_request: true }); }
    const operation = f.core.prepare(routeId);
    f.core.recordCompanion(routeId, operation.operationId, { status: 'submission_attempted', attempt_verified: true, stage });
    const row = f.core.dashboard().items.find(item => item.site_id === routeId);
    assert.equal(row.status, 'needs_broker_step'); assert.equal(row.evidence.attempt_verified, true);
    assert.equal(row.evidence.stage, stage); assert.equal(row.evidence.acceptance_verified, false);
    assert.match(row.detail, /submit control was activated/);
    assert.equal(f.core.dashboard().counts.requested, 0); assert.equal(f.core.dashboard().counts.removed, 0);
  }
});

test('unproven, foreign-route or wrong-stage submit attempts remain uncertain', async () => {
  for (const change of [{ attempt_verified: false, stage: 'verification_initiation' }, { attempt_verified: true, stage: 'request_submission' }]) {
    const f = await fixture(); f.core.setEvidence('fastpeoplesearch', { first_name: 'Example', last_name: 'Person' });
    const operation = f.core.prepare('fastpeoplesearch');
    f.core.recordCompanion('fastpeoplesearch', operation.operationId, { status: 'submission_attempted', ...change });
    assert.equal(f.core.dashboard().items.find(item => item.site_id === 'fastpeoplesearch').status, 'uncertain');
  }
  const f = await fixture(), operation = f.core.prepare('peopledatalabs-form');
  f.core.recordCompanion('peopledatalabs-form', operation.operationId, { status: 'submission_attempted', attempt_verified: true });
  assert.equal(f.core.dashboard().items.find(item => item.site_id === 'peopledatalabs-form').status, 'uncertain');
  assert.equal(f.core.dashboard().counts.requested, 0);
});
