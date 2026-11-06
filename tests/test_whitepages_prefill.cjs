'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Base=require('../extension/broker-executor.js'),Core=require('../webapp/static/workspace-core.js'),Batch=require('../webapp/static/form-batch.js');
const URL='https://www.whitepages.com/name/Example-Person/Example-City-CA/EraseMeSyntheticID';
global.getComputedStyle=element=>element.style;
function page(){
  const elements=[],events=[],files=[];let clicks=0;
  const element=(tag,properties={})=>({tagName:tag.toUpperCase(),parentElement:null,style:{display:'block',visibility:'visible',opacity:'1'},hidden:false,
    attributes:new Map(),getClientRects(){return this.hidden?[]:[{}];},getAttribute(name){return this.attributes.get(name)??null;},hasAttribute(name){return this.attributes.has(name);},setAttribute(name,value){this.attributes.set(name,String(value));},...properties});
  const section=element('div'),card=element('div',{parentElement:section}),heading=element('div',{parentElement:section,textContent:'Opt-out of Whitepages'}),step=element('div',{parentElement:section,textContent:'Step 1 of 5'}),notice=element('div',{parentElement:card,textContent:'You can opt out and have your listing removed from the Whitepages website. Copy and paste the URL of your profile.'});
  const button=element('button',{form:null,type:'submit',name:'',value:'',disabled:false,formNoValidate:false,parentElement:card,textContent:'Next',click(){clicks++;}});
  class Input{get value(){return this._value;}set value(value){this._value=value;}}
  const input=Object.assign(Object.create(Input.prototype),element('input',{form:null,name:'',type:'text',required:false,disabled:false,readOnly:false,value:'',parentElement:card,closest:selector=>selector==='.card'?card:null,dispatchEvent(event){events.push(event.type);this.onEvent?.(event);return true;}}));
  for(const[name,value]of Object.entries({placeholder:'Copy and paste the URL of your profile',autocomplete:'off',inputmode:'text','data-qa-selector':'suppression-requests-person-url'}))input.setAttribute(name,value);
  const inputs=[input],buttons=[button],headings=[heading],steps=[step],notices=[notice],links=[];
  card.querySelectorAll=selector=>selector==='input,textarea,select'?inputs:selector==='button'?buttons:selector==='.body-1'?notices:selector==='a'?links:[];
  section.querySelectorAll=selector=>selector==='.display-2'?headings:selector==='.overline'?steps:[];
  const document={querySelector:selector=>selector===Base.ROUTES.whitepages.listing_url?inputs[0]:selector==='input[type="file"]'?files[0]:null,querySelectorAll:selector=>selector===Base.ROUTES.whitepages.listing_url?inputs:selector==='input[type="file"]'?files:[]};
  const env={document,location:{href:'https://www.whitepages.com/suppression-requests'},HTMLInputElement:Input,Event:class{constructor(type,properties){this.type=type;Object.assign(this,properties);}},setTimeout:callback=>callback()};
  const payload={routeId:'whitepages',operationId:'a'.repeat(32),authorized:true,listingConfirmed:true,fields:{listing_url:URL}};
  return{payload,env,document,input,card,section,heading,step,notice,button,inputs,buttons,headings,steps,notices,links,files,events,clicks:()=>clicks};
}
async function workspace(){
  const map=new Map();let index=0;
  const core=Core.create({storage:{getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)},uuid:()=>(++index).toString(16).padStart(32,'0'),now:()=> '2026-11-05T00:00:00.000Z'});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'person@example.test',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US'})});return core;
}
test('Whitepages person URLs use the published person-path shape and reject search, paid, login and ambiguous destinations',async()=>{
  const valid=[URL,'https://www.whitepages.com/name/Example--Person/-/ABC_123'];
  for(const value of valid){assert.equal(Base.whitepagesURL(value),true);const core=await workspace();core.setEvidence('whitepages',{listing_url:value},{own_listing:true},{manualListingReview:true});assert.equal(core.fillPreview('whitepages').fields.listing_url,value);}
  for(const value of ['http://www.whitepages.com/name/Example-Person/City/ID','https://whitepages.com/name/Example-Person/City/ID',URL+'?email=other',URL+'#other',URL+'/',URL.replace('/name/','/checkout/'),URL.replace('/name/','/login/'),'https://www.whitepages.com/name/Example-Person/City',URL.replace('Example-Person','Example%2FPerson'),'https://www.whitepages.com@other.example/name/Example/City/ID']){
    assert.equal(Base.whitepagesURL(value),false,value);const core=await workspace();assert.throws(()=>core.setEvidence('whitepages',{listing_url:value},{own_listing:true},{manualListingReview:true}));
  }
});
test('Whitepages private intake fills only the reviewed URL once and never clicks Next or sends any other profile field',async()=>{
  const p=page();assert.equal(Base.inspect({routeId:'whitepages'},p.env).formPresent,false);assert.equal(Base.inspect({routeId:'whitepages'},p.env).observable,false);
  const result=await Base.execute(p.payload,p.env);assert.equal(result.status,'prepared');assert.equal(p.input.value,URL);assert.deepEqual(p.events,['input','change']);assert.equal(p.clicks(),0);
  assert.match(result.detail,/no request was submitted/);assert.equal(JSON.stringify(result).includes(URL),false);p.input.value='';assert.equal((await Base.execute(p.payload,p.env)).status,'unknown');assert.equal(p.events.length,2);assert.equal(p.clicks(),0);
});
test('Whitepages purpose, non-form controls, manual approval and initial field state must match before any value is written',async()=>{
  for(const mutate of [p=>{p.payload.authorized=false;},p=>{p.payload.listingConfirmed=false;},p=>{p.payload.operationId='bad';},p=>{p.payload.fields.email='unapproved@example.test';},p=>{p.env.location.href+='?other=1';},p=>{p.input.form={};},p=>{p.input.type='url';},p=>{p.input.name='other';},p=>{p.input.required=true;},p=>{p.input.disabled=true;},p=>{p.input.readOnly=true;},p=>{p.input.value='existing';},p=>{p.input.setAttribute('placeholder','Email');},p=>{p.input.setAttribute('data-qa-selector','other');},p=>{p.heading.textContent='Search';},p=>{p.step.textContent='Step 2 of 5';},p=>{p.notice.textContent+=' More';},p=>{p.headings.push(p.heading);},p=>{p.inputs.push({});},p=>{p.buttons.push(p.button);},p=>{p.button.textContent='Delete';},p=>{p.button.form={};},p=>{p.button.setAttribute('formaction','https://other.example/collect');},p=>{p.links.push({});},p=>{p.files.push({});}]){
    const p=page();mutate(p);let result;try{result=await Base.execute(p.payload,p.env);}catch(_){result={status:'blocked'};}assert.equal(result.status,'blocked',mutate.toString());assert.equal(p.events.length,0);assert.equal(p.clicks(),0);
  }
});
test('Whitepages normal input events cannot change the document, purpose, controls or approved value unnoticed',async()=>{
  for(const mutate of [p=>{p.heading.textContent='Export';},p=>{p.step.textContent='Step 2 of 5';},p=>{p.input.value='different';},p=>{p.inputs[0]={...p.input};},p=>{p.env.location.href='https://other.example/collect';},p=>{p.payload.fields.listing_url=URL.replace('ID','Other');}]){
    const p=page();p.input.onEvent=()=>mutate(p);assert.equal((await Base.execute(p.payload,p.env)).status,'blocked',mutate.toString());assert.equal(p.clicks(),0);assert.equal((await Base.execute(p.payload,p.env)).status==='prepared',false);
  }
});
test('Whitepages manual record approval cannot be replaced by a Spokeo automatic reference, an edited URL or imported history',async()=>{
  const core=await workspace();assert.throws(()=>core.setEvidence('whitepages',{listing_url:URL},{own_listing:true}));
  assert.throws(()=>core.setEvidence('whitepages',{listing_url:URL},{own_listing:true},{automaticReference:'a'.repeat(32)}));
  core.setEvidence('whitepages',{listing_url:URL},{own_listing:true},{manualListingReview:true});core.setEvidence('whitepages',{listing_url:URL},{own_listing:true});
  assert.throws(()=>core.setEvidence('whitepages',{listing_url:URL+'B'},{own_listing:true}));
  const preview=core.fillPreview('whitepages');assert.equal(preview.reviewed.affirmations.own_listing,true);
  const backup=core.exportData(),restored=new Map();const empty=Core.create({storage:{getItem:key=>restored.get(key)||null,setItem:(key,value)=>restored.set(key,value),removeItem:key=>restored.delete(key)}});empty.importData(backup);assert.throws(()=>empty.fillPreview('whitepages'));
  const operation=core.prepareReviewed(preview);assert.equal(operation.listingConfirmed,true);assert.deepEqual(operation.fields,{listing_url:URL});assert.equal(core.snapshot().items.whitepages.operation_email,undefined);
  core.recordCompanion('whitepages',operation.operationId,{status:'prepared'});assert.equal(core.dashboard().counts.requested,0);assert.equal(core.dashboard().counts.removed,0);
});
test('Whitepages capability gates the complete selected batch before any route can reserve or send fields',async()=>{
  for(const capable of [false,true]){
    const core=await workspace();core.setEvidence('whitepages',{listing_url:URL},{own_listing:true},{manualListingReview:true});core.setEvidence('fastpeoplesearch',{first_name:'Example',last_name:'Person'});
    const previews=['fastpeoplesearch','whitepages'].map(id=>core.fillPreview(id)),calls=[];
    const batch=Batch.create({workspace:core,companion:async value=>{calls.push(value);return value.action==='ping'?{routes:['fastpeoplesearch','whitepages'],capabilities:capable?['whitepages-prefill-v1']:[]}:{status:'prepared'};}});
    const result=await batch.run(previews,{authorized:true});assert.equal(result.status,capable?'finished':'stopped');
    if(!capable){assert.deepEqual(calls.map(call=>call.action),['ping']);for(const id of ['whitepages','fastpeoplesearch'])assert.equal(core.snapshot().items[id].operation_id,null);}
    else{assert.equal(calls.filter(call=>call.action==='run').length,2);const request=calls.find(call=>call.routeId==='whitepages');assert.equal(request.listingConfirmed,true);assert.deepEqual(request.fields,{listing_url:URL});}
  }
});
