'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Background=require('../extension/background.js'),Details=require('../extension/identity-details.js');
const operationId='a'.repeat(32),requestId='b'.repeat(32),receiptRef='c'.repeat(64),submissionId='d'.repeat(32);
const email='removal+erase-'+requestId+'@gmail.com';
const confirmationUrl='https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email,ticketid:'12345678'});
const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:90}};
const continuation={type:'erase-me',action:'continue',routeId:'fastpeoplesearch',operationId,requestId,receiptRef,confirmationUrl,contactEmail:email,fields:{first_name:'Example',last_name:'Person',email},authorized:true};
const message=()=>({type:'erase-me',action:'submit-details',routeId:'fastpeoplesearch',operationId,requestId,receiptRef,submissionId,authorized:true,consentId:Details.CONTRACTS.fastpeoplesearch.id,
  fields:{first_name:'Example',last_name:'Person',email},requirements:{date_of_birth:true,street_address:false,phone:false,no_validate:false,submit_no_validate:false},
  details:{method:'date_of_birth',date_of_birth:'1990-05-12',city:'Example City',state:'CA',zip_code:'92101'}});
const reading=()=>({type:'erase-me',action:'identity-result',routeId:'fastpeoplesearch',operationId,submissionId,authorized:true});
const requirementsRequest=()=>({type:'erase-me',action:'identity-requirements',routeId:'fastpeoplesearch',operationId,requestId,receiptRef,authorized:true});
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(options={}){
  const records={},sessionRecords={},calls=[];const state={id:7,windowId:4,status:'complete',url:'',documentId:'owned-document',permission:true,closed:false,...options};
  const store=(values,kind)=>({get:async key=>values[key]===undefined?{}:{[key]:clone(values[key])},set:async value=>{
    if(kind==='local'&&state.failFinalReservation&&Object.keys(value).includes('final-operation:'+operationId))throw Error('quota');
    if(kind==='local'&&state.failFinalResult&&Object.values(value).some(value=>value?.result?.status==='submission_attempted'))throw Error('quota');
    Object.assign(values,clone(value));
  }});
  const api={storage:{local:store(records,'local'),session:store(sessionRecords,'session')},permissions:{contains:async()=>state.permission},
    tabs:{create:async value=>{calls.push('create');state.url=value.url;return{id:7,status:'complete'};},get:async()=>{if(state.closed)throw Error('closed');return{id:7,windowId:4,status:state.status,url:state.url};},update:async()=>{throw Error('No tab activation belongs to final submission');}},
    windows:{update:async()=>{throw Error('No window activation belongs to final submission');}},
    scripting:{executeScript:async spec=>{
      if(spec.files){
        calls.push(spec.files.includes('final-executor.js')?'final-install':'install');
        if(spec.files.includes('final-executor.js'))state.afterFinalInstall?.();
        return[{documentId:state.documentId}];
      }
      if(spec.target.documentIds?.[0]!==state.documentId)throw Error('changed document');
      if(spec.func.toString().includes('location.href===expected')){
        calls.push('probe');state.beforeProbe?.();return[{documentId:state.documentId,result:state.url===spec.args[0]}];
      }
      if(spec.func.toString().includes('EraseFinalExecutor.execute')){
        calls.push('final-execute');
        assert.equal(records['final-operation:'+operationId]?.result.status,'unknown');assert.equal(records['final:'+submissionId]?.result.status,'unknown');
        assert.deepEqual(spec.target.documentIds,['owned-document']);assert.equal(spec.args[1],confirmationUrl);
        assert.equal(spec.args[0].details.date_of_birth,'1990-05-12');assert.equal(spec.args[0].fields.email,email);
        assert.ok(spec.args[0].requirements);assert.equal(typeof spec.args[0].requirements.phone,'boolean');
        if(state.finalGate)await state.finalGate;
        return[{documentId:state.changedReply?'other-document':'owned-document',result:state.finalResult||{status:'submission_attempted',attempt_verified:true,stage:'final_request_submission',detail:'Untrusted detail '+email+' 1990-05-12'}}];
      }
      if(spec.func.toString().includes('EraseFinalExecutor.describe')){
        calls.push('requirements-read');assert.equal(spec.args[0],confirmationUrl);state.afterRequirementsRead?.();
        return[{documentId:state.changedRequirementsReply?'other-document':'owned-document',result:state.requirementsReply||{status:'ready',requirements:state.requirements||message().requirements}}];
      }
      calls.push('continuation-read');return[{documentId:'owned-document',result:{status:'prepared',detail:'The matching form is ready.'}}];
    }}
  };
  return{api,state,records,sessionRecords,calls};
}
async function ready(options={}){const f=fixture(options);assert.equal((await Background.dispatch(continuation,sender,f.api)).status,'prepared');return f;}
const finalCalls=f=>f.calls.filter(value=>value==='final-execute').length;

test('one final submission uses the current owned matching form and stores no identity, location, URL or token',async()=>{
  const f=await ready(),request=message();const result=await Background.dispatch(request,sender,f.api);
  assert.equal(result.status,'submission_attempted');assert.equal(result.stage,'final_request_submission');assert.equal(result.attempt_verified,true);assert.equal(finalCalls(f),1);assert.equal(f.calls.filter(value=>value==='create').length,1);
  const serialized=JSON.stringify({records:f.records,session:f.sessionRecords,result});
  for(const value of ['1990-05-12','Example City','92101',email,confirmationUrl,'first_name','date_of_birth','details'])assert.equal(serialized.includes(value),false);
  await Background.dispatch(request,sender,f.api);assert.equal(finalCalls(f),1);
  assert.equal((await Background.dispatch({...request,submissionId:'e'.repeat(32)},sender,f.api)).status,'unknown');assert.equal(finalCalls(f),1);
  assert.equal(f.records['final-operation:'+operationId].submissionId,submissionId);
});

test('malformed approval, extra fields, unsupported routes and mismatched original identities stop before any personal script',async()=>{
  for(const change of [{authorized:false},{consentId:'other'},{url:confirmationUrl},{tabId:7},{routeId:'usphonebook'},{submissionId:'invalid'},
    {fields:{...continuation.fields,email:'other@example.test'}},{details:{...message().details,phone:'5551231234'}}]){
    const f=await ready();await assert.rejects(Background.dispatch({...message(),...change},sender,f.api));assert.equal(finalCalls(f),0);
  }
  const f=await ready();await assert.rejects(Background.dispatch(message(),{...sender,url:'https://evil.example/'},f.api));assert.equal(finalCalls(f),0);
});

test('unproven, changed, closed, revoked or wrong-operation matching forms cannot receive identity fields',async()=>{
  const mutations=[f=>delete f.sessionRecords['focus:continuation:'+operationId],f=>f.sessionRecords['erase-browser-session']=crypto.randomUUID(),f=>delete f.sessionRecords['erase-observation-key'],
    f=>f.state.closed=true,f=>f.state.permission=false,f=>f.state.status='loading',f=>f.state.documentId='other-document',f=>f.state.url=confirmationUrl.replace('ticketid=12345678','ticketid=87654321'),
    f=>f.state.url='https://evil.example/',f=>f.records['continuation:'+operationId].result={status:'unknown'},f=>f.records['continuation:'+operationId].requestId='f'.repeat(32)];
  for(const mutate of mutations){const f=await ready();mutate(f);const result=await Background.dispatch(message(),sender,f.api);assert.ok(['blocked','unknown'].includes(result.status));assert.equal(finalCalls(f),0);assert.equal(f.calls.filter(value=>value==='create').length,1);}
});

test('revocation during document checks or after installation prevents the personal script',async()=>{
  for(const stage of ['beforeProbe','afterFinalInstall'])for(const change of ['permission','proof','url','record']){
    const f=await ready();let ran=false;f.state[stage]=()=>{if(ran)return;ran=true;
      if(change==='permission')f.state.permission=false;if(change==='proof')delete f.sessionRecords['focus:continuation:'+operationId];
      if(change==='url')f.state.url=confirmationUrl.replace('ticketid=12345678','ticketid=87654321');if(change==='record')f.records['continuation:'+operationId].receiptRef='f'.repeat(64);
    };
    const result=await Background.dispatch(message(),sender,f.api);assert.ok(['blocked','unknown'].includes(result.status));assert.equal(finalCalls(f),0);
  }
});

test('concurrent different UUIDs cannot repeat the same original final request',async()=>{
  const f=await ready();let release;f.state.finalGate=new Promise(resolve=>release=resolve);
  const first=Background.dispatch(message(),sender,f.api);await new Promise(resolve=>setImmediate(resolve));
  const second=await Background.dispatch({...message(),submissionId:'e'.repeat(32)},sender,f.api);assert.equal(second.status,'unknown');
  release();assert.equal((await first).status,'submission_attempted');assert.equal(finalCalls(f),1);
});

test('changed replies, forged success and persistence failures preserve uncertainty without replay',async()=>{
  for(const options of [{changedReply:true},{finalResult:{status:'removed'}},{finalResult:{status:'submission_attempted',attempt_verified:false,stage:'final_request_submission'}},
    {finalResult:{status:'submission_attempted',attempt_verified:true,stage:'verification_initiation'}},{failFinalResult:true},{failFinalReservation:true}]){
    const f=await ready(options);const result=await Background.dispatch(message(),sender,f.api);assert.equal(result.status,'unknown');
    if(!options.failFinalReservation){await Background.dispatch({...message(),submissionId:'e'.repeat(32)},sender,f.api);assert.equal(finalCalls(f),1);}
    else assert.equal(finalCalls(f),0);
  }
});

test('final result reconciliation reads only matching local references, including after a lost reply',async()=>{
  const f=await ready();await Background.dispatch(message(),sender,f.api);const count=f.calls.length;
  const result=await Background.dispatch(reading(),sender,f.api);assert.equal(result.status,'submission_attempted');assert.equal(f.calls.length,count);
  for(const change of [{operationId:'e'.repeat(32)},{submissionId:'f'.repeat(32)}])assert.equal((await Background.dispatch({...reading(),...change},sender,f.api)).status,'unknown');
  for(const change of [{routeId:'usphonebook'},{authorized:false},{details:message().details},{url:confirmationUrl}])await assert.rejects(Background.dispatch({...reading(),...change},sender,f.api));
  assert.equal(f.calls.length,count);
});

test('blocked final actions are held and their local result cannot become a deletion claim',async()=>{
  const f=await ready({finalResult:{status:'blocked',detail:'Untrusted '+email}});assert.equal((await Background.dispatch(message(),sender,f.api)).status,'blocked');
  const count=finalCalls(f);assert.equal((await Background.dispatch({...message(),submissionId:'e'.repeat(32)},sender,f.api)).status,'unknown');assert.equal(finalCalls(f),count);
  const result=await Background.dispatch(reading(),sender,f.api);assert.equal(result.status,'blocked');assert.equal(JSON.stringify(result).includes(email),false);assert.equal(result.deletion_verified,undefined);
});

test('requirements preflight reads only the original pinned form and returns boolean metadata without reserving or writing',async()=>{
  const f=await ready(),before=JSON.stringify({local:f.records,session:f.sessionRecords});
  const result=await Background.dispatch(requirementsRequest(),sender,f.api);
  assert.deepEqual(result,{status:'ready',routeId:'fastpeoplesearch',operationId,requirements:message().requirements});
  assert.equal(JSON.stringify({local:f.records,session:f.sessionRecords}),before);assert.equal(finalCalls(f),0);assert.equal(f.calls.filter(value=>value==='create').length,1);
  for(const value of [email,confirmationUrl,'Example','Person','1990','92101'])assert.equal(JSON.stringify(result).includes(value),false);
  assert.equal((await Background.dispatch(requirementsRequest(),sender,f.api)).status,'ready');assert.equal(finalCalls(f),0);
});

test('requirements preflight rejects extra data, foreign sources, wrong references or stale browser proof',async()=>{
  for(const change of [{authorized:false},{routeId:'usphonebook'},{fields:continuation.fields},{url:confirmationUrl},{tabId:7},{requestId:'bad'}]){
    const f=await ready();await assert.rejects(Background.dispatch({...requirementsRequest(),...change},sender,f.api));assert.equal(f.calls.includes('requirements-read'),false);
  }
  const f=await ready();await assert.rejects(Background.dispatch(requirementsRequest(),{...sender,url:'https://evil.example/'},f.api));
  for(const mutate of [f=>f.state.closed=true,f=>f.state.permission=false,f=>f.state.documentId='changed-document',f=>delete f.sessionRecords['focus:continuation:'+operationId],f=>f.sessionRecords['erase-browser-session']=crypto.randomUUID()]){
    const f=await ready();mutate(f);const result=await Background.dispatch(requirementsRequest(),sender,f.api);assert.equal(result.status,'unavailable');assert.equal(f.calls.includes('requirements-read'),false);assert.equal(finalCalls(f),0);
  }
});

test('invalid or revoked requirements replies stay unavailable and cannot disclose returned values',async()=>{
  for(const options of [{changedRequirementsReply:true},{requirementsReply:{status:'ready',requirements:{...message().requirements,phone:'true'}}},
    {requirementsReply:{status:'ready',requirements:message().requirements,personalValue:'private'}},{requirementsReply:{status:'ready',requirements:{phone:false}}},
    {afterRequirementsRead(){this.permission=false;}}]){
    const f=await ready(options);const before=JSON.stringify(f.records);const result=await Background.dispatch(requirementsRequest(),sender,f.api);
    assert.equal(result.status,'unavailable');assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(JSON.stringify(f.records),before);assert.equal(finalCalls(f),0);
  }
});

test('a consumed final action cannot request another identity collection through preflight',async()=>{
  const f=await ready();await Background.dispatch(message(),sender,f.api);const count=f.calls.filter(value=>value==='requirements-read').length;
  assert.equal((await Background.dispatch(requirementsRequest(),sender,f.api)).status,'unavailable');assert.equal(f.calls.filter(value=>value==='requirements-read').length,count);assert.equal(finalCalls(f),1);
});
