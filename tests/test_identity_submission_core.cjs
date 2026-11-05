'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../webapp/static/workspace-core.js');
const Details=require('../extension/identity-details.js');
const Next=require('../webapp/static/next-steps.js');
const contract=Details.CONTRACTS.fastpeoplesearch;
const minimalRequirements={date_of_birth:false,street_address:false,phone:false,no_validate:false,submit_no_validate:false};
const fullRequirements={date_of_birth:true,street_address:true,phone:true,no_validate:false,submit_no_validate:false};
const approval={authorized:true,consentId:contract.id,requirements:minimalRequirements};
const dob={method:'date_of_birth',date_of_birth:'1991-02-28',city:'OneActionCity',state:'NY',zip_code:'10001'};
const street={method:'street_address',street_address:'45 One Action Street Apt 7',city:'OneActionCity',state:'NY',zip_code:'10001'};
const full={method:'full_matching_details',date_of_birth:dob.date_of_birth,street_address:street.street_address,phone:'(212) 555-0100',city:street.city,state:street.state,zip_code:street.zip_code};
async function fixture(){
  const values=new Map();let sequence=0,failStorage=false;
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>{if(failStorage)throw Error('quota');values.set(key,value);},removeItem:key=>values.delete(key)};
  const options={storage,uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=> '2026-11-05T00:00:00.000Z'};
  const core=Core.create(options);
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'profile@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',city:'Example City',region:'CA'})});
  core.setEvidence('fastpeoplesearch',{first_name:'Example',last_name:'Person'});
  const session=core.mailSessionRequest('fastpeoplesearch'),request_id='b'.repeat(32),issued_at=1793836800,expires_at=issued_at+7*86400;
  const contact_email='removal+erase-'+request_id+'@gmail.com';
  const claims={v:1,request_id,route_id:'fastpeoplesearch',operation_id:session.operation_id,recipient:contact_email,issued_at,expires_at};
  core.bindMailContact('fastpeoplesearch',{status:'ready',request_id,route_id:'fastpeoplesearch',operation_id:session.operation_id,contact_email,expires_at,
    capability:Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43),automatic_execution:false});
  const operation=core.prepare('fastpeoplesearch');core.recordCompanion('fastpeoplesearch',operation.operationId,{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'});
  const receipt={status:'held',route_id:'fastpeoplesearch',operation_id:operation.operationId,request_id,reason:'route_validation_required',received_at:issued_at+1,receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:true};
  core.recordMailReceipt('fastpeoplesearch',receipt);core.mailContinuationRequest('fastpeoplesearch',{});
  const confirmation_url='https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email:contact_email,ticketid:'12345678'});
  const continuation=core.prepareMailContinuation('fastpeoplesearch',{status:'confirmation_ready',route_id:'fastpeoplesearch',operation_id:operation.operationId,request_id,receipt_ref:receipt.receipt_ref,confirmation_url,automatic_execution:false},{});
  core.recordMailContinuation('fastpeoplesearch',operation.operationId,{status:'prepared'});
  return {core,values,options,operation,continuation,receipt,contact_email,failStorage:()=>{failStorage=true;}};
}
function assertNoDetails(f,details){
  const outputs=[f.values.get(Core.KEY),f.core.exportData(),JSON.stringify(f.core.dashboard()),JSON.stringify(f.core.snapshot().activity)];
  for(const output of outputs)for(const value of [details.date_of_birth,details.street_address,details.phone,details.city,details.zip_code].filter(Boolean))assert.equal(output.includes(value),false,value+' was persisted');
  for(const output of outputs){assert.equal(output.includes('ticketid'),false);assert.equal(output.includes('final_request_submission'),false);assert.equal(output.includes('no_validate'),false);}
}
test('identity preview binds the reviewed original request without reserving or storing supplied identity values',async()=>{
  const f=await fixture(),before=f.values.get(Core.KEY),preview=f.core.identityPreview('fastpeoplesearch');
  assert.equal(preview.routeId,'fastpeoplesearch');assert.equal(preview.operationId,f.operation.operationId);assert.equal(preview.receiptRef,f.receipt.receipt_ref);assert.equal(preview.consentId,contract.id);
  assert.deepEqual(preview.fields,{first_name:'Example',last_name:'Person',email:f.contact_email});assert.equal(preview.profileContext.city,'Example City');
  assert.equal(f.values.get(Core.KEY),before);assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission,undefined);
  const card=Next.build(f.core.dashboard()).find(card=>card.routeId==='fastpeoplesearch');assert.equal(card.kind,'collect_information');assert.equal(card.action,'collect');
});
test('one approved DOB or address action reserves only a private reference before returning the exact transient payload',async()=>{
  for(const [details,auth] of [[dob,approval],[street,approval],[full,{...approval,requirements:fullRequirements}]]){
    const f=await fixture(),preview=f.core.identityPreview('fastpeoplesearch');
    const payload=f.core.prepareIdentitySubmission(preview,details,auth),saved=f.core.snapshot().items.fastpeoplesearch.final_submission;
    assert.equal(saved.id,payload.submissionId);assert.equal(saved.result,'unknown');assert.equal(saved.attempt_verified,false);assert.equal(saved.acceptance_verified,false);assert.equal(saved.deletion_verified,false);
    assert.deepEqual(payload.details,details);assert.deepEqual(payload.fields,preview.fields);assert.equal(payload.operationId,preview.operationId);assert.notEqual(payload.submissionId,payload.operationId);
    assert.deepEqual(Object.keys(payload).sort(),['routeId','operationId','requestId','receiptRef','submissionId','authorized','consentId','fields','details','requirements'].sort());
    assert.deepEqual(payload.requirements,auth.requirements);assert.notEqual(payload.requirements,auth.requirements);
    assertNoDetails(f,details);assert.equal(Next.build(f.core.dashboard()).find(card=>card.routeId==='fastpeoplesearch').action,'review');
    assert.throws(()=>f.core.identityPreview('fastpeoplesearch'),/already started/);assert.throws(()=>f.core.prepareIdentitySubmission(preview,details,approval),/already started/);
  }
});
test('invalid, unapproved or expanded fields reserve no action and never echo sensitive values',async()=>{
  for(const [details,auth] of [[dob,undefined],[dob,{authorized:false,consentId:contract.id}],[dob,{...approval,consentId:'other'}],[dob,{...approval,extra:true}],
    [{...street,street_address:'PRIVATE\x00ADDRESS'},approval],[{...dob,date_of_birth:'2020-01-01'},approval],[{...dob,street_address:'unexpected'},approval],[{...street,phone:'1234567890'},approval]]){
    const f=await fixture(),before=f.values.get(Core.KEY);
    assert.throws(()=>f.core.prepareIdentitySubmission(f.core.identityPreview('fastpeoplesearch'),details,auth),error=>!error.message.includes('PRIVATE'));
    assert.equal(f.values.get(Core.KEY),before);assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission,undefined);
  }
});
test('native requirements are explicit transient approval and must be satisfied before any action reference is saved',async()=>{
  for(const [details,auth] of [[dob,{authorized:true,consentId:contract.id}],[dob,{...approval,requirements:undefined}],
    [dob,{...approval,requirements:{...fullRequirements,phone:'true'}}],[dob,{...approval,requirements:fullRequirements}],
    [street,{...approval,requirements:fullRequirements}],[full,approval],[full,{...approval,requirements:{...fullRequirements,no_validate:true}}]]){
    const f=await fixture(),before=f.values.get(Core.KEY);
    assert.throws(()=>f.core.prepareIdentitySubmission(f.core.identityPreview('fastpeoplesearch'),details,auth));
    assert.equal(f.values.get(Core.KEY),before);assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission,undefined);
  }
});
test('changed profile, fields, contact or receipt after review stops before reservation',async()=>{
  for(const change of ['city','country','name','age','email','first_name','receipt','request','preview_extra','preview_field']){
    const f=await fixture(),preview=f.core.identityPreview('fastpeoplesearch');
    if(change==='city'||change==='country')await f.core.api('/api/profile',{method:'POST',body:JSON.stringify(change==='city'?{country:'US',city:'Changed City'}:{country:'CA'})});
    else if(change==='preview_extra')preview.extra=true;
    else if(change==='preview_field')preview.fields.email='other@example.test';
    else {
      const state=JSON.parse(f.values.get(Core.KEY));
      if(['name','age','email'].includes(change))state.profile[change]=change==='age'?36:change==='email'?'changed@example.test':'Another Person';
      else if(change==='first_name')state.items.fastpeoplesearch.fields.first_name='Another';
      else if(change==='receipt')state.items.fastpeoplesearch.mail_receipt.receipt_ref='d'.repeat(64);
      else state.items.fastpeoplesearch.continuation.receipt_ref='d'.repeat(64);
      f.values.set(Core.KEY,JSON.stringify(state));
    }
    assert.throws(()=>f.core.prepareIdentitySubmission(preview,dob,approval));assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission,undefined);
  }
});
test('holds, pause, completed reports, unsupported brokers and missing verified continuations cannot collect a final action',async()=>{
  for(const gate of ['held','paused','completed','unsupported','unknown','unauthenticated']){
    const f=await fixture(),preview=f.core.identityPreview('fastpeoplesearch');
    if(gate==='held')f.core.holdRoute('fastpeoplesearch');
    else if(gate==='paused')await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});
    else if(gate==='completed')f.core.recordUser('fastpeoplesearch','user_reported_completed');
    else if(gate==='unsupported')preview.routeId='usphonebook';
    else {const state=JSON.parse(f.values.get(Core.KEY));if(gate==='unknown')state.items.fastpeoplesearch.continuation.result='unknown';else state.items.fastpeoplesearch.mail_receipt.authenticated=false;f.values.set(Core.KEY,JSON.stringify(state));}
    assert.throws(()=>f.core.prepareIdentitySubmission(preview,street,approval));assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission,undefined);
  }
});
test('final submit proof stays separate from delivery, acceptance and verified deletion, with no raw result data stored',async()=>{
  const f=await fixture(),payload=f.core.prepareIdentitySubmission(f.core.identityPreview('fastpeoplesearch'),dob,approval);
  const result={status:'submission_attempted',attempt_verified:true,stage:'final_request_submission',acceptance_verified:true,deletion_verified:true,detail:'PRIVATE '+dob.date_of_birth,details:dob};
  f.core.recordIdentitySubmission('fastpeoplesearch',payload.submissionId,result);
  const final=f.core.snapshot().items.fastpeoplesearch.final_submission;
  assert.equal(final.result,'submission_attempted');assert.equal(final.attempt_verified,true);assert.equal(final.acceptance_verified,false);assert.equal(final.deletion_verified,false);
  assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);assertNoDetails(f,dob);
  assert.throws(()=>f.core.recordIdentitySubmission('fastpeoplesearch',payload.submissionId,{status:'blocked'}),/already recorded/);
});
test('unverified or wrong-stage final outcomes cannot become a submission attempt',async()=>{
  const f=await fixture(),payload=f.core.prepareIdentitySubmission(f.core.identityPreview('fastpeoplesearch'),dob,approval);
  for(const result of [{status:'submission_attempted'},{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'},{status:'requested'},{status:'removed'},{status:'submitted',attempt_verified:true,stage:'final_request_submission'}])
    assert.throws(()=>f.core.recordIdentitySubmission('fastpeoplesearch',payload.submissionId,result));
  assert.throws(()=>f.core.recordIdentitySubmission('fastpeoplesearch','d'.repeat(32),{status:'unknown'}));
  assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission.result,'unknown');
});
test('read-only final-result requests reconcile the same reserved reference without disclosing details or replaying it',async()=>{
  const f=await fixture();assert.throws(()=>f.core.identityResultRequest('fastpeoplesearch'));
  const payload=f.core.prepareIdentitySubmission(f.core.identityPreview('fastpeoplesearch'),street,approval),before=f.values.get(Core.KEY);
  assert.deepEqual(f.core.identityResultRequest('fastpeoplesearch'),{routeId:'fastpeoplesearch',operationId:payload.operationId,submissionId:payload.submissionId,authorized:true});
  assert.equal(f.values.get(Core.KEY),before);f.core.recordIdentitySubmission('fastpeoplesearch',payload.submissionId,{status:'unknown'});
  f.core.recordIdentitySubmission('fastpeoplesearch',payload.submissionId,{status:'submission_attempted',attempt_verified:true,stage:'final_request_submission'});assertNoDetails(f,street);
});
test('a hold during the in-flight action is preserved while its one result is recorded',async()=>{
  const f=await fixture(),payload=f.core.prepareIdentitySubmission(f.core.identityPreview('fastpeoplesearch'),dob,approval);
  f.core.holdRoute('fastpeoplesearch');const before=f.core.snapshot().items.fastpeoplesearch.status;
  f.core.recordIdentitySubmission('fastpeoplesearch',payload.submissionId,{status:'submission_attempted',attempt_verified:true,stage:'final_request_submission'});
  assert.equal(f.core.snapshot().items.fastpeoplesearch.held,true);assert.equal(f.core.snapshot().items.fastpeoplesearch.status,before);assert.equal(f.core.dashboard().items.find(item=>item.site_id==='fastpeoplesearch').status,'held');
  assert.throws(()=>f.core.identityResultRequest('fastpeoplesearch'));f.core.resumeRoute('fastpeoplesearch');assert.throws(()=>f.core.identityPreview('fastpeoplesearch'),/already started/);
});
test('restoration downgrades final proof and preserves its consumed reference even if imported status says ready',async()=>{
  const f=await fixture(),payload=f.core.prepareIdentitySubmission(f.core.identityPreview('fastpeoplesearch'),dob,approval);
  f.core.recordIdentitySubmission('fastpeoplesearch',payload.submissionId,{status:'submission_attempted',attempt_verified:true,stage:'final_request_submission'});
  for(const ready of [false,true]){
    const backup=JSON.parse(f.core.exportData());if(ready)backup.items.fastpeoplesearch.status='ready';
    // Use persistent storage so following reads inspect the actual imported state.
    const values=new Map(),restored=Core.create({storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},uuid:()=> 'e'.repeat(32),now:f.options.now});
    restored.importData(JSON.stringify(backup));const reference=restored.snapshot().items.fastpeoplesearch.final_submission;
    assert.equal(reference.id,payload.submissionId);assert.equal(reference.result,'unknown');assert.equal(reference.attempt_verified,false);assert.equal(reference.source,'imported_user_history');
    assert.throws(()=>restored.identityPreview('fastpeoplesearch'));assert.throws(()=>restored.identityResultRequest('fastpeoplesearch'));assert.throws(()=>restored.prepare('fastpeoplesearch'));
    assert.throws(()=>restored.recordIdentitySubmission('fastpeoplesearch',payload.submissionId,{status:'unknown'}));assert.equal(restored.dashboard().counts.requested,0);assert.equal(restored.dashboard().counts.removed,0);
    assert.equal(restored.exportData().includes(dob.date_of_birth),false);
  }
});
test('raw identity values inside a restored final reference are rejected before creating a workspace',async()=>{
  const f=await fixture();f.core.prepareIdentitySubmission(f.core.identityPreview('fastpeoplesearch'),street,approval);
  const backup=JSON.parse(f.core.exportData());backup.items.fastpeoplesearch.final_submission.details=street;
  const values=new Map(),restored=Core.create({storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},uuid:()=> 'e'.repeat(32),now:f.options.now});
  assert.throws(()=>restored.importData(JSON.stringify(backup)),error=>!error.message.includes(street.street_address));assert.equal(restored.snapshot().profile,null);assert.equal(values.size,0);
});
test('malformed stored final references cannot gain trusted proof or discard the no-replay boundary',async()=>{
  for(const change of ['extra','null','wrong_source','trusted_import','backdated']){
    const f=await fixture(),payload=f.core.prepareIdentitySubmission(f.core.identityPreview('fastpeoplesearch'),dob,approval);
    const state=JSON.parse(f.values.get(Core.KEY)),reference=state.items.fastpeoplesearch.final_submission;
    if(change==='extra')reference.date_of_birth=dob.date_of_birth;
    else if(change==='null')state.items.fastpeoplesearch.final_submission=null;
    else if(change==='wrong_source')reference.source='trusted_server';
    else if(change==='trusted_import')Object.assign(reference,{source:'imported_user_history',result:'submission_attempted',attempt_verified:true});
    else reference.observed_at='2026-11-04T00:00:00.000Z';
    f.values.set(Core.KEY,JSON.stringify(state));assert.throws(()=>Core.create(f.options).identityResultRequest('fastpeoplesearch'),/could not be read/);
    assert.equal(payload.submissionId,reference.id);
  }
});
test('storage failure and concurrent controllers never produce an unreserved second final payload',async()=>{
  const f=await fixture(),preview=f.core.identityPreview('fastpeoplesearch');f.failStorage();assert.throws(()=>f.core.prepareIdentitySubmission(preview,dob,approval),/save/);
  const second=await fixture(),a=second.core.identityPreview('fastpeoplesearch'),other=Core.create(second.options),b=other.identityPreview('fastpeoplesearch');
  const payload=second.core.prepareIdentitySubmission(a,dob,approval);assert.throws(()=>other.prepareIdentitySubmission(b,street,approval),/already started/);
  assert.equal(second.core.snapshot().items.fastpeoplesearch.final_submission.id,payload.submissionId);
});
test('holding an identity dialog checks its exact captured request before mutating current state',async()=>{
  const f=await fixture(),preview=f.core.identityPreview('fastpeoplesearch');
  await f.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',region:'CA',city:'Different City'})});
  assert.throws(()=>f.core.holdRoute('fastpeoplesearch',preview),/request changed/);
  assert.notEqual(f.core.snapshot().items.fastpeoplesearch.held,true);
  f.core.holdRoute('fastpeoplesearch',f.core.identityPreview('fastpeoplesearch'));
  assert.equal(f.core.snapshot().items.fastpeoplesearch.held,true);
});
