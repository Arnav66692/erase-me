'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Details=require('../extension/cma-details.js'),Core=require('../webapp/static/workspace-core.js'),Background=require('../extension/background.js');
const now='2026-11-05T00:00:00.000Z',privateFields=()=>({first_name:'Example',last_name:'Person',address1:'123 Example Street',address2:'Unit 7',city:'Ottawa',province:'ON',postal_code:'K1A 0A6'});
const payload=()=>({routeId:Details.ROUTE,operationId:'a'.repeat(32),authorized:true,ownRequestConfirmed:true,consentId:Details.CONTRACT.id,fullName:'Example Person',details:privateFields(),autoSubmit:false});
async function coreFixture(){
  const storage=new Map();let counter=0,failed=false;
  const core=Core.create({storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(failed)throw Error();storage.set(key,value);},removeItem:key=>storage.delete(key)},uuid:()=>(++counter).toString(16).padStart(32,'0'),now:()=>now});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'person@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'CA',city:'Ottawa'})});
  return{core,storage,fail:()=>{failed=true;}};
}
const approve={authorized:true,consentId:Details.CONTRACT.id,autoSubmit:false};
test('the actual browser workspace facade exposes and runs the private CMA review under its write lock',async()=>{
  const vm=require('node:vm'),fs=require('node:fs'),values=new Map();let sequence=0,locks=0;
  const context={EraseBrokerRoutes:require('../webapp/static/broker-routes.js'),EraseCMADetails:Details,
    EraseIdentityDetails:require('../extension/identity-details.js'),ErasePeopleTraceDetails:require('../extension/peopletrace-details.js'),EraseFootprintPlanner:require('../webapp/static/footprint-planner.js'),
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},
    crypto:{randomUUID:()=>(++sequence).toString(16).padStart(32,'0')},navigator:{locks:{async request(_key,_options,callback){locks++;return callback();}}},URL};
  vm.runInNewContext(fs.readFileSync(require.resolve('../webapp/static/workspace-core.js'),'utf8'),context);
  const api=context.EraseWorkspace;
  assert.equal((await api.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'person@example.test',authorized:true})})).ok,true);
  assert.equal((await api.api('/api/profile',{method:'POST',body:JSON.stringify({country:'CA'})})).ok,true);
  const preview=api.cmaPreview();assert.equal(preview.routeId,Details.ROUTE);
  const before=locks,operation=await api.prepareCMA(preview,privateFields(),approve);assert.equal(locks,before+1);
  assert.equal(operation.routeId,Details.ROUTE);assert.equal(api.exportData().includes('123 Example Street'),false);
});
test('CMA exact canonical mailing fields require matching own name and reject unknown or silently sanitized data',()=>{
  assert.equal(Details.validateDetails({...privateFields(),postal_code:'k1a0a6'},{fullName:'Example Person'}).postal_code,'K1A 0A6');
  for(const value of [{...privateFields(),address1:'7/9 Example Street'},{...privateFields(),postal_code:'90210'},{...privateFields(),province:'CA'},{...privateFields(),company:'Example'},{...privateFields(),first_name:'Other'}])assert.throws(()=>Details.validateDetails(value,{fullName:'Example Person'}));
});
test('payload requires exact own-information approval and canonical fields',()=>{
  Details.validatePayload(payload());
  for(const change of [{routeId:'usphonebook'},{authorized:false},{ownRequestConfirmed:false},{consentId:'other'},{confirmationUrl:'https://example.test'},{details:{...privateFields(),postal_code:'k1a0a6'}}])assert.throws(()=>Details.validatePayload({...payload(),...change},{now}));
});
test('core reserves before disclosure with no sensitive fields in storage, export, history or result',async()=>{
  const f=await coreFixture(),preview=f.core.cmaPreview(),operation=f.core.prepareCMA(preview,privateFields(),approve);
  assert.equal(operation.details.address1,'123 Example Street');assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,operation.operationId);
  for(const value of ['123 Example Street','Unit 7','K1A 0A6'])assert.equal(f.core.exportData().includes(value),false);
  f.core.recordCMA(preview.profileId,operation.operationId,{status:'prepared',detail:'123 Example Street'});
  assert.equal(f.core.exportData().includes('123 Example Street'),false);assert.equal(f.core.dashboard().counts.removed,0);
  assert.throws(()=>f.core.prepareCMA(preview,privateFields(),approve));
});
test('generic prepare, batch preview and generic field storage cannot consume transient route',async()=>{
  const f=await coreFixture();assert.equal(f.core.routes().find(r=>r.id===Details.ROUTE).automationLevel,'manual');
  assert.throws(()=>f.core.prepare(Details.ROUTE));assert.throws(()=>f.core.fillPreview(Details.ROUTE));assert.throws(()=>f.core.setEvidence(Details.ROUTE,{address1:'123 Example Street'}));
  assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,null);
});
test('hold, pause, country and profile changes invalidate old review before reservation',async()=>{
  for(const mutate of [f=>f.core.holdRoute(Details.ROUTE),f=>f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})}),f=>f.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US'})}),f=>f.core.remove()]){
    const f=await coreFixture(),preview=f.core.cmaPreview();await mutate(f);assert.throws(()=>f.core.prepareCMA(preview,privateFields(),approve));
  }
});
test('failed storage returns no payload and result cannot modify a replacement workspace',async()=>{
  const f=await coreFixture(),preview=f.core.cmaPreview();f.fail();assert.throws(()=>f.core.prepareCMA(preview,privateFields(),approve));
  const g=await coreFixture(),prior=g.core.cmaPreview(),op=g.core.prepareCMA(prior,privateFields(),approve);assert.throws(()=>g.core.recordCMA('b'.repeat(32),op.operationId,{status:'prepared'}));
  assert.throws(()=>g.core.recordCMA(prior.profileId,op.operationId,{status:'submitted'}));
});
function chromeFixture(){
  const records={};let opens=0,permission=true,saveFails=false;
  const api={storage:{local:{async get(key){return{[key]:records[key]};},async set(value){if(saveFails)throw Error();Object.assign(records,JSON.parse(JSON.stringify(value)));}}},permissions:{async contains(){return permission;}},tabs:{async create(){assert.equal(records['operation:'+'a'.repeat(32)].result.status,'unknown');opens++;return{id:opens,status:'complete'};},async get(id){return{id,status:'complete',url:Details.URL};}},scripting:{async executeScript(spec){return[{documentId:'owned',...(spec.files?{}:{result:{status:'prepared',detail:'Do not persist sensitive extra details',address1:'123 Example Street'}})}];}}};
  return{api,records,opens:()=>opens,deny:()=>{permission=false;},fail:()=>{saveFails=true;}};
}
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:123}},message=()=>({type:'erase-me',action:'run-cma',...payload()});
test('extension permission/journal precede tab, transient data never enters journal and duplicate operations never reopen',async()=>{
  const f=chromeFixture();const results=await Promise.all([Background.dispatch(message(),sender,f.api),Background.dispatch(message(),sender,f.api)]);
  assert.ok(results.some(r=>r.status==='prepared'));assert.equal(f.opens(),1);assert.equal((await Background.dispatch(message(),sender,f.api)).status,'prepared');assert.equal(f.opens(),1);
  const encoded=JSON.stringify(f.records);for(const value of ['123 Example Street','Unit 7','K1A 0A6','person@example.test'])assert.equal(encoded.includes(value),false);
});
test('permission or journal failure, foreign origin, unknown fields and generic run open no tab',async()=>{
  for(const mode of ['deny','fail','foreign','extra','generic']){
    const f=chromeFixture();if(mode==='deny')f.deny();if(mode==='fail')f.fail();
    const candidate=mode==='extra'?{...message(),destination:'https://example.test'}:mode==='generic'?{...message(),action:'run'}:message();
    try{await Background.dispatch(candidate,mode==='foreign'?{...sender,url:'https://example.test'}:sender,f.api);}catch(_){}
    assert.equal(f.opens(),0,mode);
  }
});
test('ping reports separate CMA capability only with its exact optional permission',async()=>{
  const f=chromeFixture();const ping=await Background.dispatch({type:'erase-me',action:'ping'},sender,f.api);assert.ok(ping.capabilities.includes('cma-registration-v1'));assert.ok(ping.routes.includes(Details.ROUTE));
  f.api.permissions.contains=async spec=>!spec.origins.includes('https://cmadnm.cawebhosting.ca/*');const denied=await Background.dispatch({type:'erase-me',action:'ping'},sender,f.api);assert.ok(!denied.routes.includes(Details.ROUTE));
});

test('registration submission needs separate opt-in and exact attempt proof, never acceptance or deletion',async()=>{
  const f=await coreFixture(),preview=f.core.cmaPreview(),op=f.core.prepareCMA(preview,privateFields(),{...approve,autoSubmit:true});
  assert.equal(op.autoSubmit,true);
  for(const bad of [{status:'submitted'},{status:'submission_attempted',attempt_verified:false,stage:'marketing_registration'},{status:'submission_attempted',attempt_verified:true,stage:'request_submission'}])assert.throws(()=>f.core.recordCMA(preview.profileId,op.operationId,bad));
  f.core.recordCMA(preview.profileId,op.operationId,{status:'submission_attempted',attempt_verified:true,stage:'marketing_registration'});
  const item=f.core.snapshot().items[Details.ROUTE];assert.equal(item.evidence.acceptance_verified,false);assert.equal(item.evidence.stage,'marketing_registration');assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);
  const g=await coreFixture(),prior=g.core.cmaPreview(),only=g.core.prepareCMA(prior,privateFields(),approve);
  assert.throws(()=>g.core.recordCMA(prior.profileId,only.operationId,{status:'submission_attempted',attempt_verified:true,stage:'marketing_registration'}));
});

test('extension accepts only the separately approved marketing-attempt proof and never persists payload details',async()=>{
  for(const [approved,stage,expected]of [[true,'marketing_registration','submission_attempted'],[false,'marketing_registration','unknown'],[true,'request_submission','unknown']]){
    const f=chromeFixture();f.api.scripting.executeScript=async spec=>[{documentId:'owned',...(spec.files?{}:{result:{status:'submission_attempted',attempt_verified:true,stage,address1:'123 Example Street'}})}];
    const result=await Background.dispatch({...message(),autoSubmit:approved},sender,f.api);assert.equal(result.status,expected);assert.equal(JSON.stringify(f.records).includes('123 Example Street'),false);
  }
});
