'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Background = require('../extension/background.js');
const Auto = require('../extension/automatic-executor.js');

const sender = { url: 'https://erase-me-preview.vercel.app/', tab: { id: 90 } };
const listing = 'https://www.spokeo.com/Example-Person/Example-City/CA/p12345678';
function fixture({ image = true, nativeAllowed = true, challengeBlocked = false, answer = 'Ab123', changedDocument = false, changedListing = false, waitResult={status:'ready'}, changedWaitDocument=false } = {}) {
  const records = {}, calls = [];
  let tabUrl = '', opens = 0;
  const api = {
    storage: { local: { get: async key => ({ [key]: records[key] }), set: async value => { Object.assign(records, JSON.parse(JSON.stringify(value))); } } },
    permissions: { contains: async value => value.permissions ? nativeAllowed : true },
    runtime: { sendNativeMessage: async (host, value) => {
      calls.push({ kind: 'native', host, action: value.action });
      assert.equal(records['operation:' + 'a'.repeat(32)]?.result.status, 'unknown', 'Journal must precede native recognition');
      return value.action === 'capabilities' ? { ok: true, capabilities: { image: true, audio: false } } : { ok: true, answer };
    } },
    tabs: { create: async value => { opens++; tabUrl = value.url; calls.push({ kind: 'open' }); return { id: 7, status: 'complete' }; }, get: async () => ({ id: 7, url: tabUrl, status: 'complete' }) },
    scripting: { executeScript: async spec => {
      if (spec.files) { calls.push({ kind: 'install', files: spec.files }); return [{ documentId: 'owned-document' }]; }
      const text = spec.func.toString();
      if(text.includes('EraseAutomaticExecutor.waitReady')){
        calls.push({kind:'wait'});
        assert.equal(records['operation:'+'a'.repeat(32)]?.result.status,'unknown','Journal must precede readiness observation');
        assert.deepEqual(spec.target.documentIds,['owned-document']);
        assert.equal(spec.args[0].consentId,Auto.CONTRACTS.fastpeoplesearch.id);
        return [{documentId:changedWaitDocument?'changed-document':'owned-document',result:waitResult}];
      }
      if (text.includes('EraseAutomaticExecutor.capture')) {
        calls.push({ kind: 'capture' });
        assert.deepEqual(spec.target.documentIds, ['owned-document']);
        return [{ documentId: changedDocument ? 'changed-document' : 'owned-document', result: challengeBlocked ? { status: 'blocked', detail: 'A genuine challenge pass is required.' } : image ? { status: 'image', media: 'aW1hZ2U=', alphabet: '', challengeRef: 'opaque-reference' } : { status: 'ready' } }];
      }
      if (text.includes('EraseAutomaticExecutor.submit')) {
        calls.push({ kind: 'submit', payload: spec.args[0] });
        assert.deepEqual(spec.target.documentIds, ['owned-document']);
        return [{ documentId: 'owned-document', result: { status: 'submission_attempted', attempt_verified: true, stage: Auto.CONTRACTS[spec.args[0].routeId].stage, detail: 'Native submission event observed. Acceptance is unverified.' } }];
      }
      if (text.includes('EraseRecordMatcher.matchPage')) {
        const Matcher=require('../extension/record-matcher.js');
        const document={URL:changedListing?listing.replace('p12345678','p87654321'):listing,querySelectorAll:()=>[{textContent:JSON.stringify({'@context':'https://schema.org','@type':'Person',url:listing,name:'Example Person',email:'person@example.test',age:35,address:{addressLocality:'Example City'}})}]};
        return [{documentId:'owned-document',result:Matcher.matchPage(spec.args[0],document,spec.args[1])}];
      }
      return [{ documentId: 'owned-document', result: { status: 'prepared', detail: 'Fields filled.' } }];
    } }
  };
  return { api, calls, records, opens: () => opens };
}
function message(routeId = 'tr-numaraara') {
  return { type: 'erase-me', action: 'run', routeId, operationId: 'a'.repeat(32), authorized: true,
    fields: routeId === 'fastpeoplesearch' ? { first_name: 'Example', last_name: 'Person', email: 'person@example.test' } : { full_name: 'Example Person', email: 'person@example.test', request_text: 'Please remove my own information.' },
    ownRequestConfirmed: true, autoSubmit: true, consentId: Auto.CONTRACTS[routeId].id };
}

test('automatic run journals before recognition and submits once in the same owned document', async () => {
  const f = fixture(), request = message();
  const result = await Background.dispatch(request, sender, f.api);
  assert.equal(result.status, 'submission_attempted'); assert.equal(result.attempt_verified, true);
  assert.equal(f.calls.filter(call => call.kind === 'submit').length, 1);
  const native = f.calls.find(call => call.kind === 'native');
  assert.equal(native.host, 'org.eraseme.challenge'); assert.equal(native.action, 'recognize_image');
  assert.equal(f.calls.find(call => call.kind === 'submit').payload.answer, 'Ab123');
  assert.equal(f.calls.find(call => call.kind === 'submit').payload.authorized, true);
  await Background.dispatch(request, sender, f.api);
  assert.equal(f.opens(), 1); assert.equal(f.calls.filter(call => call.kind === 'submit').length, 1);
  const saved = JSON.stringify(f.records);
  for (const secret of ['Ab123', 'person@example.test', 'Please remove', 'aW1hZ2U=']) assert.equal(saved.includes(secret), false);
});

test('missing actual managed challenge pass performs no recognition or submission', async () => {
  const f = fixture({ challengeBlocked: true });
  const result = await Background.dispatch(message('fastpeoplesearch'), sender, f.api);
  assert.equal(result.status, 'blocked');
  assert.equal(f.calls.some(call => ['native', 'submit'].includes(call.kind)), false);
});

test('a ready reviewed form needs no native recognizer', async () => {
  const f = fixture({ image: false });
  const result = await Background.dispatch(message('fastpeoplesearch'), sender, f.api);
  assert.equal(result.status, 'submission_attempted');
  assert.equal(f.calls.some(call => call.kind === 'native'), false);
  assert.equal(f.calls.filter(call=>call.kind==='wait').length,1);
  assert.ok(f.calls.findIndex(call=>call.kind==='wait')<f.calls.findIndex(call=>call.kind==='capture'));
});

test('unready, invalid and changed readiness documents stop before capture, recognition or submission',async()=>{
  for(const options of [{waitResult:{status:'blocked',detail:'The actual widget response did not arrive.'}},{waitResult:{status:'unknown'}},{changedWaitDocument:true}]){
    const f=fixture(options),request=message('fastpeoplesearch');
    const result=await Background.dispatch(request,sender,f.api);
    assert.ok(['blocked','unknown'].includes(result.status));
    assert.equal(f.calls.filter(call=>['capture','submit','native'].includes(call.kind)).length,0);
    await Background.dispatch(request,sender,f.api);
    assert.equal(f.calls.filter(call=>call.kind==='wait').length,1);assert.equal(f.opens(),1);
  }
});

test('image recognition does not invoke the managed-widget readiness path',async()=>{
  const f=fixture();await Background.dispatch(message(),sender,f.api);
  assert.equal(f.calls.filter(call=>call.kind==='wait').length,0);
});

test('recognizer permission denial, invalid answer or changed document prevents submission', async () => {
  for (const options of [{ nativeAllowed: false }, { answer: 'too-long-answer' }, { changedDocument: true }]) {
    const f = fixture(options), request = message();
    const result = await Background.dispatch(request, sender, f.api);
    assert.ok(['blocked', 'unknown'].includes(result.status));
    assert.equal(f.calls.some(call => call.kind === 'submit'), false);
    await Background.dispatch(request, sender, f.api); assert.equal(f.opens(), 1);
  }
});

test('automatic submission requires its exact reviewed contract before navigation', async () => {
  for (const extra of [{ consentId: 'unreviewed' }, { autoSubmit: 'yes' }, { routeId: 'usphonebook', consentId: undefined }]) {
    const f = fixture(), request = { ...message(), ...extra };
    if (request.routeId === 'usphonebook') request.fields = { first_name: 'Example', last_name: 'Person', email: 'person@example.test' };
    await assert.rejects(Background.dispatch(request, sender, f.api)); assert.equal(f.opens(), 0);
  }
});

test('helper availability neither grants permission nor spawns an unapproved host', async () => {
  const f = fixture({ nativeAllowed: false });
  assert.deepEqual(await Background.dispatch({ type: 'erase-me', action: 'helper-status' }, sender, f.api), { available: false, image: false, audio: false });
  assert.deepEqual(f.calls, []);
  await assert.rejects(Background.dispatch({ type: 'erase-me', action: 'helper-status' }, { ...sender, url: 'https://evil.example/' }, f.api));
});

test('own-record checks are scoped to one approved listing and never store candidate fields or URLs', async () => {
  const f = fixture();
  const request = { type: 'erase-me', action: 'match', routeId: 'spokeo', operationId: 'b'.repeat(32), authorized: true, listingUrl: listing, identity: { name: 'Example Person', email: 'person@example.test', age: 35, city: 'Example City' } };
  const result = await Background.dispatch(request, sender, f.api);
  assert.equal(result.status, 'matched'); assert.equal(result.match_verified, true);
  assert.equal(result.source, 'structured_person_v1');
  await Promise.all([Background.dispatch(request, sender, f.api), Background.dispatch(request, sender, f.api)]);
  assert.equal(f.opens(), 1);
  const saved = JSON.stringify(f.records);
  for (const privateValue of [listing, 'person@example.test', 'Example City', 'Example Person']) assert.equal(saved.includes(privateValue), false);
});

test('record checks reject foreign origins, extra identity fields and unsupported listing URLs', async () => {
  const base = { type: 'erase-me', action: 'match', routeId: 'spokeo', operationId: 'b'.repeat(32), authorized: true, listingUrl: listing, identity: { name: 'Example Person', email: 'person@example.test', age: 35, city: null } };
  for (const change of [{ listingUrl: 'https://evil.example/person' }, { identity: { ...base.identity, street: 'Private data' } }, { routeId: 'apollo' }, { authorized: false }]) {
    const f = fixture(); await assert.rejects(Background.dispatch({ ...base, ...change }, sender, f.api)); assert.equal(f.opens(), 0);
  }
});

test('same-document navigation after the initial tab check cannot verify the old candidate',async()=>{
  const f=fixture({changedListing:true});
  const result=await Background.dispatch({type:'erase-me',action:'match',routeId:'spokeo',operationId:'b'.repeat(32),authorized:true,listingUrl:listing,identity:{name:'Example Person',email:'person@example.test',age:35,city:'Example City'}},sender,f.api);
  assert.equal(result.status,'unsupported');assert.deepEqual(result.evidence,[]);
});

test('real structured matcher evidence survives background validation and authorizes only the matching core candidate',async()=>{
  const Core=require('../webapp/static/workspace-core.js'),storage=new Map();let sequence=0;
  const core=Core.create({storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},uuid:()=>(++sequence).toString(16).padStart(32,'0')});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',email:'person@example.test',age:35,authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',city:'Example City'})});
  const request=core.matchRequest('spokeo',listing),f=fixture();
  const result=await Background.dispatch({type:'erase-me',action:'match',...request},sender,f.api);
  assert.equal(result.status,'matched');assert.ok(result.evidence.includes('structured_person'));assert.ok(result.evidence.includes('exact_candidate_url'));
  core.recordMatch('spokeo',request.operationId,result);
  assert.equal(core.dashboard().items.find(item=>item.site_id==='spokeo').automatic_match,true);
  assert.equal(core.fillPreview('spokeo').reviewed.affirmations.own_listing,true);
  assert.equal(core.dashboard().counts.removed,0);assert.equal(core.dashboard().counts.requested,0);
});
