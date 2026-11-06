const {test}=require('node:test');
const assert=require('node:assert/strict');
const executor=require('../extension/broker-executor.js');
const background=require('../extension/background.js');
global.getComputedStyle=()=>({display:'block',visibility:'visible',opacity:'1'});
function page(id='peopledatalabs-form'){
 const route=executor.ROUTES[id],map=new Map(),form={action:route.formPath?'https://'+route.host+route.formPath:route.url,method:route.method||'post'};
 const element=extra=>({hidden:false,parentElement:null,getClientRects:()=>[{}],...extra});
 class Input{constructor(){Object.assign(this,element({tagName:'INPUT',type:'text',disabled:false,readOnly:false,form}));this._value='';}get value(){return this._value;}set value(v){this._value=v;}dispatchEvent(){this.onEvent?.();}}
 class Select extends Input{constructor(){super();this.tagName='SELECT';this.options=[{value:'subject'}];}get value(){return this._value;}set value(v){this._value=v;}}
 for(const key of ['email','first_name','last_name','business_email','listing_url'])if(route[key]){const input=new Input();if(['email','business_email'].includes(key))input.type='email';if(key==='listing_url')input.type='url';map.set(route[key],input);}
 let clicked=0,success=false;
 const button=element({form,type:'submit',disabled:false,textContent:route.submitText||'',click(){clicked++;success=true;}});
 form.querySelectorAll=()=>[button];
 if(route.submit)map.set(route.submit,button);if(route.form)map.set(route.form,form);
 if(id==='usphonebook')map.set('#user-type',new Select());if(id==='fastpeoplesearch')map.set('select[name="am"]',new Select());
 const env={location:{href:route.url},HTMLInputElement:Input,HTMLSelectElement:Select,Event:class{},setTimeout:f=>{f();},document:{querySelector:s=>map.get(s)||null,querySelectorAll:()=>success?[element({textContent:'Email sent!'})]:[]}};
 return {env,map,form,button,clicked:()=>clicked,setSuccess:()=>{success=true;}};
}
test('PDL fresh verification is distinct from deletion',async()=>{
 const p=page();const result=await executor.execute({routeId:'peopledatalabs-form',fields:{email:'person@example.test'}},p.env);
 assert.equal(result.status,'verification_sent');assert.equal(result.evidence,'fresh_visible_success');assert.equal(p.clicked(),1);
});
test('reject different purpose and duplicate erasure actions',async()=>{
 for(const query of ['?action=ACCESS&modal=log-in','?action=ERASURE&action=ACCESS&modal=log-in']){
  const p=page();p.env.location.href='https://privacy.peopledatalabs.com/policies'+query;
  assert.equal((await executor.execute({routeId:'peopledatalabs-form',fields:{email:'person@example.test'}},p.env)).status,'blocked');assert.equal(p.clicked(),0);
 }
});
test('a pre-existing success alert cannot prove a new request',async()=>{
 const p=page();p.setSuccess();assert.equal((await executor.execute({routeId:'peopledatalabs-form',fields:{email:'person@example.test'}},p.env)).status,'blocked');assert.equal(p.clicked(),0);
});
test('input event replacing submit with ACCESS form is blocked',async()=>{
 const p=page();p.map.get('#pc-email-login-input').onEvent=()=>{p.map.set('#email-login-submit',{...p.button,form:{action:'https://privacy.peopledatalabs.com/policies?action=ACCESS&modal=log-in'}});};
 assert.equal((await executor.execute({routeId:'peopledatalabs-form',fields:{email:'person@example.test'}},p.env)).status,'blocked');assert.equal(p.clicked(),0);
});
test('inputs outside approved form never receive personal details',async()=>{
 const p=page(),input=p.map.get('#pc-email-login-input');input.form={action:p.form.action};
 assert.equal((await executor.execute({routeId:'peopledatalabs-form',fields:{email:'person@example.test'}},p.env)).status,'blocked');assert.equal(input.value,'');
});
for(const id of ['usphonebook','searchpeoplefree','fastpeoplesearch'])test(id+' fills only, never clicks or claims submission',async()=>{
 const p=page(id),fields={email:'person@example.test',first_name:'Example',last_name:'Person'};
 const result=await executor.execute({routeId:id,fields},p.env);assert.equal(result.status,'prepared');assert.equal(p.clicked(),0);
 for(const [key,value]of Object.entries(fields))assert.equal(p.map.get(executor.ROUTES[id][key]).value,value);
});
function chromeMock(){
 const records={};let opens=0,executes=0,permission=true;
 return {records,count:()=>opens,deny:()=>{permission=false;},storage:{local:{async get(key){return JSON.parse(JSON.stringify({[key]:records[key]}));},async set(data){Object.assign(records,JSON.parse(JSON.stringify(data)));}}},permissions:{async contains(){await new Promise(r=>setImmediate(r));return permission;}},tabs:{async create(){opens++;return{id:opens,status:'complete'};},async get(){return{status:'complete'};}},scripting:{async executeScript(spec){executes++;return spec.files?[{documentId:'owned-document'}]:[{documentId:'owned-document',result:{status:'prepared',detail:'Fields filled.'}}];}}};
}
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:5}};
const message={type:'erase-me',action:'run',operationId:'a'.repeat(32),routeId:'usphonebook',fields:{email:'person@example.test',first_name:'Example',last_name:'Person'},authorized:true};
test('concurrent same operation opens exactly one broker tab',async()=>{
 const c=chromeMock();await Promise.all([background.dispatch(message,sender,c),background.dispatch(message,sender,c)]);assert.equal(c.count(),1);
 assert.equal(JSON.stringify(c.records).includes('person@example.test'),false);
 await background.dispatch(message,sender,c);assert.equal(c.count(),1);
});
test('unknown stored writes are not retried after worker restart',async()=>{
 const c=chromeMock();c.records['operation:'+message.operationId]={routeId:'usphonebook',result:{status:'unknown'}};
 assert.equal((await background.dispatch(message,sender,c)).status,'unknown');assert.equal(c.count(),0);
});
test('foreign origins and arbitrary URLs cannot trigger execution',async()=>{
 const c=chromeMock();await assert.rejects(background.dispatch(message,{...sender,url:'https://evil.example/'},c));
 await assert.rejects(background.dispatch({...message,routeId:'evil',url:'https://evil.example/'},sender,c));assert.equal(c.count(),0);
});
test('permission denial opens no tab and sends no data',async()=>{
 const c=chromeMock();c.deny();await background.dispatch(message,sender,c);assert.equal(c.count(),0);assert.deepEqual(c.records,{});
});
test('Chrome manifest has no inbox, alarms, or broad host access',()=>{
 const m=require('../extension/manifest.json');assert.equal(m.permissions.includes('alarms'),false);assert.equal(m.permissions.includes('tabs'),false);assert.equal(JSON.stringify(m).includes('<all_urls>'),false);assert.deepEqual([...m.optional_host_permissions].sort(),[...new Set([...Object.values(executor.ROUTES).map(route=>'https://'+route.host+'/*'),'https://'+require('../extension/peopletrace-details.js').HOST+'/*','https://'+require('../extension/cma-details.js').HOST+'/*','https://'+require('../extension/thatsthem-details.js').HOST+'/*','https://'+require('../extension/peoplefinders-details.js').HOST+'/*','https://'+require('../extension/mylife-details.js').HOST+'/*','https://'+require('../extension/mylife-details.js').ENTRY_HOST+'/*'])].sort());
});

const continuationMessage={type:'erase-me',action:'continue',routeId:'usphonebook',operationId:'a'.repeat(32),requestId:'b'.repeat(32),receiptRef:'c'.repeat(64),
 confirmationUrl:'https://www.usphonebook.com/removal/validate-record-info?key=fixture%3D%3D&ticketid=12345678',
 contactEmail:'erase+erase-'+ 'b'.repeat(32)+'@gmail.com',authorized:true,
 fields:{first_name:'Example',last_name:'Person',email:'erase+erase-'+ 'b'.repeat(32)+'@gmail.com',city:'Example City',state:'CA',zip_code:'92101'}};
function continuationPage(){
 const map=new Map(),form={action:'https://www.usphonebook.com/removal/validate-record-info',method:'post'};
 const visible=extra=>({hidden:false,parentElement:null,getClientRects:()=>[{}],...extra});
 class Input{constructor(type='text'){Object.assign(this,visible({tagName:'INPUT',type,disabled:false,readOnly:false,form}));this._value='';}get value(){return this._value;}set value(v){this._value=v;}dispatchEvent(){this.onEvent?.();}}
 class Select extends Input{constructor(){super();this.tagName='SELECT';this.options=[{value:'CA'}];}get value(){return this._value;}set value(v){this._value=v;}}
 for(const id of ['subject-firstname','subject-lastname','subject-email','subject-city','subject-zipcode','subject-dob','subject-phone','subject-streetaddress'])map.set('#'+id,new Input(id==='subject-email'?'email':'text'));
 map.set('#subject-state',new Select());map.set('#removalForm',form);
 let clicked=0;map.set('#CRP',{click(){clicked++;}});map.set('#accuracy-agreement',{checked:false});
 const env={location:{href:continuationMessage.confirmationUrl},HTMLInputElement:Input,HTMLSelectElement:Select,Event:class{},setTimeout:f=>f(),document:{querySelector:s=>map.get(s)||null}};
 return {map,form,env,clicked:()=>clicked};
}
test('reviewed continuation fills only required authorized fields and never certifies or submits',async()=>{
 const p=continuationPage(),result=await executor.executeContinuation(continuationMessage,p.env);
 assert.equal(result.status,'prepared');assert.equal(p.clicked(),0);assert.equal(p.map.get('#accuracy-agreement').checked,false);
 assert.equal(p.map.get('#subject-firstname').value,'Example');assert.equal(p.map.get('#subject-city').value,'Example City');
 assert.equal(p.map.get('#subject-state').value,'CA');assert.equal(p.map.get('#subject-zipcode').value,'92101');
 for(const name of ['subject-dob','subject-phone','subject-streetaddress'])assert.equal(p.map.get('#'+name).value,'');
});
test('continuation holds changed destinations, additional personal fields and record-contact mismatches',async()=>{
 for(const mutate of [p=>{p.form.action+='?purpose=export';},p=>{p.form.method='get';},p=>{p.map.get('#subject-phone').value='5555555555';},p=>{p.env.location.href=continuationMessage.confirmationUrl.replace('/removal/validate-record-info','/login');}]){
  const p=continuationPage();mutate(p);assert.equal((await executor.executeContinuation(continuationMessage,p.env)).status,'blocked');assert.equal(p.map.get('#subject-firstname').value,'');assert.equal(p.clicked(),0);
 }
 for(const change of [{requestId:'d'.repeat(32)},{authorized:false},{confirmationUrl:continuationMessage.confirmationUrl+'&ticketid=9'},
  {fields:{...continuationMessage.fields,zip_code:'0000'}},{fields:{...continuationMessage.fields,phone:'5555555555'}}]){
  assert.throws(()=>executor.validateContinuation({...continuationMessage,...change}));
 }
});
test('continuation journal precedes navigation and prevents repeated or interrupted legs without storing URLs or profile fields',async()=>{
 const c=chromeMock(),open=c.tabs.create;c.tabs.create=async(...args)=>{
  assert.equal(c.records['continuation:'+message.operationId].result.status,'unknown');return open(...args);
 };
 await Promise.all([background.dispatch(continuationMessage,sender,c),background.dispatch(continuationMessage,sender,c)]);
 assert.equal(c.count(),1);await background.dispatch(continuationMessage,sender,c);assert.equal(c.count(),1);
 assert.equal(JSON.stringify(c.records).includes('ticketid'),false);assert.equal(JSON.stringify(c.records).includes('92101'),false);
 assert.equal(JSON.stringify(c.records).includes('@gmail.com'),false);
 assert.equal((await background.dispatch({...continuationMessage,action:'continuation-result'},sender,c)).status,'prepared');
 const interrupted=chromeMock();interrupted.records['continuation:'+message.operationId]={routeId:'usphonebook',result:{status:'unknown'}};
 assert.equal((await background.dispatch(continuationMessage,sender,interrupted)).status,'unknown');assert.equal(interrupted.count(),0);
 const full=chromeMock();full.storage.local.set=async()=>{throw new Error('quota');};await background.dispatch(continuationMessage,sender,full);assert.equal(full.count(),0);
});

const spokeoListing='https://www.spokeo.com/Example-Person/California/Example-City/p123456789012345678901234';
test('Apollo requires an explicit business email and fills only its reviewed business-email form',async()=>{
 const p=page('apollo'),fields={business_email:'business@example.test'};
 assert.throws(()=>executor.validate('apollo',fields),/business email/);
 assert.throws(()=>executor.validate('apollo',{email:'personal@example.test'},{businessEmailConfirmed:true}),/Invalid fields/);
 const result=await executor.execute({routeId:'apollo',fields,businessEmailConfirmed:true},p.env);
 assert.equal(result.status,'prepared');assert.equal(p.clicked(),0);
 assert.equal(p.map.get(executor.ROUTES.apollo.business_email).value,fields.business_email);
});
test('Spokeo accepts only an affirmed exact personal record and never submits it',async()=>{
 const fields={email:'person@example.test',listing_url:spokeoListing};
 assert.throws(()=>executor.validate('spokeo',fields),/exact Spokeo listing/);
 const p=page('spokeo'),result=await executor.execute({routeId:'spokeo',fields,listingConfirmed:true},p.env);
 assert.equal(result.status,'prepared');assert.equal(p.clicked(),0);
 assert.equal(p.map.get(executor.ROUTES.spokeo.listing_url).value,spokeoListing);
 assert.equal(executor.listingURL('https://www.spokeo.com/Example-Person/Example-City/CA/p12345678'),true);
 for(const url of [spokeoListing+'?purchase=true',spokeoListing+'#record',spokeoListing.replace('www.spokeo.com','spokeo.com.evil.test'),
  'https://www.spokeo.com/login','https://www.spokeo.com/Example-Person/Not-A-State/Example-City/p123',spokeoListing.replace('Example-Person','Example%2fPerson')])assert.equal(executor.listingURL(url),false,url);
});
test('new form routes reject foreign forms, changed purpose and changed controls after each input event',async()=>{
 for(const [routeId,fields,approval]of [['apollo',{business_email:'work@example.test'},{businessEmailConfirmed:true}],['spokeo',{email:'person@example.test',listing_url:spokeoListing},{listingConfirmed:true}]]){
  for(const change of [p=>{p.form.action='https://evil.test/collect';},p=>{p.form.method='post';},p=>{p.button.textContent='Export my data';},
    p=>{p.map.get(executor.ROUTES[routeId][Object.keys(fields)[0]]).form={action:p.form.action};}]){
   const p=page(routeId);change(p);assert.equal((await executor.execute({routeId,fields,...approval},p.env)).status,'blocked');
   for(const key of Object.keys(fields))assert.equal(p.map.get(executor.ROUTES[routeId][key]).value,'');assert.equal(p.clicked(),0);
  }
  const p=page(routeId),first=p.map.get(executor.ROUTES[routeId][Object.keys(fields)[0]]);
  first.onEvent=()=>{p.form.action='https://www.'+(routeId==='apollo'?'apollo.io/privacy-policy/remove':'spokeo.com/optout')+'?action=export';};
  assert.equal((await executor.execute({routeId,fields,...approval},p.env)).status,'blocked');assert.equal(p.clicked(),0);
 }
});
test('passive submit proof requires a native event and matching authorized fields, and contains no profile data',async()=>{
 const p=page('usphonebook'),listeners=new Map(),sent=[];
 p.form.addEventListener=(kind,fn)=>listeners.set(kind,fn);
 p.env.chrome={runtime:{sendMessage(msg,reply){sent.push(msg);reply();},lastError:null}};
 const payload={...message,observationNonce:'d'.repeat(32)};
 assert.equal((await executor.execute(payload,p.env)).status,'prepared');assert.equal(sent.length,0);
 listeners.get('submit')({isTrusted:false,target:p.form});assert.equal(sent.length,0);
 listeners.get('submit')({isTrusted:true,target:p.form});assert.equal(sent.length,1);assert.equal(sent[0].fieldsMatch,true);
 p.map.get('#subject-email').value='changed@example.test';listeners.get('submit')({isTrusted:true,target:p.form});
 assert.equal(sent[1].fieldsMatch,false);assert.equal(JSON.stringify(sent).includes('@'),false);assert.equal(p.clicked(),0);
});
test('USPhonebook observation needs the exact unique visible acknowledgment and absence of its initial form',()=>{
 const p=page('usphonebook'),node=textContent=>({textContent,hidden:false,parentElement:null,getClientRects:()=>[{}]});
 const headings=[node('Verify Emial Sent'),node("You're not done")],paragraph=node('An email has been sent to Example Person - person@example.test. Please check your inbox and follow the instructions in the email to complete the opt out process.');
 p.env.document.querySelectorAll=s=>s==='p'?[paragraph]:s==='h1,h2,h3,h4,h5,h6,span'?headings:[];
 const facts=executor.inspect({routeId:'usphonebook'},p.env);
 assert.equal(facts.safe,true);assert.equal(facts.formPresent,true);assert.equal(facts.success,true);assert.equal(facts.observable,true);
 assert.deepEqual(facts.acknowledgment,{name:'Example Person',email:'person@example.test'});
 p.map.delete('#verifyEmailForm');assert.equal(executor.inspect({routeId:'usphonebook'},p.env).formPresent,false);
 paragraph.hidden=true;assert.equal(executor.inspect({routeId:'usphonebook'},p.env).success,false);
 paragraph.hidden=false;p.env.document.querySelectorAll=s=>s==='p'?[paragraph,paragraph]:headings;
 assert.equal(executor.inspect({routeId:'usphonebook'},p.env).success,false);
});
function observationChrome(){
 const records={},sessionRecords={},state={url:executor.ROUTES.usphonebook.url,documentId:'first-document',facts:{safe:true,formPresent:true,success:false,observable:true},opens:0,reads:0,writes:0};
 const clone=value=>JSON.parse(JSON.stringify(value));
 const storage=values=>({async get(key){return values[key]===undefined?{}:{[key]:clone(values[key])};},async set(data){Object.assign(values,clone(data));}});
 const api={records,sessionRecords,state,runtime:{id:'test-extension'},storage:{local:storage(records),session:storage(sessionRecords)},permissions:{async contains(){return true;}},
  tabs:{async create({url}){state.opens++;state.url=url;return{id:1,status:'complete',url};},async get(tabId){return{id:tabId,status:'complete',url:state.url};}},
  scripting:{async executeScript(spec){
   if(spec.files)return[{documentId:state.documentId}];
   if(spec.func.toString().includes('location.href===expected'))return[{documentId:state.documentId,result:state.url===spec.args[0]}];
   if(spec.args.length===1){state.reads++;return[{documentId:state.documentId,result:clone(state.facts)}];}
   state.writes++;state.payload=spec.args[0];return[{documentId:state.documentId,result:{status:'prepared',detail:'Fields filled.'}}];
  }}};
 return api;
}
async function armedObservation(){
 const c=observationChrome();await background.dispatch(message,sender,c);
 const proof=c.sessionRecords['observation:'+message.operationId];assert.ok(proof?.nonce);
 const intent={type:'erase-broker-submit-intent',routeId:message.routeId,operationId:message.operationId,nonce:proof.nonce,fieldsMatch:true,submittedAt:Date.now()};
 const brokerSender={id:c.runtime.id,url:executor.ROUTES.usphonebook.url,tab:{id:1},frameId:0,documentId:'first-document'};
 return {c,intent,brokerSender};
}
const observeMessage={type:'erase-me',action:'observe',routeId:'usphonebook',operationId:message.operationId,authorized:true};
function acknowledged(c,intent){
 c.state.documentId='after-submit';c.state.facts={safe:true,formPresent:false,success:true,observable:true,
  acknowledgment:{name:'Example Person',email:message.fields.email},navigation:{type:'navigate',fromInitial:true,startedAt:intent.submittedAt+1}};
}
test('explicit observation upgrades only fresh verified initiation, reads the owned tab and never repeats a write',async()=>{
 const {c,intent,brokerSender}=await armedObservation();await background.captureIntent(intent,brokerSender,c);
 acknowledged(c,intent);
 const result=await background.dispatch(observeMessage,sender,c);
 assert.equal(result.status,'verification_sent');assert.equal(result.observation_verified,true);assert.equal(result.route_verified,true);
 assert.equal(result.evidence,'fresh_visible_success');assert.equal(c.state.opens,1);assert.equal(c.state.writes,1);assert.equal(c.state.reads,2);
 assert.equal(JSON.stringify(c.records).includes('person@example.test'),false);assert.equal(JSON.stringify(c.sessionRecords).includes('Example'),false);
 assert.equal(c.records['operation:'+message.operationId].result.status,'verification_sent');
});
test('forged intent origins, documents, tabs, extensions and nonces cannot authorize observation',async()=>{
 const {c,intent,brokerSender}=await armedObservation();
 for(const changed of [{...brokerSender,url:'https://erase-me-preview.vercel.app/'},{...brokerSender,url:'https://www.usphonebook.com/login'},
  {...brokerSender,tab:{id:7}},{...brokerSender,documentId:'other-document'},{...brokerSender,id:'other-extension'},{...brokerSender,frameId:1}]){
  await assert.rejects(background.captureIntent(intent,changed,c),/Untrusted observation proof/);
 }
 await assert.rejects(background.captureIntent({...intent,nonce:'f'.repeat(32)},brokerSender,c),/Untrusted observation proof/);
 assert.equal(c.sessionRecords['observation:'+message.operationId].intent,undefined);
 assert.equal((await background.dispatch(observeMessage,sender,c)).status,'unknown');assert.equal(c.state.reads,1);assert.equal(c.state.writes,1);
});
test('missing session proof, stale acknowledgment, changed pages and unmatched fields remain unknown without downgrade or resend',async()=>{
 for(const mutate of [({c})=>{delete c.sessionRecords['erase-browser-session'];},({c})=>{c.state.url='https://www.usphonebook.com/login';},
  ({c})=>{c.state.documentId='first-document';},({c})=>{c.state.facts.formPresent=true;},({c})=>{c.state.facts.success=false;},
  ({c})=>{c.sessionRecords['observation:'+message.operationId].intent.fieldsMatch=false;}]){
  const fixture=await armedObservation(),{c,intent,brokerSender}=fixture;await background.captureIntent(intent,brokerSender,c);
  acknowledged(c,intent);mutate(fixture);
  assert.equal((await background.dispatch(observeMessage,sender,c)).status,'unknown');assert.equal(c.records['operation:'+message.operationId].result.status,'prepared');
  assert.equal(c.state.writes,1);assert.equal(c.state.opens,1);
 }
 const {c}=await armedObservation();assert.equal((await background.dispatch({...observeMessage,authorized:false},sender,c)).status,'unknown');
 assert.equal((await background.dispatch({...observeMessage,routeId:'apollo'},sender,c)).status,'unknown');assert.equal(c.state.reads,1);
});
test('PDL deferred observation requires its original document and an armed matching form event',async()=>{
 const c=observationChrome(),request={...message,routeId:'peopledatalabs-form',fields:{email:'person@example.test'}};
 await background.dispatch(request,sender,c);
 const proof=c.sessionRecords['observation:'+message.operationId];
 await background.captureIntent({type:'erase-broker-submit-intent',routeId:request.routeId,operationId:request.operationId,nonce:proof.nonce,fieldsMatch:true,submittedAt:Date.now()},
  {id:c.runtime.id,url:executor.ROUTES[request.routeId].url,tab:{id:1},frameId:0,documentId:'first-document'},c);
 c.state.facts={safe:true,formPresent:true,success:true,observable:true};
 assert.equal((await background.dispatch({...observeMessage,routeId:request.routeId},sender,c)).status,'verification_sent');
 c.state.documentId='unrelated-reload';
 assert.equal((await background.dispatch({...observeMessage,routeId:request.routeId},sender,c)).status,'unknown');
 assert.equal(c.state.opens,1);assert.equal(c.state.writes,1);
});
test('USPhonebook acknowledgment is bound to the authorized name/email with a session-only keyed digest',async()=>{
 for(const mutate of [c=>{c.state.facts.acknowledgment.name='Different Person';},c=>{c.state.facts.acknowledgment.email='different@example.test';},
  c=>{delete c.sessionRecords['erase-observation-key'];}]){
  const {c,intent,brokerSender}=await armedObservation();await background.captureIntent(intent,brokerSender,c);acknowledged(c,intent);mutate(c);
  assert.equal((await background.dispatch(observeMessage,sender,c)).status,'unknown');
  assert.equal(c.records['operation:'+message.operationId].result.status,'prepared');assert.equal(c.state.opens,1);assert.equal(c.state.writes,1);
  assert.equal(JSON.stringify(c.records).includes('expectedAcknowledgment'),false);
  assert.equal(JSON.stringify(c.sessionRecords).includes(message.fields.email),false);assert.equal(JSON.stringify(c.sessionRecords).includes('Example Person'),false);
 }
});
test('USPhonebook history, reloads, uncertain navigation and later unrelated documents cannot reuse submission proof',async()=>{
 for(const mutate of [c=>{c.state.facts.navigation.type='back_forward';},c=>{c.state.facts.navigation.type='reload';},
  c=>{c.state.facts.navigation.type=null;},c=>{c.state.facts.navigation.fromInitial=false;},
  c=>{c.state.facts.navigation.startedAt+=30001;},c=>{c.state.facts.navigation.startedAt-=20;}]){
  const {c,intent,brokerSender}=await armedObservation();await background.captureIntent(intent,brokerSender,c);acknowledged(c,intent);mutate(c);
  assert.equal((await background.dispatch(observeMessage,sender,c)).status,'unknown');assert.equal(c.records['operation:'+message.operationId].result.status,'prepared');
 }
 const {c,intent,brokerSender}=await armedObservation();await background.captureIntent(intent,brokerSender,c);acknowledged(c,intent);
 assert.equal((await background.dispatch(observeMessage,sender,c)).status,'verification_sent');
 c.state.documentId='later-unrelated-document';
 assert.equal((await background.dispatch(observeMessage,sender,c)).status,'unknown');
 assert.equal(c.state.opens,1);assert.equal(c.state.writes,1);
});

const structuredCases={
 advancedbackgroundchecks:{url:'https://www.advancedbackgroundchecks.com/opt-out',method:'get',submit:'Submit',selectors:{first_name:'#sfn',last_name:'#sln',email:'#semail'},
  fields:{first_name:'Example',last_name:'Person',email:'person@example.test'},selection:['#mode','subject'],untouched:{'input[name="company"]':'page-owned'}},
 'tr-nosorgulama':{url:'https://www.nosorgulama.com.tr/iletisim/',method:'post',submit:'Mesajı Gönder',selectors:{full_name:'#ic-ad[name="ad_soyad"]',email:'#ic-email[name="email"]',request_text:'#ic-mesaj[name="mesaj"]'},
  fields:{full_name:'Örnek Kişi',email:'person@example.test',request_text:'Lütfen bana ait kaydı kaldırın.\nBu kendi bilgilerim için bir taleptir.'},selection:['#ic-konu[name="konu"]','profil-kaldir'],untouched:{'input[name="_csrf"]':'page-owned','input[name="website_url"]':''}},
 'tr-numaraara':{url:'https://www.numaraara.com/iletisim',action:'https://www.numaraara.com/Contact/ContactFormSend',method:'post',submit:'Talebi Gönder',selectors:{full_name:'#form_AdSoyad[name="form.AdSoyad"]',email:'#form_Eposta[name="form.Eposta"]',request_text:'#form_Mesaj[name="form.Mesaj"]'},
  fields:{full_name:'Örnek Kişi',email:'person@example.test',request_text:'Lütfen bana ait numara kaydını kaldırın.'},selection:['#form_Konu[name="form.Konu"]','Numara Silme Talebi (KVKK)'],untouched:{'#form_Kvkk[name="form.Kvkk"]':'','#form_ResimKodu[name="form.ResimKodu"]':'','input[name="__RequestVerificationToken"]':'page-owned'}},
 'tr-numarasor':{url:'https://www.numarasor.com/numara-kaldirma-talebi',method:'post',submit:'Talebi Gönder',selectors:{full_name:'#name[name="name"]',email:'#email[name="email"]',phone:'#number[name="number"]',request_text:'#reason[name="reason"]'},
  fields:{full_name:'Örnek Kişi',email:'person@example.test',phone:'+90 (500) 000-00-00',request_text:'Lütfen bana ait bu numaranın kaydını kaldırın.'},selection:['#relation[name="relation"]','Numara sahibiyim'],untouched:{'input[name="_csrf"]':'page-owned','input[name="website"]':'','#phone[name="phone"]':''}},
 'tr-telefonsorgulama':{url:'https://www.telefonsorgulama.com/iletisim.html',action:'https://www.telefonsorgulama.com/iletisim-gonder.php',method:'post',submit:'Mesajı Gönder',selectors:{full_name:'#iletisimForm input[name="name"]',email:'#iletisimForm input[name="email"]',request_text:'#iletisimForm textarea[name="message"]'},
  fields:{full_name:'Örnek Kişi',email:'person@example.test',request_text:'Lütfen bana ait numara sayfasını kaldırın.'},selection:['#iletisimForm select[name="subject"]','kaldirma'],untouched:{'input#recaptcha_token[name="recaptcha_token"]':'page-owned'}}
};
function structuredPage(id){
 const c=structuredCases[id],map=new Map(),events=[],form={action:c.action||c.url,method:c.method};
 const visible=extra=>({hidden:false,parentElement:null,getClientRects:()=>[{}],...extra});
 class Input{constructor(type='text'){Object.assign(this,visible({tagName:'INPUT',type,disabled:false,readOnly:false,form}));this._value='';}get value(){return this._value;}set value(v){this._value=v;}dispatchEvent(e){events.push({key:this.key,type:e.type,value:this.value});this.onEvent?.();}}
 class Textarea extends Input{constructor(){super();this.tagName='TEXTAREA';this.type='textarea';}get value(){return this._value;}set value(v){this._value=v.replace(/\r\n?/g,'\n');}}
 class Select extends Input{constructor(){super();this.tagName='SELECT';this.type='select-one';this.options=[{value:''},{value:c.selection[1]}];}get value(){return this._value;}set value(v){this._value=v;}}
 for(const [key,selector]of Object.entries(c.selectors)){const e=key==='request_text'?new Textarea():new Input(key==='email'?'email':key==='phone'?'tel':'text');e.key=key;map.set(selector,e);}
 const choice=new Select();choice.key='purpose';map.set(c.selection[0],choice);
 for(const [selector,value]of Object.entries(c.untouched)){const e=new Input();e._value=value;e.checked=false;map.set(selector,e);}
 let clicked=0;const button=visible({type:'submit',form,disabled:false,textContent:c.submit,click(){clicked++;}});form.querySelectorAll=()=>[button];
 if(id==='tr-numaraara')map.set('form#contactForm',form);
 if(id==='tr-telefonsorgulama')map.set('form#iletisimForm',form);
 const env={location:{href:c.url},HTMLInputElement:Input,HTMLTextAreaElement:Textarea,HTMLSelectElement:Select,Event:class{constructor(type){this.type=type;}},setTimeout:f=>f(),document:{querySelector:s=>map.get(s)||null,querySelectorAll:()=>[]}};
 return{c,map,form,choice,button,env,events,clicked:()=>clicked};
}
for(const id of Object.keys(structuredCases))test(id+' fills only the own-request fields and exact removal purpose without submitting',async()=>{
 const p=structuredPage(id);
 assert.throws(()=>executor.validate(id,p.c.fields),/own request/);
 assert.throws(()=>executor.validate(id,p.c.fields,{ownRequestConfirmed:false}),/own request/);
 const result=await executor.execute({routeId:id,fields:p.c.fields,ownRequestConfirmed:true},p.env);
 assert.equal(result.status,'prepared');assert.equal(p.clicked(),0);assert.equal(p.choice.value,p.c.selection[1]);
 for(const [key,value]of Object.entries(p.c.fields))assert.equal(p.map.get(p.c.selectors[key]).value,value);
 for(const [selector,value]of Object.entries(p.c.untouched)){assert.equal(p.map.get(selector).value,value);assert.equal(p.map.get(selector).checked,false);}
 for(const key of Object.keys(p.c.fields))assert.deepEqual(p.events.filter(e=>e.key===key).map(e=>e.type),['input','change']);
});
test('structured prefill rejects changed origins, action methods, purpose controls and foreign fields before personal data is filled',async()=>{
 for(const id of Object.keys(structuredCases)){
  for(const change of [p=>{p.env.location.href+='?purpose=export';},p=>{p.form.action='https://foreign.example/collect';},p=>{p.form.method=p.c.method==='get'?'post':'get';},
   p=>{p.choice.form={};},p=>{p.choice.options=[];},p=>{p.button.textContent='Export data';},p=>{p.map.get(p.c.selectors.email).form={};},p=>{p.map.get(p.c.selectors.email).type='text';}]){
   const p=structuredPage(id);change(p);
   assert.equal((await executor.execute({routeId:id,fields:p.c.fields,ownRequestConfirmed:true},p.env)).status,'blocked',id);
   assert.equal(p.clicked(),0);for(const selector of Object.values(p.c.selectors))assert.equal(p.map.get(selector).value,'');
  }
  for(const mutate of [p=>{p.form.action='https://foreign.example/collect';},p=>{p.map.get(p.c.selectors.email).hidden=true;},p=>{p.map.get(p.c.selectors.email).type='hidden';}]){
   const p=structuredPage(id),firstKey=Object.keys(p.c.fields)[0],first=p.map.get(p.c.selectors[firstKey]);first.onEvent=()=>mutate(p);
   assert.equal((await executor.execute({routeId:id,fields:p.c.fields,ownRequestConfirmed:true},p.env)).status,'blocked');assert.equal(p.clicked(),0);
   for(const key of Object.keys(p.c.fields).filter(k=>k!==firstKey))assert.equal(p.map.get(p.c.selectors[key]).value,'');
  }
 }
});
test('structured values preserve Unicode/newlines and phone literal while rejecting extra details or invalid fields',async()=>{
 const p=structuredPage('tr-nosorgulama'),fields={...p.c.fields,request_text:'İstek metni <kendi kaydım>\r\nİkinci satır bilgileri.'};
 assert.equal((await executor.execute({routeId:'tr-nosorgulama',fields,ownRequestConfirmed:true},p.env)).status,'prepared');
 assert.equal(p.map.get(p.c.selectors.request_text).value,fields.request_text.replace(/\r\n/g,'\n'));
 for(const bad of [{...p.c.fields,request_text:'short'},{...p.c.fields,request_text:'x'.repeat(5001)},{...p.c.fields,request_text:'unsafe\u0000request'},{...p.c.fields,full_name:'x'.repeat(121)},{...p.c.fields,date_of_birth:'2000-01-01'}])assert.throws(()=>executor.validate('tr-nosorgulama',bad,{ownRequestConfirmed:true}));
 for(const phone of ['123456','1234567890123456','phone@example.test','+90<script>'])assert.throws(()=>executor.validate('tr-numarasor',{...structuredCases['tr-numarasor'].fields,phone},{ownRequestConfirmed:true}));
});
test('background forwards the own-request approval and never stores structured profile fields in its journal',async()=>{
 const c=chromeMock(),request={...message,routeId:'tr-nosorgulama',fields:structuredCases['tr-nosorgulama'].fields,ownRequestConfirmed:true};let sent;
 c.scripting.executeScript=async spec=>{if(spec.files)return[];sent=spec.args[0];return[{result:{status:'prepared',detail:'Fields filled.'}}];};
 await assert.rejects(background.dispatch({...request,ownRequestConfirmed:false},sender,c),/own request/);
 assert.equal(c.count(),0);assert.deepEqual(c.records,{});
 assert.equal((await background.dispatch(request,sender,c)).status,'prepared');assert.equal(sent.ownRequestConfirmed,true);
 assert.equal(JSON.stringify(c.records).includes('Örnek'),false);assert.equal(JSON.stringify(c.records).includes('person@example.test'),false);
});
test('replaced controls cannot make a captured foreign node receive later personal fields',async()=>{
 for(const id of Object.keys(structuredCases)){
  const p=structuredPage(id),old=p.map.get(p.c.selectors.email),replacement=new old.constructor('email');replacement.key='email';
  p.map.get(p.c.selectors[Object.keys(p.c.fields)[0]]).onEvent=()=>{old.form={action:'https://foreign.example/collect'};p.map.set(p.c.selectors.email,replacement);};
  assert.equal((await executor.execute({routeId:id,fields:p.c.fields,ownRequestConfirmed:true},p.env)).status,'prepared');
  assert.equal(old.value,'');assert.equal(replacement.value,p.c.fields.email);assert.equal(p.clicked(),0);
 }
 const p=continuationPage(),old=p.map.get('#subject-email'),replacement=new old.constructor('email');
 p.map.get('#subject-firstname').onEvent=()=>{old.form={action:'https://foreign.example/collect'};p.map.set('#subject-email',replacement);};
 assert.equal((await executor.executeContinuation(continuationMessage,p.env)).status,'prepared');
 assert.equal(old.value,'');assert.equal(replacement.value,continuationMessage.fields.email);assert.equal(p.clicked(),0);
});
