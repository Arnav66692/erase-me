'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict');
const Contract=require('../extension/send-contract.js'),Send=require('../webapp/static/removal-send.js'),Core=require('../webapp/static/workspace-core.js'),{fixture,dom}=require('./removal_send_fixture.cjs'),Dialog=require('../webapp/static/removal-send-dialog.js');
const scope={workspace_id:'a'.repeat(32),personal_email_sha256:'b'.repeat(64)},request={action:'send-result',...scope,route_id:'ca-411',operation_id:'c'.repeat(32),explicit:true};
function smtp(overrides={}){return{status:'smtp_accepted',route_id:request.route_id,operation_id:request.operation_id,request_id:'d'.repeat(32),automatic_execution:false,delivery_verified:false,acceptance_verified:false,deletion_verified:false,acceptance_kind:'smtp_250',receipt_ref:'e'.repeat(64),...overrides};}
test('SMTP acceptance requires a local receipt and cannot impersonate Gmail API IDs or deletion evidence',()=>{
  assert.deepEqual(Contract.response(request,smtp()),smtp());
  for(const change of [{acceptance_kind:'gmail_api'},{receipt_ref:'bad'},{message_id:'invented'},{thread_id:'invented'},{request_id:null},{delivery_verified:true},{acceptance_verified:true},{deletion_verified:true},{status:'unknown'},{status:'provider_accepted',message_id:'fake',thread_id:'fake'}])assert.throws(()=>Contract.response(request,smtp(change)));
});
async function accepted(){
  const f=await fixture(),c=Send.create({workspace:f.core,companion:f.companion,profileId:f.core.profile().id,now:()=>Date.parse(f.NOW)});await c.prepare(f.route,f.reference);
  f.overrides['send-once']=req=>{const claims=JSON.parse(Buffer.from(req.capability.split('.')[1],'base64url'));return smtp({operation_id:claims.operation_id,route_id:claims.route_id,request_id:claims.request_id});};
  const result=await c.send({authorized:true,own_request:true});return{...f,c,result};
}
test('an SMTP receipt persists separately from API IDs and never adds requested or removed counts',async()=>{
  const f=await accepted(),record=f.core.snapshot().items[f.route].mail_send;assert.equal(record.phase,'smtp_accepted');assert.equal(record.acceptance_kind,'smtp_250');assert.equal(record.receipt_ref,'e'.repeat(64));assert.equal(record.message_id,undefined);assert.equal(record.thread_id,undefined);
  assert.equal(f.core.dashboard().counts.requested,0);assert.equal(f.core.dashboard().counts.removed,0);await assert.rejects(f.c.send({authorized:true,own_request:true}));
  const reload=Core.create({storage:f.storage,crypto:require('node:crypto').webcrypto,now:()=>f.NOW});assert.equal(reload.snapshot().items[f.route].mail_send.phase,'smtp_accepted');
  assert.throws(()=>reload.recordMailSend(reload.profile().id,record.id,{...f.outcome({route_id:f.route,operation_id:record.id},'unknown'),request_id:record.request_id}));
});
test('holding accepted SMTP mail preserves its receipt and cannot claim revocation; imported history remains inactive',async()=>{
  const f=await accepted(),record=f.core.snapshot().items[f.route].mail_send;f.core.holdRoute(f.route);assert.equal(f.core.snapshot().items[f.route].mail_send.phase,'smtp_accepted');
  const minimal=f.core.mailSendClosureContext(f.route,f.core.profile().id),reservation=await f.core.reserveMailSendClosure(minimal,null,{discard_issued:false});assert.equal(reservation.status,'reserved');
  assert.throws(()=>f.core.recordMailSendClosure(minimal,reservation.closureId,{...f.outcome({route_id:f.route,operation_id:record.id},'revoked'),request_id:record.request_id}));
  const backup=f.core.exportData();f.core.remove();f.core.importData(backup);const imported=f.core.snapshot().items[f.route];assert.equal(imported.held,true);assert.equal(imported.mail_send.phase,'closed');assert.equal(imported.mail_send.receipt_ref,undefined);assert.equal(imported.mail_send.acceptance_kind,undefined);assert.throws(()=>f.core.mailSendResultRequest(f.route));
});
test('the exact-message dialog explains SMTP acceptance without a delivery or deletion claim',async()=>{
  const f=await fixture(),d=dom(),dialog=Dialog.create({workspace:f.core,companion:f.companion,document:d.document});await dialog.open(f.route,f.core.profile().id,d.opener);d.byId('reference').value=f.reference;d.byId('own').checked=true;await d.fire('form','submit');
  f.overrides['send-once']=req=>{const claims=JSON.parse(Buffer.from(req.capability.split('.')[1],'base64url'));return smtp({operation_id:claims.operation_id,route_id:claims.route_id,request_id:claims.request_id});};d.byId('approval').checked=true;await d.fire('once');
  assert.match(d.byId('status').textContent,/SMTP server accepted/);assert.match(d.byId('status').textContent,/does not prove delivery/);assert.equal(d.byId('edit').disabled,true);assert.equal(f.core.dashboard().counts.removed,0);
});
