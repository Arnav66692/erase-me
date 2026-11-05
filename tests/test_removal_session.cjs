'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Session=require('../webapp/static/removal-session.js');
function fixture({held=false,status='held',continuation=true,fields=false,routeId='usphonebook'}={}){
  const calls=[],key='a'.repeat(64);
  const item={site_id:routeId,held,operation_id:'b'.repeat(32),mail_contact:{contact_email:'removal@example.test'}};
  const state={profile:{id:'synthetic-profile'},campaign:{status:'active'},items:[item]};
  const workspace={dashboard:()=>state,mailCheckRequest:async()=>{calls.push('request');return {capability:'scoped',explicit:true};},recordMailReceipt:async()=>calls.push('receipt'),
    mailContinuationRequest:async()=>{calls.push('continuation-request');return {capability:'scoped',explicit:true,receipt_ref:'receipt'};},
    prepareMailContinuation:async()=>{calls.push('reserve');return {routeId,operationId:item.operation_id,authorized:true};},recordMailContinuation:async()=>calls.push('record')};
  const mail={check:async(body,supplied)=>{assert.equal(supplied,key);calls.push('check');return {status,authenticated:status==='held',continuation_available:continuation};},
    continuation:async(body,supplied)=>{assert.equal(supplied,key);calls.push('release');return {confirmation_url:'https://www.usphonebook.com/reviewed-test-url'};}};
  const companion=async payload=>{calls.push(payload.action);return payload.action==='ping'?{routes:[routeId],capabilities:['usphonebook-continuation-v1']}:{status:'prepared'};};
  const session=Session.create({workspace,mail,companion,operatorKey:key,continuationFields:fields?{usphonebook:{city:'Example City',state:'CA',zip_code:'92101'}}:{}});
  return {calls,item,state,workspace,mail,session};
}
test('held routes and paused campaigns never read removal mail',async()=>{
  for(const paused of [false,true]){const f=fixture({held:!paused});if(paused)f.state.campaign.status='paused';await f.session.process({routeId:'usphonebook'});assert.deepEqual(f.calls,[]);}
});
test('pending mail is checked once per active session with no polling or future job',async()=>{
  const f=fixture({status:'pending'});assert.equal((await f.session.process({routeId:'usphonebook'})).status,'awaiting_mail');
  await f.session.process({routeId:'usphonebook'});assert.deepEqual(f.calls,['request','check','receipt']);
});
test('identity-email routes never substitute or access the removal mailbox',async()=>{
  const f=fixture({routeId:'apollo'});assert.equal((await f.session.process({routeId:'apollo'})).status,'not_applicable');assert.deepEqual(f.calls,[]);
});
test('unsupported email destinations stay held after an authenticated receipt',async()=>{
  const f=fixture({routeId:'fastpeoplesearch'});assert.equal((await f.session.process({routeId:'fastpeoplesearch'})).status,'needs_broker_step');assert.deepEqual(f.calls,['request','check','receipt']);
});
test('a reviewed confirmation waits for required fields without releasing its link',async()=>{
  const f=fixture();assert.equal((await f.session.process({routeId:'usphonebook'})).status,'needs_detail');assert.equal(f.calls.includes('release'),false);
});
test('one authorized reviewed continuation journals before navigation and never claims final acceptance',async()=>{
  const f=fixture({fields:true});const result=await f.session.process({routeId:'usphonebook'});
  assert.deepEqual(f.calls,['request','check','receipt','ping','continuation-request','release','reserve','continue','record']);
  assert.equal(result.status,'needs_broker_step');assert.match(result.detail,/identity details/);
  await f.session.process({routeId:'usphonebook'});assert.equal(f.calls.filter(c=>c==='continue').length,1);
});
test('Stop and disposal prevent later release and navigation',async()=>{
  const f=fixture({fields:true});let stopped=false;const original=f.mail.check;f.mail.check=async(...args)=>{const result=await original(...args);stopped=true;return result;};
  const result=await f.session.process({routeId:'usphonebook',isStopped:()=>stopped});assert.equal(result.status,'stopped');assert.equal(f.calls.includes('release'),false);
  f.session.dispose();await f.session.process({routeId:'fastpeoplesearch'});assert.equal(f.calls.filter(c=>c==='check').length,1);
});
test('a hold applied after receipt stops confirmation release',async()=>{
  const f=fixture({fields:true});f.workspace.recordMailReceipt=async()=>{f.calls.push('receipt');f.item.held=true;};
  assert.equal((await f.session.process({routeId:'usphonebook'})).status,'not_started');assert.equal(f.calls.includes('release'),false);
});
test('a missing operator key cannot create a mailbox session',()=>{
  for(const operatorKey of ['',null,'password'])assert.throws(()=>Session.create({operatorKey}),/operator key/);
});

test('reviewed continuation values are copied before asynchronous receipt checks',async()=>{
  const f=fixture({fields:true}),reviewed={usphonebook:{city:'Original City',state:'CA',zip_code:'92101'}};
  let captured;
  f.workspace.mailContinuationRequest=async(route,fields)=>{captured={...fields};return{capability:'scoped',explicit:true,receipt_ref:'receipt'};};
  const session=Session.create({workspace:f.workspace,mail:f.mail,companion:async payload=>payload.action==='ping'?{routes:['usphonebook'],capabilities:['usphonebook-continuation-v1']}:{status:'prepared'},operatorKey:'a'.repeat(64),continuationFields:reviewed});
  reviewed.usphonebook.city='Changed Before Check';
  const original=f.mail.check;f.mail.check=async(...args)=>{reviewed.usphonebook.zip_code='00000';return original(...args);};
  await session.process({routeId:'usphonebook'});
  assert.deepEqual(captured,{city:'Original City',state:'CA',zip_code:'92101'});
});

test('a workspace change during a mailbox await cannot attach a receipt or release a confirmation',async()=>{
  const f=fixture({fields:true}),check=f.mail.check;
  f.mail.check=async(...args)=>{const receipt=await check(...args);f.state.profile.id='another-profile';return receipt;};
  const result=await f.session.process({routeId:'usphonebook'});
  assert.equal(result.status,'unknown');assert.deepEqual(f.calls,['request','check']);
});
