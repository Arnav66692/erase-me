/* One foreground CMA Do Not Mail review. Sensitive fields never enter the ledger. */
(function(root,factory){
  const details=typeof module==='object'&&module.exports?require('../../extension/cma-details.js'):root.EraseCMADetails;
  const api=factory(details);if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseCMADialog=api;
})(typeof globalThis==='object'?globalThis:this,function(details){
  'use strict';
  function create({workspace,companion,document,onChange=()=>{},onFeedback=()=>{}}){
    const n=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
    const dialog=n('dialog');dialog.id='cma-details-dialog';dialog.setAttribute('aria-labelledby','cma-details-heading');
    const body=n('div');body.className='dialog-body';const heading=n('h2','Your CMA Do Not Mail form');heading.id='cma-details-heading';
    const intro=n('p',details.CONTRACT.notice);
    const privacy=n('p','Your mailing address stays only in this review and its one-action payload. No email, DOB or telephone is sent to CMA. This registers a marketing preference; it does not delete underlying broker records.');
    const recipient=n('p'),form=n('form');form.id='cma-details-form';form.setAttribute('autocomplete','off');
    const grid=n('div');grid.className='identity-details-fields';const controls={};
    const specs=[['first_name','First name','text',20,true],['last_name','Last name','text',40,true],['address1','Mailing address','text',45,true],['address2','Address line 2 (optional)','text',45,false],['city','City','text',30,true],['province','Province or territory','select',null,true],['postal_code','Canadian postal code','text',7,true]];
    for(const [key,caption,type,max,required]of specs){const label=n('label',caption),input=n(type==='select'?'select':'input');input.id='cma-'+key;if(type!=='select')input.type=type;else{const blank=n('option','Choose province or territory');blank.value='';input.append(blank);for(const[value,text]of Object.entries(details.PROVINCES)){const option=n('option',text);option.value=value;input.append(option);}}input.required=required;input.autocomplete='off';input.setAttribute('autocomplete','off');if(max)input.maxLength=max;label.setAttribute('for',input.id);label.append(input);grid.append(label);controls[key]=input;}
    const submitLabel=n('label'),submitOption=n('input');submitOption.type='checkbox';submitOption.id='cma-auto-submit';submitLabel.className='checkbox-label';submitLabel.append(submitOption,n('span','Also submit this CMA marketing registration once after the exact-field review. Delivery and acceptance are unverified.'));
    const reviewButton=n('button','Review private fields');reviewButton.type='submit';reviewButton.className='button button-secondary';reviewButton.id='cma-review';form.append(grid,submitLabel,reviewButton);
    const review=n('section');review.id='cma-disclosure';review.hidden=true;const list=n('dl');list.className='form-batch-fields';
    const agreement=n('label'),approval=n('input');approval.type='checkbox';approval.id='cma-approval';agreement.className='checkbox-label';agreement.setAttribute('for',approval.id);agreement.append(approval,n('span',details.CONTRACT.authorization));
    const fill=n('button','Fill official form once');fill.type='button';fill.className='button button-primary';fill.id='cma-fill';fill.disabled=true;
    const edit=n('button','Edit fields');edit.type='button';edit.className='button button-secondary';edit.id='cma-edit';review.append(n('h3','Review the exact fields'),list,agreement,fill,edit);
    const status=n('p');status.id='cma-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const hold=n('button','Hold this route');hold.type='button';hold.className='button button-secondary';hold.id='cma-hold';
    const close=n('button','Close');close.type='button';close.className='button button-secondary';close.id='cma-close';body.append(heading,intro,privacy,recipient,form,review,status,hold,close);dialog.append(body);document.body.append(dialog);
    let epoch=0,preview=null,reviewed=null,running=false,opener=null;
    const invalidate=()=>{reviewed=null;approval.checked=false;fill.disabled=true;review.hidden=true;list.replaceChildren();};
    function clear(){for(const input of Object.values(controls))input.value='';submitOption.checked=false;invalidate();preview=null;recipient.textContent='';form.hidden=false;}
    function editable(value){for(const input of Object.values(controls))input.disabled=!value;reviewButton.disabled=!value;submitOption.disabled=!value;approval.disabled=!value;edit.disabled=!value;hold.disabled=!value;fill.disabled=!value||!approval.checked||!reviewed;}
    for(const control of Object.values(controls)){control.addEventListener('input',invalidate);control.addEventListener('change',invalidate);}submitOption.addEventListener('change',invalidate);
    approval.addEventListener('change',()=>{fill.disabled=running||!reviewed||!approval.checked;});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(running||!preview)return;
      try{
        if(typeof form.reportValidity==='function'&&!form.reportValidity())return;
        const canonical=details.validateDetails(Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value])),{fullName:preview.fullName});
        reviewed={preview:JSON.parse(JSON.stringify(preview)),details:canonical,autoSubmit:submitOption.checked===true};list.replaceChildren();
        for(const [label,value]of [['Service','CMA Do Not Mail marketing suppression'],['Action',reviewed.autoSubmit?'Fill and attempt registration once':'Fill only; submit yourself'],...specs.map(([key,caption])=>[caption,canonical[key]||'(not provided; left blank)'])])list.append(n('dt',label),n('dd',value));
        fill.textContent=reviewed.autoSubmit?'Fill and submit registration once':'Fill official form once';approval.checked=false;fill.disabled=true;review.hidden=false;status.textContent='Review every field and the own-information authorization. No broker has been contacted.';approval.focus({preventScroll:true});
      }catch(error){invalidate();status.textContent=error?.message||'Review the private fields.';}
    });
    edit.addEventListener('click',()=>{if(!running){invalidate();controls.first_name.focus({preventScroll:true});}});
    fill.addEventListener('click',async()=>{
      if(running||!approval.checked||!reviewed)return;
      const revision=epoch;let frozen=reviewed,operation=null,profileId=frozen.preview.profileId;reviewed=null;running=true;editable(false);
      try{
        const ping=await companion({action:'ping'});if(epoch!==revision||!dialog.open)return;
        if(!ping.routes?.includes(details.ROUTE)||!ping.capabilities?.includes('cma-registration-v1'))throw new Error('Update the companion and enable CMA Do Not Mail access before filling. No private fields were sent.');
        operation=await workspace.prepareCMA(frozen.preview,frozen.details,{authorized:true,consentId:details.CONTRACT.id,autoSubmit:frozen.autoSubmit});
        clear();form.hidden=true;frozen=null;onChange();
        // A close/hold/profile replacement during reservation must not dispatch.
        const state=workspace.snapshot(),item=state.items?.[details.ROUTE];
        if(epoch!==revision||!dialog.open||state.profile?.id!==profileId||state.campaign?.status!=='active'||item?.held||item?.operation_id!==operation.operationId){
          try{await workspace.recordCMA(profileId,operation.operationId,{status:'blocked'});onChange();}catch(_){}return;
        }
        status.textContent='Checking the official form and filling the approved fields once.';
        let result;try{result=await companion({action:'run-cma',...operation});}catch(_){result={status:'unknown'};}
        await workspace.recordCMA(profileId,operation.operationId,result);onChange();
        const message=result?.status==='submission_attempted'?'One CMA registration submission was attempted. Delivery and registration acceptance remain unverified. This does not establish broker deletion.':result?.status==='prepared'?'Your reviewed fields were filled once. Submit the CMA registration in its existing tab. No registration or deletion is verified.':'The form outcome is blocked or unknown. Review its existing tab before continuing; no automatic repeat was sent.';
        status.textContent=message;onFeedback(message);
      }catch(error){status.textContent=operation?'The reserved form outcome could not be reconciled. Check its existing tab; no repeat is authorized.':error?.message||'The private form could not start. No private fields were sent.';onFeedback(status.textContent);}
      finally{frozen=null;operation=null;profileId=null;running=false;editable(true);approval.checked=false;if(dialog.open)close.focus({preventScroll:true});}
    });
    hold.addEventListener('click',async()=>{if(running||!preview)return;try{await workspace.holdRoute(details.ROUTE,undefined,preview.profileId);onChange();dialog.close();onFeedback('CMA Do Not Mail is held. No private details were sent.');}catch(_){status.textContent='The workspace changed. Close this review before choosing a route to hold.';}});
    close.addEventListener('click',()=>dialog.close());
    const cancel=()=>{epoch++;clear();status.textContent='';};dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',()=>{cancel();if(opener?.isConnected)opener.focus({preventScroll:true});});
    async function open(source,expectedProfileId){
      if(running)throw new Error('Wait for the current private form action.');epoch++;clear();
      const current=await workspace.cmaPreview();if(current.profileId!==expectedProfileId)throw new Error('The workspace changed. Review the current route before entering private details.');
      preview=current;opener=source||document.activeElement;recipient.textContent='Workspace name: '+current.fullName+'. No email or telephone is sent to this registration.';editable(true);status.textContent='Enter your own first and last name, Canadian mailing address, city, province and postal code. Company, deceased-person and alternate-name fields are not used.';
      if(!dialog.open)dialog.showModal();close.focus({preventScroll:true});
    }
    return Object.freeze({open});
  }
  return Object.freeze({create});
});
