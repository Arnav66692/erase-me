'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Dialog=require('../webapp/static/removal-send-dialog.js'),{fixture,dom}=require('./removal_send_fixture.cjs');
async function setup(){const f=await fixture(),d=dom(),feedback=[];let changed=null;const dialog=Dialog.create({workspace:f.core,companion:f.companion,document:d.document,onChange:()=>changed?.(),onFeedback:value=>feedback.push(value)});return{...f,...d,dialog,feedback,waitForChange:()=>new Promise(resolve=>{changed=resolve;})};}
async function prepare(f){f.byId('reference').value=f.reference;f.byId('own').checked=true;await f.fire('form','submit');}
test('normal-user review requires two distinct unchecked approvals and exact displayed message',async()=>{
  const f=await setup();await f.dialog.open(f.route,f.core.profile().id,f.opener);assert.equal(f.calls.length,0);assert.equal(f.byId('own').checked,false);
  await f.fire('form','submit');assert.equal(f.calls.length,0);await prepare(f);assert.equal(f.byId('review').hidden,false);assert.equal(f.byId('approval').checked,false);assert.equal(f.byId('once').disabled,true);
  assert.equal(f.byId('reference').value,'');assert.match(f.byId('message').value,/Record reference:/);assert.equal(f.core.exportData().includes(f.reference),false);
  await f.fire('once');assert.equal(f.calls.filter(x=>x.request?.action==='send-once').length,0);
  f.byId('approval').checked=true;f.fire('approval','change');await f.fire('once');assert.match(f.byId('status').textContent,/Google accepted/);assert.match(f.byId('status').textContent,/deletion.*unverified/);assert.equal(f.core.dashboard().counts.removed,0);
  f.fire('close');assert.equal(f.byId('message').value,'');assert.equal(f.document.activeElement,f.opener);
});
test('close clears private preview and revokes its unsent grant; duplicate open cannot orphan it',{timeout:5000},async()=>{
  const f=await setup();await f.dialog.open(f.route,f.core.profile().id,f.opener);await prepare(f);
  await assert.rejects(f.dialog.open(f.route,f.core.profile().id,f.opener));const closed=f.waitForChange();f.fire('close');assert.equal(f.byId('message').value,'');assert.equal(f.byId('approval').checked,false);
  await closed;assert.equal(f.core.snapshot().items[f.route].mail_send.revocation_confirmed,true);assert.equal(f.calls.some(x=>x.request?.action==='send-once'),false);
});
test('close during pending preparation revokes late capability without showing private contents',async()=>{
  const f=await setup();await f.dialog.open(f.route,f.core.profile().id,f.opener);const g=f.delay('send-prepare'),pending=prepare(f);
  while(!f.calls.some(x=>x.request?.action==='send-prepare'))await new Promise(resolve=>setImmediate(resolve));f.fire('close');g.release();await pending;
  assert.equal(f.byId('message').value,'');assert.equal(f.byId('reference').value,'');assert.equal(f.calls.some(x=>x.request?.action==='send-once'),false);assert.equal(f.core.snapshot().items[f.route].mail_send.closed,true);
});
test('explicit draft editing revokes the prior grant before obtaining a new reservation',async()=>{
  const f=await setup();await f.dialog.open(f.route,f.core.profile().id,f.opener);await prepare(f);const old=f.core.snapshot().items[f.route].operation_id;await f.fire('edit');
  assert.equal(f.byId('review').hidden,true);assert.equal(f.byId('form').hidden,false);assert.equal(f.core.snapshot().items[f.route].operation_id,null);assert.equal(f.byId('own').checked,false);
  await prepare(f);assert.notEqual(f.core.snapshot().items[f.route].operation_id,old);assert.equal(f.calls.some(x=>x.request?.action==='send-once'),false);
});
test('a pre-dispatch persistence failure keeps safe draft editing available after storage recovers',async()=>{
  const f=await setup();await f.dialog.open(f.route,f.core.profile().id,f.opener);await prepare(f);f.byId('approval').checked=true;f.fire('approval','change');f.fail();await f.fire('once');
  assert.equal(f.calls.some(x=>x.request?.action==='send-once'),false);assert.equal(f.byId('once').disabled,true);assert.equal(f.byId('edit').disabled,false);
  f.recover();await f.fire('edit');assert.equal(f.core.snapshot().items[f.route].operation_id,null);assert.equal(f.byId('form').hidden,false);assert.equal(f.byId('own').checked,false);assert.equal(f.calls.some(x=>x.request?.action==='send-once'),false);
});
