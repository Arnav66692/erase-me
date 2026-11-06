'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto,createHash}=require('node:crypto');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Core=require('../webapp/static/workspace-core.js');
const Local=require('../webapp/static/local-removal-mail.js');
const Relay=require('../webapp/static/removal-mail-client.js');
const issued=1793836800,requestId='b'.repeat(32),receiptRef='c'.repeat(64);
const clone=value=>JSON.parse(JSON.stringify(value));
function sessionResult(request){
  const email='removalonly+erase-'+requestId+'@gmail.com',expires_at=issued+7*86400;
  const claims={v:1,request_id:requestId,route_id:request.route_id,operation_id:request.operation_id,recipient:email,issued_at:issued,expires_at};
  return{status:'ready',capability:Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43),request_id:requestId,route_id:request.route_id,operation_id:request.operation_id,contact_email:email,expires_at,automatic_execution:false};
}
async function fixture(){
  const values=new Map();let sequence=0;
  const core=Core.create({storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=> '2026-11-05T00:00:00.000Z'});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'primary@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',region:'CA',city:'Example City'})});
  core.holdRoute('usphonebook');core.setEvidence('fastpeoplesearch',{first_name:'Example',last_name:'Person'});
  const requests=[],statuses={configured:true,enabled:true,provider:'gmail',on_demand:true,access:'local_native',authorization_required:true,automatic_execution:false,routes:['fastpeoplesearch','usphonebook','searchpeoplefree'],contact_email:'removalonly@gmail.com'};
  let behavior;
  const companion=async({action,request})=>{
    assert.equal(action,'local-mail');requests.push(clone(request));if(behavior)return behavior(request);
    if(request.action==='status')return clone(statuses);
    if(request.action==='session')return sessionResult(request);
    const contact=Object.values(core.snapshot().items).find(item=>item.mail_contact?.capability===request.capability)?.mail_contact;
    const base={route_id:contact.route_id,operation_id:contact.operation_id,request_id:contact.request_id,automatic_execution:false};
    if(request.action==='check')return{status:'held',...base,reason:'route_validation_required',received_at:issued+1,authenticated:true,receipt_ref:receiptRef,continuation_available:contact.route_id==='fastpeoplesearch'};
    if(request.action==='continue')return{status:'confirmation_ready',...base,receipt_ref:receiptRef,confirmation_url:'https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email:contact.contact_email,ticketid:'12345678'})};
    if(request.action==='revoke')return{status:'revoked',...base};
    throw new Error('Unexpected native action.');
  };
  const client=Local.create({workspace:core,companion,crypto:webcrypto});
  async function bind(route='fastpeoplesearch'){
    const body=core.mailSessionRequest(route,'local_native');const response=await client.session(body);core.bindMailContact(route,response);return response;
  }
  return{core,client,values,requests,statuses,bind,setBehavior:value=>{behavior=value;}};
}
test('canonical primary fingerprints match private setup and never send a primary address',async()=>{
  for(const [value,expected]of [['F.irst+alias@GoogleMail.com','first@gmail.com'],['User+tag@Example.test','user@example.test'],['primary@example.test','primary@example.test']]){
    assert.equal(Local.canonicalEmail(value),expected);
    assert.equal(await Local.primaryDigest(value,webcrypto),createHash('sha256').update(expected).digest('hex'));
  }
  for(const value of [' primary@example.test','x@-example.test','x@exam_ple.test','x@a..test','ü@example.test','+tag@gmail.com'])assert.throws(()=>Local.canonicalEmail(value));
  const f=await fixture();assert.equal(f.requests.length,0);await f.client.status();
  assert.equal(f.requests.length,1);assert.equal(JSON.stringify(f.requests).includes('primary@example.test'),false);
  assert.deepEqual(Object.keys(f.requests[0]).sort(),['action','authorized','personal_email_sha256','workspace_id'].sort());
  assert.equal(f.requests[0].workspace_id,f.core.profile().id);assert.equal(f.requests[0].authorized,true);
});
test('only a separately verified native status is accepted, and status never creates a mail operation',async()=>{
  const f=await fixture();await f.client.status();assert.equal(f.core.snapshot().items.fastpeoplesearch.mail_contact,undefined);
  f.statuses.contact_email='primary@example.test';await assert.rejects(()=>f.client.status(),/separate removal-only/);
  f.statuses.contact_email='removalonly@gmail.com';f.statuses.raw_mail='forbidden';await assert.rejects(()=>f.client.status(),/separate removal-only/);
});
test('local contacts keep a workspace transport binding and cannot enter hosted relay calls',async()=>{
  const f=await fixture(),contact=await f.bind();
  assert.equal(contact.transport,'local_native');assert.equal(contact.workspace_id,f.core.profile().id);
  const saved=f.core.snapshot().items.fastpeoplesearch.mail_contact;assert.equal(saved.transport,'local_native');
  const operation=f.core.prepare('fastpeoplesearch');f.core.recordCompanion('fastpeoplesearch',operation.operationId,{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'});
  assert.throws(()=>f.core.mailCheckRequest('fastpeoplesearch'),/original active removal-mail transport/);
  const body=f.core.mailCheckRequest('fastpeoplesearch','local_native'),receipt=await f.client.check(body);
  assert.throws(()=>f.core.recordMailReceipt('fastpeoplesearch',receipt),/original active removal-mail transport/);
  f.core.recordMailReceipt('fastpeoplesearch',receipt,'local_native');
  assert.equal(f.core.snapshot().items.fastpeoplesearch.mail_receipt.authenticated,true);
  const backup=f.core.exportData();assert.ok(backup.includes('local_native'));assert.doesNotMatch(backup,/refresh_token|client_secret|personal_email_sha256/);
  assert.equal(f.core.dashboard().counts.removed,0);
});
test('SearchPeopleFree permits a local user-owned contact while hosted alias issuance remains blocked',async()=>{
  const f=await fixture();assert.throws(()=>f.core.mailSessionRequest('searchpeoplefree'),/email you own/);
  const local=await f.bind('searchpeoplefree');assert.equal(local.route_id,'searchpeoplefree');
  assert.equal(f.core.snapshot().items.searchpeoplefree.mail_contact.transport,'local_native');
  let fetches=0;const hosted=Relay.create({location:{origin:'https://erase-me-preview.vercel.app'},fetch:async()=>{fetches++;throw new Error('Should not fetch.');}});
  await assert.rejects(()=>hosted.session({route_id:'searchpeoplefree',operation_id:'a'.repeat(32),authorized:true},'f'.repeat(64)));
  assert.equal(fetches,0);
});
test('a user-owned SearchPeopleFree contact reaches the real reviewed preparation path with only its approved alias',async()=>{
  for(const method of ['prepare','prepareReviewed']){
    const f=await fixture(),contact=await f.bind('searchpeoplefree');
    f.core.setEvidence('searchpeoplefree',{first_name:'Example',last_name:'Person'});
    const preview=f.core.fillPreview('searchpeoplefree');
    assert.deepEqual(preview.fields,{first_name:'Example',last_name:'Person',email:contact.contact_email});
    const operation=method==='prepare'?f.core.prepare('searchpeoplefree'):f.core.prepareReviewed(preview);
    assert.deepEqual(operation.fields,preview.fields);assert.equal(operation.authorized,true);
    assert.equal(f.core.snapshot().items.searchpeoplefree.operation_email,contact.contact_email);
  }
  for(const failure of ['held','revoked','imported']){
    const f=await fixture();await f.bind('searchpeoplefree');f.core.setEvidence('searchpeoplefree',{first_name:'Example',last_name:'Person'});
    if(failure==='imported'){const backup=f.core.exportData();f.core.remove();f.core.importData(backup);}
    else{f.core.holdRoute('searchpeoplefree');if(failure==='revoked')f.core.resumeRoute('searchpeoplefree');}
    assert.throws(()=>f.core.fillPreview('searchpeoplefree'),/hold|revoked|own request|broker fields/i,failure);
    assert.equal(f.core.snapshot().items.searchpeoplefree.operation_id,null,failure);
  }
});
test('wrong transport and unapproved requests are rejected before native reads',async()=>{
  const f=await fixture();
  await assert.rejects(()=>f.client.session({route_id:'fastpeoplesearch',operation_id:'f'.repeat(32),authorized:true}));assert.equal(f.requests.length,0);
  const request=f.core.mailSessionRequest('fastpeoplesearch');
  await assert.rejects(()=>f.client.session(request),/Review this active/);assert.equal(f.requests.length,0);
  await assert.rejects(()=>f.client.check({capability:'e30.'+'a'.repeat(43),explicit:true}),/no active local/);assert.equal(f.requests.length,0);
});
test('profile drift during native awaits cannot bind contacts or disclose a later request',async()=>{
  const f=await fixture();let release;
  const pending=new Promise(done=>{release=done;});f.setBehavior(()=>pending);
  const checking=f.client.status();await new Promise(resolve=>setImmediate(resolve));
  await f.core.api('/api/profile',{method:'POST',body:JSON.stringify({city:'Changed City'})});release(clone(f.statuses));
  await assert.rejects(()=>checking,/workspace changed/);
  const count=f.requests.length;await assert.rejects(()=>f.client.status(),/workspace changed/);assert.equal(f.requests.length,count);
});
test('holds durably revoke local grants and resuming cannot revive mailbox access',async()=>{
  const f=await fixture(),contact=await f.bind();
  f.core.holdRoute('fastpeoplesearch');assert.equal(f.core.snapshot().items.fastpeoplesearch.mail_contact.revoked,true);
  const outcome=await f.client.revoke({capability:contact.capability,explicit:true});assert.equal(outcome.status,'revoked');
  f.core.resumeRoute('fastpeoplesearch');assert.throws(()=>f.core.prepare('fastpeoplesearch'),/revoked/);
  const count=f.requests.length;await assert.rejects(()=>f.client.check({capability:contact.capability,explicit:true}),/no active local/);assert.equal(f.requests.length,count);
  assert.equal(f.core.snapshot().items.usphonebook.held,true);
});
test('local continuation uses the same approved one-shot core boundary without hosted mail or raw URL persistence',async()=>{
  const f=await fixture();await f.bind();const op=f.core.prepare('fastpeoplesearch');f.core.recordCompanion('fastpeoplesearch',op.operationId,{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'});
  const receipt=await f.client.check(f.core.mailCheckRequest('fastpeoplesearch','local_native'));f.core.recordMailReceipt('fastpeoplesearch',receipt,'local_native');
  assert.throws(()=>f.core.mailContinuationRequest('fastpeoplesearch',{}),/original active/);
  const request=f.core.mailContinuationRequest('fastpeoplesearch',{},'local_native'),response=await f.client.continuation(request);
  assert.throws(()=>f.core.prepareMailContinuation('fastpeoplesearch',response,{}),/original active/);
  const operation=f.core.prepareMailContinuation('fastpeoplesearch',response,{},'local_native');assert.match(operation.confirmationUrl,/\/optout\/removal/);
  assert.equal(f.core.exportData().includes('ticketid='),false);assert.throws(()=>f.core.mailContinuationRequest('fastpeoplesearch',{},'local_native'),/already started/);
  assert.equal(f.core.dashboard().counts.removed,0);
});
test('backup restoration retains native references as inactive history and never adopts another workspace grant',async()=>{
  const f=await fixture(),contact=await f.bind();
  const operation=f.core.prepare('fastpeoplesearch');f.core.recordCompanion('fastpeoplesearch',operation.operationId,{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'});
  const restoredValues=new Map();
  const restored=Core.create({storage:{getItem:key=>restoredValues.get(key)||null,setItem:(key,value)=>restoredValues.set(key,value),removeItem:key=>restoredValues.delete(key)},uuid:()=> 'e'.repeat(32),now:()=> '2026-11-05T00:00:00.000Z'});
  restored.importData(f.core.exportData());
  const saved=restored.snapshot().items.fastpeoplesearch.mail_contact;
  assert.equal(saved.capability,contact.capability);assert.equal(saved.workspace_id,f.core.profile().id);assert.equal(saved.revoked,true);assert.notEqual(saved.workspace_id,restored.profile().id);
  assert.throws(()=>restored.mailCheckRequest('fastpeoplesearch','local_native'),/original active/);
  const client=Local.create({workspace:restored,companion:async()=>{throw new Error('Must not call native host.');},crypto:webcrypto});
  await assert.rejects(()=>client.check({capability:saved.capability,explicit:true}),/no active local/);
  assert.equal(restored.dashboard().counts.removed,0);
});
test('native issuance finishing after hold, pause or profile drift revokes its unused grant under the original scope',async()=>{
  for(const drift of ['hold','pause','location','replacement']){
    const f=await fixture(),profile=f.core.profile(),body=f.core.mailSessionRequest('fastpeoplesearch','local_native'),response=sessionResult(body);
    let resolve,started;const waiting=new Promise(done=>{resolve=done;}),issuedCall=new Promise(done=>{started=done;});
    f.setBehavior(request=>{
      if(request.action==='session'){started();return waiting;}
      assert.equal(request.action,'revoke');assert.equal(request.workspace_id,profile.id);assert.equal(request.personal_email_sha256,createHash('sha256').update('primary@example.test').digest('hex'));
      assert.equal(request.capability,response.capability);
      return{status:'revoked',route_id:body.route_id,operation_id:body.operation_id,request_id:response.request_id,automatic_execution:false};
    });
    const pending=f.client.session(body);await issuedCall;
    if(drift==='hold')f.core.holdRoute('fastpeoplesearch');
    else if(drift==='pause')await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});
    else if(drift==='location')await f.core.api('/api/profile',{method:'POST',body:JSON.stringify({city:'Another City'})});
    else{f.core.remove();await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Other Person',age:42,email:'other@example.test',authorized:true})});await f.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US'})});}
    resolve(response);await assert.rejects(()=>pending,/unused local grant was revoked/);
    assert.deepEqual(f.requests.map(request=>request.action),['session','revoke'],drift);
    const item=f.core.snapshot().items.fastpeoplesearch;assert.equal(item.mail_contact,undefined,drift);
    if(drift==='replacement'){assert.notEqual(f.core.profile().id,profile.id);assert.notEqual(item.held,true);assert.equal(item.local_mail_setup_closed,undefined);}
    else{assert.equal(item.held,true,drift);assert.equal(item.local_mail_setup_closed,true,drift);assert.equal(item.local_mail_setup_revocation_confirmed,true,drift);}
  }
});
test('an unconfirmed late-issuance cleanup stays held and cannot mint or recover an alias through a new session',async()=>{
  const f=await fixture(),body=f.core.mailSessionRequest('fastpeoplesearch','local_native'),response=sessionResult(body);
  let resolve,started;const waiting=new Promise(done=>{resolve=done;}),issuedCall=new Promise(done=>{started=done;});
  f.setBehavior(request=>{if(request.action==='session'){started();return waiting;}throw new Error('Unavailable native connector');});
  const pending=f.client.session(body);await issuedCall;f.core.holdRoute('fastpeoplesearch');resolve(response);
  await assert.rejects(()=>pending,/revocation could not be confirmed/);
  const item=f.core.snapshot().items.fastpeoplesearch;assert.equal(item.held,true);assert.equal(item.local_mail_setup_closed,true);assert.equal(item.local_mail_setup_revocation_confirmed,false);
  f.core.resumeRoute('fastpeoplesearch');assert.throws(()=>f.core.mailSessionRequest('fastpeoplesearch','local_native'),/setup is closed/);
  const before=f.requests.length;await assert.rejects(()=>f.client.session(body));assert.equal(f.requests.length,before);
});
test('a duplicate late issuance never revokes a contact already bound by another approved action',async()=>{
  for(const paused of [false,true]){
    const f=await fixture(),body=f.core.mailSessionRequest('fastpeoplesearch','local_native'),response=sessionResult(body);
    let resolve,started;const waiting=new Promise(done=>{resolve=done;}),issuedCall=new Promise(done=>{started=done;});
    f.setBehavior(request=>{assert.equal(request.action,'session');started();return waiting;});
    const pending=f.client.session(body);await issuedCall;
    f.core.bindMailContact('fastpeoplesearch',{...response,transport:'local_native',workspace_id:f.core.profile().id});f.core.prepare('fastpeoplesearch');
    if(paused)await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});
    resolve(response);await assert.rejects(()=>pending,/already bound/);assert.deepEqual(f.requests.map(request=>request.action),['session']);
    assert.notEqual(f.core.snapshot().items.fastpeoplesearch.mail_contact.revoked,true);assert.notEqual(f.core.snapshot().items.fastpeoplesearch.held,true);assert.equal(f.core.snapshot().items.fastpeoplesearch.local_mail_setup_closed,undefined);
  }
});
test('discarding a failed binding validates original scope and preserves a contact another controller already bound',async()=>{
  const f=await fixture(),body=f.core.mailSessionRequest('fastpeoplesearch','local_native'),response=await f.client.session(body);
  const count=f.requests.length;
  for(const[request,value]of [[{...body,route_id:'searchpeoplefree'},response],[body,{...response,workspace_id:'e'.repeat(32)}],[body,{...response,request_id:'f'.repeat(32)}],[body,{...response,capability:'e30.'+'a'.repeat(43)}]])await assert.rejects(()=>f.client.discardIssuedContact(request,value));
  assert.equal(f.requests.length,count);
  f.core.bindMailContact('fastpeoplesearch',response);f.core.prepare('fastpeoplesearch');await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});
  assert.deepEqual(await f.client.discardIssuedContact(body,response),{status:'already_bound'});assert.equal(f.requests.length,count);
  assert.notEqual(f.core.snapshot().items.fastpeoplesearch.mail_contact.revoked,true);assert.notEqual(f.core.snapshot().items.fastpeoplesearch.held,true);
});
test('cleanup reserves a durable tombstone before native revocation and resume cannot bind the in-flight grant',async()=>{
  const f=await fixture(),body=f.core.mailSessionRequest('fastpeoplesearch','local_native'),response=await f.client.session(body);
  let finish,started;const nativeStarted=new Promise(done=>{started=done;}),revocation=new Promise(done=>{finish=done;});
  f.setBehavior(request=>{assert.equal(request.action,'revoke');const row=f.core.snapshot().items.fastpeoplesearch;assert.equal(row.local_mail_setup_closed,true);assert.equal(row.local_mail_setup_cleanup_pending,true);assert.equal(row.held,true);started();return revocation;});
  f.core.holdRoute('fastpeoplesearch');const pending=f.client.discardIssuedContact(body,response);await nativeStarted;
  f.core.resumeRoute('fastpeoplesearch');assert.throws(()=>f.core.bindMailContact('fastpeoplesearch',response),/setup is closed/);
  for(const transport of ['local_native','private_pilot'])assert.throws(()=>f.core.mailSessionRequest('fastpeoplesearch',transport),/setup is closed/);
  const other=Local.create({workspace:f.core,crypto:webcrypto,companion:async()=>{throw new Error('No second native request is allowed.');}});await assert.rejects(()=>other.session(body),/Review this active/);
  assert.equal(f.core.snapshot().items.fastpeoplesearch.mail_contact,undefined);assert.equal(f.core.snapshot().items.fastpeoplesearch.operation_id,null);
  finish({status:'revoked',route_id:body.route_id,operation_id:body.operation_id,request_id:response.request_id,automatic_execution:false});
  assert.deepEqual(await pending,{status:'revoked'});const item=f.core.snapshot().items.fastpeoplesearch;assert.equal(item.local_mail_setup_closed,true);assert.equal(item.local_mail_setup_cleanup_pending,false);assert.equal(item.local_mail_setup_revocation_confirmed,true);
  assert.deepEqual(f.requests.map(request=>request.action),['session','revoke']);
});
test('a failed cleanup reservation never revokes outward and closes this client for manual review',async()=>{
  const f=await fixture(),body=f.core.mailSessionRequest('fastpeoplesearch','local_native'),response=await f.client.session(body);
  const setter=f.values.set;f.values.set=()=>{throw new Error('quota');};
  f.setBehavior(()=>{throw new Error('Unsafe revoke must not be dispatched.');});
  assert.deepEqual(await f.client.discardIssuedContact(body,response),{status:'revocation_unconfirmed'});assert.deepEqual(f.requests.map(request=>request.action),['session']);
  f.values.set=setter;assert.equal(f.core.snapshot().items.fastpeoplesearch.local_mail_setup_closed,undefined);
  await assert.rejects(()=>f.client.session(body),/closed for manual/);assert.deepEqual(f.requests.map(request=>request.action),['session']);
});
test('the atomic cleanup reservation preserves an exact grant bound while its lock request waits, even when paused',async()=>{
  const f=await fixture();let release,entered;const waiting=new Promise(done=>{release=done;}),reached=new Promise(done=>{entered=done;});
  const workspace={...f.core,reserveLocalMailSetupClosure:async(...args)=>{entered();await waiting;return f.core.reserveLocalMailSetupClosure(...args);}};
  const responseFor={};let nativeCalls=0;
  const client=Local.create({workspace,crypto:webcrypto,companion:async({request})=>{nativeCalls++;assert.equal(request.action,'session');const result=sessionResult(request);Object.assign(responseFor,result);return result;}});
  const body=f.core.mailSessionRequest('fastpeoplesearch','local_native'),response=await client.session(body),pending=client.discardIssuedContact(body,response);await reached;
  f.core.bindMailContact('fastpeoplesearch',response);f.core.prepare('fastpeoplesearch');await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});release();
  assert.deepEqual(await pending,{status:'already_bound'});assert.equal(nativeCalls,1);const item=f.core.snapshot().items.fastpeoplesearch;assert.notEqual(item.mail_contact.revoked,true);assert.notEqual(item.held,true);assert.equal(item.local_mail_setup_closed,undefined);
});
test('storage and replacement-profile binding failures revoke the issued grant without changing another workspace',async()=>{
  for(const failure of ['storage','replacement','unknown_cleanup']){
    const f=await fixture(),oldProfile=f.core.profile(),body=f.core.mailSessionRequest('fastpeoplesearch','local_native'),response=await f.client.session(body);
    const grant={revoked:false};
    f.setBehavior(request=>{assert.equal(request.action,'revoke');assert.equal(request.workspace_id,oldProfile.id);assert.equal(request.capability,response.capability);if(failure==='unknown_cleanup')throw new Error('Unavailable');grant.revoked=true;return{status:'revoked',route_id:body.route_id,operation_id:body.operation_id,request_id:response.request_id,automatic_execution:false};});
    if(failure==='storage'){
      const set=f.values.set;let first=true;f.values.set=function(key,value){if(first){first=false;throw new Error('quota');}return set.call(this,key,value);};
    }else if(failure==='replacement'){
      f.core.remove();await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Other Person',age:42,email:'other@example.test',authorized:true})});await f.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US'})});
    }else f.core.holdRoute('fastpeoplesearch');
    assert.throws(()=>f.core.bindMailContact('fastpeoplesearch',response));
    const result=await f.client.discardIssuedContact(body,response);
    assert.equal(result.status,failure==='unknown_cleanup'?'revocation_unconfirmed':'revoked');assert.equal(grant.revoked,failure!=='unknown_cleanup');
    const item=f.core.snapshot().items.fastpeoplesearch;assert.equal(item.mail_contact,undefined);
    if(failure==='replacement'){assert.notEqual(f.core.profile().id,oldProfile.id);assert.notEqual(item.held,true);assert.equal(item.local_mail_setup_closed,undefined);}
    else{assert.equal(item.held,true);assert.equal(item.local_mail_setup_closed,true);f.core.resumeRoute('fastpeoplesearch');assert.throws(()=>f.core.mailSessionRequest('fastpeoplesearch','local_native'),/closed/);}
    const calls=f.requests.length;await assert.rejects(()=>f.client.session(body));assert.equal(f.requests.length,calls);
  }
});
test('a queued browser-core hold committing before binding discards the otherwise-ready native grant',async()=>{
  const values=new Map();let sequence=0,tail=Promise.resolve();
  const locks={request:(_name,_options,callback)=>{const previous=tail;let release;tail=new Promise(done=>{release=done;});return previous.then(async()=>{try{return await callback();}finally{release();}});}};
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-11-05T00:00:00.000Z']));}static now(){return issued*1000;}}
  const context={navigator:{locks},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},crypto:{randomUUID:()=>(++sequence).toString(16).padStart(32,'0')},Date:FixedDate,URL,EraseBrokerRoutes:require('../webapp/static/broker-routes.js'),EraseIdentityDetails:require('../extension/identity-details.js'),EraseFootprintPlanner:require('../webapp/static/footprint-planner.js')};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../webapp/static/workspace-core.js'),'utf8'),context);
  const core=context.EraseWorkspace;
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'primary@example.test',authorized:true})});await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US'})});
  await core.setEvidence('searchpeoplefree',{first_name:'Example',last_name:'Person'});
  const body=await core.mailSessionRequest('searchpeoplefree','local_native'),response=sessionResult(body),requests=[],grant={revoked:false};
  let nativeStarted,resolveNative;const started=new Promise(done=>{nativeStarted=done;}),nativeReply=new Promise(done=>{resolveNative=done;});
  const client=Local.create({workspace:core,crypto:webcrypto,companion:async({request})=>{requests.push(clone(request));if(request.action==='session'){nativeStarted();return nativeReply;}assert.equal(request.action,'revoke');grant.revoked=true;return{status:'revoked',route_id:body.route_id,operation_id:body.operation_id,request_id:response.request_id,automatic_execution:false};}});
  const issuing=client.session(body);await started;
  let unlock,entered;const lockEntered=new Promise(done=>{entered=done;}),lockHeld=new Promise(done=>{unlock=done;});
  const heldLock=locks.request(Core.KEY+'-write',{mode:'exclusive'},async()=>{entered();await lockHeld;});await lockEntered;
  const holding=core.holdRoute('searchpeoplefree');resolveNative(response);const ready=await issuing;
  assert.equal(ready.status,'ready');assert.notEqual(core.snapshot().items.searchpeoplefree.held,true);
  const binding=core.bindMailContact('searchpeoplefree',ready).then(()=>null,error=>error);
  unlock();await heldLock;await holding;const bindError=await binding;assert.ok(bindError);assert.match(bindError.message,/hold/);
  const cleanup=await client.discardIssuedContact(body,ready);assert.equal(cleanup.status,'revoked');assert.equal(grant.revoked,true);
  const item=core.snapshot().items.searchpeoplefree;assert.equal(item.held,true);assert.equal(item.mail_contact,undefined);assert.equal(item.local_mail_setup_closed,true);
  assert.deepEqual(requests.map(request=>request.action),['session','revoke']);
  await core.resumeRoute('searchpeoplefree');await assert.rejects(()=>core.mailSessionRequest('searchpeoplefree','local_native'),/closed/);
});
