/* Local planning and user-reported history. This module performs no external actions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseFootprintPlanner=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const VERSION=1,MAX_ITEMS=100,MAX_INPUT=131072;
  const CATEGORIES=Object.freeze(['account','social','search_result','company','privacy_setting']);
  const EVENTS=Object.freeze({
    export_completed:'You reported saving an export',request_prepared:'You reported preparing a request',
    request_submitted:'You reported submitting a request',company_confirmation:'You reported company confirmation',
    search_result_removed:'You reported the search result removed',source_removed:'You reported the source removed',
    setting_updated:'You reported updating the privacy setting',content_reviewed:'You reported reviewing selected social content',
    recheck_reviewed:'You reported an on-demand recheck'
  });
  const GUIDES=Object.freeze({
    google:Object.freeze({label:'Google result-removal guidance',url:'https://support.google.com/websearch/answer/9673730?hl=en'}),
    reddit:Object.freeze({label:'Reddit content and account-deletion guidance',url:'https://support.reddithelp.com/hc/en-us/articles/360043047932-If-I-delete-my-account-what-happens-to-my-username-posts-and-comments/'}),
    drop:Object.freeze({label:'California DROP',url:'https://privacy.ca.gov/drop/'})
  });
  class PlannerError extends Error{}
  const fail=message=>{throw new PlannerError(message);};
  const copy=value=>JSON.parse(JSON.stringify(value));
  const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  const plain=(value,max,label)=>{if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f<>]/.test(value))fail('Use plain '+label+' without credentials or control characters.');const result=value.trim().replace(/\s+/g,' ');if(!result)fail('Provide '+label+'.');return result;};
  function publicURL(value){
    if(value===undefined||value===null||value==='')return null;
    try{
      if(typeof value!=='string'||value.length>2048||/[\s\\?#\x00-\x1f\x7f]/.test(value)||/%(?![0-9a-f]{2})/i.test(value)||/%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|3f|23|5c|40)/i.test(value))throw new Error();
      const url=new URL(value),path=decodeURIComponent(url.pathname),host=url.hostname.toLowerCase();
      if(url.href.length>2048||url.protocol!=='https:'||/^https:\/\/[^/]*@/i.test(value)||url.username||url.password||url.port||url.search||url.hash||
        !host.includes('.')||host.endsWith('.')||/^\d+(?:\.\d+){3}$/.test(host)||host.includes(':')||/(?:^|\.)(?:localhost|local|internal)$/.test(host)||
        /[\x00-\x1f\x7f]/.test(path)||/\/(?:password-reset|reset-password|reset|verify|verification|confirmation|confirm|oauth|callback)(?:\/|$)/i.test(path))throw new Error();
      return url.href;
    }catch(_){fail('Use a public HTTPS page without login credentials, verification links, query parameters or fragments.');}
  }
  function row(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['service','category','url'].includes(key))||!Object.hasOwn(value,'service'))
      fail('Import only service, category and optional public URL columns. Passwords, tokens and other account data are not accepted.');
    const service=plain(value.service,100,'service name'),category=value.category===undefined||value.category===''?'account':value.category;
    if(!CATEGORIES.includes(category))fail('Choose an account, social, search_result, company or privacy_setting category.');
    return {service,category,url:publicURL(value.url)};
  }
  function csv(content){
    const records=[];let record=[],field='',quoted=false,closed=false;
    for(let i=0;i<=content.length;i++){
      const char=i===content.length?'\n':content[i];
      if(quoted){if(char==='"'){if(content[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else{if(i===content.length)fail('The CSV contains an unfinished quoted field.');field+=char;}continue;}
      if(char==='"'){if(field||closed)fail('Use valid CSV quoting.');quoted=true;continue;}
      if(char===','||char==='\n'||char==='\r'){
        record.push(field);field='';closed=false;
        if(char!==','){if(char==='\r'&&content[i+1]==='\n')i++;if(record.some(value=>value!==''))records.push(record);record=[];}
      }else{if(closed)fail('Use valid CSV quoting.');field+=char;}
    }
    if(!records.length)fail('Import a CSV header and at least one account row.');
    const header=records.shift().map(value=>value.trim());
    if(!header.length||new Set(header).size!==header.length||!header.includes('service')||header.some(key=>!['service','category','url'].includes(key)))
      fail('Use service, category and optional url CSV headers. Credentials and extra columns are not accepted.');
    return records.map(record=>{if(record.length!==header.length)fail('Every CSV row must match its header.');return Object.fromEntries(header.map((key,index)=>[key,record[index]]));});
  }
  function parse(content,format){
    if(typeof content!=='string'||content.length>MAX_INPUT||new TextEncoder().encode(content).length>MAX_INPUT)fail('Import a list smaller than 128 KiB.');
    let values;
    try{if(format==='json')values=JSON.parse(content);else if(format==='csv')values=csv(content);else fail('Choose JSON or CSV for this account list.');}
    catch(error){if(error instanceof PlannerError)throw error;fail('Use a valid JSON array or CSV account list.');}
    if(!Array.isArray(values)||!values.length||values.length>MAX_ITEMS)fail('Import between 1 and 100 account or cleanup rows.');
    return values.map(row);
  }
  const date=value=>{if(typeof value!=='string'||value.length>40||!Number.isFinite(Date.parse(value)))fail('The saved cleanup history has an invalid date.');return new Date(value).toISOString();};
  const identifier=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(value))fail('The cleanup item has an invalid reference.');return value;};
  const empty=()=>({version:VERSION,items:[],updated_at:null});
  function normalize(value,{imported=false}={}){
    if(!exact(value,['version','items','updated_at'])||value.version!==VERSION||!Array.isArray(value.items)||value.items.length>MAX_ITEMS)fail('The saved cleanup plan is invalid.');
    const ids=new Set(),items=value.items.map(item=>{
      if(!exact(item,['id','service','category','url','decision','closure_reviewed','export_acknowledged','created_at','updated_at','reports']))fail('The saved cleanup item contains unsupported data.');
      const id=identifier(item.id);if(ids.has(id))fail('The cleanup plan contains duplicate references.');ids.add(id);
      if(![null,'keep','export_first','remove'].includes(item.decision)||typeof item.closure_reviewed!=='boolean'||typeof item.export_acknowledged!=='boolean'||!Array.isArray(item.reports)||item.reports.length>20)fail('The saved cleanup choice is invalid.');
      const reports=item.reports.map(report=>{if(!exact(report,['event','at','source'])||!Object.hasOwn(EVENTS,report.event)||!['user_reported','imported_user_history'].includes(report.source))fail('Cleanup progress cannot establish verified removal.');return {event:report.event,at:date(report.at),source:imported?'imported_user_history':report.source};});
      const result={id,...row({service:item.service,category:item.category,url:item.url}),decision:item.decision,closure_reviewed:item.closure_reviewed,
        export_acknowledged:item.export_acknowledged,created_at:date(item.created_at),updated_at:date(item.updated_at),reports};
      if(result.category==='account'&&['remove','export_first'].includes(result.decision)&&!result.closure_reviewed)fail('Account closure needs a clear user decision.');
      if(result.export_acknowledged&&!reports.some(report=>report.event==='export_completed'))fail('Export status needs a user-reported export.');
      return result;
    });
    return {version:VERSION,items,updated_at:value.updated_at===null?null:date(value.updated_at)};
  }
  function add(current,rows,{uuid,now}){
    const next=normalize(current),stamp=date(now),seen=new Set(next.items.map(item=>JSON.stringify([item.service.toLowerCase(),item.category,item.url]))),ids=new Set(next.items.map(item=>item.id));
    for(const input of rows){const value=row(input),key=JSON.stringify([value.service.toLowerCase(),value.category,value.url]);if(seen.has(key))continue;if(next.items.length>=MAX_ITEMS)fail('The cleanup plan is limited to 100 items.');let id;for(let i=0;i<10;i++){id=identifier(uuid());if(!ids.has(id))break;if(i===9)fail('A fresh cleanup reference could not be created.');}ids.add(id);seen.add(key);
      next.items.push({id,...value,decision:null,closure_reviewed:false,export_acknowledged:false,created_at:stamp,updated_at:stamp,reports:[]});}
    next.updated_at=stamp;return next;
  }
  function itemIn(current,id){const next=normalize(current),item=next.items.find(item=>item.id===id);if(!item)fail('Choose an item from this cleanup plan.');return {next,item};}
  function choose(current,id,options,{now}){
    if(!exact(options,['decision','authorized','closureReviewed'])||options.authorized!==true||!['keep','export_first','remove'].includes(options.decision)||typeof options.closureReviewed!=='boolean')fail('Review and explicitly choose what to keep, export or remove.');
    const {next,item}=itemIn(current,id);
    if(item.category==='account'&&options.decision!=='keep'&&!options.closureReviewed)fail('Review the effect on files, purchases and sign-in access before planning account closure.');
    if(item.category==='privacy_setting'&&options.decision==='export_first')fail('Choose to keep or change this privacy setting.');
    item.decision=options.decision;item.closure_reviewed=options.decision==='keep'?false:options.closureReviewed;item.updated_at=date(now);next.updated_at=item.updated_at;return next;
  }
  function permitted(item,event){
    if(!Object.hasOwn(EVENTS,event))fail('Choose an explicit user-reported cleanup step. Verified deletion cannot be recorded here.');
    if(!['remove','export_first'].includes(item.decision))fail('Choose an action for this item first. Kept items are not changed.');
    if(event==='export_completed'){if(item.category==='privacy_setting')fail('This privacy-setting task has no account export.');return;}
    if(event==='recheck_reviewed')return;
    if(item.decision==='export_first'&&!item.export_acknowledged)fail('Report saving your export before progressing toward removal.');
    if(event==='search_result_removed'&&item.category!=='search_result'||event==='setting_updated'&&item.category!=='privacy_setting'||event==='content_reviewed'&&item.category!=='social')fail('This report does not apply to this cleanup category.');
    if(event==='company_confirmation'&&(!['account','company','social'].includes(item.category)||!item.reports.some(report=>report.event==='request_submitted')))fail('Report the related request before reporting company confirmation.');
    if(item.category==='privacy_setting'&&!['setting_updated','recheck_reviewed'].includes(event))fail('Record this as a privacy-setting change rather than account deletion.');
  }
  function progress(current,id,options,{now}){
    if(!exact(options,['event','authorized'])||options.authorized!==true)fail('Explicitly report only a step you performed yourself.');
    const {next,item}=itemIn(current,id);permitted(item,options.event);
    if(item.reports.length>=20)fail('This item has reached its 20-report history limit.');
    item.updated_at=date(now);item.reports.push({event:options.event,at:item.updated_at,source:'user_reported'});
    if(options.event==='export_completed')item.export_acknowledged=true;next.updated_at=item.updated_at;return next;
  }
  function view(current){
    const plan=normalize(current);return {...plan,items:plan.items.map(item=>({...item,
      label:item.decision==='keep'?'Kept by your choice':item.reports.length?(item.reports[item.reports.length-1].source==='imported_user_history'?'Imported history: ':'')+EVENTS[item.reports[item.reports.length-1].event]:item.decision==='export_first'?'Export planned before removal':item.decision==='remove'?'Change planned; nothing sent':'Imported, awaiting your choice',
      reports:item.reports.map(report=>({...report,label:(report.source==='imported_user_history'?'Imported history: ':'')+EVENTS[report.event]})),
      reported_outcomes:{company_confirmation:item.reports.some(report=>report.event==='company_confirmation'),search_result_removed:item.reports.some(report=>report.event==='search_result_removed'),source_removed:item.reports.some(report=>report.event==='source_removed')},
      acceptance_verified:false,deletion_verified:false,independent_verification_available:false}))};
  }
  return Object.freeze({VERSION,MAX_ITEMS,MAX_INPUT,CATEGORIES,EVENTS,GUIDES,PlannerError,empty,parse,normalize,add,choose,progress,view});
});
