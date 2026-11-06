/* One explicitly reviewed email. No provider credentials, body storage or retry loop. */
(function(root,factory){
  const contract=typeof module==='object'&&module.exports?require('../../extension/send-contract.js'):root.EraseSendContract;
  const mail=typeof module==='object'&&module.exports?require('./local-removal-mail.js'):root.EraseLocalRemovalMail;
  const api=factory(root,contract,mail);if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseRemovalSend=api;
})(typeof globalThis==='object'?globalThis:this,function(root,contract,mail){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  function create({workspace,companion,profileId,now=()=>Date.now()}){
    const original=clone(workspace.profile());
    if(original.id!==profileId||typeof workspace.beginMailSendPreview!=='function'||typeof workspace.reserveMailSendClosure!=='function'||!mail?.primaryDigest)throw new Error('Refresh this workspace before reviewing a removal email.');
    let context=null,issued=null,closed=false,busy=false,dispatched=false,cleanup=null,discardCleanup=false;
    const unchanged=()=>JSON.stringify(workspace.profile())===JSON.stringify(original);
    function active(){
      if(closed||!unchanged())throw new Error('This email review is closed or its workspace changed. No new send was authorized.');
      if(context){const state=workspace.snapshot(),item=state.items?.[context.routeId];if(state.campaign?.status!=='active'||item?.held||item?.mail_send?.closed===true||item?.operation_id!==context.operationId)throw new Error('This request is held, paused or no longer current.');}
    }
    async function native(action,fields,allowClosed=false){
      if(!allowClosed)active();
      const personal_email_sha256=await mail.primaryDigest(original.email);
      if(!allowClosed)active();
      const request={action,workspace_id:original.id,personal_email_sha256,...fields};contract.request(request);
      const result=await companion({action:'local-send',request});return contract.response(request,result);
    }
    async function cancel(discardIssued=false){
      closed=true;
      if(!context)return{status:'pending'};
      if(cleanup){
        let previous;
        try{previous=await cleanup;}catch(_){cleanup=null;}
        if(previous){
          if(discardIssued||!discardCleanup||previous.status!=='already_bound')return previous;
          cleanup=null;
        }
      }
      discardCleanup=discardIssued;
      const frozen=clone(context),value=issued?clone(issued):null;
      cleanup=(async()=>{
        // Closure uses the same write lock as binding. Persist it before revoking.
        const reserved=await workspace.reserveMailSendClosure(frozen,value,{discard_issued:discardIssued});
        if(reserved.status==='already_bound')return{status:'already_bound'};
        if(reserved.status==='already_revoked')return{status:'revoked'};
        if(!['reserved','workspace_replaced','operation_replaced'].includes(reserved.status))throw new Error('The local email closure could not be reserved.');
        let outcome;
        try{outcome=await native('send-revoke',{route_id:frozen.routeId,operation_id:frozen.operationId,explicit:true},true);}
        catch(_){outcome={status:'unknown',route_id:frozen.routeId,operation_id:frozen.operationId,request_id:value?.request_id||null,automatic_execution:false,delivery_verified:false,acceptance_verified:false,deletion_verified:false};}
        if(reserved.status==='reserved')await workspace.recordMailSendClosure(frozen,reserved.closureId,outcome);
        return outcome;
      })();return cleanup;
    }
    async function prepare(routeId,reference){
      if(busy||context||!Object.hasOwn(contract.ROUTES,routeId))throw new Error('Choose a fresh supported email review.');
      busy=true;
      try{
        active();const ping=await companion({action:'ping'});active();
        if(!['local-removal-send-v1','smtp-outcome-v1'].every(cap=>ping.capabilities?.includes(cap)))throw new Error('Update the companion before sending reviewed removal emails.');
        const status=await native('send-status',{authorized:true});active();
        if(!status.enabled||!status.send_enabled)throw new Error('Enable sending in local email setup and explicitly reconnect the same separate account before preparing an email.');
        context=await workspace.beginMailSendPreview(routeId,reference,{own_request:true,profileId:original.id});
        active();
        issued=await native('send-prepare',{route_id:context.routeId,operation_id:context.operationId,authorized:true,own_request:true,name:context.profileContext.name,record_reference:context.reference});
        active();
        if(issued.preview.from!==status.contact_email||await mail.primaryDigest(issued.preview.from)===await mail.primaryDigest(original.email))throw new Error('The sender did not establish a separate removal-only account.');
        active();await workspace.bindMailSendPreview(context,issued);active();
        return clone(issued);
      }catch(error){
        if(context){try{await cancel(true);}catch(_){throw new Error('This email setup is closed for reconciliation. Native revocation could not be confirmed; no send started.');}}
        throw error;
      }finally{busy=false;}
    }
    async function send(approval){
      if(busy||dispatched||!issued||approval?.authorized!==true||approval?.own_request!==true)throw new Error('Review the exact message and authorize one send first.');
      busy=true;
      try{
        active();if(issued.expires_at*1000<=now())throw new Error('This email preview expired. Discard it before preparing another.');
        const payload=await workspace.prepareMailSend(context,issued,{authorized:true,own_request:true});active();
        if(payload.capability!==issued.capability||JSON.stringify(payload.preview)!==JSON.stringify(issued.preview))throw new Error('The exact email review changed.');
        dispatched=true;
        let outcome;
        try{outcome=await native('send-once',{capability:payload.capability,preview:payload.preview,authorized:true,own_request:true});}
        catch(_){outcome={status:'unknown',route_id:context.routeId,operation_id:context.operationId,request_id:issued.request_id,automatic_execution:false,delivery_verified:false,acceptance_verified:false,deletion_verified:false};}
        await workspace.recordMailSend(original.id,context.operationId,outcome);return clone(outcome);
      }catch(error){if(!dispatched&&context)try{await cancel(false);}catch(_){}throw error;}
      finally{busy=false;issued=null;}
    }
    async function result(routeId){
      if(!unchanged())throw new Error('This email result belongs to another workspace.');
      const request=await workspace.mailSendResultRequest(routeId);
      const outcome=await native('send-result',request,true);
      await workspace.recordMailSend(original.id,request.operation_id,outcome);return clone(outcome);
    }
    async function revokeRoute(routeId,minimal){
      if(context)throw new Error('Close the existing email review before reconciling another route.');
      const value=minimal||await workspace.mailSendClosureContext(routeId,original.id);
      if(!contract.exact(value,['routeId','operationId','profileId','contextDigest'])||value.routeId!==routeId||value.profileId!==original.id)throw new Error('The original email cleanup reference changed.');
      context=clone(value);return cancel(false);
    }
    return Object.freeze({prepare,send,cancel:()=>cancel(false),result,revokeRoute,isDispatched:()=>dispatched});
  }
  return Object.freeze({create,ROUTES:contract.ROUTES});
});
