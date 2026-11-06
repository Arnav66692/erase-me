'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Automatic=require('../extension/automatic-executor.js');
const Base=require('../extension/broker-executor.js');

function page(){
  const routeId='searchpeoplefree',route=Base.ROUTES[routeId],selectors=new Map(),listeners=[],events=[],extras=[],alerts=[],files=[];
  let clicks=0,sent=0;
  const element=(tag,properties={})=>({tagName:tag.toUpperCase(),name:'',value:'',type:'',required:false,disabled:false,readOnly:false,parentElement:null,children:[],
    style:{display:'block',visibility:'visible',opacity:'1'},attributes:new Map(),
    hasAttribute(name){return this.attributes.has(name);},getAttribute(name){return this.attributes.get(name)??null;},setAttribute(name,value){this.attributes.set(name,String(value));},
    getClientRects(){return this.hidden?[]:[{}];},focus(){this.onFocus?.();},dispatchEvent(event){events.push(event.type);this.onEvent?.(event);return true;},...properties});
  const form=element('form',{method:'get',action:route.url,enctype:'application/x-www-form-urlencoded',target:'',noValidate:false,
    querySelectorAll(selector){if(selector==='p')return[terms];if(selector==='a')return links;return[];},
    addEventListener(type,listener){if(type==='submit')listeners.push(listener);},removeEventListener(type,listener){const index=listeners.indexOf(listener);if(index>=0)listeners.splice(index,1);},
    checkValidity(){this.onValidate?.();return this.valid!==false;}});
  form.setAttribute('onsubmit','return o_beginRemoval()');
  const register=(selector,value)=>{selectors.set(selector,[value]);return value;};register('#o_form',form);
  const fields={first_name:'Example',last_name:'Person',email:'person@example.test'},controls={};
  for(const[key,value]of Object.entries(fields))controls[key]=register(route[key],element('input',{form,type:key==='email'?'email':'text',value}));
  const middle=register('#o_middle',element('input',{form,type:'text'}));
  class Input{}
  Object.defineProperty(Input.prototype,'checked',{set(value){this._checked=Boolean(value);},get(){return this._checked;}});
  const checkbox=register('#o_terms',Object.assign(Object.create(Input.prototype),element('input',{form,type:'checkbox',value:'on',_checked:false})));
  const links=Automatic.CONTRACTS.searchpeoplefree.policyUrls.map(href=>element('a',{href}));
  const consent='I confirm that I am the person associated with this email address and consent to receive an email from Search People FREE. The Information you provide here will only be used to process your request. We will not sell or use the information or use it for any other purpose. Please see our Privacy Policy for more details.';
  const label=element('label',{textContent:consent,querySelectorAll(){return[links[0]];}});checkbox.labels=[label];
  const terms=element('p',{textContent:'By using our site and services, you agree to our Terms of Use. Visit our Notice at Collection and Privacy Notice for information about our privacy practices.',querySelectorAll(){return links.slice(1);}});
  const token=register('#o_form input[name="cf-turnstile-response"]',element('input',{form,name:'cf-turnstile-response',type:'hidden',value:'genuine-synthetic-response'}));
  const widget=register('#o_form .cf-turnstile',element('div'));
  const button=register('#o_submit',element('button',{form,type:'submit',formNoValidate:false,textContent:'Begin removal process.',innerText:'Begin removal process.',
    click(){clicks++;this.onClick?.();if(this.noEvent||!form.checkValidity())return;const event={target:form,submitter:button,isTrusted:!this.untrusted,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
      for(const listener of [...listeners]){listener(event);if(event.stopped)break;}if(!event.defaultPrevented)sent++;}}));
  Object.defineProperty(form,'elements',{get(){return[...Object.values(controls),middle,checkbox,token,button,...extras];}});
  const document={querySelectorAll(selector){if(selector==='input[type="file"]')return files;if(selector==='[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors,#o_fail,#o_success,#o_success_sent')return alerts;return selectors.get(selector)||[];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;}};
  const env={document,location:{href:route.url},getComputedStyle:value=>value.style,HTMLInputElement:Input,Event:class{constructor(type,properties){this.type=type;Object.assign(this,properties);}}};
  const payload={routeId,operationId:'a'.repeat(32),fields,authorized:true,autoSubmit:true,consentId:Automatic.CONTRACTS[routeId].id};
  return{routeId,payload,env,document,form,controls,middle,checkbox,label,terms,links,token,widget,button,extras,alerts,files,selectors,events,clicks:()=>clicks,sent:()=>sent};
}

test('SPF shows its exact own-email terms and submits a genuine-widget request only once',async()=>{
  const p=page();assert.equal(Automatic.CONTRACTS.searchpeoplefree.requiredCapability,'reviewed-initial-submit-v3');
  assert.match(Automatic.CONTRACTS.searchpeoplefree.consentText,/person associated with this email address/);
  assert.deepEqual(await Automatic.waitReady(p.payload,p.env),{status:'ready'});
  assert.equal(Automatic.capture(p.payload,p.env).status,'ready');const result=Automatic.submit(p.payload,p.env);
  assert.equal(result.status,'submission_attempted');assert.equal(result.attempt_verified,true);assert.equal(result.stage,'verification_initiation');
  assert.equal(p.clicks(),1);assert.equal(p.sent(),1);assert.equal(p.checkbox.checked,true);assert.equal(p.form.method,'get');assert.equal(p.form.noValidate,false);
  for(const value of [...Object.values(p.payload.fields),p.token.value])assert.equal(JSON.stringify(result).includes(value),false);
  assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');assert.equal(Automatic.capture(p.payload,p.env).reason,'already_captured');assert.equal(p.clicks(),1);
});

test('SPF stops for missing consent, token, changed legal text, unsupported controls and native submit overrides',()=>{
  const changes=[
    p=>{p.payload.authorized=false;},p=>{p.payload.autoSubmit=false;},p=>{p.payload.consentId='wrong';},p=>{p.payload.fields.extra='not approved';},
    p=>{p.form.action+='?different=1';},p=>{p.env.location.href+='?different=1';},p=>{p.form.method='post';},p=>{p.form.target='_blank';},p=>{p.form.enctype='text/plain';},p=>{p.form.noValidate=true;},p=>{p.form.setAttribute('onsubmit','return different()');},
    p=>{p.controls.first_name.value='Someone else';},p=>{p.controls.email.type='text';},p=>{p.controls.email.name='new_field';},p=>{p.controls.last_name.required=true;},p=>{p.middle.value='unapproved';},
    p=>{p.checkbox.required=true;},p=>{p.checkbox.name='agree';},p=>{p.checkbox.labels=[];},p=>{p.label.textContent+=' More consent';},p=>{p.terms.textContent+=' More terms';},p=>{p.links[0].href='https://other.example/privacy';},
    p=>{p.button.innerText='Export';},p=>{p.button.textContent+=' More text';},p=>{p.button.children.push({});},p=>{p.button.name='extra';},p=>{p.button.value='extra';},p=>{p.button.formNoValidate=true;},
    p=>{p.token.value='';},p=>{p.token.required=true;},p=>{p.token.form=null;},p=>{p.token.value='x'.repeat(16385);},p=>{p.widget.hidden=true;},
    p=>{p.extras.push({type:'hidden',name:'unapproved'});},p=>{p.files.push({});},p=>{p.alerts.push({getClientRects:()=>[{}],style:{}});},
    ...['formaction','formmethod','formtarget','formenctype','formnovalidate'].map(name=>p=>{p.button.setAttribute(name,'');})
  ];
  for(const change of changes){const p=page();change(p);assert.equal(Automatic.capture(p.payload,p.env).status,'blocked',change.toString());assert.equal(p.clicks(),0);assert.equal(p.sent(),0);}
});

test('SPF rechecks fields, exact legal nodes, policy links and token after capture and event handlers',()=>{
  for(const change of [
    p=>{p.controls.email.value='changed@example.test';},p=>{p.checkbox.checked=true;},p=>{p.checkbox.value='changed';},p=>{p.token.value='replacement';},p=>{p.token.value='';},
    p=>{p.selectors.set('#o_middle',[{...p.middle}]);},p=>{p.links[0]={...p.links[0]};},p=>{p.terms.hidden=true;},p=>{p.button.onFocus=()=>p.button.setAttribute('formaction','https://other.example/collect');},
    p=>{p.form.onValidate=()=>{p.controls.first_name.value='changed';};},p=>{p.checkbox.onEvent=()=>{p.form.method='post';};}
  ]){const p=page();assert.equal(Automatic.capture(p.payload,p.env).status,'ready');change(p);assert.equal(Automatic.submit(p.payload,p.env).status,'blocked',change.toString());assert.equal(p.clicks(),0);assert.equal(p.sent(),0);assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');}
});

test('SPF cancels unsafe native events and leaves absent or invalid native submission unknown without repeat',()=>{
  for(const mode of ['override','token','untrusted','missing']){
    const p=page();assert.equal(Automatic.capture(p.payload,p.env).status,'ready');
    if(mode==='override')p.button.onClick=()=>p.button.setAttribute('formaction','https://other.example/collect');
    if(mode==='token')p.button.onClick=()=>{p.token.value='changed';};if(mode==='untrusted')p.button.untrusted=true;if(mode==='missing')p.button.noEvent=true;
    const result=Automatic.submit(p.payload,p.env);assert.equal(result.status,mode==='missing'?'unknown':'blocked',mode);assert.equal(p.sent(),0,mode);assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');
  }
  const invalid=page();Automatic.capture(invalid.payload,invalid.env);invalid.form.valid=false;assert.equal(Automatic.submit(invalid.payload,invalid.env).status,'blocked');assert.equal(invalid.clicks(),0);
});

test('SPF challenge readiness is one bounded event-driven wait and never creates a token',async()=>{
  for(const end of ['ready','deadline','navigation','changed']){
    const p=page();p.token.value='';let observed,deadline,disconnected=false,cleared=false;const handlers=new Map();
    p.document.addEventListener=(type,listener)=>handlers.set(type,listener);p.document.removeEventListener=(type)=>handlers.delete(type);
    p.env.addEventListener=(type,listener)=>handlers.set(type,listener);p.env.removeEventListener=(type)=>handlers.delete(type);
    p.env.MutationObserver=class{constructor(listener){observed=listener;}observe(){}disconnect(){disconnected=true;}};
    p.env.setTimeout=(callback,ms)=>{assert.equal(ms,12000);deadline=callback;return 1;};p.env.clearTimeout=()=>{cleared=true;};
    const wait=Automatic.waitReady(p.payload,p.env);assert.equal(p.clicks(),0);assert.equal(p.token.value,'');
    if(end==='ready'){p.token.value='site-produced-synthetic-response';observed();}
    if(end==='deadline')deadline();if(end==='navigation')handlers.get('pagehide')();if(end==='changed'){p.links[0].href='https://other.example/privacy';observed();}
    const result=await wait;assert.equal(result.status,end==='ready'?'ready':'blocked');assert.equal(disconnected,true);assert.equal(cleared,true);assert.equal(handlers.size,0);assert.equal(p.clicks(),0);
  }
});
