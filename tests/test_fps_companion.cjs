'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Executor=require('../extension/broker-executor.js');
global.getComputedStyle=e=>e.style||{display:'block',visibility:'visible',opacity:'1'};
const requestId='b'.repeat(32),email='removal+erase-'+requestId+'@gmail.com';
function message(){
  const fields={first_name:'Example',last_name:'Person',email};
  return {routeId:'fastpeoplesearch',operationId:'a'.repeat(32),requestId,receiptRef:'c'.repeat(64),authorized:true,contactEmail:email,fields,
    confirmationUrl:'https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:fields.first_name,middlename:'',lastname:fields.last_name,email,ticketid:'12345678'})};
}
function page({missing=false}={}){
  const payload=message(),map=new Map(),events=[],timers=new Map(),listeners=new Map(),observers=[];
  const form={method:'post',action:'https://www.fastpeoplesearch.com/optout/removal'};
  let timerId=0,available=!missing;
  const element=(extra={})=>({hidden:false,parentElement:null,disabled:false,readOnly:false,form,getClientRects(){return this.hidden?[]:[{}];},
    dispatchEvent(){events.push('event');throw new Error('Read action must not dispatch events.');},click(){events.push('click');throw new Error('Read action must not click.');},...extra});
  const input=(value='',extra={})=>{
    const e=element({tagName:'INPUT',type:'text',...extra});
    Object.defineProperty(e,'value',{get:()=>value,set(){events.push('write');throw new Error('Read action must not write.');},configurable:true});return e;
  };
  const identity={first_name:input('Example'),last_name:input('Person'),email:input(email,{type:'email'})};
  map.set('form#optout-removal',[form]);
  map.set('input#firstname[name="firstname"][type="text"]',[identity.first_name]);
  map.set('input#lastname[name="lastname"][type="text"]',[identity.last_name]);
  map.set('input#email[name="email"][type="email"]',[identity.email]);
  const middle=input(''),ticket=input('12345678',{type:'hidden'});
  map.set('input#middlename[name="middlename"][type="text"]',[middle]);
  map.set('#optout-removal input[name="ticketid"][type="hidden"]',[ticket]);
  const shape=[['select[name="dobMonth"]','SELECT'],['select[name="dobDay"]','SELECT'],['select[name="dobYear"]','SELECT'],
    ['input#streetAddress[name="streetAddress"][type="text"]','INPUT'],['input#city[name="city"][type="text"]','INPUT'],['select#state[name="state"]','SELECT'],
    ['input#zipcode[name="zipcode"][type="text"]','INPUT'],['input#phone[name="phone"][type="text"]','INPUT'],['#optout-removal input[name="legal"][type="checkbox"]','INPUT']];
  for(const [selector,tagName]of shape){
    const e=element({tagName});
    Object.defineProperty(e,'value',{get(){throw new Error('The read action must not read additional personal values.');},set(){events.push('write');throw new Error('Read action must not write.');}});
    map.set(selector,[e]);
  }
  const token=element({tagName:'INPUT',type:'hidden'}),widget=element({tagName:'DIV'}),button=element({tagName:'BUTTON',type:'submit',textContent:'Submit'});
  Object.defineProperty(token,'value',{get(){throw new Error('The read action must not read the vendor token.');}});
  map.set('#optout-removal input[name="cf-turnstile-response"][type="hidden"]',[token]);map.set('#optout-removal .cf-turnstile',[widget]);
  form.querySelectorAll=selector=>selector==='button[type="submit"],input[type="submit"]'?[button]:[];
  const doc={querySelectorAll:selector=>available?map.get(selector)||[]:[],querySelector(selector){return this.querySelectorAll(selector)[0]||null;}};
  const env={document:doc,location:{href:payload.confirmationUrl},
    setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);},
    MutationObserver:class{constructor(callback){this.callback=callback;this.connected=false;observers.push(this);}observe(target,options){assert.equal(target,doc);this.connected=true;this.options=options;}disconnect(){this.connected=false;}}
  };
  return {payload,map,form,doc,env,events,timers,listeners,observers,identity,middle,ticket,button,
    show:()=>{available=true;},mutate:()=>observers.filter(o=>o.connected).forEach(o=>o.callback()),deadline:()=>[...timers.values()][0].callback(),
    replaceValue:(node,value)=>Object.defineProperty(node,'value',{get:()=>value,configurable:true})};
}

test('FPS confirmation validates only the exact matching-form link and approved identity',()=>{
  const p=message();
  assert.equal(Executor.continuationURL(p.confirmationUrl,'fastpeoplesearch',p.fields),true);
  assert.equal(Executor.continuationURL(p.confirmationUrl),false);
  assert.deepEqual(Executor.validateContinuation(p),{host:'www.fastpeoplesearch.com',path:'/optout/removal',url:p.confirmationUrl});
  const accent={...p,fields:{...p.fields,first_name:'Örnek'}};
  const u=new URL(p.confirmationUrl);u.searchParams.set('firstname','Örnek');accent.confirmationUrl=u.href;
  assert.doesNotThrow(()=>Executor.validateContinuation(accent));
});

test('FPS confirmation rejects ambiguous, unrelated, encoded, invalid and extra destinations',()=>{
  const original=message().confirmationUrl;
  const bad=[original+'&ticketid=9',original+'&purpose=export',original.replace('middlename=&',''),original.replace('middlename=&','middlename=Other&'),
    original.replace('firstname=Example','firstname='),original.replace('firstname=Example','firstname=%20Example'),original.replace('lastname=Person','lastname=Person%20'),
    original.replace('firstname=Example','firstname=%FF'),original.replace('firstname=Example','firstname=%ZZ'),original.replace('firstname=Example','firstname=Example%0A'),
    original.replace('firstname=Example','firstname=%3Cscript%3E'),original.replace('ticketid=12345678','ticketid=1x'),original.replace('ticketid=12345678','ticketid='+'9'.repeat(33)),
    original.replace('https:','http:'),original.replace('www.fastpeoplesearch.com','www.fastpeoplesearch.com.evil.test'),original.replace('www.fastpeoplesearch.com','user@www.fastpeoplesearch.com'),
    original.replace('www.fastpeoplesearch.com','www.fastpeoplesearch.com:443'),original.replace('/optout/removal','/optout/%72emoval'),original.replace('/optout/removal','/optout/other/../removal'),
    original.replace('/optout/removal','/login'),original.replace('/optout/removal','/optout\\removal'),original+'#complete',original.replace('email=','email=bad%0D%0A')];
  for(const url of bad)assert.equal(Executor.continuationURL(url,'fastpeoplesearch'),false,url);
});

test('FPS continuation requires exact three-field approval and operation contact binding',()=>{
  const p=message();
  for(const extra of [{authorized:false},{routeId:'spokeo'},{operationId:'invalid'},{requestId:'d'.repeat(32)},{receiptRef:'x'},
    {fields:{...p.fields,first_name:'Different'}},{fields:{...p.fields,last_name:'Different'}},{fields:{...p.fields,email:'other@example.test'}},
    {contactEmail:'other@example.test'},{fields:{...p.fields,city:'Example City'}},{fields:[p.fields]}])assert.throws(()=>Executor.validateContinuation({...p,...extra}));
});

test('FPS matching-form continuation only reads the reviewed original identity; all other personal fields and controls stay untouched',async()=>{
  const p=page(),result=await Executor.executeContinuation(p.payload,p.env);
  assert.equal(result.status,'prepared');assert.match(result.detail,/No fields were changed or submitted/);assert.match(result.detail,/acceptance and deletion remain unverified/);
  assert.deepEqual(p.events,[]);assert.equal(p.timers.size,0);assert.equal(p.observers.length,0);
  const response=JSON.stringify(result);for(const value of [email,'Example','12345678','ticketid='])assert.equal(response.includes(value),false);
});

test('FPS changed form destination, identity controls, hidden ticket and extra identity upload are blocked without writes',async()=>{
  const changes=[p=>{p.form.action+='?purpose=export';},p=>{p.form.method='get';},p=>{p.map.get('form#optout-removal').push(p.form);},
    p=>{p.replaceValue(p.identity.first_name,'Other');},p=>{p.replaceValue(p.identity.last_name,'Other');},p=>{p.replaceValue(p.identity.email,'other@example.test');},
    p=>{p.identity.email.form={};},p=>{p.identity.first_name.disabled=true;},p=>{p.identity.last_name.readOnly=true;},p=>{p.identity.email.hidden=true;},
    p=>{p.replaceValue(p.middle,'Middle');},p=>{p.replaceValue(p.ticket,'9876');},p=>{p.ticket.form={};},
    p=>{p.map.set('input[type="file"]',[{}]);},p=>{p.button.textContent='Export';},p=>{p.button.disabled=true;},
    p=>{p.map.delete('select[name="dobDay"]');},p=>{p.map.delete('#optout-removal .cf-turnstile');},p=>{p.map.get('#optout-removal input[name="cf-turnstile-response"][type="hidden"]')[0].form={};}];
  for(const change of changes){const p=page();change(p);assert.equal((await Executor.executeContinuation(p.payload,p.env)).status,'blocked');assert.deepEqual(p.events,[]);}
});

test('FPS continuation holds an unexpected document or URL before inspecting fields',async()=>{
  for(const change of [p=>{p.env.location.href+='&purpose=export';},p=>{p.env.location.href=p.env.location.href.replace('/optout/removal','/login');},p=>{p.env.document={querySelector(){throw new Error('Must not inspect other document');}};}]){
    const p=page();change(p);assert.equal((await Executor.executeContinuation(p.payload,p.env)).status,'blocked');assert.deepEqual(p.events,[]);
  }
});

test('FPS late reviewed form uses one bounded DOM wait and cleans all observation when ready',async()=>{
  const p=page({missing:true}),run=Executor.executeContinuation(p.payload,p.env);
  assert.equal(p.timers.size,1);assert.equal([...p.timers.values()][0].delay,10000);assert.equal(p.observers.length,1);assert.equal(p.listeners.has('pagehide'),true);
  p.show();p.mutate();assert.equal((await run).status,'prepared');assert.equal(p.timers.size,0);assert.equal(p.observers[0].connected,false);assert.equal(p.listeners.size,0);assert.deepEqual(p.events,[]);
});

test('FPS waiting form cannot follow navigation, changed approval or another document',async()=>{
  for(const change of [p=>{p.env.location.href+='&purpose=export';},p=>{p.payload.fields.first_name='Changed';},p=>{p.env.document={};}]){
    const p=page({missing:true}),run=Executor.executeContinuation(p.payload,p.env);change(p);p.show();p.mutate();
    assert.equal((await run).status,'blocked');assert.equal(p.timers.size,0);assert.equal(p.listeners.size,0);assert.equal(p.observers[0].connected,false);assert.deepEqual(p.events,[]);
  }
});

test('FPS missing form deadline or page departure stops once and cleans every observer',async()=>{
  for(const end of [p=>p.deadline(),p=>p.listeners.get('pagehide')()]){
    const p=page({missing:true}),run=Executor.executeContinuation(p.payload,p.env);end(p);assert.equal((await run).status,'blocked');
    assert.equal(p.timers.size,0);assert.equal(p.listeners.size,0);assert.equal(p.observers[0].connected,false);p.show();p.mutate();assert.deepEqual(p.events,[]);
  }
});
