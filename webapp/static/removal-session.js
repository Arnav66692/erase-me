/* One authorized pass over scoped removal mail. No polling or saved keys. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseRemovalSession=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const ROUTES=new Set(['usphonebook','fastpeoplesearch','searchpeoplefree']);
  function create({workspace,mail,companion,operatorKey,continuationFields={}}){
    if(typeof operatorKey!=='string'||!/^[a-fA-F0-9]{64}$/.test(operatorKey))throw new Error('Enter the private removal-mail operator key for this session.');
    const reviewedFields=JSON.parse(JSON.stringify(continuationFields));
    if(!reviewedFields||typeof reviewedFields!=='object'||Array.isArray(reviewedFields)||Object.keys(reviewedFields).some(route=>route!=='usphonebook'))throw new Error('Review the supported confirmation fields first.');
    let key=operatorKey,disposed=false;operatorKey='';
    const checked=new Set();
    const dispose=()=>{key='';disposed=true;};
    async function process({routeId,isStopped=()=>false}){
      const stopped=()=>disposed||isStopped();
      if(stopped())return {status:'not_started',detail:'The removal-mail session is closed.'};
      const dashboard=workspace.dashboard(),item=dashboard.items.find(item=>item.site_id===routeId);
      if(!ROUTES.has(routeId)||!item?.mail_contact||!item.operation_id)return {status:'not_applicable',detail:'This route has no authorized removal-only contact. Its identity email was not changed.'};
      if(item.held||dashboard.campaign.status!=='active')return {status:'not_started',detail:'The route or campaign is on hold. No mailbox action started.'};
      const context={profileId:dashboard.profile.id,operationId:item.operation_id,email:item.mail_contact.contact_email,
        firstName:item.input_fields?.first_name,lastName:item.input_fields?.last_name};
      const sameContext=()=>{const current=workspace.dashboard(),row=current.items.find(row=>row.site_id===routeId);return current.profile.id===context.profileId&&
        current.campaign.status==='active'&&row?.held!==true&&row?.operation_id===context.operationId&&row.mail_contact?.contact_email===context.email&&
        row.input_fields?.first_name===context.firstName&&row.input_fields?.last_name===context.lastName;};
      const changedContext=()=>({status:'unknown',detail:'The reviewed workspace or contact changed. No further mailbox or confirmation action started.'});
      const reference=routeId+':'+item.operation_id;
      if(checked.has(reference))return {status:'not_started',detail:'This operation was already checked in this session. No recurring check was started.'};
      checked.add(reference);
      const request=await workspace.mailCheckRequest(routeId);
      if(stopped())return {status:'not_started',detail:'The session stopped before reading removal mail.'};
      if(!sameContext())return changedContext();
      const receipt=await mail.check(request,key);
      if(!sameContext())return changedContext();
      await workspace.recordMailReceipt(routeId,receipt);
      if(stopped())return {status:'stopped',detail:'The receipt was recorded. No further confirmation action started.'};
      if(receipt.status==='pending')return {status:'awaiting_mail',detail:'No correlated broker email has arrived yet. This session starts no polling or future check.'};
      if(receipt.authenticated!==true)return {status:'unknown',detail:'The removal receipt could not be authenticated. No link was followed.'};
      if(!receipt.continuation_available||routeId!=='usphonebook')return {status:'needs_broker_step',detail:'Authenticated removal mail was received. Its destination has no reviewed automatic confirmation contract, so no link was followed.'};
      const fields=reviewedFields[routeId];
      if(!fields||Object.keys(fields).length!==3||!['city','state','zip_code'].every(field=>typeof fields[field]==='string'&&fields[field].trim()))
        return {status:'needs_detail',detail:'A reviewed confirmation is available. Review city, state and ZIP before continuing; the broker also requires date of birth or street address directly on its form.'};
      const current=workspace.dashboard();
      if(current.campaign.status!=='active'||current.items.find(item=>item.site_id===routeId)?.held)return {status:'not_started',detail:'The route was put on hold before continuation. No link was followed.'};
      const ping=await companion({action:'ping'});
      if(stopped())return {status:'stopped',detail:'The session stopped before continuing the broker form.'};
      if(!sameContext())return changedContext();
      if(!ping.routes?.includes(routeId)||!ping.capabilities?.includes('usphonebook-continuation-v1'))return {status:'needs_setup',detail:'Update and enable the companion before continuing this reviewed confirmation.'};
      const authorized=await workspace.mailContinuationRequest(routeId,fields);
      if(stopped())return {status:'stopped',detail:'The session stopped before releasing the broker link.'};
      if(!sameContext())return changedContext();
      const response=await mail.continuation(authorized,key);
      if(stopped())return {status:'stopped',detail:'The session stopped before broker navigation. No link was opened.'};
      if(!sameContext())return changedContext();
      const operation=await workspace.prepareMailContinuation(routeId,response,fields);
      if(!sameContext())return changedContext();
      // Reservation is the start of this one action. Complete its result even
      // if Stop arrives now; no later operation will begin.
      let result;
      try{result=await companion({action:'continue',...operation});}
      catch(_){result={status:'unknown',detail:'The confirmation outcome is unknown. Check its existing tab; no repeat was sent.'};}
      await workspace.recordMailContinuation(routeId,operation.operationId,result);
      return {status:result.status==='unknown'?'unknown':'needs_broker_step',detail:result.status==='prepared'?
        'The authenticated confirmation opened and its reviewed fields were filled. Required identity details and final broker acceptance remain outstanding.':result.detail||'Review the existing confirmation tab.'};
    }
    return Object.freeze({process,dispose});
  }
  return Object.freeze({create});
});
