'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../webapp/static/workspace-core.js');
const UI=require('../webapp/static/footprint-ui.js');
function find(element,predicate){if(predicate(element))return element;for(const child of element.children){const match=find(child,predicate);if(match)return match;}}
async function fixture(){
  const data=new Map();let sequence=0;
  const core=Core.create({storage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)},uuid:()=>String(++sequence).padStart(32,'0'),now:()=> '2026-11-05T12:00:00.000Z'});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'person@example.test',authorized:true})});
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.attributes=new Map();this.value='';this.checked=false;this.disabled=false;this._text='';}
    append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
    set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    setAttribute(key,value){this.attributes.set(key,value);}addEventListener(key,callback){this.listeners[key]=callback;}
  }
  const document={createElement:tag=>new Element(tag)},feedback=[],events=[],body=new Element('body');
  const workspace={...core,importFootprint:(...args)=>{events.push('import');return core.importFootprint(...args);},chooseFootprintItem:(...args)=>{events.push('choose');return core.chooseFootprintItem(...args);},recordFootprintProgress:(...args)=>{events.push('report');return core.recordFootprintProgress(...args);}};
  const ui=UI.create({workspace,document,onChange:()=>render(),onFeedback:message=>feedback.push(message)});
  function render(){body.children=[];body.append(ui.render(core.dashboard()));}
  const byId=id=>find(body,element=>element.id===id),button=label=>find(body,element=>element.tagName==='BUTTON'&&element.textContent===label);
  const click=async element=>{if(typeof element==='string')element=button(element);assert.ok(element);assert.equal(element.disabled,false);await element.listeners.click();};
  render();return {core,data,workspace,body,feedback,events,byId,button,click,render,text:()=>body.textContent};
}
test('planner is an explicitly local import flow with correctly labeled controls and no automatic actions',async()=>{
  const f=await fixture();assert.deepEqual(f.events,[]);assert.match(f.text(),/does not close accounts/);assert.equal(f.byId('footprint-import-file').accept.includes('.csv'),true);
  for(const id of ['footprint-format','footprint-import-list','footprint-import-file','footprint-own-list'])assert.ok(find(f.body,e=>e.tagName==='LABEL'&&e.attributes.get('for')===id));
  assert.ok(find(f.body,e=>e.tagName==='SUMMARY'&&e.textContent==='Plan other cleanup'));
  const links=[];function walk(e){if(e.href)links.push(e);for(const child of e.children)walk(child);}walk(f.body);
  assert.equal(links.length,3);assert.ok(links.every(e=>e.rel==='noopener noreferrer'&&e.target==='_blank'));
  await f.click('Import local list');assert.deepEqual(f.events,[]);assert.match(f.feedback.at(-1),/Confirm/);
});
test('reviewed import stores only the selected public list, clears draft text and starts no broker or account action',async()=>{
  const f=await fixture();f.byId('footprint-import-list').value='[{"service":"Example company","category":"company","url":"https://example.test/privacy"}]';f.byId('footprint-own-list').checked=true;
  await f.click('Import local list');assert.deepEqual(f.events,['import']);assert.equal(f.byId('footprint-import-list').value,'');assert.equal(f.byId('footprint-own-list').checked,false);
  assert.equal(f.core.dashboard().footprint.items.length,1);assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);assert.match(f.text(),/staged/);
});
test('a credential-bearing list is rejected and cleared without importing or echoing its secret',async()=>{
  const f=await fixture();f.byId('footprint-import-list').value='[{"service":"Example","password":"private-example-password"}]';f.byId('footprint-own-list').checked=true;
  await f.click('Import local list');assert.equal(f.core.dashboard().footprint.items.length,0);assert.equal(f.byId('footprint-import-list').value,'');assert.equal(f.feedback.join(' ').includes('private-example-password'),false);
});
test('account closure needs a separate clear choice and export-first exposes only export or recheck reports',async()=>{
  const f=await fixture();f.core.importFootprint('[{"service":"Example account"}]','json',{authorized:true});f.render();const id=f.core.dashboard().footprint.items[0].id,prefix='footprint-item-'+id;
  f.byId(prefix+'-choice').value='export_first';await f.click(f.byId(prefix+'-save'));assert.equal(f.core.dashboard().footprint.items[0].decision,null);assert.match(f.feedback.at(-1),/files, purchases/);
  f.byId(prefix+'-closure').checked=true;await f.click(f.byId(prefix+'-save'));
  assert.deepEqual(f.byId(prefix+'-report').children.map(e=>e.value),['export_completed','recheck_reviewed']);
  await f.click(f.byId(prefix+'-record'));assert.equal(f.core.dashboard().footprint.items[0].export_acknowledged,true);
  f.byId(prefix+'-choice').value='keep';await f.click(f.byId(prefix+'-save'));assert.equal(f.byId(prefix+'-record'),undefined);assert.match(f.text(),/Kept by your choice/);
});
test('search-result and source reports are separate and are visibly self-reported',async()=>{
  const f=await fixture();f.core.importFootprint('[{"service":"Example result","category":"search_result","url":"https://example.test/person"}]','json',{authorized:true});const id=f.core.dashboard().footprint.items[0].id;f.core.chooseFootprintItem(id,{decision:'remove',authorized:true,closureReviewed:false});f.render();const prefix='footprint-item-'+id;
  f.byId(prefix+'-report').value='search_result_removed';await f.click(f.byId(prefix+'-record'));
  const item=f.core.dashboard().footprint.items[0];assert.equal(item.reported_outcomes.search_result_removed,true);assert.equal(item.reported_outcomes.source_removed,false);assert.equal(item.deletion_verified,false);
  assert.match(f.text(),/You reported the search result removed/);assert.match(f.text(),/recorded separately/);assert.match(f.feedback.at(-1),/self-reported/);
});
test('paused plans expose no import or progress controls',async()=>{
  const f=await fixture();await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});f.render();assert.equal(f.byId('footprint-import-button'),undefined);assert.match(f.text(),/paused/);assert.deepEqual(f.events,[]);
});
test('a local file finishing after a profile change is discarded before import',async()=>{
  const f=await fixture();let release;const pending=new Promise(resolve=>{release=resolve;});const file=f.byId('footprint-import-file');file.files=[{name:'accounts.json',size:40,text:()=>pending}];
  const read=file.listeners.change();f.core.remove();await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Other Person',age:36,email:'other@example.test',authorized:true})});release('[{"service":"Private old account"}]');await read;
  assert.deepEqual(f.events,[]);assert.equal(f.core.dashboard().footprint.items.length,0);assert.match(f.feedback.at(-1),/workspace changed/);
});
test('unimported text and its review never transfer to a newly created profile',async()=>{
  const f=await fixture();const input=f.byId('footprint-import-list'),own=f.byId('footprint-own-list'),format=f.byId('footprint-format');
  input.value='service\nPrivate old account';input.listeners.input();format.value='csv';format.listeners.change();own.checked=true;own.listeners.change();f.render();
  assert.equal(f.byId('footprint-import-list').value,'service\nPrivate old account');assert.equal(f.byId('footprint-own-list').checked,true);
  f.core.remove();await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Other Person',age:36,email:'other@example.test',authorized:true})});f.render();
  assert.equal(f.byId('footprint-import-list').value,'');assert.equal(f.byId('footprint-own-list').checked,false);assert.equal(f.byId('footprint-format').value,'json');assert.equal(f.text().includes('Private old account'),false);
});
test('changing pasted content, format or a local file clears prior import review',async()=>{
  const f=await fixture(),input=f.byId('footprint-import-list'),own=f.byId('footprint-own-list'),format=f.byId('footprint-format'),file=f.byId('footprint-import-file');
  own.checked=true;own.listeners.change();input.value='[{"service":"Changed"}]';input.listeners.input();assert.equal(own.checked,false);
  own.checked=true;own.listeners.change();format.value='csv';format.listeners.change();assert.equal(own.checked,false);
  own.checked=true;own.listeners.change();file.files=[{name:'accounts.json',size:25,text:async()=>'[{"service":"New file"}]'}];await file.listeners.change();assert.equal(own.checked,false);
  await f.click('Import local list');assert.deepEqual(f.events,[]);assert.match(f.feedback.at(-1),/Confirm/);
});
test('review made while a file loads cannot approve replacement contents and stale file reads cannot replace edits',async()=>{
  const f=await fixture(),file=f.byId('footprint-import-file'),own=f.byId('footprint-own-list'),input=f.byId('footprint-import-list');let release;
  file.files=[{name:'accounts.json',size:30,text:()=>new Promise(resolve=>{release=resolve;})}];const pending=file.listeners.change();own.checked=true;own.listeners.change();release('[{"service":"File account"}]');await pending;
  assert.equal(own.checked,false);assert.equal(input.value,'[{"service":"File account"}]');
  const older=file.listeners.change();input.value='[{"service":"Newer edit"}]';input.listeners.input();release('[{"service":"Old file"}]');await older;
  assert.equal(input.value,'[{"service":"Newer edit"}]');assert.equal(f.core.dashboard().footprint.items.length,0);
});
