'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('../webapp/static/workspace-core.js'),Dialog=require('../webapp/static/private-route-dialog.js'),Phone=require('../extension/phone-preference-details.js'),Association=require('../extension/association-details.js'),Directory=require('../extension/directory-suppression-details.js'),{dom,gate}=require('./removal_send_fixture.cjs');
const CASES={
  'ca-dncl':{country:'CA',details:{phone:'6135550123'}},'gb-tps':{country:'GB',details:{phone:'02079460000'}},
  canada411:{country:'CA',details:{phone:'6135550123',email:'contact@example.test'}},
  '192com':{country:'GB',details:{first_name:'Example',last_name:'Person',postcode:'SW1A 1AA',email:'contact@example.test'}},
  ...Object.fromEntries(Object.keys(Association.ROUTES).map(id=>[id,{country:'US',details:{first_name:'Example',last_name:'Person',date_of_birth:'1990-05-01',city:'Private City',state:'CA',email:'contact@example.test'}}]))
};
async function fixture(routeId){
  const values=new Map();let seq=0,fail=false,pingGate=null,prepareGate=null,capable=true;
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>{if(fail)throw Error('quota');values.set(key,value);},removeItem:key=>values.delete(key)};
  const core=Core.create({storage,crypto:crypto.webcrypto,uuid:()=>(++seq).toString(16).padStart(32,'0'),now:()=> '2026-11-06T00:00:00.000Z'});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'primary@example.test',authorized:true})});await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:CASES[routeId].country})});
  const calls=[],d=dom(),byId=id=>d.document.getElementById('private-route-'+id),fire=(id,type='click')=>byId(id).listeners.get(type)?.({preventDefault(){}});
  const workspace={...core,async preparePrivateRoute(...args){const result=core.preparePrivateRoute(...args);if(prepareGate)await prepareGate.promise;return result;}};
  const companion=async payload=>{
    calls.push(structuredClone(payload));if(payload.action==='ping'){if(pingGate)await pingGate.promise;return{routes:[routeId],capabilities:capable?['phone-preference-prefill-v1','association-prefill-v1','directory-suppression-prefill-v1']:[]};}
    assert.equal(payload.action,'fill-private-route');assert.equal(core.snapshot().items[routeId].operation_id,payload.operationId);
    for(const key of Object.keys(CASES[routeId].details))assert.equal(byId(key).value,'');assert.equal(byId('disclosure').textContent.includes('Private City'),false);
    const{action,...body}=payload;(Phone.ROUTES[routeId]?Phone:Association.ROUTES[routeId]?Association:Directory).validatePayload(body);return{status:'prepared'};
  };
  const dialog=Dialog.create({workspace,companion,document:d.document,now:()=> '2026-11-06T00:00:00.000Z'});
  const enter=(key,value)=>{byId(key).value=value;fire(key,'input');},review=()=>{for(const[key,value]of Object.entries(CASES[routeId].details))enter(key,value);fire('form','submit');},approve=()=>{byId('approval').checked=true;fire('approval','change');};
  return{...d,core,storage,values,calls,dialog,byId,fire,enter,review,approve,fail:()=>{fail=true;},noCapability:()=>{capable=false;},delayPing:()=>pingGate=gate(),delayPrepare:()=>prepareGate=gate()};
}
for(const routeId of Object.keys(CASES)){
  test(routeId+' reviews exact fields and clears all private copies before one reserved prefill',async()=>{
    const f=await fixture(routeId);await f.dialog.open(routeId,f.opener,f.core.profile().id);assert.equal(f.calls.length,0);assert.equal(f.byId('approval').checked,false);f.review();assert.equal(f.byId('disclosure').hidden,false);assert.equal(f.byId('fill').disabled,true);await f.fire('fill');assert.equal(f.calls.length,0);f.approve();await f.fire('fill');
    assert.deepEqual(f.calls.map(x=>x.action),['ping','fill-private-route']);const item=f.core.snapshot().items[routeId];assert.equal(item.status,'needs_broker_step');assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);assert.equal(f.core.exportData().includes('Private City'),false);assert.equal(f.core.exportData().includes('1990-05-01'),false);assert.equal(f.core.exportData().includes('613-555-0123'),false);assert.equal(f.core.exportData().includes('SW1A 1AA'),false);assert.throws(()=>f.core.privateRoutePreview(routeId));
    const reload=Core.create({storage:f.storage,crypto:crypto.webcrypto});assert.equal(reload.snapshot().items[routeId].operation_id,item.operation_id);assert.throws(()=>reload.privateRoutePreview(routeId));
  });
  test(routeId+' input edits invalidate approval; close/hold/old capability cannot dispatch',async()=>{
    const f=await fixture(routeId);await f.dialog.open(routeId,f.opener,f.core.profile().id);f.review();f.approve();const key=Object.keys(CASES[routeId].details)[0];f.enter(key,CASES[routeId].details[key]);assert.equal(f.byId('approval').checked,false);assert.equal(f.byId('disclosure').hidden,true);f.review();f.approve();f.noCapability();await f.fire('fill');assert.equal(f.calls.length,1);assert.equal(f.core.snapshot().items[routeId].operation_id,null);f.fire('close');for(const key of Object.keys(CASES[routeId].details))assert.equal(f.byId(key).value,'');f.core.holdRoute(routeId);await assert.rejects(f.dialog.open(routeId,f.opener,f.core.profile().id));
  });
}
for(const routeId of ['ca-dncl','192com','intelius'])test(routeId+' close, hold, pause, changed fields or replacement during reservation withhold private dispatch',async()=>{
  for(const mode of ['close','hold','pause','replace','delete','profile']){
    const f=await fixture(routeId);await f.dialog.open(routeId,f.opener,f.core.profile().id);f.review();f.approve();const g=f.delayPrepare(),pending=f.fire('fill');while(!f.core.snapshot().items[routeId].operation_id)await new Promise(resolve=>setImmediate(resolve));
    if(mode==='close')f.fire('close');else if(mode==='hold')f.core.holdRoute(routeId);else if(mode==='pause')await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});else if(mode==='profile')await f.core.api('/api/profile',{method:'POST',body:JSON.stringify({city:'Changed City'})});else{f.core.remove();if(mode==='replace')await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Replacement Person',age:36,email:'replacement@example.test',authorized:true})});}
    g.release();await pending;assert.deepEqual(f.calls.map(x=>x.action),['ping'],mode);for(const key of Object.keys(CASES[routeId].details))assert.equal(f.byId(key).value,'',mode);
  }
});
test('storage failure, foreign country, stale opener and extra fields return no private payload',async()=>{
  const f=await fixture('192com');await assert.rejects(f.dialog.open('192com',f.opener,'f'.repeat(32)));const preview=f.core.privateRoutePreview('192com');assert.throws(()=>f.core.preparePrivateRoute(preview,{...CASES['192com'].details,phone:'999'},{authorized:true,consentId:preview.consentId}));
  await f.dialog.open('192com',f.opener,f.core.profile().id);f.review();f.approve();f.fail();await f.fire('fill');assert.deepEqual(f.calls.map(x=>x.action),['ping']);assert.equal(f.core.snapshot().items['192com'].operation_id,null);
  const g=await fixture('ca-dncl');await g.core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US'})});assert.throws(()=>g.core.privateRoutePreview('ca-dncl'));
});
test('actual public mutation facade rechecks queued old-profile reservation under Web Locks',async()=>{
  const values=new Map();let seq=0,tail=Promise.resolve(),release;const locks={request(_name,_options,action){const pending=tail.then(action);tail=pending.catch(()=>{});return pending;}};
  const context={EraseBrokerRoutes:Core.routes(),ErasePhonePreferenceDetails:Phone,EraseAssociationDetails:Association,EraseDirectorySuppressionDetails:Directory,crypto:{subtle:crypto.webcrypto.subtle,randomUUID:()=>(++seq).toString(16).padStart(32,'0')},TextEncoder,Uint8Array,URL,Date,navigator:{locks},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../webapp/static/workspace-core.js'),'utf8'),context);const api=context.EraseWorkspace;await api.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'primary@example.test',authorized:true})});await api.api('/api/profile',{method:'POST',body:JSON.stringify({country:'CA'})});const preview=api.privateRoutePreview('ca-dncl');tail=new Promise(resolve=>{release=resolve;});const remove=api.remove(),replace=api.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Replacement Person',age:36,email:'other@example.test',authorized:true})}),prepare=api.preparePrivateRoute(preview,{phone:'6135550123'},{authorized:true,consentId:preview.consentId});release();await remove;await replace;await assert.rejects(prepare);assert.equal(api.profile().name,'Replacement Person');assert.equal(api.snapshot().items['ca-dncl'].operation_id,null);
});
