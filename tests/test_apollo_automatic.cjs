'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Automatic=require('../extension/automatic-executor.js');

function page(){
  let clicks=0,sent=0;const selectors=new Map(),listeners=[],extras=[],alerts=[],files=[],metas=[];
  const element=(tag,props={})=>({tagName:tag.toUpperCase(),type:'',name:'',value:'',disabled:false,readOnly:false,required:false,attributes:new Map(),parentElement:null,children:[],style:{display:'block',visibility:'visible',opacity:'1'},
    hasAttribute(name){return this.attributes.has(name);},getAttribute(name){return this.attributes.get(name)??null;},setAttribute(name,value){this.attributes.set(name,String(value));},getClientRects(){return this.hidden?[]:[{}];},focus(){this.onFocus?.();},...props});
  const form=element('form',{action:'https://www.apollo.io/privacy-policy/remove',method:'get',enctype:'application/x-www-form-urlencoded',target:'',noValidate:false,textContent:'Work email\u200bGet verification information',querySelectorAll(){return[];},
    addEventListener(type,callback){if(type==='submit')listeners.push(callback);},removeEventListener(type,callback){const index=listeners.indexOf(callback);if(index>=0)listeners.splice(index,1);},checkValidity(){this.onValidate?.();return this.valid!==false;}});
  const field=element('input',{form,id:'email',name:'email',type:'email',required:true,value:'work@example.test'});
  const label=element('label',{htmlFor:'email',control:field,textContent:'Work email'});field.labels=[label];
  const decorator=element('fieldset',{form,type:'fieldset',textContent:'\u200b'});decorator.setAttribute('aria-hidden','true');
  const button=element('button',{form,type:'submit',textContent:'Get verification information',formNoValidate:false,click(){
    clicks++;this.onClick?.();if(this.noEvent||!form.checkValidity())return;
    const event={target:form,submitter:button,isTrusted:!this.untrusted,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    for(const listener of [...listeners]){listener(event);if(event.stopped)break;}if(!event.defaultPrevented)sent++;
  }});
  Object.defineProperty(form,'elements',{get(){return[field,decorator,button,...extras];}});
  selectors.set('input#email[name="email"][type="email"]',[field]);
  const head=element('head',{appendChild(meta){meta.parentElement=head;meta.isConnected=true;metas.push(meta);}});
  const document={head,querySelectorAll(selector){if(selector==='input[type="file"]')return files;if(selector==='[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors')return alerts;return selectors.get(selector)||[];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;},createElement(tag){return element(tag,{ownerDocument:document,isConnected:false});}};
  const env={document,location:{href:form.action},getComputedStyle:value=>value.style};
  const payload={routeId:'apollo',operationId:'a'.repeat(32),authorized:true,autoSubmit:true,businessEmailConfirmed:true,fields:{business_email:field.value},consentId:Automatic.CONTRACTS.apollo.id};
  return{payload,env,form,field,label,decorator,button,head,document,extras,alerts,files,metas,selectors,clicks:()=>clicks,sent:()=>sent};
}

test('Apollo requires the separately confirmed work email and installs a native GET blocker before one attempt',()=>{
  const p=page();assert.match(Automatic.CONTRACTS.apollo.consentText,/Erase Me authorization/);assert.match(Automatic.CONTRACTS.apollo.consentText,/business email/);
  assert.equal(Automatic.capture(p.payload,p.env).status,'ready');assert.equal(p.metas.length,1);assert.equal(p.metas[0].httpEquiv,'Content-Security-Policy');assert.equal(p.metas[0].content,"form-action 'none'");
  const result=Automatic.submit(p.payload,p.env);assert.equal(result.status,'submission_attempted');assert.equal(result.attempt_verified,true);assert.equal(result.stage,'verification_initiation');
  assert.equal(p.clicks(),1);assert.equal(p.metas.length,1);assert.equal(JSON.stringify(result).includes(p.field.value),false);assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');
});

test('Apollo rejects missing business-email approval, changed native form controls and unavailable CSP support',()=>{
  const changes=[p=>{p.payload.businessEmailConfirmed=false;},p=>{p.payload.authorized=false;},p=>{p.payload.fields.email='not permitted';},p=>{p.payload.consentId='old';},
    p=>{p.form.action+='?email=private';},p=>{p.form.method='post';},p=>{p.form.target='_blank';},p=>{p.form.enctype='text/plain';},p=>{p.form.noValidate=true;},p=>{p.form.setAttribute('onsubmit','nativeFallback()');},
    p=>{p.field.value='other@example.test';},p=>{p.field.required=false;},p=>{p.field.disabled=true;},p=>{p.field.labels=[];},p=>{p.label.htmlFor='different';},p=>{p.label.textContent='Personal email';},
    p=>{p.decorator.disabled=true;},p=>{p.decorator.setAttribute('aria-hidden','false');},p=>{p.decorator.textContent='Different';},p=>{p.form.textContent+=' Additional terms';},p=>{p.extras.push({tagName:'INPUT',type:'hidden'});},
    p=>{p.files.push({});},p=>{p.alerts.push({getClientRects:()=>[{}],style:{}});},p=>{p.document.head=null;},p=>{p.document.createElement=undefined;},
    p=>{p.button.name='unexpected';},p=>{p.button.value='unexpected';},p=>{p.button.formNoValidate=true;},
    ...['formaction','formmethod','formtarget','formenctype','formnovalidate'].map(name=>p=>p.button.setAttribute(name,''))];
  for(const change of changes){const p=page();change(p);assert.equal(Automatic.capture(p.payload,p.env).status,'blocked',change.toString());assert.equal(p.clicks(),0);}
});

test('Apollo pins the CSP element, original fieldset and business approval through validation, focus and submit',()=>{
  for(const change of [p=>{p.metas[0].content='form-action *';},p=>{p.metas[0].parentElement=null;},p=>{p.metas[0].isConnected=false;},p=>{p.document.head={};},
    p=>{p.payload.businessEmailConfirmed=false;},p=>{p.field.value='other@example.test';},p=>{p.decorator.textContent='changed';},
    p=>{p.form.onValidate=()=>p.button.setAttribute('formaction','https://other.example/collect');},p=>{p.button.onFocus=()=>{p.metas[0].content='';};}]){
    const p=page();assert.equal(Automatic.capture(p.payload,p.env).status,'ready');change(p);assert.equal(Automatic.submit(p.payload,p.env).status,'blocked',change.toString());assert.equal(p.clicks(),0);assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');
  }
  for(const mode of ['changed','untrusted','no_event']){const p=page();Automatic.capture(p.payload,p.env);if(mode==='changed')p.button.onClick=()=>p.button.setAttribute('formaction','https://other.example/collect');if(mode==='untrusted')p.button.untrusted=true;if(mode==='no_event')p.button.noEvent=true;
    const result=Automatic.submit(p.payload,p.env);assert.equal(result.status,mode==='no_event'?'unknown':'blocked');assert.equal(p.sent(),0);assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');}
});
