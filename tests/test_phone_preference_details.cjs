'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Helper=require('../extension/phone-preference-details.js');
const payload=(routeId='ca-dncl')=>({routeId,operationId:'a'.repeat(32),authorized:true,ownRequestConfirmed:true,consentId:Helper.ROUTES[routeId].consentId,details:{phone:routeId==='ca-dncl'?'416-555-0100':'02079460958'}});
test('only the two observed first-step marketing preference routes are available',()=>{
  assert.deepEqual(Object.keys(Helper.ROUTES),['ca-dncl','gb-tps']);
  for(const r of Object.values(Helper.ROUTES)){assert.match(r.notice,/not broker-record deletion/);assert.match(r.authorization,/my own/);assert.equal(Object.isFrozen(r),true);}
  assert.match(Helper.ROUTES['ca-dncl'].notice,/everyone sharing/);assert.match(Helper.ROUTES['gb-tps'].authorization,/residential/);
});
test('Canadian normalization is explicit and UK numbers retain the leading zero',()=>{
  assert.deepEqual(Helper.validateDetails({phone:'+1 (416) 555-0100'},{routeId:'ca-dncl'}),{phone:'416-555-0100'});
  assert.deepEqual(Helper.validateDetails({phone:'020 7946 0958'},{routeId:'gb-tps'}),{phone:'02079460958'});
  for(const[id,phone]of [['ca-dncl','123-456-7890'],['ca-dncl','41655501001'],['ca-dncl','+4165550100'],['gb-tps','+442079460958'],['gb-tps','2079460958'],['gb-tps','02079\n460958'],['gb-tps','02079460958<script>']])assert.throws(()=>Helper.validateDetails({phone},{routeId:id}));
});
test('phone details never accept name, email, other numbers or undeclared channels',()=>{
  for(const details of [{phone:'416-555-0100',email:'fixture@example.test'},{phone:['416-555-0100']},{phone:'416-555-0100,416-555-0101'},null])assert.throws(()=>Helper.validateDetails(details,{routeId:'ca-dncl'}));
  assert.throws(()=>Helper.validateDetails({phone:'416-555-0100'},{routeId:'ca-cma-do-not-mail'}));
});
test('both route payloads require the exact fresh canonical number and own approval',()=>{
  for(const id of Object.keys(Helper.ROUTES)){
    Helper.validatePayload(payload(id));
    for(const extra of [{authorized:false},{ownRequestConfirmed:false},{consentId:'old'},{operationId:'invalid'},{autoSubmit:true},{identity:{full_name:'Example Person'}},{details:{phone:id==='ca-dncl'?'4165550100':'020 7946 0958'}}])assert.throws(()=>Helper.validatePayload({...payload(id),...extra}));
  }
});
test('public preparation accepts no phone or identity payload and fails closed without a reviewed page',()=>{
  for(const value of [{routeId:'gb-tps',phone:'02079460958'},{routeId:'ca-dncl',identity:{}},{routeId:'other'},null])assert.equal(Helper.preparePage(value,{}).status,'blocked');
});
test('preparation errors and execution errors never echo private telephone values',()=>{
  const p=payload();const result=Helper.execute(p,{});assert.equal(result.status,'blocked');assert.equal(JSON.stringify(result).includes(p.details.phone),false);assert.equal(result.attempt_verified,undefined);
});
