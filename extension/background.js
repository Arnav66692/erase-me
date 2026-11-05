/* A bounded operation starts only from an explicit workspace action. */
if(typeof importScripts==='function')importScripts('broker-executor.js');
const APP='https://erase-me-preview.vercel.app';
const EXEC=typeof EraseBrokerExecutor!=='undefined'?EraseBrokerExecutor:require('./broker-executor.js');
const active=new Set();
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
async function dispatch(message,sender,chromeApi=chrome){
  if(!trusted(sender)||!message||message.type!=='erase-me')throw new Error('Untrusted request.');
  if(message.action==='ping'){
    const routes=[];
    for(const [routeId,route] of Object.entries(EXEC.ROUTES))if(await chromeApi.permissions.contains({origins:['https://'+route.host+'/*']}))routes.push(routeId);
    return {status:'connected',version:'0.2.0',routes};
  }
  if(!id(message.operationId)||!EXEC.ROUTES[message.routeId])throw new Error('Unsupported operation.');
  const key='operation:'+message.operationId;
  const previous=(await chromeApi.storage.local.get(key))[key];
  if(message.action==='result')return previous?.routeId===message.routeId?previous.result:{status:'unknown',detail:'No companion result is stored.'};
  if(message.action!=='run')throw new Error('Unsupported action.');
  if(previous||active.has(key))return previous?.routeId===message.routeId?previous.result:{status:'unknown',detail:'An operation with this reference already started. No repeat was sent.'};
  const route=EXEC.validate(message.routeId,message.fields);
  active.add(key);
  // Persist the uncertain boundary before opening a tab or filling any field.
  const record={routeId:message.routeId,result:{status:'unknown',detail:'Operation started. Review the broker tab if this browser was interrupted.'}};
  try{
    if(!await chromeApi.permissions.contains({origins:['https://'+route.host+'/*']}))throw new Error('Open the companion icon and enable access to the reviewed broker sites.');
    await chromeApi.storage.local.set({[key]:record});
    const tab=await chromeApi.tabs.create({url:route.url,active:true});
    await settled(chromeApi,tab.id);
    await chromeApi.scripting.executeScript({target:{tabId:tab.id},files:['broker-executor.js']});
    const [response]=await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:payload=>globalThis.EraseBrokerExecutor.execute(payload),args:[{routeId:message.routeId,fields:message.fields}]});
    const result=response?.result;
    if(!result||!['prepared','verification_sent','blocked','unknown'].includes(result.status))throw new Error('The form result could not be verified.');
    record.result={status:result.status,detail:String(result.detail||'').slice(0,600)};
    if(result.status==='verification_sent'&&result.route_verified===true&&result.evidence==='fresh_visible_success')Object.assign(record.result,{route_verified:true,evidence:'fresh_visible_success'});
    await chromeApi.storage.local.set({[key]:record});
    return record.result;
  }catch(_){return record.result;}finally{active.delete(key);}
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage)chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  dispatch(message,sender).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));return true;
});
if(typeof module!=='undefined')module.exports={trusted,dispatch,settled};
