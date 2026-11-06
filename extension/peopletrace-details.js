/* Transient, explicitly reviewed People Trace UK prefill. No submission or storage. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else if(!root.ErasePeopleTraceDetails)root.ErasePeopleTraceDetails=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const ROUTE='gb-peopletraceuk',HOST='www.peopletraceuk.com',URL='https://www.peopletraceuk.com/RequestRecordRemoval.asp';
  const CONTRACT=Object.freeze({id:'peopletrace-prefill-2026-11-05-v1',
    authorization:'I confirm this is my own information at this address and authorize Erase Me to fill only these reviewed fields once. I will complete the broker’s challenge and submission myself.'});
  const KEYS=['date_of_birth','phone','flat_number','building','street','town','postcode'];
  const labels=Object.freeze({full_name:'Full Name',email:'Your Email Address',phone:'Contact Telephone',flat_number:'Flat/Apt. Number',building:'Building Name/Number',street:'Road/Street',town:'Town',postcode:'Postcode'});
  const purpose=['Please submit your request for a record removal by completing the web form below.',
    'You should complete one form for each person (true data subject).',
    'You should complete one form for each address you want a record removal upon.',
    'We may need to contact you to establish your identity so please provide accurate contact information. Thank you.'];
  const journals=new WeakSet(),normal=value=>String(value||'').replace(/\s+/g,' ').trim();
  const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  function text(value,max,optional=false){
    if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f<>]/.test(value))throw new Error('Review the exact People Trace UK fields.');
    const cleaned=value.trim().replace(/\s+/g,' ');if(!optional&&!cleaned)throw new Error('Complete the required People Trace UK fields.');return cleaned;
  }
  function birth(value,age,now){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Enter your accurate full date of birth.');
    const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day)),current=new Date(now===undefined?Date.now():now);
    if(!Number.isFinite(current.getTime())||date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)throw new Error('Enter a valid full date of birth.');
    let actual=current.getUTCFullYear()-year;if(current.getUTCMonth()+1<month||current.getUTCMonth()+1===month&&current.getUTCDate()<day)actual--;
    if(actual<18||actual>120||age!==undefined&&actual!==age)throw new Error('The date of birth must match the adult age in your workspace.');return value;
  }
  function validateDetails(value,options={}){
    if(!exact(value,KEYS))throw new Error('Provide only the reviewed People Trace UK fields.');
    const phone=text(value.phone,40);if(!/^\+?[0-9 ().-]+$/.test(phone)||(phone.match(/[0-9]/g)||[]).length<7||(phone.match(/[0-9]/g)||[]).length>15)throw new Error('Enter your accurate contact phone number.');
    const postcode=text(value.postcode,8).toUpperCase().replace(/\s/g,'');
    if(!/^(?:GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})$/.test(postcode))throw new Error('Enter your accurate UK postcode.');
    return {date_of_birth:birth(value.date_of_birth,options.age,options.now),phone,
      flat_number:text(value.flat_number,120,true),building:text(value.building,120,true),street:text(value.street,120,true),town:text(value.town,120,true),
      postcode:postcode.slice(0,-3)+' '+postcode.slice(-3)};
  }
  function validatePayload(payload,options={}){
    if(!exact(payload,['routeId','operationId','authorized','ownRequestConfirmed','consentId','identity','details'])||payload.routeId!==ROUTE||
      !/^[a-f0-9-]{32,40}$/.test(payload.operationId||'')||payload.authorized!==true||payload.ownRequestConfirmed!==true||payload.consentId!==CONTRACT.id||
      !exact(payload.identity,['full_name','email','age'])||!Number.isInteger(payload.identity.age)||payload.identity.age<18||payload.identity.age>120)throw new Error('Review and authorize your own People Trace UK form first.');
    const identity={full_name:text(payload.identity.full_name,120),email:text(payload.identity.email,254),age:payload.identity.age};
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identity.email))throw new Error('Use your typed profile email.');
    const details=validateDetails(payload.details,{age:identity.age,now:options.now});
    if(JSON.stringify(identity)!==JSON.stringify(payload.identity)||Object.keys(details).some(key=>details[key]!==payload.details[key]))throw new Error('Review the normalized fields before filling.');
    return {identity,details};
  }
  function visible(element,env){if(!element||element.hidden||!element.getClientRects?.().length)return false;for(let node=element;node;node=node.parentElement){const s=env.getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}return true;}
  function one(doc,selector){const list=[...doc.querySelectorAll(selector)];if(list.length!==1)throw new Error();return list[0];}
  function inspect(env){
    const doc=env.document;if(env.location.href!==URL||doc.querySelector('input[type="file"]'))throw new Error();
    if(normal(one(doc,'h1').textContent)!=='Request Record Removal'||normal(one(doc,'h3').textContent)!=='Record Removal from People Trace UK Ltd. Web Sites')throw new Error();
    const paragraphs=[...doc.querySelectorAll('p')].map(x=>normal(x.textContent));if(purpose.some(line=>paragraphs.filter(p=>p===line).length!==1))throw new Error();
    for(const [caption,href]of [['Terms','https://www.peopletraceuk.com/Terms_and_Conditions.asp'],['Privacy','https://www.peopletraceuk.com/Privacy_Policy.asp']]){
      const links=[...doc.querySelectorAll('a')].filter(a=>normal(a.textContent)===caption);if(links.length!==1||links[0].href!==href||!visible(links[0],env))throw new Error();
    }
    const form=one(doc,'form[name="brec"]');
    if(form.tagName!=='FORM'||doc.forms.length!==1||form.method!=='post'||form.action!==URL||form.target!==''||form.enctype!=='application/x-www-form-urlencoded'||form.noValidate!==false||form.getAttribute('onsubmit')!==null)throw new Error();
    const names={full_name:'Full_Name',day:'dob',month:'mob',year:'yob',email:'Email_Address',phone:'Telephone_Number',flat_number:'Flat_Apt_Number',building:'Building_Name_Number',street:'Road_Street',town:'Town',postcode:'Postcode'};
    const selects=new Set(['day','month','year']),required=new Set(['full_name','day','month','year','email','phone','postcode']),controls={};
    for(const [key,name]of Object.entries(names)){
      const select=selects.has(key),control=one(doc,(select?'select':'input')+'[name="'+name+'"]');controls[key]=control;
      if(control.form!==form||control.name!==name||control.disabled||control.readOnly||!visible(control,env)||control.required!==required.has(key)||
        control.tagName!==(select?'SELECT':'INPUT')||control.type!==(select?'select-one':'text')||select&&control.multiple!==false||
        control.getAttribute('oninput')!==null||control.getAttribute('onchange')!==null)throw new Error();
      const label=control.parentElement?.querySelector('label');if(!label||normal(label.textContent)!==(select?'Date of Birth':labels[key]))throw new Error();
    }
    const widget=one(doc,'.g-recaptcha'),token=one(doc,'textarea#g-recaptcha-response[name="g-recaptcha-response"]');
    if(!form.contains(widget)||!visible(widget,env)||widget.getAttribute('data-sitekey')!=='6Ld3YQoTAAAAAC6ZV9wlsyaDOdSFvOJX6Z6dcPfD'||
      token.form!==form||token.disabled||token.required||typeof token.value!=='string'||token.value.length>16384)throw new Error();
    const submit=one(doc,'input[name="submit"][type="submit"]');
    if(submit.form!==form||submit.disabled||!visible(submit,env)||submit.value!=='Request Record Removal'||submit.formNoValidate!==false||
      ['formaction','formmethod','formtarget','formenctype','formnovalidate'].some(key=>submit.hasAttribute(key)))throw new Error();
    const approved=new Set([...Object.values(controls),token,submit]);if([...form.elements].length!==approved.size||[...form.elements].some(x=>!approved.has(x)))throw new Error();
    return {doc,form,controls,widget,token,submit};
  }
  function execute(payload,env=globalThis){
    try{
      const canonical=validatePayload(payload,{now:env.Date?.now?.()}),record=inspect(env),signature=JSON.stringify(payload);
      if(journals.has(record.doc))return {status:'unknown',detail:'This form action already started. No fields were filled again.'};
      const expected=Object.fromEntries(Object.keys(record.controls).map(key=>[key,['day','month','year'].includes(key)?'0':'']));
      function same(){
        if(JSON.stringify(payload)!==signature||env.document!==record.doc)throw new Error();const fresh=inspect(env);
        if(['form','widget','token','submit'].some(key=>fresh[key]!==record[key])||Object.keys(expected).some(key=>fresh.controls[key]!==record.controls[key]||fresh.controls[key].value!==expected[key]))throw new Error();
      }
      same();const date=canonical.details.date_of_birth.split('-');
      const values={full_name:canonical.identity.full_name,day:date[2],month:date[1],year:date[0],email:canonical.identity.email,...canonical.details};delete values.date_of_birth;
      for(const key of ['day','month','year'])if([...record.controls[key].options].filter(x=>!x.disabled&&x.value===values[key]).length!==1)throw new Error();
      journals.add(record.doc);
      for(const [key,value]of Object.entries(values)){
        if(value==='')continue;same();const control=record.controls[key],prototype=['day','month','year'].includes(key)?env.HTMLSelectElement.prototype:env.HTMLInputElement.prototype;
        const setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;if(!setter)throw new Error();setter.call(control,value);expected[key]=value;same();
        control.dispatchEvent(new env.Event('input',{bubbles:true}));same();control.dispatchEvent(new env.Event('change',{bubbles:true}));same();
      }
      return {status:'prepared',detail:'Reviewed People Trace UK fields were filled once. Complete the genuine broker challenge and submission on its site. No request acceptance or deletion is established.'};
    }catch(_){return {status:'blocked',detail:'The reviewed People Trace UK form or fields could not be verified. No automatic repeat or submission was performed.'};}
  }
  return Object.freeze({ROUTE,HOST,URL,CONTRACT,validateDetails,validatePayload,execute});
});
