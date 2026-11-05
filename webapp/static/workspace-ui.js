/* Local profile with explicit companion actions and optional private receipt checks. */
(() => {
  'use strict';
  const W=()=>globalThis.EraseWorkspace;
  const M=()=>globalThis.EraseRemovalMail;
  const mailRoutes=new Set(['usphonebook','searchpeoplefree','fastpeoplesearch']);
  let mailStatus=null;
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
      const timeout=setTimeout(()=>{stop();reject(new Error('The companion did not respond. Install it, enable broker access, then refresh this page. No repeat has been sent.'));},['run','continue'].includes(payload.action)?60000:1500);
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
        try{const selected=file.files[0];if(!selected)return;if(selected.size>500000)throw new Error('Choose a backup smaller than 500 KB.');await W().importData(await selected.text());changed();feedback('Your backup was restored as user-reported history. No broker was contacted.');}
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
    const coverage=W().dashboard().coverage;
    if(coverage){
      const message=!coverage.country
        ? 'Choose your country below to show regional routes. ' + coverage.globalRouteCount + ' global portals are available meanwhile.'
        : coverage.hasCountryPack
          ? 'Country ' + coverage.country + '. ' + coverage.countryRouteCount + ' regional routes and ' + coverage.globalRouteCount + ' global portals. ' + coverage.manualRouteCount + ' routes require manual work.'
          : 'Country ' + coverage.country + '. No country pack is available yet. ' + coverage.globalRouteCount + ' global portals remain available.';
      const note=n('p',message + (coverage.unplannedRouteCount ? ' Choose Prepare route plan to add newly available routes.' : '') + (coverage.historicalRouteCount ? ' Previously started routes from other countries remain visible for follow-up.' : '') + ' Portal coverage does not mean automated removal or verified deletion.','public-route-note');
      note.id='coverage-note';box.append(note);
    }
    const download=n('a','Get the free Chrome companion','button button-secondary');download.href='/downloads/erase-me-companion.zip';download.download='erase-me-companion.zip';
    const instructions=n('a','Install instructions','button button-secondary');instructions.href='/companion.html';instructions.target='_blank';instructions.rel='noopener';
    const connect=button('Check companion',async()=>{const result=await companion({action:'ping'});feedback(result.routes?.length?'Companion connected. Broker access is enabled.':'Companion connected. Open its toolbar icon and enable broker access.');});
    const exportButton=button('Export private backup',()=>{
      const data=W().exportData();const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=n('a');a.href=url;a.download='erase-me-private-backup.json';a.click();URL.revokeObjectURL(url);
    });
    box.append(n('p','For automatic form filling, install the desktop Chrome companion once. Official forms also work without it. Broker email and CAPTCHA steps remain yours.','public-route-note'),download,instructions,connect,exportButton);
    if(M())box.append(button('Check removal-mail availability',async()=>{
      mailStatus=await M().status();changed();
      feedback(mailStatus.enabled?'The removal-mail relay is available as a private operator pilot. It checks receipts on demand. Reviewed USPhonebook confirmations can open its second form after you review the required fields.':mailStatus.configured?'The dedicated mailbox is configured, but the private pilot is disabled. Personal inboxes stay disconnected.':'The dedicated removal mailbox is not connected. Use the broker’s own email steps. Personal inboxes stay disconnected.');
    }),n('p','Optional removal-mail checks are a gated operator pilot. They use a separate account, require a private key for each action and never run on a schedule. Each reviewed confirmation needs an explicit continuation.','public-route-note'));
  }
  function mailControls(route,item){
    if(!mailRoutes.has(route.id)||!M()||!mailStatus?.enabled)return null;
    const panel=n('details',null,'public-mail-pilot');panel.append(n('summary','Operator removal-mail pilot'));
    panel.append(n('p','A removal contact sends broker mail to Erase Me’s shared, removal-only account. Its operator can read those broker messages. It is not an email address personally owned by you. Review the broker’s consent terms and use it only where an authorized contact address is accepted. Your personal inbox stays disconnected. A reviewed USPhonebook confirmation can open its second form only when you choose to continue.','public-route-note'));
    const label=n('label','Private operator pilot key');const key=n('input');key.type='password';key.maxLength=64;key.autocomplete='off';key.setAttribute('aria-label',route.name+' private operator pilot key');label.append(key);panel.append(label);
    const takeKey=()=>{const value=key.value.trim();key.value='';if(!/^[a-fA-F0-9]{64}$/.test(value))throw new Error('Enter the private operator pilot key. It is cleared after each click and never saved.');return value;};
    if(!item.operation_id&&(!item.mail_contact||item.mail_contact.expires_at<=Math.floor(Date.now()/1000)))panel.append(button('Use removal-only contact email',async()=>{
      const pilotKey=takeKey();const request=await W().mailSessionRequest(route.id);
      const response=await M().session(request,pilotKey);await W().bindMailContact(route.id,response);changed();
      feedback('Removal contact saved: '+response.contact_email+'. Review this address and the broker’s consent wording before using the form. No broker was contacted.');
    }));
    if(item.mail_contact&&item.operation_id)panel.append(button('Check confirmation email',async()=>{
      const pilotKey=takeKey();const request=await W().mailCheckRequest(route.id);
      const result=await M().check(request,pilotKey);await W().recordMailReceipt(route.id,result);changed();
      feedback(result.status==='held'?(result.continuation_available?'An authenticated USPhonebook confirmation is ready. Review the required city, state and ZIP before choosing Continue broker form. No request acceptance or deletion has been established.':'An authenticated removal-related email is held for broker-route validation. No confirmation link was followed, and deletion remains unverified.'):'No qualifying email was found for this operation in this explicit check. No broker action was repeated.');
    }));
    if(route.id==='usphonebook'&&item.mail_receipt?.authenticated&&item.mail_receipt.continuation_available&&!item.continuation){
      panel.append(n('p','Review the fields the companion will fill on the broker’s second form. USPhonebook also requires either date of birth or street address: enter one directly on its official form. Erase Me does not collect or autofill those details. Then review the broker’s accuracy statement, complete any challenge and submit there.','public-route-note'));
      const profile=W().profile(),inputs={};
      for(const [name,title,initial,max]of [['city','Current city',item.continuation_fields?.city||profile.city||'',120],['state','US state abbreviation',item.continuation_fields?.state||(profile.region||'').replace(/^US-/i,'').toUpperCase(),2],['zip_code','Current ZIP code',item.continuation_fields?.zip_code||'',5]]){
        const label=n('label',title),input=n('input');input.type='text';input.maxLength=max;input.value=initial;
        if(name==='zip_code')input.inputMode='numeric';input.setAttribute('aria-label',route.name+' '+title);label.append(input);panel.append(label);inputs[name]=input;
      }
      panel.append(n('p','Name: '+(item.input_fields?.first_name||'')+' '+(item.input_fields?.last_name||'')+'. Contact email: '+item.mail_contact.contact_email+'.','public-field-disclosure'));
      const review=n('label','I reviewed these fields and authorize filling this broker confirmation form.');const agreed=n('input');agreed.type='checkbox';review.append(agreed);panel.append(review);
      panel.append(button('Continue broker form',async()=>{
        if(!agreed.checked)throw new Error('Review the fields and authorize this specific confirmation form first.');
        const fields=Object.fromEntries(Object.entries(inputs).map(([name,input])=>[name,input.value.trim()]));
        const pilotKey=takeKey(),ping=await companion({action:'ping'});
        if(!ping.routes?.includes(route.id))throw new Error('Open the companion toolbar icon and enable USPhonebook before continuing.');
        if(!ping.capabilities?.includes('usphonebook-continuation-v1'))throw new Error('Update the unpacked companion from the current download, then refresh this workspace before continuing. No confirmation action started.');
        const request=await W().mailContinuationRequest(route.id,fields),response=await M().continuation(request,pilotKey);
        const operation=await W().prepareMailContinuation(route.id,response,fields);changed();
        let result;try{result=await companion({action:'continue',...operation});}catch(_){result={status:'unknown',detail:'The confirmation outcome is unknown. Check its existing broker tab; no replay will be sent.'};}
        await W().recordMailContinuation(route.id,operation.operationId,result);changed();feedback(result.detail||'Confirmation-form outcome recorded. Deletion remains unverified.');
      }));
    }
    panel.append(n('p','The key is cleared after each click. Private backups include the scoped mail capability, which permits checking only this operation. Keep backups private.','public-route-note'));
    return panel;
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
      const save=async()=>{const evidence={};for(const [key,input]of Object.entries(values))if(input.value.trim())evidence[key]=input.value.trim();await W().setEvidence(route.id,evidence);};
      const open=button('Open official form',async()=>{
        await W().opened(route.id);
        window.open(route.url,'_blank','noopener,noreferrer');changed();feedback('Opening the official broker form was requested. If no tab appears, allow popups for this site. No request has been recorded as sent.');
      });actions.append(open);
      const supported=['peopledatalabs-form','usphonebook','searchpeoplefree','fastpeoplesearch'].includes(route.id);
      if(supported&&!item.operationId&&!item.operation_id){
        actions.append(button(route.id==='peopledatalabs-form'?'Start broker verification':'Fill with companion',async()=>{
          await save();const ping=await companion({action:'ping'});
          if(!ping.routes?.includes(route.id))throw new Error('Open the companion toolbar icon and enable this broker before starting.');
          const operation=await W().prepare(route.id);changed();
          let result;
          try{result=await companion({action:'run',...operation});}catch(error){result={status:'unknown',detail:'The companion outcome is unknown. Check the broker tab before doing anything further.'};}
          await W().recordCompanion(route.id,operation.operationId,result);changed();feedback(result.detail||'The companion step is recorded. Finish the broker steps.');
        }));
      }
      const operationId=item.operationId||item.operation_id;
      if(operationId&&!item.status.startsWith('user_reported'))actions.append(button('Read companion result',async()=>{const result=await companion({action:'result',routeId:route.id,operationId});await W().recordCompanion(route.id,operationId,result);changed();feedback(result.detail||'Companion result checked.');}));
      if(operationId&&item.continuation)actions.append(button('Read confirmation-form result',async()=>{const result=await companion({action:'continuation-result',routeId:route.id,operationId});await W().recordMailContinuation(route.id,operationId,result);changed();feedback(result.detail||'Confirmation-form result checked. No action was repeated.');}));
      actions.append(button('I submitted the request',async()=>{if(!item.operation_id)await save();await W().recordUser(route.id,'user_reported_requested');changed();feedback('Your report of submitting a request is saved. Broker acceptance and deletion remain unverified.');}));
      actions.append(button('I finished the broker steps',async()=>{await W().recordUser(route.id,'user_reported_completed');changed();feedback('Your completion report is saved. It is not counted as a verified deletion.');}));
      const steps=n('details',null,'public-broker-steps');
      steps.append(n('summary','Request steps'),n('p',route.steps.join(' '),'public-route-note'));
      if(fields.children.length)steps.append(fields);
      if(route.fields.includes('email'))steps.append(n('p','Email to use for this broker: '+(item.mail_contact?.contact_email||W().profile().email)+(item.mail_contact?' (separate removal-only contact)':' (your typed profile email)'),'public-field-disclosure'));
      if(item.mail_contact)steps.append(n('p','Removal contact expires '+new Date(item.mail_contact.expires_at*1000).toISOString()+'. It does not prove ownership of a broker record.','public-route-note'));
      if(item.mail_contact&&!item.operation_id)steps.append(button('Use my typed email instead',async()=>{await W().clearMailContact(route.id);changed();feedback('This route will use your typed profile email. No broker was contacted.');}));
      if(item.mail_receipt)steps.append(n('p',item.mail_receipt.status==='held'?(item.mail_receipt.authenticated?(item.mail_receipt.continuation_available?'Authenticated broker mail received; a reviewed confirmation form is available. This does not establish deletion.':'Authenticated broker mail received; confirmation is held for route validation.'):'Imported receipt history is unverified; perform an explicit check to establish its current state.'):'The last explicit check found no qualifying receipt.','public-route-note'));
      const mailPanel=mailControls(route,item);if(mailPanel)steps.append(mailPanel);
      steps.append(actions,n('p',route.evidence,'public-route-note'));
      info.append(steps);
    }
  }
  globalThis.EraseWorkspaceUI={configure,tools,decorate};
})();
