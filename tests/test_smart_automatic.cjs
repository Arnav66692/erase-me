'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Automatic=require('../extension/automatic-executor.js');
const Base=require('../extension/broker-executor.js');
global.getComputedStyle=element=>element.style;
const CONSENT='I authorize SmartBackgroundChecks to send communications relating to my privacy request to the email address(es) provided. I certify that I am the subject of the request, or an agent authorized to act on behalf of the subject of the request. I understand that information provided relating to this request will not be used for any purpose other than the processing of this request.';
function page(){
  const selectors=new Map(),events=[],listeners=[],extras=[],alerts=[],files=[];let clicks=0,sent=0;
  const element=(tag,properties={})=>({tagName:tag.toUpperCase(),name:'',value:'',type:'',required:false,disabled:false,readOnly:false,parentElement:null,attributes:new Map(),style:{display:'block',visibility:'visible',opacity:'1'},
    hasAttribute(name){return this.attributes.has(name);},getAttribute(name){return this.attributes.get(name)??null;},setAttribute(name,value){this.attributes.set(name,String(value));},getClientRects(){return this.hidden?[]:[{}];},focus(){this.onFocus?.();},dispatchEvent(event){events.push(event.type);this.onEvent?.(event);return true;},...properties});
  const register=(selector,value)=>{selectors.set(selector,[value]);return value;};
  const form=register(Base.ROUTES.smartbackgroundchecks.form,element('form',{method:'post',action:'https://www.smartbackgroundchecks.com/remove',enctype:'application/x-www-form-urlencoded',target:'',noValidate:false,
    querySelectorAll(selector){if(selector==='a')return links;if(selector==='button[type="submit"],input[type="submit"]'||selector==='button[type="submit"]')return[button];return[];},
    addEventListener(type,listener){if(type==='submit')listeners.push(listener);},removeEventListener(type,listener){const index=listeners.indexOf(listener);if(index>=0)listeners.splice(index,1);},checkValidity(){this.onValidate?.();return this.valid!==false;}}));
  form.setAttribute('action','/remove');const heading=element('h2',{textContent:'Do Not Sell/Right to Opt-out'});selectors.set('h2',[heading]);
  class Input{get value(){return this._value;}set value(value){this._value=value;}get checked(){return this._checked;}set checked(value){this._checked=Boolean(value);}}
  class Select{get value(){return this._value;}set value(value){this._value=value;}}
  const fields={first_name:'Example',last_name:'Person',email:'person@example.test'},controls={};
  const input=properties=>Object.assign(Object.create(Input.prototype),element('input',properties));
  for(const[key,value]of Object.entries(fields)){
    const name={first_name:'subject_fn',last_name:'subject_ln',email:'subject_email'}[key],caption={first_name:'First Name',last_name:'Last Name',email:'Subject Email Address'}[key];
    controls[key]=register(Base.ROUTES.smartbackgroundchecks[key],input({form,name,type:key==='email'?'email':'text',required:true,value,labels:[element('label',{textContent:caption})]}));
  }
  const selection=register('#requester_type',Object.assign(Object.create(Select.prototype),element('select',{form,name:'requester_type',type:'select-one',multiple:false,value:'subject',options:[{value:'subject',disabled:false,textContent:'The subject of the request'},{value:'agent',disabled:false,textContent:'An authorized agent of the subject of the request'}]})));selection.setAttribute('onchange','idvToggleAgent()');
  const middle=register('#subject_mn',input({form,name:'subject_mn',type:'text'}));
  const agents=['agent_fn','agent_ln','agent_email'].map(name=>register('#'+name,input({form,name,type:name==='agent_email'?'email':'text',hidden:true})));
  const hidden=[['form1_submit','1'],['id',''],['name','']].map(([name,value])=>register(Base.ROUTES.smartbackgroundchecks.form+' input[name="'+name+'"]',input({form,name,type:'hidden',hidden:true,value})));
  const checkbox=register('#confirm_authorize',input({form,name:'confirm_authorize',type:'checkbox',required:true,value:'on',_checked:false}));
  const label=element('label',{textContent:CONSENT});checkbox.labels=[label];
  const token=register(Base.ROUTES.smartbackgroundchecks.form+' textarea#g-recaptcha-response[name="g-recaptcha-response"]',element('textarea',{form,type:'textarea',name:'g-recaptcha-response',hidden:true,value:'synthetic-site-response'}));
  const widget=register(Base.ROUTES.smartbackgroundchecks.form+' .g-recaptcha',element('div'));widget.setAttribute('data-sitekey','6LfrTZYeAAAAAIHiEeAsmSQCjVNoI81kuyTLrbgi');
  const challengeScript=element('script',{src:'https://www.google.com/recaptcha/api.js'});selectors.set('script[src]',[challengeScript]);
  const button=element('button',{form,type:'submit',textContent:'Submit',formNoValidate:false,click(){clicks++;this.onClick?.();if(this.noEvent||!form.checkValidity())return;const event={target:form,submitter:button,isTrusted:!this.untrusted,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const listener of [...listeners]){listener(event);if(event.stopped)break;}if(!event.defaultPrevented)sent++;}});
  const links=[];Object.defineProperty(form,'elements',{get(){return[...hidden,selection,...Object.values(controls),middle,...agents,checkbox,token,button,...extras];}});
  const document={forms:[form],querySelectorAll(selector){if(selector==='input[type="file"]')return files;if(selector==='[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors')return alerts;return selectors.get(selector)||[];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;}};
  const env={document,location:{href:form.action},getComputedStyle:value=>value.style,HTMLInputElement:Input,HTMLSelectElement:Select,Event:class{constructor(type,properties){this.type=type;Object.assign(this,properties);}},setTimeout:callback=>callback()};
  const payload={routeId:'smartbackgroundchecks',operationId:'a'.repeat(32),fields,authorized:true,ownRequestConfirmed:true,autoSubmit:true,consentId:Automatic.CONTRACTS.smartbackgroundchecks.id};
  return{payload,env,form,document,controls,selection,middle,agents,hidden,checkbox,label,token,widget,challengeScript,button,heading,selectors,extras,alerts,files,links,events,clicks:()=>clicks,sent:()=>sent};
}
test('SmartBackgroundChecks fills only an approved own-subject name/contact without consent or submission',async()=>{
  const p=page();assert.throws(()=>Base.validate(p.payload.routeId,p.payload.fields));
  assert.equal(Base.allowed('https://www.smartbackgroundchecks.com/optout',Base.ROUTES.smartbackgroundchecks),false);
  for(const control of Object.values(p.controls))control.value='';
  const result=await Base.execute(p.payload,p.env);assert.equal(result.status,'prepared');assert.equal(p.clicks(),0);assert.equal(p.checkbox.checked,false);
  for(const[key,value]of Object.entries(p.payload.fields))assert.equal(p.controls[key].value,value);
});
test('SmartBackgroundChecks ninth contract requires genuine response and one reviewed native attempt',async()=>{
  const p=page();assert.equal(Automatic.CONTRACTS.smartbackgroundchecks.requiredCapability,'reviewed-initial-submit-v5');assert.equal(Automatic.CONTRACTS.smartbackgroundchecks.consentText,CONSENT);
  assert.deepEqual(await Automatic.waitReady(p.payload,p.env),{status:'ready'});assert.equal(Automatic.capture(p.payload,p.env).status,'ready');
  const result=Automatic.submit(p.payload,p.env);assert.equal(result.status,'submission_attempted');assert.equal(result.stage,'verification_initiation');assert.equal(result.attempt_verified,true);assert.equal(p.sent(),1);assert.equal(p.clicks(),1);
  assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');assert.equal(Automatic.capture(p.payload,p.env).reason,'already_captured');assert.equal(p.clicks(),1);
  for(const value of Object.values(p.payload.fields))assert.equal(JSON.stringify(result).includes(value),false);
});
test('SmartBackgroundChecks stops changed form, named hidden data, agent fields, legal text, challenge or controls before capture',()=>{
  const mutations=[p=>{p.payload.ownRequestConfirmed=false;},p=>{p.payload.autoSubmit=false;},p=>{p.payload.consentId='old';},p=>{p.env.location.href+='?id=changed';},p=>{p.form.action+='?id=changed';},p=>{p.form.method='get';},p=>{p.form.target='_blank';},p=>{p.form.enctype='text/plain';},p=>{p.form.noValidate=true;},p=>{p.form.setAttribute('onsubmit','changed()');},p=>{p.form.setAttribute('action','/other');},p=>{p.document.forms.push({});},p=>{p.heading.textContent='Export';},
    p=>{p.controls.email.value='other@example.test';},p=>{p.controls.first_name.required=false;},p=>{p.controls.last_name.name='agent_ln';},p=>{p.controls.email.labels[0].textContent='Agent Email';},p=>{p.controls.email.readOnly=true;},p=>{p.selection.value='agent';},p=>{p.selection.required=true;},p=>{p.selection.setAttribute('onchange','other()');},p=>{p.selection.options.push({value:'other'});},
    p=>{p.middle.value='unapproved';},p=>{p.agents[0].value='Someone';},p=>{p.agents[1].hidden=false;},p=>{p.agents[2].required=true;},p=>{p.hidden[0].value='0';},p=>{p.hidden[1].value='a-record-id';},p=>{p.hidden[2].value='Someone';},p=>{p.checkbox.required=false;},p=>{p.checkbox.value='other';},p=>{p.label.textContent+=' More';},p=>{p.links.push({href:'https://other.example/policy'});},
    p=>{p.token.value='';},p=>{p.token.hidden=false;},p=>{p.token.value='x'.repeat(16385);},p=>{p.widget.setAttribute('data-sitekey','other');},p=>{p.challengeScript.src='https://other.example/api.js';},p=>{p.button.textContent='Export';},p=>{p.button.name='extra';},p=>{p.extras.push({type:'hidden'});},p=>{p.files.push({});},p=>{p.alerts.push({getClientRects:()=>[{}],style:{}});},...['formaction','formmethod','formtarget','formenctype','formnovalidate'].map(name=>p=>p.button.setAttribute(name,''))];
  for(const mutate of mutations){const p=page();mutate(p);assert.equal(Automatic.capture(p.payload,p.env).status,'blocked',mutate.toString());assert.equal(p.clicks(),0);assert.equal(p.sent(),0);}
});
test('SmartBackgroundChecks rechecks through consent events, native validation and click; consumed attempts never repeat',()=>{
  for(const mutate of [p=>{p.token.value='changed';},p=>{p.hidden[1].value='changed';},p=>{p.checkbox.onEvent=()=>{p.agents[0].value='changed';};},p=>{p.form.onValidate=()=>{p.controls.email.value='changed@example.test';};},p=>{p.button.onFocus=()=>p.button.setAttribute('formaction','https://other.example/collect');}]){
    const p=page();assert.equal(Automatic.capture(p.payload,p.env).status,'ready');mutate(p);assert.equal(Automatic.submit(p.payload,p.env).status,'blocked');assert.equal(p.clicks(),0);assert.equal(p.sent(),0);
  }
  for(const mode of ['override','token','untrusted','missing']){const p=page();Automatic.capture(p.payload,p.env);if(mode==='override')p.button.onClick=()=>p.button.setAttribute('formaction','https://other.example/collect');if(mode==='token')p.button.onClick=()=>{p.token.value='changed';};if(mode==='untrusted')p.button.untrusted=true;if(mode==='missing')p.button.noEvent=true;assert.equal(Automatic.submit(p.payload,p.env).status,mode==='missing'?'unknown':'blocked');assert.equal(p.sent(),0);assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');}
});
test('SmartBackgroundChecks watches its original genuine token with one bounded foreground deadline',async()=>{
  for(const end of ['ready','deadline','navigation','agent_changed','hidden_changed']){
    const p=page();p.token.value='';let observed,deadline,disconnected=false,cleared=false;const handlers=new Map();
    p.document.addEventListener=(type,listener)=>handlers.set(type,listener);p.document.removeEventListener=type=>handlers.delete(type);p.env.addEventListener=(type,listener)=>handlers.set(type,listener);p.env.removeEventListener=type=>handlers.delete(type);
    p.env.MutationObserver=class{constructor(listener){observed=listener;}observe(){}disconnect(){disconnected=true;}};p.env.setTimeout=(callback,ms)=>{assert.equal(ms,12000);deadline=callback;return 1;};p.env.clearTimeout=()=>{cleared=true;};
    const wait=Automatic.waitReady(p.payload,p.env);assert.equal(p.token.value,'');if(end==='ready'){p.token.value='site-produced-synthetic';observed();}if(end==='deadline')deadline();if(end==='navigation')handlers.get('pagehide')();if(end==='agent_changed'){p.agents[0].value='unapproved';observed();}if(end==='hidden_changed'){p.hidden[1].value='unapproved';observed();}
    assert.equal((await wait).status,end==='ready'?'ready':'blocked',end);assert.equal(disconnected,true);assert.equal(cleared,true);assert.equal(handlers.size,0);assert.equal(p.clicks(),0);if(end!=='ready')assert.equal(p.token.value,'');
  }
});
