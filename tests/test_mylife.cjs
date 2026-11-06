'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Details=require('../extension/mylife-details.js'),Core=require('../webapp/static/workspace-core.js'),Background=require('../extension/background.js');
const now='2026-11-05T00:00:00.000Z',privateFields=()=>({first_name:'Example',last_name:'Person',state:'California',city:'Example City',zip_code:'90210',birth_year:'1990'});
const payload=()=>({routeId:Details.ROUTE,operationId:'a'.repeat(32),authorized:true,ownRequestConfirmed:true,consentId:Details.CONTRACT.id,identity:{full_name:'Example Person',age:36},details:privateFields()});
async function coreFixture(){
  const storage=new Map();let counter=0,failed=false;
  const core=Core.create({storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(failed)throw Error();storage.set(key,value);},removeItem:key=>storage.delete(key)},uuid:()=>(++counter).toString(16).padStart(32,'0'),now:()=>now});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'person@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',city:'Profile City'})});
  return{core,storage,fail:()=>{failed=true;}};
}
const approve={authorized:true,consentId:Details.CONTRACT.id};
test('the actual browser facade exposes MyLife preview and reserves under the shared write lock',async()=>{
  const vm=require('node:vm'),fs=require('node:fs'),values=new Map();let sequence=0,locks=0;
  const context={EraseBrokerRoutes:require('../webapp/static/broker-routes.js'),EraseMyLifeDetails:Details,
    EraseIdentityDetails:require('../extension/identity-details.js'),ErasePeopleTraceDetails:require('../extension/peopletrace-details.js'),EraseCMADetails:require('../extension/cma-details.js'),EraseFootprintPlanner:require('../webapp/static/footprint-planner.js'),
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},crypto:{randomUUID:()=>(++sequence).toString(16).padStart(32,'0')},navigator:{locks:{async request(_key,_options,callback){locks++;return callback();}}},URL};
  vm.runInNewContext(fs.readFileSync(require.resolve('../webapp/static/workspace-core.js'),'utf8'),context);
  const api=context.EraseWorkspace;
  assert.equal((await api.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'person@example.test',authorized:true})})).ok,true);
  assert.equal((await api.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US'})})).ok,true);
  const preview=api.myLifePreview();assert.equal(preview.routeId,Details.ROUTE);const before=locks;
  const operation=await api.prepareMyLife(preview,privateFields(),approve);assert.equal(locks,before+1);assert.equal(operation.details.birth_year,'1990');assert.equal(api.exportData().includes('birth_year'),false);
});
test('six explicit identity fields require compatible birth year and own names without inferred values',()=>{
  assert.equal(Details.validateDetails(privateFields(),{fullName:'Example Person',age:36,now}).birth_year,'1990');
  assert.equal(Details.validateDetails({...privateFields(),birth_year:'1989'},{fullName:'Example Person',age:36,now}).birth_year,'1989');
  for(const value of [{...privateFields(),birth_year:'2015'},{...privateFields(),birth_year:'1980'},{...privateFields(),first_name:'Other'},{...privateFields(),state:'CA'},{...privateFields(),zip_code:'invalid'},{...privateFields(),email:'private@example.test'}])assert.throws(()=>Details.validateDetails(value,{fullName:'Example Person',age:36,now}));
});
test('payload requires exact own-information approval and canonical fields',()=>{
  Details.validatePayload(payload(),{now});
  for(const change of [{routeId:'usphonebook'},{authorized:false},{ownRequestConfirmed:false},{consentId:'other'},{confirmationUrl:'https://example.test'},{details:{...privateFields(),city:' Example City '}}])assert.throws(()=>Details.validatePayload({...payload(),...change},{now}));
});
test('core reserves before disclosure with no sensitive fields in storage, export, history or result',async()=>{
  const f=await coreFixture(),preview=f.core.myLifePreview(),operation=f.core.prepareMyLife(preview,privateFields(),approve);
  assert.equal(operation.details.birth_year,'1990');assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,operation.operationId);
  for(const value of ['birth_year','90210','Example City'])assert.equal(f.core.exportData().includes(value),false);
  f.core.recordMyLife(preview.profileId,operation.operationId,{status:'prepared',detail:'private birth_year 1990'});
  assert.equal(f.core.exportData().includes('birth_year'),false);assert.equal(f.core.dashboard().counts.removed,0);
  assert.throws(()=>f.core.prepareMyLife(preview,privateFields(),approve));
});
test('generic prepare, batch preview and generic field storage cannot consume transient route',async()=>{
  const f=await coreFixture();assert.equal(f.core.routes().find(r=>r.id===Details.ROUTE).automationLevel,'manual');
  assert.throws(()=>f.core.prepare(Details.ROUTE));assert.throws(()=>f.core.fillPreview(Details.ROUTE));assert.throws(()=>f.core.setEvidence(Details.ROUTE,{birth_year:'1990'}));
  assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,null);
});
test('hold, pause, country and profile changes invalidate old review before reservation',async()=>{
  for(const mutate of [f=>f.core.holdRoute(Details.ROUTE),f=>f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})}),f=>f.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'CA'})}),f=>f.core.remove()]){
    const f=await coreFixture(),preview=f.core.myLifePreview();await mutate(f);assert.throws(()=>f.core.prepareMyLife(preview,privateFields(),approve));
  }
});
test('failed storage returns no payload and result cannot modify a replacement workspace',async()=>{
  const f=await coreFixture(),preview=f.core.myLifePreview();f.fail();assert.throws(()=>f.core.prepareMyLife(preview,privateFields(),approve));
  const g=await coreFixture(),prior=g.core.myLifePreview(),op=g.core.prepareMyLife(prior,privateFields(),approve);assert.throws(()=>g.core.recordMyLife('b'.repeat(32),op.operationId,{status:'prepared'}));
  assert.throws(()=>g.core.recordMyLife(prior.profileId,op.operationId,{status:'submitted'}));
});
function chromeFixture(){
  const records={};let opens=0,permission=true,saveFails=false,currentURL=Details.ENTRY_URL,proof=0;const actions=[];
  const api={storage:{local:{async get(key){return{[key]:records[key]};},async set(value){if(saveFails)throw Error();Object.assign(records,JSON.parse(JSON.stringify(value)));}}},permissions:{async contains(){return permission;}},tabs:{async create(){assert.equal(records['operation:'+'a'.repeat(32)].result.status,'unknown');opens++;currentURL=Details.ENTRY_URL;return{id:opens,status:'complete'};},async get(id){return{id,status:'complete',url:currentURL};},async update(id,value){actions.push('navigate');currentURL=value.url;return{id,status:'complete',url:currentURL};}},scripting:{async executeScript(spec){if(!spec.files&&!spec.args){proof++;actions.push('proof');return[{documentId:'parent',result:true}];}actions.push(spec.files?'inject':'fill');return[{documentId:'owned',...(spec.files?{}:{result:{status:'prepared',detail:'Do not persist birth_year',birth_year:'1990'}})}];}}};
  return{api,records,opens:()=>opens,deny:()=>{permission=false;},fail:()=>{saveFails=true;},actions};
}
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:123}},message=()=>({type:'erase-me',action:'fill-mylife',...payload()});
test('extension permission/journal precede tab, transient data never enters journal and duplicate operations never reopen',async()=>{
  const f=chromeFixture();const results=await Promise.all([Background.dispatch(message(),sender,f.api),Background.dispatch(message(),sender,f.api)]);
  assert.ok(results.some(r=>r.status==='prepared'));assert.equal(f.opens(),1);assert.deepEqual(f.actions,['proof','proof','navigate','inject','fill']);assert.equal((await Background.dispatch(message(),sender,f.api)).status,'prepared');assert.equal(f.opens(),1);
  const encoded=JSON.stringify(f.records);for(const value of ['birth_year','90210','Example City','person@example.test'])assert.equal(encoded.includes(value),false);
});
test('permission or journal failure, foreign origin, unknown fields and generic run open no tab',async()=>{
  for(const mode of ['deny','fail','foreign','extra','generic']){
    const f=chromeFixture();if(mode==='deny')f.deny();if(mode==='fail')f.fail();
    const candidate=mode==='extra'?{...message(),destination:'https://example.test'}:mode==='generic'?{...message(),action:'run'}:message();
    try{await Background.dispatch(candidate,mode==='foreign'?{...sender,url:'https://example.test'}:sender,f.api);}catch(_){}
    assert.equal(f.opens(),0,mode);
  }
});
test('ping reports separate MyLife capability only with its exact optional permission',async()=>{
  const f=chromeFixture();const ping=await Background.dispatch({type:'erase-me',action:'ping'},sender,f.api);assert.ok(ping.capabilities.includes('mylife-prefill-v1'));assert.ok(ping.routes.includes(Details.ROUTE));
  f.api.permissions.contains=async spec=>!spec.origins.includes('https://mylife.jotform.com/*');const denied=await Background.dispatch({type:'erase-me',action:'ping'},sender,f.api);assert.ok(!denied.routes.includes(Details.ROUTE));
});
test('changed parent proof, document, form destination or injection document stops before field disclosure',async()=>{
  for(const mode of ['first-proof','second-proof','second-document','wrong-destination','wrong-helper-document']){
    const f=chromeFixture(),original=f.api.scripting.executeScript;let proofs=0,fill=0;
    f.api.scripting.executeScript=async spec=>{
      if(!spec.files&&!spec.args){proofs++;const value=await original(spec);if(mode==='first-proof'&&proofs===1||mode==='second-proof'&&proofs===2)value[0].result=false;if(mode==='second-document'&&proofs===2)value[0].documentId='replaced';return value;}
      if(spec.args)fill++;const value=await original(spec);if(mode==='wrong-helper-document'&&spec.args)value[0].documentId='changed';return value;
    };
    if(mode==='wrong-destination'){const update=f.api.tabs.update;f.api.tabs.update=async(id,value)=>update(id,{url:value.url+'/login'});}
    const result=await Background.dispatch(message(),sender,f.api);assert.equal(result.status,'unknown',mode);
    if(mode!=='wrong-helper-document')assert.equal(fill,0,mode);
  }
});
