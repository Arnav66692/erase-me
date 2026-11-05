'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Details=require('../extension/identity-details.js');
const now='2026-11-05T00:00:00.000Z';
const dob={method:'date_of_birth',date_of_birth:'1991-02-28',city:'Example City',state:'CA',zip_code:'92101'};
const street={method:'street_address',street_address:'123 Example Street, Apt 4',city:'Example City',state:'CA',zip_code:'92101'};
const requirements={date_of_birth:true,street_address:true,phone:true,no_validate:false,submit_no_validate:false};
const full={method:'full_matching_details',date_of_birth:dob.date_of_birth,street_address:street.street_address,phone:'(212) 555-0100',city:street.city,state:street.state,zip_code:street.zip_code};
test('shared final agreement is frozen and identifies the reviewed FPS contract',()=>{
  assert.ok(Object.isFrozen(Details));assert.ok(Object.isFrozen(Details.CONTRACTS));assert.ok(Object.isFrozen(Details.CONTRACTS.fastpeoplesearch));
  assert.equal(Details.CONTRACTS.fastpeoplesearch.id,'fastpeoplesearch-final-2026-11-05-v1');
  assert.match(Details.CONTRACTS.fastpeoplesearch.warningText,/will not be able to modify/);
  assert.match(Details.CONTRACTS.fastpeoplesearch.consentText,/information above is accurate/);
});
test('DOB and address are mutually exclusive canonical one-action fields without mutating caller values',()=>{
  for(const value of [dob,street]){
    const input={...value,city:'  Example   City ',state:' ca ',zip_code:' 92101 '},before=JSON.stringify(input);
    const normalized=Details.validate(input,{now});assert.deepEqual(normalized,value);assert.notEqual(normalized,input);assert.equal(JSON.stringify(input),before);
  }
  assert.deepEqual(Details.validate({...street,street_address:'  123  Örnek St #4  '},{now}),{...street,street_address:'123 Örnek St #4'});
});
test('birth date requires a real full calendar date and the supported adult age range',()=>{
  for(const value of ['2008-11-05','1905-11-06','2004-02-29'])assert.equal(Details.validate({...dob,date_of_birth:value},{now}).date_of_birth,value);
  for(const value of ['2008-11-06','1905-11-05','2026-11-05','2027-01-01','2003-02-29','1991-02-30','1991-00-01','1991-13-01','1991-01-00','1991-01-32','1991-2-3','91-02-03','0000-01-01','1991-02-28T00:00:00Z','1991-02-28 ',null,19910228])
    assert.throws(()=>Details.validate({...dob,date_of_birth:value},{now}),Details.IdentityDetailError);
  assert.throws(()=>Details.validate(dob,{now:'invalid-clock'}),/current date/);
});
test('only the selected union and exact required fields are accepted',()=>{
  for(const value of [null,undefined,[],{}, {...dob,phone:'1234567890'},{...dob,street_address:'123 Example St'}, {...street,date_of_birth:dob.date_of_birth},
    {...street,method:'dob'},{...dob,method:'street_address'},{...street,method:'date_of_birth'},Object.assign(Object.create({city:'Example City'}),{method:'date_of_birth',date_of_birth:dob.date_of_birth,state:'CA',zip_code:'92101'})])
    assert.throws(()=>Details.validate(value,{now}),Details.IdentityDetailError);
  for(const key of ['city','state','zip_code','method','date_of_birth']){const value={...dob};delete value[key];assert.throws(()=>Details.validate(value,{now}));}
});
test('street, location and ZIP are bounded plain values without unsafe controls or HTML',()=>{
  for(const [key,value] of [['street_address',''],['street_address','x'.repeat(201)],['street_address','123\nExample'],['street_address','<private>'],['street_address','123\x00Example'],
    ['city',''],['city','x'.repeat(121)],['city','<city>'],['city','Example\rCity'],['state','USA'],['state','ZZ'],['state','C1'],['zip_code','9210'],['zip_code','921001'],['zip_code','９２１０１'],['zip_code','92 01']])
    assert.throws(()=>Details.validate({...street,[key]:value},{now}),Details.IdentityDetailError);
  assert.equal(Details.validate({...street,state:'DC',zip_code:'00001'},{now}).state,'DC');
  assert.equal(Details.validate({...street,state:'AP'},{now}).state,'AP');
});
test('validation failures never repeat supplied sensitive field values in errors',()=>{
  const privateValue='PRIVATE-INPUT-'+String.fromCharCode(0)+'-DO-NOT-ECHO';
  for(const value of [{...street,street_address:privateValue},{...dob,date_of_birth:privateValue},{...dob,city:privateValue}]){
    try{Details.validate(value,{now});assert.fail('Expected validation failure');}catch(error){assert.equal(error.message.includes('PRIVATE-INPUT'),false);}
  }
  const hostile=Object.defineProperty({...dob},'city',{get(){throw new Error('PRIVATE-GETTER');},enumerable:true});
  assert.throws(()=>Details.validate(hostile,{now}),error=>!error.message.includes('PRIVATE-GETTER'));
});

test('requirements are exactly the five observed boolean flags with no coercion or shared references',()=>{
  const copied=Details.validateRequirements(requirements);assert.deepEqual(copied,requirements);assert.notEqual(copied,requirements);
  for(const value of [undefined,null,[],{}, {...requirements,phone:1},{...requirements,no_validate:'false'},{...requirements,extra:false},
    Object.assign(Object.create({phone:true}),{date_of_birth:true,street_address:true,no_validate:false,submit_no_validate:false})])assert.throws(()=>Details.validateRequirements(value),Details.IdentityDetailError);
  for(const key of Object.keys(requirements)){const value={...requirements};delete value[key];assert.throws(()=>Details.validateRequirements(value));}
  const hostile=Object.defineProperty({...requirements},'phone',{get(){throw Error('PRIVATE-PROBE');},enumerable:true});assert.throws(()=>Details.validateRequirements(hostile),error=>!error.message.includes('PRIVATE-PROBE'));
});
test('full matching details are available only when actual native flags require all three identity fields',()=>{
  assert.deepEqual(Details.validate(full,{now,requirements}),full);
  assert.match(Details.CONTRACTS.fastpeoplesearch.additionalRequirementText,/despite its wording/);
  assert.throws(()=>Details.validate(full,{now}));
  for(const [key,value] of [['date_of_birth',false],['street_address',false],['phone',false],['no_validate',true],['submit_no_validate',true]])
    assert.throws(()=>Details.validate(full,{now,requirements:{...requirements,[key]:value}}),/need for all/);
  for(const value of [{...full,unexpected:true},{...full,email:'other@example.test'},{...full,phone:undefined},{...full,date_of_birth:'2020-01-01'},{...full,street_address:'<private>'}])assert.throws(()=>Details.validate(value,{now,requirements}));
});
test('minimal details satisfy every native-required identity flag without silently adding personal information',()=>{
  const dobRequired={...requirements,street_address:false,phone:false},addressRequired={...requirements,date_of_birth:false,phone:false};
  assert.deepEqual(Details.validate(dob,{now,requirements:dobRequired}),dob);assert.deepEqual(Details.validate(street,{now,requirements:addressRequired}),street);
  assert.throws(()=>Details.validate(street,{now,requirements:dobRequired}),/does not satisfy/);assert.throws(()=>Details.validate(dob,{now,requirements:addressRequired}),/does not satisfy/);
  for(const value of [dob,street])assert.throws(()=>Details.validate(value,{now,requirements}),/does not satisfy/);
  for(const key of ['no_validate','submit_no_validate'])for(const value of [dob,street])assert.deepEqual(Details.validate(value,{now,requirements:{...requirements,[key]:true}}),value);
});
test('US phones canonicalize to the exact native pattern without adding country data or echoing invalid inputs',()=>{
  for(const phone of ['2125550100','12125550100','+1 (212) 555-0100','212.555.0100',' 1-212-555-0100 '])
    assert.equal(Details.validate({...full,phone},{now,requirements}).phone,'(212) 555-0100');
  for(const phone of ['212555010','21255501000','22125550100','++12125550100','2125550+100','１２１２５５５０１００','212\n5550100','PRIVATE-PHONE',null])
    assert.throws(()=>Details.validate({...full,phone},{now,requirements}),error=>!error.message.includes('PRIVATE-PHONE'));
});
