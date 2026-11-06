/* Reviewed, transient fields for a fixed directory or preference form. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('../../extension/phone-preference-details.js'):root.ErasePhonePreferenceDetails,node?require('../../extension/association-details.js'):root.EraseAssociationDetails,node?require('../../extension/directory-suppression-details.js'):root.EraseDirectorySuppressionDetails);
  if(node)module.exports=api;else root.ErasePrivateRouteDialog=api;
})(typeof globalThis==='object'?globalThis:this,function(phone,association,directory){
  'use strict';
  function config(id){
    if(phone?.ROUTES?.[id])return{api:phone,route:phone.ROUTES[id],contract:phone.ROUTES[id],capability:'phone-preference-prefill-v1',kind:'phone_preference',specs:[['phone','Your own telephone number','tel',20]],intro:'Fill the first phone-preference field only. Continue registration on the official site. This marketing registration does not delete broker records.'};
    if(association?.ROUTES?.[id])return{api:association,route:association.ROUTES[id],contract:association.CONTRACT,capability:'association-prefill-v1',kind:'association',specs:[['first_name','First name','text',100],['last_name','Last name','text',100],['date_of_birth','Accurate date of birth','date',10],['city','City','text',100],['state','US state','select',2],['email','Your contact email','email',254]],intro:'This form addresses association and relative features only. It does not suppress complete background reports or close your account. Complete verification and submission on the official site yourself.'};
    if(directory?.ROUTES?.[id])return{api:directory,route:directory.ROUTES[id],contract:directory.CONTRACTS?.[id]||directory.CONTRACT,capability:'directory-suppression-prefill-v1',kind:'directory_suppression',specs:id==='canada411'?[['phone','Your listed Canadian telephone','tel',20],['email','Your contact email','email',254]]:[['first_name','First name','text',100],['last_name','Surname','text',100],['postcode','Full UK postcode','text',12],['email','Your contact email','email',254]],intro:id==='canada411'?'This removes a Canada411 web listing only; telephone-provider unlisting is separate. Your own profile name and reviewed telephone/email will be filled, with the privacy reason selected. Optional comments stay blank. Complete the genuine image challenge and submission yourself.':'Fill your own directory-suppression fields only. Other people’s fields and optional telephone remain blank. Complete the site’s challenge, email verification and submission yourself.'};
    throw new Error('This route has no reviewed private form.');
  }
  function create({workspace,companion,document,onChange=()=>{},onFeedback=()=>{},now=()=>new Date().toISOString()}){
    const n=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
    const dialog=n('dialog');dialog.id='private-route-dialog';dialog.setAttribute('aria-labelledby','private-route-heading');
    const body=n('div');body.className='dialog-body';const heading=n('h2');heading.id='private-route-heading';const intro=n('p'),recipient=n('p');
    const form=n('form');form.id='private-route-form';form.setAttribute('autocomplete','off');const fields=n('div');fields.className='identity-details-fields';
    const reviewButton=n('button','Review exact fields');reviewButton.type='submit';reviewButton.id='private-route-review';reviewButton.className='button button-secondary';form.append(fields,reviewButton);
    const review=n('section');review.id='private-route-disclosure';review.hidden=true;const list=n('dl');list.className='form-batch-fields';
    const ownLabel=n('label'),approval=n('input'),agreement=n('span');approval.type='checkbox';approval.id='private-route-approval';ownLabel.className='checkbox-label';ownLabel.append(approval,agreement);
    const fill=n('button','Fill reviewed fields once');fill.type='button';fill.id='private-route-fill';fill.className='button button-primary';fill.disabled=true;
    const edit=n('button','Edit fields');edit.type='button';edit.id='private-route-edit';edit.className='button button-secondary';review.append(list,ownLabel,fill,edit);
    const status=n('p');status.id='private-route-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const hold=n('button','Hold this route');hold.type='button';hold.id='private-route-hold';hold.className='button button-secondary';const close=n('button','Close');close.type='button';close.id='private-route-close';close.className='button button-secondary';
    body.append(heading,intro,n('p','Additional identity values stay only in this review and one approved payload. They are not saved in the workspace, backup or companion journal.'),recipient,form,review,status,hold,close);dialog.append(body);document.body.append(dialog);
    let epoch=0,preview=null,reviewed=null,definition=null,controls={},running=false,opener=null;
    const sameProfile=id=>{try{return workspace.profile().id===id;}catch(_){return false;}};
    function invalidate(){reviewed=null;approval.checked=false;fill.disabled=true;review.hidden=true;list.replaceChildren();}
    function clear(){for(const control of Object.values(controls))control.value='';invalidate();preview=null;recipient.textContent='';}
    function editable(value){for(const control of Object.values(controls))control.disabled=!value;reviewButton.disabled=!value;approval.disabled=!value;edit.disabled=!value;hold.disabled=!value;fill.disabled=!value||!reviewed||!approval.checked;}
    approval.addEventListener('change',()=>{fill.disabled=running||!reviewed||!approval.checked;});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(running||!preview)return;
      try{
        if(typeof form.reportValidity==='function'&&!form.reportValidity())return;
        const details=definition.api.validateDetails(Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value])),{routeId:preview.routeId,fullName:preview.profileContext.name,age:preview.profileContext.age,now:now()});
        reviewed={preview:JSON.parse(JSON.stringify(preview)),details};list.replaceChildren();
        for(const[caption,value]of [['Official form',definition.route.url],...(preview.identity?[[preview.routeId==='canada411'?'Listed name':'Workspace name (identity check)',preview.identity.full_name]]:[]),...definition.specs.map(([key,label])=>[label,details[key]])])list.append(n('dt',caption),n('dd',value));
        approval.checked=false;fill.disabled=true;review.hidden=false;status.textContent='Review every field and the exact limited purpose. No official form has been contacted.';approval.focus({preventScroll:true});
      }catch(error){invalidate();status.textContent=error?.message||'Review your own accurate fields.';}
    });
    edit.addEventListener('click',()=>{if(!running){invalidate();Object.values(controls)[0]?.focus({preventScroll:true});}});
    fill.addEventListener('click',async()=>{
      if(running||!reviewed||!approval.checked)return;
      let originalProfile;try{if(!sameProfile(preview.profileId))throw new Error();originalProfile=JSON.stringify(workspace.profile());}catch(_){clear();status.textContent='The workspace changed. Close this review and start again.';return;}
      const revision=epoch,routeId=preview.routeId,profileId=preview.profileId,current=definition;let frozen=reviewed,operation=null;
      running=true;reviewed=null;editable(false);
      try{
        const ping=await companion({action:'ping'});if(revision!==epoch||!dialog.open)return;
        if(!ping.routes?.includes(routeId)||!ping.capabilities?.includes(current.capability))throw new Error('Update the companion and enable this official site before filling. No private fields were sent.');
        operation=await workspace.preparePrivateRoute(frozen.preview,frozen.details,{authorized:true,consentId:frozen.preview.consentId});clear();form.hidden=true;frozen=null;onChange();
        const state=workspace.snapshot(),item=state.items?.[routeId];
        if(revision!==epoch||!dialog.open||JSON.stringify(workspace.profile())!==originalProfile||state.campaign?.status!=='active'||item?.held||item?.operation_id!==operation.operationId){try{await workspace.recordPrivateRoute(routeId,profileId,operation.operationId,{status:'blocked'});onChange();}catch(_){}return;}
        let result;try{result=await companion({action:'fill-private-route',...operation});}catch(_){result={status:'unknown'};}
        await workspace.recordPrivateRoute(routeId,profileId,operation.operationId,result);onChange();
        if(revision===epoch&&dialog.open&&sameProfile(profileId)){status.textContent=result.status==='prepared'?'The exact reviewed fields were filled once. Complete the official site’s remaining steps. Correct-record matching, acceptance and deletion remain unverified.':'The existing form outcome is blocked or unknown. No automatic repeat will run.';onFeedback(status.textContent);}
      }catch(error){if(revision===epoch&&dialog.open&&sameProfile(profileId))status.textContent=operation?'The reserved action needs reconciliation. No repeat was sent.':error?.message||'The reviewed form could not start.';}
      finally{frozen=null;operation=null;running=false;if(revision===epoch){editable(true);approval.checked=false;fill.disabled=true;}}
    });
    hold.addEventListener('click',async()=>{if(running||!preview)return;try{await workspace.holdRoute(preview.routeId,undefined,preview.profileId);onChange();dialog.close();onFeedback('This route is held. No new private form action will start.');}catch(_){status.textContent='The workspace changed. Close this review before holding a route.';}});
    const stop=()=>{epoch++;clear();status.textContent='';form.hidden=false;};close.addEventListener('click',()=>dialog.close());dialog.addEventListener('cancel',stop);dialog.addEventListener('close',()=>{stop();if(opener?.isConnected)opener.focus({preventScroll:true});});
    async function open(id,sourceButton,expectedProfileId){
      if(running||dialog.open)throw new Error('Close the current private review before opening another.');
      if(workspace.profile().id!==expectedProfileId)throw new Error('The workspace changed. Review this route again.');
      definition=config(id);const current=workspace.privateRoutePreview(id);if(current.profileId!==expectedProfileId)throw new Error('The workspace changed.');
      epoch++;clear();fields.replaceChildren();controls={};preview=current;opener=sourceButton||document.activeElement;
      heading.textContent='Review '+definition.route.name;intro.textContent=definition.intro+(definition.kind==='phone_preference'&&definition.route.notice?' '+definition.route.notice:'');recipient.textContent='Official form: '+definition.route.url;agreement.textContent=definition.contract.authorization;
      for(const[key,caption,type,max]of definition.specs){const label=n('label',caption),input=n(type==='select'?'select':'input');input.id='private-route-'+key;if(type==='select'){const blank=n('option','Choose a state');blank.value='';input.append(blank);for(const[value,text]of Object.entries(definition.api.STATES)){const option=n('option',text);option.value=value;input.append(option);}}else input.type=type;input.required=true;input.autocomplete='off';input.setAttribute('autocomplete','off');if(max)input.maxLength=max;label.setAttribute('for',input.id);label.append(input);fields.append(label);controls[key]=input;input.addEventListener('input',invalidate);input.addEventListener('change',invalidate);}
      form.hidden=false;editable(true);status.textContent='Enter your own accurate information. No form has been opened and no values were saved.';dialog.showModal();Object.values(controls)[0].focus({preventScroll:true});
    }
    return Object.freeze({open});
  }
  return Object.freeze({create,supports:id=>{try{config(id);return true;}catch(_){return false;}}});
});
