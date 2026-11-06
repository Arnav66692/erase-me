'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Automatic=require('../extension/automatic-executor.js'),Base=require('../extension/broker-executor.js');
const {page,CONSENT,TERMS}=require('./truepeoplesearch_fixture.cjs');
const ROUTE='truepeoplesearch';
test('TruePeopleSearch prefill leaves optional names, agents, both challenge responses and consent untouched',async()=>{
  const p=page();assert.throws(()=>Base.validate(ROUTE,p.payload.fields));for(const e of Object.values(p.controls))e.value='';
  const before=[p.fallback.value,p.token.value,p.challengeResponse.value];assert.equal((await Base.execute(p.payload,p.env)).status,'prepared');
  assert.deepEqual([p.fallback.value,p.token.value,p.challengeResponse.value],before);assert.equal(p.clicks(),0);assert.equal(p.checkbox.checked,false);
  for(const[key,value]of Object.entries(p.payload.fields))assert.equal(p.controls[key].value,value);assert.equal(p.middle.value,'');assert.equal(p.agents.every(e=>e.value===''),true);
  for(const fields of [{...p.payload.fields,first_name:'x'.repeat(51)},{...p.payload.fields,last_name:'x'.repeat(51)},{...p.payload.fields,email:'x'.repeat(90)+'@example.test'}])assert.throws(()=>Base.validate(ROUTE,fields,{ownRequestConfirmed:true}));
});
test('TruePeopleSearch contract starts only one genuine native verification-initiation attempt',async()=>{
  const p=page(),contract=Automatic.CONTRACTS[ROUTE];assert.equal(contract.requiredCapability,'reviewed-initial-submit-v7');assert.equal(contract.consentText,CONSENT+' '+TERMS);assert.equal(Automatic.version,'automatic-executor-v9');
  assert.deepEqual(contract.policyUrls,['https://www.truepeoplesearch.com/terms','https://www.truepeoplesearch.com/notice-at-collection','https://www.truepeoplesearch.com/privacy']);
  assert.equal((await Automatic.waitReady(p.payload,p.env)).status,'ready');assert.equal(Automatic.capture(p.payload,p.env).status,'ready');const result=Automatic.submit(p.payload,p.env);
  assert.equal(result.status,'submission_attempted');assert.equal(result.stage,'verification_initiation');assert.equal(result.attempt_verified,true);assert.equal(p.sent(),1);assert.equal(p.clicks(),1);assert.equal(p.checkbox.checked,true);assert.equal(p.fallback.value,'false');
  assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');assert.equal(Automatic.capture(p.payload,p.env).reason,'already_captured');
  for(const value of Object.values(p.payload.fields))assert.equal(JSON.stringify(result).includes(value),false);
});
const mutations=[
  p=>{p.document.title='Export';},p=>{p.env.location.href+='?changed';},p=>{p.form.action+='?changed';},p=>{p.form.method='get';},p=>{p.form.target='_blank';},p=>{p.form.enctype='text/plain';},p=>{p.form.noValidate=true;},p=>{p.form.setAttribute('onsubmit','changed()');},p=>{p.form.setAttribute('action','/other');},p=>{p.document.forms.push({});},p=>{p.heading.textContent='Export';},p=>{p.notice.textContent+=' Extra terms';},
  p=>{p.controls.email.name='AgentEmail';},p=>{p.controls.first_name.required=false;},p=>{p.controls.email.maxLength=200;},p=>{p.controls.email.placeholder='Agent Email';},p=>{p.controls.email.labels.push({});},p=>{p.controls.email.readOnly=true;},p=>{p.selection.value='agent';},p=>{p.selection.required=true;},p=>{p.selection.setAttribute('onchange','other()');},p=>{p.selection.options[0].disabled=false;},p=>{p.selection.options.push({value:'other'});},
  p=>{p.middle.value='private';},p=>{p.agents[0].value='Someone';},p=>{p.agents[1].hidden=false;},p=>{p.agents[2].required=true;},p=>{p.fallback.value='true';},p=>{p.checkbox.required=false;},p=>{p.checkbox.value='false';},p=>{p.checkbox.setAttribute('data-val-required','Other terms');},p=>{p.label.textContent+=' More';},p=>{p.terms.textContent+=' More';},p=>{p.links[0].href='https://other.example/terms';},p=>{p.links.push({});},
  p=>{p.token.hidden=false;},p=>{p.challengeResponse.value='x'.repeat(16385);},p=>{p.widget.setAttribute('data-sitekey','other');},p=>{p.challengeScript.src='https://other.example/api.js';},p=>{p.button.textContent='Export';},p=>{p.button.name='extra';},p=>{p.extras.push({type:'hidden'});},p=>{p.files.push({});},p=>{p.alerts.push({getClientRects:()=>[{}],style:{}});},...['formaction','formmethod','formtarget','formenctype','formnovalidate'].map(name=>p=>p.button.setAttribute(name,''))
];
test('TruePeopleSearch schema, purpose, policy, optional fields and native drift stop before first disclosure',async()=>{
  for(const mutate of mutations){const p=page();for(const e of Object.values(p.controls))e.value='';mutate(p);assert.equal((await Base.execute(p.payload,p.env)).status,'blocked',mutate.toString());assert.equal(p.controls.last_name.value,'');assert.equal(p.clicks(),0);}
});
test('TruePeopleSearch missing consent, missing actual challenge and mutated forms cannot capture',()=>{
  for(const mutate of [...mutations,p=>{p.token.value='';},p=>{p.payload.ownRequestConfirmed=false;},p=>{p.payload.autoSubmit=false;},p=>{p.payload.consentId='old';}]){const p=page();mutate(p);assert.equal(Automatic.capture(p.payload,p.env).status,'blocked',mutate.toString());assert.equal(p.sent(),0);}
});
test('TruePeopleSearch pins both genuine response fields through consent, validation and native submit',()=>{
  for(const mutate of [p=>{p.token.value='changed';},p=>{p.challengeResponse.value='changed';},p=>{p.checkbox.onEvent=()=>{p.fallback.value='changed';};},p=>{p.form.onValidate=()=>{p.agents[0].value='changed';};},p=>{p.button.onFocus=()=>p.button.setAttribute('formaction','https://other.example/collect');},p=>{p.links[0]={...p.links[0]};}]){const p=page();assert.equal(Automatic.capture(p.payload,p.env).status,'ready');mutate(p);assert.equal(Automatic.submit(p.payload,p.env).status,'blocked');assert.equal(p.clicks(),0);}
  for(const mode of ['override','token','untrusted','missing']){const p=page();Automatic.capture(p.payload,p.env);if(mode==='override')p.button.onClick=()=>p.button.setAttribute('formaction','https://other.example/collect');if(mode==='token')p.button.onClick=()=>{p.challengeResponse.value='changed';};if(mode==='untrusted')p.button.untrusted=true;if(mode==='missing')p.button.noEvent=true;assert.equal(Automatic.submit(p.payload,p.env).status,mode==='missing'?'unknown':'blocked');assert.equal(p.sent(),0);assert.equal(Automatic.submit(p.payload,p.env).reason,'already_started');}
});
test('TruePeopleSearch observes normal challenge readiness with one deadline and clears every listener',async()=>{
  for(const end of ['ready','deadline','navigation','fallback_changed','replacement']){const p=page();p.token.value='';p.challengeResponse.value='';let observed,deadline,disconnected=false,cleared=false;const handlers=new Map();
    p.document.addEventListener=(type,listener)=>handlers.set(type,listener);p.document.removeEventListener=type=>handlers.delete(type);p.env.addEventListener=(type,listener)=>handlers.set(type,listener);p.env.removeEventListener=type=>handlers.delete(type);p.env.MutationObserver=class{constructor(listener){observed=listener;}observe(){}disconnect(){disconnected=true;}};p.env.setTimeout=(callback,ms)=>{assert.equal(ms,12000);deadline=callback;return 1;};p.env.clearTimeout=()=>{cleared=true;};
    const wait=Automatic.waitReady(p.payload,p.env);if(end==='ready'){p.token.value='synthetic-widget-response';p.challengeResponse.value='synthetic-widget-response';observed();}if(end==='deadline')deadline();if(end==='navigation')handlers.get('pagehide')();if(end==='fallback_changed'){p.fallback.value='true';observed();}if(end==='replacement'){p.selectors.set(Base.ROUTES[ROUTE].form+' textarea[name="g-recaptcha-response"]',[{...p.challengeResponse}]);observed();}
    assert.equal((await wait).status,end==='ready'?'ready':'blocked',end);assert.equal(disconnected,true);assert.equal(cleared,true);assert.equal(handlers.size,0);assert.equal(p.clicks(),0);if(end!=='ready'){assert.equal(p.token.value,'');assert.equal(p.challengeResponse.value,'');}
  }
});
