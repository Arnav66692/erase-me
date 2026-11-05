/* Approved first-step forms only. Page text never supplies instructions or code. */
(() => {
  'use strict';
  const ROUTES = Object.freeze({
    'peopledatalabs-form': {host:'privacy.peopledatalabs.com',path:'/policies',url:'https://privacy.peopledatalabs.com/policies?action=ERASURE&modal=log-in',email:'#pc-email-login-input',submit:'#email-login-submit',purpose:'erasure'},
    usphonebook: {host:'www.usphonebook.com',path:'/removal',url:'https://www.usphonebook.com/removal',first_name:'#subject-firstname',last_name:'#subject-lastname',email:'#subject-email',form:'#verifyEmailForm',method:'post'},
    searchpeoplefree: {host:'www.searchpeoplefree.com',path:'/opt-out',url:'https://www.searchpeoplefree.com/opt-out',first_name:'#o_first',last_name:'#o_last',email:'#o_email',form:'#o_form',method:'get'},
    fastpeoplesearch: {host:'www.fastpeoplesearch.com',path:'/optout',formPath:'/optout-start-submitted',url:'https://www.fastpeoplesearch.com/optout',first_name:'#firstname',last_name:'#lastname',email:'#email',form:'#optout-start',method:'post'},
    apollo: {host:'www.apollo.io',path:'/privacy-policy/remove',url:'https://www.apollo.io/privacy-policy/remove',business_email:'input#email[name="email"][type="email"]',method:'get',submitText:'Get verification information'},
    spokeo: {host:'www.spokeo.com',path:'/optout',url:'https://www.spokeo.com/optout',listing_url:'input[name="url"][type="url"]',email:'input[name="email"][type="email"]',method:'get',submitText:'OPT OUT'},
    advancedbackgroundchecks: {host:'www.advancedbackgroundchecks.com',path:'/opt-out',url:'https://www.advancedbackgroundchecks.com/opt-out',first_name:'#sfn',last_name:'#sln',email:'#semail',method:'get',submitText:'Submit',ownRequest:true,selection:{selector:'#mode',value:'subject'}},
    'tr-nosorgulama': {host:'www.nosorgulama.com.tr',path:'/iletisim/',url:'https://www.nosorgulama.com.tr/iletisim/',full_name:'#ic-ad[name="ad_soyad"]',email:'#ic-email[name="email"]',request_text:'#ic-mesaj[name="mesaj"]',method:'post',submitText:'Mesajı Gönder',ownRequest:true,selection:{selector:'#ic-konu[name="konu"]',value:'profil-kaldir'}},
    'tr-numaraara': {host:'www.numaraara.com',path:'/iletisim',formPath:'/Contact/ContactFormSend',url:'https://www.numaraara.com/iletisim',form:'form#contactForm',full_name:'#form_AdSoyad[name="form.AdSoyad"]',email:'#form_Eposta[name="form.Eposta"]',request_text:'#form_Mesaj[name="form.Mesaj"]',method:'post',submitText:'Talebi Gönder',ownRequest:true,selection:{selector:'#form_Konu[name="form.Konu"]',value:'Numara Silme Talebi (KVKK)'}},
    'tr-numarasor': {host:'www.numarasor.com',path:'/numara-kaldirma-talebi',url:'https://www.numarasor.com/numara-kaldirma-talebi',full_name:'#name[name="name"]',email:'#email[name="email"]',phone:'#number[name="number"]',request_text:'#reason[name="reason"]',method:'post',submitText:'Talebi Gönder',ownRequest:true,selection:{selector:'#relation[name="relation"]',value:'Numara sahibiyim'}},
    'tr-telefonsorgulama': {host:'www.telefonsorgulama.com',path:'/iletisim.html',formPath:'/iletisim-gonder.php',url:'https://www.telefonsorgulama.com/iletisim.html',form:'form#iletisimForm',full_name:'#iletisimForm input[name="name"]',email:'#iletisimForm input[name="email"]',request_text:'#iletisimForm textarea[name="message"]',method:'post',submitText:'Mesajı Gönder',ownRequest:true,selection:{selector:'#iletisimForm select[name="subject"]',value:'kaldirma'}}
  });
  function allowed(url, route) {
    try {
      const u=new URL(url);
      if(u.protocol!=='https:' || u.hostname!==route.host || u.port || u.username || u.password || u.pathname!==route.path || u.hash)return false;
      const q=[...u.searchParams];
      if(route.purpose==='erasure')return q.length===2 && u.searchParams.getAll('action').length===1 && u.searchParams.get('action')==='ERASURE' && u.searchParams.getAll('modal').length===1 && u.searchParams.get('modal')==='log-in';
      return q.length===0;
    } catch (_) {return false;}
  }
  function formAllowed(url, route) { return allowed(url, route.formPath ? {...route,path:route.formPath,purpose:null} : route); }
  function visible(e) {
    if(!e || e.hidden || !e.getClientRects().length)return false;
    for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}
    return true;
  }
  function hasSuccess(doc) {return [...doc.querySelectorAll('[role="alert"]')].some(e=>visible(e)&&e.textContent.trim()==='Email sent!');}
  const STATE_NAMES='Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District-of-Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New-Hampshire|New-Jersey|New-Mexico|New-York|North-Carolina|North-Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode-Island|South-Carolina|South-Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West-Virginia|Wisconsin|Wyoming';
  const STATE_CODES=/^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/;
  function listingURL(value){
    try{
      if(typeof value!=='string'||value.length>2048||/[\s%\\]/.test(value))return false;
      const u=new URL(value),parts=u.pathname.split('/').slice(1),city=/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
      return u.protocol==='https:'&&u.hostname==='www.spokeo.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&parts.length===4&&
        /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(parts[0])&&/^p[0-9]{1,64}$/.test(parts[3])&&
        ((city.test(parts[1])&&STATE_CODES.test(parts[2]))||(new RegExp('^(?:'+STATE_NAMES+')$','i').test(parts[1])&&city.test(parts[2])));
    }catch(_){return false;}
  }
  function fieldKeys(route){return ['email','first_name','last_name','business_email','listing_url','full_name','phone','request_text'].filter(key=>route[key]);}
  function validField(key,value){
    if(typeof value!=='string'||!value.trim())return false;
    if(key==='request_text')return value.trim().length>=10&&value.length<=5000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
    if(key==='phone')return value.length<=40&&/^\+?[0-9 ().-]+$/.test(value)&&(value.match(/[0-9]/g)||[]).length>=7&&(value.match(/[0-9]/g)||[]).length<=15;
    return value.length<=(key==='listing_url'?2048:key==='full_name'?120:254)&&!/[\x00-\x1f\x7f<>]/.test(value);
  }
  function expectedValue(key,value){return key==='request_text'?value.replace(/\r\n?/g,'\n'):value;}
  function validate(routeId,fields,approval={}){
    const route=ROUTES[routeId];
    if(!route || !fields || typeof fields!=='object' || Array.isArray(fields))throw new Error('Unsupported form.');
    const keys=fieldKeys(route);
    if(Object.keys(fields).length!==keys.length || Object.keys(fields).some(k=>!keys.includes(k)) || keys.some(k=>!validField(k,fields[k])))throw new Error('Invalid fields.');
    for(const key of ['email','business_email'])if(keys.includes(key)&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields[key]))throw new Error('Invalid email.');
    if(routeId==='apollo'&&approval.businessEmailConfirmed!==true)throw new Error('Confirm the business email associated with your own Apollo record.');
    if(routeId==='spokeo'&&(!listingURL(fields.listing_url)||approval.listingConfirmed!==true))throw new Error('Confirm the exact Spokeo listing is your own.');
    if(route.ownRequest&&approval.ownRequestConfirmed!==true)throw new Error('Confirm that this is your own request and review the exact fields first.');
    return route;
  }
  function formFor(doc,route){return route.form?doc.querySelector(route.form):route.submit?doc.querySelector(route.submit)?.form:doc.querySelector(route[fieldKeys(route)[0]])?.form;}
  function usphonebookAcknowledgment(doc){
    const normalized=e=>e.textContent.replace(/\s+/g,' ').trim().replace(/’/g,"'");
    const headings=[...doc.querySelectorAll('h1,h2,h3,h4,h5,h6,span')].filter(visible).map(normalized);
    const pattern=/^An email has been sent to ([^<>]{1,254}) - ([^@\s]+@[^@\s]+\.[^@\s]+)\. Please check your inbox and follow the instructions in the email to complete the opt out process\.$/;
    const paragraphs=[...doc.querySelectorAll('p')].filter(visible).map(normalized).map(value=>value.match(pattern)).filter(Boolean);
    if(!headings.includes('Verify Emial Sent')||!headings.includes("You're not done")||paragraphs.length!==1)return null;
    return {name:paragraphs[0][1],email:paragraphs[0][2]};
  }
  function inspect({routeId},env=globalThis){
    const route=ROUTES[routeId],doc=env.document;
    if(!route||!allowed(env.location.href,route)||doc.querySelector('input[type="file"]'))return {safe:false};
    const form=formFor(doc,route),fields=fieldKeys(route).map(key=>doc.querySelector(route[key]));
    const formPresent=!!form&&formAllowed(form.action||env.location.href,route)&&fields.every(e=>visible(e)&&e.form===form);
    const acknowledgment=routeId==='usphonebook'?usphonebookAcknowledgment(doc):null;
    const success=routeId==='peopledatalabs-form'?hasSuccess(doc):!!acknowledgment;
    const navigation=routeId==='usphonebook'?{type:env.performance?.getEntriesByType?.('navigation')?.[0]?.type||null,
      startedAt:Number.isFinite(env.performance?.timeOrigin)?env.performance.timeOrigin:null,fromInitial:doc.referrer===route.url}:null;
    return {safe:true,formPresent,success,observable:['peopledatalabs-form','usphonebook'].includes(routeId),
      ...(routeId==='usphonebook'?{acknowledgment,navigation}:{})};
  }
  function armSubmitIntent(payload,route,form,env){
    if(!['peopledatalabs-form','usphonebook'].includes(payload.routeId)||!/^[a-f0-9-]{32,40}$/.test(payload.operationId||'')||
      !/^[a-f0-9]{32}$/.test(payload.observationNonce||'')||!env.chrome?.runtime?.sendMessage||!form.addEventListener)return false;
    // Expected values live only in this isolated-world closure, never extension storage.
    const expected={...payload.fields};
    form.addEventListener('submit',event=>{
      if(event.isTrusted!==true||event.target!==form)return;
      const fieldsMatch=allowed(env.location.href,route)&&!env.document.querySelector('input[type="file"]')&&formAllowed(form.action||env.location.href,route)&&
        Object.entries(expected).every(([key,value])=>{const e=env.document.querySelector(route[key]);return visible(e)&&e.form===form&&e.value===value;});
      try{env.chrome.runtime.sendMessage({type:'erase-broker-submit-intent',routeId:payload.routeId,operationId:payload.operationId,
        nonce:payload.observationNonce,fieldsMatch,submittedAt:Date.now()},()=>{void env.chrome.runtime.lastError;});}catch(_){}
    });
    return true;
  }
  function continuationURL(value) {
    try {
      if(typeof value!=='string'||value.length>2048||/\s/.test(value))return false;
      const u=new URL(value),key=u.searchParams.get('key');
      return u.protocol==='https:'&&u.hostname==='www.usphonebook.com'&&!u.port&&!u.username&&!u.password&&!u.hash&&
        u.pathname==='/removal/validate-record-info'&&[...u.searchParams].length===2&&u.searchParams.getAll('key').length===1&&
        typeof key==='string'&&key.length<=512&&/^[A-Za-z0-9_-]+={0,2}$/.test(key)&&u.searchParams.getAll('ticketid').length===1&&/^[0-9]{1,32}$/.test(u.searchParams.get('ticketid'));
    }catch(_){return false;}
  }
  function validateContinuation(payload) {
    const {routeId,operationId,requestId,receiptRef,confirmationUrl,contactEmail,fields,authorized}=payload||{};
    if(routeId!=='usphonebook'||authorized!==true||!/^[a-f0-9-]{32,40}$/.test(operationId||'')||!/^[a-f0-9]{32}$/.test(requestId||'')||
      !/^[a-f0-9]{64}$/.test(receiptRef||'')||!continuationURL(confirmationUrl)||!fields||Object.keys(fields).length!==6||
      !['first_name','last_name','email','city','state','zip_code'].every(k=>Object.hasOwn(fields,k)))throw new Error('Unsupported confirmation form.');
    validate('usphonebook',{first_name:fields.first_name,last_name:fields.last_name,email:fields.email});
    if(contactEmail!==fields.email||!new RegExp('^[a-z0-9._-]{1,25}\\+erase-'+requestId+'@(?:gmail\\.com|googlemail\\.com)$').test(contactEmail)||
      typeof fields.city!=='string'||!fields.city.trim()||fields.city.length>120||/[\r\n\x00<>]/.test(fields.city)||
      !/^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|AA|AE|AP|AS|FM|GU|MH|MP|PR|PW|VI)$/.test(fields.state)||!/^\d{5}$/.test(fields.zip_code))throw new Error('Review the authorized confirmation fields.');
    return {host:'www.usphonebook.com',path:'/removal/validate-record-info',url:confirmationUrl};
  }
  async function executeContinuation(payload,env=globalThis) {
    validateContinuation(payload);
    const doc=env.document,fields=payload.fields,selectors={first_name:'#subject-firstname',last_name:'#subject-lastname',email:'#subject-email',city:'#subject-city',state:'#subject-state',zip_code:'#subject-zipcode'};
    const formURL='https://www.usphonebook.com/removal/validate-record-info';
    const form=()=>doc.querySelector('#removalForm');
    const safe=()=>env.location.href===payload.confirmationUrl&&continuationURL(env.location.href)&&!doc.querySelector('input[type="file"]');
    const controls=()=>Object.entries(selectors).map(([key,selector])=>({key,e:doc.querySelector(selector)}));
    const destination=()=>form()&&form().method?.toLowerCase()==='post'&&form().action===formURL;
    const ready=()=>safe()&&destination()&&controls().every(({key,e})=>visible(e)&&!e.disabled&&!e.readOnly&&e.form===form()&&
      (key==='state'?e.tagName==='SELECT'&&[...e.options].some(o=>o.value===fields.state):e.tagName==='INPUT'&&(key!=='email'||e.type==='email')));
    const wait=ms=>new Promise(resolve=>env.setTimeout(resolve,ms));
    for(let i=0;i<40&&!ready();i++){if(!safe())return {status:'blocked',detail:'The reviewed confirmation page changed. No fields were filled.'};await wait(250);}
    if(!ready())return {status:'blocked',detail:'The reviewed confirmation form is unavailable. No fields were filled.'};
    for(const selector of ['#subject-dob','#subject-phone','#subject-streetaddress']){
      const optional=doc.querySelector(selector);
      if(!optional||optional.form!==form()||optional.value)return {status:'blocked',detail:'The confirmation form contains additional personal fields. Review it directly; no extra details were supplied.'};
    }
    for(const key of Object.keys(selectors)){
      const e=doc.querySelector(selectors[key]);
      if(!ready()||e!==doc.querySelector(selectors[key])||e.form!==form())return {status:'blocked',detail:'The confirmation form changed before fields could be retained.'};
      const prototype=key==='state'?env.HTMLSelectElement.prototype:env.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype,'value').set.call(e,fields[key]);
      e.dispatchEvent(new env.Event('input',{bubbles:true}));e.dispatchEvent(new env.Event('change',{bubbles:true}));
      if(!ready()||e!==doc.querySelector(selectors[key])||e.form!==form())return {status:'blocked',detail:'The confirmation form changed after a field was filled.'};
    }
    if(!ready()||controls().some(({key,e})=>e.value!==fields[key]))return {status:'blocked',detail:'The broker did not retain the approved confirmation fields.'};
    return {status:'prepared',detail:'The authorized name, city, state, ZIP and contact fields are filled. USPhonebook also requires either date of birth or street address: enter one directly on its official form. Erase Me does not collect or autofill it. Review the accuracy statement, complete the broker challenge and choose Confirm Removal Process there. Request acceptance and deletion remain unverified.'};
  }
  async function execute(payload, env=globalThis) {
    const {routeId,fields}=payload,route=validate(routeId,fields,payload),doc=env.document;
    const safe=()=>allowed(env.location.href,route)&&!doc.querySelector('input[type="file"]');
    const wait=ms=>new Promise(resolve=>env.setTimeout(resolve,ms));
    const controls=()=>Object.keys(fields).map(key=>({key,e:doc.querySelector(route[key])}));
    const ready=()=>safe()&&controls().every(({key,e})=>visible(e)&&!e.disabled&&!e.readOnly&&
      (key==='request_text'?e.tagName==='TEXTAREA':e.tagName==='INPUT'&&
      (['email','business_email'].includes(key)?e.type==='email':key==='listing_url'?e.type==='url':key==='phone'?e.type==='tel':e.type==='text')));
    for(let i=0;i<40&&!ready();i++){if(!safe())return {status:'blocked',detail:'The official form changed or requires identity documents.'};await wait(250);}
    if(!ready())return {status:'blocked',detail:'The approved form is unavailable. No details were filled.'};
    if(inspect({routeId},env).success)return {status:'blocked',detail:'An earlier verification step is already visible. No repeat was sent.'};
    const form=formFor(doc,route);
    // SPF uses a reviewed JavaScript submit handler. Other forms must retain their purpose and destination.
    if(!form || controls().some(({e})=>e.form!==form) || !formAllowed(form.action||env.location.href,route))return {status:'blocked',detail:'The form destination changed.'};
    const selection=route.selection||(routeId==='usphonebook'?{selector:'#user-type',value:'subject'}:routeId==='fastpeoplesearch'?{selector:'select[name="am"]',value:'subject'}:null);
    let selectionApplied=false;
    const selectionReady=()=>!selection||(()=>{const e=doc.querySelector(selection.selector);return visible(e)&&e.tagName==='SELECT'&&e.form===form&&!e.disabled&&!e.readOnly&&
      [...e.options].some(option=>option.value===selection.value)&&(!selectionApplied||e.value===selection.value);})();
    const exactDestination=()=>formAllowed(form.action||env.location.href,route)&&(!route.method||form.method?.toLowerCase()===route.method)&&selectionReady()&&
      (!route.submitText||(()=>{const buttons=[...form.querySelectorAll('button[type="submit"]')];return buttons.length===1&&visible(buttons[0])&&buttons[0].form===form&&buttons[0].textContent.trim()===route.submitText;})());
    if(!exactDestination())return {status:'blocked',detail:'The reviewed form purpose or submit control changed.'};
    if(selection){
      const select=doc.querySelector(selection.selector);
      const setter=Object.getOwnPropertyDescriptor(env.HTMLSelectElement.prototype,'value').set;
      setter.call(select,selection.value);select.dispatchEvent(new env.Event('input',{bubbles:true}));select.dispatchEvent(new env.Event('change',{bubbles:true}));
      selectionApplied=true;
      if(!ready()||!exactDestination())return {status:'blocked',detail:'The broker did not retain the approved request purpose.'};
    }
    for(const key of Object.keys(fields)){
      const e=doc.querySelector(route[key]);
      if(!ready()||e!==doc.querySelector(route[key])||e.form!==form||controls().some(({e})=>e.form!==form)||!exactDestination())return {status:'blocked',detail:'The broker page changed.'};
      const setter=Object.getOwnPropertyDescriptor(key==='request_text'?env.HTMLTextAreaElement.prototype:env.HTMLInputElement.prototype,'value').set;
      setter.call(e,fields[key]);e.dispatchEvent(new env.Event('input',{bubbles:true}));e.dispatchEvent(new env.Event('change',{bubbles:true}));
      if(!ready()||e!==doc.querySelector(route[key])||e.form!==form||controls().some(({e})=>e.form!==form)||!exactDestination())return {status:'blocked',detail:'The broker page changed after a field was filled.'};
    }
    if(!ready()||!exactDestination()||controls().some(({key,e})=>e.form!==form||e.value!==expectedValue(key,fields[key])))return {status:'blocked',detail:'The broker did not retain the approved fields.'};
    armSubmitIntent(payload,route,form,env);
    if(route.purpose!=='erasure')return {status:'prepared',detail:route.ownRequest?'Your approved request fields are filled on the official page. Review the request, consent and any broker verification before submitting there. The companion has not sent a request or verified deletion.':'Your fields are filled on the official page. Review the agreement, complete any challenge, and submit there. The broker email and record-selection steps are still required.'};
    const button=doc.querySelector(route.submit);
    if(!visible(button)||button.form!==form||!formAllowed(button.form.action||env.location.href,route)||button.disabled||button.type!=='submit'||hasSuccess(doc))return {status:'blocked',detail:'The verification control is unavailable.'};
    button.click();
    for(let i=0;i<40;i++){
      if(!safe())return {status:'unknown',detail:'The portal changed after submission. Check the broker page before any further action.'};
      if(hasSuccess(doc))return {status:'verification_sent',route_verified:true,evidence:'fresh_visible_success',detail:'The broker reports sending a verification email. Open it yourself and finish the deletion portal.'};
      await wait(250);
    }
    return {status:'unknown',detail:'The broker outcome is unconfirmed. No automatic repeat will be sent.'};
  }
  const api={ROUTES,allowed,formAllowed,listingURL,validate,execute,inspect,continuationURL,validateContinuation,executeContinuation};
  globalThis.EraseBrokerExecutor=api;
  if(typeof module!=='undefined')module.exports=api;
})();
