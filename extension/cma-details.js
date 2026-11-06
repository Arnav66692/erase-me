/* Transient CMA marketing-suppression registration; never evidence of source deletion. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else if(!root.EraseCMADetails)root.EraseCMADetails=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const ROUTE='ca-cma-do-not-mail',HOST='cmadnm.cawebhosting.ca',URL='https://cmadnm.cawebhosting.ca/submit.asp';
  const CONTRACT=Object.freeze({id:'cma-registration-2026-11-05-v1',authorization:'I confirm this is my own name and Canadian mailing address. I understand this registers a marketing preference, not deletion of broker records. I authorize only the exact fields and action reviewed here.',notice:'CMA suppresses new-contact addressed marketing from participating members. Registration lasts six years, can take about six weeks to take effect, can stop offers you want, and does not stop unaddressed flyers. No expiry reminder is sent.'});
  const PROVINCES=Object.freeze({AB:'Alberta',BC:'British Columbia',MB:'Manitoba',NB:'New Brunswick',NF:'Newfoundland',NS:'Nova Scotia',ON:'Ontario',PE:'Prince Edward Island',QC:'Quebec',SK:'Saskatchewan',NT:'Northwest Territories',YT:'Yukon',NU:'Nunavut'});
  const KEYS=['first_name','last_name','address1','address2','city','province','postal_code'];
  const LIMITS={first_name:20,last_name:40,address1:45,address2:45,city:30};
  const NOTICE=["The information you submit on this form will only be used to stop unwanted addressed advertising offers from organizations that use CMA's Do Not Mail Service. Before you register please remember that if your name and address are added to the suppression list you could miss out on mailings you may still wish to receive. As your entry will be valid for six years, we suggest you reconsider before registering.",
    'By filling out the form in its entirety you understand that:'];
  const EFFECTS=['it will take approximately six weeks to take effect;','all CMA member companies will remove my name from their new-contact marketing lists;','my name will be retained on the deletion service for six years*;','I will not be reminded when my registration expires;','registering may prevent offers from companies I normally like hearing from (i.e. catalogues, coupon/sample mailers, etc.);','this service cannot stop flyers and other unaddressed advertising mail.'];
  const normal=value=>String(value||'').replace(/\s+/g,' ').trim(),journals=new WeakSet();
  const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  function text(value,max,optional=false){if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f<>/]/.test(value))throw new Error('Review the exact CMA fields. This form removes slashes; use an accurate address format without them.');const cleaned=normal(value);if(!cleaned&&!optional)throw new Error('Complete the required CMA name and mailing-address fields.');return cleaned;}
  function validateDetails(value,options={}){
    if(!exact(value,KEYS))throw new Error('Provide only the reviewed CMA registration fields.');
    const result={};for(const[key,max]of Object.entries(LIMITS))result[key]=text(value[key],max,key==='address2');
    if(options.fullName!==undefined&&normal(result.first_name+' '+result.last_name).normalize('NFC').toLowerCase()!==normal(options.fullName).normalize('NFC').toLowerCase())throw new Error('The first and last name must match your own workspace name.');
    if(!Object.hasOwn(PROVINCES,value.province))throw new Error('Select a province or territory shown by the official CMA form.');result.province=value.province;
    const postal=text(value.postal_code,7).toUpperCase().replace(/\s/g,'');if(!/^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z][0-9][ABCEGHJ-NPRSTV-Z][0-9]$/.test(postal))throw new Error('Enter an accurate Canadian postal code.');
    result.postal_code=postal.slice(0,3)+' '+postal.slice(3);return result;
  }
  function validatePayload(value){
    if(!exact(value,['routeId','operationId','authorized','ownRequestConfirmed','consentId','fullName','details','autoSubmit'])||value.routeId!==ROUTE||! /^[a-f0-9-]{32,40}$/.test(value.operationId||'')||value.authorized!==true||value.ownRequestConfirmed!==true||value.consentId!==CONTRACT.id||typeof value.autoSubmit!=='boolean')throw new Error('Review and authorize your own CMA registration first.');
    const name=text(value.fullName,120),details=validateDetails(value.details,{fullName:name});if(name!==value.fullName||Object.keys(details).some(key=>details[key]!==value.details[key]))throw new Error('Review the normalized CMA fields before filling.');return details;
  }
  function visible(e,env){if(!e||e.hidden||!e.getClientRects?.().length)return false;for(let n=e;n;n=n.parentElement){const s=env.getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}return true;}
  function one(doc,selector){const elements=[...doc.querySelectorAll(selector)];if(elements.length!==1)throw new Error();return elements[0];}
  function inspect(env){
    const doc=env.document;if(env.location.href!==URL||doc.querySelector('input[type="file"],iframe,.g-recaptcha,.cf-turnstile,.h-captcha'))throw new Error();
    const paragraphs=[...doc.querySelectorAll('td.content>p')];if(NOTICE.some(line=>{const matches=paragraphs.filter(e=>normal(e.textContent)===line);return matches.length!==1||!visible(matches[0],env);}))throw new Error();
    const effectLists=[...doc.querySelectorAll('ul.content')];if(effectLists.length!==1||JSON.stringify([...effectLists[0].children].map(e=>normal(e.textContent)))!==JSON.stringify(EFFECTS)||!visible(effectLists[0],env))throw new Error();
    const links=[...doc.querySelectorAll('a')].filter(e=>normal(e.textContent)==='Privacy Policy');if(links.length!==1||links[0].href!=='https://thecma.ca/privacy-policy'||!visible(links[0],env))throw new Error();
    const form=one(doc,'form[name="thisform"]');if(doc.forms.length!==1||form.method!=='post'||form.action!==URL||form.target!==''||form.enctype!=='application/x-www-form-urlencoded'||form.noValidate!==false||form.getAttribute('onsubmit')!=='return validForm(this);')throw new Error();
    const selectors={first_name:'fname',last_name:'lname',address1:'address1',address2:'address2',city:'city',province:'province',postal_first:'pindex1',postal_last:'pindex2'},controls={};
    const maxima={first_name:20,last_name:40,address1:45,address2:45,city:30,postal_first:3,postal_last:3};
    const captions={first_name:'First Name:',last_name:'Last Name:',address1:'Address1:',address2:'Address2:',city:'City:',province:'Province:',postal_first:'Postal Code:',postal_last:'Postal Code:'};
    for(const[key,name]of Object.entries(selectors)){const select=key==='province',e=one(doc,(select?'select':'input')+'[name="'+name+'"]');controls[key]=e;if(e.form!==form||e.disabled||e.readOnly||e.required||!visible(e,env)||e.tagName!==(select?'SELECT':'INPUT')||e.type!==(select?'select-one':'text')||select&&e.multiple!==false||!select&&e.maxLength!==maxima[key]||e.getAttribute('oninput')!==null||e.getAttribute('onchange')!==null||normal(e.closest('td')?.previousElementSibling?.textContent)!==captions[key])throw new Error();}
    const options=[...controls.province.options];if(options.length!==14||options[0].value!=='0'||options[0].disabled||options.slice(1).some((o,i)=>o.disabled||o.value!==Object.keys(PROVINCES)[i]||normal(o.textContent)!==Object.values(PROVINCES)[i]))throw new Error();
    const fixed=[['listID','hidden','47'],['language','hidden','E'],['Services1','checkbox','DNM']],hidden=[];
    for(const[name,type,value]of fixed){const e=one(doc,'input[name="'+name+'"]');if(e.form!==form||e.type!==type||e.value!==value||e.disabled||e.readOnly||e.required||type==='checkbox'&&(e.checked!==true||e.getAttribute('onclick')!=='ChColorDNM(this)'))throw new Error();hidden.push(e);}
    const optional=[];for(const[name,max]of [['strCompany',30],...Array.from({length:3},(_,i)=>[['moreFName'+(i+1),20],['moreLName'+(i+1),40]]).flat()]){const e=one(doc,'input[name="'+name+'"]');if(e.form!==form||e.type!=='text'||e.value!==''||e.maxLength!==max||e.disabled||e.readOnly||e.required)throw new Error();optional.push(e);}
    for(const[value,type,name]of [['Dr','radio','title'],['Mr','radio','title'],['Mrs','radio','title'],['Ms','radio','title'],['Yes','checkbox','deceased']]){const e=one(doc,'input[name="'+name+'"][value="'+value+'"]');if(e.form!==form||e.type!==type||e.checked||e.disabled||e.readOnly||e.required)throw new Error();optional.push(e);}
    const submit=one(doc,'input[name="SUBMIT"][type="submit"]'),reset=one(doc,'input[name="RESET"][type="reset"]');
    for(const[e,value]of [[submit,'Submit Info!'],[reset,'Clear All Info!']])if(e.form!==form||e.value!==value||e.disabled||!visible(e,env)||e.formNoValidate!==false||['formaction','formmethod','formtarget','formenctype','formnovalidate'].some(a=>e.hasAttribute(a)))throw new Error();
    const allowed=new Set([...Object.values(controls),...hidden,...optional,submit,reset]);if([...form.elements].length!==allowed.size||[...form.elements].some(e=>!allowed.has(e)))throw new Error();
    return{doc,form,controls,hidden,optional,submit,reset,policy:links[0],effects:effectLists[0]};
  }
  function execute(payload,env=globalThis){
    try{
      const details=validatePayload(payload),original=inspect(env);if(journals.has(original.doc))return{status:'unknown',detail:'This CMA action already started. No repeat is authorized.'};
      const signature=JSON.stringify(payload),expected=Object.fromEntries(Object.keys(original.controls).map(key=>[key,key==='province'?'0':'']));
      function same(){if(env.document!==original.doc||JSON.stringify(payload)!==signature)throw new Error();const now=inspect(env);for(const key of ['form','submit','reset','policy','effects'])if(now[key]!==original[key])throw new Error();if(now.hidden.some((e,i)=>e!==original.hidden[i])||now.optional.some((e,i)=>e!==original.optional[i])||Object.keys(expected).some(key=>now.controls[key]!==original.controls[key]||now.controls[key].value!==expected[key]))throw new Error();}
      same();journals.add(original.doc);const values={...details,postal_first:details.postal_code.slice(0,3),postal_last:details.postal_code.slice(4)};delete values.postal_code;
      for(const[key,value]of Object.entries(values)){if(value==='')continue;same();const e=original.controls[key],proto=key==='province'?env.HTMLSelectElement.prototype:env.HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(!setter)throw new Error();setter.call(e,value);expected[key]=value;same();e.dispatchEvent(new env.Event('input',{bubbles:true}));same();e.dispatchEvent(new env.Event('change',{bubbles:true}));same();}
      if(!payload.autoSubmit)return{status:'prepared',detail:'CMA fields were filled once. Review and submit on its site. This is a marketing preference, not deletion.'};
      let captured=false,verified=false,failed=false;const stop=event=>{failed=true;event.preventDefault();event.stopImmediatePropagation();};
      const capture=event=>{if(event.target!==original.form)return;try{same();if(!event.isTrusted||event.submitter!==original.submit||captured)throw new Error();captured=true;}catch(_){stop(event);}};
      const bubble=event=>{if(event.target!==original.form)return;try{same();if(!captured||event.defaultPrevented||!event.isTrusted||event.submitter!==original.submit)throw new Error();verified=true;}catch(_){stop(event);}};
      env.addEventListener('submit',capture,true);env.addEventListener('submit',bubble,false);
      try{same();original.submit.focus();same();original.submit.click();}finally{env.removeEventListener('submit',capture,true);env.removeEventListener('submit',bubble,false);}
      if(!captured||!verified||failed)return{status:'unknown',detail:'CMA registration outcome is unknown. Reconcile the existing form; no repeat is authorized.'};
      return{status:'submission_attempted',attempt_verified:true,stage:'marketing_registration',detail:'One checked CMA registration submit event occurred. Delivery and acceptance are unverified; this does not delete broker records.'};
    }catch(_){return{status:'blocked',detail:'The reviewed CMA form or fields changed. No automatic repeat was sent.'};}
  }
  return Object.freeze({ROUTE,HOST,URL,CONTRACT,PROVINCES,validateDetails,validatePayload,execute});
});
