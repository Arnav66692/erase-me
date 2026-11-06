/* Reviewed MyLife/JotForm prefill. Extra identity fields are one-action memory only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else if(!root.EraseMyLifeDetails)root.EraseMyLifeDetails=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const ROUTE='mylife',HOST='mylife.jotform.com',ENTRY_HOST='www.mylife.com',FORM_ID='260284407610047';
  const URL='https://'+HOST+'/'+FORM_ID,ENTRY_URL='https://'+ENTRY_HOST+'/privacyrequest';
  const TITLE='DELETION AND OPT OUT OF SALE OF PERSONAL INFORMATION';
  const STATES=Object.freeze('Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'.split('|'));
  const CONTRACT=Object.freeze({id:'mylife-prefill-2026-11-05-v1',authorization:'I confirm these are my own accurate identity details and authorize Erase Me to fill only these reviewed fields once in MyLife’s official JotForm. I will complete any broker verification and submission myself.'});
  const KEYS=['first_name','last_name','state','city','zip_code','birth_year'];
  const NOTICE_HASH='a916016a738b33437c327c6515aed0d7bd0ad818710a87e50f791dc6afff8142';
  const journals=new WeakSet(),normal=value=>String(value||'').replace(/\s+/g,' ').trim();
  const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  const sameName=(first,last,full)=>normal(first+' '+last).normalize('NFKC').toLowerCase()===normal(full).normalize('NFKC').toLowerCase();
  function text(value,max){if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f<>]/.test(value))throw new Error('Review only the requested MyLife fields.');const result=normal(value);if(!result)throw new Error('Complete every required MyLife field.');return result;}
  function validateDetails(value,options={}){
    if(!exact(value,KEYS))throw new Error('Provide only the six reviewed MyLife fields.');
    const first=text(value.first_name,120),last=text(value.last_name,120),state=text(value.state,32),city=text(value.city,120),zip=text(value.zip_code,5),year=text(value.birth_year,4);
    const current=new Date(options.now===undefined?Date.now():options.now).getUTCFullYear();
    if(!STATES.includes(state)||!/^\d{5}$/.test(zip))throw new Error('Choose the accurate US state and five-digit ZIP for your record.');
    if(!/^\d{4}$/.test(year)||!Number.isFinite(current)||!Number.isInteger(options.age)||options.age<18||options.age>120||![current-options.age,current-options.age-1].includes(Number(year)))throw new Error('Enter your accurate birth year compatible with the age in your workspace. Do not guess a year.');
    if(!sameName(first,last,options.fullName))throw new Error('Your reviewed first and last names must match your workspace name. Include any middle name in the first-name field when needed.');
    return{first_name:first,last_name:last,state,city,zip_code:zip,birth_year:year};
  }
  function validatePayload(value,options={}){
    if(!exact(value,['routeId','operationId','authorized','ownRequestConfirmed','consentId','identity','details'])||value.routeId!==ROUTE||!/^[a-f0-9-]{32,40}$/.test(value.operationId||'')||value.authorized!==true||value.ownRequestConfirmed!==true||value.consentId!==CONTRACT.id||!exact(value.identity,['full_name','age']))throw new Error('Review and authorize your own MyLife form first.');
    const full=text(value.identity.full_name,120),details=validateDetails(value.details,{fullName:full,age:value.identity.age,now:options.now});
    if(full!==value.identity.full_name||Object.keys(details).some(key=>details[key]!==value.details[key]))throw new Error('Review the normalized MyLife fields before filling.');
    return{identity:{full_name:full,age:value.identity.age},details};
  }
  function visible(element,env){if(!element||element.hidden||!element.getClientRects?.().length)return false;for(let node=element;node;node=node.parentElement){const style=env.getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}return true;}
  function one(doc,selector){const found=[...doc.querySelectorAll(selector)];if(found.length!==1)throw new Error();return found[0];}
  function inspect(env){
    const doc=env.document;if(env.location.href!==URL||doc.querySelector('input[type="file"]')||doc.forms.length!==1||normal(one(doc,'#header_1').textContent)!==TITLE||normal(one(doc,'#header_4').textContent)!=='Consumer Rights')throw new Error();
    const form=one(doc,'form[id="'+FORM_ID+'"]');
    if(form.action!=='https://'+HOST+'/submit/'+FORM_ID||form.method!=='post'||form.target!==''||form.enctype!=='application/x-www-form-urlencoded'||form.noValidate!==true||form.getAttribute('onsubmit')!=="return typeof testSubmitFunction !== 'undefined' && testSubmitFunction();")throw new Error();
    const notice=one(doc,'#text_19'),noticeText=normal(notice.textContent),privacy=[...notice.querySelectorAll('a')];
    if(privacy.length!==1||privacy[0].href!=='mailto:privacy@MyLife.com'||normal(privacy[0].textContent)!=='privacy@MyLife.com')throw new Error();
    const specs={first_name:['first_6','q6_name[first]','First Name'],last_name:['last_6','q6_name[last]','Last Name'],state:['input_21','q21_state','State:*'],city:['input_11_city','q11_location[city]','City'],zip_code:['input_11_postal','q11_location[postal]','Postal / Zip Code'],birth_year:['input_15','q15_birthYear','Your birth year helps us locate your correct profile.']},controls={};
    for(const[key,[id,name,label]]of Object.entries(specs)){
      const e=one(doc,'#'+id),select=key==='state';controls[key]=e;
      if(e.form!==form||e.name!==name||e.tagName!==(select?'SELECT':'INPUT')||e.type!==(select?'select-one':'text')||!e.required||e.disabled||e.readOnly||!visible(e,env)||e.labels?.length!==1||normal(e.labels[0].textContent)!==label||select&&e.multiple!==false)throw new Error();
    }
    const stateOptions=[...controls.state.options];if(stateOptions.length!==STATES.length+1||stateOptions.some((option,index)=>option.disabled||option.value!==(index===0?'':STATES[index-1])))throw new Error();
    const optionalSpecs=[['input_11_addr_line1','q11_location[addr_line1]','text'],['input_11_addr_line2','q11_location[addr_line2]','text'],['input_11_state','q11_location[state]','text'],['input_7','q7_email','email'],['input_13','q13_middleInitial','text'],['input_14','q14_maidenName','text'],['input_12','q12_enterThe','text']];
    const optional=optionalSpecs.map(([id,name,type])=>{const e=one(doc,'#'+id);if(e.form!==form||e.name!==name||e.type!==type||e.disabled||e.readOnly||e.required||e.value!=='')throw new Error();return e;});
    const hiddenSpecs=[['formID','',FORM_ID],['','JWTContainer',null],['','cardinalOrderNumber',null],['jsExecutionTracker','jsExecutionTracker',null],['submitSource','submitSource',null],['submitDate','submitDate',null],['buildDate','buildDate',null],['uploadServerUrl','','https://upload.jotform.com/upload'],['eventObserver','','1'],['q20_typeA20','input_20',''],['','widget_settings_20',null],['recaptcha_visible','input_8',''],['website','',''],['simple_spc','simple_spc',FORM_ID+'-'+FORM_ID],['event_id','',null],['timeToSubmit','',null],['enterprise_server','enterprise_server',HOST]];
    const hidden=hiddenSpecs.map(([name,id,value])=>{const e=one(doc,id?'#'+id:'input[name="'+name+'"]');if(e.form!==form||e.tagName!=='INPUT'||e.type!=='hidden'||e.name!==name||e.disabled||e.readOnly||e.required!==(name==='recaptcha_visible')||typeof e.value!=='string'||e.value.length>16384||value!==null&&e.value!==value)throw new Error();return e;});
    const captcha=one(doc,'#recaptcha_input_8'),token=one(doc,'textarea#g-recaptcha-response[name="g-recaptcha-response"]');
    if(!form.contains(captcha)||token.form!==form||token.required||token.disabled||token.readOnly||typeof token.value!=='string'||token.value.length>16384||!captcha.contains(token))throw new Error();
    const submit=one(doc,'button#input_2[type="submit"]');if(submit.form!==form||submit.disabled||!visible(submit,env)||normal(submit.textContent)!=='Submit'||submit.formNoValidate!==false||['formaction','formmethod','formtarget','formenctype','formnovalidate'].some(key=>submit.hasAttribute(key)))throw new Error();
    const approved=new Set([...Object.values(controls),...optional,...hidden,token,submit]);if([...form.elements].length!==approved.size||[...form.elements].some(e=>!approved.has(e)))throw new Error();
    return{doc,form,notice,noticeText,controls,optional,hidden,captcha,token,submit};
  }
  async function execute(payload,env=globalThis){
    try{
      const canonical=validatePayload(payload,{now:env.Date?.now?.()}),record=inspect(env),signature=JSON.stringify(payload);
      if(journals.has(record.doc))return{status:'unknown',detail:'This MyLife action already started. No fields were filled again.'};
      if(!env.crypto?.subtle||!env.TextEncoder)throw new Error();
      const digest=[...new Uint8Array(await env.crypto.subtle.digest('SHA-256',new env.TextEncoder().encode(record.noticeText)))].map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!==NOTICE_HASH)throw new Error();
      if(journals.has(record.doc))return{status:'unknown',detail:'This MyLife action already started. No fields were filled again.'};
      const expected=Object.fromEntries(KEYS.map(key=>[key,'']));
      function same(){
        if(env.document!==record.doc||JSON.stringify(payload)!==signature)throw new Error();const fresh=inspect(env);
        if(['form','notice','captcha','token','submit'].some(key=>fresh[key]!==record[key])||fresh.noticeText!==record.noticeText||fresh.optional.some((e,i)=>e!==record.optional[i])||fresh.hidden.some((e,i)=>e!==record.hidden[i])||KEYS.some(key=>fresh.controls[key]!==record.controls[key]||fresh.controls[key].value!==expected[key]))throw new Error();
      }
      same();journals.add(record.doc);
      for(const key of ['state','first_name','last_name','city','zip_code','birth_year']){
        const value=canonical.details[key];
        same();const e=record.controls[key],prototype=key==='state'?env.HTMLSelectElement.prototype:env.HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;if(!setter)throw new Error();setter.call(e,value);expected[key]=value;same();e.dispatchEvent(new env.Event('input',{bubbles:true}));same();e.dispatchEvent(new env.Event('change',{bubbles:true}));same();
      }
      return{status:'prepared',detail:'Reviewed MyLife identity fields were filled once in its official JotForm. Complete any verification and submission yourself. No request acceptance or deletion is established.'};
    }catch(_){return{status:'blocked',detail:'The reviewed MyLife form or fields could not be verified. No automatic submission or repeat was performed.'};}
  }
  return Object.freeze({ROUTE,HOST,ENTRY_HOST,URL,ENTRY_URL,FORM_ID,TITLE,STATES,CONTRACT,validateDetails,validatePayload,execute});
});
