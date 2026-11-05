/* Missing identity details stay in this open dialog, outside the workspace ledger. */
(function(root,factory){
  const details=typeof module==='object'&&module.exports?require('../../extension/identity-details.js'):root.EraseIdentityDetails;
  const api=factory(details);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseIdentityDialog=api;
})(typeof globalThis==='object'?globalThis:this,function(details){
  'use strict';
  function create({workspace,companion,document,onChange=()=>{},onFeedback=()=>{}}){
    const n=(tag,text)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
    const dialog=n('dialog');dialog.id='identity-details-dialog';dialog.setAttribute('aria-labelledby','identity-details-heading');
    const body=n('div');body.className='dialog-body';
    const heading=n('h2','Complete your broker request');heading.id='identity-details-heading';
    const introduction=n('p','Enter the missing information here, then review the exact fields before Erase Me fills and submits the supported broker form.');
    const privacy=n('p','Erase Me does not save these details in your workspace or backup. They are sent only to the named broker after you approve this attempt.');privacy.className='public-route-note';
    const recipient=n('p');recipient.className='public-field-disclosure';recipient.id='identity-details-recipient';
    const requirementsNote=n('p');requirementsNote.className='identity-requirements-note';requirementsNote.id='identity-details-requirements';
    const form=n('form');form.id='identity-details-form';form.setAttribute('autocomplete','off');
    const fields=n('div');fields.className='identity-details-fields';
    const input=(name,labelText,type,max)=>{const label=n('label',labelText),control=n('input');control.id='identity-details-'+name;control.type=type;control.autocomplete='off';control.setAttribute('autocomplete','off');if(max)control.maxLength=max;label.setAttribute('for',control.id);label.append(control);fields.append(label);return {label,control};};
    const methodLabel=n('label','Choose the information to provide'),method=n('select');method.id='identity-details-method';method.required=true;methodLabel.setAttribute('for',method.id);
    const methods={};for(const [value,text]of [['','Choose which reviewed information to provide'],['date_of_birth','Full date of birth'],['street_address','Current street address'],['full_matching_details','All fields required by the current form']]){const option=n('option',text);option.value=value;methods[value]=option;if(!value){option.disabled=true;option.selected=true;}method.append(option);}methodLabel.append(method);methodLabel.className='wide';fields.append(methodLabel);
    const birth=input('birth','Full date of birth','date'),street=input('street','Current street address','text',200),phone=input('phone','Phone number required by this broker form','tel',30),city=input('city','Current city','text',120),state=input('state','US state abbreviation','text',2),zip=input('zip','ZIP code','text',5);
    birth.label.className='wide';street.label.className='wide';city.label.className='wide';state.control.placeholder='CA';state.control.autocapitalize='characters';zip.control.inputMode='numeric';zip.control.pattern='[0-9]{5}';
    for(const field of [city,state,zip])field.control.required=true;
    const reviewButton=n('button','Review fields');reviewButton.type='submit';reviewButton.className='button button-secondary';reviewButton.id='identity-details-review';form.append(fields,reviewButton);
    const review=n('section');review.id='identity-details-disclosure';review.hidden=true;review.setAttribute('aria-labelledby','identity-details-review-heading');
    const reviewHeading=n('h3','Review what will be sent');reviewHeading.id='identity-details-review-heading';const disclosure=n('dl');disclosure.className='form-batch-fields';
    const warning=n('p'),agreement=n('p'),approvalLabel=n('label'),approval=n('input');approval.type='checkbox';approval.id='identity-details-approval';approvalLabel.className='checkbox-label';approvalLabel.setAttribute('for',approval.id);approvalLabel.append(approval,n('span','I confirm these details concern my own information and authorize this one form submission with the statement above.'));
    const submit=n('button','Fill and submit once');submit.type='button';submit.className='button button-primary';submit.id='identity-details-submit';submit.disabled=true;
    const edit=n('button','Edit details');edit.type='button';edit.className='button button-secondary';edit.id='identity-details-edit';
    review.append(reviewHeading,disclosure,warning,agreement,approvalLabel,submit,edit);
    const status=n('p');status.id='identity-details-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const close=n('button','Close');close.type='button';close.className='button button-secondary';close.id='identity-details-close';
    const hold=n('button','Hold this request');hold.type='button';hold.className='button button-secondary';hold.id='identity-details-hold';
    body.append(heading,introduction,privacy,recipient,requirementsNote,form,review,status,hold,close);dialog.append(body);document.body.append(dialog);
    let epoch=0,preview=null,reviewed=null,requirements=null,opener=null,running=false,opening=false;
    const controls=[method,birth.control,street.control,phone.control,city.control,state.control,zip.control];
    function clear(){
      for(const control of controls)control.value='';
      approval.checked=false;submit.disabled=true;reviewed=null;preview=null;requirements=null;disclosure.replaceChildren();recipient.textContent='';requirementsNote.textContent='';warning.textContent='';agreement.textContent='';review.hidden=true;form.hidden=false;
    }
    function chooseMethod(){const full=method.value==='full_matching_details';birth.label.hidden=!full&&method.value!=='date_of_birth';street.label.hidden=!full&&method.value!=='street_address';phone.label.hidden=!full;birth.control.required=!birth.label.hidden;street.control.required=!street.label.hidden;phone.control.required=full;}
    function invalidate(){reviewed=null;approval.checked=false;submit.disabled=true;review.hidden=true;disclosure.replaceChildren();}
    for(const control of controls)control.addEventListener('input',invalidate);
    method.addEventListener('change',()=>{birth.control.value='';street.control.value='';phone.control.value='';invalidate();chooseMethod();});
    function editable(value){for(const control of controls)control.disabled=!value;reviewButton.disabled=!value;approval.disabled=!value;submit.disabled=!value||!approval.checked||!reviewed;edit.disabled=!value;hold.disabled=!value;}
    approval.addEventListener('change',()=>{submit.disabled=running||!reviewed||!approval.checked;});
    function entered(){const location={city:city.control.value,state:state.control.value,zip_code:zip.control.value};return method.value==='full_matching_details'?{method:'full_matching_details',date_of_birth:birth.control.value,street_address:street.control.value,phone:phone.control.value,...location}:method.value==='date_of_birth'?{method:'date_of_birth',date_of_birth:birth.control.value,...location}:
      {method:'street_address',street_address:street.control.value,...location};}
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    async function showReview(event){
      event?.preventDefault();if(running||!preview)return;
      try{
        if(typeof form.reportValidity==='function'&&!form.reportValidity())return;
        if(!requirements||!['date_of_birth','street_address','full_matching_details'].includes(method.value)||methods[method.value].disabled)throw new Error('Choose a supported set of information for this broker form.');
        const values=details.validate(entered(),{requirements}),contract=details.CONTRACTS.fastpeoplesearch;
        reviewed={preview:JSON.parse(JSON.stringify(preview)),details:values,requirements:{...requirements}};
        disclosure.replaceChildren();
        for(const [label,value]of [['Broker','FastPeopleSearch'],['First name',preview.fields.first_name],['Last name',preview.fields.last_name],['Removal contact',preview.fields.email],
          ...(values.date_of_birth?[['Full date of birth',values.date_of_birth]]:[]),...(values.street_address?[['Current street address',values.street_address]]:[]),...(values.phone?[['Phone number',values.phone]]:[]),['City',values.city],['State',values.state],['ZIP',values.zip_code]])disclosure.append(n('dt',label),n('dd',value));
        warning.textContent=contract.warningText;agreement.textContent=contract.consentText;approval.checked=false;submit.disabled=true;review.hidden=false;status.textContent='Review every field and the broker’s accuracy statement, then authorize this attempt.';approval.focus({preventScroll:true});
      }catch(error){reviewed=null;review.hidden=true;disclosure.replaceChildren();status.textContent=error?.message||'Review the required information.';}
    }
    form.addEventListener('submit',showReview);
    edit.addEventListener('click',()=>{if(running)return;invalidate();method.focus({preventScroll:true});status.textContent='Edit the information, then review it again.';});
    submit.addEventListener('click',async()=>{
      if(running)return;
      if(!approval.checked||!reviewed){status.textContent='Review the exact fields and authorize this form submission first.';return;}
      let frozen=reviewed;reviewed=null;const revision=epoch;running=true;editable(false);status.textContent='Checking the existing broker form before sending the approved fields.';
      let operation;
      try{
        const ping=await companion({action:'ping'});
        if(epoch!==revision||!dialog.open)return;
        if(!ping.routes?.includes('fastpeoplesearch')||!ping.capabilities?.includes('identity-submit-v1'))throw new Error('Update and enable the Chrome companion for this supported submission. No fields were sent.');
        if(!same(await workspace.identityPreview('fastpeoplesearch'),frozen.preview))throw new Error('The request changed. Close this dialog and review its current next step.');
        if(epoch!==revision||!dialog.open)return;
        operation=await workspace.prepareIdentitySubmission(frozen.preview,frozen.details,{authorized:true,consentId:details.CONTRACTS.fastpeoplesearch.id,requirements:frozen.requirements});
        // Clear all displayed and editable copies as soon as the reserved action
        // takes its transient payload. The ledger stores only the action reference.
        clear();form.hidden=true;frozen=null;onChange();
        if(epoch!==revision||!dialog.open){await workspace.recordIdentitySubmission('fastpeoplesearch',operation.submissionId,{status:'blocked'});onChange();return;}
        status.textContent='Filling and submitting the approved form once. Check the result before taking any further action.';
        let result;try{result=await companion({action:'submit-details',...operation});}catch(_){result={status:'unknown'};}
        await workspace.recordIdentitySubmission('fastpeoplesearch',operation.submissionId,result);onChange();
        const message=result?.status==='submission_attempted'&&result.attempt_verified===true?
          'The approved form submission was attempted. Broker acceptance and deletion still need confirmation.':
          result?.status==='blocked'?'The broker form could not be submitted safely. Review its existing tab; the attempt will not repeat automatically.':'The submission outcome is unknown. Review the existing broker tab before continuing; no repeat was sent.';
        status.textContent=message;onFeedback(message);
      }catch(error){const message=operation?'The reserved submission could not be reconciled. Check its existing broker tab before continuing.':error?.message||'The request could not continue. No broker fields were sent.';status.textContent=message;onFeedback(message);}
      finally{frozen=null;operation=null;running=false;editable(true);approval.checked=false;if(dialog.open)close.focus({preventScroll:true});}
    });
    close.addEventListener('click',()=>dialog.close());
    hold.addEventListener('click',async()=>{if(running)return;try{if(!preview)throw new Error('No current request.');await workspace.holdRoute('fastpeoplesearch',preview);onChange();dialog.close();onFeedback('This request is on hold. No identity details were sent.');}catch(_){status.textContent='The request changed or could not be held. Close this dialog and review its current next step. No identity details were sent.';}});
    const cancel=()=>{epoch++;clear();status.textContent='';};
    dialog.addEventListener('cancel',cancel);
    dialog.addEventListener('close',()=>{cancel();if(opener?.isConnected)opener.focus({preventScroll:true});});
    async function open(routeId,source){
      if(running||opening)throw new Error('Wait for the current missing-information action to finish.');
      if(routeId!=='fastpeoplesearch')throw new Error('This broker does not have a reviewed in-app identity submission.');
      opening=true;const revision=++epoch;
      try{
        clear();const current=await workspace.identityPreview(routeId);if(epoch!==revision)return;
        preview=current;opener=source||document.activeElement;editable(false);chooseMethod();form.hidden=true;
        heading.textContent='Finish your FastPeopleSearch request';recipient.textContent='Removal contact for this request: '+current.fields.email;
        status.textContent='Checking the required fields on your existing broker form. No identity values are being read or sent.';
        if(!dialog.open)dialog.showModal();close.focus({preventScroll:true});
        const ping=await companion({action:'ping'});if(epoch!==revision||!dialog.open)return;
        if(!ping.routes?.includes(routeId)||!ping.capabilities?.includes('identity-submit-v1')||!ping.capabilities?.includes('identity-requirements-v1'))throw new Error('Update and enable the Chrome companion before entering missing details.');
        const response=await companion({action:'identity-requirements',routeId,operationId:current.operationId,requestId:current.requestId,receiptRef:current.receiptRef,authorized:true});if(epoch!==revision||!dialog.open)return;
        if(response?.status!=='ready'||response.routeId!==routeId||response.operationId!==current.operationId)throw new Error('The existing broker form could not be verified. Review its current Chrome tab; no new form was opened.');
        requirements=details.validateRequirements(response.requirements);
        const native=!requirements.no_validate&&!requirements.submit_no_validate,full=native&&requirements.date_of_birth&&requirements.street_address&&requirements.phone;
        methods.date_of_birth.disabled=native&&(requirements.street_address||requirements.phone);methods.street_address.disabled=native&&(requirements.date_of_birth||requirements.phone);methods.full_matching_details.disabled=!full;
        if(methods.date_of_birth.disabled&&methods.street_address.disabled&&methods.full_matching_details.disabled)throw new Error('The broker requires a combination of fields that has not been reviewed. Hold this request or review its official form.');
        requirementsNote.textContent=full?'The broker’s page says date of birth or street address, but its current form marks both and a phone number as required. You can choose to provide all of them, close this dialog or hold the request. Nothing is sent until you review and approve the exact fields.':'The existing form supports the identity option shown below. Enter only the selected detail and required location fields.';
        const profile=workspace.profile();city.control.value=profile.city||'';state.control.value=(profile.region||'').replace(/^US-/i,'').toUpperCase();
        editable(true);form.hidden=false;status.textContent='Choose the information you want to provide, then review it before submission.';method.focus({preventScroll:true});
      }catch(error){if(epoch===revision){const message=error?.message||'The required fields could not be checked. No information was sent.';if(dialog.open){status.textContent=message;hold.disabled=false;}else onFeedback(message);}}
      finally{opening=false;}
    }
    chooseMethod();return Object.freeze({open});
  }
  return Object.freeze({create});
});
