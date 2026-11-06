'use strict';
const{test}=require('node:test');const assert=require('node:assert/strict');
const Background=require('../extension/background.js');
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:7}};
const base={workspace_id:'a'.repeat(32),personal_email_sha256:'b'.repeat(64)};
const status={configured:true,enabled:true,provider:'gmail',on_demand:true,access:'local_native',authorization_required:true,automatic_execution:false,routes:['fastpeoplesearch','usphonebook','searchpeoplefree'],contact_email:'removalonly@gmail.com'};
const message=request=>({type:'erase-me',action:'local-mail',request});
function fixture(reply={ok:true,result:status},permission=true){const calls=[];const api={permissions:{contains:async()=>permission},runtime:{sendNativeMessage:async(host,body)=>{calls.push({host,body});return reply;}}};return{api,calls};}
test('native mailbox bridge accepts only the trusted workspace and fixed host with exact explicit schemas',async()=>{
  const f=fixture(),request={action:'status',...base,authorized:true};
  assert.deepEqual(await Background.dispatch(message(request),sender,f.api),status);assert.equal(f.calls[0].host,'org.eraseme.mail');assert.deepEqual(f.calls[0].body,request);
  for(const malformed of [{...request,host:'attacker.test'},{...request,authorized:false},{...request,workspace_id:'other'},{...request,personal_email_sha256:'no'}, {...request,personal_email_sha256:[base.personal_email_sha256]}, {...request,action:['status']}, {...request,action:'send'}])await assert.rejects(()=>Background.dispatch(message(malformed),sender,f.api));
  await assert.rejects(()=>Background.dispatch(message(request),{url:'https://other.test/',tab:{id:8}},f.api));assert.equal(f.calls.length,1);
});
test('permission, provider failures and unsolicited native response fields disclose no message or credentials',async()=>{
  const request={action:'status',...base,authorized:true};
  const denied=fixture(undefined,false);await assert.rejects(()=>Background.dispatch(message(request),sender,denied.api),/Enable local connector/);assert.equal(denied.calls.length,0);
  for(const reply of [{ok:false,error:'secret refresh token must never echo',code:'bad'}, {ok:true,result:{...status,refresh_token:'private'}},{ok:true,result:status,raw_mail:'private'}, {ok:true,result:{...status,contact_email:'outside@attacker.test'}}]){
    const f=fixture(reply);await assert.rejects(()=>Background.dispatch(message(request),sender,f.api),error=>!/secret refresh|raw_mail|outside@/.test(error.message));
  }
});
test('local continuation rejects arbitrary links and SearchPeopleFree remains held-only',async()=>{
  const capability='e30.'+'c'.repeat(43),receipt_ref='d'.repeat(64),request={action:'continue',...base,capability,receipt_ref,explicit:true};
  for(const route_id of ['fastpeoplesearch','searchpeoplefree']){
    const f=fixture({ok:true,result:{status:'confirmation_ready',route_id,operation_id:'f'.repeat(32),request_id:'e'.repeat(32),receipt_ref,confirmation_url:'https://attacker.test/reset',automatic_execution:false}});
    await assert.rejects(()=>Background.dispatch(message(request),sender,f.api),/confirmation could not/);
  }
  const checking={action:'check',...base,capability,explicit:true};
  const f=fixture({ok:true,result:{status:'held',route_id:'searchpeoplefree',operation_id:'f'.repeat(32),request_id:'e'.repeat(32),reason:'route_validation_required',received_at:1793836800,authenticated:true,receipt_ref,continuation_available:true,automatic_execution:false}});
  await assert.rejects(()=>Background.dispatch(message(checking),sender,f.api),/receipt could not/);
});
