'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const Background=require('../extension/background.js');
const PRIVACY='https://www.smartbackgroundchecks.com/privacy',ENTRY='https://www.smartbackgroundchecks.com/optout',FORM='https://www.smartbackgroundchecks.com/remove';
const payload=()=>({type:'erase-me',action:'run',routeId:'smartbackgroundchecks',operationId:'a'.repeat(32),fields:{first_name:'Example',last_name:'Person',email:'person@example.test'},authorized:true,ownRequestConfirmed:true});
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:123}};
function fixture(){
  const records={},calls=[],headings=[{textContent:'Privacy Notice',getClientRects:()=>[{}]}],links=[{textContent:'Opt-Out Form',href:ENTRY,getClientRects:()=>[{}]}];
  const state={url:PRIVACY,permission:true,saveFails:false,documentId:'privacy-document',canonical:FORM,headingCount:1,files:false,disclosure:false};
  const page={location:{href:PRIVACY},document:{title:'Privacy Notice',querySelector(selector){return selector==='input[type="file"]'&&state.files?{}:null;},querySelectorAll(selector){return selector==='h1'?headings:selector==='a[href]'?links:[];}},getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})};
  const chrome={storage:{local:{async get(key){return{[key]:records[key]};},async set(value){if(state.saveFails)throw Error();Object.assign(records,JSON.parse(JSON.stringify(value)));calls.push('save');}}},permissions:{async contains(){return state.permission;}},tabs:{
    async create(value){assert.equal(records['operation:'+payload().operationId].result.status,'unknown');assert.equal(value.url,PRIVACY);calls.push('open-privacy');return{id:1,status:'complete',url:PRIVACY};},
    async get(id){return{id,status:'complete',url:state.url};},
    async update(id,value){assert.equal(id,1);assert.equal(value.url,ENTRY);assert.ok(calls.filter(c=>c==='privacy-proof').length>=2);calls.push('published-entry');state.url=state.canonical;return{id,status:'complete',url:state.url};}
  },scripting:{async executeScript(spec){
    if(spec.files){assert.equal(state.url,FORM);calls.push('install-executor');return[{documentId:'form-document'}];}
    if(!spec.args){calls.push('privacy-proof');assert.equal(JSON.stringify(spec).includes('person@example.test'),false);if(spec.target.documentIds)assert.deepEqual(spec.target.documentIds,['privacy-document']);const result=vm.runInNewContext('('+spec.func.toString()+')()',page);return[{documentId:state.documentId,result}];}
    assert.equal(calls.includes('published-entry'),true);assert.equal(state.url,FORM);assert.deepEqual(spec.target.documentIds,['form-document']);state.disclosure=true;calls.push('fill');return[{documentId:'form-document',result:{status:'prepared'}}];
  }}};
  return{chrome,records,calls,state,page,headings,links};
}
test('Smart entry verifies the published public path before any personal payload and saves no profile fields',async()=>{
  const f=fixture();assert.equal((await Background.dispatch(payload(),sender,f.chrome)).status,'prepared');
  assert.deepEqual(f.calls,['save','open-privacy','save','privacy-proof','privacy-proof','published-entry','install-executor','fill','save']);
  assert.equal(f.state.disclosure,true);assert.equal(JSON.stringify(f.records).includes('person@example.test'),false);
  await Background.dispatch(payload(),sender,f.chrome);assert.equal(f.calls.filter(c=>c==='open-privacy').length,1);assert.equal(f.calls.filter(c=>c==='fill').length,1);
});
test('Smart entry purpose, published link, document and destination changes stop before any profile disclosure',async()=>{
  for(const mutate of [f=>{f.state.url='https://other.example/privacy';},f=>{f.page.document.title='Export';},f=>{f.headings[0].textContent='Export';},f=>{f.headings.push({...f.headings[0]});},f=>{f.links[0].href='https://other.example/collect';},f=>{f.links[0].textContent='Export';},f=>{f.links.push({...f.links[0]});},f=>{f.links[0].getClientRects=()=>[];},f=>{f.state.documentId='replacement';},f=>{f.state.canonical='https://www.smartbackgroundchecks.com/remove?different=1';},f=>{f.state.files=true;}]){
    const f=fixture();mutate(f);const result=await Background.dispatch(payload(),sender,f.chrome);assert.equal(result.status,'unknown',mutate.toString());assert.equal(f.state.disclosure,false);assert.equal(f.calls.includes('fill'),false);
    await Background.dispatch(payload(),sender,f.chrome);assert.equal(f.calls.filter(c=>c==='open-privacy').length,1);
  }
});
test('Smart entry permission and durable-journal failures open no public page or form',async()=>{
  for(const mode of ['permission','storage']){const f=fixture();if(mode==='permission')f.state.permission=false;else f.state.saveFails=true;await Background.dispatch(payload(),sender,f.chrome);assert.equal(f.calls.includes('open-privacy'),false);assert.equal(f.state.disclosure,false);}
});
test('Smart entry current-document proof is rechecked and a changed document never advances to form navigation',async()=>{
  const f=fixture(),execute=f.chrome.scripting.executeScript;let proofs=0;
  f.chrome.scripting.executeScript=async spec=>{const result=await execute(spec);if(!spec.args&&!spec.files&&++proofs===2)result[0].documentId='new-document';return result;};
  await Background.dispatch(payload(),sender,f.chrome);assert.equal(f.calls.filter(c=>c==='privacy-proof').length,2);assert.equal(f.calls.includes('published-entry'),false);assert.equal(f.state.disclosure,false);
});
