'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../webapp/static/workspace-core.js');
const Dialog=require('../webapp/static/identity-dialog.js');
const fullRequirements={date_of_birth:true,street_address:true,phone:true,no_validate:false,submit_no_validate:false};
function gate(){let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}
async function fixture({requirements=fullRequirements,probeUnavailable=false,delayedProbe=false,delayedSubmitPing=false,result,capability=true,legacyCapability=false}={}){
  const storage=new Map();let sequence=0;
  const core=Core.create({storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=> '2026-11-05T00:00:00.000Z'});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'profile@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',region:'CA',city:'Example City'})});
  core.holdRoute('usphonebook');core.setEvidence('fastpeoplesearch',{first_name:'Example',last_name:'Person'});
  const request=core.mailSessionRequest('fastpeoplesearch'),request_id='b'.repeat(32),issued_at=1793836800,expires_at=issued_at+7*86400,email='removal+erase-'+request_id+'@gmail.com';
  const claims={v:1,route_id:'fastpeoplesearch',operation_id:request.operation_id,request_id,recipient:email,issued_at,expires_at};
  core.bindMailContact('fastpeoplesearch',{status:'ready',route_id:'fastpeoplesearch',operation_id:request.operation_id,request_id,contact_email:email,expires_at,automatic_execution:false,capability:Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43)});
  const initial=core.prepare('fastpeoplesearch');core.recordCompanion('fastpeoplesearch',initial.operationId,{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'});
  const receipt={status:'held',route_id:'fastpeoplesearch',operation_id:initial.operationId,request_id,reason:'route_validation_required',received_at:issued_at+1,receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:true};
  core.recordMailReceipt('fastpeoplesearch',receipt);core.mailContinuationRequest('fastpeoplesearch',{});
  const url='https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email,ticketid:'12345678'});
  core.prepareMailContinuation('fastpeoplesearch',{status:'confirmation_ready',route_id:'fastpeoplesearch',operation_id:initial.operationId,request_id,receipt_ref:receipt.receipt_ref,confirmation_url:url,automatic_execution:false},{});
  core.recordMailContinuation('fastpeoplesearch',initial.operationId,{status:'prepared'});
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
  const opener=new Element('button');opener.id='opener';body.append(opener);
  const calls=[],feedback=[],changes=[],probeGate=gate(),pingGate=gate();let pings=0;
  const companion=async payload=>{
    calls.push(JSON.parse(JSON.stringify(payload)));
    if(payload.action==='ping'){
      if(++pings===2&&delayedSubmitPing)await pingGate.promise;
      return{routes:['fastpeoplesearch'],capabilities:capability?['identity-submit-v1','identity-requirements-v1',...(legacyCapability?[]:['identity-submit-v2'])]:[]};
    }
    if(payload.action==='identity-requirements'){
      if(delayedProbe)await probeGate.promise;
      return probeUnavailable?{status:'unavailable'}:{status:'ready',routeId:'fastpeoplesearch',operationId:initial.operationId,requirements};
    }
    assert.equal(payload.action,'submit-details');
    assert.equal(core.snapshot().items.fastpeoplesearch.final_submission.id,payload.submissionId);
    for(const id of ['birth','street','phone','city','state','zip'])assert.equal(document.getElementById('identity-details-'+id).value,'','Inputs must clear before the companion receives details');
    assert.equal(document.getElementById('identity-details-disclosure').textContent.includes('1991-02-28'),false);
    return result||{status:'submission_attempted',attempt_verified:true,stage:'final_request_submission'};
  };
  const dialog=Dialog.create({workspace:core,companion,document,onChange:()=>changes.push(true),onFeedback:message=>feedback.push(message)});
  const byId=id=>document.getElementById('identity-details-'+id);
  const fire=async(id,type='click')=>{const e=byId(id);assert.ok(e);return e.listeners.get(type)?.({preventDefault(){}});};
  const enter=(id,value)=>{byId(id).value=value;byId(id).listeners.get('input')?.();};
  const method=value=>{byId('method').value=value;byId('method').listeners.get('change')?.();};
  const fill=()=>{method('full_matching_details');enter('birth','1991-02-28');enter('street','123 One Action Way');enter('phone','2125550100');enter('city','OneActionCity');enter('state','ny');enter('zip','10001');};
  return{core,storage,dialog,document,opener,calls,changes,feedback,byId,fire,enter,method,fill,releaseProbe:probeGate.resolve,releasePing:pingGate.resolve};
}

test('opening checks only bound requirements and explains the actual full-data conflict before collection',async()=>{
  const f=await fixture();await f.dialog.open('fastpeoplesearch',f.opener);
  assert.deepEqual(f.calls.map(call=>call.action),['ping','identity-requirements']);assert.equal(JSON.stringify(f.calls).includes('@'),false);
  assert.match(f.byId('requirements').textContent,/both and a phone number/);assert.equal(f.byId('form').hidden,false);
  assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission,undefined);
  assert.equal(f.byId('approval').checked,false);assert.equal(f.byId('birth').value,'');
});
test('an older final executor cannot collect identity values or reserve a submission',async()=>{
  const f=await fixture({legacyCapability:true});await f.dialog.open('fastpeoplesearch',f.opener);
  assert.deepEqual(f.calls.map(call=>call.action),['ping']);
  assert.match(f.byId('status').textContent,/Update/);
  assert.equal(f.byId('form').hidden,true);assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission,undefined);
  assert.equal(f.byId('birth').value,'');assert.equal(f.byId('street').value,'');assert.equal(f.byId('phone').value,'');
});

test('review displays the exact canonical fields and certification but cannot send without explicit approval',async()=>{
  const f=await fixture();await f.dialog.open('fastpeoplesearch',f.opener);f.fill();await f.fire('form','submit');
  const text=f.byId('disclosure').textContent;
  for(const value of ['1991-02-28','123 One Action Way','(212) 555-0100','OneActionCity','NY','10001','Example','Person'])assert.ok(text.includes(value));
  assert.match(text,/I certify that I am the person/);assert.equal(f.byId('approval').checked,false);assert.equal(f.byId('submit').disabled,true);
  f.byId('approval').checked=true;await f.fire('approval','change');assert.equal(f.byId('submit').disabled,false);
  f.byId('approval').checked=false;await f.fire('approval','change');assert.equal(f.byId('submit').disabled,true);
  await f.fire('submit');assert.equal(f.calls.some(call=>call.action==='submit-details'),false);assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission,undefined);
});

test('one approved action clears UI values before dispatch and leaves only references in the ledger',async()=>{
  const f=await fixture();await f.dialog.open('fastpeoplesearch',f.opener);f.fill();await f.fire('form','submit');f.byId('approval').checked=true;await f.fire('submit');
  const sent=f.calls.find(call=>call.action==='submit-details');assert.equal(sent.details.phone,'(212) 555-0100');assert.deepEqual(sent.requirements,fullRequirements);
  for(const value of ['1991-02-28','123 One Action Way','(212) 555-0100','OneActionCity','10001'])assert.equal(f.core.exportData().includes(value),false);
  assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission.attempt_verified,true);assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);
  assert.equal(f.byId('form').hidden,true);assert.match(f.byId('status').textContent,/attempted/);
  await f.fire('submit');assert.equal(f.calls.filter(call=>call.action==='submit-details').length,1);
});

test('editing any reviewed input withdraws consent, and closing discards all additional values',async()=>{
  const f=await fixture();await f.dialog.open('fastpeoplesearch',f.opener);f.fill();await f.fire('form','submit');f.byId('approval').checked=true;
  f.enter('street','456 Changed Road');assert.equal(f.byId('approval').checked,false);await f.fire('submit');assert.equal(f.calls.some(call=>call.action==='submit-details'),false);
  await f.fire('close');for(const id of ['birth','street','phone','city','state','zip'])assert.equal(f.byId(id).value,'');
  assert.equal(f.byId('disclosure').textContent.includes('Changed Road'),false);assert.equal(f.document.activeElement,f.opener);
});

test('minimal required forms do not collect the unselected identity branch or phone',async()=>{
  const requirements={...fullRequirements,street_address:false,phone:false},f=await fixture({requirements});await f.dialog.open('fastpeoplesearch',f.opener);
  f.method('date_of_birth');f.enter('birth','1991-02-28');f.enter('zip','92101');await f.fire('form','submit');
  assert.equal(f.byId('phone').parentElement.hidden,true);assert.equal(f.byId('street').parentElement.hidden,true);assert.equal(f.byId('disclosure').textContent.includes('Phone number'),false);
});

test('invalid DOB and a route held after review stop before any final reservation or disclosure',async()=>{
  const f=await fixture();await f.dialog.open('fastpeoplesearch',f.opener);f.fill();f.enter('birth','2020-01-01');await f.fire('form','submit');assert.equal(f.byId('disclosure').hidden,true);
  f.enter('birth','1991-02-28');await f.fire('form','submit');f.byId('approval').checked=true;f.core.holdRoute('fastpeoplesearch');await f.fire('submit');
  assert.equal(f.calls.some(call=>call.action==='submit-details'),false);assert.equal(f.core.snapshot().items.fastpeoplesearch.final_submission,undefined);
});

test('closing during a requirements read or final preflight cannot dispatch a later action',async()=>{
  const f=await fixture({delayedProbe:true}),opening=f.dialog.open('fastpeoplesearch',f.opener);await new Promise(resolve=>setImmediate(resolve));await f.fire('close');f.releaseProbe();await opening;
  assert.equal(f.byId('form').parentElement.parentElement.open,false);assert.equal(f.calls.some(call=>call.action==='submit-details'),false);
  const g=await fixture({delayedSubmitPing:true});await g.dialog.open('fastpeoplesearch',g.opener);g.fill();await g.fire('form','submit');g.byId('approval').checked=true;
  const running=g.fire('submit');await new Promise(resolve=>setImmediate(resolve));await g.fire('close');g.releasePing();await running;
  assert.equal(g.core.snapshot().items.fastpeoplesearch.final_submission,undefined);assert.equal(g.calls.some(call=>call.action==='submit-details'),false);
});

test('an unavailable proof collects nothing and holding is an explicit local action',async()=>{
  const f=await fixture({probeUnavailable:true});await f.dialog.open('fastpeoplesearch',f.opener);assert.equal(f.byId('form').hidden,true);assert.match(f.byId('status').textContent,/could not be verified/);
  await f.fire('hold');assert.equal(f.core.dashboard().items.find(item=>item.site_id==='fastpeoplesearch').held,true);assert.equal(f.calls.some(call=>call.action==='submit-details'),false);
  assert.equal(f.core.dashboard().items.find(item=>item.site_id==='usphonebook').held,true);
});
