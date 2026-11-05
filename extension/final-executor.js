/* One approved final-form attempt. Identity details stay in this document's action. */
(function(root){
  'use strict';
  if(root.EraseFinalExecutor?.version==='final-executor-v2'){
    if(typeof module!=='undefined')module.exports=root.EraseFinalExecutor;
    return;
  }
  const BASE=root.EraseBrokerExecutor||(typeof require==='function'?require('./broker-executor.js'):null);
  const DETAILS=root.EraseIdentityDetails||(typeof require==='function'?require('./identity-details.js'):null);
  const ID=/^[a-f0-9-]{32,40}$/,HEX32=/^[a-f0-9]{32}$/,HEX64=/^[a-f0-9]{64}$/;
  const journals=new WeakMap(),normal=value=>String(value||'').replace(/\s+/g,' ').trim();
  const failure=(reason,detail='The reviewed final form changed. No automatic repeat is allowed.')=>({status:'blocked',reason,detail});
  function reject(reason){const error=new Error(reason);error.reason=reason;throw error;}
  function object(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}
  function validate(payload){
    if(!BASE||!DETAILS||!object(payload,['routeId','operationId','requestId','receiptRef','submissionId','authorized','consentId','fields','details','requirements'])||
      payload.routeId!=='fastpeoplesearch'||payload.authorized!==true||!ID.test(payload.operationId||'')||!ID.test(payload.submissionId||'')||
      !HEX32.test(payload.requestId||'')||!HEX64.test(payload.receiptRef||'')||payload.consentId!==DETAILS.CONTRACTS?.fastpeoplesearch?.id)
      throw new Error('Review and authorize the supported final form first.');
    BASE.validate('fastpeoplesearch',payload.fields);
    if(!new RegExp('^[a-z0-9._-]{1,25}\\+erase-'+payload.requestId+'@(?:gmail\\.com|googlemail\\.com)$').test(payload.fields.email))
      throw new Error('Use this operation’s approved removal contact.');
    DETAILS.validateRequirements(payload.requirements);
    const details=DETAILS.validate(payload.details,{requirements:payload.requirements});
    if(!object(payload.details,Object.keys(details))||Object.keys(details).some(key=>details[key]!==payload.details[key]))
      throw new Error('Review the exact identity and location fields first.');
    return details;
  }
  function visible(element,env){
    if(!element||element.hidden||!element.getClientRects?.().length)return false;
    for(let node=element;node;node=node.parentElement){const style=env.getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}
    return true;
  }
  function one(doc,selector){const values=[...doc.querySelectorAll(selector)];if(values.length!==1)reject('changed_controls');return values[0];}
  function option(select,value){
    const values=[...select.options].filter(item=>!item.disabled&&item.value===value);
    if(values.length!==1)reject('changed_options');
    return values[0].value;
  }
  function numericOption(select,value){
    const values=[...select.options].filter(item=>!item.disabled&&/^[0-9]{1,4}$/.test(item.value)&&Number(item.value)===value);
    if(values.length!==1)reject('changed_options');
    return values[0].value;
  }
  function inspect(payload,env,preflight=false){
    if(preflight)BASE.validate('fastpeoplesearch',payload.fields);else validate(payload);
    const doc=env.document,url=env.location.href;
    if(!BASE.continuationURL(url,'fastpeoplesearch',payload.fields)||doc.querySelector('input[type="file"]'))reject('changed_destination');
    const form=one(doc,'form#optout-removal');
    if(form.tagName!=='FORM'||form.method?.toLowerCase()!=='post'||form.action!=='https://www.fastpeoplesearch.com/optout/removal')reject('changed_destination');
    if([...doc.querySelectorAll('[role="alert"],.alert-danger,.alert-success,.validation-summary-errors')].some(element=>visible(element,env)))reject('existing_alert');
    const selectors={first_name:'input#firstname[name="firstname"][type="text"]',last_name:'input#lastname[name="lastname"][type="text"]',email:'input#email[name="email"][type="email"]',
      middle:'input#middlename[name="middlename"][type="text"]',month:'select[name="dobMonth"]',day:'select[name="dobDay"]',year:'select[name="dobYear"]',
      street:'input#streetAddress[name="streetAddress"][type="text"]',city:'input#city[name="city"][type="text"]',state:'select#state[name="state"]',zip:'input#zipcode[name="zipcode"][type="text"]',phone:'input#phone[name="phone"][type="text"]',
      legal:'#optout-removal input[name="legal"][type="checkbox"]',ticket:'#optout-removal input[name="ticketid"][type="hidden"]',token:'#optout-removal input[name="cf-turnstile-response"][type="hidden"]'};
    const controls=Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,one(doc,selector)]));
    for(const [key,element]of Object.entries(controls)){
      if(element.form!==form||element.disabled||element.readOnly||!['ticket','token'].includes(key)&&!visible(element,env)||
        ['month','day','year','state'].includes(key)&&(element.tagName!=='SELECT'||element.multiple===true))reject('changed_controls');
    }
    if(!preflight){
      for(const key of ['first_name','last_name','email'])if(controls[key].value!==payload.fields[key])reject('changed_identity');
      if(controls.middle.value!==''||controls.ticket.value!==new URL(url).searchParams.get('ticketid'))reject('changed_identity');
      if(typeof controls.token.value!=='string'||controls.token.value.length>16384)reject('changed_challenge');
    }
    const contract=DETAILS.CONTRACTS.fastpeoplesearch,legal=controls.legal;
    if(!legal.required||legal.value!=='on'||!legal.labels||legal.labels.length!==0)reject('changed_consent');
    const label=legal.parentElement;
    if(!label||label.tagName!=='DIV'||!visible(label,env))reject('changed_consent');
    const statement=normal(label.textContent),consent=normal(contract.consentText),warning=normal(contract.warningText);
    const introduction='By checking the checkbox below, you agree to the following statement:';
    if(statement!=='* '+warning+' '+introduction+' '+consent||label.querySelectorAll('a').length)reject('changed_consent');
    if(!warning||!normal(form.textContent).includes(warning))reject('changed_consent');
    const widgets=[...doc.querySelectorAll('#optout-removal .cf-turnstile')];
    const submits=[...form.querySelectorAll('button[type="submit"],input[type="submit"]')];
    if(widgets.length!==1||!visible(widgets[0],env)||submits.length!==1)reject('changed_controls');
    const button=submits[0];
    if(button.tagName!=='BUTTON'||button.form!==form||button.disabled||!visible(button,env)||normal(button.textContent)!=='Submit')reject('changed_submit');
    const approved=new Set([...Object.values(controls),button]);
    for(const element of [...form.elements])if(!approved.has(element)){
      if(element.type==='file'||element.type==='hidden'||['checkbox','radio','submit'].includes(element.type)||
        element.required&&visible(element,env)||!preflight&&typeof element.value==='string'&&element.value.trim())reject('additional_fields');
    }
    return {doc,url,form,controls,label,widget:widgets[0],button,noValidate:form.noValidate===true};
  }
  function requirements(record){
    const {controls,form,button}=record;
    if(typeof controls.month.required!=='boolean'||controls.month.required!==controls.day.required||controls.month.required!==controls.year.required)reject('changed_requirements');
    return DETAILS.validateRequirements({date_of_birth:controls.month.required,street_address:controls.street.required,phone:controls.phone.required,
      no_validate:form.noValidate,submit_no_validate:button.formNoValidate});
  }
  function describe(expectedURL,env=root){
    try{
      if(typeof expectedURL!=='string'||env.location.href!==expectedURL||!BASE.continuationURL(expectedURL,'fastpeoplesearch'))reject('changed_destination');
      const query=new URL(expectedURL).searchParams,fields={first_name:query.get('firstname'),last_name:query.get('lastname'),email:query.get('email')};
      const record=inspect({fields},env,true);
      return {status:'ready',requirements:requirements(record)};
    }catch(_){return {status:'unavailable',detail:'The original matching form or its required fields changed. No personal values were read or written.'};}
  }
  function same(record,payload,env,expected,allowToken=true){
    if(env.document!==record.doc||env.location.href!==record.url||JSON.stringify(payload)!==record.signature)reject('changed_form');
    const fresh=inspect(payload,env);
    if(['form','label','widget','button'].some(key=>fresh[key]!==record[key])||fresh.noValidate!==record.noValidate||
      Object.keys(record.controls).some(key=>fresh.controls[key]!==record.controls[key]))reject('changed_form');
    const actual=requirements(fresh);
    if(Object.keys(payload.requirements).some(key=>actual[key]!==payload.requirements[key]))reject('changed_requirements');
    for(const [key,value]of Object.entries(expected))if(key==='legal'?fresh.controls.legal.checked!==value:fresh.controls[key].value!==value)reject('changed_fields');
    if(fresh.controls.legal.value!==record.legalValue||!allowToken&&fresh.controls.token.value!==record.tokenValue)reject('changed_challenge');
    return fresh;
  }
  function genuineResponse(record,payload,env,expected){
    let fresh;
    try{fresh=same(record,payload,env,expected);if(fresh.controls.token.value.trim())return Promise.resolve({status:'ready'});}
    catch(error){return Promise.resolve(failure(error.reason||'changed_form'));}
    if(typeof env.MutationObserver!=='function'||typeof env.addEventListener!=='function'||typeof env.removeEventListener!=='function')return Promise.resolve(failure('challenge_unavailable'));
    return new Promise(resolve=>{
      let done=false,observer,timeout;
      const finish=result=>{if(done)return;done=true;try{observer?.disconnect();}catch(_){}if(timeout!==undefined)env.clearTimeout(timeout);
        for(const type of ['input','change'])record.doc.removeEventListener(type,changed,true);env.removeEventListener('pagehide',left,true);resolve(result);};
      const check=final=>{try{const current=same(record,payload,env,expected);if(current.controls.token.value.trim())finish({status:'ready'});else if(final)finish(failure('challenge_required','The broker still needs its genuine security response. The final request was not submitted and will not repeat automatically.'));}catch(error){finish(failure(error.reason||'changed_form'));}};
      const changed=()=>check(false),left=()=>finish(failure('changed_destination'));
      try{observer=new env.MutationObserver(changed);observer.observe(record.doc,{subtree:true,childList:true,attributes:true,characterData:true});
        for(const type of ['input','change'])record.doc.addEventListener(type,changed,true);env.addEventListener('pagehide',left,true);
        timeout=env.setTimeout(()=>check(true),12000);check(false);
      }catch(_){finish(failure('challenge_unavailable'));}
    });
  }
  async function execute(payload,expectedURL,env=root){
    let journal=env.document&&journals.get(env.document);
    if(!journal&&env.document){journal=new Map();journals.set(env.document,journal);}
    if(journal?.has(payload?.operationId))return failure('already_started','This final operation already started. No repeat was sent.');
    let record,expected,result,listener,clicked=false,seen=false,unsafe=false;
    try{
      const details=validate(payload);
      if(typeof expectedURL!=='string'||env.location.href!==expectedURL||!BASE.continuationURL(expectedURL,'fastpeoplesearch',payload.fields))reject('changed_destination');
      record=inspect(payload,env);
      const actual=requirements(record);
      if(Object.keys(payload.requirements).some(key=>actual[key]!==payload.requirements[key]))reject('changed_requirements');
      if(['month','day','year','street','phone'].some(key=>record.controls[key].value!==''))reject('existing_identity_detail');
      const approvedLocation={city:details.city,state:details.state,zip:details.zip_code};
      if(Object.entries(approvedLocation).some(([key,value])=>record.controls[key].value!==''&&record.controls[key].value!==value)||record.controls.legal.checked)reject('existing_personal_field');
      record.signature=JSON.stringify(payload);record.legalValue=record.controls.legal.value;
      expected=Object.fromEntries(['month','day','year','street','city','state','zip','phone'].map(key=>[key,record.controls[key].value]));expected.legal=false;
      // Consume before the first personal field write, including on interruption.
      journal.set(payload.operationId,{phase:'started'});
      const write=(key,value)=>{
        let fresh=same(record,payload,env,expected),element=fresh.controls[key];
        const select=element.tagName==='SELECT',prototype=select?env.HTMLSelectElement.prototype:env.HTMLInputElement.prototype;
        const setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;if(!setter)reject('native_controls_unavailable');
        if(select)option(element,value);setter.call(element,value);expected[key]=value;
        for(const type of ['input','change']){element.dispatchEvent(new env.Event(type,{bubbles:true}));fresh=same(record,payload,env,expected);}
      };
      if(['date_of_birth','full_matching_details'].includes(details.method)){
        const [year,month,day]=details.date_of_birth.split('-').map(Number);
        for(const [key,value]of [['month',month],['year',year],['day',day]])write(key,numericOption(record.controls[key],value));
      }
      if(['street_address','full_matching_details'].includes(details.method))write('street',details.street_address);
      if(details.method==='full_matching_details')write('phone',details.phone);
      for(const [key,value]of Object.entries(approvedLocation))write(key,value);
      let fresh=same(record,payload,env,expected);
      const checked=Object.getOwnPropertyDescriptor(env.HTMLInputElement.prototype,'checked')?.set;if(!checked)reject('native_controls_unavailable');
      checked.call(fresh.controls.legal,true);expected.legal=true;
      for(const type of ['input','change']){fresh.controls.legal.dispatchEvent(new env.Event(type,{bubbles:true}));fresh=same(record,payload,env,expected);}
      const readiness=await genuineResponse(record,payload,env,expected);if(readiness.status!=='ready')return result=readiness;
      fresh=same(record,payload,env,expected);record.tokenValue=fresh.controls.token.value;
      // Activate the normal button. Its reviewed site click handler gets the
      // same opportunity as a person's click before native constraint checking.
      // Neither required flags nor the broker's novalidate setting are changed.
      listener=event=>{try{if(event.target!==record.form||event.submitter!==record.button||event.isTrusted!==true)reject('unsafe_submit_event');same(record,payload,env,expected,false);seen=true;}
        catch(_){unsafe=true;event.preventDefault();event.stopImmediatePropagation?.();}};
      fresh.form.addEventListener('submit',listener,{capture:true});fresh.button.focus();fresh=same(record,payload,env,expected,false);
      clicked=true;fresh.button.click();
      result=unsafe?failure('unsafe_submit_event','The final form changed at submission. The unsafe event was canceled; no repeat is allowed.'):
        seen?{status:'submission_attempted',attempt_verified:true,stage:'final_request_submission',detail:'A guarded final-form submit event was observed. Broker acceptance and deletion remain unverified.'}:
          {status:'unknown',detail:'The final submit action has no confirmed native event. Check its existing tab; no repeat will be sent.'};
      return result;
    }catch(error){result=clicked?{status:'unknown',detail:'The final submit action was interrupted. Check its existing tab; no repeat will be sent.'}:failure(error.reason||'changed_form');return result;}
    finally{if(listener&&record)record.form.removeEventListener('submit',listener,{capture:true});if(journal?.has(payload?.operationId))journal.set(payload.operationId,{phase:'done',result});}
  }
  const api=Object.freeze({version:'final-executor-v2',validate,describe,execute});root.EraseFinalExecutor=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
