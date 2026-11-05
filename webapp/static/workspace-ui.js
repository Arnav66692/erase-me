/* Local profile with explicit companion actions and optional private receipt checks. */
(() => {
  'use strict';
  const W=()=>globalThis.EraseWorkspace;
  const M=()=>globalThis.EraseRemovalMail;
  const A=()=>globalThis.EraseAutomaticExecutor;
  const S=()=>globalThis.EraseRemovalSession;
  const C=()=>globalThis.EraseContactSetup;
  const N=()=>globalThis.EraseNextSteps;
  const D=()=>globalThis.EraseIdentityDialog;
  const mailRoutes=new Set(['usphonebook','searchpeoplefree','fastpeoplesearch']);
  const newMailRoutes=new Set(['usphonebook','fastpeoplesearch']);
  const fieldSpecs={
    first_name:{label:'Your first name',type:'text',max:120},last_name:{label:'Your last name',type:'text',max:120},
    full_name:{label:'Your full name',type:'text',max:120},phone:{label:'Your phone number in the record',type:'tel',max:40},
    business_email:{label:'Business email associated with your Apollo record',type:'email',max:254},
    listing_url:{label:'Your confirmed listing URL',type:'url',max:2048},request_text:{label:'Your removal request text',max:5000,textarea:true}
  };
  let mailStatus=null;
  let batchView=null;
  let identityDialog=null;
  let footprintPanel=null;
  const formEditors=new Map(),fillActions=new Set();
  const $=id=>document.getElementById(id);
  const n=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  const changed=()=>document.dispatchEvent(new CustomEvent('erase-workspace-change'));
  const feedback=message=>{$('campaign-feedback').textContent=message;$('campaign-feedback').hidden=false;};
  function report(error){feedback(error?.message||'This action could not be completed.');}
  function button(label,action,enabled){const e=n('button',label,'button button-secondary');e.type='button';e.addEventListener('click',async()=>{e.disabled=true;try{await action();}catch(error){report(error);}finally{e.disabled=enabled?!enabled():false;}});return e;}
  function companion(payload){
    return new Promise((resolve,reject)=>{
      const requestId=crypto.randomUUID();
      const stop=()=>{clearTimeout(timeout);window.removeEventListener('message',listener);};
      const listener=event=>{
        if(event.source!==window||event.origin!==location.origin||event.data?.source!=='erase-companion'||event.data.requestId!==requestId)return;
        stop();const reply=event.data.reply;
        if(reply?.ok)resolve(reply.result);else reject(new Error(reply?.error||'The companion could not complete this action.'));
      };
      const timeout=setTimeout(()=>{stop();reject(new Error('The companion did not respond. Install it, enable broker access, then refresh this page. No repeat has been sent.'));},['run','continue','match','submit-details'].includes(payload.action)?60000:['focus-existing','identity-requirements','identity-result'].includes(payload.action)?5000:1500);
      window.addEventListener('message',listener);
      window.postMessage({source:'erase-workspace',requestId,payload},location.origin);
    });
  }
  const batchRunning=()=>batchView?.running===true;
  function setFillActions(){for(const action of fillActions)action.disabled=batchRunning();}
  function disposeSession(view){view.session?.dispose();view.session=null;}
  function resetBatchOptions(view){
    for(const input of [view.automate,view.mail])if(input){input.checked=false;input.disabled=true;}
    if(view.key){view.key.value='';view.key.disabled=true;}
    view.pendingMail=[];view.pendingContacts=[];view.contactList?.replaceChildren();if(view.contactPrepare)view.contactPrepare.disabled=true;
    view.mailList?.replaceChildren();view.mailScope?.replaceChildren();view.agreements?.replaceChildren();
  }
  function updateBatchOptions(view){
    const selected=view.pending.filter(entry=>entry.select.checked);
    if(view.automate){
      const contracts=selected.map(entry=>({route:W().routes().find(route=>route.id===entry.preview.routeId),contract:A()?.CONTRACTS?.[entry.preview.routeId]})).filter(entry=>entry.contract);
      view.automate.disabled=view.running||contracts.length===0;
      if(!contracts.length)view.automate.checked=false;
      view.agreements.replaceChildren();view.agreements.hidden=!view.automate.checked;
      if(view.automate.checked)for(const {route,contract}of contracts){
        const section=n('section',null,'form-batch-entry');section.append(n('h3',route.name),n('p',contract.consentText));
        if(contract.policyUrl)section.append(sourceNote(contract.policyUrl,'Read the policy named in this agreement',false));
        if(Array.isArray(contract.policyUrls))for(const [index,url]of contract.policyUrls.entries())section.append(sourceNote(url,'Read agreement source '+(index+1),false));
        view.agreements.append(section);
      }
      view.start.textContent=view.automate.checked?'Run selected form actions':'Fill selected forms';
    }
    if(view.mail){
      const formContacts=selected.filter(entry=>entry.mailContact);
      const contactSelected=view.pendingContacts.some(entry=>entry.select.checked);
      view.mail.disabled=view.running||(!formContacts.length&&!view.pendingMail.length);
      if(view.mail.disabled&&!view.running)view.mail.checked=false;
      view.key.disabled=view.running||Boolean(view.session)||(!view.mail.checked&&!contactSelected);view.keyLabel.hidden=!view.mail.checked&&!contactSelected;
      if(!view.mail.checked&&!contactSelected)view.key.value='';
      if(view.keyNote)view.keyNote.textContent=view.session?'The private key is available only for this open review. Closing or completing it clears access.':'Enter the private key once. It stays in memory only for this open review.';
      if(view.contactPrepare)view.contactPrepare.disabled=view.running||!contactSelected;
      view.mailScope.replaceChildren();
      for(const entry of formContacts){view.mailScope.append(n('p',(W().routes().find(route=>route.id===entry.preview.routeId)?.name||entry.preview.routeId)+': '+entry.mailContact+' — one receipt check after all selected forms finish, if this form has a qualifying submission result.','public-route-note'));
        if(entry.preview.routeId==='fastpeoplesearch')view.mailScope.append(n('p','If its authenticated confirmation is ready, open the official matching form using only the first name, last name and removal contact displayed above. No additional identity fields are filled or submitted.','public-route-note'));
      }
      view.mailOnce.disabled=view.running||!view.pendingMail.some(entry=>entry.select.checked);
    }
  }
  function batchMailSession(view,entries){
    if(!view.mail?.checked){if(view.key)view.key.value='';disposeSession(view);return null;}
    if(view.session)return view.session;
    let key=view.key.value.trim();view.key.value='';
    try{
      if(!entries.length)throw new Error('The selected forms have no bound removal-only contact. Turn off the mail option, or use the existing-mail check separately.');
      if(!/^[a-fA-F0-9]{64}$/.test(key))throw new Error('Enter the private removal-mail operator key. It is cleared after each click and never saved.');
      const continuationFields={};for(const entry of entries)if(entry.continuationFields)continuationFields[entry.routeId||entry.preview.routeId]={...entry.continuationFields};
      const session=S().create({workspace:W(),mail:M(),companion,operatorKey:key,continuationFields});view.session=session;return session;
    }finally{key='';}
  }
  function reviewedMailContext(entry,operationId=entry.operationId){
    const dashboard=W().dashboard(),item=dashboard.items.find(item=>item.site_id===(entry.routeId||entry.preview.routeId));
    return dashboard.profile.id===entry.profileId&&dashboard.campaign.status==='active'&&item?.held!==true&&
      item?.operation_id===operationId&&item.mail_contact?.contact_email===entry.mailContact&&
      (!entry.continuationIdentity||['first_name','last_name'].every(key=>item.input_fields?.[key]===entry.continuationIdentity[key]));
  }
  function reviewedContinuation(item){
    if(item.site_id==='fastpeoplesearch'&&['first_name','last_name'].every(key=>typeof item.input_fields?.[key]==='string'&&item.input_fields[key].trim()))return {};
    const fields=item.continuation_fields;
    return item.site_id==='usphonebook'&&['first_name','last_name'].every(key=>typeof item.input_fields?.[key]==='string'&&item.input_fields[key].trim())&&fields&&Object.keys(fields).length===3&&['city','state','zip_code'].every(key=>typeof fields[key]==='string')&&
      fields.city.trim()&&fields.city.length<=120&&!/[\r\n\x00<>]/.test(fields.city)&&/^[A-Z]{2}$/.test(fields.state)&&/^\d{5}$/.test(fields.zip_code)?{...fields}:null;
  }
  function batchDialog(){
    if(batchView)return batchView;
    const dialog=n('dialog');dialog.id='form-batch-dialog';dialog.setAttribute('aria-labelledby','form-batch-heading');
    const body=n('div',null,'dialog-body'),heading=n('h2','Review your form batch');heading.id='form-batch-heading';
    const description=n('p','Review the exact fields and destinations below. Selected forms run one at a time while this page stays open. Filling a form does not establish a submitted request or deletion. Broker agreements, CAPTCHA checks, record matching and verification may still need you.');
    const list=n('div',null,'form-batch-list'),results=n('div',null,'form-batch-status');results.setAttribute('role','status');results.setAttribute('aria-live','polite');
    const options=n('div',null,'form-batch-options');let automate=null,agreements=null,mail=null,key=null,keyLabel=null,keyNote=null,mailList=null,mailScope=null,contactList=null,contactPrepare=null;
    if(A()?.CONTRACTS){
      automate=n('input');automate.type='checkbox';automate.id='form-batch-automate';
      const label=n('label');label.className='checkbox-label';label.append(automate,n('span','Automatically submit only forms with the exact agreements displayed below.'));
      agreements=n('div',null,'form-batch-agreements');agreements.hidden=true;
      options.append(label,n('p','Reviewed submission is available for FastPeopleSearch, AdvancedBackgroundChecks, No Sorgulama, NumaraAra and NumaraSor. Other selected forms keep their existing fill behavior. Local text recognition is available only with an installed helper; managed challenges can still require attention.','public-route-note'),agreements);
    }
    if(S()&&M()){
      mail=n('input');mail.type='checkbox';mail.id='form-batch-mail';const label=n('label');label.className='checkbox-label';label.append(mail,n('span','Check the selected removal-only contacts once during this session.'));
      keyLabel=n('label','Private removal-mail operator key');key=n('input');key.id='form-batch-mail-key';key.type='password';key.maxLength=64;key.autocomplete='off';key.setAttribute('autocomplete','off');keyNote=n('span',null,'public-route-note');keyLabel.append(key,keyNote);keyLabel.hidden=true;
      mailList=n('div',null,'form-batch-mail-list');mailList.id='form-batch-mail-list';mailScope=n('div',null,'form-batch-mail-scope');
      if(C()){
        contactList=n('div',null,'form-batch-contact-list');contactList.id='form-batch-contact-list';
        contactPrepare=button('Prepare selected removal contacts',async()=>{
          if(batchRunning())return;
          const ids=view.pendingContacts.filter(entry=>entry.select.checked).map(entry=>entry.routeId);
          if(!ids.length){results.textContent='Select a supported removal contact first.';return;}
          let privateKey=key.value.trim();key.value='';
          if(!/^[a-fA-F0-9]{64}$/.test(privateKey)){privateKey='';results.textContent='Enter the private removal-mail operator key. No contact or broker action started.';return;}
          disposeSession(view);begin();view.controller=null;
          let retained=null;
          try{
            const controller=C().create({workspace:W(),mail:M(),onUpdate:snapshot=>{
              results.replaceChildren(n('p','Preparing removal contacts. No broker form is being submitted.'));
              for(const entry of snapshot.entries)results.append(n('p',(W().routes().find(route=>route.id===entry.routeId)?.name||entry.routeId)+': '+entry.status.replace(/_/g,' ')));
            }});view.controller=controller;
            const outcome=await controller.prepare(ids,{authorized:true,operatorKey:privateKey});
            if(view.stopping||!dialog.open||outcome.status!=='finished'){
              results.append(n('p','Contact preparation stopped. Review saved contacts before starting any form. No form was submitted.'));return;
            }
            // Retain access only in this open review. The later form approval
            // separately decides whether any mailbox check may run.
            const continuationFields={};for(const entry of [...view.pending,...view.pendingMail])if(entry.continuationFields)continuationFields[entry.routeId||entry.preview.routeId]={...entry.continuationFields};
            retained=S().create({workspace:W(),mail:M(),companion,operatorKey:privateKey,continuationFields});
          }catch(_){results.append(n('p','Contact preparation could not finish. Review saved contacts; no broker form or mail check was started.'));}
          finally{
            privateKey='';view.running=false;view.controller=null;stop.hidden=true;setFillActions();
            if(retained&&(!dialog.open||view.stopping)){retained.dispose();retained=null;}
            if(retained){
              try{await reviewFormBatch(view.opener,retained);retained=null;changed();}
              finally{retained?.dispose();}
            }else{disposeSession(view);for(const entry of [...view.pending,...view.pendingMail,...view.pendingContacts])entry.select.disabled=false;updateBatchOptions(view);approval.disabled=false;approval.checked=false;start.disabled=!view.pending.some(entry=>entry.select.checked);if(dialog.open)close.focus({preventScroll:true});}
          }
        },()=>!view.running&&view.pendingContacts.some(entry=>entry.select.checked));contactPrepare.id='form-batch-contact-prepare';
        options.append(n('h3','Removal-only contacts'),n('p','Select sites that may use a separate contact address, then prepare them together. This creates no broker request and reads no mail. The exact new addresses appear in a fresh review before any form starts. Record-associated email addresses stay unchanged.','public-route-note'),contactList,contactPrepare);
      }
      options.append(label,n('p','This optional private pilot checks only selected, bound removal-only contacts. It never connects to a personal inbox. Forms receive a single final mail pass after the form queue completes; mail arriving later requires a new explicit check. Closing the session stops further checks.','public-route-note'),mailScope,mailList,keyLabel);
    }
    const label=n('label');label.className='checkbox-label';
    const approval=n('input');approval.type='checkbox';approval.id='form-batch-approval';label.setAttribute('for',approval.id);label.append(approval,n('span',automate||mail?'I reviewed the selected brokers and exact fields. I authorize these form actions, the displayed submission agreements only when automatic submission is selected, and the selected removal-mail checks for my own information.':'I reviewed the selected brokers and exact fields. I authorize these form actions for my own information.'));
    const begin=()=>{
      view.running=true;view.stopping=false;approval.checked=false;approval.disabled=true;start.disabled=true;stop.hidden=false;stop.disabled=false;
      for(const entry of [...view.pending,...view.pendingMail,...view.pendingContacts])entry.select.disabled=true;
      if(contactPrepare)contactPrepare.disabled=true;
      for(const input of [automate,mail,key])if(input)input.disabled=true;
      if(mailOnce)mailOnce.disabled=true;setFillActions();stop.focus({preventScroll:true});
    };
    const finish=()=>{
      disposeSession(view);view.running=false;view.stopping=false;stop.hidden=true;setFillActions();
      view.pending=[];list.replaceChildren();resetBatchOptions(view);approval.checked=false;approval.disabled=true;start.disabled=true;
      if(mailOnce)mailOnce.disabled=true;
      results.append(n('p','Review a new batch to start any remaining forms. No action will repeat automatically.'));
      const focused=document.activeElement;
      let hidden=false;for(let parent=focused;parent&&parent!==dialog;parent=parent.parentElement)if(parent.hidden)hidden=true;
      if(dialog.open&&(!focused||focused===document.body||[start,stop,approval,mailOnce].includes(focused)||!focused.isConnected||focused.disabled||hidden))close.focus({preventScroll:true});
      changed();
    };
    const start=button('Fill selected forms',async()=>{
      if(batchRunning())return;
      if(!approval.checked){results.textContent='Review the selected forms and authorize this batch first.';return;}
      const selected=view.pending.filter(entry=>entry.select.checked).map(entry=>entry.preview);
      if(!selected.length){results.textContent='Select at least one eligible form.';return;}
      const automateSelected=automate?.checked===true,mailEntries=view.pending.filter(entry=>entry.select.checked&&entry.mailContact);
      let session;try{session=batchMailSession(view,mailEntries);}catch(error){results.textContent=error.message;return;}
      const mailEntriesById=new Map(mailEntries.map(entry=>[entry.preview.routeId,entry]));begin();
      let controller;
      try{
        controller=globalThis.EraseFormBatch.create({workspace:W(),companion,...(session?{afterForms:async({entries,isStopped})=>{
          const notes=[];
          for(const payload of entries){
            if(isStopped())break;
            const entry=mailEntriesById.get(payload.routeId);if(!entry)continue;
            if(!reviewedMailContext(entry,payload.operationId))return {status:'unknown',detail:'The reviewed removal-mail context changed. No further mailbox check started.'};
            const result=await session.process({...payload,isStopped});
            if(result?.detail)notes.push((W().routes().find(route=>route.id===payload.routeId)?.name||payload.routeId)+': '+result.detail);
            if(result?.status==='unknown')return {status:'unknown',detail:notes.join(' ')};
          }
          return {detail:notes.length?notes.join(' '):'No selected form produced a qualifying submission result. No mailbox check was started.'};
        }}:{}),onUpdate:snapshot=>{
          if(view.controller!==controller)return;
          results.replaceChildren(n('p',snapshot.status==='running'?'Form batch running.':'Form batch '+snapshot.status+'.'));
          if(snapshot.detail)results.append(n('p',snapshot.detail));
          for(const entry of snapshot.entries){const route=W().routes().find(route=>route.id===entry.routeId);results.append(n('p',(route?.name||entry.routeId)+': '+entry.status.replace(/_/g,' ')+(entry.detail?' — '+entry.detail:'')));}
        }});
        view.controller=controller;
        await controller.run(selected,{authorized:true,...(automateSelected?{automate:true}:{})});
      }catch(error){results.textContent=error?.message||'The form batch stopped. Check the existing broker tabs before starting another action.';}
      finally{
        finish();
      }
    },()=>!view.running&&view.pending.some(entry=>entry.select.checked));start.id='form-batch-start';
    const stop=button('Stop after current form',()=>{view.stopping=true;view.controller?.stop();disposeSession(view);results.append(n('p','Stopping after the current form. Unstarted forms and further mail checks will stay untouched.'));close.focus({preventScroll:true});},()=>!view.stopping);stop.id='form-batch-stop';stop.hidden=true;
    const close=button('Close review',()=>dialog.close());close.id='form-batch-close';
    const mailOnce=mail?button('Check existing removal mail once',async()=>{
      if(batchRunning())return;
      if(!mail.checked||!approval.checked){results.textContent='Select the one-pass mail option and authorize the selected removal-mail checks first.';return;}
      const entries=view.pendingMail.filter(entry=>entry.select.checked).map(entry=>({...entry}));
      let session;try{session=batchMailSession(view,entries);}catch(error){results.textContent=error.message;return;}
      begin();view.controller=null;results.replaceChildren(n('p','Checking selected existing removal contacts once.'));
      try{
        for(const entry of entries){
          if(view.stopping)break;
          if(!reviewedMailContext(entry)){view.stopping=true;results.append(n('p','The reviewed removal-mail context changed. No further mailbox check started.'));break;}
          const result=await session.process({routeId:entry.routeId,isStopped:()=>view.stopping});
          results.append(n('p',entry.name+': '+(result?.detail||'The explicit mail check finished without establishing deletion.')));
          if(result?.status==='unknown'){view.stopping=true;break;}
        }
      }catch(error){results.append(n('p',error?.message||'The removal-mail check could not continue. No form was repeated.'));}
      finally{finish();}
    },()=>!view.running&&view.pendingMail.some(entry=>entry.select.checked)):null;
    if(mailOnce)mailOnce.id='form-batch-mail-once';
    const actions=n('div',null,'dialog-actions');actions.append(start,...(mailOnce?[mailOnce]:[]),stop,close);body.append(heading,description,list,options,label,results,actions);dialog.append(body);document.body.append(dialog);
    const view={dialog,list,results,approval,start,stop,automate,agreements,mail,key,keyLabel,keyNote,mailList,mailScope,mailOnce,contactList,contactPrepare,pending:[],pendingMail:[],pendingContacts:[],session:null,running:false,reviewing:false,stopping:false,controller:null,opener:null};
    for(const input of [automate,mail])if(input)input.addEventListener('change',()=>{approval.checked=false;updateBatchOptions(view);});
    const cancelRemaining=()=>{view.revision=(view.revision||0)+1;if(batchRunning()){view.stopping=true;view.controller?.stop();}disposeSession(view);view.pending=[];list.replaceChildren();resetBatchOptions(view);approval.checked=false;start.disabled=true;if(mailOnce)mailOnce.disabled=true;};
    dialog.addEventListener('cancel',cancelRemaining);
    dialog.addEventListener('close',()=>{cancelRemaining();const opener=view.opener?.isConnected?view.opener:$('review-form-batch');opener?.focus({preventScroll:true});});
    batchView=view;return view;
  }
  async function reviewFormBatch(opener,retainedSession=null){
    const view=batchDialog();if(view.reviewing)return;view.opener=opener||document.activeElement;
    if(batchRunning()){if(!view.dialog.open)view.dialog.showModal();return;}
    const preparedContacts=Boolean(retainedSession);
    view.reviewing=true;const revision=(view.revision||0)+1;view.revision=revision;view.stopping=false;
    try{
    disposeSession(view);view.pending=[];view.controller=null;view.list.replaceChildren();view.results.replaceChildren();resetBatchOptions(view);view.approval.checked=false;view.approval.disabled=false;view.start.disabled=true;view.stop.hidden=true;view.stop.disabled=false;
    const dashboard=W().dashboard(),routes=W().routes(),candidates=[];
    const skipped=n('details',null,'form-batch-skips'),summary=n('summary','Forms needing attention and guided routes');skipped.append(summary);let skippedCount=0;
    const exclude=section=>{skipped.append(section);skippedCount++;};
    // Read every visible editor before awaiting persistence. A rerender cannot
    // replace a later route's fields halfway through this explicit review.
    for(const item of dashboard.items){
      const route=routes.find(route=>route.id===item.site_id);if(!route)continue;
      const eligibleCountry=route.countries.includes('*')||route.countries.includes(dashboard.profile.country);
      if(!eligibleCountry)continue;
      const section=n('section',null,'form-batch-entry');section.append(n('h3',route.name));
      if(route.automationLevel!=='companion'){section.append(n('p','Guided route: use the official instructions. Automatic form filling is unavailable.'));exclude(section);continue;}
      if(item.held===true||item.status==='held'){section.append(n('p','On hold. This route is excluded until you explicitly resume it.'));exclude(section);continue;}
      if(item.operation_id||['running','verification_sent','requested','uncertain','needs_broker_step','user_reported_requested','user_reported_completed'].includes(item.status)){section.append(n('p','Already started. Check the existing broker result; this action will not be repeated.'));exclude(section);continue;}
      const editor=formEditors.get(route.id);
      candidates.push({route,section,editable:editor?editor.read():null});
    }
    for(const {route,section,editable}of candidates){
      try{
        if(editable){
          for(const key of route.fields.filter(key=>key!=='email'))if(!editable.fields[key]?.trim())throw new Error('Provide '+(fieldSpecs[key]?.label||key.replace(/_/g,' '))+' in this route’s Request steps first.');
          await W().setEvidence(route.id,editable.fields,editable.affirmations,...(editable.review?[editable.review]:[]));if(view.revision!==revision)return;
        }
        const preview=await W().fillPreview(route.id);if(view.revision!==revision)return;
        const select=n('input');select.type='checkbox';select.checked=true;select.setAttribute('aria-label','Include '+route.name+' in this form batch');
        const selected=n('label');selected.className='checkbox-label';selected.append(select,n('span','Include '+route.name));section.append(selected);
        section.append(n('p','Official form: '+route.url,'public-route-note'));
        const fields=n('dl',null,'form-batch-fields');for(const [key,value]of Object.entries(preview.fields))fields.append(n('dt',fieldSpecs[key]?.label||(key==='email'?'Contact email':key.replace(/_/g,' '))),n('dd',value));section.append(fields);
        section.append(n('p',route.id==='peopledatalabs-form'?'Starts the broker’s verification-email step. Complete the later deletion steps with the broker.':'Fills the reviewed fields. Complete the broker’s submission, agreements and verification steps there.','public-route-note'));
        const item=dashboard.items.find(item=>item.site_id===route.id);
        view.pending.push({preview,select,profileId:dashboard.profile.id,mailContact:mailRoutes.has(route.id)?item?.mail_contact?.contact_email:null,continuationFields:item?reviewedContinuation(item):null});
        view.list.append(section);
        select.addEventListener('change',()=>{view.approval.checked=false;view.start.disabled=!view.pending.some(entry=>entry.select.checked);updateBatchOptions(view);});
      }catch(error){section.append(n('p','Needs detail: '+(error?.message||'Review this route’s required fields before filling.')));exclude(section);}
    }
    if(view.contactList)for(const item of dashboard.items){
      const route=routes.find(route=>route.id===item.site_id);
      if(!route||!newMailRoutes.has(route.id)||item.held||item.status==='held'||item.operation_id||item.mail_contact||dashboard.campaign.status!=='active'||!(route.countries.includes('*')||route.countries.includes(dashboard.profile.country)))continue;
      const select=n('input');select.type='checkbox';select.id='form-batch-contact-'+route.id;select.setAttribute('aria-label','Prepare a removal-only contact for '+route.name);
      const label=n('label');label.className='checkbox-label';label.append(select,n('span','Use a new removal-only contact for '+route.name));view.contactList.append(label);
      view.pendingContacts.push({routeId:route.id,select});select.addEventListener('change',()=>{view.approval.checked=false;if(select.checked)disposeSession(view);updateBatchOptions(view);});
    }
    if(view.contactList&&!view.pendingContacts.length)view.contactList.append(n('p','No new removal contacts are eligible. Held and already-started routes stay unchanged.','public-route-note'));
    if(view.mail)for(const item of dashboard.items){
      if(!mailRoutes.has(item.site_id)||!item.mail_contact||!item.operation_id||item.held||item.status==='held')continue;
      const route=routes.find(route=>route.id===item.site_id);if(!route)continue;
      if(!view.pendingMail.length)view.mailList.append(n('h3','Existing removal contacts'),n('p','Use Check existing removal mail once for these contacts. New forms receive one final check after the form queue finishes, only for qualifying submission results.','public-route-note'));
      const section=n('section',null,'form-batch-entry'),label=n('label'),select=n('input');select.type='checkbox';select.checked=true;select.id='form-batch-mail-route-'+route.id;
      const description='Check '+route.name+' removal-only contact once — '+item.mail_contact.contact_email;
      select.setAttribute('aria-label',description);label.className='checkbox-label';label.append(select,n('span',description));section.append(label);
      const continuationFields=reviewedContinuation(item);
      const continuationIdentity=continuationFields?{first_name:item.input_fields.first_name,last_name:item.input_fields.last_name,email:item.mail_contact.contact_email}:null;
      if(continuationFields){
        section.append(n('p',route.id==='fastpeoplesearch'?'If its authenticated confirmation is ready, open the official matching form using only these original name and removal-contact fields. No additional identity fields are filled or submitted.':'If its authenticated confirmation is ready, use only these reviewed confirmation fields. The broker can still require additional identity steps.','public-route-note'));
        const fields=n('dl',null,'form-batch-fields');for(const [key,value]of Object.entries({...continuationIdentity,...continuationFields}))fields.append(n('dt',key.replace(/_/g,' ')),n('dd',value));section.append(fields);
      }
      view.pendingMail.push({routeId:route.id,name:route.name,operationId:item.operation_id,profileId:dashboard.profile.id,mailContact:item.mail_contact.contact_email,continuationFields,continuationIdentity,select});view.mailList.append(section);
      select.addEventListener('change',()=>{view.approval.checked=false;updateBatchOptions(view);});
    }
    if(skippedCount){summary.textContent=skippedCount+' forms needing attention or guided routes';view.list.append(skipped);}
    view.start.disabled=view.pending.length===0;
    view.session=retainedSession;retainedSession=null;updateBatchOptions(view);
    view.results.textContent=view.pending.length?view.pending.length+(view.pending.length===1?' form is':' forms are')+' ready for your review. No broker has been contacted.':'No eligible forms are ready. Complete the required details and route confirmations, then review again.';
    if(!view.dialog.open)view.dialog.showModal();
    if(preparedContacts)view.approval.focus({preventScroll:true});
    }finally{retainedSession?.dispose();view.reviewing=false;}
  }
  function configure(){
    $('mode-badge').textContent='Browser workspace';
    $('signup-heading').textContent='Keep your privacy work here.';
    $('signup-panel').querySelector('button[type="submit"]').textContent='Create private workspace';
    $('signup-panel').querySelector('.form-description').textContent='Saved in this browser on this device. Your profile is not uploaded to Erase Me.';
    $('signup-consent').nextElementSibling.textContent='I’m requesting removal of my own information. I authorize only the broker actions I explicitly start, using the fields shown.';
    $('signup-panel').querySelector('.card-footnote').textContent=S()?'Use your own details. Complete the broker’s verification steps, or explicitly select a supported removal-only contact. Personal inboxes stay disconnected.':'Use your own details. Broker verification happens on each broker’s site and in emails you open yourself.';
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
        try{const selected=file.files[0];if(!selected)return;if(selected.size>1048576)throw new Error('Choose a backup smaller than 1 MiB.');await W().importData(await selected.text());changed();feedback('Your backup was restored as user-reported history. No broker was contacted.');}
        catch(error){$('signup-error').textContent=error.message;$('signup-error').hidden=false;}finally{file.value='';}
      });
      $('signup-panel').append(restore,file);
    }
    $('dashboard-heading').textContent='Your privacy work';
    $('listings-heading').textContent='Broker routes';
  }
  function reviewRequestSteps(routeId){
    const steps=$('request-steps-'+routeId);
    if(!steps)throw new Error('Choose All in Broker routes, then open this broker’s Request steps. No broker action was started.');
    steps.open=true;
    const summary=steps.querySelector('summary');summary?.focus({preventScroll:true});
    steps.scrollIntoView?.({block:'start',behavior:'auto'});
  }
  function nextStepsPanel(dashboard){
    if(!N())return null;
    const cards=N().build(dashboard);
    if(!cards.length&&dashboard.campaign.status==='active')return null;
    const panel=n('section',null,'next-steps-panel');panel.id='next-steps-panel';panel.setAttribute('aria-labelledby','next-steps-heading');
    const heading=n('h2','Next steps');heading.id='next-steps-heading';panel.append(heading);
    if(dashboard.campaign.status!=='active'){
      panel.append(n('p','Your privacy work is paused. Resume it when you want to continue. Held requests stay on hold.'));return panel;
    }
    panel.append(n('p','Each request shows the email it uses and the information the broker still needs.','next-steps-intro'));
    for(const card of cards){
      const article=n('article',null,'next-step-card'),title=n('h3',card.title.includes(card.name)?card.title:card.name+': '+card.title);title.id='next-step-'+card.routeId+'-heading';article.id='next-step-'+card.routeId;article.setAttribute('aria-labelledby',title.id);article.append(title);
      const email=n('p',null,'next-step-email');
      if(card.email){
        const value=n('bdi',card.email);value.setAttribute('dir','ltr');
        email.append(n('span','Email for this request'),value);
        const role=card.emailRole==='removal'?'Separate removal-only contact':card.emailRole==='business'?'Your approved business email':'Your email for this request';
        email.append(n('span',role,'next-step-email-role'));
      }else email.append(n('span','The original request email was not recorded. Review the existing request before choosing an address.'));
      const instruction=n('p',card.detail);instruction.id='next-step-'+card.routeId+'-instruction';article.append(email,instruction);
      const actions=n('div',null,'public-route-actions');
      if(card.action==='collect'&&D()){
        const enter=button('Enter missing information',async()=>{
          if(!identityDialog)identityDialog=D().create({workspace:W(),companion,document,onChange:changed,onFeedback:feedback});
          await identityDialog.open(card.routeId,enter);
        });enter.id='next-step-'+card.routeId+'-primary';enter.setAttribute('aria-label','Enter missing information for '+card.name);enter.setAttribute('aria-describedby',instruction.id);actions.append(enter);
      }
      if(card.action==='focus'){
        const help=n('p','Switches to the official form already open in desktop Chrome.','public-route-note');help.id='next-step-'+card.routeId+'-help';article.append(help);
        const expected={profileId:dashboard.profile.id,operationId:dashboard.items.find(item=>item.site_id===card.routeId)?.operation_id};
        const current=()=>{
          const next=W().dashboard(),item=next.items.find(item=>item.site_id===card.routeId),fresh=N().build(next).find(item=>item.routeId===card.routeId);
          if(next.profile.id!==expected.profileId||next.campaign.status!=='active'||item?.held||item?.operation_id!==expected.operationId||
            !fresh||['kind','action','stage','email'].some(key=>fresh[key]!==card[key]))throw new Error('This request changed. Review its current next step before continuing.');
        };
        const label=card.kind==='detail_required'?'Provide missing information':'Return to existing form';
        const focus=button(label,async()=>{
          current();const request=await W().focusRequest(card.routeId,card.stage);current();
          const ping=await companion({action:'ping'});current();
          if(!ping.capabilities?.includes('owned-tab-focus-v1'))throw new Error('Update the Chrome companion to return to an existing form. You can also find that tab in Chrome yourself.');
          const fresh=await W().focusRequest(card.routeId,card.stage);current();
          if(JSON.stringify(fresh)!==JSON.stringify(request))throw new Error('The existing form reference changed. Review this request again.');
          const result=await companion({action:'focus-existing',...fresh});
          feedback(result?.status==='focused'&&result.routeId===card.routeId&&result.stage===card.stage?
            card.name+'’s existing form is open in Chrome. Use the request email shown here and provide the information requested there.':
            'The existing '+card.name+' form could not be verified. Find its current tab in Chrome or review the request steps below. No new form was opened or request repeated.');
        });focus.id='next-step-'+card.routeId+'-primary';focus.setAttribute('aria-label',label+' for '+card.name);focus.setAttribute('aria-describedby',help.id);actions.append(focus);
      }
      const review=button('Review request steps',()=>reviewRequestSteps(card.routeId));review.id='next-step-'+card.routeId+'-review';review.setAttribute('aria-label','Review request steps for '+card.name);actions.append(review);article.append(actions);panel.append(article);
    }
    return panel;
  }
  function tools(){
    let box=$('public-tools');
    if(!box){box=n('div',null,'public-tools');box.id='public-tools';$('campaign-feedback').after(box);}
    let returnId=null;for(let node=document.activeElement;node;node=node.parentElement)if(node===box){returnId=document.activeElement.id;break;}
    box.hidden=false;
    box.replaceChildren();
    const dashboard=W().dashboard(),steps=nextStepsPanel(dashboard);if(steps)box.append(steps);
    const coverage=dashboard.coverage;
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
    box.append(n('p',A()||S()?'Install the desktop Chrome companion for reviewed form actions. Automatic submission and one-pass removal-mail checks are optional. Other broker verification can still need your attention.':'For automatic form filling, install the desktop Chrome companion once. Official forms also work without it. Broker email and CAPTCHA steps remain yours.','public-route-note'),download,instructions,connect,exportButton);
    if(globalThis.EraseFormBatch){const review=button('Review form batch',()=>reviewFormBatch(review));review.id='review-form-batch';box.append(review);}
    if(A())box.append(button('Check local challenge helper',async()=>{
      const status=await companion({action:'helper-status'});
      if(status?.available!==true||typeof status.image!=='boolean'||typeof status.audio!=='boolean'){feedback('The local challenge helper is unavailable. Install and enable it separately to use supported local recognition. No challenge was attempted.');return;}
      feedback('Local challenge helper connected. Text-image recognition: '+(status.image?'available':'unavailable')+'. Audio recognition: '+(status.audio?'available':'unavailable')+'. These capabilities do not guarantee passage through broker challenges. No challenge was attempted.');
    }));
    if(M())box.append(button('Check removal-mail availability',async()=>{
      mailStatus=await M().status();changed();
      feedback(mailStatus.enabled?'The removal-mail relay is available as a private operator pilot. It checks receipts on demand. Reviewed USPhonebook and FastPeopleSearch confirmations can open their matching forms under the displayed approval. Required identity details and final broker steps remain outstanding.':mailStatus.configured?'The dedicated mailbox is configured, but the private pilot is disabled. Personal inboxes stay disconnected.':'The dedicated removal mailbox is not connected. Use the broker’s own email steps. Personal inboxes stay disconnected.');
    }),n('p',S()?'Optional removal-mail checks are a gated operator pilot using a separate account. A private key is held only for the session you approve. Checks make one pass; they never run on a schedule. Only displayed, reviewed confirmation fields can continue automatically.':'Optional removal-mail checks are a gated operator pilot. They use a separate account, require a private key for each action and never run on a schedule. Each reviewed confirmation needs an explicit continuation.','public-route-note'));
    if(globalThis.EraseFootprintUI){
      if(!footprintPanel)footprintPanel=globalThis.EraseFootprintUI.create({workspace:W(),document,onChange:changed,onFeedback:feedback});
      box.append(footprintPanel.render(dashboard));
    }
    if(returnId){const target=$(returnId);if(target&&!target.disabled)target.focus({preventScroll:true});}
  }
  function mailControls(route,item){
    if(!mailRoutes.has(route.id)||!M()||!mailStatus?.enabled)return null;
    if(item.held)return n('p','Removal-mail actions are on hold for this route. Existing receipt history stays available; explicitly resume before any new mailbox action.','public-route-note');
    if(route.id==='searchpeoplefree'&&!item.mail_contact)return n('p','SearchPeopleFree requires an email you own. It uses your typed email; a shared removal contact is not offered.','public-route-note');
    const panel=n('details',null,'public-mail-pilot');panel.append(n('summary','Operator removal-mail pilot'));
    panel.append(n('p','A removal contact sends broker mail to Erase Me’s shared, removal-only account. Its operator can read those broker messages. It is not an email address personally owned by you. Review the broker’s consent terms and use it only where an authorized contact address is accepted. Your personal inbox stays disconnected. A reviewed USPhonebook or FastPeopleSearch confirmation can open its matching form only under your displayed approval.','public-route-note'));
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
      feedback(result.status==='held'?(result.continuation_available?route.id==='fastpeoplesearch'?'An authenticated FastPeopleSearch confirmation is ready. Review the original name and removal contact before opening its matching form. No request acceptance or deletion has been established.':'An authenticated USPhonebook confirmation is ready. Review the required city, state and ZIP before choosing Continue broker form. No request acceptance or deletion has been established.':'An authenticated removal-related email is held for broker-route validation. No confirmation link was followed, and deletion remains unverified.'):'No qualifying email was found for this operation in this explicit check. No broker action was repeated.');
    }));
    if(!item.held&&route.id==='fastpeoplesearch'&&item.mail_receipt?.authenticated&&item.mail_receipt.continuation_available&&!item.continuation){
      panel.append(n('p','Open only the authenticated FastPeopleSearch matching form. The companion checks the original first name, last name and removal contact already present there. It fills no date of birth, street address, phone or other identity details and does not submit the form. The broker requires date of birth or street address, plus location details, before final submission.','public-route-note'));
      panel.append(n('p','First name: '+(item.input_fields?.first_name||'')+'. Last name: '+(item.input_fields?.last_name||'')+'. Removal contact: '+item.mail_contact.contact_email+'.','public-field-disclosure'));
      const label=n('label','I reviewed the original name and removal contact and authorize opening this verified matching form.');const agreed=n('input');agreed.type='checkbox';agreed.setAttribute('aria-label',route.name+' '+label.textContent);label.append(agreed);panel.append(label);
      panel.append(button('Open verified matching form',async()=>{
        if(!agreed.checked)throw new Error('Review the original name and removal contact before opening this matching form.');
        const expected={routeId:route.id,profileId:W().profile().id,operationId:item.operation_id,mailContact:item.mail_contact.contact_email,
          continuationIdentity:{first_name:item.input_fields?.first_name,last_name:item.input_fields?.last_name}};
        const current=()=>{if(!reviewedMailContext(expected))throw new Error('The reviewed workspace or contact changed. No further confirmation action started.');};
        let pilotKey=takeKey();
        try{
          current();const ping=await companion({action:'ping'});current();
          if(!ping.routes?.includes(route.id)||!ping.capabilities?.includes('fastpeoplesearch-continuation-v1'))throw new Error('Update and enable the companion for FastPeopleSearch before opening this matching form.');
          const request=await W().mailContinuationRequest(route.id,{});current();
          const response=await M().continuation(request,pilotKey);current();
          const operation=await W().prepareMailContinuation(route.id,response,{});changed();
          let result;try{result=await companion({action:'continue',...operation});}catch(_){result={status:'unknown',detail:'The matching-form outcome is unknown. Check its existing tab; no replay will be sent.'};}
          await W().recordMailContinuation(route.id,operation.operationId,result);changed();feedback(result.detail||'Matching-form outcome recorded. Request acceptance and deletion remain unverified.');
        }finally{pilotKey='';}
      }));
    }
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
    const review=n('label','This concerns my own information, and I authorize preparing this local draft.');review.className='wide';const agreed=n('input');agreed.type='checkbox';agreed.setAttribute('aria-label',route.name+' '+review.textContent);review.append(agreed);fields.append(review);panel.append(fields);
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
    formEditors.clear();fillActions.clear();
    const routes=W().routes();
    for(const [index,row] of [...$('listing-items').children].entries()){
      // Filtering can change row order, so associate the stable site name.
      const title=row.querySelector('.listing-title');const route=routes.find(r=>r.name===title?.textContent);if(!route)continue;
      const item=items.find(i=>i.site_id===route.id);if(!item)continue;
      const info=row.querySelector('.listing-info'),fields=n('div',null,'public-route-fields'),actions=n('div',null,'public-route-actions');
      const values={},affirmations={};let listingReview=item.automatic_match?{automaticReference:item.match_reference||''}:null;
      for(const key of route.fields.filter(k=>k!=='email')){
        const spec=fieldSpecs[key];if(!spec)continue;
        const label=n('label',spec.label);if(spec.textarea)label.className='wide';
        const input=n(spec.textarea?'textarea':'input');if(spec.textarea){input.rows=6;input.className='public-request-text';}else input.type=spec.type;input.maxLength=spec.max;input.value=item.input_fields?.[key]||(key==='full_name'?W().profile().name||'':'');input.disabled=Boolean(item.operation_id)||item.held===true;
        input.setAttribute('aria-label',route.name+' '+label.textContent);values[key]=input;label.append(input);fields.append(label);
      }
      for(const key of route.requiredAffirmations){
        const manual='I reviewed this exact listing and confirm it is my own information.';
        const statement=key==='business_email'?'This is the business email associated with my own Apollo record, and I authorize using it for removal.':key==='own_request'?'I reviewed these fields and confirm this request concerns my own information.':item.automatic_match?'This listing has a current automatic match using my name and identity email.':manual;
        const label=n('label',key==='own_listing'&&item.automatic_match?'':statement),caption=key==='own_listing'&&item.automatic_match?n('span',statement):null;if(caption)label.append(caption);
        const input=n('input');input.type='checkbox';input.checked=item.affirmations?.[key]===true;input.disabled=Boolean(item.operation_id)||item.held===true;
        input.setAttribute('aria-label',route.name+' '+statement);affirmations[key]=input;label.append(input);fields.append(label);
        if(key==='own_listing')input.addEventListener('change',()=>{if(input.checked){listingReview={manualListingReview:true};if(caption)caption.textContent=manual;input.setAttribute('aria-label',route.name+' '+manual);}});
        for(const value of Object.values(values))value.addEventListener('input',()=>{input.checked=false;if(caption){caption.textContent=manual;input.setAttribute('aria-label',route.name+' '+manual);}});
      }
      const read=()=>{const evidence={},confirmed={};for(const [key,input]of Object.entries(values))evidence[key]=['request_text','phone'].includes(key)?input.value:input.value.trim();for(const [key,input]of Object.entries(affirmations))confirmed[key]=input.checked===true;return{fields:evidence,affirmations:confirmed,...(listingReview?{review:{...listingReview}}:{})};};
      formEditors.set(route.id,{read});
      const save=async()=>{const candidate=read(),saved=await W().setEvidence(route.id,candidate.fields,candidate.affirmations,...(candidate.review?[candidate.review]:[]));return{fields:saved,affirmations:candidate.affirmations};};
      const open=button('Open official form',async()=>{
        await W().opened(route.id);
        window.open(route.url,'_blank','noopener,noreferrer');changed();feedback('Opening the official broker form was requested. If no tab appears, allow popups for this site. No request has been recorded as sent.');
      });if(!item.held)actions.append(open);
      if(!item.held&&route.searchable)actions.append(button('Find my listing',async()=>{
        const request=await W().searchRequest(route.id);
        window.open(request.url,'_blank','noopener,noreferrer');changed();feedback('Opening a Google search was requested. Google receives your name and optional city. Review each candidate yourself; no listing match or removal was established.');
      }));
      if(route.id==='spokeo'&&!item.held&&!item.operation_id&&typeof W().matchRequest==='function'){
        const match=button('Match this record',async()=>{
          if(batchRunning())throw new Error('Wait for the current session or stop its remaining actions first.');
          const listingUrl=values.listing_url?.value.trim();if(!listingUrl)throw new Error('Enter your public Spokeo record URL before starting a matching check.');
          const request=await W().matchRequest(route.id,listingUrl);let result;
          try{result=await companion({action:'match',...request});}catch(_){result={status:'unknown',detail:'The matching connection was interrupted. No identity approval was established.'};}
          await W().recordMatch(route.id,request.operationId,result);changed();
          const current=W().dashboard().items.find(item=>item.site_id===route.id);
          feedback(current?.automatic_match?'This record has a current automatic match using your name and identity email. No removal request or deletion was established.':'This check did not establish an automatic identity match. Review your own record or supply the missing identity detail; no removal action was started.');
        },()=>!batchRunning());match.disabled=batchRunning();fillActions.add(match);actions.append(match);
      }
      const supported=route.automationLevel==='companion';
      if(!item.held&&supported&&!item.operationId&&!item.operation_id){
        const fill=button(route.id==='peopledatalabs-form'?'Start broker verification':'Fill with companion',async()=>{
          if(batchRunning())throw new Error('Wait for the current form batch or stop its remaining forms first.');
          const reviewed=await save();const ping=await companion({action:'ping'});
          if(!ping.routes?.includes(route.id))throw new Error('Open the companion toolbar icon and enable this broker before starting.');
          if(['apollo','spokeo'].includes(route.id)&&!ping.capabilities?.includes('explicit-fields-v1'))throw new Error('Update the companion from the current download and refresh this workspace. No new action started.');
          if(route.requiredAffirmations.includes('own_request')&&!ping.capabilities?.includes('structured-fields-v1'))throw new Error('Update the companion from the current download to use reviewed structured request fields. No new action started.');
          const operation=await W().prepare(route.id,reviewed);changed();
          let result;
          try{result=await companion({action:'run',...operation});}catch(error){result={status:'unknown',detail:'The companion outcome is unknown. Check the broker tab before doing anything further.'};}
          await W().recordCompanion(route.id,operation.operationId,result);changed();feedback(result.detail||'The companion step is recorded. Finish the broker steps.');
        });fill.disabled=batchRunning();fillActions.add(fill);actions.append(fill);
      }
      const operationId=item.operationId||item.operation_id;
      if(operationId&&!item.status.startsWith('user_reported'))actions.append(button('Read companion result',async()=>{const result=await companion({action:'result',routeId:route.id,operationId});await W().recordCompanion(route.id,operationId,result);changed();feedback(result.detail||'Companion result checked.');}));
      if(operationId&&item.continuation)actions.append(button('Read confirmation-form result',async()=>{const result=await companion({action:'continuation-result',routeId:route.id,operationId});await W().recordMailContinuation(route.id,operationId,result);changed();feedback(result.detail||'Confirmation-form result checked. No action was repeated.');}));
      if(operationId&&item.final_submission)actions.append(button('Read final submission result',async()=>{
        const request=await W().identityResultRequest(route.id),result=await companion({action:'identity-result',...request});
        await W().recordIdentitySubmission(route.id,request.submissionId,result);changed();feedback('The saved final submission result was checked. No form was repeated; acceptance and deletion remain unverified.');
      }));
      if(!item.held&&operationId)actions.append(button('Check existing broker tab',async()=>{
        const ping=await companion({action:'ping'});if(!ping.capabilities?.includes('broker-observation-v1'))throw new Error('Update the companion to check an existing broker tab without repeating its action.');
        const request=await W().observationRequest(route.id),result=await companion({action:'observe',...request});await W().recordObservation(route.id,operationId,result);changed();feedback(result.detail||'The existing broker outcome was checked. No action was repeated.');
      }));
      if(!item.held){
        actions.append(button('I submitted the request',async()=>{await W().recordUser(route.id,'user_reported_requested');changed();feedback('Your report of submitting a request is saved. Broker acceptance and deletion remain unverified.');}));
        actions.append(button('I finished the broker steps',async()=>{await W().recordUser(route.id,'user_reported_completed');changed();feedback('Your completion report is saved. It is not counted as a verified deletion.');}));
        actions.append(button('Hold this route',async()=>{await W().holdRoute(route.id);changed();feedback('This route is on hold. No new broker or mailbox action will start until you explicitly resume it.');}));
      }else actions.append(button('Resume this route',async()=>{await W().resumeRoute(route.id);changed();feedback('This route was explicitly resumed. Its existing operation references still prevent repeated actions.');}));
      const steps=n('details',null,'public-broker-steps');steps.id='request-steps-'+route.id;
      steps.append(n('summary','Request steps'),n('p',route.steps.join(' '),'public-route-note'));
      if(fields.children.length)steps.append(fields);
      if(route.searchable)steps.append(n('p','Find my listing opens a Google search only when you choose it. Google receives your name and optional city. Review candidates yourself; a search is not evidence that a listing belongs to you.','public-route-note'));
      if(route.manualGroup==='peopleconnect'){
        const explanation=n('p','Use the Intelius / PeopleConnect route for one manual personal-use suppression session covering the four named report brands. Other brands and report types are not automatically covered.','public-route-note');
        steps.append(explanation);
      }
      if(route.fields.includes('email')){
        const address=item.operation_email||item.mail_contact?.contact_email||(!operationId?W().profile().email:null);
        steps.append(n('p',address?(operationId?'Email used for this request: ':'Email to use for this broker: ')+address+(item.operation_email_role==='removal'||item.mail_contact?' (separate removal-only contact)':' (your typed profile email)'):'The original email for this earlier request was not recorded. Check its existing broker history before choosing an address.','public-field-disclosure'));
      }
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
