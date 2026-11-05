/* Explicit operations and explicit, bounded reconciliation. No scheduled work. */
if(typeof importScripts==='function')importScripts('broker-executor.js');
const APP='https://erase-me-preview.vercel.app';
const EXEC=typeof EraseBrokerExecutor!=='undefined'?EraseBrokerExecutor:require('./broker-executor.js');
const active=new Set(),sessions=new WeakMap(),observationKeys=new WeakMap();
const OBSERVABLE=new Set(['peopledatalabs-form','usphonebook']);
function trusted(sender){try{const u=new URL(sender.url);return u.origin===APP&&u.protocol==='https:'&&!!sender.tab;}catch(_){return false;}}
function id(value){return typeof value==='string'&&/^[a-f0-9-]{32,40}$/.test(value);}
async function settled(chromeApi,tabId){
  if((await chromeApi.tabs.get(tabId)).status==='complete')return;
  await new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timeout);chromeApi.tabs.onUpdated.removeListener(listener);error?reject(error):resolve();};
    const listener=(changed,info)=>{if(changed===tabId&&info.status==='complete')finish();};
    const timeout=setTimeout(()=>finish(new Error('The broker page did not finish loading.')),25000);
    chromeApi.tabs.onUpdated.addListener(listener);
    chromeApi.tabs.get(tabId).then(tab=>{if(tab.status==='complete')finish();},finish);
  });
}
async function browserSession(chromeApi,create=false){
  try{
    if(!chromeApi.storage.session)return null;
    const key='erase-browser-session',existing=(await chromeApi.storage.session.get(key))[key];
    if(typeof existing==='string'&&/^[a-f0-9-]{36}$/.test(existing))return existing;
    if(!create)return null;
    if(!sessions.has(chromeApi))sessions.set(chromeApi,(async()=>{
      const token=crypto.randomUUID();await chromeApi.storage.session.set({[key]:token});return token;
    })());
    try{return await sessions.get(chromeApi);}finally{sessions.delete(chromeApi);}
  }catch(_){return null;}
}
function unknown(detail='The broker outcome cannot be verified. Check its existing tab; no action was repeated.'){
  return {status:'unknown',detail};
}
function evidenceResult(result){
  return !!result&&result.status==='verification_sent'&&result.route_verified===true&&result.evidence==='fresh_visible_success';
}
async function observationKey(chromeApi,session,create=false){
  try{
    const key='erase-observation-key',saved=(await chromeApi.storage.session.get(key))[key];
    const valid=value=>value?.session===session&&Array.isArray(value.bytes)&&value.bytes.length===32&&value.bytes.every(n=>Number.isInteger(n)&&n>=0&&n<=255);
    if(valid(saved))return Uint8Array.from(saved.bytes);
    if(!create)return null;
    if(!observationKeys.has(chromeApi))observationKeys.set(chromeApi,(async()=>{
      const bytes=crypto.getRandomValues(new Uint8Array(32));
      await chromeApi.storage.session.set({[key]:{session,bytes:[...bytes]}});return bytes;
    })());
    try{return await observationKeys.get(chromeApi);}finally{observationKeys.delete(chromeApi);}
  }catch(_){return null;}
}
async function acknowledgmentDigest(key,value){
  if(!key||typeof value?.name!=='string'||typeof value.email!=='string'||value.name.length>254||value.email.length>254||
    /[\r\n\x00<>]/.test(value.name+value.email)||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email))return null;
  const input=JSON.stringify([value.name.trim().replace(/\s+/g,' ').normalize('NFC'),value.email.trim().normalize('NFC')]);
  const imported=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',imported,new TextEncoder().encode(input));
  return [...new Uint8Array(signature)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function captureIntent(message,sender,chromeApi=chrome){
  if(!message||!sender||message.type!=='erase-broker-submit-intent'||!id(message.operationId)||!OBSERVABLE.has(message.routeId)||
    typeof message.fieldsMatch!=='boolean'||!/^[a-f0-9]{32}$/.test(message.nonce||'')||
    !Number.isSafeInteger(message.submittedAt)||message.submittedAt>Date.now()+1000||message.submittedAt<Date.now()-30000||
    Object.keys(message).some(k=>!['type','routeId','operationId','nonce','fieldsMatch','submittedAt'].includes(k)))throw new Error('Invalid observation proof.');
  const route=EXEC.ROUTES[message.routeId],key='operation:'+message.operationId,proofKey='observation:'+message.operationId;
  const record=(await chromeApi.storage.local.get(key))[key],session=await browserSession(chromeApi);
  const proof=chromeApi.storage.session&&(await chromeApi.storage.session.get(proofKey))[proofKey];
  if(!session||!record||record.routeId!==message.routeId||record.tabId!==sender.tab?.id||sender.frameId!==0||
    !chromeApi.runtime?.id||sender.id!==chromeApi.runtime.id||!EXEC.allowed(sender.url,route)||
    !proof||proof.nonce!==message.nonce||proof.session!==session||proof.tabId!==record.tabId||
    typeof proof.documentId!=='string'||proof.documentId!==sender.documentId)throw new Error('Untrusted observation proof.');
  // This is local evidence of an actual form event, not a browser action or a request.
  proof.intent={documentId:sender.documentId,fieldsMatch:message.fieldsMatch,submittedAt:message.submittedAt};
  await chromeApi.storage.session.set({[proofKey]:proof});
  return {recorded:true};
}
async function observe(message,record,key,chromeApi){
  if(message.authorized!==true||!record||record.routeId!==message.routeId)return unknown('Authorize observation of an existing operation first.');
  if(!OBSERVABLE.has(message.routeId))return unknown('This broker has no reviewed success contract. Review its existing tab; no fields or requests were sent.');
  if(active.has(key))return unknown('The original operation is still running. No observation or repeat was started.');
  active.add(key);
  try{
    const route=EXEC.ROUTES[message.routeId],session=await browserSession(chromeApi);
    const proofKey='observation:'+message.operationId,proof=chromeApi.storage.session&&(await chromeApi.storage.session.get(proofKey))[proofKey];
    if(!session||!proof||proof.session!==session||proof.tabId!==record.tabId||!record.baseline?.formPresent||record.baseline.success!==false||
      !proof.intent?.fieldsMatch||proof.intent.documentId!==proof.documentId||!Number.isInteger(record.tabId))return unknown('No current-session submission proof is available. Check the existing broker tab; no repeat was sent.');
    if(!await chromeApi.permissions.contains({origins:['https://'+route.host+'/*']}))return unknown('Broker access is unavailable. No observation was performed.');
    const tab=await chromeApi.tabs.get(record.tabId);
    if(tab.id!==record.tabId||tab.status!=='complete'||!EXEC.allowed(tab.url,route))return unknown('The owned broker tab changed or closed. No other tab was read.');
    const [installed]=await chromeApi.scripting.executeScript({target:{tabId:record.tabId},files:['broker-executor.js']});
    if(typeof installed?.documentId!=='string')return unknown();
    const [response]=await chromeApi.scripting.executeScript({target:{tabId:record.tabId,documentIds:[installed.documentId]},
      func:payload=>globalThis.EraseBrokerExecutor.inspect(payload),args:[{routeId:message.routeId}]});
    const facts=response?.result;
    if(response?.documentId!==installed.documentId||facts?.safe!==true||facts.success!==true||facts.observable!==true)return unknown();
    if(message.routeId==='usphonebook'){
      const navigation=facts.navigation;
      if(facts.formPresent!==false||installed.documentId===proof.documentId||navigation?.type!=='navigate'||navigation.fromInitial!==true||
        !Number.isFinite(navigation.startedAt)||navigation.startedAt<proof.intent.submittedAt||navigation.startedAt>proof.intent.submittedAt+30000||
        (proof.observedDocumentId&&proof.observedDocumentId!==installed.documentId))return unknown();
      const keyBytes=await observationKey(chromeApi,session);
      const digest=await acknowledgmentDigest(keyBytes,facts.acknowledgment);
      if(!digest||digest!==proof.expectedAcknowledgment)return unknown('The broker acknowledgment does not match the authorized person and email. No result was promoted.');
      // Pin the first correlated acknowledgment document. Later pages cannot reuse its intent.
      proof.observedDocumentId=installed.documentId;await chromeApi.storage.session.set({[proofKey]:proof});
    }
    if(message.routeId==='peopledatalabs-form'&&installed.documentId!==proof.documentId)return unknown();
    const result={status:'verification_sent',observation_verified:true,route_verified:true,evidence:'fresh_visible_success',
      detail:'The owned broker tab reports sending a verification email after the authorized form event. This does not establish an accepted removal request or deletion.'};
    record.result=result;await chromeApi.storage.local.set({[key]:record});return result;
  }catch(_){return unknown();}finally{active.delete(key);}
}
async function dispatch(message,sender,chromeApi=chrome){
  if(!trusted(sender)||!message||message.type!=='erase-me')throw new Error('Untrusted request.');
  if(message.action==='ping'){
    const routes=[];
    for(const [routeId,route] of Object.entries(EXEC.ROUTES))if(await chromeApi.permissions.contains({origins:['https://'+route.host+'/*']}))routes.push(routeId);
    return {status:'connected',version:'0.3.0',routes,capabilities:['usphonebook-continuation-v1','explicit-fields-v1','broker-observation-v1']};
  }
  if(!id(message.operationId)||!EXEC.ROUTES[message.routeId])throw new Error('Unsupported operation.');
  const continuation=['continue','continuation-result'].includes(message.action),key=(continuation?'continuation:':'operation:')+message.operationId;
  const previous=(await chromeApi.storage.local.get(key))[key];
  if(['result','continuation-result'].includes(message.action))return previous?.routeId===message.routeId?previous.result:unknown('No companion result is stored.');
  if(message.action==='observe')return observe(message,previous,key,chromeApi);
  if(!['run','continue'].includes(message.action)||message.authorized!==true)throw new Error('Authorize this action first.');
  if(previous||active.has(key))return previous?.routeId===message.routeId?previous.result:unknown('An operation with this reference already started. No repeat was sent.');
  const route=continuation?EXEC.validateContinuation(message):EXEC.validate(message.routeId,message.fields,message);
  active.add(key);
  const record={routeId:message.routeId,...(continuation?{requestId:message.requestId,receiptRef:message.receiptRef}:{}),result:unknown('Operation started. Review the broker tab if this browser was interrupted.')};
  try{
    if(!await chromeApi.permissions.contains({origins:['https://'+route.host+'/*']}))throw new Error('Open the companion icon and enable access to the reviewed broker sites.');
    // Save before navigation. No profile fields or verification URLs enter this journal.
    await chromeApi.storage.local.set({[key]:record});
    const tab=await chromeApi.tabs.create({url:route.url,active:true});
    record.tabId=tab.id;await chromeApi.storage.local.set({[key]:record});
    await settled(chromeApi,tab.id);
    const [installed]=await chromeApi.scripting.executeScript({target:{tabId:tab.id},files:['broker-executor.js']});
    let observationNonce;
    if(!continuation&&OBSERVABLE.has(message.routeId)&&typeof installed?.documentId==='string'){
      const [baseline]=await chromeApi.scripting.executeScript({target:{tabId:tab.id,documentIds:[installed.documentId]},
        func:payload=>globalThis.EraseBrokerExecutor.inspect(payload),args:[{routeId:message.routeId}]});
      const facts=baseline?.result;
      if(baseline.documentId===installed.documentId&&facts?.safe===true&&facts.formPresent===true&&facts.success===false&&facts.observable===true){
        record.baseline={formPresent:true,success:false};await chromeApi.storage.local.set({[key]:record});
        const session=await browserSession(chromeApi,true);
        if(session){
          observationNonce=crypto.randomUUID().replaceAll('-','');
          const proof={session,nonce:observationNonce,documentId:installed.documentId,tabId:tab.id};
          if(message.routeId==='usphonebook'){
            const keyBytes=await observationKey(chromeApi,session,true);
            proof.expectedAcknowledgment=await acknowledgmentDigest(keyBytes,{name:message.fields.first_name+' '+message.fields.last_name,email:message.fields.email});
          }
          await chromeApi.storage.session.set({['observation:'+message.operationId]:proof});
        }
      }
    }
    const payload=continuation?{routeId:message.routeId,operationId:message.operationId,requestId:message.requestId,receiptRef:message.receiptRef,
      confirmationUrl:message.confirmationUrl,contactEmail:message.contactEmail,fields:message.fields,authorized:message.authorized}:
      {routeId:message.routeId,operationId:message.operationId,observationNonce,fields:message.fields,businessEmailConfirmed:message.businessEmailConfirmed,listingConfirmed:message.listingConfirmed};
    const [response]=await chromeApi.scripting.executeScript({target:{tabId:tab.id,...(typeof installed?.documentId==='string'?{documentIds:[installed.documentId]}:{})},
      func:(payload,continueForm)=>continueForm?globalThis.EraseBrokerExecutor.executeContinuation(payload):globalThis.EraseBrokerExecutor.execute(payload),args:[payload,continuation]});
    const result=response?.result;
    if(!result||!(continuation?['prepared','blocked','unknown']:['prepared','verification_sent','blocked','unknown']).includes(result.status))throw new Error('The form result could not be verified.');
    record.result={status:result.status,detail:String(result.detail||'').slice(0,600)};
    if(evidenceResult(result))Object.assign(record.result,{route_verified:true,evidence:'fresh_visible_success'});
    await chromeApi.storage.local.set({[key]:record});return record.result;
  }catch(_){return record.result;}finally{active.delete(key);}
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage)chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  const work=message?.type==='erase-broker-submit-intent'?captureIntent(message,sender):dispatch(message,sender);
  work.then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));return true;
});
if(typeof module!=='undefined')module.exports={trusted,dispatch,settled,captureIntent};
