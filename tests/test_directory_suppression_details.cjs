'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Helper=require('../extension/directory-suppression-details.js');
const details=()=>({first_name:'Example',last_name:'Person',postcode:'SW1A 1AA',email:'removal@example.test'});
const payload=()=>({routeId:'192com',operationId:'a'.repeat(32),authorized:true,ownRequestConfirmed:true,consentId:Helper.CONTRACT.id,identity:{full_name:'Example Person'},details:details()});
test('the own-record suppression contract pins the official service and leaves challenge/submission manual',()=>{
  assert.equal(Helper.ROUTES['192com'].url,'https://www.192.com/c01/new-request/');assert.equal(Helper.HOST,'www.192.com');
  assert.match(Helper.CONTRACT.authorization,/my own record/);assert.match(Helper.CONTRACT.authorization,/challenge, submit and confirm the email/);
});
test('exact four-field review normalizes a UK postcode and verifies the own profile name',()=>{
  assert.deepEqual(Helper.validateDetails({...details(),postcode:'sw1a1aa'},{fullName:'Example Person'}),details());
  assert.throws(()=>Helper.validateDetails(details(),{fullName:'Different Person'}));assert.throws(()=>Helper.validateDetails(details(),{routeId:'canada411'}));
});
test('192.com omits profile middle components only through explicit own-name entry and preserves compound surnames',()=>{
  assert.deepEqual(Helper.validateDetails(details(),{fullName:'Example Private Person'}),details());
  const compound={...details(),last_name:'van der Meer'};assert.deepEqual(Helper.validateDetails(compound,{fullName:'Example Private van der Meer'}),compound);
  for(const value of [{...details(),first_name:'Example Private'},{...details(),first_name:'Different'},{...compound,last_name:'van der Other'}])assert.throws(()=>Helper.validateDetails(value,{fullName:'Example Private van der Meer'}));
  const p={...payload(),identity:{full_name:'Example Private Person'}};Helper.validatePayload(p);assert.equal(p.details.first_name,'Example');assert.equal(Object.hasOwn(p.details,'middle_name'),false);
});
test('unreviewed phone, other people, arbitrary destination and malformed identity fields are rejected',()=>{
  for(const value of [{...details(),phone:'02079460958'},{...details(),otherFullNames:[]},{...details(),to:'other@example.test'},{...details(),postcode:'92130'},{...details(),email:'x@example.test\r\nBcc:other@example.test'},{...details(),first_name:'Example<script>'},{...details(),email:'x'.repeat(76)}])assert.throws(()=>Helper.validateDetails(value,{fullName:'Example Person'}));
});
test('payload cannot add a challenge answer, automatic submit or missing authorization',()=>{
  Helper.validatePayload(payload());
  for(const extra of [{authorized:false},{ownRequestConfirmed:false},{consentId:'old'},{operationId:'wrong'},{routeId:'usphonebook'},{autoSubmit:true},{controlX:'7'},{identity:{full_name:'Example Person',email:'other@example.test'}},{details:{...details(),postcode:'sw1a1aa'}}])assert.throws(()=>Helper.validatePayload({...payload(),...extra}));
});
test('public preparation releases no private fields and execution errors disclose no private content',()=>{
  assert.equal(Helper.preparePage({routeId:'192com',details:details()},{}).status,'blocked');
  const result=Helper.execute(payload(),{});assert.equal(result.status,'blocked');assert.equal(JSON.stringify(result).includes('removal@example.test'),false);assert.equal(result.attempt_verified,undefined);
});
test('Canada411 is a separate own-record web-only contract with a fixed privacy reason',()=>{
  assert.equal(Helper.ROUTES.canada411.url,'https://www.canada411.ca/help.html?key=faq');assert.notEqual(Helper.CONTRACTS.canada411.id,Helper.CONTRACT.id);
  assert.match(Helper.CONTRACTS.canada411.authorization,/Security\/privacy issues/);assert.match(Helper.CONTRACTS.canada411.authorization,/web-only removal/);
});
test('Canada411 canonical review contains only its own listed number and contact email',()=>{
  assert.deepEqual(Helper.validateDetails({phone:'+1 (416) 555-0100',email:'removal@example.test'},{routeId:'canada411',fullName:'Example Person'}),{phone:'4165550100',email:'removal@example.test'});
  for(const value of [{phone:'4165550100',email:'removal@example.test',reason:'Person deceased'},{phone:'4165550100',email:'removal@example.test',comment:'Private extras'},{phone:'+44 2079460958',email:'removal@example.test'},{phone:'4165550100',email:'bad\nemail@example.test'}])assert.throws(()=>Helper.validateDetails(value,{routeId:'canada411'}));
});
test('Canada411 payload binds its own separate contract and never accepts another person or submit choice',()=>{
  const p={...payload(),routeId:'canada411',consentId:Helper.CONTRACTS.canada411.id,details:{phone:'4165550100',email:'removal@example.test'}};Helper.validatePayload(p);
  for(const extra of [{consentId:Helper.CONTRACT.id},{autoSubmit:true},{captchaResponse:'answer'},{details:{...p.details,first_name:'Different'}},{identity:{full_name:'x'.repeat(101)}}])assert.throws(()=>Helper.validatePayload({...p,...extra}));
});
test('Canada411 public dialog preparation is asynchronous but accepts no identity or private fields',async()=>{
  const value=await Helper.preparePage({routeId:'canada411'},{});assert.equal(value.status,'blocked');assert.equal(JSON.stringify(value).includes('removal@example.test'),false);
  assert.equal((await Helper.preparePage({routeId:'canada411',details:{phone:'4165550100'}},{})).status,'blocked');
});
