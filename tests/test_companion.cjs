const {test}=require('node:test');
const assert=require('node:assert/strict');
const executor=require('../extension/broker-executor.js');
const background=require('../extension/background.js');
global.getComputedStyle=()=>({display:'block',visibility:'visible',opacity:'1'});
function page(id='peopledatalabs-form'){
 const route=executor.ROUTES[id],map=new Map(),form={action:route.formPath?'https://'+route.host+route.formPath:route.url};
 const element=extra=>({hidden:false,parentElement:null,getClientRects:()=>[{}],...extra});
 class Input{constructor(){Object.assign(this,element({tagName:'INPUT',type:'text',disabled:false,readOnly:false,form}));this._value='';}get value(){return this._value;}set value(v){this._value=v;}dispatchEvent(){this.onEvent?.();}}
 class Select extends Input{constructor(){super();this.options=[{value:'subject'}];}get value(){return this._value;}set value(v){this._value=v;}}
 for(const key of ['email','first_name','last_name'])if(route[key]){const input=new Input();if(key==='email')input.type='email';map.set(route[key],input);}
 let clicked=0,success=false;
 const button=element({form,type:'submit',disabled:false,click(){clicked++;success=true;}});
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
 return {records,count:()=>opens,deny:()=>{permission=false;},storage:{local:{async get(key){return JSON.parse(JSON.stringify({[key]:records[key]}));},async set(data){Object.assign(records,JSON.parse(JSON.stringify(data)));}}},permissions:{async contains(){await new Promise(r=>setImmediate(r));return permission;}},tabs:{async create(){opens++;return{id:opens,status:'complete'};},async get(){return{status:'complete'};}},scripting:{async executeScript(spec){executes++;return spec.files?[]:[{result:{status:'prepared',detail:'Fields filled.'}}];}}};
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
 const m=require('../extension/manifest.json');assert.equal(m.permissions.includes('alarms'),false);assert.equal(m.permissions.includes('tabs'),false);assert.equal(JSON.stringify(m).includes('<all_urls>'),false);assert.equal(m.optional_host_permissions.length,4);
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
