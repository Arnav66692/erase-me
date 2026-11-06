'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const routes=require('../webapp/static/broker-routes.js');
const automatic=require('../extension/automatic-executor.js');
const Core=require('../webapp/static/workspace-core.js');

test('integration matrix covers every current catalog route once and separates verified deletion',()=>{
  const text=fs.readFileSync(path.join(__dirname,'../docs/INTEGRATION_STATUS.md'),'utf8');
  const rows=text.split('\n').filter(line=>line.startsWith('| `')).map(line=>line.split('|').slice(1,-1).map(cell=>cell.trim()));
  assert.equal(rows.length,routes.length);
  assert.deepEqual(rows.map(row=>row[0].match(/^`([^`]+)`/)[1]).sort(),routes.map(route=>route.id).sort());
  for(const row of rows){
    const id=row[0].match(/^`([^`]+)`/)[1],route=routes.find(route=>route.id===id);
    assert.equal(row.length,9,id);
    assert.equal(row[3],route.automationLevel==='companion'?'Yes':'No',id+' collector');
    assert.equal(row[8],'None',id+' deletion evidence');
    if(automatic.CONTRACTS[id])assert.equal(row[4],'Guarded native submit',id+' submission contract');
    if(row[4]==='Guarded native submit')assert.ok(automatic.CONTRACTS[id],id+' documented contract');
    assert.equal(row[6],id==='fastpeoplesearch'?'Guarded matching-form attempt':'Not integrated',id+' final stage');
  }
});

test('executable route instructions offer in-app collection without promising removal or universal challenges',()=>{
  const fps=routes.find(route=>route.id==='fastpeoplesearch'),numara=routes.find(route=>route.id==='tr-numaraara');
  assert.match(fps.steps.join(' '),/Enter missing information inside Erase Me/);
  assert.match(fps.steps.join(' '),/private removal-mail operator pilot/);
  assert.match(fps.steps.join(' '),/date of birth, street address and phone required/);
  assert.match(fps.steps.join(' '),/Cancel or hold/);
  assert.match(numara.steps.join(' '),/optional guarded submission/);
  assert.match(numara.steps.join(' '),/free local challenge helper/);
  assert.match(numara.steps.join(' '),/Unresolved challenges stop/);
  assert.doesNotMatch(numara.steps.join(' '),/companion does not submit/);
  assert.match(numara.review.summary,/Optional guarded submission/);
  for(const route of [fps,numara])assert.match(route.evidence,/unverified|need separate|establishes deletion/i);
});

test('every executable submission contract preserves only its proven attempt stage in the real workspace',async()=>{
  for(const [id,contract]of Object.entries(automatic.CONTRACTS))for(const proven of [true,false]){
    const values=new Map();let sequence=0;
    const core=Core.create({storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=> '2026-11-05T00:00:00.000Z'});
    await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'person@example.test',authorized:true})});
    await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:id.startsWith('tr-')?'TR':'US'})});
    const fields=id==='apollo'?{business_email:'work@example.test'}:id.startsWith('tr-')?{full_name:'Example Person',request_text:'Please remove my own information.',...(id==='tr-numarasor'?{phone:'+90 555 123 45 67'}:{})}:{first_name:'Example',last_name:'Person'};
    core.setEvidence(id,fields,id==='apollo'?{business_email:true}:['fastpeoplesearch','searchpeoplefree'].includes(id)?{}:{own_request:true});const operation=core.prepare(id);
    core.recordCompanion(id,operation.operationId,{status:'submission_attempted',attempt_verified:true,stage:proven?contract.stage:'unreviewed_stage'});
    const evidence=core.snapshot().items[id].evidence;
    assert.equal(evidence.attempt_verified,proven,id);assert.equal(evidence.stage,proven?contract.stage:undefined,id);
    assert.equal(evidence.acceptance_verified,false,id);assert.equal(core.dashboard().counts.requested,0,id);assert.equal(core.dashboard().counts.removed,0,id);
  }
});
