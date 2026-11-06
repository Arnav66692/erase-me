/* Approved first-step forms only. Page text never supplies instructions or code. */
(() => {
  'use strict';
  const ROUTES = Object.freeze({
    'peopledatalabs-form': {host:'privacy.peopledatalabs.com',path:'/policies',url:'https://privacy.peopledatalabs.com/policies?action=ERASURE&modal=log-in',email:'#pc-email-login-input',submit:'#email-login-submit',purpose:'erasure'},
    usphonebook: {host:'www.usphonebook.com',path:'/removal',url:'https://www.usphonebook.com/removal',first_name:'#subject-firstname',last_name:'#subject-lastname',email:'#subject-email',form:'#verifyEmailForm',method:'post'},
    smartbackgroundchecks: {host:'www.smartbackgroundchecks.com',path:'/remove',url:'https://www.smartbackgroundchecks.com/optout',entryUrl:'https://www.smartbackgroundchecks.com/privacy',first_name:'#subject_fn',last_name:'#subject_ln',email:'#subject_email',form:'form[action="/remove"][method="post"]',formPath:'/remove',method:'post',submitText:'Submit',ownRequest:true,selection:{selector:'#requester_type',value:'subject'}},
    familytreenow: {host:'www.familytreenow.com',path:'/optout',url:'https://www.familytreenow.com/optout',entryUrl:'https://www.familytreenow.com/privacy',first_name:'#FirstName',last_name:'#LastName',email:'#Email',form:'form[action="/optout/beginoptoutidv"][method="post"]',formPath:'/optout/beginoptoutidv',method:'post',submitText:'Begin Privacy Request',ownRequest:true,selection:{selector:'#RequestType',value:'subject'}},
    truepeoplesearch: {host:'www.truepeoplesearch.com',path:'/removal',url:'https://www.truepeoplesearch.com/removal',entryUrl:'https://www.truepeoplesearch.com/privacy',first_name:'#FirstName',last_name:'#LastName',email:'#Email',form:'form[action="/removal/beginremovalidv"][method="post"][role="form"]',formPath:'/removal/beginremovalidv',method:'post',submitText:'Send Request',ownRequest:true,selection:{selector:'#RightsExerciseType',value:'subject'}},
    searchpeoplefree: {host:'www.searchpeoplefree.com',path:'/opt-out',url:'https://www.searchpeoplefree.com/opt-out',first_name:'#o_first',last_name:'#o_last',email:'#o_email',form:'#o_form',method:'get'},
    fastpeoplesearch: {host:'www.fastpeoplesearch.com',path:'/optout',formPath:'/optout-start-submitted',url:'https://www.fastpeoplesearch.com/optout',first_name:'#firstname',last_name:'#lastname',email:'#email',form:'#optout-start',method:'post'},
    apollo: {host:'www.apollo.io',path:'/privacy-policy/remove',url:'https://www.apollo.io/privacy-policy/remove',business_email:'input#email[name="email"][type="email"]',method:'get',submitText:'Get verification information'},
    spokeo: {host:'www.spokeo.com',path:'/optout',url:'https://www.spokeo.com/optout',listing_url:'input[name="url"][type="url"]',email:'input[name="email"][type="email"]',method:'get',submitText:'OPT OUT'},
    whitepages: {host:'www.whitepages.com',path:'/suppression-requests',url:'https://www.whitepages.com/suppression-requests',listing_url:'input#suppression-requests-person-url[type="text"]'},
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
  function familyTreeNowFacts(fields, env=globalThis, allowPendingToken=false) {
    const route=ROUTES.familytreenow,doc=env.document,normal=value=>String(value||'').replace(/\s+/g,' ').trim();
    const fail=reason=>{const error=new Error('The reviewed FamilyTreeNow initial form changed.');error.reason=reason;throw error;};
    const one=selector=>{const values=[...doc.querySelectorAll(selector)];if(values.length!==1)fail('changed_controls');return values[0];};
    const shown=element=>{if(!element||element.hidden||!element.getClientRects().length)return false;for(let node=element;node;node=node.parentElement){const s=env.getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}return true;};
    if(!allowed(env.location.href,route)||doc.querySelector('input[type="file"]'))fail('changed_destination');
    const form=one(route.form);
    if(doc.title!=='Privacy Request - FamilyTreeNow.com'||doc.forms?.length!==1||form.tagName!=='FORM'||!formAllowed(form.action,route)||
      form.getAttribute('action')!=='/optout/beginoptoutidv'||form.method!=='post'||form.enctype!=='application/x-www-form-urlencoded'||form.target!==''||form.noValidate!==false||form.getAttribute('onsubmit')!==null)fail('changed_destination');
    const headings=[...doc.querySelectorAll('h2')].filter(e=>normal(e.textContent)==='Privacy Request');
    const notices=[...doc.querySelectorAll('p')].filter(e=>normal(e.textContent)==='To opt your information out of our records, please complete the form below. We will send you a verification email to confirm your identity before processing your request.');
    if(headings.length!==1||!shown(headings[0])||notices.length!==1||!shown(notices[0]))fail('changed_purpose');
    if([...doc.querySelectorAll('[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors')].some(shown))fail('existing_alert');
    const expected=fields||{first_name:'',last_name:'',email:''},names={first_name:'FirstName',last_name:'LastName',email:'Email'},captions={first_name:'First Name *',last_name:'Last Name *',email:'Email *'};
    const controls=Object.entries(expected).map(([key,value])=>{const e=one(route[key]);if(!shown(e)||e.form!==form||e.tagName!=='INPUT'||e.name!==names[key]||e.type!==(key==='email'?'email':'text')||!e.required||e.disabled||e.readOnly||e.value!==value||e.labels?.length!==1||!shown(e.labels[0])||normal(e.labels[0].textContent)!==captions[key])fail('changed_fields');return e;});
    if(controls.length!==3)fail('changed_fields');
    const selection=one('#RequestType');
    if(!shown(selection)||selection.form!==form||selection.tagName!=='SELECT'||selection.type!=='select-one'||selection.name!=='RequestType'||selection.required||selection.disabled||selection.readOnly||selection.multiple!==false||selection.value!=='subject'||selection.getAttribute('onchange')!=='toggleAgentFields()'||selection.options.length!==2||
      selection.options[0].value!=='subject'||selection.options[0].disabled||normal(selection.options[0].textContent)!=='The person whose information is being opted out'||selection.options[1].value!=='agent'||selection.options[1].disabled||normal(selection.options[1].textContent)!=='An authorized agent on behalf of someone else')fail('changed_purpose');
    const middle=one('#MiddleName');
    if(!shown(middle)||middle.form!==form||middle.tagName!=='INPUT'||middle.type!=='text'||middle.name!=='MiddleName'||middle.required||middle.disabled||middle.readOnly||middle.value!=='')fail('additional_fields');
    const optionalControls=['AgentFirstName','AgentLastName','AgentEmail'].map(name=>{const e=one('#'+name);if(shown(e)||e.form!==form||e.tagName!=='INPUT'||e.type!==(name==='AgentEmail'?'email':'text')||e.name!==name||e.required||e.disabled||e.readOnly||e.value!=='')fail('additional_fields');return e;});
    const checkbox=one('#AuthorizeContact'),consent='I authorize you to send communications relating to my privacy request';
    if(!shown(checkbox)||checkbox.form!==form||checkbox.tagName!=='INPUT'||checkbox.type!=='checkbox'||checkbox.name!=='AuthorizeContact'||checkbox.value!=='true'||checkbox.required||checkbox.disabled||checkbox.readOnly||checkbox.labels?.length!==1||checkbox.getAttribute('data-val-required')!=='The I authorize you to send communications relating to my privacy request field is required.')fail('changed_consent');
    const label=checkbox.labels[0];
    if(label.tagName!=='LABEL'||!shown(label)||normal(label.textContent)!==consent+' *'||form.querySelectorAll('a').length)fail('changed_consent');
    const fallback=one(route.form+' input[type="hidden"][name="AuthorizeContact"]');
    if(fallback.form!==form||fallback.tagName!=='INPUT'||fallback.type!=='hidden'||fallback.name!=='AuthorizeContact'||fallback.value!=='false'||fallback.required||fallback.disabled||fallback.readOnly||shown(fallback))fail('additional_fields');
    optionalControls.push(fallback);
    const csrf=one(route.form+' input[name="__RequestVerificationToken"]');
    if(csrf.form!==form||csrf.tagName!=='INPUT'||csrf.type!=='hidden'||csrf.name!=='__RequestVerificationToken'||csrf.required||csrf.disabled||csrf.readOnly||shown(csrf)||typeof csrf.value!=='string'||!csrf.value.trim()||csrf.value.length>4096)fail('changed_form');
    const token=one(route.form+' textarea[name="h-captcha-response"]'),challengeResponse=one(route.form+' textarea[name="g-recaptcha-response"]'),widget=one(route.form+' .h-captcha');
    for(const [e,name]of [[token,'h-captcha-response'],[challengeResponse,'g-recaptcha-response']])if(e.form!==form||e.tagName!=='TEXTAREA'||e.type!=='textarea'||e.name!==name||e.required||e.disabled||e.readOnly||shown(e)||typeof e.value!=='string'||e.value.length>16384)fail('changed_challenge');
    const scripts=[...doc.querySelectorAll('script[src]')].filter(e=>e.src==='https://hcaptcha.com/1/api.js');
    if(widget.tagName!=='DIV'||!shown(widget)||widget.getAttribute('data-sitekey')!=='58366d97-3e8c-4b57-a679-4a41c8423be3'||scripts.length!==1)fail('changed_challenge');
    if(!token.value.trim()&&!allowPendingToken)fail('challenge_required');
    const buttons=[...form.elements].filter(e=>['BUTTON','INPUT'].includes(e.tagName)&&['submit','image'].includes(e.type)),button=buttons[0];
    if(buttons.length!==1||!shown(button)||button.form!==form||button.tagName!=='BUTTON'||button.type!=='submit'||button.disabled||normal(button.textContent)!=='Begin Privacy Request'||button.name!==''||button.value!==''||button.formNoValidate!==false||['formaction','formmethod','formtarget','formenctype','formnovalidate'].some(name=>button.hasAttribute(name)))fail('changed_submit');
    const approved=new Set([...controls,selection,middle,...optionalControls,checkbox,csrf,token,challengeResponse,button]);
    if(form.elements.length!==14||[...form.elements].some(e=>!approved.has(e)))fail('additional_fields');
    return {route,form,controls,selection,middle,optionalControls,checkbox,label,csrf,token,challengeResponse,widget,challengeScript:scripts[0],button,notice:notices[0]};
  }
  function truePeopleSearchFacts(fields,env=globalThis,allowPendingToken=false){
    const route=ROUTES.truepeoplesearch,doc=env.document,normal=value=>String(value||'').replace(/\s+/g,' ').trim();
    const fail=reason=>{const error=new Error('The reviewed TruePeopleSearch initial form changed.');error.reason=reason;throw error;};
    const one=selector=>{const values=[...doc.querySelectorAll(selector)];if(values.length!==1)fail('changed_controls');return values[0];};
    const shown=element=>{if(!element||element.hidden||!element.getClientRects().length)return false;for(let node=element;node;node=node.parentElement){const style=env.getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}return true;};
    if(!allowed(env.location.href,route)||doc.querySelector('input[type="file"]'))fail('changed_destination');
    const form=one(route.form);
    if(doc.title!=='Do Not Sell/Right to Opt-out - TruePeopleSearch.com'||doc.forms.length!==3||form.tagName!=='FORM'||!formAllowed(form.action,route)||form.getAttribute('action')!=='/removal/beginremovalidv'||form.method!=='post'||form.enctype!=='application/x-www-form-urlencoded'||form.target!==''||form.noValidate!==false||form.getAttribute('onsubmit')!==null)fail('changed_destination');
    const headings=[...doc.querySelectorAll('h3')].filter(element=>normal(element.textContent)==='Do Not Sell/Right to Opt-out');
    const notices=[...doc.querySelectorAll('h5')].filter(element=>normal(element.textContent)==="Enter your name and email address – we'll email you a link to the opt-out form to complete the process");
    if(headings.length!==1||!shown(headings[0])||notices.length!==1||!shown(notices[0]))fail('changed_purpose');
    if([...doc.querySelectorAll('[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors')].some(shown))fail('existing_alert');
    const expected=fields||{first_name:'',last_name:'',email:''},names={first_name:'FirstName',last_name:'LastName',email:'Email'};
    const controls=Object.entries(expected).map(([key,value])=>{
      const element=one(route[key]),email=key==='email';
      if(!shown(element)||element.form!==form||element.tagName!=='INPUT'||element.name!==names[key]||element.type!==(email?'email':'text')||!element.required||element.disabled||element.readOnly||element.value!==value||element.maxLength!==(email?100:50)||element.placeholder!==(email?'Email Address':key==='first_name'?'First Name':'Last Name')||element.labels.length!==0)fail('changed_fields');
      return element;
    });
    if(controls.length!==3)fail('changed_fields');
    const selection=one('#RightsExerciseType'),options=[...selection.options],labels=selection.labels;
    if(!shown(selection)||selection.form!==form||selection.tagName!=='SELECT'||selection.type!=='select-one'||selection.name!=='RightsExerciseType'||selection.required||selection.disabled||selection.readOnly||selection.multiple!==false||selection.value!=='subject'||selection.getAttribute('onchange')!==null||options.length!==3||labels.length!==1||normal(labels[0].textContent)!=='Exercise my rights as a:')fail('changed_purpose');
    const selections=[['','I am',true],['subject','The subject of the request',false],['agent','An authorized agent of the subject of the request',false]];
    if(options.some((option,index)=>option.value!==selections[index][0]||normal(option.textContent)!==selections[index][1]||option.disabled!==selections[index][2]))fail('changed_purpose');
    const middle=one('#MiddleName');
    if(!shown(middle)||middle.form!==form||middle.tagName!=='INPUT'||middle.type!=='text'||middle.name!=='MiddleName'||middle.required||middle.disabled||middle.readOnly||middle.value!==''||middle.maxLength!==50)fail('additional_fields');
    const optionalControls=['AgentFirstName','AgentLastName','AgentEmail'].map(name=>{
      const element=one('#'+name),email=name==='AgentEmail';
      if(shown(element)||element.form!==form||element.tagName!=='INPUT'||element.type!==(email?'email':'text')||element.name!==name||element.required||element.disabled||element.readOnly||element.value!==''||element.maxLength!==(email?100:50))fail('additional_fields');
      return element;
    });
    const checkbox=one('#AuthorizeContact'),consent='I authorize TruePeopleSearch.com to send communications relating to my privacy request to the email address(es) provided. I certify that I am the subject of the request, or an agent authorized to act on behalf of the subject of the request. I understand that information provided relating to this request will not be used for any purpose other than the processing of this request.';
    if(!shown(checkbox)||checkbox.form!==form||checkbox.tagName!=='INPUT'||checkbox.type!=='checkbox'||checkbox.name!=='AuthorizeContact'||checkbox.value!=='true'||!checkbox.required||checkbox.disabled||checkbox.readOnly||checkbox.labels.length!==0||checkbox.getAttribute('data-val-required')!=='You must authorize us to send communications')fail('changed_consent');
    const label=checkbox.parentElement?.parentElement?.querySelector('.col-11');
    if(!label||!shown(label)||normal(label.textContent)!==consent)fail('changed_consent');
    const fallback=one(route.form+' input[name="AuthorizeContact"][type="hidden"]');
    if(fallback.form!==form||fallback.tagName!=='INPUT'||fallback.type!=='hidden'||fallback.name!=='AuthorizeContact'||fallback.value!=='false'||fallback.required||fallback.disabled||fallback.readOnly||shown(fallback))fail('additional_fields');
    optionalControls.push(fallback);
    const token=one(route.form+' textarea[name="h-captcha-response"]'),challengeResponse=one(route.form+' textarea[name="g-recaptcha-response"]'),widget=one(route.form+' .h-captcha');
    for(const[element,name]of [[token,'h-captcha-response'],[challengeResponse,'g-recaptcha-response']])if(element.form!==form||element.tagName!=='TEXTAREA'||element.type!=='textarea'||element.name!==name||element.required||element.disabled||element.readOnly||shown(element)||typeof element.value!=='string'||element.value.length>16384)fail('changed_challenge');
    const scripts=[...doc.querySelectorAll('script[src]')].filter(element=>element.src==='https://hcaptcha.com/1/api.js');
    if(widget.tagName!=='DIV'||!shown(widget)||widget.getAttribute('data-sitekey')!=='8c6693a8-2959-420f-ba6c-474f2460a6cf'||scripts.length!==1)fail('changed_challenge');
    if(!token.value.trim()&&!allowPendingToken)fail('challenge_required');
    const policyUrls=['https://www.truepeoplesearch.com/terms','https://www.truepeoplesearch.com/notice-at-collection','https://www.truepeoplesearch.com/privacy'],links=[...form.querySelectorAll('a')],terms=one(route.form+' small.text-muted');
    if(links.length!==3||links.some((link,index)=>link.href!==policyUrls[index]||!shown(link))||!shown(terms)||normal(terms.textContent)!=='By using our site and services, you agree to our Terms of Use. Visit our Notice at Collection and Privacy Notice for information about our privacy practices.')fail('changed_consent');
    const buttons=[...form.elements].filter(element=>['BUTTON','INPUT'].includes(element.tagName)&&['submit','image'].includes(element.type)),button=buttons[0];
    if(buttons.length!==1||!shown(button)||button.form!==form||button.tagName!=='BUTTON'||button.type!=='submit'||button.disabled||normal(button.textContent)!=='Send Request'||button.name!==''||button.value!==''||button.formNoValidate!==false||['formaction','formmethod','formtarget','formenctype','formnovalidate'].some(name=>button.hasAttribute(name)))fail('changed_submit');
    const approved=new Set([...controls,selection,middle,...optionalControls,checkbox,token,challengeResponse,button]);
    if(form.elements.length!==13||[...form.elements].some(element=>!approved.has(element)))fail('additional_fields');
    return{route,form,controls,selection,middle,optionalControls,checkbox,label,token,challengeResponse,widget,challengeScript:scripts[0],button,notice:notices[0],terms,policyLinks:links};
  }
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
  function whitepagesURL(value){
    try{
      if(typeof value!=='string'||value.length>2048||/[\s%\\]/.test(value))return false;
      const url=new URL(value);
      return url.protocol==='https:'&&url.hostname==='www.whitepages.com'&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash&&
        /^\/name\/[A-Za-z0-9-]{1,256}\/[A-Za-z0-9-]{1,256}\/[A-Za-z0-9_-]{1,512}$/.test(url.pathname);
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
    if(routeId==='truepeoplesearch'&&(fields.first_name.length>50||fields.last_name.length>50||fields.email.length>100))throw new Error('Review the broker’s name and email length limits.');
    if(routeId==='apollo'&&approval.businessEmailConfirmed!==true)throw new Error('Confirm the business email associated with your own Apollo record.');
    if(routeId==='spokeo'&&(!listingURL(fields.listing_url)||approval.listingConfirmed!==true))throw new Error('Confirm the exact Spokeo listing is your own.');
    if(routeId==='whitepages'&&(!whitepagesURL(fields.listing_url)||approval.listingConfirmed!==true))throw new Error('Review and confirm your exact direct Whitepages person-record URL.');
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
  function continuationURL(value,routeId='usphonebook',fields) {
    try {
      if(typeof value!=='string'||value.length>2048||/[\s\\\x00-\x1f\x7f]/.test(value))return false;
      if(routeId==='fastpeoplesearch'){
        if(!value.startsWith('https://www.fastpeoplesearch.com/optout/removal?')||/%(?![a-f0-9]{2})/i.test(value))return false;
        const u=new URL(value),keys=['firstname','middlename','lastname','email','ticketid'];
        // URLSearchParams tolerates malformed UTF-8; the reviewed link does not.
        for(const part of u.search.slice(1).split('&'))for(const encoded of part.split('='))decodeURIComponent(encoded.replace(/\+/g,' '));
        if(u.protocol!=='https:'||u.hostname!=='www.fastpeoplesearch.com'||u.port||u.username||u.password||u.hash||u.pathname!=='/optout/removal'||
          [...u.searchParams].length!==keys.length||keys.some(key=>u.searchParams.getAll(key).length!==1)||u.searchParams.get('middlename')!==''||
          !/^[0-9]{1,32}$/.test(u.searchParams.get('ticketid')))return false;
        for(const key of ['firstname','lastname']){const name=u.searchParams.get(key);if(!name||name.length>120||name!==name.trim()||/[\x00-\x1f\x7f<>]/.test(name))return false;}
        const email=u.searchParams.get('email');
        if(!email||email.length>254||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||/[\x00-\x1f\x7f<>]/.test(email))return false;
        return !fields||u.searchParams.get('firstname')===fields.first_name&&u.searchParams.get('lastname')===fields.last_name&&email===fields.email;
      }
      if(routeId!=='usphonebook')return false;
      const u=new URL(value),key=u.searchParams.get('key');
      return u.protocol==='https:'&&u.hostname==='www.usphonebook.com'&&!u.port&&!u.username&&!u.password&&!u.hash&&
        u.pathname==='/removal/validate-record-info'&&[...u.searchParams].length===2&&u.searchParams.getAll('key').length===1&&
        typeof key==='string'&&key.length<=512&&/^[A-Za-z0-9_-]+={0,2}$/.test(key)&&u.searchParams.getAll('ticketid').length===1&&/^[0-9]{1,32}$/.test(u.searchParams.get('ticketid'));
    }catch(_){return false;}
  }
  function validateContinuation(payload) {
    const {routeId,operationId,requestId,receiptRef,confirmationUrl,contactEmail,fields,authorized}=payload||{};
    const keys=routeId==='fastpeoplesearch'?['first_name','last_name','email']:['first_name','last_name','email','city','state','zip_code'];
    if(!['usphonebook','fastpeoplesearch'].includes(routeId)||authorized!==true||!/^[a-f0-9-]{32,40}$/.test(operationId||'')||!/^[a-f0-9]{32}$/.test(requestId||'')||
      !/^[a-f0-9]{64}$/.test(receiptRef||'')||!fields||typeof fields!=='object'||Array.isArray(fields)||Object.keys(fields).length!==keys.length||
      !keys.every(k=>Object.hasOwn(fields,k))||!continuationURL(confirmationUrl,routeId,fields))throw new Error('Unsupported confirmation form.');
    validate(routeId,{first_name:fields.first_name,last_name:fields.last_name,email:fields.email});
    if(contactEmail!==fields.email||!new RegExp('^[a-z0-9._-]{1,25}\\+erase-'+requestId+'@(?:gmail\\.com|googlemail\\.com)$').test(contactEmail))throw new Error('Review the authorized confirmation contact.');
    if(routeId==='fastpeoplesearch')return {host:'www.fastpeoplesearch.com',path:'/optout/removal',url:confirmationUrl};
    if(
      typeof fields.city!=='string'||!fields.city.trim()||fields.city.length>120||/[\r\n\x00<>]/.test(fields.city)||
      !/^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|AA|AE|AP|AS|FM|GU|MH|MP|PR|PW|VI)$/.test(fields.state)||!/^\d{5}$/.test(fields.zip_code))throw new Error('Review the authorized confirmation fields.');
    return {host:'www.usphonebook.com',path:'/removal/validate-record-info',url:confirmationUrl};
  }
  async function readFastPeopleSearchContinuation(payload,env) {
    const doc=env.document,url=payload.confirmationUrl,signature=JSON.stringify(payload);
    const blocked=()=>({status:'blocked',detail:'The reviewed FastPeopleSearch matching form changed or is unavailable. No fields were changed or submitted.'});
    const safe=()=>env.document===doc&&env.location.href===url&&JSON.stringify(payload)===signature&&
      continuationURL(url,'fastpeoplesearch',payload.fields)&&!doc.querySelector('input[type="file"]');
    const one=selector=>{const values=[...doc.querySelectorAll(selector)];return values.length===1?values[0]:null;};
    const inspect=()=>{
      if(!safe())return blocked();
      const forms=[...doc.querySelectorAll('form#optout-removal')];
      if(!forms.length)return null;
      if(forms.length!==1)return blocked();
      const form=forms[0];
      if(form.method?.toLowerCase()!=='post'||form.action!=='https://www.fastpeoplesearch.com/optout/removal')return blocked();
      const identity={first_name:one('input#firstname[name="firstname"][type="text"]'),last_name:one('input#lastname[name="lastname"][type="text"]'),email:one('input#email[name="email"][type="email"]')};
      const middle=one('input#middlename[name="middlename"][type="text"]'),ticket=one('#optout-removal input[name="ticketid"][type="hidden"]');
      if(Object.entries(identity).some(([key,e])=>!visible(e)||e.disabled||e.readOnly||e.form!==form||e.value!==payload.fields[key])||
        !visible(middle)||middle.disabled||middle.readOnly||middle.form!==form||middle.value!==''||!ticket||ticket.form!==form||ticket.value!==new URL(url).searchParams.get('ticketid'))return blocked();
      const shape=[
        ['select[name="dobMonth"]','SELECT'],['select[name="dobDay"]','SELECT'],['select[name="dobYear"]','SELECT'],
        ['input#streetAddress[name="streetAddress"][type="text"]','INPUT'],['input#city[name="city"][type="text"]','INPUT'],
        ['select#state[name="state"]','SELECT'],['input#zipcode[name="zipcode"][type="text"]','INPUT'],['input#phone[name="phone"][type="text"]','INPUT'],
        ['#optout-removal input[name="legal"][type="checkbox"]','INPUT']
      ];
      if(shape.some(([selector,tag])=>{const e=one(selector);return !visible(e)||e.disabled||e.readOnly||e.form!==form||e.tagName!==tag;}))return blocked();
      const token=one('#optout-removal input[name="cf-turnstile-response"][type="hidden"]');
      const widget=one('#optout-removal .cf-turnstile'),buttons=[...form.querySelectorAll('button[type="submit"],input[type="submit"]')];
      if(!token||token.form!==form||!visible(widget)||buttons.length!==1||buttons[0].tagName!=='BUTTON'||buttons[0].form!==form||
        !visible(buttons[0])||buttons[0].disabled||buttons[0].textContent.trim()!=='Submit'||!safe())return blocked();
      return {status:'prepared',detail:'The authenticated FastPeopleSearch email opened its reviewed matching form. Its original name and removal-contact email match this operation. No fields were changed or submitted. The broker requires either full date of birth or street address, plus city, state and ZIP, before its final accuracy statement and submission. Record matching, acceptance and deletion remain unverified.'};
    };
    let initial;try{initial=inspect();}catch(_){return blocked();}if(initial)return initial;
    if(typeof env.MutationObserver!=='function'||typeof env.addEventListener!=='function'||typeof env.removeEventListener!=='function')return blocked();
    return new Promise(resolve=>{
      let done=false,observer,timeout;
      const finish=result=>{if(done)return;done=true;observer?.disconnect();if(timeout!==undefined)env.clearTimeout(timeout);env.removeEventListener('pagehide',pageHidden,true);resolve(result);};
      const check=()=>{try{const result=inspect();if(result)finish(result);}catch(_){finish(blocked());}};
      const pageHidden=()=>finish(blocked());
      try{
        observer=new env.MutationObserver(check);observer.observe(doc,{subtree:true,childList:true,attributes:true});
        env.addEventListener('pagehide',pageHidden,true);timeout=env.setTimeout(()=>{try{finish(inspect()||blocked());}catch(_){finish(blocked());}},10000);check();
      }catch(_){finish(blocked());}
    });
  }
  async function executeContinuation(payload,env=globalThis) {
    validateContinuation(payload);
    if(payload.routeId==='fastpeoplesearch')return readFastPeopleSearchContinuation(payload,env);
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
  const whitepagesDocuments=new WeakSet();
  async function executeWhitepages(payload,env){
    const route=ROUTES.whitepages,doc=env.document,normal=value=>String(value||'').replace(/\s+/g,' ').trim();
    if(payload.authorized!==true||!/^[a-f0-9-]{32,40}$/.test(payload.operationId||''))return {status:'blocked',detail:'Review and authorize your own Whitepages listing first.'};
    const safe=()=>env.document===doc&&allowed(env.location.href,route)&&!doc.querySelector('input[type="file"]');
    for(let index=0;index<40&&safe()&&!visible(doc.querySelector(route.listing_url));index++)await new Promise(resolve=>env.setTimeout(resolve,250));
    const signature=JSON.stringify(payload);
    function inspect(expected){
      if(!safe()||JSON.stringify(payload)!==signature)throw new Error();
      const candidates=[...doc.querySelectorAll(route.listing_url)],input=candidates[0];
      if(candidates.length!==1||!visible(input)||input.form!==null||input.tagName!=='INPUT'||input.type!=='text'||input.name!==''||input.required||input.disabled||input.readOnly||
        input.getAttribute('placeholder')!=='Copy and paste the URL of your profile'||input.getAttribute('autocomplete')!=='off'||input.getAttribute('inputmode')!=='text'||
        input.getAttribute('data-qa-selector')!=='suppression-requests-person-url'||input.value!==expected)throw new Error();
      const card=input.closest('.card'),section=card?.parentElement;
      if(!card||!section||!visible(card)||card.tagName!=='DIV'||section.tagName!=='DIV')throw new Error();
      const headings=[...section.querySelectorAll('.display-2')],steps=[...section.querySelectorAll('.overline')],notices=[...card.querySelectorAll('.body-1')],buttons=[...card.querySelectorAll('button')];
      if(headings.length!==1||steps.length!==1||notices.length!==1||buttons.length!==1||![headings[0],steps[0],notices[0]].every(visible)||
        normal(headings[0].textContent)!=='Opt-out of Whitepages'||normal(steps[0].textContent)!=='Step 1 of 5'||
        normal(notices[0].textContent)!=='You can opt out and have your listing removed from the Whitepages website. Copy and paste the URL of your profile.')throw new Error();
      const button=buttons[0];
      if(!visible(button)||button.form!==null||button.type!=='submit'||button.name!==''||button.value!==''||button.disabled||button.formNoValidate!==false||normal(button.textContent)!=='Next'||
        ['formaction','formmethod','formtarget','formenctype','formnovalidate'].some(key=>button.hasAttribute(key)))throw new Error();
      const controls=[...card.querySelectorAll('input,textarea,select')];if(controls.length!==1||controls[0]!==input||card.querySelectorAll('a').length)throw new Error();
      return {input,card,section,heading:headings[0],step:steps[0],notice:notices[0],button};
    }
    try{
      if(whitepagesDocuments.has(doc))return {status:'unknown',detail:'This Whitepages prefill already started. No field was filled again.'};
      const first=inspect(''),same=expected=>{const fresh=inspect(expected);if(Object.keys(first).some(key=>fresh[key]!==first[key]))throw new Error();};
      const value=payload.fields.listing_url,setter=Object.getOwnPropertyDescriptor(env.HTMLInputElement.prototype,'value')?.set;if(!setter)throw new Error();
      whitepagesDocuments.add(doc);same('');setter.call(first.input,value);same(value);
      for(const event of ['input','change']){first.input.dispatchEvent(new env.Event(event,{bubbles:true}));same(value);}
      return {status:'prepared',detail:'Only your confirmed Whitepages record URL was filled. Review Next and the remaining broker steps yourself; no request was submitted, phone call made or deletion verified.'};
    }catch(_){return {status:'blocked',detail:'The reviewed Whitepages first step changed or is unavailable. No Next action or automatic repeat was performed.'};}
  }
  async function execute(payload, env=globalThis) {
    const {routeId,fields}=payload,route=validate(routeId,fields,payload),doc=env.document;
    if(routeId==='whitepages')return executeWhitepages(payload,env);
    const familyFields=['familytreenow','truepeoplesearch'].includes(routeId)?{first_name:'',last_name:'',email:''}:null;
    const familyReady=()=>{try{if(familyFields)(routeId==='truepeoplesearch'?truePeopleSearchFacts:familyTreeNowFacts)(familyFields,env,true);return true;}catch(_){return false;}};
    if(!familyReady())return {status:'blocked',detail:'The reviewed initial form is unavailable. No details were filled.'};
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
    const exactDestination=()=>familyReady()&&formAllowed(form.action||env.location.href,route)&&(!route.method||form.method?.toLowerCase()===route.method)&&selectionReady()&&
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
      if(familyFields)familyFields[key]=fields[key];
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
  const api={ROUTES,allowed,formAllowed,listingURL,whitepagesURL,validate,execute,inspect,continuationURL,validateContinuation,executeContinuation,familyTreeNowFacts,truePeopleSearchFacts};
  globalThis.EraseBrokerExecutor=api;
  if(typeof module!=='undefined')module.exports=api;
})();
