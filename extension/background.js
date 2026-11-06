/* Explicit operations and explicit, bounded reconciliation. No scheduled work. */
if(typeof importScripts==='function')importScripts('broker-executor.js','automatic-executor.js','identity-details.js','final-executor.js','peopletrace-details.js');
const APP='https://erase-me-preview.vercel.app';
const EXEC=typeof EraseBrokerExecutor!=='undefined'?EraseBrokerExecutor:require('./broker-executor.js');
const AUTO=typeof EraseAutomaticExecutor!=='undefined'?EraseAutomaticExecutor:require('./automatic-executor.js');
const FINAL=typeof EraseFinalExecutor!=='undefined'?EraseFinalExecutor:require('./final-executor.js');
const IDENTITY=typeof EraseIdentityDetails!=='undefined'?EraseIdentityDetails:require('./identity-details.js');
const PEOPLETRACE=typeof ErasePeopleTraceDetails!=='undefined'?ErasePeopleTraceDetails:require('./peopletrace-details.js');
const NATIVE_HOST='org.eraseme.challenge';
const MAIL_NATIVE_HOST='org.eraseme.mail';
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
async function localHelper(chromeApi,body){
  if(!await chromeApi.permissions.contains({permissions:['nativeMessaging']}))throw new Error('Local helper access is not enabled.');
  return chromeApi.runtime.sendNativeMessage(NATIVE_HOST,body);
}
async function helperStatus(chromeApi){
  try{
    const reply=await localHelper(chromeApi,{action:'capabilities'});
    if(reply?.ok!==true||typeof reply.capabilities?.image!=='boolean'||typeof reply.capabilities?.audio!=='boolean')throw new Error();
    return {available:true,image:reply.capabilities.image,audio:reply.capabilities.audio};
  }catch(_){return {available:false,image:false,audio:false};}
}
function exactMailObject(value,keys){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}
async function localMail(message,chromeApi){
  if(!exactMailObject(message,['type','action','request']))throw new Error('Choose a supported local removal-mail action.');
  const request=message.request,base=['action','workspace_id','personal_email_sha256'];
  const fields={status:['authorized'],session:['route_id','operation_id','authorized'],check:['capability','explicit'],continue:['capability','receipt_ref','explicit'],revoke:['capability','explicit']};
  if(!request||typeof request.action!=='string'||!Object.hasOwn(fields,request.action)||!exactMailObject(request,[...base,...fields[request.action]])||!id(request.workspace_id)||
    typeof request.personal_email_sha256!=='string'||!/^[a-f0-9]{64}$/.test(request.personal_email_sha256)||JSON.stringify(request).length>8192||
    (['status','session'].includes(request.action)?request.authorized!==true:request.explicit!==true)||
    (request.action==='session'&&(!['fastpeoplesearch','usphonebook','searchpeoplefree'].includes(request.route_id)||!id(request.operation_id)))||
    (['check','continue','revoke'].includes(request.action)&&(typeof request.capability!=='string'||!(/^[A-Za-z0-9_-]{1,1800}\.[A-Za-z0-9_-]{43}$/.test(request.capability))))||
    (request.action==='continue'&&(typeof request.receipt_ref!=='string'||!/^[a-f0-9]{64}$/.test(request.receipt_ref))))throw new Error('Choose a supported local removal-mail action.');
  if(!await chromeApi.permissions.contains({permissions:['nativeMessaging']}))throw new Error('Enable local connector access in the companion toolbar, then install the removal-mail host.');
  let reply;
  try{reply=await chromeApi.runtime.sendNativeMessage(MAIL_NATIVE_HOST,request);}catch(_){throw new Error('The local removal-mail connector is unavailable. Complete its private setup first.');}
  if(!reply||reply.ok!==true||!exactMailObject(reply,['ok','result'])||JSON.stringify(reply).length>8192)throw new Error('The local removal-mail action could not be completed. Check its private setup or current request state.');
  const value=reply.result,scope=['request_id','route_id','operation_id','automatic_execution'];
  if(request.action==='status'){
    const keys=['configured','enabled','provider','on_demand','access','authorization_required','automatic_execution','routes',...(Object.hasOwn(value||{},'contact_email')?['contact_email']:[])];
    if(!exactMailObject(value,keys)||typeof value.configured!=='boolean'||typeof value.enabled!=='boolean'||value.enabled&&!value.configured||value.provider!=='gmail'||value.access!=='local_native'||value.on_demand!==true||value.authorization_required!==true||value.automatic_execution!==false||
      !Array.isArray(value.routes)||value.routes.length!==3||new Set(value.routes).size!==3||value.routes.some(route=>!['usphonebook','fastpeoplesearch','searchpeoplefree'].includes(route))||
      (value.enabled&&(!Object.hasOwn(value,'contact_email')||typeof value.contact_email!=='string'))||
      (Object.hasOwn(value,'contact_email')&&(!value.enabled||typeof value.contact_email!=='string'||value.contact_email.length>254||!/^[a-z0-9._-]{1,25}@(?:gmail\.com|googlemail\.com)$/.test(value.contact_email))))throw new Error('The local removal-mail connector returned an invalid status.');
    return value;
  }
  const keys=request.action==='session'?['status','capability',...scope,'contact_email','expires_at']:request.action==='continue'?['status',...scope,'receipt_ref','confirmation_url']:request.action==='revoke'?['status',...scope]:['status',...scope,...(value?.status==='held'?['reason','received_at','authenticated','receipt_ref','continuation_available']:[])];
  if(!exactMailObject(value,keys)||!['usphonebook','fastpeoplesearch','searchpeoplefree'].includes(value.route_id)||!id(value.operation_id)||typeof value.request_id!=='string'||!/^[a-f0-9]{32}$/.test(value.request_id)||value.automatic_execution!==false)throw new Error('The local removal-mail connector returned an invalid result.');
  if(request.action==='session'&&(value.status!=='ready'||value.route_id!==request.route_id||value.operation_id!==request.operation_id||!(/^[A-Za-z0-9_-]{1,1800}\.[A-Za-z0-9_-]{43}$/.test(value.capability||''))||typeof value.contact_email!=='string'||value.contact_email.length>254||!Number.isSafeInteger(value.expires_at)))throw new Error('The local removal contact could not be validated.');
  if(request.action==='check'&&(!['pending','held'].includes(value.status)||value.status==='held'&&(value.authenticated!==true||!['route_validation_required','confirmation_link_unvalidated'].includes(value.reason)||!Number.isSafeInteger(value.received_at)||!/^[a-f0-9]{64}$/.test(value.receipt_ref||'')||typeof value.continuation_available!=='boolean'||value.route_id==='searchpeoplefree'&&value.continuation_available)))throw new Error('The local removal receipt could not be validated.');
  if(request.action==='continue'&&(value.status!=='confirmation_ready'||value.receipt_ref!==request.receipt_ref||!EXEC.continuationURL(value.confirmation_url,value.route_id)))throw new Error('The local broker confirmation could not be validated.');
  if(request.action==='revoke'&&value.status!=='revoked')throw new Error('The local mail grant revocation could not be confirmed.');
  return value;
}
async function automaticSubmit(payload,tabId,documentId,chromeApi){
  if(typeof documentId!=='string')return unknown('The broker document cannot be pinned for automatic submission. No submit was attempted.');
  const target={tabId,documentIds:[documentId]};
  const [installed]=await chromeApi.scripting.executeScript({target,files:['automatic-executor.js']});
  if(installed?.documentId!==documentId)return unknown('The broker tab changed before submission. No repeat was sent.');
  if(['fastpeoplesearch','searchpeoplefree','usphonebook'].includes(payload.routeId)){
    const [readiness]=await chromeApi.scripting.executeScript({target,func:value=>globalThis.EraseAutomaticExecutor.waitReady(value),args:[payload]});
    if(readiness?.documentId!==documentId)return unknown('The broker document changed while its security widget was loading. No submit was attempted.');
    if(readiness.result?.status==='blocked')return {status:'blocked',detail:String(readiness.result.detail||'The broker security check still needs attention.').slice(0,600)};
    if(readiness.result?.status!=='ready')return unknown('The broker security response could not be validated. No submit was attempted.');
  }
  const [capture]=await chromeApi.scripting.executeScript({target,func:value=>globalThis.EraseAutomaticExecutor.capture(value),args:[payload]});
  if(capture?.documentId!==documentId)return unknown();
  const challenge=capture.result;
  if(challenge?.status==='blocked')return {status:'blocked',detail:String(challenge.detail||'The reviewed submission needs attention.').slice(0,600)};
  let extra={};
  if(challenge?.status==='image'){
    if(typeof challenge.media!=='string'||challenge.media.length>699052||typeof challenge.challengeRef!=='string')return unknown('The challenge could not be validated. No submit was attempted.');
    let recognized;
    try{recognized=await localHelper(chromeApi,{action:'recognize_image',media:challenge.media,alphabet:challenge.alphabet||''});}
    catch(_){return {status:'blocked',detail:'Install and enable the free local challenge helper with Tesseract to recognize this text challenge. No submit was attempted.'};}
    if(recognized?.ok!==true||typeof recognized.answer!=='string'||!/^[A-Za-z0-9]{5}$/.test(recognized.answer))return {status:'blocked',detail:'The local recognizer did not return a valid challenge answer. No submit was attempted.'};
    extra={answer:recognized.answer,challengeRef:challenge.challengeRef};
  }else if(challenge?.status!=='ready')return unknown('The reviewed submit controls could not be validated. No submit was attempted.');
  const [submitted]=await chromeApi.scripting.executeScript({target,func:value=>globalThis.EraseAutomaticExecutor.submit(value),args:[{...payload,...extra}]});
  if(submitted?.documentId!==documentId)return unknown('The broker navigated after the submit attempt. Check its existing tab; no repeat will be sent.');
  return submitted.result;
}
async function matchRecord(message,chromeApi){
  if(message.routeId!=='spokeo'||message.authorized!==true||!EXEC.listingURL(message.listingUrl)||!message.identity||
    Object.keys(message.identity).some(key=>!['name','email','age','city'].includes(key))||typeof message.identity.name!=='string'||message.identity.name.length>120||
    typeof message.identity.email!=='string'||message.identity.email.length>254||!Number.isInteger(message.identity.age)||message.identity.age<18||message.identity.age>120||
    !(message.identity.city===null||typeof message.identity.city==='string'&&message.identity.city.length<=120))throw new Error('Authorize a supported own-record match first.');
  const key='match:'+message.operationId;
  const previous=(await chromeApi.storage.local.get(key))[key];
  if(active.has(key)||previous)return unknown('This record check already started. No additional listing page was opened.');
  active.add(key);
  try{
    if(!await chromeApi.permissions.contains({origins:['https://www.spokeo.com/*']}))throw new Error();
    const record={routeId:message.routeId,result:unknown('Record check started. Its result is not established.')};
    await chromeApi.storage.local.set({[key]:record});
    const tab=await chromeApi.tabs.create({url:message.listingUrl,active:true});record.tabId=tab.id;await chromeApi.storage.local.set({[key]:record});await settled(chromeApi,tab.id);
    const current=await chromeApi.tabs.get(tab.id);if(current.url!==message.listingUrl)throw new Error();
    const [installed]=await chromeApi.scripting.executeScript({target:{tabId:tab.id},files:['record-matcher.js']});
    if(typeof installed?.documentId!=='string')throw new Error();
    const [response]=await chromeApi.scripting.executeScript({target:{tabId:tab.id,documentIds:[installed.documentId]},
      func:(identity,url)=>globalThis.EraseRecordMatcher.matchPage(identity,document,url),args:[message.identity,message.listingUrl]});
    const result=response?.result;
    if(response?.documentId!==installed.documentId||!['matched','not_matched','ambiguous','needs_identity','unsupported'].includes(result?.status)||
      !Array.isArray(result.evidence)||result.evidence.some(key=>!['structured_person','exact_candidate_url','name','email','phone','age','city','identity'].includes(key))||
      result.status==='matched'&&(result.candidateUrl!==message.listingUrl||!['structured_person','exact_candidate_url','name','email'].every(key=>result.evidence.includes(key))))throw new Error();
    record.result={status:result.status,evidence:result.evidence};await chromeApi.storage.local.set({[key]:record});
    return {...result,match_verified:true,source:'structured_person_v1'};
  }catch(_){return unknown('The approved listing could not be matched reliably. No removal action was started.');}
  finally{active.delete(key);}
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
function focusUnavailable(message){
  return {status:'unavailable',routeId:message.routeId,stage:message.stage,detail:'The original form could not be verified. Find its existing Chrome tab manually. No form or request was reopened.'};
}
function focusRecordMatches(record,message){
  return record?.routeId===message.routeId&&Number.isInteger(record.tabId)&&
    (message.stage!=='continuation'||record.requestId===message.requestId&&record.receiptRef===message.receiptRef)&&
    (record.result?.status==='prepared'||evidenceResult(record.result));
}
function focusPurpose(url,routeId,stage){
  return stage==='continuation'?EXEC.continuationURL(url,routeId):EXEC.allowed(url,EXEC.ROUTES[routeId]);
}
async function focusDigest(key,url){
  if(!key||typeof url!=='string'||!url||url.length>4096||/[\x00-\x1f\x7f]/.test(url))return null;
  const imported=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',imported,new TextEncoder().encode(JSON.stringify(['focus-url-v1',url])));
  return [...new Uint8Array(signature)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function sameFocusDocument(chromeApi,tabId,documentId,url){
  const [response]=await chromeApi.scripting.executeScript({target:{tabId,documentIds:[documentId]},
    func:expected=>location.href===expected,args:[url]});
  return response?.documentId===documentId&&response.result===true;
}
async function rememberFocus(message,stage,record,documentId,chromeApi){
  // Optional convenience proof. Failure never changes the completed form outcome.
  try{
    const reference={...message,stage},journalKey=stage+':'+message.operationId;
    if(typeof documentId!=='string'||!documentId||!focusRecordMatches(record,reference)||!chromeApi.storage.session)return;
    const session=await browserSession(chromeApi,true),key=await observationKey(chromeApi,session,true);
    if(!session||!key||!await chromeApi.permissions.contains({origins:['https://'+EXEC.ROUTES[message.routeId].host+'/*']}))return;
    const tab=await chromeApi.tabs.get(record.tabId);
    if(tab.id!==record.tabId||tab.status!=='complete'||!focusPurpose(tab.url,message.routeId,stage)||
      stage==='continuation'&&tab.url!==message.confirmationUrl||
      !await sameFocusDocument(chromeApi,record.tabId,documentId,tab.url))return;
    const digest=await focusDigest(key,tab.url);
    const current=(await chromeApi.storage.local.get(journalKey))[journalKey];
    if(!digest||!focusRecordMatches(current,reference)||current.tabId!==record.tabId||await browserSession(chromeApi)!==session)return;
    const proof={session,routeId:message.routeId,operationId:message.operationId,stage,tabId:record.tabId,documentId,urlHmac:digest,
      ...(stage==='continuation'?{requestId:message.requestId,receiptRef:message.receiptRef}:{})};
    await chromeApi.storage.session.set({['focus:'+stage+':'+message.operationId]:proof});
  }catch(_){/* An unproven tab stays unavailable; no action is repeated. */}
}
async function focusExisting(message,chromeApi){
  const keys=['type','action','routeId','operationId','stage','authorized',...(message.stage==='continuation'?['requestId','receiptRef']:[])];
  if(message.authorized!==true||!['operation','continuation'].includes(message.stage)||
    Object.keys(message).length!==keys.length||!keys.every(key=>Object.hasOwn(message,key))||
    message.stage==='continuation'&&(!['usphonebook','fastpeoplesearch'].includes(message.routeId)||
      !/^[a-f0-9]{32}$/.test(message.requestId||'')||!/^[a-f0-9]{64}$/.test(message.receiptRef||'')))throw new Error('Authorize an existing broker form first.');
  const journalKey=message.stage+':'+message.operationId,proofKey='focus:'+message.stage+':'+message.operationId;
  if(active.has(journalKey)||active.has(proofKey))return focusUnavailable(message);
  active.add(proofKey);
  try{
    const record=(await chromeApi.storage.local.get(journalKey))[journalKey],session=await browserSession(chromeApi);
    const proof=chromeApi.storage.session&&(await chromeApi.storage.session.get(proofKey))[proofKey];
    if(!focusRecordMatches(record,message)||!session||!proof||proof.session!==session||proof.routeId!==message.routeId||
      proof.operationId!==message.operationId||proof.stage!==message.stage||proof.tabId!==record.tabId||
      typeof proof.documentId!=='string'||!proof.documentId||!/^[a-f0-9]{64}$/.test(proof.urlHmac||'')||
      message.stage==='continuation'&&(proof.requestId!==message.requestId||proof.receiptRef!==message.receiptRef))return focusUnavailable(message);
    const key=await observationKey(chromeApi,session),permission={origins:['https://'+EXEC.ROUTES[message.routeId].host+'/*']};
    if(!key||!await chromeApi.permissions.contains(permission))return focusUnavailable(message);
    const tab=await chromeApi.tabs.get(record.tabId);
    if(tab.id!==record.tabId||tab.status!=='complete'||!Number.isInteger(tab.windowId)||!focusPurpose(tab.url,message.routeId,message.stage)||
      await focusDigest(key,tab.url)!==proof.urlHmac||!await sameFocusDocument(chromeApi,record.tabId,proof.documentId,tab.url))return focusUnavailable(message);
    // Reread references and permission after the document check. A removed or
    // changed proof cannot authorize activation from stale page state.
    const stillAuthorized=async()=>{
      const current=(await chromeApi.storage.local.get(journalKey))[journalKey],fresh=(await chromeApi.storage.session.get(proofKey))[proofKey];
      return focusRecordMatches(current,message)&&current.tabId===record.tabId&&JSON.stringify(fresh)===JSON.stringify(proof)&&
        await browserSession(chromeApi)===session&&await chromeApi.permissions.contains(permission);
    };
    if(!await stillAuthorized())return focusUnavailable(message);
    const before=await chromeApi.tabs.get(record.tabId);
    if(before.id!==record.tabId||before.status!=='complete'||before.url!==tab.url||
      !await sameFocusDocument(chromeApi,record.tabId,proof.documentId,tab.url))return focusUnavailable(message);
    const activated=await chromeApi.tabs.update(record.tabId,{active:true});
    if(activated?.id!==record.tabId||activated.url!==tab.url||!Number.isInteger(activated.windowId)||
      !await sameFocusDocument(chromeApi,record.tabId,proof.documentId,tab.url)||!await stillAuthorized())return focusUnavailable(message);
    await chromeApi.windows.update(activated.windowId,{focused:true});
    return {status:'focused',routeId:message.routeId,stage:message.stage,detail:'The existing broker form is open. Complete the requested information there.'};
  }catch(_){return focusUnavailable(message);}finally{active.delete(proofKey);}
}
async function ownedFinalContext(reference,chromeApi,fields){
  const journalKey='continuation:'+reference.operationId,proofKey='focus:continuation:'+reference.operationId;
  const record=(await chromeApi.storage.local.get(journalKey))[journalKey],session=await browserSession(chromeApi);
  const proof=chromeApi.storage.session&&(await chromeApi.storage.session.get(proofKey))[proofKey];
  if(!focusRecordMatches(record,reference)||!session||!proof||proof.session!==session||proof.routeId!==reference.routeId||
    proof.operationId!==reference.operationId||proof.stage!=='continuation'||proof.tabId!==record.tabId||proof.requestId!==reference.requestId||proof.receiptRef!==reference.receiptRef||
    typeof proof.documentId!=='string'||!proof.documentId||!/^[a-f0-9]{64}$/.test(proof.urlHmac||''))return null;
  const permission={origins:['https://www.fastpeoplesearch.com/*']},tab=await chromeApi.tabs.get(record.tabId);
  const stillAuthorized=async()=>{
    const current=(await chromeApi.storage.local.get(journalKey))[journalKey],fresh=(await chromeApi.storage.session.get(proofKey))[proofKey];
    if(!focusRecordMatches(current,reference)||current.tabId!==record.tabId||JSON.stringify(fresh)!==JSON.stringify(proof)||
      await browserSession(chromeApi)!==session||!await chromeApi.permissions.contains(permission))return false;
    const key=await observationKey(chromeApi,session),currentTab=await chromeApi.tabs.get(record.tabId);
    return !!key&&currentTab.id===record.tabId&&currentTab.status==='complete'&&currentTab.url===tab.url&&
      EXEC.continuationURL(currentTab.url,reference.routeId,fields)&&await focusDigest(key,currentTab.url)===proof.urlHmac&&
      await sameFocusDocument(chromeApi,record.tabId,proof.documentId,currentTab.url);
  };
  if(!await stillAuthorized())return null;
  return {record,proof,tab,stillAuthorized,target:{tabId:record.tabId,documentIds:[proof.documentId]}};
}
function requirementsUnavailable(message){return{status:'unavailable',routeId:message.routeId,operationId:message.operationId,detail:'The original matching form or its requirements could not be verified. Review its existing tab; no new form or request was opened.'};}
async function identityRequirements(message,chromeApi){
  const keys=['type','action','routeId','operationId','requestId','receiptRef','authorized'];
  if(message.authorized!==true||message.routeId!=='fastpeoplesearch'||!/^[a-f0-9]{32}$/.test(message.requestId||'')||!/^[a-f0-9]{64}$/.test(message.receiptRef||'')||
    Object.keys(message).length!==keys.length||!keys.every(key=>Object.hasOwn(message,key)))throw new Error('Authorize reading the current matching-form requirements first.');
  const reference={routeId:message.routeId,operationId:message.operationId,requestId:message.requestId,receiptRef:message.receiptRef,stage:'continuation'};
  try{
    if(active.has('final-operation:'+message.operationId)||(await chromeApi.storage.local.get('final-operation:'+message.operationId))['final-operation:'+message.operationId])return requirementsUnavailable(message);
    const owned=await ownedFinalContext(reference,chromeApi);if(!owned)return requirementsUnavailable(message);
    const installed=await chromeApi.scripting.executeScript({target:owned.target,files:['broker-executor.js','identity-details.js','final-executor.js']});
    if(!Array.isArray(installed)||installed.length!==1||installed[0].documentId!==owned.proof.documentId||!await owned.stillAuthorized())return requirementsUnavailable(message);
    const [response]=await chromeApi.scripting.executeScript({target:owned.target,func:url=>globalThis.EraseFinalExecutor.describe(url),args:[owned.tab.url]});
    if(response?.documentId!==owned.proof.documentId||response.result?.status!=='ready'||Object.keys(response.result).length!==2||!await owned.stillAuthorized())return requirementsUnavailable(message);
    const requirements=IDENTITY.validateRequirements(response.result.requirements);
    if(active.has('final-operation:'+message.operationId)||(await chromeApi.storage.local.get('final-operation:'+message.operationId))['final-operation:'+message.operationId])return requirementsUnavailable(message);
    return {status:'ready',routeId:message.routeId,operationId:message.operationId,requirements};
  }catch(_){return requirementsUnavailable(message);}
}
async function submitDetails(message,chromeApi){
  const keys=['type','action','routeId','operationId','requestId','receiptRef','submissionId','authorized','consentId','fields','details','requirements'];
  if(Object.keys(message).length!==keys.length||!keys.every(key=>Object.hasOwn(message,key)))throw new Error('Review the exact final-form fields first.');
  // Clone before the first await. Details never enter either journal.
  const payload=JSON.parse(JSON.stringify(Object.fromEntries(keys.filter(key=>!['type','action'].includes(key)).map(key=>[key,message[key]]))));
  FINAL.validate(payload);
  const boundary='final-operation:'+payload.operationId,submission='final:'+payload.submissionId;
  if(active.has(boundary)||active.has(submission))return unknown('A final action for this request already started. No repeat was sent.');
  active.add(boundary);active.add(submission);
  let entry;
  try{
    const previous=(await chromeApi.storage.local.get(boundary))[boundary],saved=(await chromeApi.storage.local.get(submission))[submission];
    if(previous||saved){
      const same=previous?.routeId===payload.routeId&&previous.submissionId===payload.submissionId&&previous.requestId===payload.requestId&&previous.receiptRef===payload.receiptRef&&
        saved?.routeId===payload.routeId&&saved.operationId===payload.operationId&&saved.submissionId===payload.submissionId&&JSON.stringify(saved.result)===JSON.stringify(previous.result);
      return same?recordedFinalResult(previous.result):unknown('A final action for this original request already started. No repeat was sent.');
    }
    const reference={routeId:payload.routeId,operationId:payload.operationId,stage:'continuation',requestId:payload.requestId,receiptRef:payload.receiptRef};
    const owned=await ownedFinalContext(reference,chromeApi,payload.fields);
    if(!owned)return {status:'blocked',detail:'The original matching form changed or is unavailable. No personal fields were filled or request repeated.'};
    const {proof,tab,target,stillAuthorized}=owned;
    entry={routeId:payload.routeId,operationId:payload.operationId,requestId:payload.requestId,receiptRef:payload.receiptRef,submissionId:payload.submissionId,
      result:unknown('The final action started. Check its existing broker tab if interrupted; no repeat is allowed.')};
    // Both stable original-operation and fresh submission boundaries precede any
    // personal write. A different caller UUID cannot replay the original request.
    await chromeApi.storage.local.set({[boundary]:entry,[submission]:entry});
    if(!await stillAuthorized())return entry.result;
    const installed=await chromeApi.scripting.executeScript({target,files:['broker-executor.js','identity-details.js','final-executor.js']});
    if(!Array.isArray(installed)||installed.length!==1||installed[0].documentId!==proof.documentId||!await stillAuthorized())return entry.result;
    const [response]=await chromeApi.scripting.executeScript({target,
      func:(value,url)=>globalThis.EraseFinalExecutor.execute(value,url),args:[payload,tab.url]});
    if(response?.documentId!==proof.documentId)return entry.result;
    const result=response.result;
    if(!result||!['blocked','unknown','submission_attempted'].includes(result.status)||
      result.status==='submission_attempted'&&(result.attempt_verified!==true||result.stage!=='final_request_submission'))return entry.result;
    const completed={...entry,result:{status:result.status,detail:finalDetail(result.status),
      ...(result.status==='submission_attempted'?{attempt_verified:true,stage:'final_request_submission'}:{})}};
    await chromeApi.storage.local.set({[boundary]:completed,[submission]:completed});entry=completed;
    return entry.result;
  }catch(_){return entry?.result||unknown('The final action could not be verified. No request was repeated.');}
  finally{active.delete(boundary);active.delete(submission);}
}
function finalDetail(status){
  return status==='submission_attempted'?'A guarded final-form submit event was observed. Broker acceptance and deletion remain unverified.':
    status==='blocked'?'The final form needs review in its existing broker tab. No automatic repeat will be sent.':
      'The final action is unconfirmed. Check its existing broker tab; no automatic repeat will be sent.';
}
function recordedFinalResult(result){
  if(!result||!['blocked','unknown','submission_attempted'].includes(result.status)||
    result.status==='submission_attempted'&&(result.attempt_verified!==true||result.stage!=='final_request_submission'))return unknown('No verified final result is stored. No request was repeated.');
  return {status:result.status,detail:finalDetail(result.status),
    ...(result.status==='submission_attempted'?{attempt_verified:true,stage:'final_request_submission'}:{})};
}
async function identityResult(message,chromeApi){
  const keys=['type','action','routeId','operationId','submissionId','authorized'];
  if(message.authorized!==true||message.routeId!=='fastpeoplesearch'||!id(message.submissionId)||Object.keys(message).length!==keys.length||!keys.every(key=>Object.hasOwn(message,key)))
    throw new Error('Authorize reading the existing final action first.');
  const boundary=(await chromeApi.storage.local.get('final-operation:'+message.operationId))['final-operation:'+message.operationId];
  const saved=(await chromeApi.storage.local.get('final:'+message.submissionId))['final:'+message.submissionId];
  if(!boundary||!saved||boundary.routeId!==message.routeId||saved.routeId!==message.routeId||boundary.operationId!==message.operationId||saved.operationId!==message.operationId||
    boundary.submissionId!==message.submissionId||saved.submissionId!==message.submissionId||JSON.stringify(boundary.result)!==JSON.stringify(saved.result))return unknown('No matching final action is stored. No request was repeated.');
  return recordedFinalResult(saved.result);
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
async function fillPeopleTrace(message,chromeApi){
  if(!exactMailObject(message,['type','action','routeId','operationId','authorized','ownRequestConfirmed','consentId','identity','details']))throw new Error('Review the private form first.');
  const {type,action,...payload}=message;PEOPLETRACE.validatePayload(payload);
  const key='operation:'+message.operationId,previous=(await chromeApi.storage.local.get(key))[key];
  if(previous||active.has(key))return previous?.routeId===PEOPLETRACE.ROUTE?previous.result:unknown();
  active.add(key);const record={routeId:PEOPLETRACE.ROUTE,result:unknown('Private form action started. No automatic repeat is authorized.')};
  try{
    if(!await chromeApi.permissions.contains({origins:['https://'+PEOPLETRACE.HOST+'/*']}))throw new Error();
    await chromeApi.storage.local.set({[key]:record});
    const tab=await chromeApi.tabs.create({url:PEOPLETRACE.URL,active:true});record.tabId=tab.id;await chromeApi.storage.local.set({[key]:record});await settled(chromeApi,tab.id);
    if((await chromeApi.tabs.get(tab.id)).url!==PEOPLETRACE.URL)throw new Error();
    const [installed]=await chromeApi.scripting.executeScript({target:{tabId:tab.id},files:['peopletrace-details.js']});if(typeof installed?.documentId!=='string')throw new Error();
    const [response]=await chromeApi.scripting.executeScript({target:{tabId:tab.id,documentIds:[installed.documentId]},func:value=>globalThis.ErasePeopleTraceDetails.execute(value),args:[payload]});
    if(response?.documentId!==installed.documentId||!['prepared','blocked','unknown'].includes(response.result?.status))throw new Error();
    record.result={status:response.result.status,detail:response.result.status==='prepared'?'Reviewed People Trace UK fields were filled once. Complete its challenge and submission yourself. Acceptance and deletion remain unverified.':'The private form could not be safely filled. Check its existing tab; no automatic repeat is authorized.'};
    await chromeApi.storage.local.set({[key]:record});return record.result;
  }catch(_){return record.result;}finally{active.delete(key);}
}
async function dispatch(message,sender,chromeApi=chrome){
  if(!trusted(sender)||!message||message.type!=='erase-me')throw new Error('Untrusted request.');
  if(message.action==='ping'){
    const routes=[];
    for(const [routeId,route] of Object.entries(EXEC.ROUTES))if(await chromeApi.permissions.contains({origins:['https://'+route.host+'/*']}))routes.push(routeId);
    if(await chromeApi.permissions.contains({origins:['https://'+PEOPLETRACE.HOST+'/*']}))routes.push(PEOPLETRACE.ROUTE);
    return {status:'connected',version:'0.11.0',routes,capabilities:['peopletrace-prefill-v1','usphonebook-continuation-v1','fastpeoplesearch-continuation-v1','explicit-fields-v1','structured-fields-v1','broker-observation-v1','automatic-submit-v1','reviewed-initial-submit-v2','reviewed-initial-submit-v3','reviewed-initial-submit-v4','structured-record-match-v1','owned-tab-focus-v1','identity-submit-v1','identity-submit-v2','identity-requirements-v1','local-removal-mail-v1']};
  }
  if(message.action==='fill-peopletrace')return fillPeopleTrace(message,chromeApi);
  if(message.action==='result'&&message.routeId===PEOPLETRACE.ROUTE&&id(message.operationId)){const previous=(await chromeApi.storage.local.get('operation:'+message.operationId))['operation:'+message.operationId];return previous?.routeId===PEOPLETRACE.ROUTE?previous.result:unknown();}
  if(message.action==='helper-status')return helperStatus(chromeApi);
  if(message.action==='local-mail')return localMail(message,chromeApi);
  if(!id(message.operationId)||!EXEC.ROUTES[message.routeId])throw new Error('Unsupported operation.');
  if(message.action==='identity-requirements')return identityRequirements(message,chromeApi);
  if(message.action==='identity-result')return identityResult(message,chromeApi);
  if(message.action==='submit-details')return submitDetails(message,chromeApi);
  if(message.action==='focus-existing')return focusExisting(message,chromeApi);
  if(message.action==='match')return matchRecord(message,chromeApi);
  const continuation=['continue','continuation-result'].includes(message.action),key=(continuation?'continuation:':'operation:')+message.operationId;
  const previous=(await chromeApi.storage.local.get(key))[key];
  if(['result','continuation-result'].includes(message.action))return previous?.routeId===message.routeId?previous.result:unknown('No companion result is stored.');
  if(message.action==='observe')return observe(message,previous,key,chromeApi);
  if(!['run','continue'].includes(message.action)||message.authorized!==true)throw new Error('Authorize this action first.');
  if(previous||active.has(key))return previous?.routeId===message.routeId?previous.result:unknown('An operation with this reference already started. No repeat was sent.');
  const route=continuation?EXEC.validateContinuation(message):EXEC.validate(message.routeId,message.fields,message);
  if(message.autoSubmit!==undefined&&typeof message.autoSubmit!=='boolean')throw new Error('Invalid submission authorization.');
  if(message.autoSubmit===true&&(continuation||!AUTO.CONTRACTS[message.routeId]||message.consentId!==AUTO.CONTRACTS[message.routeId].id))throw new Error('Review this broker’s exact submission agreement first.');
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
    if(continuation&&typeof installed?.documentId!=='string')throw new Error('The confirmation document cannot be pinned.');
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
      {routeId:message.routeId,operationId:message.operationId,observationNonce,fields:message.fields,businessEmailConfirmed:message.businessEmailConfirmed,listingConfirmed:message.listingConfirmed,ownRequestConfirmed:message.ownRequestConfirmed};
    const [response]=await chromeApi.scripting.executeScript({target:{tabId:tab.id,...(typeof installed?.documentId==='string'?{documentIds:[installed.documentId]}:{})},
      func:(payload,continueForm)=>continueForm?globalThis.EraseBrokerExecutor.executeContinuation(payload):globalThis.EraseBrokerExecutor.execute(payload),args:[payload,continuation]});
    if(continuation&&response?.documentId!==installed.documentId)throw new Error('The confirmation document changed.');
    let result=response?.result;
    if(!continuation&&message.autoSubmit===true&&result?.status==='prepared'){
      if(response?.documentId!==installed?.documentId)throw new Error('The broker document changed before submission.');
      result=await automaticSubmit({...payload,authorized:true,autoSubmit:true,consentId:message.consentId},tab.id,installed.documentId,chromeApi);
    }
    if(!result||!(continuation?['prepared','blocked','unknown']:['prepared','verification_sent','submission_attempted','blocked','unknown']).includes(result.status))throw new Error('The form result could not be verified.');
    if(result.status==='submission_attempted'&&!(message.autoSubmit===true&&result.attempt_verified===true&&result.stage===AUTO.CONTRACTS[message.routeId]?.stage))throw new Error('The submit attempt could not be verified.');
    record.result={status:result.status,detail:String(result.detail||'').slice(0,600)};
    if(evidenceResult(result))Object.assign(record.result,{route_verified:true,evidence:'fresh_visible_success'});
    if(result.status==='submission_attempted')Object.assign(record.result,{attempt_verified:true,stage:result.stage});
    await chromeApi.storage.local.set({[key]:record});
    if(response?.documentId===installed?.documentId&&typeof installed?.documentId==='string'&&
      (record.result.status==='prepared'||evidenceResult(record.result)))
      await rememberFocus(message,continuation?'continuation':'operation',record,installed.documentId,chromeApi);
    return record.result;
  }catch(_){return record.result;}finally{active.delete(key);}
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage)chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  const work=message?.type==='erase-broker-submit-intent'?captureIntent(message,sender):dispatch(message,sender);
  work.then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));return true;
});
if(typeof module!=='undefined')module.exports={trusted,dispatch,settled,captureIntent};
