'use strict';
const Automatic=require('../extension/automatic-executor.js'),Base=require('../extension/broker-executor.js');
const ROUTE='truepeoplesearch',CONSENT='I authorize TruePeopleSearch.com to send communications relating to my privacy request to the email address(es) provided. I certify that I am the subject of the request, or an agent authorized to act on behalf of the subject of the request. I understand that information provided relating to this request will not be used for any purpose other than the processing of this request.',PURPOSE="Enter your name and email address – we'll email you a link to the opt-out form to complete the process",TERMS='By using our site and services, you agree to our Terms of Use. Visit our Notice at Collection and Privacy Notice for information about our privacy practices.';
global.getComputedStyle=e=>e.style;
function page(){
  const selectors=new Map(),events=[],listeners=[],extras=[],alerts=[],files=[],links=[];let clicks=0,sent=0;
  const element=(tag,properties={})=>({tagName:tag.toUpperCase(),name:'',value:'',type:'',required:false,disabled:false,readOnly:false,parentElement:null,attributes:new Map(),style:{display:'block',visibility:'visible',opacity:'1'},
    hasAttribute(name){return this.attributes.has(name);},getAttribute(name){return this.attributes.get(name)??null;},setAttribute(name,value){this.attributes.set(name,String(value));},getClientRects(){return this.hidden?[]:[{}];},focus(){this.onFocus?.();},dispatchEvent(event){events.push(event.type);this.onEvent?.(event);return true;},...properties});
  const register=(selector,value)=>{selectors.set(selector,[value]);return value;},route=Base.ROUTES[ROUTE];
  const form=register(route.form,element('form',{method:'post',action:'https://www.truepeoplesearch.com/removal/beginremovalidv',enctype:'application/x-www-form-urlencoded',target:'',noValidate:false,
    querySelectorAll(selector){if(selector==='a')return links;if(selector==='button[type="submit"],input[type="submit"]'||selector==='button[type="submit"]')return[button];return[];},
    addEventListener(type,listener){if(type==='submit')listeners.push(listener);},removeEventListener(type,listener){const index=listeners.indexOf(listener);if(index>=0)listeners.splice(index,1);},checkValidity(){this.onValidate?.();return this.valid!==false;}}));
  form.setAttribute('action','/removal/beginremovalidv');const heading=element('h3',{textContent:'Do Not Sell/Right to Opt-out'}),notice=element('h5',{textContent:PURPOSE});selectors.set('h3',[heading]);selectors.set('h5',[notice]);
  class Input{get value(){return this._value;}set value(value){this._value=value;}get checked(){return this._checked;}set checked(value){this._checked=Boolean(value);}}
  class Select{get value(){return this._value;}set value(value){this._value=value;}}
  const fields={first_name:'Example',last_name:'Person',email:'person@example.test'},controls={},input=properties=>Object.assign(Object.create(Input.prototype),element('input',properties));
  for(const[key,value]of Object.entries(fields)){
    const name={first_name:'FirstName',last_name:'LastName',email:'Email'}[key],caption={first_name:'First Name *',last_name:'Last Name *',email:'Email *'}[key];
    controls[key]=register(route[key],input({form,name,type:key==='email'?'email':'text',required:true,value,maxLength:key==='email'?100:50,placeholder:key==='email'?'Email Address':key==='first_name'?'First Name':'Last Name',labels:[]}));
  }
  const selection=register('#RightsExerciseType',Object.assign(Object.create(Select.prototype),element('select',{form,name:'RightsExerciseType',type:'select-one',multiple:false,value:'subject',labels:[element('label',{textContent:'Exercise my rights as a:'})],options:[{value:'',disabled:true,textContent:'I am'},{value:'subject',disabled:false,textContent:'The subject of the request'},{value:'agent',disabled:false,textContent:'An authorized agent of the subject of the request'}]})));
  const middle=register('#MiddleName',input({form,name:'MiddleName',type:'text',maxLength:50})),agents=['AgentFirstName','AgentLastName','AgentEmail'].map(name=>register('#'+name,input({form,name,type:name==='AgentEmail'?'email':'text',maxLength:name==='AgentEmail'?100:50,hidden:true})));
  const fallback=register(route.form+' input[name="AuthorizeContact"][type="hidden"]',input({form,name:'AuthorizeContact',type:'hidden',hidden:true,value:'false'}));
  const checkbox=register('#AuthorizeContact',input({form,name:'AuthorizeContact',type:'checkbox',required:true,value:'true',labels:[],_checked:false}));checkbox.setAttribute('data-val-required','You must authorize us to send communications');
  const label=element('label',{textContent:CONSENT});checkbox.parentElement={parentElement:{querySelector:selector=>selector==='.col-11'?label:null,style:{display:'block',visibility:'visible',opacity:'1'}},style:{display:'block',visibility:'visible',opacity:'1'}};
  const token=register(route.form+' textarea[name="h-captcha-response"]',element('textarea',{form,type:'textarea',name:'h-captcha-response',hidden:true,value:'synthetic-site-response'}));
  const challengeResponse=register(route.form+' textarea[name="g-recaptcha-response"]',element('textarea',{form,type:'textarea',name:'g-recaptcha-response',hidden:true,value:'synthetic-compatible-response'}));
  const widget=register(route.form+' .h-captcha',element('div'));widget.setAttribute('data-sitekey','8c6693a8-2959-420f-ba6c-474f2460a6cf');
  const challengeScript=element('script',{src:'https://hcaptcha.com/1/api.js'});selectors.set('script[src]',[challengeScript]);
  const button=element('button',{form,type:'submit',textContent:'Send Request',formNoValidate:false,click(){clicks++;this.onClick?.();if(this.noEvent||!form.checkValidity())return;const event={target:form,submitter:button,isTrusted:!this.untrusted,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const listener of [...listeners]){listener(event);if(event.stopped)break;}if(!event.defaultPrevented)sent++;}});
  Object.defineProperty(form,'elements',{get(){return[selection,...Object.values(controls),middle,...agents,checkbox,fallback,token,challengeResponse,button,...extras];}});
  for(const path of ['terms','notice-at-collection','privacy'])links.push(element('a',{href:'https://www.truepeoplesearch.com/'+path}));
  const terms=register(route.form+' small.text-muted',element('small',{textContent:TERMS}));
  const document={title:'Do Not Sell/Right to Opt-out - TruePeopleSearch.com',forms:[{},{},form],querySelectorAll(selector){if(selector==='input[type="file"]')return files;if(selector==='[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors')return alerts;return selectors.get(selector)||[];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;}};
  const env={document,location:{href:route.url},getComputedStyle:value=>value.style,HTMLInputElement:Input,HTMLSelectElement:Select,Event:class{constructor(type,properties){this.type=type;Object.assign(this,properties);}},setTimeout:callback=>callback()};
  const payload={routeId:ROUTE,operationId:'a'.repeat(32),fields,authorized:true,ownRequestConfirmed:true,autoSubmit:true,consentId:Automatic.CONTRACTS[ROUTE].id};
  return{payload,env,form,document,controls,selection,middle,agents,fallback,checkbox,label,token,challengeResponse,widget,challengeScript,button,terms,heading,notice,selectors,extras,alerts,files,links,events,clicks:()=>clicks,sent:()=>sent};
}
module.exports={page,CONSENT,PURPOSE,TERMS};
