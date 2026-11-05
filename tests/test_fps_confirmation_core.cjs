'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../webapp/static/workspace-core.js');
const Session=require('../webapp/static/removal-session.js');
async function fixture(){
  const values=new Map();let sequence=0;
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const options={storage,uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=> '2026-11-05T00:00:00.000Z'};
  const core=Core.create(options);
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'person@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',city:'Example City'})});
  core.setEvidence('fastpeoplesearch',{first_name:'Example',last_name:'Person'});
  const request=core.mailSessionRequest('fastpeoplesearch'),request_id='b'.repeat(32),issued_at=1793836800,expires_at=issued_at+7*86400;
  const contact_email='removal+erase-'+request_id+'@gmail.com';
  const claims={v:1,request_id,route_id:'fastpeoplesearch',operation_id:request.operation_id,recipient:contact_email,issued_at,expires_at};
  const contact={status:'ready',route_id:'fastpeoplesearch',operation_id:request.operation_id,request_id,contact_email,expires_at,capability:Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43),automatic_execution:false};
  core.bindMailContact('fastpeoplesearch',contact);
  const operation=core.prepare('fastpeoplesearch');
  core.recordCompanion('fastpeoplesearch',operation.operationId,{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'});
  const receipt={status:'held',route_id:'fastpeoplesearch',operation_id:operation.operationId,request_id,reason:'route_validation_required',received_at:issued_at,receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:true};
  core.recordMailReceipt('fastpeoplesearch',receipt);
  const confirmation_url='https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email:contact_email,ticketid:'12345678'});
  const response={status:'confirmation_ready',route_id:'fastpeoplesearch',operation_id:operation.operationId,request_id,receipt_ref:receipt.receipt_ref,confirmation_url,automatic_execution:false};
  return {core,contact,receipt,response,values,storage,options};
}
test('FastPeopleSearch continuation uses only original fields and persists no private URL or accepted-removal claim',async()=>{
  const f=await fixture();
  const request=f.core.mailContinuationRequest('fastpeoplesearch',{});
  assert.deepEqual(request,{capability:f.contact.capability,explicit:true,receipt_ref:f.receipt.receipt_ref});
  const operation=f.core.prepareMailContinuation('fastpeoplesearch',f.response,{});
  assert.deepEqual(operation.fields,{first_name:'Example',last_name:'Person',email:f.contact.contact_email});
  assert.equal(operation.confirmationUrl,f.response.confirmation_url);
  for(const value of [f.values.get(Core.KEY),f.core.exportData(),JSON.stringify(f.core.dashboard())]){
    assert.equal(value.includes(f.response.confirmation_url),false);assert.equal(value.includes('ticketid'),false);
  }
  assert.throws(()=>Core.create(f.options).mailContinuationRequest('fastpeoplesearch',{}),/already started/);
  assert.throws(()=>f.core.prepareMailContinuation('fastpeoplesearch',f.response,{}),/already started/);
  f.core.recordMailContinuation('fastpeoplesearch',operation.operationId,{status:'prepared'});
  assert.equal(f.core.snapshot().items.fastpeoplesearch.status,'needs_broker_step');
  assert.equal(f.core.snapshot().items.fastpeoplesearch.continuation.acceptance_verified,false);
  assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);
});
test('matching URL must retain the original first name, last name, empty middle and bound contact',async()=>{
  const f=await fixture();f.core.mailContinuationRequest('fastpeoplesearch',{});
  const base=f.response.confirmation_url;
  for(const url of [base.replace('firstname=Example','firstname=Other'),base.replace('lastname=Person','lastname=Else'),base.replace('middlename=','middlename=Middle'),base.replace('email=removal','email=other'),base+'&ticketid=9',base+'&redirect=evil',base.replace('www.fastpeoplesearch.com','www.usphonebook.com'),base.replace('/optout/removal','/optout/%72emoval'),base.replace('/optout/removal','/optout/../optout/removal'),base+'#fragment',base.replace('ticketid=12345678','ticketid=abc'),base.replace('https:','http:'),base.replace('www.fastpeoplesearch.com','www.fastpeoplesearch.com:444')]){
    assert.throws(()=>f.core.prepareMailContinuation('fastpeoplesearch',{...f.response,confirmation_url:url},{}),/does not match/);
    assert.equal(f.core.snapshot().items.fastpeoplesearch.continuation,undefined);
  }
  for(const change of [{route_id:'usphonebook'},{operation_id:'d'.repeat(32)},{request_id:'e'.repeat(32)},{receipt_ref:'f'.repeat(64)}])assert.throws(()=>f.core.prepareMailContinuation('fastpeoplesearch',{...f.response,...change},{}),/does not match/);
});
test('additional identity fields cannot be accepted or saved through FPS link opening',async()=>{
  const f=await fixture();
  for(const value of [undefined,null,[],{city:'Example City'},{birth_year:1990},{street_address:'Example Street'},{phone:'1234567890'}])assert.throws(()=>f.core.mailContinuationRequest('fastpeoplesearch',value),/additional identity fields/);
  assert.equal(f.core.snapshot().items.fastpeoplesearch.mail_continuation_authorized_at,undefined);
  assert.equal(f.core.snapshot().items.fastpeoplesearch.continuation,undefined);
});
test('holds and pause stop FPS release and navigation without changing the no-replay boundary',async()=>{
  for(const gate of ['held','paused']){
    const f=await fixture();
    if(gate==='held')f.core.holdRoute('fastpeoplesearch');else await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});
    assert.throws(()=>f.core.mailContinuationRequest('fastpeoplesearch',{}));assert.throws(()=>f.core.prepareMailContinuation('fastpeoplesearch',f.response,{}));
    assert.equal(f.core.snapshot().items.fastpeoplesearch.continuation,undefined);
  }
  const f=await fixture();f.core.mailContinuationRequest('fastpeoplesearch',{});f.core.holdRoute('fastpeoplesearch');
  assert.throws(()=>f.core.prepareMailContinuation('fastpeoplesearch',f.response,{}));assert.equal(f.core.snapshot().items.fastpeoplesearch.held,true);
});
test('saved FPS continuation cannot replay after private restoration and untrusted receipts lose authentication',async()=>{
  const f=await fixture();f.core.mailContinuationRequest('fastpeoplesearch',{});f.core.prepareMailContinuation('fastpeoplesearch',f.response,{});
  const other=await fixture();other.core.remove();other.core.importData(f.core.exportData());
  assert.equal(other.core.snapshot().items.fastpeoplesearch.mail_receipt.authenticated,false);
  assert.equal(other.core.snapshot().items.fastpeoplesearch.continuation.result,'unknown');
  other.core.recordMailReceipt('fastpeoplesearch',f.receipt);
  assert.throws(()=>other.core.mailContinuationRequest('fastpeoplesearch',{}),/already started/);
});
test('a real workspace one-pass session reserves FPS navigation only after an authenticated scoped receipt',async()=>{
  const f=await fixture(),calls=[];
  const session=Session.create({workspace:f.core,operatorKey:'a'.repeat(64),continuationFields:{fastpeoplesearch:{}},
    mail:{check:async()=>{calls.push('check');return f.receipt;},continuation:async()=>{calls.push('release');return f.response;}},
    companion:async payload=>{
      calls.push(payload.action);
      if(payload.action==='ping')return{routes:['fastpeoplesearch'],capabilities:['fastpeoplesearch-continuation-v1']};
      assert.equal(f.core.snapshot().items.fastpeoplesearch.continuation.result,'unknown');
      assert.deepEqual(payload.fields,{first_name:'Example',last_name:'Person',email:f.contact.contact_email});
      return{status:'prepared'};
    }});
  const result=await session.process({routeId:'fastpeoplesearch'});
  assert.deepEqual(calls,['check','ping','release','continue']);assert.equal(result.status,'needs_broker_step');
  await session.process({routeId:'fastpeoplesearch'});assert.equal(calls.filter(call=>call==='continue').length,1);
  assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);
  assert.equal(f.core.exportData().includes('ticketid'),false);
});
test('real FPS session stops before continuation on profile drift or mismatched released identity',async()=>{
  for(const change of ['profile','recipient']){
    const f=await fixture(),calls=[];
    const session=Session.create({workspace:f.core,operatorKey:'a'.repeat(64),continuationFields:{fastpeoplesearch:{}},
      mail:{check:async()=>{calls.push('check');if(change==='profile')await f.core.api('/api/profile',{method:'POST',body:JSON.stringify({city:'Another City'})});return f.receipt;},
        continuation:async()=>{calls.push('release');return{...f.response,confirmation_url:f.response.confirmation_url.replace('email=removal','email=other')};}},
      companion:async payload=>{calls.push(payload.action);return{routes:['fastpeoplesearch'],capabilities:['fastpeoplesearch-continuation-v1']};}});
    if(change==='profile')assert.equal((await session.process({routeId:'fastpeoplesearch'})).status,'unknown');
    else await assert.rejects(()=>session.process({routeId:'fastpeoplesearch'}),/does not match/);
    assert.equal(calls.includes('continue'),false);assert.equal(f.core.snapshot().items.fastpeoplesearch.continuation,undefined);
  }
});
