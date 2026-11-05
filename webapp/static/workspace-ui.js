/* The hosted workspace owns local data. Only explicit companion actions leave it. */
(() => {
  'use strict';
  const W=()=>globalThis.EraseWorkspace;
  const $=id=>document.getElementById(id);
  const n=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  const changed=()=>document.dispatchEvent(new CustomEvent('erase-workspace-change'));
  const feedback=message=>{$('campaign-feedback').textContent=message;$('campaign-feedback').hidden=false;};
  function report(error){feedback(error?.message||'This action could not be completed.');}
  function button(label,action){const e=n('button',label,'button button-secondary');e.type='button';e.addEventListener('click',async()=>{e.disabled=true;try{await action();}catch(error){report(error);}finally{e.disabled=false;}});return e;}
  function companion(payload){
    return new Promise((resolve,reject)=>{
      const requestId=crypto.randomUUID();
      const stop=()=>{clearTimeout(timeout);window.removeEventListener('message',listener);};
      const listener=event=>{
        if(event.source!==window||event.origin!==location.origin||event.data?.source!=='erase-companion'||event.data.requestId!==requestId)return;
        stop();const reply=event.data.reply;
        if(reply?.ok)resolve(reply.result);else reject(new Error(reply?.error||'The companion could not complete this action.'));
      };
      const timeout=setTimeout(()=>{stop();reject(new Error('The companion did not respond. Install it, enable broker access, then refresh this page. No repeat has been sent.'));},payload.action==='run'?60000:1500);
      window.addEventListener('message',listener);
      window.postMessage({source:'erase-workspace',requestId,payload},location.origin);
    });
  }
  function configure(){
    $('mode-badge').textContent='Browser workspace';
    $('signup-heading').textContent='Keep your privacy work here.';
    $('signup-panel').querySelector('button[type="submit"]').textContent='Create private workspace';
    $('signup-panel').querySelector('.form-description').textContent='Saved in this browser on this device. Your profile is not uploaded to Erase Me.';
    $('signup-panel').querySelector('.card-footnote').textContent='Use your own details. Broker verification happens on each broker’s site and in emails you open yourself.';
    $('privacy-dialog').querySelector('.dialog-body > p').textContent='Your profile and request history stay in this browser’s storage on this device. Erase Me has no server copy. Other people using this browser profile can see them. Clearing browser data removes the workspace. Export a private backup if you need one.';
    $('demo-banner').hidden=false;
    $('demo-banner').querySelector('span:first-child').textContent='Private workspace';
    $('demo-banner').querySelector('span:last-child').textContent='Your data stays in this browser. Broker actions run only when you choose them.';
    $('delete-heading').textContent='Delete this browser workspace.';
    $('delete-dialog').querySelector('.dialog-body > p').textContent='This removes the profile and history saved by Erase Me in this browser. It cannot recall a request already sent to a broker.';
    if(!$('restore-workspace')){
      const restore=button('Restore own private backup',()=>{
        if(!$('signup-consent').checked)throw new Error('Confirm that the backup contains your own information before restoring it.');
        file.click();
      });restore.id='restore-workspace';
      const file=n('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
      file.addEventListener('change',async()=>{
        try{const selected=file.files[0];if(!selected)return;if(selected.size>500000)throw new Error('Choose a backup smaller than 500 KB.');W().importData(await selected.text());changed();feedback('Your backup was restored as user-reported history. No broker was contacted.');}
        catch(error){$('signup-error').textContent=error.message;$('signup-error').hidden=false;}finally{file.value='';}
      });
      $('signup-panel').append(restore,file);
    }
    $('dashboard-heading').textContent='Your privacy work';
    $('listings-heading').textContent='Broker routes';
  }
  function tools(){
    let box=$('public-tools');
    if(!box){box=n('div',null,'public-tools');box.id='public-tools';$('campaign-feedback').after(box);}
    box.hidden=false;
    box.replaceChildren();
    const download=n('a','Get the free Chrome companion','button button-secondary');download.href='/downloads/erase-me-companion.zip';download.download='erase-me-companion.zip';
    const instructions=n('a','Install instructions','button button-secondary');instructions.href='/companion.html';instructions.target='_blank';instructions.rel='noopener';
    const connect=button('Check companion',async()=>{const result=await companion({action:'ping'});feedback(result.routes?.length?'Companion connected. Broker access is enabled.':'Companion connected. Open its toolbar icon and enable broker access.');});
    const exportButton=button('Export private backup',()=>{
      const data=W().exportData();const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=n('a');a.href=url;a.download='erase-me-private-backup.json';a.click();URL.revokeObjectURL(url);
    });
    const input=n('input');input.type='file';input.accept='.json,application/json';input.hidden=true;
    input.addEventListener('change',async()=>{try{const file=input.files[0];if(!file)return;if(file.size>1048576)throw new Error('Backup is too large.');W().importData(await file.text());changed();feedback('Backup restored as user-reported history. No requests were sent and no deletion was verified.');}catch(error){report(error);}finally{input.value='';}});
    const importButton=button('Import backup',()=>input.click());
    box.append(n('p','For automatic form filling, install the desktop Chrome companion once. Official forms also work without it. Broker email and CAPTCHA steps remain yours.','public-route-note'),download,instructions,connect,exportButton);
  }
  function decorate(items){
    const routes=W().routes();
    for(const [index,row] of [...$('listing-items').children].entries()){
      // Filtering can change row order, so associate the stable site name.
      const title=row.querySelector('.listing-title');const route=routes.find(r=>r.name===title?.textContent);if(!route)continue;
      const item=items.find(i=>i.site_id===route.id);if(!item)continue;
      const info=row.querySelector('.listing-info'),fields=n('div',null,'public-route-fields'),actions=n('div',null,'public-route-actions');
      const values={};
      for(const key of route.fields.filter(k=>k!=='email')){
        const label=n('label',key==='listing_url'?'Your confirmed listing URL':key==='first_name'?'Your first name':'Your last name');
        const input=n('input');input.type=key==='listing_url'?'url':'text';input.maxLength=key==='listing_url'?2048:120;input.value=item.input_fields?.[key]||'';input.disabled=Boolean(item.operation_id);
        input.setAttribute('aria-label',route.name+' '+label.textContent);values[key]=input;label.append(input);fields.append(label);
      }
      const save=()=>{const evidence={};for(const [key,input]of Object.entries(values))if(input.value.trim())evidence[key]=input.value.trim();W().setEvidence(route.id,evidence);};
      const open=button('Open official form',()=>{
        W().opened(route.id);window.open(route.url,'_blank','noopener,noreferrer');changed();feedback('Official broker form opened. No request has been recorded as sent.');
      });actions.append(open);
      const supported=['peopledatalabs-form','usphonebook','searchpeoplefree','fastpeoplesearch'].includes(route.id);
      if(supported&&!item.operationId&&!item.operation_id){
        actions.append(button(route.id==='peopledatalabs-form'?'Start broker verification':'Fill with companion',async()=>{
          save();const ping=await companion({action:'ping'});
          if(!ping.routes?.includes(route.id))throw new Error('Open the companion toolbar icon and enable this broker before starting.');
          const operation=W().prepare(route.id);changed();
          let result;
          try{result=await companion({action:'run',...operation});}catch(error){result={status:'unknown',detail:'The companion outcome is unknown. Check the broker tab before doing anything further.'};}
          W().recordCompanion(route.id,operation.operationId,result);changed();feedback(result.detail||'The companion step is recorded. Finish the broker steps.');
        }));
      }
      const operationId=item.operationId||item.operation_id;
      if(operationId&&!item.status.startsWith('user_reported'))actions.append(button('Read companion result',async()=>{const result=await companion({action:'result',routeId:route.id,operationId});W().recordCompanion(route.id,operationId,result);changed();feedback(result.detail||'Companion result checked.');}));
      actions.append(button('I submitted the request',()=>{if(!item.operation_id)save();W().recordUser(route.id,'user_reported_requested');changed();feedback('Your report of submitting a request is saved. Broker acceptance and deletion remain unverified.');}));
      actions.append(button('I finished the broker steps',()=>{W().recordUser(route.id,'user_reported_completed');changed();feedback('Your completion report is saved. It is not counted as a verified deletion.');}));
      const steps=n('details',null,'public-broker-steps');
      steps.append(n('summary','Request steps'),n('p',route.steps.join(' '),'public-route-note'));
      if(fields.children.length)steps.append(fields);
      steps.append(n('p','Contact email for this broker: '+W().profile().email,'public-field-disclosure'));
      steps.append(actions,n('p',route.evidence,'public-route-note'));
      info.append(steps);
    }
  }
  globalThis.EraseWorkspaceUI={configure,tools,decorate};
})();
