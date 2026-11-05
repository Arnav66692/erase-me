'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Planner=require('../webapp/static/footprint-planner.js');
const Core=require('../webapp/static/workspace-core.js');
const NOW='2026-11-05T12:00:00.000Z';
function plan(category='account'){let next=0;return Planner.add(Planner.empty(),[{service:'Example service',category,url:'https://example.test/settings'}],{uuid:()=>String(++next),now:NOW});}
const choice=(decision,closureReviewed=true)=>({decision,authorized:true,closureReviewed});
const report=event=>({event,authorized:true});
function fixture(){const data=new Map();let next=0;const options={storage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)},uuid:()=>String(++next).padStart(32,'0'),now:()=>NOW};return{core:Core.create(options),data,options};}
async function signup(core){const result=await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'person@example.test',authorized:true})});assert.equal(result.ok,true);}

test('JSON and quoted CSV import only bounded public account-list fields',()=>{
  assert.deepEqual(Planner.parse('[{"service":"Example","url":"https://example.test"}]','json'),[{service:'Example',category:'account',url:'https://example.test/'}]);
  assert.deepEqual(Planner.parse('service,category,url\r\n"Example, Inc",company,https://example.test/privacy\r\n','csv'),[{service:'Example, Inc',category:'company',url:'https://example.test/privacy'}]);
  assert.equal(Planner.parse('service\n"Example ""two"""','csv')[0].service,'Example "two"');
  assert.equal(Planner.parse('[{"service":"Review","category":"privacy_setting"}]','json')[0].url,null);
});
test('credentials, private links, injected markup and malformed or oversized lists are rejected without echoing them',()=>{
  const badJSON=[{service:'Example',password:'secret-password'},{service:'Example',token:'private-token'},{service:'<img src=x>'},{service:'Example',category:'verified_removed'}];
  for(const row of badJSON)assert.throws(()=>Planner.parse(JSON.stringify([row]),'json'));
  for(const url of ['https://user:secret@example.test/','https://@example.test/','https://example.test/reset/password','https://example.test/verify/key','https://example.test/path?token=secret','https://example.test/path#code','https://example.test/ver%69fy%2Fsecret','https://example.test/ver%69fy/secret','https://example.test/%0Asecret','https://example.test/%ZZ','https://localhost/','https://localhost./','https://127.0.0.1/','https://machine.local/','https://machine.local./','https://[::1]/','javascript:alert(1)','http://example.test/'])assert.throws(()=>Planner.parse(JSON.stringify([{service:'Example',url}]),'json'));
  for(const content of ['service,password\nExample,secret','service,service\nExample,Other','service,url\nExample','service\n"unfinished','service\n"Example"bad'])assert.throws(()=>Planner.parse(content,'csv'));
  for(const raw of ['{bad}',JSON.stringify({service:'Example'}),'[]',JSON.stringify(Array.from({length:101},()=>({service:'Example'}))),'x'.repeat(Planner.MAX_INPUT+1)])assert.throws(()=>Planner.parse(raw,'json'));
  assert.throws(()=>Planner.parse(JSON.stringify([{service:'Example',url:'https://example.test/'+'\u00e9'.repeat(500)}]),'json'));
  try{Planner.parse('[{"service":"Example","password":"never-print-me"}]','json');}catch(error){assert.equal(error.message.includes('never-print-me'),false);}
});
test('deduplication and list limits are local and atomic',()=>{
  let count=0;const p=Planner.add(Planner.empty(),[{service:'Example'},{service:'example'}],{uuid:()=>String(++count),now:NOW});assert.equal(p.items.length,1);
  const full=Planner.add(Planner.empty(),Array.from({length:100},(_,i)=>({service:'Service '+i})),{uuid:()=>String(++count),now:NOW});
  assert.throws(()=>Planner.add(full,[{service:'Extra'}],{uuid:()=>String(++count),now:NOW}));assert.equal(full.items.length,100);
});
test('account removal needs a clear decision and account-closure review; kept items have no progress actions',()=>{
  const p=plan(),id=p.items[0].id;
  assert.throws(()=>Planner.choose(p,id,choice('remove',false),{now:NOW}),/files, purchases/);
  assert.throws(()=>Planner.choose(p,id,{decision:'remove',authorized:false,closureReviewed:true},{now:NOW}));
  const kept=Planner.choose(p,id,choice('keep',false),{now:NOW});assert.equal(Planner.view(kept).items[0].label,'Kept by your choice');
  for(const event of Object.keys(Planner.EVENTS))assert.throws(()=>Planner.progress(kept,id,report(event),{now:NOW}));
  assert.equal(p.items[0].decision,null);
});
test('export-first gates reported requests until the user reports saving the export',()=>{
  let p=plan(),id=p.items[0].id;p=Planner.choose(p,id,choice('export_first'),{now:NOW});
  assert.throws(()=>Planner.progress(p,id,report('request_submitted'),{now:NOW}),/export/);
  p=Planner.progress(p,id,report('export_completed'),{now:NOW});assert.equal(p.items[0].export_acknowledged,true);
  p=Planner.progress(p,id,report('request_submitted'),{now:NOW});p=Planner.progress(p,id,report('company_confirmation'),{now:NOW});
  const view=Planner.view(p).items[0];assert.match(view.label,/You reported company confirmation/);assert.equal(view.acceptance_verified,false);assert.equal(view.deletion_verified,false);
});
test('Google result and source removal remain separate reports and cannot become verified evidence',()=>{
  let p=plan('search_result'),id=p.items[0].id;p=Planner.choose(p,id,choice('remove'),{now:NOW});
  p=Planner.progress(p,id,report('search_result_removed'),{now:NOW});let item=Planner.view(p).items[0];
  assert.equal(item.reported_outcomes.search_result_removed,true);assert.equal(item.reported_outcomes.source_removed,false);assert.equal(item.independent_verification_available,false);
  p=Planner.progress(p,id,report('source_removed'),{now:NOW});item=Planner.view(p).items[0];assert.equal(item.reported_outcomes.search_result_removed,true);assert.equal(item.reported_outcomes.source_removed,true);
  for(const event of ['verified_removed','company_confirmed','request_sent'])assert.throws(()=>Planner.progress(p,id,report(event),{now:NOW}));
});
test('category-specific reports and explicit on-demand rechecks do not create jobs or schedules',()=>{
  let p=plan('privacy_setting'),id=p.items[0].id;assert.throws(()=>Planner.choose(p,id,choice('export_first'),{now:NOW}));
  p=Planner.choose(p,id,choice('remove'),{now:NOW});assert.throws(()=>Planner.progress(p,id,report('request_submitted'),{now:NOW}));
  p=Planner.progress(p,id,report('setting_updated'),{now:NOW});p=Planner.progress(p,id,report('recheck_reviewed'),{now:NOW});
  assert.equal(p.items[0].reports.length,2);assert.equal(JSON.stringify(p).includes('next_check'),false);assert.equal(JSON.stringify(p).includes('interval'),false);
});
test('restored plans retain decisions and export reports but downgrade every report to imported history',()=>{
  let p=plan(),id=p.items[0].id;p=Planner.choose(p,id,choice('export_first'),{now:NOW});p=Planner.progress(p,id,report('export_completed'),{now:NOW});p=Planner.progress(p,id,report('request_submitted'),{now:NOW});
  const restored=Planner.normalize(p,{imported:true}),item=Planner.view(restored).items[0];assert.equal(item.decision,'export_first');assert.equal(item.export_acknowledged,true);assert.ok(item.reports.every(r=>r.source==='imported_user_history'));assert.match(item.label,/Imported history/);assert.equal(item.deletion_verified,false);
  assert.throws(()=>Planner.normalize({...p,verified:true}));assert.throws(()=>Planner.normalize({...p,items:[{...p.items[0],deletion_verified:true}]}));
});
test('core saves the planner inside the private workspace, exports/imports it safely and deletes it with the profile',async()=>{
  const f=fixture();await signup(f.core);assert.throws(()=>f.core.importFootprint('[{"service":"Example"}]','json',{authorized:false}));
  f.core.importFootprint('[{"service":"Example","category":"company"}]','json',{authorized:true,profileId:f.core.profile().id});
  const id=f.core.dashboard().footprint.items[0].id;f.core.chooseFootprintItem(id,{...choice('remove'),profileId:f.core.profile().id});f.core.recordFootprintProgress(id,report('request_submitted'));
  assert.equal(f.data.size,1);assert.equal(f.core.dashboard().counts.removed,0);assert.equal(f.core.dashboard().counts.requested,0);
  const backup=f.core.exportData(),other=fixture();other.core.importData(backup);assert.equal(other.core.dashboard().footprint.items[0].reports[0].source,'imported_user_history');
  assert.equal(other.core.dashboard().footprint.items[0].deletion_verified,false);other.core.remove();assert.equal(other.data.has(Core.KEY),false);assert.equal(other.core.snapshot().profile,null);assert.deepEqual(other.core.snapshot().footprint.items,[]);
});
test('core rejects paused, changed-profile and malformed imports before changing existing records',async()=>{
  const f=fixture();await signup(f.core);const before=f.data.get(Core.KEY);
  assert.throws(()=>f.core.importFootprint('[{"service":"Example"}]','json',{authorized:true,profileId:'different'}),/workspace changed/);assert.equal(f.data.get(Core.KEY),before);
  assert.throws(()=>f.core.importFootprint('[{"service":"Example","password":"private"}]','json',{authorized:true}));assert.equal(f.data.get(Core.KEY),before);
  await f.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});assert.throws(()=>f.core.importFootprint('[{"service":"Example"}]','json',{authorized:true}),/Resume/);
});
test('a full bounded cleanup history roundtrips through a private backup without trusting reports as proof',async()=>{
  const f=fixture();await signup(f.core);let sequence=0;
  const footprint=Planner.add(Planner.empty(),Array.from({length:100},(_,index)=>({service:'Service '+index+'x'.repeat(85),url:'https://example.test/'+'x'.repeat(2000)})),{uuid:()=>String(++sequence),now:NOW});
  for(const item of footprint.items){item.decision='remove';item.closure_reviewed=true;item.reports=Array.from({length:20},()=>({event:'recheck_reviewed',at:NOW,source:'user_reported'}));}
  f.data.set(Core.KEY,JSON.stringify({...f.core.snapshot(),footprint}));const backup=f.core.exportData();assert.ok(backup.length>500000);assert.ok(Buffer.byteLength(backup)<1048576);
  const other=fixture();other.core.importData(backup);const restored=other.core.dashboard().footprint.items;assert.equal(restored.length,100);assert.equal(restored[99].reports.length,20);assert.equal(restored[99].reports[19].source,'imported_user_history');assert.equal(restored[99].deletion_verified,false);
  const empty=fixture();assert.throws(()=>empty.core.importData('x'.repeat(1048577)),/1 MiB/);
});
