'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Core=require('../webapp/static/workspace-core.js');

// Synthetic browser-local profiles only. This fixture never opens a broker,
// sends a message, runs a timer or uses the real companion.
async function fixture({held=[],rendered=null,delayed=false,country='US',saveDelayed=false,batchDetail=''}={}){
  const storage=new Map();let sequence=0;
  const core=Core.create({storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},uuid:()=> (++sequence).toString(16).padStart(32,'0'),now:()=> '2026-11-05T00:00:00.000Z'});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'person@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country})});
  for(const routeId of held)core.holdRoute(routeId);
  let document;
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes=new Map();this.listeners={};this._text='';this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.open=false;}
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    set textContent(value){this._text=String(value);this.children=[];}
    get disabled(){return this._disabled;}
    set disabled(value){this._disabled=Boolean(value);if(value&&document?.activeElement===this)document.activeElement=document.body;}
    get isConnected(){let e=this;while(e){if(e===document.body)return true;e=e.parentElement;}return false;}
    append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
    replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this._text='';this.append(...children);}
    addEventListener(type,callback){this.listeners[type]=callback;}
    setAttribute(key,value){this.attributes.set(key,String(value));}
    querySelector(selector){return find(this,e=>selector==='.listing-title'?e.className==='listing-title':selector==='.listing-info'?e.className==='listing-info':false);}
    focus(){document.activeElement=this;}
    showModal(){this.open=true;find(this,e=>e.tagName==='INPUT'||e.tagName==='BUTTON')?.focus();}
    close(){this.open=false;this.listeners.close?.();}
  }
  function find(element,predicate){if(predicate(element))return element;for(const child of element.children){const match=find(child,predicate);if(match)return match;}}
  function all(element,predicate){return [...(predicate(element)?[element]:[]),...element.children.flatMap(child=>all(child,predicate))];}
  const body=new Element('body');
  document={body,activeElement:body,createElement:tag=>new Element(tag),getElementById:id=>find(body,e=>e.id===id),dispatchEvent:event=>changes.push(event.type)};
  const listing=new Element('div');listing.id='listing-items';const feedback=new Element('p');feedback.id='campaign-feedback';const toolbox=new Element('div');toolbox.id='public-tools';body.append(feedback,toolbox,listing);
  const changes=[],runCalls=[],stopCalls=[],posted=[];let complete,completeSave,saveCalls=0;
  const saving=new Promise(resolve=>{completeSave=resolve;});
  const workspace={...core,setEvidence:async(...args)=>{saveCalls++;if(saveDelayed&&saveCalls===1)await saving;return core.setEvidence(...args);}};
  const pending=new Promise(resolve=>{complete=resolve;});
  const batch={create:({onUpdate})=>{
    let running=false;
    return {isRunning:()=>running,snapshot:()=>({status:running?'running':'finished',entries:[],current:null}),stop:()=>stopCalls.push(true),run:async(previews,options)=>{
      running=true;runCalls.push({previews,options});onUpdate({status:'running',entries:previews.map(preview=>({routeId:preview.routeId,status:'queued',detail:''})),current:null});
      if(delayed)await pending;
      running=false;onUpdate({status:'finished',detail:batchDetail,entries:previews.map(preview=>({routeId:preview.routeId,status:'prepared',detail:'Synthetic fields prepared.'})),current:null});
    }};
  }};
  const context={document,EraseWorkspace:workspace,EraseFormBatch:batch,URL,Blob,CustomEvent:class{constructor(type){this.type=type;}},window:{postMessage:message=>posted.push(message)},console};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../webapp/static/workspace-ui.js'),'utf8'),context);
  function render(){listing.replaceChildren();const items=core.dashboard().items;for(const item of items){if(rendered&&!rendered.includes(item.site_id))continue;const row=new Element('article'),title=new Element('a'),info=new Element('div');title.className='listing-title';title.textContent=item.name;info.className='listing-info';info.append(title);row.append(info);listing.append(row);}context.EraseWorkspaceUI.decorate(items);context.EraseWorkspaceUI.tools();}
  render();
  const byId=id=>document.getElementById(id);
  const input=label=>find(body,e=>e.tagName==='INPUT'&&e.attributes.get('aria-label')===label);
  const button=text=>find(body,e=>e.tagName==='BUTTON'&&e.textContent===text);
  const click=async element=>{if(typeof element==='string')element=button(element);assert.ok(element,'Expected button exists');assert.equal(element.disabled,false,'Native disabled controls cannot be clicked');element.focus();return element.listeners.click();};
  return {core,document,body,storage,runCalls,stopCalls,posted,changes,render,byId,input,button,click,complete,completeSave,saveCalls:()=>saveCalls,text:()=>body.textContent,all:predicate=>all(body,predicate),dialog:()=>byId('form-batch-dialog')};
}

test('batch review opens only on demand, discloses exact effective email, and sends nothing without approval',async()=>{
  const ui=await fixture();assert.equal(ui.dialog(),undefined);assert.deepEqual(ui.runCalls,[]);
  await ui.click('Review form batch');
  assert.equal(ui.dialog().open,true);assert.equal(ui.byId('form-batch-approval').checked,false);
  assert.ok(ui.text().includes('person@example.test'));assert.ok(ui.text().includes('Official form: https://privacy.peopledatalabs.com/'));
  assert.ok(ui.text().includes('Needs detail: Provide Your first name'));
  await ui.click('Fill selected forms');assert.equal(ui.runCalls.length,0);assert.deepEqual(ui.posted,[]);
  assert.match(ui.byId('form-batch-dialog').textContent,/authorize this batch first/);
});

test('held and already-started forms are excluded without saving or clearing their state',async()=>{
  const ui=await fixture({held:['usphonebook']});ui.core.prepare('peopledatalabs-form');
  const before=ui.core.snapshot().items.usphonebook;
  await ui.click('Review form batch');
  assert.equal(ui.input('Include USPhonebook in this form batch'),undefined);
  assert.equal(ui.input('Include People Data Labs in this form batch'),undefined);
  assert.ok(ui.text().includes('On hold. This route is excluded'));
  assert.ok(ui.text().includes('Already started. Check the existing broker result'));
  assert.deepEqual(ui.core.snapshot().items.usphonebook,before);assert.equal(ui.byId('form-batch-start').disabled,true);
});

test('review captures typed visible fields and route affirmations, never guesses missing names',async()=>{
  const ui=await fixture();
  assert.equal(ui.input('FastPeopleSearch Your first name').value,'');
  ui.input('FastPeopleSearch Your first name').value='Explicit';ui.input('FastPeopleSearch Your last name').value='Name';
  const apolloEmail=ui.input('Apollo Business email associated with your Apollo record');apolloEmail.value='own-record@example.test';
  ui.input('Apollo This is the business email associated with my own Apollo record, and I authorize using it for removal.').checked=true;
  await ui.click('Review form batch');
  assert.equal(ui.input('Include FastPeopleSearch in this form batch').checked,true);
  assert.equal(ui.input('Include Apollo in this form batch').checked,true);
  assert.deepEqual(ui.core.snapshot().items.fastpeoplesearch.fields,{first_name:'Explicit',last_name:'Name'});
  assert.ok(ui.text().includes('own-record@example.test'));assert.equal(ui.input('Include USPhonebook in this form batch'),undefined);
  assert.deepEqual(ui.runCalls,[]);assert.deepEqual(ui.posted,[]);
});

test('one batch approval includes only selected exact snapshots and is cleared after execution',async()=>{
  const ui=await fixture();ui.input('FastPeopleSearch Your first name').value='Explicit';ui.input('FastPeopleSearch Your last name').value='Name';
  await ui.click('Review form batch');
  const choice=ui.input('Include FastPeopleSearch in this form batch');choice.checked=false;choice.listeners.change();
  assert.equal(ui.byId('form-batch-approval').checked,false);
  ui.byId('form-batch-approval').checked=true;await ui.click('Fill selected forms');
  assert.equal(ui.runCalls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(ui.runCalls[0].options)),{authorized:true});
  assert.deepEqual(Array.from(ui.runCalls[0].previews,entry=>entry.routeId),['peopledatalabs-form']);
  assert.deepEqual(ui.runCalls[0].previews[0].fields,{email:'person@example.test'});
  assert.equal(ui.byId('form-batch-approval').checked,false);assert.equal(ui.byId('form-batch-start').disabled,true);
  assert.deepEqual(ui.changes,['erase-workspace-change']);assert.deepEqual(ui.posted,[]);
});

test('changing the selected forms invalidates a prior batch approval',async()=>{
  const ui=await fixture();await ui.click('Review form batch');ui.byId('form-batch-approval').checked=true;
  const choice=ui.input('Include People Data Labs in this form batch');choice.checked=false;choice.listeners.change();
  assert.equal(ui.byId('form-batch-approval').checked,false);assert.equal(ui.byId('form-batch-start').disabled,true);
  choice.checked=true;choice.listeners.change();assert.equal(ui.byId('form-batch-start').disabled,false);
  await ui.click('Fill selected forms');assert.deepEqual(ui.runCalls,[]);
});

test('dialog survives route rerenders, stops unstarted work on close and restores opener focus',async()=>{
  const ui=await fixture({delayed:true});await ui.click('Review form batch');const dialog=ui.dialog();
  ui.byId('form-batch-approval').checked=true;const running=ui.click('Fill selected forms');
  assert.equal(ui.button('Fill with companion').disabled,true);assert.equal(ui.byId('form-batch-stop').hidden,false);
  ui.render();assert.equal(ui.dialog(),dialog);assert.equal(ui.button('Fill with companion').disabled,true);
  await ui.click('Close review');assert.equal(dialog.open,false);assert.equal(ui.stopCalls.length,1);
  assert.equal(ui.document.activeElement.id,'review-form-batch');assert.equal(ui.byId('form-batch-approval').checked,false);
  ui.complete();await running;assert.equal(ui.byId('form-batch-start').disabled,true);assert.equal(ui.button('Fill with companion').disabled,false);
});

test('Escape requests stop and a fresh review never carries forward approval',async()=>{
  const ui=await fixture({delayed:true});await ui.click('Review form batch');ui.byId('form-batch-approval').checked=true;
  const running=ui.click('Fill selected forms');ui.dialog().listeners.cancel();ui.dialog().close();assert.ok(ui.stopCalls.length>=1);
  ui.complete();await running;await ui.click('Review form batch');assert.equal(ui.byId('form-batch-approval').checked,false);assert.equal(ui.runCalls.length,1);
});

test('filtered-out routes use saved reviewed fields and their existing identity confirmations',async()=>{
  const ui=await fixture({rendered:['peopledatalabs-form']});
  ui.core.setEvidence('apollo',{business_email:'own-record@example.test'},{business_email:true});
  await ui.click('Review form batch');assert.equal(ui.input('Include Apollo in this form batch').checked,true);
  assert.ok(ui.text().includes('own-record@example.test'));assert.deepEqual(ui.posted,[]);
});


test('a rerendered review button cannot start overlapping reviews while local fields save',async()=>{
  const ui=await fixture({saveDelayed:true});const reviewing=ui.click('Review form batch');
  assert.equal(ui.saveCalls(),1);ui.render();await ui.click('Review form batch');
  assert.equal(ui.saveCalls(),1);ui.completeSave();await reviewing;
  assert.equal(ui.dialog().open,true);assert.deepEqual(ui.runCalls,[]);
});

test('stop remains disabled after a stop request and top-level controller details are visible',async()=>{
  const ui=await fixture({delayed:true,batchDetail:'Synthetic host permission preflight message.'});
  await ui.click('Review form batch');ui.byId('form-batch-approval').checked=true;const running=ui.click('Fill selected forms');
  await ui.click('Stop after current form');assert.equal(ui.byId('form-batch-stop').disabled,true);assert.equal(ui.stopCalls.length,1);
  ui.complete();await running;assert.match(ui.text(),/Synthetic host permission preflight message/);
});

test('starting a batch moves keyboard focus to Stop and completion moves it to Close',async()=>{
  const ui=await fixture({delayed:true});await ui.click('Review form batch');ui.byId('form-batch-approval').checked=true;
  const running=ui.click('Fill selected forms');
  assert.equal(ui.document.activeElement,ui.byId('form-batch-stop'));
  assert.equal(ui.byId('form-batch-stop').hidden,false);
  ui.complete();await running;
  assert.equal(ui.document.activeElement,ui.byId('form-batch-close'));
  assert.equal(ui.dialog().open,true);
});

test('requesting Stop transfers keyboard focus to Close while Stop is disabled',async()=>{
  const ui=await fixture({delayed:true});await ui.click('Review form batch');ui.byId('form-batch-approval').checked=true;
  const running=ui.click('Fill selected forms');await ui.click('Stop after current form');
  assert.equal(ui.byId('form-batch-stop').disabled,true);
  assert.equal(ui.document.activeElement,ui.byId('form-batch-close'));
  ui.complete();await running;assert.equal(ui.document.activeElement,ui.byId('form-batch-close'));
});

test('finishing a closed batch preserves focus returned to the workspace',async()=>{
  const ui=await fixture({delayed:true});await ui.click('Review form batch');ui.byId('form-batch-approval').checked=true;
  const running=ui.click('Fill selected forms');await ui.click('Close review');
  const opener=ui.document.activeElement;assert.equal(opener.id,'review-form-batch');
  ui.complete();await running;
  assert.equal(ui.dialog().open,false);assert.equal(ui.document.activeElement,opener);
});

test('completion repairs detached review focus while preserving an intentional valid focus target',async()=>{
  const ui=await fixture({delayed:true});await ui.click('Review form batch');ui.byId('form-batch-approval').checked=true;
  const running=ui.click('Fill selected forms');
  const extra=ui.document.createElement('button');extra.type='button';extra.textContent='Synthetic dialog action';ui.dialog().append(extra);extra.focus();
  ui.complete();await running;
  assert.equal(ui.document.activeElement,extra);

  const other=await fixture({delayed:true});await other.click('Review form batch');other.byId('form-batch-approval').checked=true;
  const pending=other.click('Fill selected forms');
  // A summary is keyboard focusable, then the completed review removes it.
  const summary=other.all(e=>e.tagName==='SUMMARY'&&e.textContent.includes('forms needing attention'))[0];summary.focus();
  other.complete();await pending;
  assert.equal(other.document.activeElement,other.byId('form-batch-close'));
});
