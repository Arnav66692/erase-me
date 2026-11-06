'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Details=require('../extension/peoplefinders-details.js'),Core=require('../webapp/static/workspace-core.js'),Background=require('../extension/background.js');
const now='2026-11-05T00:00:00.000Z',privateFields=()=> ({first_name:'Example',last_name:'Person',street:'123 Example Street',city:'Example City',state:'CA'});
const payload=()=>({routeId:Details.ROUTE,operationId:'a'.repeat(32),authorized:true,ownRequestConfirmed:true,consentId:Details.CONTRACT.id,identity:{full_name:'Example Person'},details:privateFields()});
async function coreFixture(){
  const storage=new Map();let counter=0,failed=false;
  const core=Core.create({storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(failed)throw Error();storage.set(key,value);},removeItem:key=>storage.delete(key)},uuid:()=>(++counter).toString(16).padStart(32,'0'),now:()=>now});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'person@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',city:'Example City'})});
  return{core,storage,fail:()=>{failed=true;}};
}
const approve={authorized:true,consentId:Details.CONTRACT.id};
test('exact private matching fields validate without accepting unknown data or silent edits',()=>{
  Details.validateDetails(privateFields(),{fullName:'Example Person'});
  for(const value of [{...privateFields(),first_name:'Other'},{...privateFields(),street:''},{...privateFields(),state:'XX'},{...privateFields(),first_name:'Example.'},{...privateFields(),phone:'555'}])assert.throws(()=>Details.validateDetails(value,{fullName:'Example Person'}));
});
test('payload requires exact own-information approval and canonical fields',()=>{
  Details.validatePayload(payload(),{now});
  for(const change of [{routeId:'usphonebook'},{authorized:false},{ownRequestConfirmed:false},{consentId:'other'},{confirmationUrl:'https://example.test'},{details:{...privateFields(),street:' 123 Example Street '}}])assert.throws(()=>Details.validatePayload({...payload(),...change},{now}));
});
test('core reserves before disclosure with no sensitive fields in storage, export, history or result',async()=>{
  const f=await coreFixture(),preview=f.core.peopleFindersPreview(),operation=f.core.preparePeopleFinders(preview,privateFields(),approve);
  assert.equal(operation.details.street,'123 Example Street');assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,operation.operationId);
  for(const value of ['123 Example Street'])assert.equal(f.core.exportData().includes(value),false);
  f.core.recordPeopleFinders(preview.profileId,operation.operationId,{status:'prepared',detail:'123 Example Street'});
  assert.equal(f.core.exportData().includes('123 Example Street'),false);assert.equal(f.core.dashboard().counts.removed,0);
  assert.throws(()=>f.core.preparePeopleFinders(preview,privateFields(),approve));
});
test('generic prepare, batch preview and generic field storage cannot consume transient route',async()=>{
  const f=await coreFixture();assert.equal(f.core.routes().find(r=>r.id===Details.ROUTE).automationLevel,'manual');
  assert.throws(()=>f.core.prepare(Details.ROUTE));assert.throws(()=>f.core.fillPreview(Details.ROUTE));assert.throws(()=>f.core.setEvidence(Details.ROUTE,{street:'123 Example Street'}));
  assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,null);
});
test('hold, pause, country and profile changes invalidate old review before reservation',async()=>{
  for(const mutate of [f=>f.core.holdRoute(Details.ROUTE),f=>f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})}),f=>f.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'GB'})}),f=>f.core.remove()]){
    const f=await coreFixture(),preview=f.core.peopleFindersPreview();await mutate(f);assert.throws(()=>f.core.preparePeopleFinders(preview,privateFields(),approve));
  }
});
test('failed storage returns no payload and result cannot modify a replacement workspace',async()=>{
  const f=await coreFixture(),preview=f.core.peopleFindersPreview();f.fail();assert.throws(()=>f.core.preparePeopleFinders(preview,privateFields(),approve));
  const g=await coreFixture(),prior=g.core.peopleFindersPreview(),op=g.core.preparePeopleFinders(prior,privateFields(),approve);assert.throws(()=>g.core.recordPeopleFinders('b'.repeat(32),op.operationId,{status:'prepared'}));
  assert.throws(()=>g.core.recordPeopleFinders(prior.profileId,op.operationId,{status:'submitted'}));
});
function chromeFixture(){
  const records={};let opens=0,permission=true,saveFails=false;
  const api={storage:{local:{async get(key){return{[key]:records[key]};},async set(value){if(saveFails)throw Error();Object.assign(records,JSON.parse(JSON.stringify(value)));}}},permissions:{async contains(){return permission;}},tabs:{async create(){assert.equal(records['operation:'+'a'.repeat(32)].result.status,'unknown');opens++;return{id:opens,status:'complete'};},async get(id){return{id,status:'complete',url:Details.URL};}},scripting:{async executeScript(spec){return[{documentId:'owned',...(spec.files?{}:{result:spec.func.toString().includes('preparePage')?{status:'ready'}:{status:'prepared',detail:'Do not persist sensitive extra details',street:'123 Example Street'}})}];}}};
  return{api,records,opens:()=>opens,deny:()=>{permission=false;},fail:()=>{saveFails=true;}};
}
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:123}},message=()=>({type:'erase-me',action:'fill-peoplefinders',...payload()});
test('extension permission/journal precede tab, transient data never enters journal and duplicate operations never reopen',async()=>{
  const f=chromeFixture();const results=await Promise.all([Background.dispatch(message(),sender,f.api),Background.dispatch(message(),sender,f.api)]);
  assert.ok(results.some(r=>r.status==='prepared'));assert.equal(f.opens(),1);assert.equal((await Background.dispatch(message(),sender,f.api)).status,'prepared');assert.equal(f.opens(),1);
  const encoded=JSON.stringify(f.records);for(const value of ['123 Example Street','Example City','person@example.test'])assert.equal(encoded.includes(value),false);
});
test('permission or journal failure, foreign origin, unknown fields and generic run open no tab',async()=>{
  for(const mode of ['deny','fail','foreign','extra','generic']){
    const f=chromeFixture();if(mode==='deny')f.deny();if(mode==='fail')f.fail();
    const candidate=mode==='extra'?{...message(),destination:'https://example.test'}:mode==='generic'?{...message(),action:'run'}:message();
    try{await Background.dispatch(candidate,mode==='foreign'?{...sender,url:'https://example.test'}:sender,f.api);}catch(_){}
    assert.equal(f.opens(),0,mode);
  }
});
test('ping reports the separate private form capability only with its exact optional permission',async()=>{
  const f=chromeFixture();const ping=await Background.dispatch({type:'erase-me',action:'ping'},sender,f.api);assert.ok(ping.capabilities.includes('peoplefinders-prefill-v1'));assert.ok(ping.routes.includes(Details.ROUTE));
  f.api.permissions.contains=async spec=>!spec.origins.includes('https://'+Details.HOST+'/*');const denied=await Background.dispatch({type:'erase-me',action:'ping'},sender,f.api);assert.ok(!denied.routes.includes(Details.ROUTE));
});

test('public browser facade exports every private API independently of the test-only created core',()=>{for(const name of ['peopleFindersPreview','preparePeopleFinders','recordPeopleFinders'])assert.equal(typeof Core[name],'function',name);});

test('an unverified public Next stage withholds the private payload and retains its no-replay journal',async()=>{
  const f=chromeFixture();let privateCalls=0;
  f.api.scripting.executeScript=async spec=>{
    if(spec.files)return[{documentId:'owned'}];
    if(spec.func.toString().includes('preparePage')){assert.equal(spec.args,undefined);return[{documentId:'owned',result:{status:'blocked'}}];}
    privateCalls++;throw Error('Private fields must not be disclosed after a blocked public stage');
  };
  const result=await Background.dispatch(message(),sender,f.api);assert.equal(result.status,'unknown');assert.equal(privateCalls,0);assert.equal(f.opens(),1);
  assert.equal(JSON.stringify(f.records).includes('123 Example Street'),false);
  await Background.dispatch(message(),sender,f.api);assert.equal(f.opens(),1);assert.equal(privateCalls,0);
});
