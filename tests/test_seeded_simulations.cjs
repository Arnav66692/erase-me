'use strict';
// Synthetic state-machine and boundary simulations. No browser, broker or mail calls.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Details=require('../extension/identity-details.js');
const Core=require('../webapp/static/workspace-core.js');
const Planner=require('../webapp/static/footprint-planner.js');

const NOW='2026-11-05T12:00:00.000Z';
const SEED=0x45524153;
const COUNTS={identity:2400,workflow:1200,planner:2400};
const minimal={date_of_birth:false,street_address:false,phone:false,no_validate:false,submit_no_validate:false};
const fullRequirements={...minimal,date_of_birth:true,street_address:true,phone:true};
const contract=Details.CONTRACTS.fastpeoplesearch;
const clone=value=>JSON.parse(JSON.stringify(value));
function generator(seed){let state=seed>>>0;return maximum=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state%maximum;};}
function checkCase(category,index,run){
  const failure=error=>{throw new Error(`Simulation failed: seed=0x${SEED.toString(16)} category=${category} case=${index}`,{cause:error});};
  try{const result=run();return result&&typeof result.then==='function'?result.catch(failure):result;}catch(error){return failure(error);}
}
function descriptor(bits){return Object.fromEntries(Object.keys(minimal).map((key,index)=>[key,!!(bits&(1<<index))]));}
function nativeRequirementsSatisfied(method,flags){
  if(method==='full_matching_details')return !flags.no_validate&&!flags.submit_no_validate&&flags.date_of_birth&&flags.street_address&&flags.phone;
  if(flags.no_validate||flags.submit_no_validate)return true;
  const supplied=new Set(method==='date_of_birth'?['date_of_birth']:['street_address']);
  return ['date_of_birth','street_address','phone'].every(key=>!flags[key]||supplied.has(key));
}
function calendarAdult(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [year,month,day]=value.split('-').map(Number);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1000||month<1||month>12||day<1||day>days[month-1])return false;
  const age=2026-year-(month>11||(month===11&&day>5)?1:0);
  return age>=18&&age<=120;
}
const unicodeCities=['Example City','München','Łódź','São Paulo','東京','Que\u0301bec'];
function detailsFor(index,random,method='full_matching_details'){
  const year=1927+random(80),month=1+random(12),day=1+random(28);
  const base={method,city:`${unicodeCities[random(unicodeCities.length)]} ${index}`,state:['CA','NY','TX','DC','PR'][random(5)],zip_code:String(10000+random(89999))};
  const birth=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  if(method!=='street_address')base.date_of_birth=birth;
  if(method!=='date_of_birth')base.street_address=`${100+random(9000)} Synthetic Avenue Apt ${index}`;
  if(method==='full_matching_details')base.phone=`(212) 555-${String(1000+random(8999))}`;
  return base;
}
function noSensitiveValues(core,details){
  const persisted=core.exportData();
  for(const value of [details.date_of_birth,details.street_address,details.phone,details.city,details.zip_code].filter(Boolean))assert.equal(persisted.includes(value),false);
  assert.equal(persisted.includes('ticketid'),false);
  assert.equal(core.dashboard().counts.removed,0);
  assert.equal(core.dashboard().counts.requested,0);
}
async function trustedFixtureState(){
  let sequence=0;const data=new Map();
  const core=Core.create({storage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)},uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=>NOW});
  const signup=await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:35,email:'synthetic@example.test',authorized:true})});assert.equal(signup.ok,true);
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',city:'Profile City',region:'CA'})});
  core.holdRoute('usphonebook');core.setEvidence('fastpeoplesearch',{first_name:'Example',last_name:'Person'});
  const session=core.mailSessionRequest('fastpeoplesearch'),request_id='b'.repeat(32),issued_at=1793836800,expires_at=issued_at+7*86400,contact_email='synthetic+erase-'+request_id+'@gmail.com';
  const claims={v:1,request_id,route_id:'fastpeoplesearch',operation_id:session.operation_id,recipient:contact_email,issued_at,expires_at};
  core.bindMailContact('fastpeoplesearch',{status:'ready',request_id,route_id:'fastpeoplesearch',operation_id:session.operation_id,contact_email,expires_at,capability:Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43),automatic_execution:false});
  const operation=core.prepare('fastpeoplesearch');core.recordCompanion('fastpeoplesearch',operation.operationId,{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'});
  const receipt={status:'held',route_id:'fastpeoplesearch',operation_id:operation.operationId,request_id,reason:'route_validation_required',received_at:issued_at+1,receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:true};
  core.recordMailReceipt('fastpeoplesearch',receipt);core.mailContinuationRequest('fastpeoplesearch',{});
  const confirmation_url='https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email:contact_email,ticketid:'12345678'});
  core.prepareMailContinuation('fastpeoplesearch',{status:'confirmation_ready',route_id:'fastpeoplesearch',operation_id:operation.operationId,request_id,receipt_ref:receipt.receipt_ref,confirmation_url,automatic_execution:false},{});
  core.recordMailContinuation('fastpeoplesearch',operation.operationId,{status:'prepared'});
  return data.get(Core.KEY);
}
function controller(initial,index){
  const data=new Map(initial?[[Core.KEY,initial]]:[]);let sequence=1000+index*10,storageFails=false;
  const options={storage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>{if(storageFails)throw Error('Synthetic quota');data.set(key,value);},removeItem:key=>data.delete(key)},uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=>NOW};
  return {core:Core.create(options),data,options,failStorage:()=>{storageFails=true;}};
}

test('2,400 seeded identity/calendar/required-field simulations use independent acceptance oracles',t=>{
  const random=generator(SEED),categories={valid:0,invalid:0,requirements:0};
  for(let index=0;index<COUNTS.identity;index++)checkCase('identity',index,()=>{
    const mode=index%3,method=['date_of_birth','street_address','full_matching_details'][random(3)];
    if(mode===0){
      categories.valid++;const value=detailsFor(index,random,method),before=clone(value),flags=method==='full_matching_details'?fullRequirements:minimal;
      value.city='  '+value.city.replace(/ /g,'   ')+'  ';value.state=value.state.toLowerCase();
      const result=Details.validate(value,{now:NOW,requirements:flags});assert.deepEqual(result,before);assert.notEqual(result,value);
      assert.equal(value.state,before.state.toLowerCase());assert.deepEqual(Details.validate(result,{now:NOW,requirements:flags}),result);
    }else if(mode===1){
      categories.invalid++;const value=detailsFor(index,random,'full_matching_details'),kind=random(12);
      if(kind===0)value.date_of_birth=`${1890+random(260)}-${String(random(15)).padStart(2,'0')}-${String(random(35)).padStart(2,'0')}`;
      else if(kind===1)value.zip_code=String(random(9999));
      else if(kind===2)value.state='Z'+String(random(10));
      else if(kind===3)value.city='\u0000PRIVATE-SYNTHETIC-'+index;
      else if(kind===4)value.street_address='PRIVATE-SYNTHETIC-<'+index+'>';
      else if(kind===5)value.phone='PRIVATE-SYNTHETIC-'+index;
      else if(kind===6)value.unknown='PRIVATE-SYNTHETIC-'+index;
      else if(kind===7)delete value.zip_code;
      else if(kind===8)value.date_of_birth=['1900-02-29','2003-02-29','2008-11-06','1905-11-05'][random(4)];
      else if(kind===9)value.city='x'.repeat(121+random(40));
      else if(kind===10)value.street_address='x'.repeat(201+random(40));
      else value.phone='212555'+String(random(999));
      const accepted=kind===0&&calendarAdult(value.date_of_birth);
      if(accepted)assert.equal(Details.validate(value,{now:NOW,requirements:fullRequirements}).date_of_birth,value.date_of_birth);
      else assert.throws(()=>Details.validate(value,{now:NOW,requirements:fullRequirements}),error=>error instanceof Details.IdentityDetailError&&!error.message.includes('PRIVATE-SYNTHETIC'));
    }else{
      categories.requirements++;const flags=descriptor(Math.floor(index/3)%32),value=detailsFor(index,random,method);
      if(index%5===0){
        const malformed={...flags,[Object.keys(flags)[random(5)]]:['true',0,null][random(3)]};
        assert.throws(()=>Details.validateRequirements(malformed));assert.throws(()=>Details.validate(value,{now:NOW,requirements:malformed}));
      }else if(nativeRequirementsSatisfied(method,flags))assert.equal(Details.validate(value,{now:NOW,requirements:flags}).method,method);
      else assert.throws(()=>Details.validate(value,{now:NOW,requirements:flags}));
      const result=Details.validateRequirements(flags);assert.deepEqual(result,flags);assert.notEqual(result,flags);
    }
  });
  assert.deepEqual(categories,{valid:800,invalid:800,requirements:800});
  t.diagnostic(JSON.stringify({seed:'0x45524153',simulations:COUNTS.identity,categories}));
});

test('1,200 seeded workflow simulations preserve consent, local privacy, holds and non-replay',async t=>{
  const initial=await trustedFixtureState(),random=generator(SEED^0x434f5245);
  const scenarios=['approved_attempt','replay','held','paused','stale_profile','stale_receipt','missing_consent','requirement_drift','storage_failure','forged_outcome','backup_restore','stale_hold_guard'];
  const counts=Object.fromEntries(scenarios.map(name=>[name,0]));
  for(let index=0;index<COUNTS.workflow;index++){
    const scenario=scenarios[index%scenarios.length];counts[scenario]++;
    await checkCase('workflow',index,async()=>{
      const f=controller(initial,index),{core}=f,preview=core.identityPreview('fastpeoplesearch'),details=detailsFor(index+10000,random),approval={authorized:true,consentId:contract.id,requirements:fullRequirements};
      const before=f.data.get(Core.KEY);
      if(scenario==='held'){core.holdRoute('fastpeoplesearch');assert.throws(()=>core.prepareIdentitySubmission(preview,details,approval));}
      else if(scenario==='paused'){await core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});assert.throws(()=>core.prepareIdentitySubmission(preview,details,approval));}
      else if(scenario==='stale_profile'||scenario==='stale_hold_guard'){
        await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'US',city:'Changed Profile '+index})});
        assert.throws(()=>core.prepareIdentitySubmission(preview,details,approval));
        if(scenario==='stale_hold_guard'){assert.throws(()=>core.holdRoute('fastpeoplesearch',preview));assert.notEqual(core.snapshot().items.fastpeoplesearch.held,true);}
      }else if(scenario==='stale_receipt'){
        const state=JSON.parse(f.data.get(Core.KEY));state.items.fastpeoplesearch.mail_receipt.receipt_ref='d'.repeat(64);f.data.set(Core.KEY,JSON.stringify(state));assert.throws(()=>core.prepareIdentitySubmission(preview,details,approval));
      }else if(scenario==='missing_consent'){
        const badApproval=clone(approval);if(Math.floor(index/scenarios.length)%2)badApproval.authorized=false;else badApproval.consentId='wrong-contract-'+index;
        assert.throws(()=>core.prepareIdentitySubmission(preview,details,badApproval));assert.equal(f.data.get(Core.KEY),before);
      }else if(scenario==='requirement_drift'){
        const flags={...fullRequirements,[['phone','no_validate','submit_no_validate'][random(3)]]:random(2)===0};
        // Force a descriptor that cannot justify collecting the full union.
        flags.phone=false;
        assert.throws(()=>core.prepareIdentitySubmission(preview,details,{...approval,requirements:flags}));assert.equal(f.data.get(Core.KEY),before);
      }else if(scenario==='storage_failure'){
        f.failStorage();assert.throws(()=>core.prepareIdentitySubmission(preview,details,approval));assert.equal(f.data.get(Core.KEY),before);
      }else{
        const operation=core.prepareIdentitySubmission(preview,details,approval);
        const saved=core.snapshot().items.fastpeoplesearch.final_submission;assert.equal(saved.id,operation.submissionId);assert.equal(saved.result,'unknown');assert.deepEqual(operation.details,details);
        if(scenario==='forged_outcome'){
          for(const result of [{status:'removed',deletion_verified:true},{status:'requested',acceptance_verified:true},{status:'submission_attempted',attempt_verified:false,stage:'final_request_submission'},{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'}])assert.throws(()=>core.recordIdentitySubmission('fastpeoplesearch',operation.submissionId,result));
          assert.equal(core.snapshot().items.fastpeoplesearch.final_submission.result,'unknown');
        }else{
          core.recordIdentitySubmission('fastpeoplesearch',operation.submissionId,{status:'submission_attempted',attempt_verified:true,stage:'final_request_submission',acceptance_verified:true,deletion_verified:true,details,detail:'PRIVATE-SYNTHETIC-'+index});
          const final=core.snapshot().items.fastpeoplesearch.final_submission;assert.equal(final.attempt_verified,true);assert.equal(final.acceptance_verified,false);assert.equal(final.deletion_verified,false);
          if(scenario==='replay'){
            const other=Core.create(f.options);assert.throws(()=>other.prepareIdentitySubmission(preview,details,approval));assert.throws(()=>core.prepareIdentitySubmission(preview,details,approval));
            assert.equal(core.identityResultRequest('fastpeoplesearch').submissionId,operation.submissionId);
          }else if(scenario==='backup_restore'){
            const restored=controller(null,index+2000);restored.core.importData(core.exportData());const ref=restored.core.snapshot().items.fastpeoplesearch.final_submission;
            assert.equal(ref.id,operation.submissionId);assert.equal(ref.source,'imported_user_history');assert.equal(ref.result,'unknown');assert.equal(ref.attempt_verified,false);
            assert.throws(()=>restored.core.prepareIdentitySubmission(preview,details,approval));assert.throws(()=>restored.core.identityResultRequest('fastpeoplesearch'));
            noSensitiveValues(restored.core,details);
          }
        }
        assert.throws(()=>core.identityPreview('fastpeoplesearch'));
      }
      noSensitiveValues(core,details);assert.equal(core.snapshot().items.usphonebook.held,true);
      if(!['approved_attempt','replay','forged_outcome','backup_restore'].includes(scenario))assert.equal(core.snapshot().items.fastpeoplesearch.final_submission,undefined);
    });
  }
  assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),COUNTS.workflow);
  t.diagnostic(JSON.stringify({seed:'0x45524153',simulations:COUNTS.workflow,categories:counts}));
});

test('2,400 seeded cleanup-plan simulations isolate local choices and never manufacture deletion proof',t=>{
  const random=generator(SEED^0x504c414e),categories={roundtrip:0,unsafe_import:0,choice_gate:0,untrusted_history:0};
  const unsafeURLs=['https://user:secret@example.test/','https://example.test/reset/password','https://example.test/verify/key','https://example.test/path?token=private','https://example.test/path#code','https://example.test/ver%69fy%2Fsecret','https://localhost./','https://127.0.0.1/','https://machine.local/','http://example.test/','javascript:alert(1)','https://example.test/%0aPrivate'];
  for(let index=0;index<COUNTS.planner;index++)checkCase('planner',index,()=>{
    const mode=index%4,category=Planner.CATEGORIES[random(Planner.CATEGORIES.length)],row={service:`${unicodeCities[random(unicodeCities.length)]} service ${index}`,category,url:`https://example.test/public/${index}-${random(1000000)}`};
    if(mode===1){
      categories.unsafe_import++;const secret='PRIVATE-SYNTHETIC-'+index;
      if(index%3===0){row.url=unsafeURLs[random(unsafeURLs.length)];assert.throws(()=>Planner.parse(JSON.stringify([row]),'json'));}
      else if(index%3===1){row[['password','token','email','authorization'][random(4)]]=secret;assert.throws(()=>Planner.parse(JSON.stringify([row]),'json'),error=>!error.message.includes(secret));}
      else {const csv='service,password\r\n"Synthetic '+index+'","'+secret+'"';assert.throws(()=>Planner.parse(csv,'csv'),error=>!error.message.includes(secret));}
      return;
    }
    const format=index%2?'csv':'json',content=format==='json'?JSON.stringify([row]):'service,category,url\r\n'+[row.service,row.category,row.url].map(value=>'"'+value.replace(/"/g,'""')+'"').join(',');
    const parsed=Planner.parse(content,format);assert.deepEqual(parsed,[row]);let sequence=0;
    const original=Planner.add(Planner.empty(),parsed,{uuid:()=>String(index)+'_'+(++sequence),now:NOW}),id=original.items[0].id;
    assert.equal(Planner.empty().items.length,0);
    if(mode===0){
      categories.roundtrip++;const decision=category==='privacy_setting'?'remove':['keep','export_first','remove'][random(3)];
      let plan=Planner.choose(original,id,{decision,authorized:true,closureReviewed:true},{now:NOW});
      if(decision==='keep')assert.throws(()=>Planner.progress(plan,id,{event:'recheck_reviewed',authorized:true},{now:NOW}));
      else{
        if(decision==='export_first')plan=Planner.progress(plan,id,{event:'export_completed',authorized:true},{now:NOW});
        const event=category==='privacy_setting'?'setting_updated':category==='search_result'?'search_result_removed':category==='social'?'content_reviewed':'request_submitted';
        plan=Planner.progress(plan,id,{event,authorized:true},{now:NOW});
        const restored=Planner.normalize(JSON.parse(JSON.stringify(plan)),{imported:true});assert.equal(restored.items[0].decision,decision);assert.ok(restored.items[0].reports.every(report=>report.source==='imported_user_history'));
        const view=Planner.view(restored).items[0];assert.equal(view.deletion_verified,false);assert.equal(view.acceptance_verified,false);assert.equal(view.independent_verification_available,false);
        if(category==='search_result'){assert.equal(view.reported_outcomes.search_result_removed,true);assert.equal(view.reported_outcomes.source_removed,false);}
      }
      assert.equal(original.items[0].decision,null);assert.equal(original.items[0].reports.length,0);
    }else if(mode===2){
      categories.choice_gate++;assert.throws(()=>Planner.choose(original,id,{decision:'remove',authorized:false,closureReviewed:true},{now:NOW}));
      if(category==='account')assert.throws(()=>Planner.choose(original,id,{decision:'remove',authorized:true,closureReviewed:false},{now:NOW}));
      if(category==='privacy_setting')assert.throws(()=>Planner.choose(original,id,{decision:'export_first',authorized:true,closureReviewed:true},{now:NOW}));
      else {let plan=Planner.choose(original,id,{decision:'export_first',authorized:true,closureReviewed:true},{now:NOW});assert.throws(()=>Planner.progress(plan,id,{event:'request_submitted',authorized:true},{now:NOW}));plan=Planner.progress(plan,id,{event:'export_completed',authorized:true},{now:NOW});assert.equal(plan.items[0].export_acknowledged,true);}
      assert.equal(original.items[0].decision,null);
    }else{
      categories.untrusted_history++;const altered=clone(original);
      if(index%3===0)altered.items[0].deletion_verified=true;
      else if(index%3===1)altered.items[0].reports=[{event:'verified_removed',at:NOW,source:'user_reported'}];
      else altered.items[0].reports=[{event:'recheck_reviewed',at:NOW,source:'trusted_broker'}];
      assert.throws(()=>Planner.normalize(altered,{imported:true}));
      const plan=Planner.choose(original,id,{decision:'remove',authorized:true,closureReviewed:true},{now:NOW});
      assert.throws(()=>Planner.progress(plan,id,{event:'verified_removed',authorized:true},{now:NOW}));
      assert.equal(Planner.view(plan).items[0].deletion_verified,false);
    }
  });
  assert.deepEqual(categories,{roundtrip:600,unsafe_import:600,choice_gate:600,untrusted_history:600});
  t.diagnostic(JSON.stringify({seed:'0x45524153',simulations:COUNTS.planner,categories}));
});
