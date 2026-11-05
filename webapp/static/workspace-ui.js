/* Local profile with explicit companion actions and optional private receipt checks. */
(() => {
  'use strict';
  const W=()=>globalThis.EraseWorkspace;
  const M=()=>globalThis.EraseRemovalMail;
  const mailRoutes=new Set(['usphonebook','searchpeoplefree','fastpeoplesearch']);
  const newMailRoutes=new Set(['usphonebook','fastpeoplesearch']);
  const fieldSpecs={
    first_name:{label:'Your first name',type:'text',max:120},last_name:{label:'Your last name',type:'text',max:120},
    full_name:{label:'Your full name',type:'text',max:120},phone:{label:'Your phone number in the record',type:'tel',max:40},
    business_email:{label:'Business email associated with your Apollo record',type:'email',max:254},
    listing_url:{label:'Your confirmed listing URL',type:'url',max:2048},request_text:{label:'Your removal request text',max:5000,textarea:true}
  };
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
    if(item.held)return n('p','Removal-mail actions are on hold for this route. Existing receipt history stays available; explicitly resume before any new mailbox action.','public-route-note');
    if(route.id==='searchpeoplefree'&&!item.mail_contact)return n('p','SearchPeopleFree requires an email you own. It uses your typed email; a shared removal contact is not offered.','public-route-note');
    const panel=n('details',null,'public-mail-pilot');panel.append(n('summary','Operator removal-mail pilot'));
    panel.append(n('p','A removal contact sends broker mail to Erase Me’s shared, removal-only account. Its operator can read those broker messages. It is not an email address personally owned by you. Review the broker’s consent terms and use it only where an authorized contact address is accepted. Your personal inbox stays disconnected. A reviewed USPhonebook confirmation can open its second form only when you choose to continue.','public-route-note'));
    const label=n('label','Private operator pilot key');const key=n('input');key.type='password';key.maxLength=64;key.autocomplete='off';key.setAttribute('aria-label',route.name+' private operator pilot key');label.append(key);panel.append(label);
    const takeKey=()=>{const value=key.value.trim();key.value='';if(!/^[a-fA-F0-9]{64}$/.test(value))throw new Error('Enter the private operator pilot key. It is cleared after each click and never saved.');return value;};
    if(!item.held&&newMailRoutes.has(route.id)&&!item.operation_id&&(!item.mail_contact||item.mail_contact.expires_at<=Math.floor(Date.now()/1000)))panel.append(button('Use removal-only contact email',async()=>{
      const pilotKey=takeKey();const request=await W().mailSessionRequest(route.id);
      const response=await M().session(request,pilotKey);await W().bindMailContact(route.id,response);changed();
      feedback('Removal contact saved: '+response.contact_email+'. Review this address and the broker’s consent wording before using the form. No broker was contacted.');
    }));
    if(!item.held&&item.mail_contact&&item.operation_id)panel.append(button('Check confirmation email',async()=>{
      const pilotKey=takeKey();const request=await W().mailCheckRequest(route.id);
      const result=await M().check(request,pilotKey);await W().recordMailReceipt(route.id,result);changed();
      feedback(result.status==='held'?(result.continuation_available?'An authenticated USPhonebook confirmation is ready. Review the required city, state and ZIP before choosing Continue broker form. No request acceptance or deletion has been established.':'An authenticated removal-related email is held for broker-route validation. No confirmation link was followed, and deletion remains unverified.'):'No qualifying email was found for this operation in this explicit check. No broker action was repeated.');
    }));
    if(!item.held&&route.id==='usphonebook'&&item.mail_receipt?.authenticated&&item.mail_receipt.continuation_available&&!item.continuation){
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
  function sourceNote(url,label,held){
    let source;try{source=new URL(url);if(source.protocol!=='https:'||source.username||source.password||source.port)throw new Error();}catch(_){return n('span',label);}
    const link=n(held?'span':'a',label);if(!held){link.href=source.href;link.target='_blank';link.rel='noopener noreferrer';}return link;
  }
  function routeReview(route,item){
    if(!route.review&&!route.manualContact)return null;
    const panel=n('details',null,'public-route-review');panel.append(n('summary','Current route review'));
    if(route.review){
      panel.append(n('p','Checked '+route.review.checkedAt+'. '+route.review.status.replace(/_/g,' ')+'.','public-route-note'),n('p',route.review.summary,'public-route-note'));
      if(route.review.limits)panel.append(n('p',route.review.limits,'public-route-note'));
      if(/registration/.test(route.operationKind||''))panel.append(n('p','This registers a marketing preference. It does not establish deletion of broker records.','public-route-note'));
      for(const [index,url]of (route.review.sources||[]).entries())panel.append(sourceNote(url,'Official source '+(index+1),item.held));
    }
    if(route.manualContact){
      const contact=route.manualContact,label=contact.kind==='post'?'Postal channel':contact.kind==='subscriber_sms'?'Subscriber SMS instruction':contact.kind==='phone'?'Provider phone channel':'Provider contact';
      panel.append(n('p',label+': '+contact.value,'public-route-note'),n('p',contact.purpose||'Complete this step directly with the provider. Erase Me does not call, send SMS or post letters.','public-route-note'));
      if(contact.source)panel.append(sourceNote(contact.source,'Official contact instructions',item.held));
    }
    return panel;
  }
  function privacyControls(route,item){
    const contact=route.privacyContact;if(!contact||!['privacy','support'].includes(contact.kind))return null;
    const panel=n('details',null,'public-privacy-draft');panel.append(n('summary','Official contact alternative'));
    if(item.held){panel.append(n('p','This route is on hold. Resume it explicitly before preparing a new contact request.','public-route-note'));return panel;}
    const support=contact.kind==='support';
    panel.append(n('p','Fixed recipient: '+contact.email+'. Checked '+contact.checkedAt+'.','public-route-note'));
    if(contact.restriction)panel.append(n('p',contact.restriction,'public-route-note'));
    panel.append(sourceNote(contact.source,'Official contact source',false));
    panel.append(n('p',support?'This is a published support or business contact, not a validated deletion endpoint. The draft asks only for the procedure and includes no name or record identifiers.':'Prepare a private request about your own information. Include only a public listing URL or your own listed reference; do not include passwords, verification links, ID numbers or identity documents.','public-route-note'));
    panel.append(n('p','Nothing is sent. Use an account that meets the broker’s stated requirements; no shared sender is substituted and no personal inbox is connected. Reconcile an uncertain earlier submission before using another request.','public-route-note'));
    const fields=n('div',null,'public-route-fields');let reference=null;
    if(!support){const label=n('label','Your own public listing or record reference');label.className='wide';reference=n('input');reference.type='text';reference.maxLength=2048;reference.setAttribute('aria-label',route.name+' own record reference');label.append(reference);fields.append(label);}
    const review=n('label','This concerns my own information, and I authorize preparing this local draft.');review.className='wide';const agreed=n('input');agreed.type='checkbox';agreed.setAttribute('aria-label',route.name+' privacy draft authorization');review.append(agreed);fields.append(review);panel.append(fields);
    const output=n('textarea');output.className='public-request-text';output.rows=10;output.readOnly=true;output.hidden=true;output.setAttribute('aria-label',route.name+' private request draft');
    let draft=null,generation=0;
    const formatted=()=>{if(!draft)throw new Error('Prepare and review the local draft first.');return 'To: '+draft.to+'\nSubject: '+draft.subject+'\n\n'+draft.body;};
    const copy=button('Copy private draft',async()=>{const value=formatted();if(!globalThis.navigator?.clipboard?.writeText)throw new Error('Clipboard access is unavailable. Select and copy the visible draft yourself.');await globalThis.navigator.clipboard.writeText(value);feedback('Private draft copied. No email was sent or removal recorded.');});copy.disabled=true;
    const download=button('Download private draft',()=>{const value=formatted(),url=URL.createObjectURL(new Blob([value],{type:'text/plain;charset=utf-8'})),a=n('a');a.href=url;a.download='erase-me-'+route.id+'-private-request.txt';a.click();URL.revokeObjectURL(url);feedback('Private draft downloaded. Keep it private; no email was sent or removal recorded.');});download.disabled=true;
    const invalidate=()=>{generation++;draft=null;output.value='';output.hidden=true;copy.disabled=true;download.disabled=true;};
    if(reference)reference.addEventListener('input',invalidate);agreed.addEventListener('change',invalidate);
    const prepare=button(support?'Prepare procedure question':'Prepare private request',async()=>{
      if(!agreed.checked)throw new Error('Confirm this request concerns your own information first.');
      const current=generation,value=reference?reference.value:'';
      const result=await W().privacyDraftRequest(route.id,{reference:value,own_request:true});
      if(current!==generation||!agreed.checked||(reference&&reference.value!==value))throw new Error('The record reference or authorization changed. Review it and prepare again.');
      draft=result;output.value=formatted();output.hidden=false;copy.disabled=false;download.disabled=false;
      feedback('Private draft prepared in this browser. Review it before using your chosen removal account. Nothing was sent and no removal was established.');
    });
    panel.append(prepare,output,copy,download);return panel;
  }
  function decorate(items){
    const routes=W().routes();
    for(const [index,row] of [...$('listing-items').children].entries()){
      // Filtering can change row order, so associate the stable site name.
      const title=row.querySelector('.listing-title');const route=routes.find(r=>r.name===title?.textContent);if(!route)continue;
      const item=items.find(i=>i.site_id===route.id);if(!item)continue;
      const info=row.querySelector('.listing-info'),fields=n('div',null,'public-route-fields'),actions=n('div',null,'public-route-actions');
      const values={},affirmations={};
      for(const key of route.fields.filter(k=>k!=='email')){
        const spec=fieldSpecs[key];if(!spec)continue;
        const label=n('label',spec.label);if(spec.textarea)label.className='wide';
        const input=n(spec.textarea?'textarea':'input');if(spec.textarea){input.rows=6;input.className='public-request-text';}else input.type=spec.type;input.maxLength=spec.max;input.value=item.input_fields?.[key]||(key==='full_name'?W().profile().name||'':'');input.disabled=Boolean(item.operation_id)||item.held===true;
        input.setAttribute('aria-label',route.name+' '+label.textContent);values[key]=input;label.append(input);fields.append(label);
      }
      for(const key of route.requiredAffirmations){
        const label=n('label',key==='business_email'?'This is the business email associated with my own Apollo record, and I authorize using it for removal.':key==='own_request'?'I reviewed these fields and confirm this request concerns my own information.':'I reviewed this exact listing and confirm it is my own information.');
        const input=n('input');input.type='checkbox';input.checked=item.affirmations?.[key]===true;input.disabled=Boolean(item.operation_id)||item.held===true;
        input.setAttribute('aria-label',route.name+' '+(key==='business_email'?'business email authorization':key==='own_request'?'own request authorization':'own listing confirmation'));affirmations[key]=input;label.append(input);fields.append(label);
        for(const value of Object.values(values))value.addEventListener('input',()=>{input.checked=false;});
      }
      const save=async()=>{const evidence={},confirmed={};for(const [key,input]of Object.entries(values))evidence[key]=['request_text','phone'].includes(key)?input.value:input.value.trim();for(const [key,input]of Object.entries(affirmations))confirmed[key]=input.checked===true;const saved=await W().setEvidence(route.id,evidence,confirmed);return{fields:saved,affirmations:confirmed};};
      const open=button('Open official form',async()=>{
        await W().opened(route.id);
        window.open(route.url,'_blank','noopener,noreferrer');changed();feedback('Opening the official broker form was requested. If no tab appears, allow popups for this site. No request has been recorded as sent.');
      });if(!item.held)actions.append(open);
      if(!item.held&&route.searchable)actions.append(button('Find my listing',async()=>{
        const request=await W().searchRequest(route.id);
        window.open(request.url,'_blank','noopener,noreferrer');changed();feedback('Opening a Google search was requested. Google receives your name and optional city. Review each candidate yourself; no listing match or removal was established.');
      }));
      const supported=route.automationLevel==='companion';
      if(!item.held&&supported&&!item.operationId&&!item.operation_id){
        actions.append(button(route.id==='peopledatalabs-form'?'Start broker verification':'Fill with companion',async()=>{
          const reviewed=await save();const ping=await companion({action:'ping'});
          if(!ping.routes?.includes(route.id))throw new Error('Open the companion toolbar icon and enable this broker before starting.');
          if(['apollo','spokeo'].includes(route.id)&&!ping.capabilities?.includes('explicit-fields-v1'))throw new Error('Update the companion from the current download and refresh this workspace. No new action started.');
          if(route.requiredAffirmations.includes('own_request')&&!ping.capabilities?.includes('structured-fields-v1'))throw new Error('Update the companion from the current download to use reviewed structured request fields. No new action started.');
          const operation=await W().prepare(route.id,reviewed);changed();
          let result;
          try{result=await companion({action:'run',...operation});}catch(error){result={status:'unknown',detail:'The companion outcome is unknown. Check the broker tab before doing anything further.'};}
          await W().recordCompanion(route.id,operation.operationId,result);changed();feedback(result.detail||'The companion step is recorded. Finish the broker steps.');
        }));
      }
      const operationId=item.operationId||item.operation_id;
      if(operationId&&!item.status.startsWith('user_reported'))actions.append(button('Read companion result',async()=>{const result=await companion({action:'result',routeId:route.id,operationId});await W().recordCompanion(route.id,operationId,result);changed();feedback(result.detail||'Companion result checked.');}));
      if(operationId&&item.continuation)actions.append(button('Read confirmation-form result',async()=>{const result=await companion({action:'continuation-result',routeId:route.id,operationId});await W().recordMailContinuation(route.id,operationId,result);changed();feedback(result.detail||'Confirmation-form result checked. No action was repeated.');}));
      if(!item.held&&operationId)actions.append(button('Check existing broker tab',async()=>{
        const ping=await companion({action:'ping'});if(!ping.capabilities?.includes('broker-observation-v1'))throw new Error('Update the companion to check an existing broker tab without repeating its action.');
        const request=await W().observationRequest(route.id),result=await companion({action:'observe',...request});await W().recordObservation(route.id,operationId,result);changed();feedback(result.detail||'The existing broker outcome was checked. No action was repeated.');
      }));
      if(!item.held){
        actions.append(button('I submitted the request',async()=>{await W().recordUser(route.id,'user_reported_requested');changed();feedback('Your report of submitting a request is saved. Broker acceptance and deletion remain unverified.');}));
        actions.append(button('I finished the broker steps',async()=>{await W().recordUser(route.id,'user_reported_completed');changed();feedback('Your completion report is saved. It is not counted as a verified deletion.');}));
        actions.append(button('Hold this route',async()=>{await W().holdRoute(route.id);changed();feedback('This route is on hold. No new broker or mailbox action will start until you explicitly resume it.');}));
      }else actions.append(button('Resume this route',async()=>{await W().resumeRoute(route.id);changed();feedback('This route was explicitly resumed. Its existing operation references still prevent repeated actions.');}));
      const steps=n('details',null,'public-broker-steps');
      steps.append(n('summary','Request steps'),n('p',route.steps.join(' '),'public-route-note'));
      if(fields.children.length)steps.append(fields);
      if(route.searchable)steps.append(n('p','Find my listing opens a Google search only when you choose it. Google receives your name and optional city. Review candidates yourself; a search is not evidence that a listing belongs to you.','public-route-note'));
      if(route.manualGroup==='peopleconnect'){
        const explanation=n('p','Use the Intelius / PeopleConnect route for one manual personal-use suppression session covering the four named report brands. Other brands and report types are not automatically covered.','public-route-note');
        steps.append(explanation);
      }
      if(route.fields.includes('email'))steps.append(n('p','Email to use for this broker: '+(item.mail_contact?.contact_email||W().profile().email)+(item.mail_contact?' (separate removal-only contact)':' (your typed profile email)'),'public-field-disclosure'));
      if(item.mail_contact)steps.append(n('p','Removal contact expires '+new Date(item.mail_contact.expires_at*1000).toISOString()+'. It does not prove ownership of a broker record.','public-route-note'));
      if(!item.held&&item.mail_contact&&!item.operation_id)steps.append(button('Use my typed email instead',async()=>{await W().clearMailContact(route.id);changed();feedback('This route will use your typed profile email. No broker was contacted.');}));
      if(item.mail_receipt)steps.append(n('p',item.mail_receipt.status==='held'?(item.mail_receipt.authenticated?(item.mail_receipt.continuation_available?'Authenticated broker mail received; a reviewed confirmation form is available. This does not establish deletion.':'Authenticated broker mail received; confirmation is held for route validation.'):'Imported receipt history is unverified; perform an explicit check to establish its current state.'):'The last explicit check found no qualifying receipt.','public-route-note'));
      const mailPanel=mailControls(route,item);if(mailPanel)steps.append(mailPanel);
      const audit=routeReview(route,item);if(audit)steps.append(audit);
      const privacyPanel=privacyControls(route,item);if(privacyPanel)steps.append(privacyPanel);
      steps.append(actions,n('p',route.evidence,'public-route-note'));
      info.append(steps);
    }
  }
  globalThis.EraseWorkspaceUI={configure,tools,decorate};
})();
