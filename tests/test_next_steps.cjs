'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../webapp/static/workspace-core.js');
const Next=require('../webapp/static/next-steps.js');
const PDL='peopledatalabs-form';
async function fixture(){
  const values=new Map();let sequence=0;
  const options={storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},
    uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=> '2026-11-05T00:00:00.000Z'};
  const core=Core.create(options);
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'profile@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',city:'Example City'})});
  function start(id=PDL,result={status:'prepared'}){
    if(['fastpeoplesearch','usphonebook','searchpeoplefree'].includes(id))core.setEvidence(id,{first_name:'Example',last_name:'Person'});
    if(id==='apollo')core.setEvidence(id,{business_email:'business@example.test'},{business_email:true});
    const operation=core.prepare(id);core.recordCompanion(id,operation.operationId,result);return operation;
  }
  function contact(id='fastpeoplesearch'){
    core.setEvidence(id,{first_name:'Example',last_name:'Person'});
    const request=core.mailSessionRequest(id),request_id=(id==='usphonebook'?'d':'b').repeat(32),issued_at=1793836800,expires_at=issued_at+7*86400;
    const contact_email='removal+erase-'+request_id+'@gmail.com';
    const claims={v:1,request_id,route_id:id,operation_id:request.operation_id,recipient:contact_email,issued_at,expires_at};
    const response={status:'ready',request_id,route_id:id,operation_id:request.operation_id,contact_email,expires_at,
      capability:Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43),automatic_execution:false};
    core.bindMailContact(id,response);return response;
  }
  function receipt(id='fastpeoplesearch'){
    const item=core.snapshot().items[id],contact=item.mail_contact;
    const result={status:'held',route_id:id,operation_id:item.operation_id,request_id:contact.request_id,reason:'route_validation_required',
      received_at:1793836801,receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:true};
    core.recordMailReceipt(id,result);return result;
  }
  function matchingForm(id='fastpeoplesearch'){
    const item=core.snapshot().items[id],fields=id==='usphonebook'?{city:'Example City',state:'CA',zip_code:'92101'}:{};
    core.mailContinuationRequest(id,fields);
    const confirmation_url=id==='usphonebook'?'https://www.usphonebook.com/removal/validate-record-info?key=fixture&ticketid=12345678':
      'https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email:item.mail_contact.contact_email,ticketid:'12345678'});
    core.prepareMailContinuation(id,{status:'confirmation_ready',route_id:id,operation_id:item.operation_id,request_id:item.mail_contact.request_id,
      receipt_ref:item.mail_receipt.receipt_ref,confirmation_url,automatic_execution:false},fields);
    core.recordMailContinuation(id,item.operation_id,{status:'prepared'});
  }
  return {core,values,options,start,contact,receipt,matchingForm,cards:()=>Next.build(core.dashboard())};
}

test('a new or paused workspace has no invented broker prompts or side effects',async()=>{
  const f=await fixture(),before=f.values.get(Core.KEY);assert.deepEqual(f.cards(),[]);assert.equal(f.values.get(Core.KEY),before);
  f.start();await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});assert.deepEqual(f.cards(),[]);
  for(const input of [null,{}, {campaign:{status:'active'}}, {campaign:{status:'paused'},items:[]}])assert.deepEqual(Next.build(input),[]);
});

test('new prepared operations freeze the exact typed, business and removal addresses before dispatch',async()=>{
  const f=await fixture();f.contact();
  const pdl=f.start(),apollo=f.start('apollo'),fps=f.start('fastpeoplesearch');
  const state=f.core.snapshot();
  for(const [id,operation,role] of [[PDL,pdl,'profile'],['apollo',apollo,'business'],['fastpeoplesearch',fps,'removal']]){
    assert.equal(state.items[id].operation_email,operation.fields.email||operation.fields.business_email);
    assert.equal(state.items[id].operation_email_role,role);assert.equal(state.items[id].operation_source,'browser_workspace');
    const prompt=f.cards().find(card=>card.routeId===id);assert.equal(prompt.email,state.items[id].operation_email);assert.equal(prompt.emailRole,role);
    assert.equal(prompt.kind,'finish_form');assert.equal(prompt.action,'focus');assert.equal(prompt.stage,'operation');
  }
  const saved=JSON.parse(f.values.get(Core.KEY));saved.profile.email='changed@example.test';f.values.set(Core.KEY,JSON.stringify(saved));
  assert.equal(f.cards().find(card=>card.routeId===PDL).email,'profile@example.test');
  assert.equal(f.cards().find(card=>card.routeId==='apollo').email,'business@example.test');
});

test('legacy typed-email history does not guess its recipient from the current profile',async()=>{
  const f=await fixture();f.start(PDL,{status:'verification_sent',route_verified:true,evidence:'fresh_visible_success'});
  const saved=JSON.parse(f.values.get(Core.KEY));delete saved.items[PDL].operation_email;delete saved.items[PDL].operation_email_role;
  saved.profile.email='current@example.test';f.values.set(Core.KEY,JSON.stringify(saved));
  const card=f.cards()[0];assert.equal(card.kind,'email_verification');assert.equal(card.email,null);assert.equal(card.emailRole,'unknown');
  assert.match(card.detail,/original request email was not saved/);assert.equal(JSON.stringify(card).includes('current@example.test'),false);
});

test('legacy dedicated and explicit Apollo business addresses remain tied to their requests',async()=>{
  const f=await fixture();f.contact();f.start('fastpeoplesearch');f.start('apollo');
  const saved=JSON.parse(f.values.get(Core.KEY));
  for(const id of ['fastpeoplesearch','apollo']){delete saved.items[id].operation_email;delete saved.items[id].operation_email_role;}
  f.values.set(Core.KEY,JSON.stringify(saved));
  assert.equal(f.cards().find(card=>card.routeId==='fastpeoplesearch').email,saved.items.fastpeoplesearch.mail_contact.contact_email);
  assert.equal(f.cards().find(card=>card.routeId==='apollo').email,'business@example.test');
});

test('verification prompts distinguish personal mailbox action from the removal-only receipt check',async()=>{
  const f=await fixture();f.start(PDL,{status:'verification_sent',route_verified:true,evidence:'fresh_visible_success'});
  f.contact();f.start('fastpeoplesearch',{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'});
  const personal=f.cards().find(card=>card.routeId===PDL),removal=f.cards().find(card=>card.routeId==='fastpeoplesearch');
  assert.equal(personal.email,'profile@example.test');assert.equal(personal.kind,'email_verification');assert.match(personal.detail,/does not connect to that inbox/);
  assert.equal(removal.kind,'removal_mail');assert.match(removal.detail,/email delivery is not yet established/);assert.match(removal.detail,/separate removal-only mailbox/);
  assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);
});

test('authenticated confirmation is reviewed before opening and only prepared matching forms ask for identity details',async()=>{
  for(const id of ['fastpeoplesearch','usphonebook']){
    const f=await fixture();f.contact(id);f.start(id);f.receipt(id);
    const ready=f.cards()[0];assert.equal(ready.kind,'confirmation_ready');assert.equal(ready.action,'review');assert.equal(ready.stage,null);
    f.matchingForm(id);const card=f.cards()[0];assert.equal(card.kind,id==='fastpeoplesearch'?'collect_information':'detail_required');assert.equal(card.action,id==='fastpeoplesearch'?'collect':'focus');assert.equal(card.stage,'continuation');
    assert.equal(card.email,f.core.snapshot().items[id].mail_contact.contact_email);
    if(id==='fastpeoplesearch'){assert.match(card.detail,/date of birth/);assert.match(card.detail,/street address or phone/);assert.match(card.detail,/app checks/);}
    else assert.match(card.detail,/full date of birth or your current street address/);
    assert.match(card.detail,/city, state and ZIP/i);
    assert.equal(card.detail.includes('18'),false);assert.equal(f.core.dashboard().counts.removed,0);
  }
});

test('unknown, interrupted and unsupported confirmations never claim an identity form is ready',async()=>{
  const f=await fixture();f.contact();f.start('fastpeoplesearch',{status:'unknown'});
  assert.equal(f.cards()[0].kind,'outcome_review');assert.equal(f.cards()[0].action,'review');
  f.receipt();const item=f.core.snapshot().items.fastpeoplesearch;
  f.core.recordMailReceipt('fastpeoplesearch',{status:'held',route_id:'fastpeoplesearch',operation_id:item.operation_id,request_id:item.mail_contact.request_id,
    reason:'confirmation_link_unvalidated',received_at:1793836801,receipt_ref:'d'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:false});
  assert.equal(f.cards()[0].kind,'confirmation_review');assert.equal(f.cards()[0].action,'review');
  const other=await fixture();other.contact();other.start('fastpeoplesearch');other.receipt();
  other.core.mailContinuationRequest('fastpeoplesearch',{});
  const current=other.core.snapshot().items.fastpeoplesearch;
  other.core.prepareMailContinuation('fastpeoplesearch',{status:'confirmation_ready',route_id:'fastpeoplesearch',operation_id:current.operation_id,request_id:current.mail_contact.request_id,
    receipt_ref:current.mail_receipt.receipt_ref,confirmation_url:'https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email:current.mail_contact.contact_email,ticketid:'12345678'}),automatic_execution:false},{});
  assert.equal(other.cards()[0].kind,'outcome_review');
});

test('held, paused and completed routes never generate new-action prompts',async()=>{
  const f=await fixture();f.contact();f.start('fastpeoplesearch');f.receipt();f.matchingForm();f.core.holdRoute('fastpeoplesearch');assert.deepEqual(f.cards(),[]);
  f.core.resumeRoute('fastpeoplesearch');f.core.recordUser('fastpeoplesearch','user_reported_completed');assert.deepEqual(f.cards(),[]);
  const other=await fixture();other.start(PDL,{status:'submitted',route_verified:true,evidence:'fresh_visible_success'});assert.deepEqual(other.cards(),[]);
});

test('a reported submission asks for review without treating earlier prefill as an unfinished new submission',async()=>{
  const f=await fixture();f.start();f.core.recordUser(PDL,'user_reported_requested');
  const card=f.cards()[0];assert.equal(card.kind,'outcome_review');assert.equal(card.action,'review');assert.equal(card.stage,null);
  assert.match(card.detail,/You reported submitting/);assert.equal(card.email,'profile@example.test');assert.equal(f.core.dashboard().counts.requested,0);
});

test('backup restoration preserves recorded address as history without authenticated identity prompts or focus',async()=>{
  const f=await fixture();f.contact();f.start('fastpeoplesearch');f.receipt();f.matchingForm();const backup=f.core.exportData();
  f.core.remove();f.core.importData(backup);
  const card=f.cards()[0];assert.equal(card.kind,'history_review');assert.equal(card.action,'review');assert.equal(card.stage,null);
  assert.equal(card.email,f.core.snapshot().items.fastpeoplesearch.operation_email);
  assert.throws(()=>f.core.focusRequest('fastpeoplesearch','continuation'),/active request/);
  assert.throws(()=>f.core.focusRequest('fastpeoplesearch','operation'),/active request/);
});

test('malformed saved or imported email snapshots are rejected instead of appearing in prompts',async()=>{
  for(const change of [{operation_email:'bad\n@example.test'},{operation_email_role:'personal-inbox-token'},{operation_email:'x'.repeat(255)+'@example.test'}]){
    const f=await fixture();f.start();const saved=JSON.parse(f.values.get(Core.KEY));Object.assign(saved.items[PDL],change);f.values.set(Core.KEY,JSON.stringify(saved));
    assert.throws(()=>f.core.dashboard(),/could not be read/);
    const raw=JSON.stringify({version:1,profile:saved.profile,items:saved.items});f.values.delete(Core.KEY);
    const other=Core.create(f.options);assert.throws(()=>other.importData(raw),/Invalid|valid email/);
  }
});

test('focus requests are reference-only, read-only and preserve every no-replay boundary',async()=>{
  const f=await fixture(),operation=f.start();const before=f.values.get(Core.KEY);
  assert.deepEqual(f.core.focusRequest(PDL,'operation'),{routeId:PDL,operationId:operation.operationId,stage:'operation',authorized:true});
  assert.equal(f.values.get(Core.KEY),before);
  f.contact();f.start('fastpeoplesearch');f.receipt();f.matchingForm();
  const matching=f.core.focusRequest('fastpeoplesearch','continuation'),item=f.core.snapshot().items.fastpeoplesearch;
  assert.deepEqual(matching,{routeId:'fastpeoplesearch',operationId:item.operation_id,stage:'continuation',authorized:true,requestId:item.mail_contact.request_id,receiptRef:item.mail_receipt.receipt_ref});
  const serialized=JSON.stringify(matching);for(const privateValue of ['Example','Person',item.mail_contact.contact_email,'ticketid','confirmation_url',item.mail_contact.capability])assert.equal(serialized.includes(privateValue),false);
  assert.throws(()=>f.core.prepare('fastpeoplesearch'),/already started/);
  assert.throws(()=>f.core.mailContinuationRequest('fastpeoplesearch',{}),/already started/);
});

test('focus rejects missing or changed stages, holds, paused campaigns and unauthenticated matching forms',async()=>{
  const f=await fixture();assert.throws(()=>f.core.focusRequest(PDL,'operation'),/active request/);f.start();
  for(const stage of [undefined,null,'matching','https://example.test'])assert.throws(()=>f.core.focusRequest(PDL,stage),/existing broker step/);
  assert.throws(()=>f.core.focusRequest(PDL,'continuation'),/current authenticated/);
  f.core.holdRoute(PDL);assert.throws(()=>f.core.focusRequest(PDL,'operation'),/on hold/);f.core.resumeRoute(PDL);
  await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});assert.throws(()=>f.core.focusRequest(PDL,'operation'),/active request/);
  const other=await fixture();other.contact();other.start('fastpeoplesearch');other.receipt();assert.throws(()=>other.core.focusRequest('fastpeoplesearch','continuation'),/current authenticated/);
});

test('a missing, changed or imported receipt reference never produces an identity-ready prompt or focus request',async()=>{
  for(const change of ['missing','changed','imported']){
    const f=await fixture();f.contact();f.start('fastpeoplesearch');f.receipt();f.matchingForm();
    const saved=JSON.parse(f.values.get(Core.KEY));
    if(change==='missing')delete saved.items.fastpeoplesearch.mail_receipt.receipt_ref;
    if(change==='changed')saved.items.fastpeoplesearch.mail_receipt.receipt_ref='e'.repeat(64);
    if(change==='imported')saved.items.fastpeoplesearch.continuation.source='imported_user_history';
    f.values.set(Core.KEY,JSON.stringify(saved));
    assert.notEqual(f.cards()[0].kind,'detail_required');assert.notEqual(f.cards()[0].kind,'collect_information');assert.equal(f.cards()[0].action,'review');
    assert.throws(()=>f.core.focusRequest('fastpeoplesearch','continuation'),/current authenticated/);
  }
});
