/* 192.com own-record prefill. Its genuine challenge and final submit stay untouched. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else if(!root.EraseDirectorySuppressionDetails)root.EraseDirectorySuppressionDetails=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const ROUTE='192com',HOST='www.192.com',URL='https://www.192.com/c01/new-request/';
  const CANADA_URL='https://www.canada411.ca/help.html?key=faq';
  const ROUTES=Object.freeze({[ROUTE]:Object.freeze({url:URL,host:HOST,name:'192.com',country:'GB'}),canada411:Object.freeze({url:CANADA_URL,host:'www.canada411.ca',name:'Canada411',country:'CA'})});
  const CONTRACT=Object.freeze({id:'192-own-suppression-prefill-2026-11-05-v1',authorization:'I confirm the first name, surname and postcode identify my own record, and that I control the reviewed contact email. I authorize filling only these four fields once. I will complete the genuine challenge, submit and confirm the email on the official service myself.'});
  const CONTRACTS=Object.freeze({[ROUTE]:CONTRACT,canada411:Object.freeze({id:'canada411-own-web-suppression-prefill-2026-11-05-v1',authorization:'I confirm this is my own listed name and Canadian telephone number, and I control the reviewed email. I authorize filling them once with the reason Security/privacy issues. I understand this requests web-only removal and does not change print-directory or Directory Assistance listings. I will complete the genuine image challenge and submit on the official site myself.'})});
  const NOTICES=['You may only complete the form on behalf of yourself or members of your immediate family. Requests to remove any other people will not be carried out.','You will need to supply a valid email address that you control. We will email you a confirmation of your removal request, which will have a confirmation link in it. Your removal will not be processed until this link has been clicked. You may add up to five further inhabitants of the same address. If you would like to remove more people than that you will have to complete a further form.','If you have been registered at any other addresses, an online removal form needs to be completed for each name and address you wish to remove.'];
  const normal=value=>String(value||'').replace(/\s+/g,' ').trim(),exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)),journal=new WeakSet();
  function text(value,max){if(typeof value!=='string'||!normal(value)||value.length>max||/[\x00-\x1f\x7f<>]/.test(value))throw Error('Enter accurate first name, surname, UK postcode and contact email for your own record.');return normal(value);}
  function validateDetails(value,{fullName,routeId=ROUTE}={}){
    if(routeId==='canada411'){
      if(!exact(value,['phone','email']))throw Error('Provide only your own listed telephone number and contact email.');
      const raw=text(value.phone,24),email=text(value.email,100);let phone=raw.replace(/[^0-9]/g,'');if(!/^\+?[0-9 ()-]+$/.test(raw)||raw.startsWith('+')&&!raw.startsWith('+1'))throw Error('Use your own listed Canadian telephone number.');
      if(phone.length===11&&phone.startsWith('1'))phone=phone.slice(1);if(!/^[2-9][0-9]{2}[2-9][0-9]{6}$/.test(phone)||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email))throw Error('Enter an accurate Canadian number and contact email you control.');
      if(fullName!==undefined)text(fullName,100);return{phone,email};
    }
    if(routeId!==ROUTE||!exact(value,['first_name','last_name','postcode','email']))throw Error('Provide only the four reviewed 192.com fields.');
    const first_name=text(value.first_name,75),last_name=text(value.last_name,75),email=text(value.email,75),compact=text(value.postcode,9).toUpperCase().replace(/\s/g,'');
    if(!/^(?:GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})$/.test(compact)||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email))throw Error('Enter an accurate UK postcode and a bare contact email you control.');
    if(/\s/.test(first_name))throw Error('192.com requests your first given name only, without middle names. Type accurate values yourself; hold this route if that format does not fit your name.');
    if(fullName!==undefined){
      const fold=value=>normal(value).normalize('NFC').toLowerCase(),parts=fold(fullName).split(' '),surname=fold(last_name).split(' ');
      // The user explicitly types the surname; compound surnames are preserved.
      // Only intervening profile middle components may be omitted, never changed.
      if(parts.length<=surname.length||fold(first_name)!==parts[0]||surname.join(' ')!==parts.slice(-surname.length).join(' '))throw Error('Your typed first given name and complete surname must match your own workspace name. Middle names are not sent.');
    }
    return{first_name,last_name,postcode:compact.slice(0,-3)+' '+compact.slice(-3),email};
  }
  function validatePayload(value){
    if(!exact(value,['routeId','operationId','authorized','ownRequestConfirmed','consentId','identity','details'])||!Object.hasOwn(ROUTES,value.routeId)||! /^[a-f0-9-]{32,40}$/.test(value.operationId||'')||value.authorized!==true||value.ownRequestConfirmed!==true||value.consentId!==CONTRACTS[value.routeId].id||!exact(value.identity,['full_name']))throw Error('Review your own directory suppression form first.');
    const name=text(value.identity.full_name,value.routeId==='canada411'?100:120),details=validateDetails(value.details,{fullName:name,routeId:value.routeId});if(name!==value.identity.full_name||Object.keys(details).some(k=>details[k]!==value.details[k]))throw Error('Review the normalized directory fields before filling.');return details;
  }
  function visible(e,env){if(!e||e.hidden||!e.getClientRects?.().length)return false;for(let n=e;n;n=n.parentElement){const style=env.getComputedStyle(n);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}return true;}
  function one(scope,selector){const elements=[...scope.querySelectorAll(selector)];if(elements.length!==1)throw Error();return elements[0];}
  function caption(scope,selector,text,env){const found=[...scope.querySelectorAll(selector)].filter(e=>normal(e.textContent)===text);if(found.length!==1||!visible(found[0],env))throw Error();return found[0];}
  function inspect(env){
    const d=env.document;if(env.location.href!==URL||d.querySelector('input[type="file"]'))throw Error();
    const heading=caption(d,'h1','Removal of Personal Data from 192.com',env),purpose=caption(d,'h3','If your personal data is published on 192.com, and you would like us to remove it permanently, please complete the form.',env),notices=NOTICES.map(text=>caption(d,'p',text,env)),privacy=caption(d,'a','Privacy',env);if(privacy.href!=='https://www.192.com/misc/privacy-policy/')throw Error();
    const form=one(d,'form#js-ont-c01-form');if(!visible(form,env)||form.action!==URL||form.getAttribute('action')!=='/c01/new-request/'||form.method!=='post'||form.target!==''||form.enctype!=='application/x-www-form-urlencoded'||form.noValidate||form.getAttribute('onsubmit')!==null||form.getAttribute('data-ont-validator')!=='field-errors'||form.getAttribute('data-ont-notificator')!=='form')throw Error();
    const fieldset=one(form,'fieldset');if(fieldset.form!==form||fieldset.disabled||fieldset.name!=='')throw Error();const legend=caption(fieldset,'legend','Remove People',env),controls={},definitions={first_name:['fullName.forename','text','First Name:','First name only, no middle names!'],last_name:['fullName.surname','text','Surname:','e.g. Smith'],postcode:['postcode','text','Postcode:','e.g. SE1 9EU'],email:['email','email','Email:','e.g. youremail@192.com']};
    for(const[k,[name,type,label,placeholder]]of Object.entries(definitions)){const e=one(form,'input[name="'+name+'"]');if(e.form!==form||e.id!==name||e.type!==type||e.maxLength!==75||e.placeholder!==placeholder||e.autocomplete!=='off'||e.required||e.disabled||e.readOnly||e.pattern!==''||!visible(e,env)||e.labels?.length!==1||normal(e.labels[0].textContent)!==label||!visible(e.labels[0],env)||['oninput','onchange'].some(a=>e.hasAttribute(a))||e.getAttribute('data-ont-validator')!==(['first_name','last_name'].includes(k)?'required':null))throw Error();controls[k]=e;}
    const untouched=[];
    for(let i=0;i<4;i++)for(const part of ['forename','surname']){const name='otherFullNames['+i+'].'+part,e=one(form,'input[name="'+name+'"]');if(e.form!==form||e.type!=='text'||e.id!=='otherFullNames'+i+'.'+part||e.value!==''||e.maxLength!==75||e.required||e.disabled||e.readOnly||e.autocomplete!=='off'||visible(e,env)||e.getAttribute('data-ont-validator')!==null)throw Error();untouched.push(e);}
    const telephone=one(form,'input[name="telephone"]');if(telephone.form!==form||telephone.type!=='text'||telephone.id!=='telephone'||telephone.value!==''||telephone.maxLength!==75||telephone.required||telephone.disabled||telephone.readOnly||telephone.autocomplete!=='off'||telephone.labels?.length!==1||normal(telephone.labels[0].textContent)!=='Telephone (Optional):'||!visible(telephone,env))throw Error();untouched.push(telephone);
    const challengeNotice=caption(form,'.ont-removal-label','Please complete this sum to show you are a real person:',env);
    for(const suffix of ['X','Y','Z']){const e=one(form,'input[name="control'+suffix+'"]');if(e.form!==form||e.type!=='text'||e.id!=='controlReport'+suffix||e.required||e.disabled||e.readOnly||e.size!==1||e.autocomplete!=='off'||! /^[0-9]{0,8}$/.test(e.value))throw Error();untouched.push(e);}
    for(const[name,id]of [['fml','js-ont-c01-fml'],['control','js-ont-c01-control-field']]){const e=one(form,'input[name="'+name+'"]');if(e.form!==form||e.type!=='hidden'||e.id!==id||e.required||e.disabled||e.readOnly||typeof e.value!=='string'||e.value.length>1024||name==='fml'&&!e.value)throw Error();untouched.push(e);}
    const submit=one(form,'input#js-ont-c01-submit[name="submitBtn"]');if(submit.form!==form||submit.type!=='submit'||submit.value!=='Remove'||submit.disabled||!visible(submit,env)||submit.formNoValidate!==false||['formaction','formmethod','formtarget','formenctype','formnovalidate','onclick'].some(k=>submit.hasAttribute(k)))throw Error();
    const allowed=new Set([fieldset,...Object.values(controls),...untouched,submit]);if([...form.elements].length!==allowed.size||[...form.elements].some(e=>!allowed.has(e)))throw Error();return{d,heading,purpose,notices,privacy,legend,fieldset,form,controls,untouched,challengeNotice,submit};
  }
  const canadaGuards=new WeakMap();
  const CANADA_REASON='Security/privacy issues';
  const CANADA_OPTIONS=['Choose',"I've paid my phone company to be unlisted",CANADA_REASON,'Person deceased',"The listed number doesn't belong to me",'Duplicate listing'];
  const CANADA_NOTICE='Your listing will be removed from Canada411.ca only. This action will not affect your Print Directory and Directory Assistance listings. Please fill the form below to submit your request.';
  function canadaBase(env){
    const d=env.document;if(env.location.href!==CANADA_URL||d.querySelector('input[type="file"]'))throw Error();
    const heading=caption(d,'h3#RemoveListing','How do I remove my listing?',env),privacy=caption(d,'a','Privacy Policy',env),link=one(d,'a[data-toggle="modal"][data-target="#sendEmail"]');
    if(privacy.href!=='https://corporate.yp.ca/en/legal-notice/privacy-statement/'||link.getAttribute('href')!=='#'||normal(link.textContent)!=='this link'||!visible(link,env)||normal(link.parentElement?.textContent)!=='To have your listing removed from the Canada411.ca™ Web site only (you preserve your listing in the print directory and Directory Assistance), please click on this link to submit your request.')throw Error();
    const modal=one(d,'#sendEmail');if(modal.getAttribute('role')!=='dialog'||modal.getAttribute('aria-labelledby')!=='ypPrintDirection')throw Error();
    return{d,heading,privacy,link,modal};
  }
  function canadaPolicy(env){
    const d=env.document;let guard=canadaGuards.get(d);
    if(!guard){if(!d.head||!d.createElement)throw Error();const meta=d.createElement('meta');meta.setAttribute('http-equiv','Content-Security-Policy');meta.setAttribute('content',"form-action 'none'");d.head.append(meta);guard={head:d.head,meta};canadaGuards.set(d,guard);}
    if(guard.head!==d.head||guard.meta.parentNode!==guard.head||guard.meta.getAttribute('http-equiv')!=='Content-Security-Policy'||guard.meta.getAttribute('content')!=="form-action 'none'")throw Error();return guard;
  }
  function canadaForm(env){
    const r=canadaBase(env),{d,modal}=r;if(modal.getAttribute('aria-hidden')!=='false'||!visible(modal,env))throw Error();
    const title=caption(modal,'.modal-title','Listing removal',env),notice=caption(modal,'p',CANADA_NOTICE,env),form=one(modal,'form#sendEmailForm');
    if(!visible(form,env)||form.getAttribute('name')!=='sendEmailForm'||form.method!=='post'||form.action!==CANADA_URL||form.getAttribute('action')!==null||form.target!==''||form.enctype!=='application/x-www-form-urlencoded'||form.noValidate!==true||form.getAttribute('onsubmit')!==null)throw Error();
    const controls={},definitions={name:['text',100,'Full Name','e.g. John Smith'],email:['text',100,'Email','e.g. myaddress@email.com'],phoneNumber:['tel',10,'Listed phone number','e.g. 4164125999'],reason:['select-one',null,'Reason for listing removal',null]};
    for(const[key,[type,max,label,placeholder]]of Object.entries(definitions)){
      const e=one(form,(key==='reason'?'select':'input')+'[name="'+key+'"]'),parent=e.closest('.form-group');
      if(e.form!==form||e.type!==type||e.required!==true||e.disabled||e.readOnly||e.id!==''||!visible(e,env)||!parent||normal(one(parent,'label').textContent)!==label||!visible(one(parent,'label'),env)||['oninput','onchange','onclick'].some(a=>e.hasAttribute(a))||key!=='reason'&&(e.maxLength!==max||e.placeholder!==placeholder||e.pattern!==''))throw Error();controls[key]=e;
    }
    if(controls.reason.multiple||JSON.stringify([...controls.reason.options].map(e=>({value:e.value,text:normal(e.textContent),disabled:e.disabled})))!==JSON.stringify(CANADA_OPTIONS.map((text,i)=>({value:i?text:'',text,disabled:false}))))throw Error();
    const challenge=one(form,'input[name="captchaResponse"]'),image=one(form,'img'),comment=one(form,'textarea[name="comment"]'),submit=one(form,'button');
    if(challenge.form!==form||challenge.type!=='text'||challenge.required!==true||challenge.disabled||challenge.readOnly||challenge.maxLength!==-1||!visible(challenge,env)||normal(one(challenge.closest('.form-group'),'label').textContent)!=='Type the characters you see in the picture.'||image.getAttribute('src')!=='/captcha'||!visible(image,env)||comment.form!==form||comment.required||comment.disabled||comment.readOnly||comment.maxLength!==1000||comment.value!==''||!visible(comment,env))throw Error();
    if(submit.form!==form||submit.type!=='submit'||submit.disabled||normal(submit.textContent)!=='Submit'||submit.name!==''||submit.value!==''||submit.formNoValidate!==false||!visible(submit,env)||['formaction','formmethod','formtarget','formenctype','formnovalidate','onclick'].some(a=>submit.hasAttribute(a)))throw Error();
    const allowed=new Set([...Object.values(controls),challenge,comment,submit]);if([...form.elements].length!==allowed.size||[...form.elements].some(e=>!allowed.has(e)))throw Error();
    if([...modal.querySelectorAll('.jsEmailError,.jsEmailError2,.jsEmailError3,.form__step2')].some(e=>visible(e,env)))throw Error();
    return{...r,title,notice,form,controls,challenge,image,comment,submit};
  }
  function prepareCanadaPage(env){
    let original,guard;
    try{original=canadaBase(env);guard=canadaPolicy(env);if(original.modal.getAttribute('aria-hidden')==='false'){canadaForm(env);return Promise.resolve({status:'ready'});}}
    catch(_){return Promise.resolve({status:'blocked',detail:'The published Canada411 web-only removal entry changed. No identity fields were released.'});}
    return new Promise(resolve=>{
      let done=false,observer=null,deadline=null;
      const finish=result=>{if(done)return;done=true;original.modal.removeEventListener('transitionend',check);observer?.disconnect();if(deadline!==null)env.clearTimeout(deadline);resolve(result);};
      function check(){if(done)return;try{const current=canadaBase(env);if(env.document!==original.d||current.modal!==original.modal||current.link!==original.link||current.heading!==original.heading||current.privacy!==original.privacy||canadaPolicy(env)!==guard)throw Error();if(current.modal.getAttribute('aria-hidden')!=='false'||!visible(current.modal,env))return;canadaForm(env);finish({status:'ready'});}catch(_){finish({status:'blocked',detail:'The published Canada411 removal dialog changed. No identity fields were released.'});}}
      try{
        if(!env.MutationObserver||!env.setTimeout||!env.clearTimeout)throw Error();
        observer=new env.MutationObserver(check);observer.observe(original.modal,{attributes:true,childList:true,subtree:true});original.modal.addEventListener('transitionend',check);
        deadline=env.setTimeout(()=>finish({status:'blocked',detail:'The published Canada411 removal dialog did not become ready. No private fields or repeated navigation were sent.'}),1500);
        original.link.click();check();
      }catch(_){finish({status:'blocked',detail:'The published Canada411 removal dialog could not be opened safely. No identity fields were released.'});}
    });
  }
  function executeCanada(payload,env){try{
    const details=validatePayload(payload),original=canadaForm(env);if(journal.has(original.d))return{status:'unknown',detail:'This Canada411 form action already started. No repeat is authorized.'};
    const signature=JSON.stringify(payload),guard=canadaPolicy(env),expected={name:'',email:'',phoneNumber:'',reason:''},challengeValue=original.challenge.value,imageURL=original.image.src;
    function same(){if(env.document!==original.d||JSON.stringify(payload)!==signature||canadaPolicy(env)!==guard)throw Error();const current=canadaForm(env);for(const k of ['heading','privacy','link','modal','title','notice','form','challenge','image','comment','submit'])if(current[k]!==original[k])throw Error();if(current.challenge.value!==challengeValue||current.image.src!==imageURL||Object.keys(expected).some(k=>current.controls[k]!==original.controls[k]||current.controls[k].value!==expected[k]))throw Error();}
    same();journal.add(original.d);const values={name:payload.identity.full_name,email:details.email,phoneNumber:details.phone,reason:CANADA_REASON};
    for(const[k,value]of Object.entries(values)){same();const e=original.controls[k],prototype=k==='reason'?env.HTMLSelectElement.prototype:env.HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;if(!setter)throw Error();setter.call(e,value);expected[k]=value;same();e.dispatchEvent(new env.Event('input',{bubbles:true}));same();e.dispatchEvent(new env.Event('change',{bubbles:true}));same();}
    return{status:'prepared',detail:'Your reviewed Canada411 name, email and listed number were filled with Security/privacy issues. The optional comment and genuine image challenge were unchanged. Submit remains manual; no acceptance or deletion was verified.'};
  }catch(_){return{status:'blocked',detail:'The reviewed Canada411 web-only removal form changed. No automatic submission or repeat was sent.'};}}
  function preparePage(value,env=globalThis){try{if(!exact(value,['routeId'])||!Object.hasOwn(ROUTES,value.routeId))throw Error();if(value.routeId==='canada411')return prepareCanadaPage(env);inspect(env);return{status:'ready'};}catch(_){return{status:'blocked',detail:'The official directory suppression form could not be validated. No identity fields were released.'};}}
  function execute(payload,env=globalThis){try{
    if(payload?.routeId==='canada411')return executeCanada(payload,env);
    const details=validatePayload(payload),original=inspect(env);if(journal.has(original.d))return{status:'unknown',detail:'This 192.com form action already started. No repeat is authorized.'};const signature=JSON.stringify(payload),expected=Object.fromEntries(Object.keys(original.controls).map(k=>[k,''])),untouched=original.untouched.map(e=>e.value);
    function same(){if(env.document!==original.d||JSON.stringify(payload)!==signature)throw Error();const current=inspect(env);for(const k of ['heading','purpose','privacy','legend','fieldset','form','challengeNotice','submit'])if(current[k]!==original[k])throw Error();if(current.notices.some((e,i)=>e!==original.notices[i])||current.untouched.some((e,i)=>e!==original.untouched[i]||e.value!==untouched[i])||Object.keys(expected).some(k=>current.controls[k]!==original.controls[k]||current.controls[k].value!==expected[k]))throw Error();}
    same();journal.add(original.d);const setter=Object.getOwnPropertyDescriptor(env.HTMLInputElement.prototype,'value')?.set;if(!setter)throw Error();
    for(const[k,value]of Object.entries(details)){same();const e=original.controls[k];setter.call(e,value);expected[k]=value;same();e.dispatchEvent(new env.Event('input',{bubbles:true}));same();e.dispatchEvent(new env.Event('change',{bubbles:true}));same();}
    return{status:'prepared',detail:'Your four reviewed 192.com fields were filled once. Optional telephone, other people and the genuine arithmetic challenge were left unchanged. Submit and email confirmation remain manual; no deletion was verified.'};
  }catch(_){return{status:'blocked',detail:'The reviewed 192.com form or identity fields changed. No automatic submission or repeat was sent.'};}}
  return Object.freeze({ROUTE,HOST,URL,ROUTES,CONTRACT,CONTRACTS,validateDetails,validatePayload,preparePage,execute});
});
