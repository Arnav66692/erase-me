'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createRequire}=require('node:module');
const PRIVACY='https://www.familytreenow.com/privacy',FORM='https://www.familytreenow.com/optout';
const message=()=>({type:'erase-me',action:'run',routeId:'familytreenow',operationId:'a'.repeat(32),fields:{first_name:'Example',last_name:'Person',email:'person@example.test'},authorized:true,ownRequestConfirmed:true});
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:123}};
function fixture(){
  const records={},calls=[],updated=new Set(),removed=new Set(),timers=new Map();let sequence=0;
  const state={url:PRIVACY,permission:true,saveFails:false,documentId:'privacy-document',ready:true,formId:'form-document',files:false,disclosure:false,installReplacement:false};
  const headings=[{textContent:'Family Tree Now Privacy Notice',getClientRects:()=>[{}]}],links=[{textContent:'Opt-Out Form',href:FORM,getClientRects:()=>[{}]}];
  const privacy={location:{href:PRIVACY},document:{title:'Privacy Policy - FamilyTreeNow.com',querySelector:()=>state.files?{}:null,querySelectorAll:s=>s==='h2'?headings:s==='a[href]'?links:[]},getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})};
  const context={module:{exports:{}},require:createRequire(require.resolve('../extension/background.js')),setTimeout(callback,ms){assert.equal(ms,12000);timers.set(++sequence,callback);return sequence;},clearTimeout:key=>timers.delete(key),URL,crypto:global.crypto};
  vm.runInNewContext(fs.readFileSync(require.resolve('../extension/background.js'),'utf8'),context);const background=context.module.exports;
  const chrome={storage:{local:{async get(key){return{[key]:records[key]};},async set(value){if(state.saveFails)throw Error();Object.assign(records,JSON.parse(JSON.stringify(value)));calls.push('save');}}},permissions:{async contains(){return state.permission;}},tabs:{
    onUpdated:{addListener:l=>updated.add(l),removeListener:l=>updated.delete(l)},onRemoved:{addListener:l=>removed.add(l),removeListener:l=>removed.delete(l)},
    async create(value){assert.equal(records['operation:'+message().operationId].result.status,'unknown');assert.equal(value.url,PRIVACY);calls.push('open-privacy');return{id:1,status:'complete',url:PRIVACY};},async get(id){return{id,status:'complete',url:state.url};},
    async update(id,value){assert.equal(id,1);assert.equal(value.url,FORM);assert.ok(calls.filter(c=>c==='privacy-proof').length===2);calls.push('published-entry');state.url=value.url;return{id,status:'complete',url:state.url};}
  },scripting:{async executeScript(spec){
    if(spec.files){assert.equal(state.url,FORM);assert.deepEqual(Array.from(spec.files),['broker-executor.js']);calls.push('install');if(spec.target.documentIds){assert.equal(spec.target.documentIds[0],state.formId);if(state.installReplacement)return[{documentId:'replacement'}];}return[{documentId:state.formId}];}
    if(!spec.args){assert.equal(JSON.stringify(spec).includes('person@example.test'),false);if(state.url===PRIVACY){calls.push('privacy-proof');if(spec.target.documentIds)assert.equal(spec.target.documentIds[0],'privacy-document');const result=vm.runInNewContext('('+spec.func.toString()+')()',privacy);return[{documentId:state.documentId,result}];}
      calls.push('form-proof');assert.equal(spec.target.documentIds[0],state.formId);const publicPage={EraseBrokerExecutor:{familyTreeNowFacts(fields,env,pending){assert.equal(fields,null);assert.equal(pending,true);if(!state.ready)throw Error();}}};const result=vm.runInNewContext('('+spec.func.toString()+')()',publicPage);return[{documentId:state.formId,result}];}
    assert.equal(calls.includes('form-proof'),true);assert.equal(state.ready,true);assert.equal(spec.target.documentIds[0],state.formId);assert.equal(state.url,FORM);state.disclosure=true;calls.push('fill');return[{documentId:state.formId,result:{status:'prepared'}}];
  }}};
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return{background,chrome,state,records,calls,headings,links,privacy,updated,removed,timers,flush,complete(){for(const l of [...updated])l(1,{status:'complete'},{id:1,url:state.url});},deadline(){for(const callback of [...timers.values()])callback();}};
}
test('FamilyTreeNow proves privacy source and exact initial document before any personal payload; journal remains reference-only',async()=>{
  const f=fixture();assert.equal((await f.background.dispatch(message(),sender,f.chrome)).status,'prepared');assert.equal(f.state.disclosure,true);assert.equal(f.timers.size,0);assert.equal(f.updated.size,0);assert.equal(f.removed.size,0);assert.equal(JSON.stringify(f.records).includes('person@example.test'),false);
  await f.background.dispatch(message(),sender,f.chrome);assert.equal(f.calls.filter(c=>c==='fill').length,1);assert.equal(f.calls.filter(c=>c==='open-privacy').length,1);
});
test('FamilyTreeNow privacy purpose, one published link, permission and storage failures stop before disclosure',async()=>{
  for(const mutate of [f=>{f.state.permission=false;},f=>{f.state.saveFails=true;},f=>{f.state.url+='?changed';},f=>{f.privacy.document.title='Export';},f=>{f.headings[0].textContent='Export';},f=>{f.links[0].href='https://other.example/collect';},f=>{f.links.push({...f.links[0]});},f=>{f.links[0].getClientRects=()=>[];},f=>{f.state.documentId='replacement';},f=>{f.state.files=true;}]){const f=fixture();mutate(f);await f.background.dispatch(message(),sender,f.chrome);assert.equal(f.state.disclosure,false);assert.equal(f.calls.includes('published-entry'),false);assert.equal(f.timers.size,0);}
});
test('a normal document-completion event can make the original bounded action ready without any reload or polling',async()=>{
  const f=fixture();f.state.ready=false;const work=f.background.dispatch(message(),sender,f.chrome);await f.flush();assert.equal(f.state.disclosure,false);assert.equal(f.timers.size,1);assert.equal(f.calls.filter(c=>c==='install').length,1);await f.flush();assert.equal(f.calls.filter(c=>c==='install').length,1);
  f.state.ready=true;f.complete();await f.flush();assert.equal((await work).status,'prepared');assert.equal(f.calls.filter(c=>c==='published-entry').length,1);assert.equal(f.timers.size,0);assert.equal(f.updated.size,0);
});
test('the single deadline releases listeners without late disclosure when readiness emits no completion event',async()=>{
  const f=fixture();f.state.ready=false;const work=f.background.dispatch(message(),sender,f.chrome);await f.flush();f.state.ready=true;f.deadline();assert.equal((await work).status,'unknown');assert.equal(f.state.disclosure,false);assert.equal(f.updated.size,0);assert.equal(f.timers.size,0);
});
test('blocked page, foreign navigation, closed tab and changed pinned document never fill or replay',async()=>{
  for(const mode of ['deadline','navigation','closed','replacement']){const f=fixture();f.state.ready=mode==='replacement';f.state.installReplacement=mode==='replacement';const work=f.background.dispatch(message(),sender,f.chrome);await f.flush();if(mode==='deadline')f.deadline();if(mode==='navigation'){f.state.url='https://other.example/collect';f.complete();}if(mode==='closed')for(const l of [...f.removed])l(1);const result=await work;assert.equal(result.status,'unknown',mode);assert.equal(f.state.disclosure,false);assert.equal(f.updated.size,0);assert.equal(f.removed.size,0);assert.equal(f.timers.size,0);await f.background.dispatch(message(),sender,f.chrome);assert.equal(f.calls.filter(c=>c==='open-privacy').length,1);}
});

test('a hung public script probe cannot outlive the foreground deadline or disclose after its late resolution',async()=>{
  const f=fixture(),execute=f.chrome.scripting.executeScript;let resolve;
  f.chrome.scripting.executeScript=spec=>spec.files&&!spec.target.documentIds?new Promise(done=>{resolve=done;}):execute(spec);
  const work=f.background.dispatch(message(),sender,f.chrome);await f.flush();assert.equal(f.timers.size,1);f.deadline();assert.equal((await work).status,'unknown');assert.equal(f.updated.size,0);assert.equal(f.timers.size,0);const count=f.calls.length;resolve([{documentId:f.state.formId}]);await f.flush();assert.equal(f.calls.length,count);assert.equal(f.state.disclosure,false);
});
test('listener registration failures release the sole deadline and cannot navigate again',async()=>{
  const f=fixture();f.chrome.tabs.onRemoved.addListener=()=>{throw Error('unavailable');};const result=await f.background.dispatch(message(),sender,f.chrome);assert.equal(result.status,'unknown');assert.equal(f.updated.size,0);assert.equal(f.timers.size,0);assert.equal(f.state.disclosure,false);
});
