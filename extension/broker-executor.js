/* Approved first-step forms only. Page text never supplies instructions or code. */
(() => {
  'use strict';
  const ROUTES = Object.freeze({
    'peopledatalabs-form': {host:'privacy.peopledatalabs.com',path:'/policies',url:'https://privacy.peopledatalabs.com/policies?action=ERASURE&modal=log-in',email:'#pc-email-login-input',submit:'#email-login-submit',purpose:'erasure'},
    usphonebook: {host:'www.usphonebook.com',path:'/removal',url:'https://www.usphonebook.com/removal',first_name:'#subject-firstname',last_name:'#subject-lastname',email:'#subject-email',form:'#verifyEmailForm'},
    searchpeoplefree: {host:'www.searchpeoplefree.com',path:'/opt-out',url:'https://www.searchpeoplefree.com/opt-out',first_name:'#o_first',last_name:'#o_last',email:'#o_email',form:'#o_form'},
    fastpeoplesearch: {host:'www.fastpeoplesearch.com',path:'/optout',formPath:'/optout-start-submitted',url:'https://www.fastpeoplesearch.com/optout',first_name:'#firstname',last_name:'#lastname',email:'#email',form:'#optout-start'}
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
  function validate(routeId,fields){
    const route=ROUTES[routeId];
    if(!route || !fields || typeof fields!=='object' || Array.isArray(fields))throw new Error('Unsupported form.');
    const keys=['email',...(route.first_name?['first_name','last_name']:[])];
    if(Object.keys(fields).some(k=>!keys.includes(k)) || keys.some(k=>typeof fields[k]!=='string'||!fields[k].trim()||fields[k].length>254||/[\r\n\x00<>]/.test(fields[k])))throw new Error('Invalid fields.');
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email))throw new Error('Invalid email.');
    return route;
  }
  async function execute({routeId,fields}, env=globalThis) {
    const route=validate(routeId,fields),doc=env.document;
    const safe=()=>allowed(env.location.href,route)&&!doc.querySelector('input[type="file"]');
    const wait=ms=>new Promise(resolve=>env.setTimeout(resolve,ms));
    const controls=()=>Object.keys(fields).map(key=>({key,e:doc.querySelector(route[key])}));
    const ready=()=>safe()&&controls().every(({key,e})=>visible(e)&&!e.disabled&&!e.readOnly&&e.tagName==='INPUT'&&(key!=='email'||e.type==='email'));
    for(let i=0;i<40&&!ready();i++){if(!safe())return {status:'blocked',detail:'The official form changed or requires identity documents.'};await wait(250);}
    if(!ready())return {status:'blocked',detail:'The approved form is unavailable. No details were filled.'};
    if(route.purpose==='erasure'&&hasSuccess(doc))return {status:'blocked',detail:'An earlier verification step is already visible. No repeat was sent.'};
    const form=route.form?doc.querySelector(route.form):doc.querySelector(route.submit)?.form;
    // SPF uses a reviewed JavaScript submit handler. Other forms must retain their purpose and destination.
    if(!form || controls().some(({e})=>e.form!==form) || !formAllowed(form.action||env.location.href,route))return {status:'blocked',detail:'The form destination changed.'};
    const modeSelector=routeId==='usphonebook'?'#user-type':routeId==='fastpeoplesearch'?'select[name="am"]':null;
    if(modeSelector){
      const select=doc.querySelector(modeSelector);
      if(!visible(select)||select.disabled||![...select.options].some(o=>o.value==='subject'))return {status:'blocked',detail:'The approved self-request option is unavailable.'};
      const setter=Object.getOwnPropertyDescriptor(env.HTMLSelectElement.prototype,'value').set;
      setter.call(select,'subject');select.dispatchEvent(new env.Event('change',{bubbles:true}));
      if(select.value!=='subject')return {status:'blocked',detail:'The broker did not retain the self-request option.'};
    }
    for(const {key,e} of controls()){
      if(!safe()||controls().some(({e})=>e.form!==form)||!formAllowed(form.action||env.location.href,route))return {status:'blocked',detail:'The broker page changed.'};
      const setter=Object.getOwnPropertyDescriptor(env.HTMLInputElement.prototype,'value').set;
      setter.call(e,fields[key]);e.dispatchEvent(new env.Event('input',{bubbles:true}));e.dispatchEvent(new env.Event('change',{bubbles:true}));
    }
    if(!ready()||!formAllowed(form.action||env.location.href,route)||controls().some(({key,e})=>e.form!==form||e.value!==fields[key]))return {status:'blocked',detail:'The broker did not retain the approved fields.'};
    if(route.purpose!=='erasure')return {status:'prepared',detail:'Your fields are filled on the official page. Review the agreement, complete any challenge, and submit there. The broker email and record-selection steps are still required.'};
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
  const api={ROUTES,allowed,formAllowed,validate,execute};
  globalThis.EraseBrokerExecutor=api;
  if(typeof module!=='undefined')module.exports=api;
})();
