/* One foreground MyLife review. Sensitive fields never enter the ledger. */
(function(root,factory){
  const details=typeof module==='object'&&module.exports?require('../../extension/mylife-details.js'):root.EraseMyLifeDetails;
  const api=factory(details);if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseMyLifeDialog=api;
})(typeof globalThis==='object'?globalThis:this,function(details){
  'use strict';
  function create({workspace,companion,document,onChange=()=>{},onFeedback=()=>{}}){
    const n=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
    const dialog=n('dialog');dialog.id='mylife-details-dialog';dialog.setAttribute('aria-labelledby','mylife-details-heading');
    const body=n('div');body.className='dialog-body';const heading=n('h2','Your MyLife form');heading.id='mylife-details-heading';
    const intro=n('p','Enter accurate details for your own US record. Erase Me checks MyLife’s published JotForm before filling once. The site describes California opt-out rights; choosing another state does not establish eligibility. Complete any verification and submission on the broker site yourself.');
    const privacy=n('p','Birth year and location stay only in this review and one-action payload, outside saved workspace data, backups and companion journals. MyLife uses a JotForm at mylife.jotform.com. No email, street address, optional alias or profile URL is supplied by this action.');
    const recipient=n('p'),form=n('form');form.id='mylife-details-form';form.setAttribute('autocomplete','off');
    const grid=n('div');grid.className='identity-details-fields';const controls={};
    const specs=[['first_name','First name (include any middle name here)','text',120,true],['last_name','Last name','text',120,true],['state','US state','select',null,true],['city','City','text',120,true],['zip_code','Five-digit ZIP','text',5,true],['birth_year','Accurate birth year (YYYY)','text',4,true]];
    for(const [key,caption,type,max,required]of specs){const label=n('label',caption),input=n(type==='select'?'select':'input');input.id='mylife-'+key;if(type!=='select')input.type=type;input.required=required;input.autocomplete='off';input.setAttribute('autocomplete','off');if(max)input.maxLength=max;if(type==='select'){const empty=n('option','Choose your state');empty.value='';input.append(empty);for(const state of details.STATES){const option=n('option',state);option.value=state;input.append(option);}}label.setAttribute('for',input.id);label.append(input);grid.append(label);controls[key]=input;}
    const reviewButton=n('button','Review private fields');reviewButton.type='submit';reviewButton.className='button button-secondary';reviewButton.id='mylife-review';form.append(grid,reviewButton);
    const review=n('section');review.id='mylife-disclosure';review.hidden=true;const list=n('dl');list.className='form-batch-fields';
    const agreement=n('label'),approval=n('input');approval.type='checkbox';approval.id='mylife-approval';agreement.className='checkbox-label';agreement.setAttribute('for',approval.id);agreement.append(approval,n('span',details.CONTRACT.authorization));
    const fill=n('button','Fill official form once');fill.type='button';fill.className='button button-primary';fill.id='mylife-fill';fill.disabled=true;
    const edit=n('button','Edit fields');edit.type='button';edit.className='button button-secondary';edit.id='mylife-edit';review.append(n('h3','Review the exact fields'),list,agreement,fill,edit);
    const status=n('p');status.id='mylife-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const hold=n('button','Hold this route');hold.type='button';hold.className='button button-secondary';hold.id='mylife-hold';
    const close=n('button','Close');close.type='button';close.className='button button-secondary';close.id='mylife-close';body.append(heading,intro,privacy,recipient,form,review,status,hold,close);dialog.append(body);document.body.append(dialog);
    let epoch=0,preview=null,reviewed=null,running=false,opener=null;
    const invalidate=()=>{reviewed=null;approval.checked=false;fill.disabled=true;review.hidden=true;list.replaceChildren();};
    function clear(){for(const input of Object.values(controls))input.value='';invalidate();preview=null;recipient.textContent='';form.hidden=false;}
    function editable(value){for(const input of Object.values(controls))input.disabled=!value;reviewButton.disabled=!value;approval.disabled=!value;edit.disabled=!value;hold.disabled=!value;fill.disabled=!value||!approval.checked||!reviewed;}
    for(const control of Object.values(controls))control.addEventListener('input',invalidate);
    approval.addEventListener('change',()=>{fill.disabled=running||!reviewed||!approval.checked;});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(running||!preview)return;
      try{
        if(typeof form.reportValidity==='function'&&!form.reportValidity())return;
        const canonical=details.validateDetails(Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value])),{age:preview.identity.age,fullName:preview.identity.full_name});
        reviewed={preview:JSON.parse(JSON.stringify(preview)),details:canonical};list.replaceChildren();
        for(const [label,value]of [['Broker','MyLife'],['Full name',preview.identity.full_name],['Processor','mylife.jotform.com'],...specs.map(([key,caption])=>[caption,canonical[key]||'(not provided; left blank)'])])list.append(n('dt',label),n('dd',value));
        approval.checked=false;fill.disabled=true;review.hidden=false;status.textContent='Review every field and the own-information authorization. No broker has been contacted.';approval.focus({preventScroll:true});
      }catch(error){invalidate();status.textContent=error?.message||'Review the private fields.';}
    });
    edit.addEventListener('click',()=>{if(!running){invalidate();controls.birth_year.focus({preventScroll:true});}});
    fill.addEventListener('click',async()=>{
      if(running||!approval.checked||!reviewed)return;
      const revision=epoch;let frozen=reviewed,operation=null,profileId=frozen.preview.profileId;reviewed=null;running=true;editable(false);
      try{
        const ping=await companion({action:'ping'});if(epoch!==revision||!dialog.open)return;
        if(!ping.routes?.includes(details.ROUTE)||!ping.capabilities?.includes('mylife-prefill-v1'))throw new Error('Update the companion and enable MyLife access before filling. No private fields were sent.');
        operation=await workspace.prepareMyLife(frozen.preview,frozen.details,{authorized:true,consentId:details.CONTRACT.id});
        clear();form.hidden=true;frozen=null;onChange();
        // A close/hold/profile replacement during reservation must not dispatch.
        const state=workspace.snapshot(),item=state.items?.[details.ROUTE];
        if(epoch!==revision||!dialog.open||state.profile?.id!==profileId||state.campaign?.status!=='active'||item?.held||item?.operation_id!==operation.operationId){
          try{await workspace.recordMyLife(profileId,operation.operationId,{status:'blocked'});onChange();}catch(_){}return;
        }
        status.textContent='Checking the official form and filling the approved fields once.';
        let result;try{result=await companion({action:'fill-mylife',...operation});}catch(_){result={status:'unknown'};}
        await workspace.recordMyLife(profileId,operation.operationId,result);onChange();
        const message=result?.status==='prepared'?'Your reviewed fields were filled once. Complete the broker’s challenge and submission in its existing tab. No accepted request or deletion is verified.':'The form outcome is blocked or unknown. Review its existing tab before continuing; no automatic repeat was sent.';
        status.textContent=message;onFeedback(message);
      }catch(error){status.textContent=operation?'The reserved form outcome could not be reconciled. Check its existing tab; no repeat is authorized.':error?.message||'The private form could not start. No private fields were sent.';onFeedback(status.textContent);}
      finally{frozen=null;operation=null;profileId=null;running=false;editable(true);approval.checked=false;if(dialog.open)close.focus({preventScroll:true});}
    });
    hold.addEventListener('click',async()=>{if(running||!preview)return;try{await workspace.holdRoute(details.ROUTE,undefined,preview.profileId);onChange();dialog.close();onFeedback('MyLife is held. No private details were sent.');}catch(_){status.textContent='The workspace changed. Close this review before choosing a route to hold.';}});
    close.addEventListener('click',()=>dialog.close());
    const cancel=()=>{epoch++;clear();status.textContent='';};dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',()=>{cancel();if(opener?.isConnected)opener.focus({preventScroll:true});});
    async function open(source,expectedProfileId){
      if(running)throw new Error('Wait for the current private form action.');epoch++;clear();
      const current=await workspace.myLifePreview();if(current.profileId!==expectedProfileId)throw new Error('The workspace changed. Review the current route before entering private details.');
      preview=current;opener=source||document.activeElement;recipient.textContent='Profile name: '+current.identity.full_name+'. This action supplies no email.';editable(true);status.textContent='Required: your first and last name, full US state, city, five-digit ZIP and accurate birth year. Enter the year yourself; it is never inferred from age. Other form fields are left blank.';
      if(!dialog.open)dialog.showModal();close.focus({preventScroll:true});
    }
    return Object.freeze({open});
  }
  return Object.freeze({create});
});
