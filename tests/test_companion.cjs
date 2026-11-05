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
