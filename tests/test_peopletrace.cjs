'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Details=require('../extension/peopletrace-details.js'),Core=require('../webapp/static/workspace-core.js'),Background=require('../extension/background.js');
const now='2026-11-05T00:00:00.000Z',privateFields=()=>({date_of_birth:'1990-01-01',phone:'+44 20 7946 0958',flat_number:'7',building:'9',street:'Example Road',town:'London',postcode:'SW1A 1AA'});
const payload=()=>({routeId:Details.ROUTE,operationId:'a'.repeat(32),authorized:true,ownRequestConfirmed:true,consentId:Details.CONTRACT.id,identity:{full_name:'Example Person',email:'person@example.test',age:36},details:privateFields()});
async function coreFixture(){
  const storage=new Map();let counter=0,failed=false;
  const core=Core.create({storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(failed)throw Error();storage.set(key,value);},removeItem:key=>storage.delete(key)},uuid:()=>(++counter).toString(16).padStart(32,'0'),now:()=>now});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'person@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'GB',city:'London'})});
  return{core,storage,fail:()=>{failed=true;}};
}
const approve={authorized:true,consentId:Details.CONTRACT.id};
test('transient values canonicalize UK postcode, valid adult DOB and phone without accepting extra fields',()=>{
  assert.equal(Details.validateDetails({...privateFields(),postcode:'sw1a1aa'},{age:36,now}).postcode,'SW1A 1AA');
  for(const value of [{...privateFields(),date_of_birth:'1990-02-30'},{...privateFields(),date_of_birth:'2015-01-01'},{...privateFields(),phone:'<script>'},{...privateFields(),postcode:'90210'},{...privateFields(),id_document:'x'}])assert.throws(()=>Details.validateDetails(value,{age:36,now}));
  assert.throws(()=>Details.validateDetails(privateFields(),{age:18,now}));
});
test('payload requires exact own-information approval and canonical fields',()=>{
  Details.validatePayload(payload(),{now});
  for(const change of [{routeId:'usphonebook'},{authorized:false},{ownRequestConfirmed:false},{consentId:'other'},{confirmationUrl:'https://example.test'},{details:{...privateFields(),postcode:'sw1a1aa'}}])assert.throws(()=>Details.validatePayload({...payload(),...change},{now}));
});
test('core reserves before disclosure with no sensitive fields in storage, export, history or result',async()=>{
  const f=await coreFixture(),preview=f.core.peopleTracePreview(),operation=f.core.preparePeopleTrace(preview,privateFields(),approve);
  assert.equal(operation.details.date_of_birth,'1990-01-01');assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,operation.operationId);
  for(const value of ['1990-01-01','7946','Example Road','SW1A 1AA'])assert.equal(f.core.exportData().includes(value),false);
  f.core.recordPeopleTrace(preview.profileId,operation.operationId,{status:'prepared',detail:'1990-01-01'});
  assert.equal(f.core.exportData().includes('1990-01-01'),false);assert.equal(f.core.dashboard().counts.removed,0);
  assert.throws(()=>f.core.preparePeopleTrace(preview,privateFields(),approve));
});
test('generic prepare, batch preview and generic field storage cannot consume transient route',async()=>{
  const f=await coreFixture();assert.equal(f.core.routes().find(r=>r.id===Details.ROUTE).automationLevel,'manual');
  assert.throws(()=>f.core.prepare(Details.ROUTE));assert.throws(()=>f.core.fillPreview(Details.ROUTE));assert.throws(()=>f.core.setEvidence(Details.ROUTE,{date_of_birth:'1990-01-01'}));
  assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,null);
});
test('hold, pause, country and profile changes invalidate old review before reservation',async()=>{
  for(const mutate of [f=>f.core.holdRoute(Details.ROUTE),f=>f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})}),f=>f.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US'})}),f=>f.core.remove()]){
    const f=await coreFixture(),preview=f.core.peopleTracePreview();await mutate(f);assert.throws(()=>f.core.preparePeopleTrace(preview,privateFields(),approve));
  }
});
test('failed storage returns no payload and result cannot modify a replacement workspace',async()=>{
  const f=await coreFixture(),preview=f.core.peopleTracePreview();f.fail();assert.throws(()=>f.core.preparePeopleTrace(preview,privateFields(),approve));
  const g=await coreFixture(),prior=g.core.peopleTracePreview(),op=g.core.preparePeopleTrace(prior,privateFields(),approve);assert.throws(()=>g.core.recordPeopleTrace('b'.repeat(32),op.operationId,{status:'prepared'}));
  assert.throws(()=>g.core.recordPeopleTrace(prior.profileId,op.operationId,{status:'submitted'}));
});
function chromeFixture(){
  const records={};let opens=0,permission=true,saveFails=false;
  const api={storage:{local:{async get(key){return{[key]:records[key]};},async set(value){if(saveFails)throw Error();Object.assign(records,JSON.parse(JSON.stringify(value)));}}},permissions:{async contains(){return permission;}},tabs:{async create(){assert.equal(records['operation:'+'a'.repeat(32)].result.status,'unknown');opens++;return{id:opens,status:'complete'};},async get(id){return{id,status:'complete',url:Details.URL};}},scripting:{async executeScript(spec){return[{documentId:'owned',...(spec.files?{}:{result:{status:'prepared',detail:'Do not persist sensitive extra details',date_of_birth:'1990-01-01'}})}];}}};
  return{api,records,opens:()=>opens,deny:()=>{permission=false;},fail:()=>{saveFails=true;}};
}
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:123}},message=()=>({type:'erase-me',action:'fill-peopletrace',...payload()});
test('extension permission/journal precede tab, transient data never enters journal and duplicate operations never reopen',async()=>{
  const f=chromeFixture();const results=await Promise.all([Background.dispatch(message(),sender,f.api),Background.dispatch(message(),sender,f.api)]);
  assert.ok(results.some(r=>r.status==='prepared'));assert.equal(f.opens(),1);assert.equal((await Background.dispatch(message(),sender,f.api)).status,'prepared');assert.equal(f.opens(),1);
  const encoded=JSON.stringify(f.records);for(const value of ['1990-01-01','7946','Example Road','SW1A 1AA','person@example.test'])assert.equal(encoded.includes(value),false);
});
test('permission or journal failure, foreign origin, unknown fields and generic run open no tab',async()=>{
  for(const mode of ['deny','fail','foreign','extra','generic']){
    const f=chromeFixture();if(mode==='deny')f.deny();if(mode==='fail')f.fail();
    const candidate=mode==='extra'?{...message(),destination:'https://example.test'}:mode==='generic'?{...message(),action:'run'}:message();
    try{await Background.dispatch(candidate,mode==='foreign'?{...sender,url:'https://example.test'}:sender,f.api);}catch(_){}
    assert.equal(f.opens(),0,mode);
  }
});
test('ping reports separate People Trace capability only with its exact optional permission',async()=>{
  const f=chromeFixture();const ping=await Background.dispatch({type:'erase-me',action:'ping'},sender,f.api);assert.ok(ping.capabilities.includes('peopletrace-prefill-v1'));assert.ok(ping.routes.includes(Details.ROUTE));
  f.api.permissions.contains=async spec=>!spec.origins.includes('https://www.peopletraceuk.com/*');const denied=await Background.dispatch({type:'erase-me',action:'ping'},sender,f.api);assert.ok(!denied.routes.includes(Details.ROUTE));
});
