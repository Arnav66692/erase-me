'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Send=require('../webapp/static/removal-send.js'),{fixture}=require('./removal_send_fixture.cjs');
const client=f=>Send.create({workspace:f.core,companion:f.companion,profileId:f.core.profile().id,now:()=>Date.parse(f.NOW)});
const actions=f=>f.calls.map(x=>x.request?.action||x.action);
test('email client prepares an exact separate-account preview then sends only once after approval',async()=>{
  const f=await fixture(),c=client(f),value=await c.prepare(f.route,f.reference);
  assert.deepEqual(actions(f),['ping','send-status','send-prepare']);assert.match(value.preview.body,/Example Person/);assert.equal(f.core.exportData().includes(f.reference),false);
  await assert.rejects(c.send({authorized:true,own_request:false}));assert.equal(actions(f).includes('send-once'),false);
  const outcome=await c.send({authorized:true,own_request:true});assert.equal(outcome.status,'provider_accepted');await assert.rejects(c.send({authorized:true,own_request:true}));
  assert.equal(actions(f).filter(x=>x==='send-once').length,1);assert.equal(f.core.dashboard().counts.removed,0);assert.equal(f.core.dashboard().counts.requested,0);
});
test('old companion and read-only account stop before reserving or disclosing a reference',async()=>{
  for(const mode of ['capability','readonly']){
    const f=await fixture();if(mode==='capability')f.overrides.ping=()=>({capabilities:[]});else f.overrides['send-status']=()=>({configured:true,enabled:false,send_enabled:false,provider:'gmail',on_demand:true,access:'local_native',authorization_required:true,automatic_execution:false,routes:Object.keys(Send.ROUTES)});
    await assert.rejects(client(f).prepare(f.route,f.reference));assert.equal(f.core.snapshot().items[f.route].operation_id,null);assert.equal(actions(f).includes('send-prepare'),false);
  }
});
test('close or hold during preparation closes locally before issuing native revocation',async()=>{
  for(const mode of ['close','hold','pause','replace']){
    const f=await fixture(),c=client(f),g=f.delay('send-prepare'),pending=c.prepare(f.route,f.reference);
    while(!actions(f).includes('send-prepare'))await new Promise(resolve=>setImmediate(resolve));
    const original=f.core.profile().id;
    if(mode==='close')await c.cancel();else if(mode==='hold')f.core.holdRoute(f.route);else if(mode==='pause')await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});else{f.core.remove();await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Replacement Person',age:36,email:'replacement@example.test',authorized:true})});}
    g.release();await assert.rejects(pending);assert.equal(actions(f).includes('send-once'),false);assert.ok(actions(f).includes('send-revoke'));
    for(const req of f.calls.filter(x=>x.request?.action==='send-revoke'))assert.equal(req.request.workspace_id,original);
    if(mode==='replace')assert.equal(f.core.profile().name,'Replacement Person');else assert.equal(f.core.snapshot().items[f.route].mail_send.closed,true);
  }
});
test('storage failures cannot disclose a preparation or dispatch a send',async()=>{
  const f=await fixture();f.fail();await assert.rejects(client(f).prepare(f.route,f.reference));assert.equal(actions(f).includes('send-prepare'),false);
  const g=await fixture(),c=client(g);await c.prepare(g.route,g.reference);g.fail();await assert.rejects(c.send({authorized:true,own_request:true}));assert.equal(actions(g).includes('send-once'),false);
});
test('an interrupted send is journaled unknown, never repeated, and reconciled locally',async()=>{
  const f=await fixture(),c=client(f);await c.prepare(f.route,f.reference);f.overrides['send-once']=()=>{throw Error('connection lost');};
  const outcome=await c.send({authorized:true,own_request:true});assert.equal(outcome.status,'unknown');assert.equal(f.core.snapshot().items[f.route].mail_send.phase,'unknown');await assert.rejects(c.send({authorized:true,own_request:true}));
  await client(f).result(f.route);assert.equal(actions(f).filter(x=>x==='send-once').length,1);assert.equal(f.core.snapshot().items[f.route].mail_send.phase,'unknown');
});
test('reload can close an unsent reference without persisting the body, then explicitly reset it',async()=>{
  const f=await fixture(),c=client(f);await c.prepare(f.route,f.reference);const value=await client(f).revokeRoute(f.route);assert.equal(value.status,'revoked');
  f.core.resetMailSend(f.route,{authorized:true,profileId:f.core.profile().id});assert.equal(f.core.snapshot().items[f.route].operation_id,null);
  assert.equal(f.core.exportData().includes(f.reference),false);assert.equal(actions(f).includes('send-once'),false);
});
test('hold cleanup uses its captured old scope after profile replacement',async()=>{
  const f=await fixture(),c=client(f);await c.prepare(f.route,f.reference);const old=f.core.profile().id,minimal=f.core.mailSendClosureContext(f.route,old),cleanup=client(f);
  f.core.holdRoute(f.route);f.core.remove();await f.core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Replacement Person',age:36,email:'replacement@example.test',authorized:true})});const before=f.core.exportData();
  assert.equal((await cleanup.revokeRoute(f.route,minimal)).status,'revoked');assert.equal(f.core.exportData(),before);assert.equal(f.calls.at(-1).request.workspace_id,old);
});
