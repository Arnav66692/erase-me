'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Mail=require('../webapp/static/removal-mail-client.js');
const KEY='f'.repeat(64),OPERATION='a'.repeat(32),REQUEST='b'.repeat(32),CAPABILITY='e30.'+'c'.repeat(43);
const STATUS={configured:false,enabled:false,provider:'gmail',on_demand:true,automatic_execution:false,access:'private_pilot',authorization_required:true};
const SESSION={status:'ready',route_id:'usphonebook',operation_id:OPERATION,request_id:REQUEST,contact_email:'erase+erase-'+REQUEST+'@example.test',
  capability:CAPABILITY,expires_at:1800000000,automatic_execution:false};
const PENDING={status:'pending',route_id:'usphonebook',operation_id:OPERATION,request_id:REQUEST,automatic_execution:false};
const HELD={...PENDING,status:'held',reason:'route_validation_required',received_at:1790000000,authenticated:true,receipt_ref:'d'.repeat(64),continuation_available:false};
function fixture(value=STATUS,{code=200,origin='https://erase-me-preview.vercel.app'}={}){
  const calls=[];
  const client=Mail.create({location:{origin},fetch:async(path,options)=>{calls.push({path,options});return {ok:code>=200&&code<300,status:code,text:async()=>JSON.stringify(value)};}});
  return {client,calls};
}
test('receipt relay does nothing until an explicit method is called',async()=>{
  const {client,calls}=fixture();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,0);
  assert.deepEqual(await client.status(),STATUS);assert.equal(calls.length,1);
  assert.equal(calls[0].path,'/api/removal-mail/status');assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.body,undefined);
  assert.equal(calls[0].options.headers['X-Erase-Mail-Key'],undefined);
});
test('session sends only scoped references with a private header, never profile data or query tokens',async()=>{
  const {client,calls}=fixture(SESSION);const body={route_id:'usphonebook',operation_id:OPERATION,authorized:true};
  assert.deepEqual(await client.session(body,KEY),SESSION);assert.equal(calls.length,1);
  const {path,options}=calls[0];assert.equal(path,'/api/removal-mail/session');assert.deepEqual(JSON.parse(options.body),body);
  assert.equal(options.headers['X-Erase-Mail-Key'],KEY);assert.equal(options.headers['X-Erase-Me'],'1');
  assert.equal(options.credentials,'omit');assert.equal(options.mode,'same-origin');assert.equal(options.redirect,'error');assert.equal(options.referrerPolicy,'no-referrer');
  assert.equal(options.body.includes(KEY),false);assert.equal(path.includes('?'),false);
  for(const key of ['email','name','age','country','access_token','refresh_token'])assert.equal(Object.hasOwn(JSON.parse(options.body),key),false);
});
test('missing or malformed pilot authorization never reaches any mailbox API',async()=>{
  for(const key of [undefined,'','secret','a'.repeat(63),'g'.repeat(64)]){
    const {client,calls}=fixture(SESSION);
    await assert.rejects(()=>client.session({route_id:'usphonebook',operation_id:OPERATION,authorized:true},key),/private operator pilot key/);
    await assert.rejects(()=>client.check({capability:CAPABILITY,explicit:true},key),/private operator pilot key/);
    assert.equal(calls.length,0);
  }
});
test('identity routes, added profile fields, non-explicit actions and insecure origins fail before fetch',async()=>{
  for(const body of [
    {route_id:'peopledatalabs-form',operation_id:OPERATION,authorized:true},{route_id:'apollo',operation_id:OPERATION,authorized:true},
    {route_id:'usphonebook',operation_id:OPERATION,authorized:true,email:'private@example.test'},
    {route_id:'usphonebook',operation_id:OPERATION,authorized:false},{route_id:'usphonebook',operation_id:'bad',authorized:true}
  ]){
    const {client,calls}=fixture(SESSION);await assert.rejects(()=>client.session(body,KEY));assert.equal(calls.length,0);
  }
  for(const origin of ['http://erase-me-preview.vercel.app','https://person:password@example.test','javascript:bad','https://example.test/path']){
    const {client,calls}=fixture(SESSION,{origin});await assert.rejects(()=>client.session({route_id:'usphonebook',operation_id:OPERATION,authorized:true},KEY),/HTTPS workspace/);assert.equal(calls.length,0);
  }
  const {client,calls}=fixture(PENDING);await assert.rejects(()=>client.check({capability:CAPABILITY,explicit:false},KEY));assert.equal(calls.length,0);
});
test('receipt checks return only pending or authenticated held metadata, with no navigation',async()=>{
  for(const value of [PENDING,HELD]){
    const {client,calls}=fixture(value);assert.deepEqual(await client.check({capability:CAPABILITY,explicit:true},KEY),value);
    assert.equal(calls[0].path,'/api/removal-mail/check');assert.deepEqual(JSON.parse(calls[0].options.body),{capability:CAPABILITY,explicit:true});
    assert.equal(calls[0].options.headers['X-Erase-Mail-Key'],KEY);assert.equal(calls.length,1);
  }
  for(const value of [{...HELD,url:'https://broker.example/confirm'},{...HELD,authenticated:false},{...PENDING,status:'removed'},{...PENDING,automatic_execution:true}]){
    await assert.rejects(()=>fixture(value).client.check({capability:CAPABILITY,explicit:true},KEY),/invalid receipt/);
  }
});
test('server disabled, expired and denied responses are meaningful and never echo a secret',async()=>{
  for(const [code,message]of [[503,/not connected or enabled/],[403,/operator pilot authorization/],[410,/expired/]]){
    const {client}=fixture({error:KEY},{code});await assert.rejects(()=>client.check({capability:CAPABILITY,explicit:true},KEY),error=>message.test(error.message)&&!error.message.includes(KEY));
  }
  const client=Mail.create({location:{origin:'https://erase-me-preview.vercel.app'},fetch:async()=>{throw new Error('The dedicated '+KEY);}});
  await assert.rejects(()=>client.check({capability:CAPABILITY,explicit:true},KEY),error=>!error.message.includes(KEY)&&/unavailable/.test(error.message));
});
test('strict response allowlists reject contact mismatches, leaked fields and claimed automation',async()=>{
  for(const value of [{...SESSION,operation_id:'d'.repeat(32)},{...SESSION,route_id:'apollo'},{...SESSION,refresh_token:'private'},{...SESSION,automatic_execution:true}]){
    await assert.rejects(()=>fixture(value).client.session({route_id:'usphonebook',operation_id:OPERATION,authorized:true},KEY),/invalid contact/);
  }
  for(const value of [{...STATUS,enabled:true},{...STATUS,automatic_execution:true},{...STATUS,email:'private@example.test'}])await assert.rejects(()=>fixture(value).client.status(),/invalid configuration/);
});

const CONFIRM_URL='https://www.usphonebook.com/removal/validate-record-info?key='+ 'a'.repeat(418)+'%3D%3D&ticketid=12345678';
test('explicit continuation accepts only the reviewed destination and keeps profile fields out of the API',async()=>{
  const value={status:'confirmation_ready',route_id:'usphonebook',operation_id:OPERATION,request_id:REQUEST,receipt_ref:HELD.receipt_ref,
    confirmation_url:CONFIRM_URL,automatic_execution:false};
  const {client,calls}=fixture(value),body={capability:CAPABILITY,explicit:true,receipt_ref:HELD.receipt_ref};
  assert.deepEqual(await client.continuation(body,KEY),value);
  assert.equal(calls[0].path,'/api/removal-mail/continue');assert.deepEqual(JSON.parse(calls[0].options.body),body);
  assert.equal(calls[0].options.body.includes('zip'),false);assert.equal(calls[0].options.headers['X-Erase-Mail-Key'],KEY);
  for(const url of [CONFIRM_URL.replace('www.usphonebook.com','evil.example'),CONFIRM_URL+'&ticketid=9',CONFIRM_URL+'&redirect=evil',
    CONFIRM_URL.replace('/removal/validate-record-info','/login'),CONFIRM_URL+'#token',CONFIRM_URL.replace('ticketid=12345678','ticketid=abc'),CONFIRM_URL.replace('https:','http:')]){
    await assert.rejects(()=>fixture({...value,confirmation_url:url}).client.continuation(body,KEY),/could not be validated/);
  }
  await assert.rejects(()=>fixture({...value,receipt_ref:'a'.repeat(64)}).client.continuation(body,KEY),/could not be validated/);
  const rejected=fixture(value);await assert.rejects(()=>rejected.client.continuation({...body,zip_code:'12345'},KEY));assert.equal(rejected.calls.length,0);
});
