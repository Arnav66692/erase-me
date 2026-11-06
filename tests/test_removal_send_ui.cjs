'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const Core=require('../webapp/static/workspace-core.js');
const Contract=require('../extension/send-contract.js');
function gate(){let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}
async function fixture({reserve=false,held=false,revoked=false,holdGate=null,afterHold=null,revokeStatus='revoked'}={}){
  const storage=new Map();let sequence=0;const now='2026-11-05T00:00:00.000Z';
  const core=Core.create({storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=>now,crypto:crypto.webcrypto});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'person@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'CA',city:'Example City'})});
  if(reserve)await core.beginMailSendPreview('ca-411','https://411.ca/example',{own_request:true,profileId:core.profile().id});
  if(revoked){const context=core.mailSendClosureContext('ca-411',core.profile().id),closure=await core.reserveMailSendClosure(context,null,{discard_issued:false});core.recordMailSendClosure(context,closure.closureId,{status:'revoked',route_id:'ca-411',operation_id:context.operationId,request_id:null,automatic_execution:false,delivery_verified:false,acceptance_verified:false,deletion_verified:false});}
  if(held)core.holdRoute('ca-411');
  const calls=[],changes=[],deadlines=[],posted=[];let document;
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.attributes=new Map();this._text='';this.value='';this.disabled=false;this.checked=false;this.hidden=false;}
    get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}set textContent(v){this._text=String(v);this.children=[];}
    append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
    replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
    addEventListener(type,callback){this.listeners[type]=callback;}
    setAttribute(k,v){this.attributes.set(k,String(v));}
    querySelector(selector){return find(this,e=>selector==='.listing-title'?e.className==='listing-title':selector==='.listing-info'?e.className==='listing-info':selector==='summary'?e.tagName==='SUMMARY':false);}
    focus(){document.activeElement=this;}
  }
  function find(el,predicate){if(predicate(el))return el;for(const child of el.children){const found=find(child,predicate);if(found)return found;}}
  const body=new Element('body'),list=new Element('div'),feedback=new Element('p');list.id='listing-items';feedback.id='campaign-feedback';body.append(list,feedback);
  document={body,activeElement:body,createElement:tag=>new Element(tag),getElementById:id=>find(body,e=>e.id===id),dispatchEvent:event=>changes.push(event.type)};
  const workspace={...core,holdRoute:async(...args)=>{calls.push({action:'hold-start'});if(holdGate)await holdGate.promise;const result=core.holdRoute(...args);calls.push({action:'hold-committed',result});if(afterHold)await afterHold(core,result);return result;}};
  const send={ROUTES:Contract.ROUTES,create:config=>{calls.push({action:'client',profileId:config.profileId});return{result:async id=>{calls.push({action:'result',id,profileId:config.profileId});return{status:'provider_accepted'};},revokeRoute:async(id,minimal)=>{calls.push({action:'revoke',id,minimal,profileId:config.profileId});return{status:revokeStatus};}};}};
  let dialogConfig;const listeners=new Map();const window={addEventListener:(type,cb)=>listeners.set(type,cb),removeEventListener:type=>listeners.delete(type),postMessage:message=>{posted.push(message.payload);queueMicrotask(()=>listeners.get('message')?.({source:window,origin:'https://erase-me-preview.vercel.app',data:{source:'erase-companion',requestId:message.requestId,reply:{ok:true,result:{status:'revoked'}}}}));}};
  const context={document,EraseWorkspace:workspace,EraseRemovalSend:send,EraseRemovalSendDialog:{create:config=>{dialogConfig=config;return{open:async(...args)=>calls.push({action:'open',args})};}},window,location:{origin:'https://erase-me-preview.vercel.app'},crypto:{randomUUID:()=>crypto.randomUUID()},setTimeout:(_cb,delay)=>{deadlines.push(delay);return 1;},clearTimeout(){},CustomEvent:class{constructor(type){this.type=type;}},URL,Blob};
  vm.runInNewContext(fs.readFileSync(require.resolve('../webapp/static/workspace-ui.js'),'utf8'),context);
  const render=()=>{list.replaceChildren();const items=core.dashboard().items;for(const item of items){const row=new Element('article'),info=new Element('div'),title=new Element('a');info.className='listing-info';title.className='listing-title';title.textContent=item.name;info.append(title);row.append(info);list.append(row);}context.EraseWorkspaceUI.decorate(items);};render();
  const byId=id=>document.getElementById(id),button=label=>find(body,e=>e.tagName==='BUTTON'&&e.textContent===label),click=async el=>{if(typeof el==='string')el=button(el);assert.ok(el);assert.equal(el.disabled,false);return el.listeners.click();};
  return{core,calls,changes,deadlines,posted,byId,button,click,render,feedback,dialogConfig:()=>dialogConfig};
}

test('render prepares no mail or grant and only an exact supported privacy channel gets send review',async()=>{
  const f=await fixture();assert.equal(f.calls.length,0);assert.equal(f.posted.length,0);assert.ok(f.byId('review-removal-email-ca-411'));assert.equal(f.byId('review-removal-email-ca-vodafone'),undefined);assert.ok(f.button('Prepare private request'));assert.ok(f.feedback.textContent==='');
});
test('review opens a current profile-scoped modal without sending or preparing provider data',async()=>{
  const f=await fixture(),id=f.core.profile().id;await f.click(f.byId('review-removal-email-ca-411'));assert.deepEqual(f.calls.map(c=>c.action),['open']);assert.equal(f.calls[0].args[0],'ca-411');assert.equal(f.calls[0].args[1],id);assert.equal(f.posted.length,0);assert.equal(f.core.snapshot().items['ca-411'].operation_id,null);
});
test('reviewed sender native transport keeps its full 35 second foreground deadline',async()=>{
  const f=await fixture();await f.click(f.byId('review-removal-email-ca-411'));await f.dialogConfig().companion({action:'local-send',request:{action:'send-status'}});assert.equal(f.deadlines.at(-1),35000);assert.equal(f.posted[0].action,'local-send');
});
test('reserved email uses its dedicated result and never exposes generic companion replay or broker observation',async()=>{
  const f=await fixture({reserve:true});assert.equal(f.byId('review-removal-email-ca-411'),undefined);assert.equal(f.button('Read companion result'),undefined);assert.equal(f.button('Check existing broker tab'),undefined);assert.ok(f.byId('read-email-result-ca-411'));await f.click(f.byId('read-email-result-ca-411'));assert.equal(f.calls.at(-1).action,'result');assert.match(f.feedback.textContent,/Delivery, broker acceptance and deletion remain unverified/);assert.equal(f.posted.length,0);
});
test('held routes permit only dedicated result and cleanup, never a new email review',async()=>{
  const f=await fixture({reserve:true,held:true});assert.equal(f.byId('review-removal-email-ca-411'),undefined);assert.ok(f.byId('read-email-result-ca-411'));assert.ok(f.byId('cancel-email-draft-ca-411'));assert.equal(f.byId('reset-email-draft-ca-411'),undefined);
});
test('holding commits local closure before requesting native draft revocation',async()=>{
  const f=await fixture({reserve:true}),original=f.core.profile().id;await f.click(f.byId('hold-route-ca-411'));const relevant=f.calls.filter(c=>['hold-committed','revoke'].includes(c.action));assert.deepEqual(relevant.map(c=>c.action),['hold-committed','revoke']);assert.equal(relevant[0].result.items.find(i=>i.site_id==='ca-411').mail_send.closed,true);assert.equal(relevant[1].minimal.profileId,original);assert.equal(f.core.snapshot().items['ca-411'].held,true);
});
test('a queued hold discovers an email reserved while waiting and revokes its original scope after profile replacement',async()=>{
  const wait=gate(),f=await fixture({holdGate:wait,afterHold:async core=>{core.remove();return core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Other Person',age:40,email:'other@example.test',authorized:true})});}});const original=f.core.profile().id,pending=f.click(f.byId('hold-route-ca-411'));await f.core.beginMailSendPreview('ca-411','https://411.ca/example',{own_request:true,profileId:original});const op=f.core.snapshot().items['ca-411'].operation_id;wait.resolve();await pending;const revoke=f.calls.find(c=>c.action==='revoke');assert.ok(revoke);assert.equal(revoke.profileId,original);assert.equal(revoke.minimal.profileId,original);assert.equal(revoke.minimal.operationId,op);assert.notEqual(f.core.profile().id,original);assert.equal(Object.values(f.core.snapshot().items).some(item=>item.operation_id),false);
});
test('unconfirmed draft revocation leaves the durable hold and never offers automatic retry',async()=>{
  const f=await fixture({reserve:true,revokeStatus:'unknown'});await f.click(f.byId('hold-route-ca-411'));assert.equal(f.core.snapshot().items['ca-411'].held,true);assert.match(f.feedback.textContent,/could not be confirmed canceled/);assert.equal(f.calls.filter(c=>c.action==='revoke').length,1);assert.equal(f.posted.length,0);
});
test('a stale hold cannot mutate or revoke the replacement workspace',async()=>{
  const f=await fixture({reserve:true}),button=f.byId('hold-route-ca-411');f.core.remove();await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Other Person',age:40,email:'other@example.test',authorized:true})});await f.click(button);assert.equal(f.calls.length,0);assert.match(f.feedback.textContent,/workspace changed/);assert.equal(Object.values(f.core.snapshot().items).some(item=>item.held),false);
});
test('only confirmed revoked and unsent drafts expose the explicit reset action',async()=>{
  const f=await fixture({reserve:true,revoked:true}),old=f.core.snapshot().items['ca-411'].id;assert.ok(f.byId('reset-email-draft-ca-411'));await f.click(f.byId('reset-email-draft-ca-411'));assert.equal(f.core.snapshot().items['ca-411'].operation_id,null);assert.notEqual(f.core.snapshot().items['ca-411'].id,old);assert.equal(f.calls.length,0);assert.match(f.feedback.textContent,/explicitly reset/);
});
