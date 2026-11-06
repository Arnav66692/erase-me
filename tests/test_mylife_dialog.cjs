'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../webapp/static/workspace-core.js'),Dialog=require('../webapp/static/mylife-dialog.js'),Details=require('../extension/mylife-details.js');
function gate(){let resolve;return{promise:new Promise(done=>{resolve=done;}),release:()=>resolve()};}
async function fixture(){
  const storage=new Map();let sequence=0,fail=false;
  const core=Core.create({storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(fail)throw Error();storage.set(key,value);},removeItem:key=>storage.delete(key)},uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=> '2026-11-05T00:00:00.000Z'});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'person@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',city:'Profile City'})});
  let document;
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.listeners=new Map();this.attributes=new Map();this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.open=false;this._text='';}
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    set textContent(value){this._text=String(value);this.replaceChildren();}
    append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
    replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
    addEventListener(type,callback){this.listeners.set(type,callback);}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    get isConnected(){for(let node=this;node;node=node.parentElement)if(node===document.body)return true;return false;}
    focus(){document.activeElement=this;}
    showModal(){this.open=true;}
    close(){this.open=false;this.listeners.get('close')?.();}
  }
  const find=(element,id)=>{if(element.id===id)return element;for(const child of element.children){const value=find(child,id);if(value)return value;}};
  const body=new Element('body');document={body,activeElement:body,createElement:tag=>new Element(tag),getElementById:id=>find(body,id)};
  const opener=new Element('button');body.append(opener);const calls=[];let pingGate=null,prepareGate=null,capable=true;
  const workspace={...core,async prepareMyLife(...args){const result=core.prepareMyLife(...args);if(prepareGate)await prepareGate.promise;return result;}};
  const companion=async payload=>{
    calls.push(JSON.parse(JSON.stringify(payload)));
    if(payload.action==='ping'){if(pingGate)await pingGate.promise;return{routes:[Details.ROUTE],capabilities:capable?['mylife-prefill-v1']:[]};}
    assert.equal(payload.action,'fill-mylife');assert.equal(core.snapshot().items[Details.ROUTE].operation_id,payload.operationId);
    for(const key of ['first_name','last_name','state','city','zip_code','birth_year'])assert.equal(document.getElementById('mylife-'+key).value,'');
    assert.equal(document.getElementById('mylife-disclosure').textContent.includes('birth_year'),false);
    return{status:'prepared'};
  };
  const dialog=Dialog.create({workspace,companion,document}),byId=id=>document.getElementById('mylife-'+id);
  const fire=(id,type='click')=>byId(id).listeners.get(type)?.({preventDefault(){}});
  const enter=(id,value)=>{byId(id).value=value;byId(id).listeners.get('input')?.();};
  const review=()=>{for(const[key,value]of Object.entries({first_name:'Example',last_name:'Person',state:'California',city:'Example City',zip_code:'90210',birth_year:'1990'}))enter(key,value);fire('details-form','submit');};
  const approve=()=>{byId('approval').checked=true;fire('approval','change');};
  return{core,storage,dialog,document,opener,calls,byId,fire,enter,review,approve,fail:()=>{fail=true;},noCapability:()=>{capable=false;},delayPing:()=>pingGate=gate(),delayPrepare:()=>prepareGate=gate()};
}
test('dialog opens without network or storage of extra details, requires fresh exact-field review and approval',async()=>{
  const f=await fixture();await f.dialog.open(f.opener,f.core.profile().id);assert.deepEqual(f.calls,[]);assert.equal(f.byId('approval').checked,false);
  f.review();assert.equal(f.byId('disclosure').hidden,false);assert.equal(f.byId('fill').disabled,true);assert.match(f.byId('disclosure').textContent,/mylife.jotform.com/);
  f.approve();assert.equal(f.byId('fill').disabled,false);f.enter('city','Changed City');assert.equal(f.byId('disclosure').hidden,true);assert.equal(f.byId('approval').checked,false);
  assert.equal(f.core.exportData().includes('Changed City'),false);
});
test('one approved fill clears sensitive UI copies before dispatch and never reports submission or deletion',async()=>{
  const f=await fixture();await f.dialog.open(f.opener,f.core.profile().id);f.review();f.approve();await f.fire('fill');
  assert.deepEqual(f.calls.map(x=>x.action),['ping','fill-mylife']);assert.match(f.byId('status').textContent,/No accepted request or deletion/);
  assert.equal(f.core.exportData().includes('birth_year'),false);assert.equal(f.core.dashboard().counts.removed,0);
  assert.equal(f.core.snapshot().items[Details.ROUTE].status,'needs_broker_step');
});
test('closing review clears fields and no unapproved fill or capability downgrade can dispatch',async()=>{
  const f=await fixture();await f.dialog.open(f.opener,f.core.profile().id);f.review();await f.fire('fill');assert.deepEqual(f.calls,[]);f.fire('close');assert.equal(f.byId('birth_year').value,'');
  await f.dialog.open(f.opener,f.core.profile().id);f.review();f.approve();f.noCapability();await f.fire('fill');assert.deepEqual(f.calls.map(x=>x.action),['ping']);assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,null);
});
test('close or hold while companion preflight is pending prevents private dispatch and reservation',async()=>{
  for(const hold of [false,true]){
    const f=await fixture();await f.dialog.open(f.opener,f.core.profile().id);f.review();f.approve();const gate=f.delayPing(),pending=f.fire('fill');await Promise.resolve();
    if(hold)f.core.holdRoute(Details.ROUTE);else f.fire('close');gate.release();await pending;
    assert.deepEqual(f.calls.map(x=>x.action),['ping']);assert.equal(f.core.snapshot().items[Details.ROUTE].operation_id,null);
  }
});
test('close, hold, pause or profile replacement after reservation but before dispatch sends no private fields',async()=>{
  for(const mode of ['close','hold','pause','replace']){
    const f=await fixture();await f.dialog.open(f.opener,f.core.profile().id);f.review();f.approve();const gate=f.delayPrepare(),pending=f.fire('fill');
    for(let i=0;i<4;i++)await Promise.resolve();assert.ok(f.core.snapshot().items[Details.ROUTE].operation_id);
    if(mode==='close')f.fire('close');else if(mode==='hold')f.core.holdRoute(Details.ROUTE);else if(mode==='pause')await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});else{f.core.remove();await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Replacement Person',age:36,email:'other@example.test',authorized:true})});}
    gate.release();await pending;assert.deepEqual(f.calls.map(x=>x.action),['ping'],mode);assert.equal(f.byId('birth_year').value,'');
    if(mode==='replace')assert.equal(f.core.profile().name,'Replacement Person');
  }
});
test('storage failure and stale opener/profile review prevent dispatch',async()=>{
  const f=await fixture();await assert.rejects(f.dialog.open(f.opener,'f'.repeat(32)));assert.equal(f.byId('details-dialog').open,false);
  await f.dialog.open(f.opener,f.core.profile().id);f.review();f.approve();f.fail();await f.fire('fill');assert.deepEqual(f.calls.map(x=>x.action),['ping']);
});
