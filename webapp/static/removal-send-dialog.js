/* Exact-message approval for one local, separate-account privacy email. */
(function(root,factory){const send=typeof module==='object'&&module.exports?require('./removal-send.js'):root.EraseRemovalSend;const api=factory(send);if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseRemovalSendDialog=api;})(typeof globalThis==='object'?globalThis:this,function(send){
  'use strict';
  function create({workspace,companion,document,onChange=()=>{},onFeedback=()=>{}}){
    const n=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
    const dialog=n('dialog');dialog.id='removal-send-dialog';dialog.setAttribute('aria-labelledby','removal-send-heading');
    const body=n('div');body.className='dialog-body';const heading=n('h2','Review a removal email');heading.id='removal-send-heading';
    const intro=n('p','Use your separate, send-enabled removal-only Gmail. Review the exact sender, recipient and message before authorizing one send. No personal inbox is connected.');
    const destination=n('p'),source=n('a','Official privacy contact source');source.target='_blank';source.rel='noopener noreferrer';
    const form=n('form');form.id='removal-send-form';form.setAttribute('autocomplete','off');
    const label=n('label','Your own public listing or listed-record reference'),reference=n('input');reference.id='removal-send-reference';reference.type='text';reference.maxLength=512;reference.required=true;reference.autocomplete='off';label.setAttribute('for',reference.id);label.append(reference);
    const ownLabel=n('label'),own=n('input');own.type='checkbox';own.id='removal-send-own';ownLabel.className='checkbox-label';ownLabel.append(own,n('span','This is my own public record. I authorize preparing a message using this reference and my profile name.'));
    const prepare=n('button','Prepare exact email');prepare.type='submit';prepare.id='removal-send-prepare';prepare.className='button button-secondary';form.append(label,n('p','Enter your public listing URL or the email identifying your own listed record. This reference is included in the exact message you review. Leave passwords, private verification links, ID numbers and documents out.'),ownLabel,prepare);
    const review=n('section');review.id='removal-send-review';review.hidden=true;const headers=n('dl'),message=n('textarea');message.id='removal-send-message';message.readOnly=true;message.rows=12;message.setAttribute('aria-label','Exact privacy request email');
    const approveLabel=n('label'),approve=n('input');approve.type='checkbox';approve.id='removal-send-approval';approveLabel.className='checkbox-label';approveLabel.append(approve,n('span','I reviewed this exact message and authorize sending it once from my separate removal-only account.'));
    const transmit=n('button','Send reviewed email once');transmit.type='button';transmit.id='removal-send-once';transmit.className='button button-primary';transmit.disabled=true;
    const edit=n('button','Discard draft and edit');edit.type='button';edit.className='button button-secondary';edit.id='removal-send-edit';review.append(headers,message,approveLabel,transmit,edit);
    const status=n('p');status.id='removal-send-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const close=n('button','Close');close.type='button';close.className='button button-secondary';close.id='removal-send-close';
    body.append(heading,intro,destination,source,form,review,status,close);dialog.append(body);document.body.append(dialog);
    let epoch=0,client=null,routeId=null,profileId=null,ready=false,running=false,opener=null;
    const sameProfile=id=>{try{return workspace.profile().id===id;}catch(_){return false;}};
    function editable(value){reference.disabled=!value;own.disabled=!value;prepare.disabled=!value;approve.disabled=!value;edit.disabled=!value;transmit.disabled=!value||!ready||!approve.checked;}
    function clearReview(){ready=false;headers.replaceChildren();message.value='';approve.checked=false;review.hidden=true;transmit.disabled=true;}
    reference.addEventListener('input',()=>{own.checked=false;});
    approve.addEventListener('change',()=>{transmit.disabled=running||!ready||!approve.checked;});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(running||!client||!own.checked||!form.reportValidity())return;
      const revision=epoch,current=client,expected=profileId;running=true;editable(false);status.textContent='Checking the separate account and preparing the exact message. No email has been sent.';
      try{
        const value=await current.prepare(routeId,reference.value.trim());
        if(revision!==epoch||!dialog.open||!sameProfile(expected)){await current.cancel();return;}
        headers.replaceChildren();for(const [caption,text]of [['From',value.preview.from],['To',value.preview.to],['Subject',value.preview.subject]])headers.append(n('dt',caption),n('dd',text));
        message.value=value.preview.body;reference.value='';own.checked=false;form.hidden=true;review.hidden=false;ready=true;approve.checked=false;
        status.textContent='Review every field. Google accepting an email for sending does not prove delivery, broker acceptance or deletion.';onChange();approve.focus({preventScroll:true});
      }catch(error){if(revision===epoch&&sameProfile(expected))status.textContent=error?.message||'The email preview could not be prepared. Review its saved operation before trying again.';}
      finally{running=false;if(revision===epoch)editable(true);}
    });
    transmit.addEventListener('click',async()=>{
      if(running||!ready||!approve.checked||!client)return;
      const revision=epoch,current=client,expected=profileId;running=true;editable(false);approve.checked=false;
      status.textContent='Sending the one approved message. An interrupted send is not automatically repeated.';
      try{
        const value=await current.send({authorized:true,own_request:true});onChange();
        if(revision!==epoch||!dialog.open||!sameProfile(expected))return;
        status.textContent=value.status==='provider_accepted'?'Google accepted this email for sending. Delivery, broker acceptance and deletion are still unverified.':value.status==='smtp_accepted'?'Gmail’s SMTP server accepted the approved message for sending. This local receipt does not prove delivery, broker acceptance or deletion.':'The email outcome is unconfirmed. Read its existing send result before taking another action; no automatic repeat was sent.';
        ready=false;transmit.disabled=true;edit.disabled=true;onFeedback(status.textContent);
      }catch(error){if(revision===epoch&&sameProfile(expected))status.textContent=error?.message||'The email outcome is uncertain. Check the existing result before sending anything else.';}
      finally{running=false;if(revision===epoch){approve.disabled=true;transmit.disabled=true;edit.disabled=current.isDispatched()||!sameProfile(expected);}}
    });
    edit.addEventListener('click',async()=>{
      if(running||!client||client.isDispatched())return;
      const revision=epoch,expected=profileId,current=client;running=true;editable(false);
      try{
        const value=await current.cancel();if(value.status!=='revoked')throw new Error('The prior draft is not confirmed canceled. Reconcile it before preparing another.');
        await workspace.resetMailSend(routeId,{authorized:true,profileId:expected});onChange();
        if(revision!==epoch||!dialog.open||!sameProfile(expected))return;
        client=send.create({workspace,companion,profileId:expected});clearReview();form.hidden=false;status.textContent='The unsent draft was revoked. Enter and review the new reference.';
      }catch(error){if(revision===epoch&&sameProfile(expected))status.textContent=error?.message||'The draft could not be safely reset.';}
      finally{running=false;if(revision===epoch)editable(true);}
    });
    function stop(){
      epoch++;const current=client,expected=profileId;client=null;routeId=null;profileId=null;reference.value='';own.checked=false;clearReview();destination.textContent='';source.removeAttribute('href');status.textContent='';form.hidden=false;
      if(current&&!current.isDispatched())current.cancel().then(value=>{onChange();if(sameProfile(expected)&&!['revoked','pending','already_bound'].includes(value.status))onFeedback('The email review is closed. Draft revocation could not be confirmed; reconcile its saved state before starting another.');}).catch(()=>{if(sameProfile(expected))onFeedback('The email review is closed. Local grant cleanup could not be confirmed; no automatic send will start.');});
    }
    close.addEventListener('click',()=>dialog.close());dialog.addEventListener('cancel',stop);dialog.addEventListener('close',()=>{stop();if(opener?.isConnected)opener.focus({preventScroll:true});});
    async function open(id,expectedProfileId,sourceButton,initialReference=''){
      if(dialog.open)throw new Error('Close the existing email review before opening another.');
      if(running)throw new Error('Wait for the current email operation before opening another review.');
      if(!sameProfile(expectedProfileId)||!Object.hasOwn(send.ROUTES,id))throw new Error('Review a current supported privacy channel first.');
      epoch++;clearReview();client=send.create({workspace,companion,profileId:expectedProfileId});routeId=id;profileId=expectedProfileId;opener=sourceButton||document.activeElement;
      reference.value=initialReference;own.checked=false;form.hidden=false;editable(true);destination.textContent='Fixed privacy recipient: '+send.ROUTES[id].to;source.href=send.ROUTES[id].source;
      status.textContent='This prepares an email only. Sending remains off until you review the exact message and approve it separately.';if(!dialog.open)dialog.showModal();reference.focus({preventScroll:true});
    }
    return Object.freeze({open});
  }
  return Object.freeze({create});
});
