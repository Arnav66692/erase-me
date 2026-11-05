'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Background=require('../extension/background.js');

const sender={url:'https://erase-me-preview.vercel.app/',tab:{id:90}};
const operationId='a'.repeat(32),requestId='b'.repeat(32),receiptRef='c'.repeat(64);
const email='removal+erase-'+requestId+'@gmail.com';
const confirmationUrl='https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email,ticketid:'12345678'});
const continuation={type:'erase-me',action:'continue',routeId:'fastpeoplesearch',operationId,requestId,receiptRef,
  confirmationUrl,contactEmail:email,fields:{first_name:'Example',last_name:'Person',email},authorized:true};
const original={type:'erase-me',action:'run',routeId:'fastpeoplesearch',operationId,
  fields:{first_name:'Example',last_name:'Person',email},authorized:true};
const focus=(stage='continuation')=>({type:'erase-me',action:'focus-existing',routeId:'fastpeoplesearch',operationId,stage,authorized:true,
  ...(stage==='continuation'?{requestId,receiptRef}:{})});
const copy=value=>JSON.parse(JSON.stringify(value));

function fixture(options={}){
  const records={},sessionRecords={},calls=[];
  const state={id:7,windowId:4,status:'complete',url:'',documentId:'owned-document',permission:true,closed:false,...options};
  const storage=(values,kind)=>({
    get:async key=>values[key]===undefined?{}:{[key]:copy(values[key])},
    set:async value=>{
      if(kind==='session'&&state.rejectProof&&Object.keys(value).some(key=>key.startsWith('focus:')))throw Error('storage unavailable');
      Object.assign(values,copy(value));
    }
  });
  const api={
    storage:{local:storage(records,'local'),session:options.noSession?undefined:storage(sessionRecords,'session')},
    permissions:{contains:async()=>state.permission},
    tabs:{
      create:async value=>{
        assert.equal(records[(value.url.includes('/optout/removal?')?'continuation:':'operation:')+operationId]?.result.status,'unknown');
        calls.push({kind:'create'});state.url=value.url;return{id:state.id,status:state.status,url:state.url,windowId:state.windowId};
      },
      get:async tabId=>{
        if(state.closed)throw Error('closed tab');
        assert.equal(tabId,state.id);return{id:state.id,status:state.status,url:state.url,windowId:state.windowId};
      },
      update:async(tabId,value)=>{
        assert.equal(tabId,state.id);assert.deepEqual(value,{active:true});
        calls.push({kind:'activate'});state.beforeActivationReply?.();
        return{id:state.id,status:state.status,url:state.url,windowId:state.windowId};
      }
    },
    windows:{update:async(windowId,value)=>{
      assert.equal(windowId,state.windowId);assert.deepEqual(value,{focused:true});calls.push({kind:'focus-window'});
    }},
    scripting:{executeScript:async spec=>{
      if(spec.files){calls.push({kind:'install'});return[{documentId:state.documentId}];}
      if(spec.target.documentIds&&spec.target.documentIds[0]!==state.documentId)throw Error('document changed');
      if(spec.func.toString().includes('location.href===expected')){
        calls.push({kind:'probe'});state.beforeProbe?.();
        return[{documentId:state.documentId,result:state.url===spec.args[0]}];
      }
      calls.push({kind:'form'});state.afterForm?.();
      return[{documentId:options.responseDocumentId||'owned-document',result:options.formResult||{status:'prepared',detail:'Reviewed form ready.'}}];
    }}
  };
  return{api,records,sessionRecords,calls,state};
}
function navigationCount(f){return f.calls.filter(call=>call.kind==='create').length;}
function activationCount(f){return f.calls.filter(call=>call.kind==='activate').length;}
function windowCount(f){return f.calls.filter(call=>call.kind==='focus-window').length;}
async function ready(options={},stage='continuation'){
  const f=fixture(options);const result=await Background.dispatch(stage==='continuation'?continuation:original,sender,f.api);
  assert.equal(result.status,'prepared');return f;
}

test('the existing matching form can be focused without navigation, form execution or private proof data',async()=>{
  const f=await ready(),proof=f.sessionRecords['focus:continuation:'+operationId];
  assert.equal(proof.stage,'continuation');assert.equal(proof.documentId,'owned-document');assert.equal(proof.requestId,requestId);
  assert.match(proof.urlHmac,/^[a-f0-9]{64}$/);
  const stored=JSON.stringify({local:f.records,session:f.sessionRecords});
  for(const value of [confirmationUrl,email,'Example','Person','ticketid','firstname'])assert.equal(stored.includes(value),false);
  const forms=f.calls.filter(call=>call.kind==='form').length;
  const result=await Background.dispatch(focus(),sender,f.api);
  assert.equal(result.status,'focused');assert.equal(result.routeId,'fastpeoplesearch');assert.equal(result.stage,'continuation');
  assert.equal(activationCount(f),1);assert.equal(windowCount(f),1);assert.equal(navigationCount(f),1);
  assert.equal(f.calls.filter(call=>call.kind==='form').length,forms);
  assert.equal((await Background.dispatch(focus(),sender,f.api)).status,'focused');
  assert.equal(navigationCount(f),1);
});

test('original prepared forms use a separate operation proof and unchanged existing tab',async()=>{
  const f=await ready({},'operation');
  assert.ok(f.sessionRecords['focus:operation:'+operationId]);assert.equal(f.sessionRecords['focus:continuation:'+operationId],undefined);
  assert.equal((await Background.dispatch(focus('operation'),sender,f.api)).status,'focused');
  assert.equal((await Background.dispatch(focus(),sender,f.api)).status,'unavailable');
  assert.equal(navigationCount(f),1);
});

test('foreign senders, extra URL/tab/field data and incomplete approval cannot focus anything',async()=>{
  const f=await ready();
  for(const change of [{url:confirmationUrl},{tabId:7},{fields:{email}},{authorized:false},{stage:'anything'},{requestId:undefined},{receiptRef:'wrong'}])
    await assert.rejects(Background.dispatch({...focus(),...change},sender,f.api));
  for(const source of ['https://evil.example/','http://erase-me-preview.vercel.app/','https://erase-me-preview.vercel.app.evil.test/'])
    await assert.rejects(Background.dispatch(focus(),{...sender,url:source},f.api));
  assert.equal(activationCount(f),0);assert.equal(windowCount(f),0);assert.equal(navigationCount(f),1);
});

test('wrong route, operation or confirmation references cannot reuse an otherwise valid focus proof',async()=>{
  const f=await ready();
  for(const change of [{routeId:'usphonebook'},{operationId:'d'.repeat(32)},{requestId:'e'.repeat(32)},{receiptRef:'f'.repeat(64)}])
    assert.equal((await Background.dispatch({...focus(),...change},sender,f.api)).status,'unavailable');
  assert.equal(activationCount(f),0);assert.equal(navigationCount(f),1);
});

test('closed, navigated, replaced, loading or unpermitted tabs stay unavailable without reopening',async()=>{
  const mutations=[
    f=>{f.state.closed=true;},
    f=>{f.state.url=f.state.url.replace('ticketid=12345678','ticketid=87654321');},
    f=>{f.state.url='https://www.fastpeoplesearch.com/login';},
    f=>{f.state.url='https://evil.example/';},
    f=>{f.state.documentId='new-document';},
    f=>{f.state.status='loading';},
    f=>{f.state.permission=false;},
    f=>{f.sessionRecords['erase-browser-session']=crypto.randomUUID();},
    f=>{delete f.sessionRecords['focus:continuation:'+operationId];},
    f=>{delete f.sessionRecords['erase-observation-key'];},
    f=>{f.records['continuation:'+operationId].result={status:'unknown'};}
  ];
  for(const mutate of mutations){const f=await ready();mutate(f);
    const result=await Background.dispatch(focus(),sender,f.api);assert.equal(result.status,'unavailable');
    assert.equal(activationCount(f),0);assert.equal(windowCount(f),0);assert.equal(navigationCount(f),1);
  }
});

test('navigation or proof revocation during validation prevents stale activation',async()=>{
  for(const event of ['url','proof','permission','session']){
    const f=await ready();let ran=false;
    f.state.beforeProbe=()=>{if(ran)return;ran=true;
      if(event==='url')f.state.url=f.state.url.replace('ticketid=12345678','ticketid=87654321');
      if(event==='proof')delete f.sessionRecords['focus:continuation:'+operationId];
      if(event==='permission')f.state.permission=false;
      if(event==='session')f.sessionRecords['erase-browser-session']=crypto.randomUUID();
    };
    assert.equal((await Background.dispatch(focus(),sender,f.api)).status,'unavailable');
    assert.equal(activationCount(f),0);assert.equal(navigationCount(f),1);
  }
});

test('a navigation observed after activation cannot focus its window or report success',async()=>{
  const f=await ready();f.state.beforeActivationReply=()=>{f.state.url='https://www.fastpeoplesearch.com/login';};
  assert.equal((await Background.dispatch(focus(),sender,f.api)).status,'unavailable');assert.equal(windowCount(f),0);assert.equal(navigationCount(f),1);
});

test('authorization revoked during tab activation prevents the separate window-focus action',async()=>{
  for(const change of ['proof','session','permission','record']){
    const f=await ready();f.state.beforeActivationReply=()=>{
      if(change==='proof')delete f.sessionRecords['focus:continuation:'+operationId];
      if(change==='session')f.sessionRecords['erase-browser-session']=crypto.randomUUID();
      if(change==='permission')f.state.permission=false;
      if(change==='record')f.records['continuation:'+operationId].requestId='d'.repeat(32);
    };
    const result=await Background.dispatch(focus(),sender,f.api);
    assert.equal(result.status,'unavailable');assert.equal(result.routeId,'fastpeoplesearch');assert.equal(result.stage,'continuation');
    assert.equal(windowCount(f),0);assert.equal(navigationCount(f),1);
  }
});

test('missing session storage or proof persistence never changes a prepared outcome or recreates a tab',async()=>{
  for(const options of [{noSession:true},{rejectProof:true}]){
    const f=await ready(options);assert.equal(f.records['continuation:'+operationId].result.status,'prepared');
    assert.equal((await Background.dispatch(focus(),sender,f.api)).status,'unavailable');
    assert.equal(navigationCount(f),1);assert.equal(activationCount(f),0);
  }
});

test('a new document, blocked result or unproven initial navigation cannot mint a focus proof',async()=>{
  for(const options of [{responseDocumentId:'different-document'},{afterForm(){this.documentId='after-navigation';}},{formResult:{status:'blocked'}}]){
    const f=fixture(options);await Background.dispatch(original,sender,f.api);
    assert.equal(f.sessionRecords['focus:operation:'+operationId],undefined);
    assert.equal((await Background.dispatch(focus('operation'),sender,f.api)).status,'unavailable');
    assert.equal(navigationCount(f),1);assert.equal(activationCount(f),0);
  }
});

test('the bridge exposes only the explicit existing-form action without new permissions',()=>{
  const fs=require('node:fs'),path=require('node:path');
  assert.ok(fs.readFileSync(path.join(__dirname,'../extension/bridge.js'),'utf8').includes("'focus-existing'"));
  const manifest=require('../extension/manifest.json');assert.equal(manifest.permissions.includes('tabs'),false);assert.equal(manifest.permissions.includes('alarms'),false);
});
