/* Per-workspace native mail transport. No hosted fetch, inbox tokens or scheduled work. */
(function(root,factory){
  const relay=typeof module==='object'&&module.exports?require('./removal-mail-client.js'):root.EraseRemovalMail;
  const api=factory(root,relay);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseLocalRemovalMail=api;
})(typeof globalThis==='object'?globalThis:this,function(root,relay){
  'use strict';
  const OP=/^[a-f0-9-]{32,40}$/,ROUTES=new Set(['fastpeoplesearch','usphonebook','searchpeoplefree']);
  function canonicalEmail(value){
    if(typeof value!=='string'||value.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value))throw new Error('Use a bare valid profile email before connecting a separate removal-only mailbox.');
    let[local,domain]=value.toLowerCase().split('@');
    if(domain.length>253||domain.split('.').some(label=>! /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))throw new Error('Use a valid profile email domain.');
    local=local.split('+')[0];if(domain==='gmail.com'||domain==='googlemail.com'){local=local.replace(/\./g,'');domain='gmail.com';}
    if(!local)throw new Error('Use a bare valid profile email.');return local+'@'+domain;
  }
  async function primaryDigest(value,crypto=root.crypto){
    if(!crypto?.subtle?.digest)throw new Error('This browser cannot privately identify the configured removal-mail workspace.');
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalEmail(value))))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  function create({workspace,companion,crypto=root.crypto}){
    if(!workspace||typeof workspace.reserveLocalMailSetupClosure!=='function'||typeof companion!=='function'||!relay?.create)throw new Error('Refresh this workspace before using its local removal-mail connector.');
    const profile=workspace.profile(),profileJSON=JSON.stringify(profile),workspaceId=profile.id;
    const issuedContacts=new Map(),closedOperations=new Set();
    if(!OP.test(workspaceId||''))throw new Error('Create a current workspace before connecting removal mail.');
    canonicalEmail(profile.email);
    function current(){const next=workspace.profile();if(next.id!==workspaceId||JSON.stringify(next)!==profileJSON)throw new Error('The workspace changed. Reconnect its separate removal-only mailbox before continuing.');return workspace.snapshot();}
    function contactFor(capability,{allowHeld=false}={}){
      const state=current(),item=Object.values(state.items||{}).find(item=>item.mail_contact?.capability===capability);
      const contact=item?.mail_contact;
      if(!item||!ROUTES.has(item.site_id)||contact.transport!=='local_native'||contact.workspace_id!==workspaceId||
        (!allowHeld&&(state.campaign?.status!=='active'||item.held===true||item.local_mail_setup_closed===true||contact.revoked===true)))throw new Error('This operation has no active local removal-mail grant. No hosted mailbox was contacted.');
      return{route_id:item.site_id,operation_id:contact.operation_id,request_id:contact.request_id};
    }
    async function native(action,body){
      current();
      const digest=await primaryDigest(profile.email,crypto);current();
      const request={action,workspace_id:workspaceId,personal_email_sha256:digest,...body};
      const result=await companion({action:'local-mail',request});
      // A late issued capability is validated and revoked with its original
      // scope below, even when the current page changed while issuance ran.
      if(action!=='session')current();return result;
    }
    const validated=relay.create({localOwnedContacts:true,request:async(action,body)=>{
      if(action==='session'){
        const state=current(),item=state.items?.[body.route_id];
        if(!ROUTES.has(body.route_id)||state.campaign?.status!=='active'||!item||item.id!==body.operation_id||item.held||item.local_mail_setup_closed||item.operation_id||!item.mail_contact_authorized_at||item.mail_contact_transport_authorized!=='local_native')throw new Error('Review this active removal-contact operation before connecting its address.');
      }else{
        const expected=contactFor(body.capability);
        if(action==='continue'){
          const item=current().items[expected.route_id];
          if(!['fastpeoplesearch','usphonebook'].includes(expected.route_id)||!item.mail_continuation_authorized_at||item.continuation||item.mail_receipt?.authenticated!==true||item.mail_receipt?.receipt_ref!==body.receipt_ref||item.mail_receipt?.continuation_available!==true)throw new Error('Review a current supported confirmation before releasing its private link.');
        }
        const result=await native(action,body);
        if(!['route_id','operation_id','request_id'].every(key=>result?.[key]===expected[key]))throw new Error('The local mailbox result does not match this operation.');
        contactFor(body.capability);return result;
      }
      return native(action,body);
    }});
    async function status(){
      const value=await native('status',{authorized:true});
      const keys=['configured','enabled','provider','on_demand','access','authorization_required','automatic_execution','routes',...(Object.hasOwn(value||{},'contact_email')?['contact_email']:[])];
      if(!exact(value,keys)||typeof value.configured!=='boolean'||typeof value.enabled!=='boolean'||value.enabled&&!value.configured||value.provider!=='gmail'||value.on_demand!==true||value.access!=='local_native'||value.authorization_required!==true||value.automatic_execution!==false||
        !Array.isArray(value.routes)||value.routes.length!==ROUTES.size||new Set(value.routes).size!==ROUTES.size||value.routes.some(route=>!ROUTES.has(route))||
        value.enabled&&(typeof value.contact_email!=='string'||canonicalEmail(value.contact_email)===canonicalEmail(profile.email))||
        Object.hasOwn(value,'contact_email')&&(!value.enabled||typeof value.contact_email!=='string'||! /^[a-z0-9._-]{1,25}@(?:gmail\.com|googlemail\.com)$/.test(value.contact_email)))throw new Error('The local connector did not establish a separate removal-only mailbox.');
      return value;
    }
    function contactRequest(body){
      if(!exact(body,['route_id','operation_id','authorized'])||!ROUTES.has(body.route_id)||typeof body.operation_id!=='string'||!OP.test(body.operation_id)||body.authorized!==true)throw new Error('Authorize a supported local contact before issuance.');
      return{route_id:body.route_id,operation_id:body.operation_id,authorized:true};
    }
    function validateIssuedContact(body,value){
      const keys=['status','capability','request_id','route_id','operation_id','contact_email','expires_at','automatic_execution','transport','workspace_id'];
      if(!exact(value,keys)||value.status!=='ready'||value.transport!=='local_native'||value.workspace_id!==workspaceId||value.route_id!==body.route_id||value.operation_id!==body.operation_id||value.automatic_execution!==false||
        typeof value.request_id!=='string'||!/^[a-f0-9]{32}$/.test(value.request_id)||typeof value.capability!=='string'||/[\r\n]/.test(value.capability)||!/^[A-Za-z0-9_-]{1,1800}\.[A-Za-z0-9_-]{43}$/.test(value.capability)||
        !Number.isSafeInteger(value.expires_at)||typeof value.contact_email!=='string'||!new RegExp('^[a-z0-9._-]{1,25}\\+erase-'+value.request_id+'@(?:gmail\\.com|googlemail\\.com)$').test(value.contact_email))throw new Error('The issued local contact does not match its approved request.');
      let claims;
      try{const encoded=value.capability.split('.')[0];claims=JSON.parse(root.atob(encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=')));}catch(_){throw new Error('The issued local capability is malformed.');}
      if(!exact(claims,['v','request_id','route_id','operation_id','recipient','issued_at','expires_at'])||claims.v!==1||claims.request_id!==value.request_id||claims.route_id!==body.route_id||claims.operation_id!==body.operation_id||claims.recipient!==value.contact_email||claims.expires_at!==value.expires_at||!Number.isSafeInteger(claims.issued_at)||claims.expires_at-claims.issued_at!==7*86400)throw new Error('The issued local capability belongs to another contact.');
    }
    async function discardIssuedContact(request,response){
      const body=contactRequest(request);validateIssuedContact(body,response);
      const issued=issuedContacts.get(response.capability);
      if(!issued||JSON.stringify(issued.body)!==JSON.stringify(body)||!Object.keys(issued.value).every(key=>issued.value[key]===response[key]))throw new Error('Only this connector’s issued contact can be discarded.');
      closedOperations.add(body.route_id+':'+body.operation_id);issuedContacts.delete(response.capability);
      let reservation;
      try{reservation=await workspace.reserveLocalMailSetupClosure(body.route_id,body.operation_id,workspaceId,response);}catch(_){return{status:'revocation_unconfirmed'};}
      if(reservation?.status==='already_bound'){closedOperations.delete(body.route_id+':'+body.operation_id);return{status:'already_bound'};}
      if(reservation?.status==='already_revoked')return{status:'revoked'};
      if(!['reserved','workspace_replaced','operation_replaced'].includes(reservation?.status))return{status:'revocation_unconfirmed'};
      let revoked=false;
      try{
        const result=await companion({action:'local-mail',request:{action:'revoke',workspace_id:workspaceId,personal_email_sha256:issued.digest,capability:response.capability,explicit:true}});
        revoked=exact(result,['status','route_id','operation_id','request_id','automatic_execution'])&&result.status==='revoked'&&result.automatic_execution===false&&['route_id','operation_id','request_id'].every(key=>result[key]===response[key]);
      }catch(_){ /* Unknown cleanup stays closed; it never retries issuance. */ }
      if(reservation.status==='reserved')try{await workspace.recordLocalMailSetupClosure(body.route_id,body.operation_id,workspaceId,revoked,response.request_id);}catch(_){ /* Never modify a replacement workspace or another cleanup. */ }
      return{status:revoked?'revoked':'revocation_unconfirmed'};
    }
    async function session(body){
      body=contactRequest(body);
      if(closedOperations.has(body.route_id+':'+body.operation_id))throw new Error('This local mail setup is closed for manual reconciliation.');
      const before=current(),approved=before.items?.[body?.route_id];
      const approval=approved?{id:approved.id,authorizedAt:approved.mail_contact_authorized_at}:null;
      const digest=await primaryDigest(profile.email,crypto);current();
      const value=await validated.session(body);
      const issued=Object.freeze({...value,transport:'local_native',workspace_id:workspaceId});validateIssuedContact(body,issued);
      issuedContacts.set(issued.capability,{body:Object.freeze({...body}),value:issued,digest});
      let safe=false,alreadyBound=false;
      try{
        const state=current(),item=state.items?.[body.route_id];
        const unchanged=approval&&item?.id===approval.id&&item.id===body.operation_id&&item.mail_contact_authorized_at===approval.authorizedAt&&item.mail_contact_transport_authorized==='local_native';
        safe=Boolean(unchanged&&state.campaign?.status==='active'&&!item.held&&!item.local_mail_setup_closed&&!item.operation_id&&!item.mail_contact);
        alreadyBound=Boolean(unchanged&&!item.held&&item.mail_contact?.capability===value.capability&&item.mail_contact?.transport==='local_native'&&!item.mail_contact.revoked);
      }catch(_){ /* Cleanup must still use the original, already-approved scope. */ }
      if(safe)return issued;
      if(alreadyBound){issuedContacts.delete(issued.capability);throw new Error('This local contact was already bound by another approved action. No additional address was created.');}
      const cleanup=await discardIssuedContact(body,issued);
      if(cleanup.status==='already_bound')throw new Error('This local contact was already bound by another approved action. No additional address was created.');
      throw new Error(cleanup.status==='revoked'?'The approved contact setup changed before binding. Its unused local grant was revoked; no broker request or mailbox read started.':'The approved contact setup changed before binding. Grant revocation could not be confirmed. This setup is closed for manual reconciliation; no broker request or mailbox read started.');
    }
    async function revoke(body){
      if(!exact(body,['capability','explicit'])||body.explicit!==true)throw new Error('Explicitly revoke a saved local removal contact first.');
      const expected=contactFor(body.capability,{allowHeld:true}),value=await native('revoke',body);
      if(!exact(value,['status','route_id','operation_id','request_id','automatic_execution'])||value.status!=='revoked'||value.automatic_execution!==false||!['route_id','operation_id','request_id'].every(key=>value[key]===expected[key]))throw new Error('The local grant revocation could not be confirmed. The route remains held.');
      return value;
    }
    return Object.freeze({transport:'local_native',workspaceId,status,session,discardIssuedContact,check:body=>validated.check(body),continuation:body=>validated.continuation(body),revoke});
  }
  return Object.freeze({create,canonicalEmail,primaryDigest});
});
