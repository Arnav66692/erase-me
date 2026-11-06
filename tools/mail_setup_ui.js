/* Local one-session setup only. No provider fetches, polling or stored credentials. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),form=$('setup-form'),fields=$('setup-fields'),result=$('setup-result'),session=$('session-status');
  let token='',ready=false,running=false,closed=false;
  const errors={busy:'A setup operation is already running. Finish its Google consent before trying again.',closed:'This setup session is closed. Start the local setup again.',session_closed:'This setup session is closed or expired. Start the local setup again.',expired:'This setup session expired. Start the local setup again.',already_complete:'This setup is already complete. Return to Erase Me and connect the local mailbox there.',registration_approval_required:'An older companion registration needs your approval. Open “Change an existing connection” and approve its update only if this is your intended companion.',client_required:'Select your Google Desktop client JSON for a new connection.',invalid_request:'Review the account addresses, companion ID and selected Google file.',invalid_client:'Select a valid Google Desktop OAuth client JSON.',forbidden:'This setup session could not be authenticated. Start the local setup again.',setup_failed:'Setup did not finish. Check your separate account, Google connection file and companion registration. Broker requests were not changed.',canceled:'Setup was canceled before its next installation step.'};
  Object.assign(errors,{invalid_app_password:'Use the 16-letter app password from the separate Google account, or select Google sign-in instead.',app_password_unavailable:'The separate Gmail app-password login did not succeed. Check eligibility in the separate account or select Google sign-in with a connection file.',reconnect_required:'Review intentional replacement before changing an existing separate connection.'});
  const method=()=>$('connection-method').value||'oauth';
  function updateMethod(){const app=method()==='app_password';$('app-password-fields').hidden=!app;$('oauth-fields').hidden=app;$('app-password').disabled=!app;$('client-file').disabled=app;$('app-password').value='';$('client-file').value='';}
  const failed=code=>{result.textContent=errors[code]||'Setup did not finish. Start the local guide again if needed. No broker request was submitted.';};
  function clearApproval(){if(!running)$('removal-only').checked=false;}
  for(const id of ['personal-email','mailbox','extension-id','browser','client-file','replace-registration','reconnect','allow-sending','connection-method','app-password'])$(id).addEventListener('change',clearApproval);
  $('app-password').addEventListener('input',clearApproval);
  $('connection-method').addEventListener('change',()=>{clearApproval();updateMethod();});updateMethod();
  async function api(path,body){
    const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'X-Erase-Setup':token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),credentials:'omit',cache:'no-store',redirect:'error'});
    const value=await response.json();if(!response.ok||value?.ok!==true){const error=new Error();error.code=typeof value?.code==='string'?value.code:'setup_failed';throw error;}return value.result;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!ready||running||closed||!form.reportValidity()||$('removal-only').checked!==true)return;
    running=true;fields.disabled=true;result.textContent='Connecting the separate account. Complete Google consent in its sign-in window if it opens. No mail is being read.';
    let client=null,body=null,secret=null;
    try{
      const selected=method();if(!['oauth','app_password'].includes(selected))throw Object.assign(new Error(),{code:'invalid_request'});
      const file=selected==='oauth'?$('client-file').files?.[0]:null;
      if(file){if(file.size>65536)throw Object.assign(new Error(),{code:'invalid_client'});client=await file.text();if(new TextEncoder().encode(client).length>65536)throw Object.assign(new Error(),{code:'invalid_client'});}
      if(closed)return;
      secret=selected==='app_password'?$('app-password').value||null:null;
      body={connection_method:selected,app_password:secret,personal_email:$('personal-email').value.trim(),mailbox:$('mailbox').value.trim(),extension_id:$('extension-id').value.trim(),browser:$('browser').value,client_json:client,removal_only:true,replace_registration:$('replace-registration').checked===true,reconnect:$('reconnect').checked===true,allow_sending:$('allow-sending').checked===true};
      $('client-file').value='';$('app-password').value='';client=null;secret=null;
      const value=await api('/api/connect',body);body=null;if(closed)return;
      if(value?.installed!==true||value.identity_checked!==true||value.messages_read!==false||value.scheduled_work!==false||typeof value.reused_connection!=='boolean')throw new Error();
      result.textContent='Connected privately. Return to Erase Me, enable local connectors in the companion and choose “Connect my removal-only mailbox”. No messages were read and no timers were installed.';
      ready=false;
    }catch(error){if(!closed)failed(error?.code);}
    finally{client=null;secret=null;body=null;$('client-file').value='';$('app-password').value='';$('removal-only').checked=false;running=false;fields.disabled=closed||!ready;}
  });
  $('close-setup').addEventListener('click',async()=>{
    if(closed)return;closed=true;ready=false;fields.disabled=true;$('close-setup').disabled=true;$('client-file').value='';$('app-password').value='';$('removal-only').checked=false;
    try{const value=await api('/api/close',{});result.textContent=value?.installation_started===true?'Local setup is closing. A reserved connection update or installation may finish; no further setup action will begin.':'Local setup is closed. An unfinished provider check may finish, but no later connection activation or installation is authorized.';}
    catch(_){result.textContent='This page is closed to further actions. Close the setup launcher too if it is still open. An already-authorized operation may finish.';}
    token='';session.textContent='Local setup closed.';
  });
  (async()=>{
    try{
      const fragment=location.hash.slice(1);history.replaceState(null,'',location.pathname);
      if(location.protocol!=='http:'||location.hostname!=='127.0.0.1'||!/^token=[A-Za-z0-9_-]{43}$/.test(fragment))throw new Error();token=fragment.slice(6);
      const info=await api('/api/info');if(closed)return;
      if(info.extension_id!==null&&!(typeof info.extension_id==='string'&&/^[a-p]{32}$/.test(info.extension_id))||!['chrome','chromium'].includes(info.browser))throw new Error();
      if(info.extension_id)$('extension-id').value=info.extension_id;$('browser').value=info.browser;
      ready=true;fields.disabled=false;session.textContent='Private local session ready. Nothing is connected until you choose Connect separate account.';
    }catch(_){fields.disabled=true;session.textContent='Start this page with the local Erase Me setup launcher. A private session link is required; never open it through a remote website.';}
  })();
})();
