/* Bounded removal-only email protocol. Provider acceptance never proves deletion. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseSendContract=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const ROUTES=Object.freeze({
    'de-11880':Object.freeze({to:'datenschutz.solutions@11880.com',source:'https://unternehmen.11880.com/datenschutz'}),
    'ca-411':Object.freeze({to:'privacy@411.ca',source:'https://www.411.ca/privacy-policy'}),
    ukphonebook:Object.freeze({to:'dpo@simunix.com',source:'https://www.ukphonebook.com/privacy'}),
    'de-teilnehmerverzeichnis-widerspruch':Object.freeze({to:'datenschutz@dasoertliche-marketing.de',source:'https://www.dasoertliche.de/datenschutz'}),
    'tr-ceptennumarasorgula':Object.freeze({to:'mh@mobilisim.com.tr',source:'https://www.ceptennumarasorgula.com/PrivacyPolicy'}),
    'tr-numaraara':Object.freeze({to:'bilgi@numaraara.com',source:'https://www.numaraara.com/iletisim'}),
    beenverified:Object.freeze({to:'privacy@beenverified.com',source:'https://www.beenverified.com/faq/privacy/'}),
    peoplelooker:Object.freeze({to:'privacy@peoplelooker.com',source:'https://www.peoplelooker.com/privacy-policy/'})
  });
  const OP=/^[a-f0-9-]{32,40}$/,HEX=/^[a-f0-9]{64}$/,REF=/^[a-f0-9]{32}$/,CAP=/^s1\.[A-Za-z0-9_-]{1,1800}\.[A-Za-z0-9_-]{43}$/;
  const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  function fail(){throw new Error('The reviewed removal-only email action could not be validated. No repeat was authorized.');}
  function plain(value,max){return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\x00-\x1f\x7f<>]/.test(value)&&value===value.trim().replace(/\s+/g,' ');}
  function preview(value,route){
    if(!exact(value,['from','to','subject','body'])||!plain(value.from,254)||!/^[a-z0-9._-]{1,30}@(?:gmail\.com|googlemail\.com)$/.test(value.from)||
      !plain(value.to,254)||route&&value.to!==ROUTES[route]?.to||!plain(value.subject,120)||typeof value.body!=='string'||!value.body.length||value.body.length>4096||/[\x00-\x09\x0b-\x1f\x7f]/.test(value.body))fail();
    return value;
  }
  function request(value){
    const fields={'send-status':['authorized'],'send-prepare':['route_id','operation_id','authorized','own_request','name','record_reference'],'send-once':['capability','preview','authorized','own_request'],'send-result':['route_id','operation_id','explicit'],'send-revoke':['route_id','operation_id','explicit']};
    if(!value||!Object.hasOwn(fields,value.action)||!exact(value,['action','workspace_id','personal_email_sha256',...fields[value.action]])||!OP.test(value.workspace_id||'')||!HEX.test(value.personal_email_sha256||'')||JSON.stringify(value).length>8192)fail();
    if(['send-result','send-revoke'].includes(value.action)?value.explicit!==true:value.authorized!==true)fail();
    if(['send-prepare','send-once'].includes(value.action)&&value.own_request!==true)fail();
    if(Object.hasOwn(value,'route_id')&&(!Object.hasOwn(ROUTES,value.route_id)||!OP.test(value.operation_id||'')))fail();
    if(value.action==='send-prepare'&&(!plain(value.name,120)||!plain(value.record_reference,512)))fail();
    if(value.action==='send-once'){if(!CAP.test(value.capability||''))fail();preview(value.preview);if(!Object.values(ROUTES).some(route=>route.to===value.preview.to))fail();}
    return value;
  }
  function response(input,value){
    request(input);
    if(!value||JSON.stringify(value).length>8192)fail();
    if(input.action==='send-status'){
      const keys=['configured','enabled','send_enabled','provider','on_demand','access','authorization_required','automatic_execution','routes',...(Object.hasOwn(value,'contact_email')?['contact_email']:[])];
      if(!exact(value,keys)||typeof value.configured!=='boolean'||typeof value.enabled!=='boolean'||typeof value.send_enabled!=='boolean'||value.enabled&&!value.configured||value.send_enabled!==value.enabled||value.provider!=='gmail'||value.on_demand!==true||value.access!=='local_native'||value.authorization_required!==true||value.automatic_execution!==false||
        !Array.isArray(value.routes)||JSON.stringify([...value.routes].sort())!==JSON.stringify(Object.keys(ROUTES).sort())||value.enabled&&!Object.hasOwn(value,'contact_email')||Object.hasOwn(value,'contact_email')&&(!value.enabled||!plain(value.contact_email,254)||!/^[a-z0-9._-]{1,30}@(?:gmail\.com|googlemail\.com)$/.test(value.contact_email)))fail();
      return value;
    }
    if(!Object.hasOwn(ROUTES,value.route_id)||!OP.test(value.operation_id||'')||value.automatic_execution!==false||Object.hasOwn(input,'route_id')&&(input.route_id!==value.route_id||input.operation_id!==value.operation_id))fail();
    if(input.action==='send-prepare'){
      if(!exact(value,['status','route_id','operation_id','request_id','capability','expires_at','message_digest','preview','source_url','automatic_execution'])||value.status!=='ready'||!REF.test(value.request_id||'')||!CAP.test(value.capability||'')||!Number.isSafeInteger(value.expires_at)||!HEX.test(value.message_digest||'')||value.source_url!==ROUTES[value.route_id].source)fail();
      preview(value.preview,value.route_id);return value;
    }
    const keys=['status','route_id','operation_id','request_id','automatic_execution','delivery_verified','acceptance_verified','deletion_verified',...['message_id','thread_id','acceptance_kind','receipt_ref'].filter(key=>Object.hasOwn(value,key))];
    if(!exact(value,keys)||!['provider_accepted','smtp_accepted','unknown','ready','revoked','already_started','preparing','blocked'].includes(value.status)||value.request_id!==null&&!REF.test(value.request_id||'')||value.delivery_verified!==false||value.acceptance_verified!==false||value.deletion_verified!==false||
      ['message_id','thread_id'].some(key=>Object.hasOwn(value,key)&&!(typeof value[key]==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value[key])) )||value.status==='provider_accepted'&&(!Object.hasOwn(value,'message_id')||!Object.hasOwn(value,'thread_id'))||
      (value.status==='smtp_accepted'?(value.acceptance_kind!=='smtp_250'||!HEX.test(value.receipt_ref||'')||!REF.test(value.request_id||'')||Object.hasOwn(value,'message_id')||Object.hasOwn(value,'thread_id')):(Object.hasOwn(value,'acceptance_kind')||Object.hasOwn(value,'receipt_ref'))))fail();
    return value;
  }
  return Object.freeze({ROUTES,request,response,preview,exact,CAP});
});
