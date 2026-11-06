'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Automatic=require('../extension/automatic-executor.js');
const Base=require('../extension/broker-executor.js');

const CONSENT='I authorize US Phone Book to send communications relating to my privacy request to the email address(es) provided. I certify that I am the subject of the request, or an agent authorized to act on behalf of the subject of the request. I understand that information provided relating to this request will not be used for any purpose other than the processing of this request.';
const PRIVACY='The Information you provide here will only be used to process your request. We will not sell or use the information or use it for any other purpose. Please see our Privacy Policy for more details.';
const PURPOSE='In order to complete your opt-out request, please enter your email address below. We will send an email to confirm the removal of the record you selected. We only will use your email address to send you an email to verify your request to opt out.';
const AGENT_NOTICE="Note: Authorized agent's email address will be used to send a link to the opt-out form. Once that form has been submitted, confirmation of processing will be sent to both the authorized agent's and the subject's email addresses.";

function page(){
  let clicks=0,sent=0;const selectors=new Map(),listeners=[],extras=[],alerts=[],files=[],events=[];
  const element=(tag,properties={})=>({tagName:tag.toUpperCase(),name:'',value:'',type:'',required:false,disabled:false,readOnly:false,parentElement:null,children:[],
    style:{display:'block',visibility:'visible',opacity:'1'},attributes:new Map(),
    hasAttribute(name){return this.attributes.has(name);},getAttribute(name){return this.attributes.get(name)??null;},setAttribute(name,value){this.attributes.set(name,String(value));},
    getClientRects(){return this.hidden?[]:[{}];},focus(){this.onFocus?.();},dispatchEvent(event){events.push(event.type);this.onEvent?.(event);return true;},...properties});
  const register=(selector,value)=>{selectors.set(selector,[value]);return value;};
  const form=register('#verifyEmailForm',element('form',{method:'post',action:'https://www.usphonebook.com/removal',enctype:'application/x-www-form-urlencoded',target:'',noValidate:false,
    querySelectorAll(selector){if(selector==='p')return[notice,agentNotice,terms];if(selector==='a')return[link];return[];},
    addEventListener(type,listener){if(type==='submit')listeners.push(listener);},removeEventListener(type,listener){const index=listeners.indexOf(listener);if(index>=0)listeners.splice(index,1);},
    checkValidity(){this.onValidate?.();return this.valid!==false;}}));
  const fields={first_name:'Example',last_name:'Person',email:'person@example.test'},controls={};
  for(const[key,value]of Object.entries(fields))controls[key]=register(Base.ROUTES.usphonebook[key],element('input',{form,name:'subject-'+({first_name:'firstname',last_name:'lastname',email:'email'})[key],type:key==='email'?'email':'text',required:true,value}));
  const selection=register('#user-type',element('select',{form,name:'user-type',type:'select-one',required:true,multiple:false,value:'subject',options:[
    {value:'subject',disabled:false,textContent:'The subject of the request'},{value:'agent',disabled:false,textContent:'An authorized agent of the subject of the request'}]}));
  const middle=register('#subject-middlename',element('input',{form,name:'subject-middlename',type:'text'}));
  const agents=['firstname','lastname','email'].map(name=>register('#agent-'+name,element('input',{form,name:'agent-'+name,type:name==='email'?'email':'text',hidden:true})));
  class Input{}
  Object.defineProperty(Input.prototype,'checked',{set(value){this._checked=Boolean(value);},get(){return this._checked;}});
  const checkbox=register('#agreement',Object.assign(Object.create(Input.prototype),element('input',{form,name:'agreement',type:'checkbox',required:true,value:'on',_checked:false})));
  const label=element('label',{htmlFor:'agreement',control:checkbox,textContent:CONSENT,querySelectorAll(){return[];}});checkbox.labels=[label];
  const link=element('a',{href:'https://www.usphonebook.com/privacy'});
  const notice=element('p',{textContent:PURPOSE,querySelectorAll(){return[];}}),agentNotice=element('p',{hidden:true,textContent:AGENT_NOTICE,querySelectorAll(){return[];}}),terms=element('p',{textContent:PRIVACY,querySelectorAll(){return[link];}});
  const csrf=register('#verifyEmailForm input[name="_token"]',element('input',{form,type:'hidden',name:'_token',hidden:true,value:'S'.repeat(40)}));
  const token=register('#verifyEmailForm textarea[name="g-recaptcha-response"]',element('textarea',{form,type:'textarea',name:'g-recaptcha-response',hidden:true,value:'genuine-synthetic-response'}));
  const widget=register('#verifyEmailForm .g-recaptcha',element('div'));
  for(const[name,value]of Object.entries({'data-sitekey':'6LcmiZYeAAAAACEbY_tBlLChTU8LZQbQ10M0o_pk','data-callback':'imNotARobotContact','data-error-callback':'recaptchaErrorCallbackContact','data-expired-callback':'recaptchaErrorCallbackContact'}))widget.setAttribute(name,value);
  const challengeScript=element('script',{src:'https://www.google.com/recaptcha/enterprise.js?hl=en'});selectors.set('script[src]',[challengeScript]);
  const button=register('#BRP',element('button',{form,type:'submit',formNoValidate:false,textContent:'Begin Removal Process',click(){
    clicks++;this.onClick?.();if(this.noEvent||!form.checkValidity())return;
    const event={target:form,submitter:button,isTrusted:!this.untrusted,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    for(const listener of [...listeners]){listener(event);if(event.stopped)break;}if(!event.defaultPrevented)sent++;
  }}));
  Object.defineProperty(form,'elements',{get(){return[csrf,selection,...Object.values(controls),middle,...agents,checkbox,token,button,...extras];}});
  const document={querySelectorAll(selector){if(selector==='input[type="file"]')return files;if(selector==='[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors,#error-display')return alerts;return selectors.get(selector)||[];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;}};
  const env={document,location:{href:form.action},getComputedStyle:value=>value.style,HTMLInputElement:Input,Event:class{constructor(type,properties){this.type=type;Object.assign(this,properties);}}};
  const payload={routeId:'usphonebook',operationId:'a'.repeat(32),fields,authorized:true,autoSubmit:true,consentId:Automatic.CONTRACTS.usphonebook.id};
  return{payload,env,document,form,controls,selection,middle,agents,checkbox,label,notice,agentNotice,terms,link,csrf,token,widget,challengeScript,button,extras,alerts,files,selectors,events,clicks:()=>clicks,sent:()=>sent};
}

test('USPhonebook reviews own-subject purpose, exact communications consent and genuine Enterprise response before one attempt',async()=>{
  const p=page();assert.equal(Automatic.CONTRACTS.usphonebook.requiredCapability,'reviewed-initial-submit-v4');
  assert.ok(Automatic.CONTRACTS.usphonebook.consentText.includes(CONSENT));assert.ok(Automatic.CONTRACTS.usphonebook.consentText.includes(PRIVACY));assert.ok(Automatic.CONTRACTS.usphonebook.consentText.includes(PURPOSE));
  assert.deepEqual(await Automatic.waitReady(p.payload,p.env),{status:'ready'});assert.equal(Automatic.capture(p.payload,p.env).status,'ready');
  const result=Automatic.submit(p.payload,p.env);assert.equal(result.status,'submission_attempted');assert.equal(result.attempt_verified,true);assert.equal(result.stage,'verification_initiation');
  assert.equal(p.clicks(),1);assert.equal(p.sent(),1);assert.equal(p.checkbox.checked,true);assert.deepEqual(p.events,['input','change']);
  for(const value of [...Object.values(p.payload.fields),p.token.value,p.csrf.value])assert.equal(JSON.stringify(result).includes(value),false);
  assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');assert.equal(Automatic.capture(p.payload,p.env).reason,'already_captured');assert.equal(p.clicks(),1);
});

test('USPhonebook rejects changed purpose, policy, hidden agent data, form controls and native submit overrides before clicking',()=>{
  const changes=[p=>{p.payload.authorized=false;},p=>{p.payload.autoSubmit=false;},p=>{p.payload.consentId='old';},p=>{p.payload.fields.unapproved='extra';},
    p=>{p.env.location.href+='?different=1';},p=>{p.form.action+='?different=1';},p=>{p.form.method='get';},p=>{p.form.target='_blank';},p=>{p.form.enctype='text/plain';},p=>{p.form.noValidate=true;},p=>{p.form.setAttribute('onsubmit','changed()');},
    p=>{p.controls.first_name.value='Someone else';},p=>{p.controls.email.name='agent-email';},p=>{p.controls.last_name.required=false;},p=>{p.controls.email.readOnly=true;},
    p=>{p.selection.value='agent';},p=>{p.selection.required=false;},p=>{p.selection.options[0].textContent='Someone else';},p=>{p.selection.options.push({value:'other'});},
    p=>{p.middle.value='unapproved';},p=>{p.agents[0].value='unapproved';},p=>{p.agents[1].hidden=false;},p=>{p.agents[2].required=true;},p=>{p.checkbox.required=false;},p=>{p.checkbox.labels=[];},
    p=>{p.label.textContent+=' More';},p=>{p.label.control={};},p=>{p.notice.textContent+=' More';},p=>{p.terms.textContent+=' More';},p=>{p.agentNotice.hidden=false;},p=>{p.link.href='https://other.example/privacy';},
    p=>{p.button.textContent='Export';},p=>{p.button.name='extra';},p=>{p.button.value='extra';},p=>{p.button.formNoValidate=true;},
    p=>{p.csrf.value='';},p=>{p.csrf.value='x'.repeat(41);},p=>{p.csrf.hidden=false;},p=>{p.token.value='';},p=>{p.token.type='text';},p=>{p.token.hidden=false;},p=>{p.token.value='x'.repeat(16385);},
    p=>{p.widget.setAttribute('data-sitekey','different');},p=>{p.widget.setAttribute('data-callback','different');},p=>{p.challengeScript.src='https://other.example/challenge.js';},
    p=>{p.extras.push({type:'hidden',name:'extra'});},p=>{p.files.push({});},p=>{p.alerts.push({getClientRects:()=>[{}],style:{}});},
    ...['formaction','formmethod','formtarget','formenctype','formnovalidate'].map(name=>p=>p.button.setAttribute(name,''))];
  for(const change of changes){const p=page();change(p);assert.equal(Automatic.capture(p.payload,p.env).status,'blocked',change.toString());assert.equal(p.clicks(),0);assert.equal(p.sent(),0);}
});

test('USPhonebook pins CSRF, policy nodes and genuine response through validation, focus and consent events',()=>{
  for(const change of [p=>{p.csrf.value='R'.repeat(40);},p=>{p.token.value='replacement';},p=>{p.selection.value='agent';},p=>{p.checkbox.value='changed';},p=>{p.selectors.set('#agent-firstname',[{...p.agents[0]}]);},
    p=>{p.form.onValidate=()=>{p.controls.email.value='changed@example.test';};},p=>{p.button.onFocus=()=>p.button.setAttribute('formaction','https://other.example/collect');},p=>{p.checkbox.onEvent=()=>{p.agents[2].value='changed@example.test';};}]){
    const p=page();assert.equal(Automatic.capture(p.payload,p.env).status,'ready');change(p);assert.equal(Automatic.submit(p.payload,p.env).status,'blocked',change.toString());assert.equal(p.clicks(),0);assert.equal(p.sent(),0);assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');
  }
});

test('USPhonebook cancels unsafe native events and never repeats missing or invalid submissions',()=>{
  for(const mode of ['override','token','untrusted','missing']){
    const p=page();assert.equal(Automatic.capture(p.payload,p.env).status,'ready');
    if(mode==='override')p.button.onClick=()=>p.button.setAttribute('formaction','https://other.example/collect');if(mode==='token')p.button.onClick=()=>{p.token.value='changed';};if(mode==='untrusted')p.button.untrusted=true;if(mode==='missing')p.button.noEvent=true;
    const result=Automatic.submit(p.payload,p.env);assert.equal(result.status,mode==='missing'?'unknown':'blocked',mode);assert.equal(p.sent(),0);assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');
  }
  const p=page();Automatic.capture(p.payload,p.env);p.form.valid=false;assert.equal(Automatic.submit(p.payload,p.env).status,'blocked');assert.equal(p.clicks(),0);
});

test('USPhonebook observes one genuine response during one bounded foreground wait without creating a token',async()=>{
  for(const end of ['ready','deadline','navigation','csrf_changed','agent_changed']){
    const p=page();p.token.value='';let observed,deadline,disconnected=false,cleared=false;const handlers=new Map();
    p.document.addEventListener=(type,listener)=>handlers.set(type,listener);p.document.removeEventListener=type=>handlers.delete(type);
    p.env.addEventListener=(type,listener)=>handlers.set(type,listener);p.env.removeEventListener=type=>handlers.delete(type);
    p.env.MutationObserver=class{constructor(listener){observed=listener;}observe(){}disconnect(){disconnected=true;}};
    p.env.setTimeout=(callback,ms)=>{assert.equal(ms,12000);deadline=callback;return 1;};p.env.clearTimeout=()=>{cleared=true;};
    const wait=Automatic.waitReady(p.payload,p.env);assert.equal(p.token.value,'');assert.equal(p.clicks(),0);
    if(end==='ready'){p.token.value='site-produced-synthetic-response';observed();}if(end==='deadline')deadline();if(end==='navigation')handlers.get('pagehide')();
    if(end==='csrf_changed'){p.csrf.value='R'.repeat(40);observed();}if(end==='agent_changed'){p.agents[0].value='unapproved';observed();}
    const result=await wait;assert.equal(result.status,end==='ready'?'ready':'blocked',end);assert.equal(disconnected,true);assert.equal(cleared,true);assert.equal(handlers.size,0);assert.equal(p.clicks(),0);
    if(end!=='ready')assert.equal(p.token.value,'');
  }
});
