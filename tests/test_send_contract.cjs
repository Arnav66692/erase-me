'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Contract=require('../extension/send-contract.js'),Background=require('../extension/background.js');
const scope={workspace_id:'a'.repeat(32),personal_email_sha256:'b'.repeat(64)};
const statusRequest=()=>({action:'send-status',...scope,authorized:true});
const status=()=>({configured:true,enabled:true,send_enabled:true,provider:'gmail',on_demand:true,access:'local_native',authorization_required:true,automatic_execution:false,routes:Object.keys(Contract.ROUTES),contact_email:'separateremoval@gmail.com'});
const prepare=()=>({action:'send-prepare',...scope,route_id:'ca-411',operation_id:'c'.repeat(32),name:'Example Person',record_reference:'My own public record',authorized:true,own_request:true});
const issued=()=>({status:'ready',route_id:'ca-411',operation_id:'c'.repeat(32),request_id:'d'.repeat(32),capability:'s1.fixture.'+'e'.repeat(43),expires_at:1800000000,message_digest:'f'.repeat(64),preview:{from:'separateremoval@gmail.com',to:'privacy@411.ca',subject:'My own removal request',body:'My own public record\n'},source_url:Contract.ROUTES['ca-411'].source,automatic_execution:false});
test('sender protocol excludes both held pilot routes, support destinations and arbitrary message schemas',()=>{
  for(const route_id of ['usphonebook','fastpeoplesearch','smartbackgroundchecks','addresses','unknown'])assert.throws(()=>Contract.request({...prepare(),route_id}));
  for(const changes of [{own_request:false},{authorized:false},{extra:'field'},{personal_email_sha256:'bad'},{name:'Name\r\nBcc: bad@example.test'}])assert.throws(()=>Contract.request({...prepare(),...changes}));
  assert.throws(()=>Contract.request({action:'send-once',...scope,authorized:true,own_request:true,capability:issued().capability,preview:{...issued().preview,to:'other@example.test'}}));
});
test('exact native previews pin the source, recipient, request reference and attempt-only flags',()=>{
  Contract.response(prepare(),issued());
  for(const changes of [{operation_id:'f'.repeat(32)},{source_url:'https://example.test'},{automatic_execution:true},{extra:'body'},{preview:{...issued().preview,to:'other@example.test'}}])assert.throws(()=>Contract.response(prepare(),{...issued(),...changes}));
  Contract.response(statusRequest(),status());assert.throws(()=>Contract.response(statusRequest(),{...status(),routes:['usphonebook']}));
});
test('provider send outcomes can never establish delivery, broker acceptance or deletion',()=>{
  const request={action:'send-result',...scope,route_id:'ca-411',operation_id:'c'.repeat(32),explicit:true};
  const outcome={status:'provider_accepted',route_id:'ca-411',operation_id:request.operation_id,request_id:'d'.repeat(32),automatic_execution:false,delivery_verified:false,acceptance_verified:false,deletion_verified:false,message_id:'fixture-message',thread_id:'fixture-thread'};
  Contract.response(request,outcome);
  for(const changes of [{delivery_verified:true},{acceptance_verified:true},{deletion_verified:true},{status:'deleted'},{thread_id:'bad\nthread'},{body:'sensitive'}])assert.throws(()=>Contract.response(request,{...outcome,...changes}));
});
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:1}};
test('the companion sends only validated local native messages and requires separate native permission',async()=>{
  const calls=[],chrome={permissions:{async contains(){return true;}},runtime:{async sendNativeMessage(host,request){calls.push({host,request});return{ok:true,result:status()};}}};
  const payload={type:'erase-me',action:'local-send',request:statusRequest()};
  await Background.dispatch(payload,sender,chrome);assert.equal(calls.length,1);assert.equal(calls[0].host,'org.eraseme.mail');
  chrome.permissions.contains=async()=>false;await assert.rejects(Background.dispatch(payload,sender,chrome));assert.equal(calls.length,1);
  await assert.rejects(Background.dispatch(payload,{...sender,url:'https://example.test/'},chrome));
});
test('invalid native replies and provider errors never leak their message into the browser',async()=>{
  const chrome={permissions:{async contains(){return true;}},runtime:{async sendNativeMessage(){return{ok:false,code:'unavailable',error:'synthetic-provider-secret'};}}};
  await assert.rejects(Background.dispatch({type:'erase-me',action:'local-send',request:statusRequest()},sender,chrome),error=>!error.message.includes('synthetic-provider-secret'));
  chrome.runtime.sendNativeMessage=async()=>({ok:true,result:{...status(),refresh_token:'synthetic-provider-secret'}});
  await assert.rejects(Background.dispatch({type:'erase-me',action:'local-send',request:statusRequest()},sender,chrome));
});
