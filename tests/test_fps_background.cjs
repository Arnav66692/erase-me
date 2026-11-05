'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Background=require('../extension/background.js');
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:90}};
const requestId='b'.repeat(32),email='removal+erase-'+requestId+'@gmail.com';
const url='https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email,ticketid:'12345678'});
const message={type:'erase-me',action:'continue',routeId:'fastpeoplesearch',operationId:'a'.repeat(32),requestId,receiptRef:'c'.repeat(64),confirmationUrl:url,contactEmail:email,fields:{first_name:'Example',last_name:'Person',email},authorized:true};
function fixture({changed=false,missing=false,permission=true}={}){
  const records={},calls=[];
  return {records,calls,api:{
    storage:{local:{get:async key=>({[key]:records[key]}),set:async values=>Object.assign(records,JSON.parse(JSON.stringify(values))) }},
    permissions:{contains:async()=>permission},
    tabs:{create:async value=>{assert.equal(records['continuation:'+message.operationId].result.status,'unknown');calls.push({kind:'open',url:value.url});return{id:7,status:'complete'};},get:async()=>({id:7,status:'complete'})},
    scripting:{executeScript:async spec=>{
      if(spec.files){calls.push({kind:'install'});return missing?[]:[{documentId:'confirmation-document'}];}
      assert.deepEqual(spec.target.documentIds,['confirmation-document']);
      assert.equal(spec.args[1],true);assert.equal(spec.args[0].routeId,'fastpeoplesearch');
      calls.push({kind:'read'});return[{documentId:changed?'different-document':'confirmation-document',result:{status:'prepared',detail:'The authenticated matching form is ready. Identity details and final acceptance remain outstanding.'}}];
    }}
  }};
}
test('FPS confirmation journals before navigation, pins the document and never stores the private URL or identity',async()=>{
  const f=fixture();const result=await Background.dispatch(message,sender,f.api);
  assert.equal(result.status,'prepared');assert.equal(f.calls.filter(call=>call.kind==='open').length,1);
  await Promise.all([Background.dispatch(message,sender,f.api),Background.dispatch(message,sender,f.api)]);
  assert.equal(f.calls.filter(call=>call.kind==='open').length,1);
  const saved=JSON.stringify(f.records);
  for(const value of [url,email,'Example','Person','ticketid','firstname'])assert.equal(saved.includes(value),false);
  assert.equal((await Background.dispatch({...message,action:'continuation-result'},sender,f.api)).status,'prepared');
});
test('FPS confirmation rejects a mismatched identity, email, middle name or action before navigation',async()=>{
  for(const change of [{authorized:false},{requestId:'d'.repeat(32)},{confirmationUrl:url.replace('firstname=Example','firstname=Someone')},{confirmationUrl:url.replace('middlename=','middlename=Unexpected')},{fields:{...message.fields,email:'person@example.test'}},{confirmationUrl:url+'&purpose=export'}]){
    const f=fixture();await assert.rejects(Background.dispatch({...message,...change},sender,f.api));assert.equal(f.calls.length,0);
  }
});
test('missing permission or document provenance cannot report a prepared confirmation and never repeats',async()=>{
  for(const options of [{permission:false},{missing:true},{changed:true}]){
    const f=fixture(options);const result=await Background.dispatch(message,sender,f.api);assert.equal(result.status,'unknown');
    await Background.dispatch(message,sender,f.api);
    assert.ok(f.calls.filter(call=>call.kind==='open').length<=1);
    if(options.missing)assert.equal(f.calls.filter(call=>call.kind==='read').length,0);
  }
});
