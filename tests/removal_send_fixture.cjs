'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const Core=require('../webapp/static/workspace-core.js'),Protocol=require('../extension/send-contract.js'),Mail=require('../webapp/static/local-removal-mail.js');
const ROUTE='ca-411',REFERENCE='https://www.411.ca/record/fixture',MAILBOX='removal.fixture@gmail.com';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function gate(){let resolve;return{promise:new Promise(done=>{resolve=done;}),release:()=>resolve()};}
async function fixture(){
  const values=new Map(),NOW=new Date().toISOString();let sequence=0,fail=false;
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>{if(fail)throw Error('quota');values.set(key,value);},removeItem:key=>values.delete(key)};
  const core=Core.create({storage,crypto:crypto.webcrypto,uuid:()=>(++sequence).toString(16).padStart(32,'0'),now:()=>NOW});
  await core.api('/api/signup',{method:'POST',body:JSON.stringify({name:'Example Person',age:36,email:'primary.fixture@gmail.com',authorized:true})});
  await core.api('/api/profile',{method:'POST',body:JSON.stringify({country:'CA',city:'Vancouver',region:'BC'})});
  const calls=[],gates={},overrides={},prepared=new Map();
  const outcome=(req,status='revoked')=>({status,route_id:req.route_id,operation_id:req.operation_id,request_id:prepared.get(req.operation_id)?.request_id||null,automatic_execution:false,delivery_verified:false,acceptance_verified:false,deletion_verified:false,...(status==='provider_accepted'?{message_id:'fixture-message',thread_id:'fixture-thread'}:{})});
  async function companion(payload){
    calls.push(structuredClone(payload));const action=payload.action==='ping'?'ping':payload.request.action;
    if(gates[action])await gates[action].promise;
    if(overrides[action])return overrides[action](payload.request,payload);
    if(action==='ping')return{capabilities:['local-removal-send-v1','smtp-outcome-v1']};
    assert.equal(payload.action,'local-send');const req=Protocol.request(payload.request);
    if(action==='send-status')return{configured:true,enabled:true,send_enabled:true,provider:'gmail',on_demand:true,access:'local_native',authorization_required:true,automatic_execution:false,routes:Object.keys(Protocol.ROUTES),contact_email:MAILBOX};
    if(action==='send-prepare'){
      const request_id='d'.repeat(32),issued_at=Math.floor(Date.parse(NOW)/1000),expires_at=issued_at+900;
      const preview={from:MAILBOX,to:Protocol.ROUTES[req.route_id].to,subject:'Request to remove or suppress my public record ['+request_id+']',body:'Hello,\n\nMy name: '+req.name+'\nRecord reference: '+req.record_reference+'\n\nRequest reference: '+request_id+'\n'};
      const message_digest=hash(JSON.stringify({body:preview.body,from:preview.from,subject:preview.subject,to:preview.to}));
      const claims={v:1,route_id:req.route_id,operation_id:req.operation_id,workspace_id:req.workspace_id,personal_email_sha256:req.personal_email_sha256,account:await Mail.primaryDigest(MAILBOX),request_id,message_digest,issued_at,expires_at};
      const result={status:'ready',route_id:req.route_id,operation_id:req.operation_id,request_id,capability:'s1.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43),expires_at,message_digest,preview,source_url:Protocol.ROUTES[req.route_id].source,automatic_execution:false};prepared.set(req.operation_id,result);return result;
    }
    if(action==='send-once'){
      const claims=JSON.parse(Buffer.from(req.capability.split('.')[1],'base64url'));return outcome(claims,'provider_accepted');
    }
    return outcome(req,action==='send-result'?'ready':'revoked');
  }
  return{core,storage,values,companion,calls,overrides,NOW,route:ROUTE,reference:REFERENCE,fail:()=>{fail=true;},recover:()=>{fail=false;},delay:action=>(gates[action]=gate()),outcome};
}
function dom(){
  let document;
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.listeners=new Map();this.attributes=new Map();this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.open=false;this._text='';}
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    set textContent(value){this._text=String(value);this.replaceChildren();}
    append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
    replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
    addEventListener(type,callback){this.listeners.set(type,callback);}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    removeAttribute(name){this.attributes.delete(name);}
    get isConnected(){for(let node=this;node;node=node.parentElement)if(node===document.body)return true;return false;}
    focus(){document.activeElement=this;}
    reportValidity(){return this.children.every(child=>!child.required||!!child.value);}
    showModal(){this.open=true;}
    close(){this.open=false;this.listeners.get('close')?.();}
  }
  const find=(el,id)=>{if(el.id===id)return el;for(const child of el.children){const value=find(child,id);if(value)return value;}};
  const body=new Element('body');document={body,activeElement:body,createElement:tag=>new Element(tag),getElementById:id=>find(body,id)};
  const opener=new Element('button');body.append(opener);
  return{document,opener,byId:id=>document.getElementById('removal-send-'+id),fire:(id,type='click')=>document.getElementById('removal-send-'+id).listeners.get(type)?.({preventDefault(){}})};
}
module.exports={fixture,dom,gate};
