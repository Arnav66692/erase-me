'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../tools/mail_setup_ui.js'),'utf8');
async function fixture({local=true,token='a'.repeat(43),info={},pending=false}={}){
  const nodes=new Map(),requests=[],writes=[];let resolveConnect;
  const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',checked:false,disabled:false,files:[],listeners:{},reportValidity:()=>true,addEventListener(type,fn){this.listeners[type]=fn;}});return nodes.get(id);};
  get('browser').value='chrome';
  const context={document:{getElementById:get},TextEncoder,location:{hash:'#token='+token,protocol:local?'http:':'https:',hostname:local?'127.0.0.1':'remote.example',pathname:'/'},history:{replaceState(...args){writes.push(args);}},fetch:async(path,options)=>{
    requests.push({path,options,body:options.body?JSON.parse(options.body):undefined});
    if(path==='/api/info')return{ok:true,json:async()=>({ok:true,result:{extension_id:'b'.repeat(32),browser:'chrome',...info}})};
    if(path==='/api/close')return{ok:true,json:async()=>({ok:true,result:{closed:true,installation_started:false}})};
    if(pending)await new Promise(resolve=>{resolveConnect=resolve;});
    return{ok:true,json:async()=>({ok:true,result:{installed:true,reused_connection:true,identity_checked:true,messages_read:false,scheduled_work:false}})};
  }};
  vm.runInNewContext(source,context);await new Promise(resolve=>setImmediate(resolve));
  const submit=()=>get('setup-form').listeners.submit({preventDefault(){}});
  const prepare=()=>{get('personal-email').value='person@example.test';get('mailbox').value='separateremoval@gmail.com';get('removal-only').checked=true;};
  return{get,requests,writes,submit,prepare,close:()=>get('close-setup').listeners.click(),release:()=>resolveConnect?.()};
}
test('local setup authenticates once, removes fragment from address bar and does no setup work on load',async()=>{
  const f=await fixture();assert.deepEqual(f.requests.map(x=>x.path),['/api/info']);
  assert.equal(f.requests[0].options.headers['X-Erase-Setup'],'a'.repeat(43));assert.equal(f.requests[0].options.credentials,'omit');
  assert.equal(f.get('extension-id').value,'b'.repeat(32));assert.equal(f.get('setup-fields').disabled,false);
  assert.equal(f.get('removal-only').checked,false);assert.equal(f.writes[0][2],'/');
});
test('remote pages and invalid session links cannot send any request or enable account fields',async()=>{
  for(const options of [{local:false},{token:'bad'}]){
    const f=await fixture(options);assert.deepEqual(f.requests,[]);assert.equal(f.get('setup-fields').disabled,true);
    f.prepare();await f.submit();assert.deepEqual(f.requests,[]);
  }
});
test('setup requires explicit separate-account assertion, sends only the exact local schema and never polls',async()=>{
  const f=await fixture();f.prepare();f.get('removal-only').checked=false;await f.submit();assert.equal(f.requests.length,1);
  f.get('removal-only').checked=true;await f.submit();
  assert.deepEqual(f.requests.map(x=>x.path),['/api/info','/api/connect']);
  assert.deepEqual(f.requests[1].body,{personal_email:'person@example.test',mailbox:'separateremoval@gmail.com',extension_id:'b'.repeat(32),browser:'chrome',client_json:null,removal_only:true,replace_registration:false,reconnect:false,allow_sending:false});
  assert.equal(f.get('setup-fields').disabled,true);assert.match(f.get('setup-result').textContent,/No messages were read/);
});
test('uploaded client is bounded, removed from the input before dispatch and does not enter status text',async()=>{
  const f=await fixture();f.prepare();f.get('client-file').value='fakepath';f.get('client-file').files=[{size:20,text:async()=>'synthetic-client-secret'}];
  await f.submit();assert.equal(f.requests[1].body.client_json,'synthetic-client-secret');assert.equal(f.get('client-file').value,'');
  assert.doesNotMatch(f.get('setup-result').textContent,/synthetic-client-secret/);
  const g=await fixture();g.prepare();g.get('client-file').files=[{size:65537,text:async()=>{throw Error('must not read');}}];await g.submit();assert.equal(g.requests.length,1);assert.match(g.get('setup-result').textContent,/valid Google Desktop/);
});
test('duplicate submits and close during a pending operation never start another connection or publish late success',async()=>{
  const f=await fixture({pending:true});f.prepare();const pending=f.submit();await new Promise(resolve=>setImmediate(resolve));await f.submit();
  await f.close();assert.deepEqual(f.requests.map(x=>x.path),['/api/info','/api/connect','/api/close']);
  f.release();await pending;assert.match(f.get('setup-result').textContent,/Local setup is closed/);assert.equal(f.get('setup-fields').disabled,true);
});
test('changing selected accounts or connection files clears the separate-account approval',async()=>{
  const f=await fixture();f.prepare();f.get('client-file').listeners.change();assert.equal(f.get('removal-only').checked,false);
});
test('requesting optional sending permission is explicit and invalidates the account approval',async()=>{
  const f=await fixture();f.prepare();assert.equal(f.get('allow-sending').checked,false);
  f.get('allow-sending').checked=true;f.get('allow-sending').listeners.change();assert.equal(f.get('removal-only').checked,false);
  f.get('removal-only').checked=true;await f.submit();assert.equal(f.requests[1].body.allow_sending,true);
});
