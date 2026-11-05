'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const Final=require('../extension/final-executor.js');
const Details=require('../extension/identity-details.js');
const requestId='b'.repeat(32),email='removal+erase-'+requestId+'@gmail.com';
function payload(method='date_of_birth'){
  return{routeId:'fastpeoplesearch',operationId:'a'.repeat(32),requestId,receiptRef:'c'.repeat(64),submissionId:'d'.repeat(32),authorized:true,
    consentId:Details.CONTRACTS.fastpeoplesearch.id,fields:{first_name:'Example',last_name:'Person',email},
    requirements:{date_of_birth:method!=='street_address',street_address:method!=='date_of_birth',phone:method==='full_matching_details',no_validate:false,submit_no_validate:false},
    details:{method,...(method!=='street_address'?{date_of_birth:'1990-05-12'}:{}),...(method!=='date_of_birth'?{street_address:'123 Example Street'}:{}),...(method==='full_matching_details'?{phone:'(212) 555-0100'}:{}),city:'Example City',state:'CA',zip_code:'92101'}};
}
function page(options={}){
  const selectors=new Map(),events=[],listeners=new Map(),windowListeners=new Map(),timers=new Map(),observers=[];
  let sequence=0,clicks=0,submitted=0;
  const url='https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email,ticketid:'12345678'});
  let env;
  class Element{
    constructor(tag,props={}){this.tagName=tag.toUpperCase();this.type='';this.name='';this.disabled=false;this.readOnly=false;this.hidden=false;this.required=false;this.parentElement=null;this.children=[];this.style={display:'block',visibility:'visible',opacity:'1'};this.labels=[];Object.assign(this,props);}
    getClientRects(){return this.hidden?[]:[{}];}
    querySelectorAll(selector){if(selector==='a')return this.links||[];if(selector==='button[type="submit"],input[type="submit"]')return[this.button].filter(Boolean);return selectors.get(selector)||[];}
    focus(){env.document.activeElement=this;this.onFocus?.();}
    dispatchEvent(event){events.push([this.name,event.type]);updateRequired();this.onEvent?.(event);for(const callback of [...(listeners.get(event.type)||[])])callback(event);return true;}
  }
  class Input extends Element{
    constructor(props={}){super('input',{type:'text',...props});this._value='';this._checked=false;}
    get value(){return this._value;}set value(value){this._value=String(value);}
    get checked(){return this._checked;}set checked(value){this._checked=Boolean(value);}
  }
  class Select extends Element{
    constructor(props={}){super('select',{type:'select-one',...props});this._value='';}
    get value(){return this._value;}set value(value){this._value=String(value);}
  }
  const body=new Element('body'),form=new Element('form',{method:'post',action:'https://www.fastpeoplesearch.com/optout/removal',noValidate:options.noValidate===true});form.parentElement=body;
  const controls={},all=[];
  const add=(key,selector,element)=>{element.form=form;element.parentElement=form;controls[key]=element;selectors.set(selector,[element]);all.push(element);return element;};
  for(const [key,id,name,type]of [['first_name','firstname','firstname','text'],['last_name','lastname','lastname','text'],['email','email','email','email'],['middle','middlename','middlename','text'],['street','streetAddress','streetAddress','text'],['city','city','city','text'],['zip','zipcode','zipcode','text'],['phone','phone','phone','text']]){
    add(key,'input#'+id+'[name="'+name+'"][type="'+type+'"]',new Input({id,name,type,required:!['middle','phone'].includes(key)}));
  }
  controls.first_name.value='Example';controls.last_name.value='Person';controls.email.value=email;
  for(const [key,name,values]of [['month','dobMonth',Array.from({length:12},(_,i)=>String(i+1))],['day','dobDay',Array.from({length:31},(_,i)=>String(i+1))],['year','dobYear',Array.from({length:110},(_,i)=>String(1900+i))],['state','state',['CA','NY']]]){
    const selector=key==='state'?'select#state[name="state"]':'select[name="'+name+'"]';add(key,selector,new Select({name,id:key==='state'?'state':'',required:true,options:[{value:''},...values.map(value=>({value,disabled:false}))]}));
  }
  const legal=add('legal','#optout-removal input[name="legal"][type="checkbox"]',new Input({name:'legal',type:'checkbox',required:true}));legal.value='on';
  const label=new Element('div',{textContent:'* '+Details.CONTRACTS.fastpeoplesearch.warningText+' By checking the checkbox below, you agree to the following statement: '+Details.CONTRACTS.fastpeoplesearch.consentText});label.parentElement=form;legal.labels=[];legal.parentElement=label;
  form.textContent=label.textContent;
  add('ticket','#optout-removal input[name="ticketid"][type="hidden"]',new Input({name:'ticketid',type:'hidden'})).value='12345678';
  add('token','#optout-removal input[name="cf-turnstile-response"][type="hidden"]',new Input({name:'cf-turnstile-response',type:'hidden'})).value=options.wait?'':'genuine-site-response';
  const widget=new Element('div',{className:'cf-turnstile'});widget.parentElement=form;selectors.set('#optout-removal .cf-turnstile',[widget]);selectors.set('form#optout-removal',[form]);
  const button=new Element('button',{type:'submit',textContent:'Submit',form,formNoValidate:false});button.parentElement=form;form.button=button;all.push(button);form.elements=all;
  function updateRequired(){
    options.onRequirementEvent?.(controls,form);
  }
  const method=options.method||'date_of_birth';
  for(const key of ['month','day','year'])controls[key].required=method!=='street_address';
  controls.street.required=method!=='date_of_birth';controls.phone.required=method==='full_matching_details'||options.requiredPhone===true;
  form.checkValidity=()=>{form.onValidate?.();return all.every(e=>!e.required||e.disabled||e.type==='hidden'||(e.type==='checkbox'?e.checked:!!e.value));};
  const submitListeners=[];
  form.addEventListener=(type,callback)=>{if(type==='submit')submitListeners.push(callback);};
  form.removeEventListener=(type,callback)=>{const i=submitListeners.indexOf(callback);if(i>=0)submitListeners.splice(i,1);};
  button.click=()=>{
    clicks++;button.onClick?.();if(button.noEvent||!form.noValidate&&!form.checkValidity())return;
    const event={target:form,submitter:button,isTrusted:button.untrusted!==true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    for(const callback of [...submitListeners]){callback(event);if(event.stopped)break;}
    if(!event.defaultPrevented)submitted++;
  };
  const addListener=(map,type,callback)=>{if(!map.has(type))map.set(type,new Set());map.get(type).add(callback);};
  const removeListener=(map,type,callback)=>map.get(type)?.delete(callback);
  env={location:{href:url},getComputedStyle:element=>element.style,HTMLInputElement:Input,HTMLSelectElement:Select,Event:class{constructor(type,init){this.type=type;Object.assign(this,init);}},
    document:{querySelectorAll:selector=>selector==='input[type="file"]'?options.file?[new Input({type:'file'})]:[]:selector==='[role="alert"],.alert-danger,.alert-success,.validation-summary-errors'?options.alert?[new Element('div')]:[]:selectors.get(selector)||[],
      querySelector(selector){return this.querySelectorAll(selector)[0]||null;},addEventListener:(type,callback)=>addListener(listeners,type,callback),removeEventListener:(type,callback)=>removeListener(listeners,type,callback)},
    MutationObserver:class{constructor(callback){this.callback=callback;this.connected=false;observers.push(this);}observe(){this.connected=true;}disconnect(){this.connected=false;}},
    addEventListener:(type,callback)=>addListener(windowListeners,type,callback),removeEventListener:(type,callback)=>removeListener(windowListeners,type,callback),
    setTimeout:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id)};
  const mutate=()=>{for(const observer of observers)if(observer.connected)observer.callback([]);};
  const deadline=()=>{for(const [id,timer]of [...timers]){timers.delete(id);timer.callback();}};
  return{env,url,form,controls,label,button,widget,selectors,events,timers,observers,mutate,deadline,
    pagehide:()=>{for(const callback of [...(windowListeners.get('pagehide')||[])])callback();},clicks:()=>clicks,submitted:()=>submitted,
    liveListeners:()=>[...listeners.values(),...windowListeners.values()].reduce((total,set)=>total+set.size,0),Element,Input};
}

test('approved DOB and address paths fill only the selected identity and location fields before one native attempt',async()=>{
  for(const method of ['date_of_birth','street_address']){
    const p=page({method}),request=payload(method);const result=await Final.execute(request,p.url,p.env);
    assert.equal(result.status,'submission_attempted');assert.equal(result.attempt_verified,true);assert.equal(result.stage,'final_request_submission');assert.equal(p.clicks(),1);assert.equal(p.submitted(),1);
    assert.equal(p.controls.city.value,'Example City');assert.equal(p.controls.state.value,'CA');assert.equal(p.controls.zip.value,'92101');assert.equal(p.controls.legal.checked,true);
    assert.equal(p.controls.phone.value,'');assert.equal(p.controls.middle.value,'');assert.equal(p.controls.email.value,email);
    if(method==='date_of_birth'){assert.equal(p.controls.month.value,'5');assert.equal(p.controls.year.value,'1990');assert.equal(p.controls.day.value,'12');assert.equal(p.controls.street.value,'');}
    else{assert.equal(p.controls.street.value,'123 Example Street');for(const key of ['month','day','year'])assert.equal(p.controls[key].value,'');}
    const count=p.events.length;assert.equal((await Final.execute({...request,submissionId:'e'.repeat(32)},p.url,p.env)).reason,'already_started');assert.equal(p.events.length,count);assert.equal(p.clicks(),1);
    for(const secret of ['1990','123 Example','Example City',email,p.url])assert.equal(JSON.stringify(result).includes(secret),false);
  }
});

test('unknown consent, altered destination, changed identity and preexisting personal values stop before any field write',async()=>{
  const mutations=[p=>p.env.location.href=p.url.replace('ticketid=12345678','ticketid=87654321'),p=>p.form.action+='?purpose=export',p=>p.form.method='get',
    p=>p.label.textContent+=' I also permit marketing.',p=>p.form.textContent='Changed warning',p=>p.controls.first_name.value='Other',p=>p.controls.middle.value='Middle',p=>p.controls.ticket.value='other',
    p=>p.controls.street.value='Previous identity',p=>p.controls.phone.value='5551231234',p=>p.controls.year.value='1991',p=>p.controls.city.value='Different City',p=>p.controls.legal.checked=true,p=>p.controls.state.readOnly=true];
  for(const mutate of mutations){const p=page();mutate(p);const result=await Final.execute(payload(),p.url,p.env);assert.equal(result.status,'blocked');assert.equal(p.events.length,0);assert.equal(p.clicks(),0);}
  for(const options of [{file:true},{alert:true}]){const p=page(options);assert.equal((await Final.execute(payload(),p.url,p.env)).status,'blocked');assert.equal(p.events.length,0);}
});

test('extra fields, duplicate controls, unavailable options and malformed authorization cannot disclose identity',async()=>{
  for(const change of ['extra','duplicate','option','approval','details','route']){
    const p=page(),request=payload();
    if(change==='extra')p.form.elements.push(new p.Input({name:'extraPersonal',form:p.form,required:true}));
    if(change==='duplicate')p.selectors.get('input#email[name="email"][type="email"]').push(p.controls.email);
    if(change==='option')p.controls.month.options=[];
    if(change==='approval')request.consentId='unreviewed';
    if(change==='details')request.details.phone='5551231234';
    if(change==='route')request.routeId='usphonebook';
    assert.equal((await Final.execute(request,p.url,p.env)).status,'blocked');assert.equal(p.clicks(),0);
    if(change!=='option')assert.equal(p.events.length,0);
  }
});

test('field-handler mutation, control replacement, purpose drift and focus-time token changes cancel the action',async()=>{
  for(const change of ['identity','url','replace','consent','challenge']){
    const p=page();
    if(change==='challenge')p.button.onFocus=()=>p.controls.token.value='changed-response';
    else p.controls.month.onEvent=()=>{
      if(change==='identity')p.controls.email.value='other@example.test';
      if(change==='url')p.env.location.href=p.url.replace('ticketid=12345678','ticketid=87654321');
      if(change==='replace')p.selectors.set('select[name="dobDay"]',[new p.Element('select',{name:'dobDay',form:p.form,value:'',options:p.controls.day.options})]);
      if(change==='consent')p.label.textContent='Different approval';
    };
    assert.equal((await Final.execute(payload(),p.url,p.env)).status,'blocked');assert.equal(p.clicks(),0);assert.equal(p.submitted(),0);
  }
});

test('real-response waiting has one deadline, observes completion and tears down all listeners without token disclosure',async()=>{
  const p=page({wait:true}),run=Final.execute(payload(),p.url,p.env);
  assert.equal(p.timers.size,1);assert.equal([...p.timers.values()][0].delay,12000);assert.equal(p.clicks(),0);
  p.controls.token.value='genuine-delayed-response';p.mutate();const result=await run;
  assert.equal(result.status,'submission_attempted');assert.equal(p.clicks(),1);assert.equal(p.timers.size,0);assert.equal(p.liveListeners(),0);assert.equal(p.observers.some(x=>x.connected),false);
  assert.equal(JSON.stringify(result).includes('genuine-delayed-response'),false);
});

test('silent token writes are read once at the deadline and unresolved or departed pages never submit',async()=>{
  const silent=page({wait:true}),run=Final.execute(payload(),silent.url,silent.env);silent.controls.token.value='native-property-response';silent.deadline();assert.equal((await run).status,'submission_attempted');
  for(const change of ['timeout','leave','drift','payload']){
    const p=page({wait:true}),request=payload(),pending=Final.execute(request,p.url,p.env);
    if(change==='leave')p.pagehide();
    else{if(change==='drift')p.controls.email.value='other@example.test';if(change==='payload')request.details.city='Changed City';p.deadline();}
    assert.equal((await pending).status,'blocked');assert.equal(p.clicks(),0);assert.equal(p.timers.size,0);assert.equal(p.liveListeners(),0);
    assert.equal((await Final.execute(payload(),p.url,p.env)).reason,'already_started');
  }
});

test('native constraints are preserved and unsafe or absent native submit events cannot become request acceptance',async()=>{
  const required=page({requiredPhone:true});assert.equal((await Final.execute(payload(),required.url,required.env)).status,'blocked');assert.equal(required.controls.phone.required,true);assert.equal(required.clicks(),0);assert.equal(required.submitted(),0);assert.equal(required.events.length,0);
  const broker=page({requiredPhone:true,noValidate:true}),request=payload();request.requirements.phone=true;request.requirements.no_validate=true;const brokerResult=await Final.execute(request,broker.url,broker.env);assert.equal(brokerResult.status,'submission_attempted');assert.equal(broker.form.noValidate,true);assert.equal(broker.controls.phone.required,true);
  const unsafe=page();unsafe.button.untrusted=true;const result=await Final.execute(payload(),unsafe.url,unsafe.env);assert.equal(result.status,'blocked');assert.equal(unsafe.submitted(),0);
  const absent=page();absent.button.noEvent=true;assert.equal((await Final.execute(payload(),absent.url,absent.env)).status,'unknown');assert.equal(absent.clicks(),1);
  for(const value of [result,brokerResult]){assert.equal(value.acceptance_verified,undefined);assert.equal(value.deletion_verified,undefined);}
});

test('the full required native form uses only an explicitly approved DOB, address, phone and location',async()=>{
  const p=page({method:'full_matching_details'}),request=payload('full_matching_details');
  const result=await Final.execute(request,p.url,p.env);
  assert.equal(result.status,'submission_attempted');assert.equal(p.controls.year.value,'1990');assert.equal(p.controls.street.value,'123 Example Street');assert.equal(p.controls.phone.value,'(212) 555-0100');assert.equal(p.submitted(),1);
  assert.equal(JSON.stringify(result).includes('555-0100'),false);
  const minimal=page({method:'full_matching_details'}),incomplete=payload();incomplete.requirements=request.requirements;
  assert.equal((await Final.execute(incomplete,minimal.url,minimal.env)).status,'blocked');assert.equal(minimal.events.length,0);assert.equal(minimal.clicks(),0);
});

test('required flags are checked before any personal write, after events and immediately before the submit click',async()=>{
  for(const when of ['before','event','focus']){
    const p=page();
    if(when==='before')p.controls.street.required=true;
    if(when==='event')p.controls.month.onEvent=()=>{p.controls.phone.required=true;};
    if(when==='focus')p.button.onFocus=()=>{p.form.noValidate=true;};
    const result=await Final.execute(payload(),p.url,p.env);assert.equal(result.status,'blocked');assert.equal(p.clicks(),0);
    if(when==='before')assert.equal(p.events.length,0);
  }
});

test('requirements preflight reads flags and static form shape without any private input or token values',()=>{
  const p=page({method:'full_matching_details'});
  for(const key of ['first_name','last_name','email','middle','ticket','token','month','day','year','street','city','state','zip','phone'])Object.defineProperty(p.controls[key],'value',{get(){throw Error('Personal value must not be read in preflight');}});
  const result=Final.describe(p.url,p.env);assert.deepEqual(result,{status:'ready',requirements:payload('full_matching_details').requirements});assert.equal(p.events.length,0);assert.equal(p.clicks(),0);
  for(const secret of ['Example','Person',email,p.url,'1990','555-0100'])assert.equal(JSON.stringify(result).includes(secret),false);
});

test('requirements preflight rejects ambiguous flags, changed consent, navigation and additional required fields',()=>{
  for(const change of [p=>p.controls.day.required=false,p=>p.label.textContent='Different terms',p=>p.env.location.href=p.url.replace('ticketid=12345678','ticketid=87654321'),p=>p.form.elements.push(new p.Input({required:true,form:p.form}))]){
    const p=page();change(p);assert.equal(Final.describe(p.url,p.env).status,'unavailable');assert.equal(p.events.length,0);assert.equal(p.clicks(),0);
  }
});

test('reinjection retains the same executor and consumed document journal',async()=>{
  const p=page();await Final.execute(payload(),p.url,p.env);
  const context={EraseFinalExecutor:Final,module:{exports:{}}};vm.runInNewContext(fs.readFileSync(require.resolve('../extension/final-executor.js'),'utf8'),context);
  assert.equal(context.module.exports,Final);assert.equal((await context.EraseFinalExecutor.execute(payload(),p.url,p.env)).reason,'already_started');assert.equal(p.clicks(),1);
});
