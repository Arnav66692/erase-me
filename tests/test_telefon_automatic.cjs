'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Automatic=require('../extension/automatic-executor.js');
const Base=require('../extension/broker-executor.js');

test('Telefon remains prefill-only while its asynchronous native form.submit lacks a guarded serialization boundary',()=>{
  const fields={full_name:'Example Person',email:'person@example.test',request_text:'Please remove my own information.'};
  assert.ok(Base.validate('tr-telefonsorgulama',fields,{ownRequestConfirmed:true}));
  assert.equal(Automatic.CONTRACTS['tr-telefonsorgulama'],undefined);
  const payload={routeId:'tr-telefonsorgulama',operationId:'a'.repeat(32),fields,ownRequestConfirmed:true,authorized:true,autoSubmit:true,consentId:'unreviewed'};
  const env={document:new Proxy({},{get(){throw new Error('An unsupported auto route must not inspect or mutate the page.');}})};
  assert.equal(Automatic.capture(payload,env).status,'blocked');
  assert.equal(Automatic.capture(payload,env).reason,'approval_required');
});
