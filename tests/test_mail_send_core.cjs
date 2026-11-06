'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('../webapp/static/workspace-core.js'),Protocol=require('../extension/send-contract.js');
const ROUTE='ca-411',NOW='2026-11-05T00:00:00.000Z',REFERENCE='https://www.411.ca/record/private-fixture',MAILBOX='removal.fixture@gmail.com';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const canonical=value=>{const[local,domain]=value.toLowerCase().split('@');return local.split('+')[0].replace(/\./g,'')+'@'+(domain==='googlemail.com'?'gmail.com':domain);};
async function fixture(){
  const values=new Map();let sequence=0,fail=false;
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>{if(fail)throw Error('quota');values.set(key,value);},removeItem:key=>values.delete(key)};
  const core=Core.create({storage,crypto:crypto.webcrypto,uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=>NOW});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'primary.fixture@gmail.com',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'CA',city:'Vancouver',region:'BC'})});
  return{core,storage,values,fail:()=>{fail=true;},recover:()=>{fail=false;}};
}
async function begin(f){return f.core.beginMailSendPreview(ROUTE,REFERENCE,{own_request:true,profileId:f.core.profile().id});}
function ready(context){
  const request_id='d'.repeat(32),issued_at=Math.floor(Date.parse(NOW)/1000),expires_at=issued_at+900;
  const preview={from:MAILBOX,to:Protocol.ROUTES[context.routeId].to,subject:'Request to remove or suppress my public record ['+request_id+']',body:'Hello,\n\nMy name: '+context.profileContext.name+'\nRecord reference: '+context.reference+'\n\nRequest reference: '+request_id+'\n'};
  const message_digest=hash(JSON.stringify({body:preview.body,from:preview.from,subject:preview.subject,to:preview.to}));
  const claims={v:1,route_id:context.routeId,operation_id:context.operationId,workspace_id:context.profileId,personal_email_sha256:hash(canonical(context.profileContext.email)),account:hash(canonical(MAILBOX)),request_id,message_digest,issued_at,expires_at};
  return{status:'ready',route_id:context.routeId,operation_id:context.operationId,request_id,capability:'s1.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43),expires_at,message_digest,preview,source_url:Protocol.ROUTES[context.routeId].source,automatic_execution:false};
}
function outcome(context,status='provider_accepted',requestId='d'.repeat(32)){
  return{status,route_id:context.routeId,operation_id:context.operationId,request_id:requestId,automatic_execution:false,delivery_verified:false,acceptance_verified:false,deletion_verified:false,...(status==='provider_accepted'?{message_id:'fixture-message',thread_id:'fixture-thread'}:{})};
}
const approval={authorized:true,own_request:true};

test('preview reservation stores only scoped references and a digest before native preparation',async()=>{
  const f=await fixture(),context=await begin(f),state=f.core.snapshot().items[ROUTE];
  assert.equal(state.operation_id,context.operationId);assert.equal(state.mail_send.phase,'preparing');
  assert.equal(state.mail_send.context_digest,hash(JSON.stringify(context)));assert.equal(Object.isFrozen(context),true);
  assert.equal(f.core.exportData().includes(REFERENCE),false);assert.equal(state.mail_send.capability,undefined);
  await assert.rejects(begin(f));assert.throws(()=>f.core.prepare(ROUTE));
});
test('wrong profile, support contact, country and paused campaign cannot reserve an email',async()=>{
  const f=await fixture();await assert.rejects(f.core.beginMailSendPreview(ROUTE,REFERENCE,{own_request:true,profileId:'f'.repeat(32)}));
  await assert.rejects(f.core.beginMailSendPreview('smartbackgroundchecks',REFERENCE,{own_request:true,profileId:f.core.profile().id}));
  await f.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US'})});await assert.rejects(begin(f));
  await f.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'CA'})});await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});await assert.rejects(begin(f));
  assert.equal(f.core.snapshot().items[ROUTE].operation_id,null);
});
test('native preview binds exact fields and one send reservation without persisting the body or reference',async()=>{
  const f=await fixture(),context=await begin(f),response=ready(context);await f.core.bindMailSendPreview(context,response);
  const stored=f.core.snapshot().items[ROUTE];assert.equal(stored.mail_send.phase,'ready');assert.equal(stored.operation_email,MAILBOX);
  assert.equal(f.core.dashboard().items.find(x=>x.site_id===ROUTE).mail_send.capability,undefined);
  assert.equal(f.core.exportData().includes(REFERENCE),false);assert.equal(f.core.exportData().includes(response.preview.subject),false);
  await assert.rejects(f.core.prepareMailSend(context,response,{...approval,own_request:false}));
  const payload=await f.core.prepareMailSend(context,response,approval);assert.deepEqual(payload.preview,response.preview);
  assert.equal(f.core.snapshot().items[ROUTE].mail_send.phase,'sending');assert.equal(f.core.snapshot().items[ROUTE].mail_send.attempt_started,true);
  await assert.rejects(f.core.prepareMailSend(context,response,approval));assert.throws(()=>f.core.recordCompanion(ROUTE,context.operationId,{status:'submitted',route_verified:true,evidence:'fresh_visible_success'}));
});
test('changed content, scope, primary account or reference cannot bind or authorize a send',async()=>{
  for(const mutate of [r=>{r.preview.to='other@example.test';},r=>{r.preview.body+='Extra disclosure';},r=>{r.message_digest='e'.repeat(64);},r=>{r.operation_id='f'.repeat(32);},r=>{r.preview.from='primary.fixture@gmail.com';}]){
    const f=await fixture(),context=await begin(f),response=ready(context);mutate(response);await assert.rejects(f.core.bindMailSendPreview(context,response));assert.equal(f.core.snapshot().items[ROUTE].mail_send.phase,'preparing');
  }
  const f=await fixture(),context=await begin(f),response=ready(context);await assert.rejects(f.core.bindMailSendPreview({...context,reference:REFERENCE+'-changed'},response));
});
test('holds and an unbound campaign pause close pending drafts irreversibly across resume',async()=>{
  for(const mode of ['hold','pause']){
    const f=await fixture(),context=await begin(f),response=ready(context);
    if(mode==='hold'){f.core.holdRoute(ROUTE);f.core.resumeRoute(ROUTE);}else{await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'resume'})});}
    assert.equal(f.core.snapshot().items[ROUTE].mail_send.closed,true);await assert.rejects(f.core.bindMailSendPreview(context,response));
  }
});
test('cleanup reserves closure before external revocation and stale outcomes cannot reset it',async()=>{
  const f=await fixture(),context=await begin(f),response=ready(context),reservation=await f.core.reserveMailSendClosure(context,response,{discard_issued:true});
  assert.equal(reservation.status,'reserved');assert.equal(f.core.snapshot().items[ROUTE].mail_send.closed,true);
  await assert.rejects(f.core.bindMailSendPreview(context,response));
  f.core.recordMailSendClosure(context,reservation.closureId,outcome(context,'revoked'));
  assert.equal(f.core.snapshot().items[ROUTE].mail_send.revocation_confirmed,true);
  f.core.recordMailSendClosure(context,reservation.closureId,outcome(context,'unknown'));
  assert.equal(f.core.snapshot().items[ROUTE].mail_send.revocation_confirmed,true);
  f.core.resetMailSend(ROUTE,{authorized:true,profileId:context.profileId});assert.equal(f.core.snapshot().items[ROUTE].mail_send,undefined);
  assert.notEqual(f.core.snapshot().items[ROUTE].id,context.operationId);assert.equal(f.core.snapshot().items[ROUTE].operation_id,null);
});
test('a held route still requires its durable cleanup reservation before recording revocation',async()=>{
  const f=await fixture(),context=await begin(f);f.core.holdRoute(ROUTE);
  assert.throws(()=>f.core.recordMailSendClosure(context,undefined,outcome(context,'revoked')));
  assert.equal(f.core.snapshot().items[ROUTE].mail_send.revocation_confirmed,false);
});
test('discarding a duplicate preserves a legitimately bound grant even while paused',async()=>{
  const f=await fixture(),context=await begin(f),response=ready(context);await f.core.bindMailSendPreview(context,response);
  await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});
  assert.deepEqual(await f.core.reserveMailSendClosure(context,response,{discard_issued:true}),{status:'already_bound'});
  assert.equal(f.core.snapshot().items[ROUTE].mail_send.closed,false);assert.equal(f.core.snapshot().items[ROUTE].mail_send.capability,response.capability);
  await assert.rejects(f.core.prepareMailSend(context,response,approval));
});
test('explicit cancellation can close a bound draft, including after reload without its private reference',async()=>{
  const f=await fixture(),context=await begin(f),response=ready(context);await f.core.bindMailSendPreview(context,response);
  const reload=Core.create({storage:f.storage,crypto:crypto.webcrypto,now:()=>NOW}),minimal=reload.mailSendClosureContext(ROUTE,context.profileId);
  assert.equal(Object.hasOwn(minimal,'reference'),false);
  const reserved=await reload.reserveMailSendClosure(minimal,null,{discard_issued:false});assert.equal(reserved.status,'reserved');
  reload.recordMailSendClosure(minimal,reserved.closureId,outcome(context,'revoked'));
  assert.equal(reload.snapshot().items[ROUTE].mail_send.revocation_confirmed,true);
});
test('provider acceptance records no broker acceptance or deletion and late results preserve a hold',async()=>{
  const f=await fixture(),context=await begin(f),response=ready(context);await f.core.bindMailSendPreview(context,response);await f.core.prepareMailSend(context,response,approval);f.core.holdRoute(ROUTE);
  f.core.recordMailSend(context.profileId,context.operationId,outcome(context));const state=f.core.snapshot().items[ROUTE];
  assert.equal(state.held,true);assert.equal(state.mail_send.phase,'provider_accepted');assert.equal(state.evidence.acceptance_verified,false);
  assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);
  assert.equal(f.core.mailSendResultRequest(ROUTE).operation_id,context.operationId);
  assert.throws(()=>f.core.resetMailSend(ROUTE,{authorized:true,profileId:context.profileId}));
});
test('unknown or even ready native outcomes cannot silently repeat an approved attempt',async()=>{
  const f=await fixture(),context=await begin(f),response=ready(context);await f.core.bindMailSendPreview(context,response);await f.core.prepareMailSend(context,response,approval);
  for(const status of ['unknown','ready'])f.core.recordMailSend(context.profileId,context.operationId,outcome(context,status));
  assert.equal(f.core.snapshot().items[ROUTE].mail_send.phase,'unknown');await assert.rejects(f.core.prepareMailSend(context,response,approval));
});
test('storage failure returns no preview/send payload or cleanup reservation',async()=>{
  const f=await fixture();f.fail();await assert.rejects(begin(f));f.recover();assert.equal(f.core.snapshot().items[ROUTE].operation_id,null);
  const context=await begin(f),response=ready(context);f.fail();await assert.rejects(f.core.bindMailSendPreview(context,response));await assert.rejects(f.core.reserveMailSendClosure(context,response,{discard_issued:true}));f.recover();
  await f.core.bindMailSendPreview(context,response);f.fail();await assert.rejects(f.core.prepareMailSend(context,response,approval));f.recover();assert.equal(f.core.snapshot().items[ROUTE].mail_send.attempt_started,false);
});
test('profile replacement permits only original-scope cleanup and never mutates the replacement',async()=>{
  const f=await fixture(),context=await begin(f),response=ready(context);f.core.remove();await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Replacement Person',age:36,email:'replacement@example.test',authorized:true})});
  const before=f.core.exportData();assert.deepEqual(await f.core.reserveMailSendClosure(context,response,{discard_issued:true}),{status:'workspace_replaced'});
  assert.equal(f.core.exportData(),before);await assert.rejects(f.core.bindMailSendPreview(context,response));assert.throws(()=>f.core.recordMailSend(context.profileId,context.operationId,outcome(context)));
});
test('imports retain only inactive held email history and never restore sender trust',async()=>{
  const f=await fixture(),context=await begin(f),response=ready(context);await f.core.bindMailSendPreview(context,response);const backup=f.core.exportData();f.core.remove();f.core.importData(backup);
  const state=f.core.snapshot().items[ROUTE];assert.equal(state.mail_send.source,'imported_user_history');assert.equal(state.mail_send.closed,true);assert.equal(state.held,true);assert.equal(state.mail_send.revocation_confirmed,false);
  assert.throws(()=>f.core.mailSendResultRequest(ROUTE));await assert.rejects(f.core.bindMailSendPreview(context,response));assert.equal(f.core.dashboard().counts.removed,0);
  const malformed=JSON.parse(backup);malformed.items[ROUTE].mail_send.body='must-not-import';f.core.remove();assert.throws(()=>f.core.importData(JSON.stringify(malformed)));
});
test('actual public mutation facade rejects a queued old-profile begin under the origin lock',async()=>{
  const values=new Map(),source=fs.readFileSync(require.resolve('../webapp/static/workspace-core.js'),'utf8');let sequence=0,tail=Promise.resolve(),release;
  const locks={request(_name,_options,action){const pending=tail.then(action);tail=pending.catch(()=>{});return pending;}};
  const context={EraseBrokerRoutes:Core.routes(),EraseSendContract:Protocol,crypto:{subtle:crypto.webcrypto.subtle,randomUUID:()=>(++sequence).toString(16).padStart(32,'0')},TextEncoder,Uint8Array,URL,Date,
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},navigator:{locks}};
  vm.runInNewContext(source,context);const api=context.EraseWorkspace;
  await api.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'primary.fixture@gmail.com',authorized:true})});await api.api('/api/profile',{method:'POST',body:JSON.stringify({country:'CA'})});
  const old=api.profile().id;tail=new Promise(done=>{release=done;});
  const remove=api.remove(),replace=api.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Replacement Person',age:36,email:'other@example.test',authorized:true})}),beginOld=api.beginMailSendPreview(ROUTE,REFERENCE,{own_request:true,profileId:old});
  release();await remove;await replace;await assert.rejects(beginOld);assert.equal(api.profile().name,'Replacement Person');assert.equal(api.snapshot().items[ROUTE].mail_send,undefined);assert.equal(api.snapshot().items[ROUTE].operation_id,null);
});
