/* Narrow relative/associate-display prefill. It never submits or closes an account. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else if(!root.EraseAssociationDetails)root.EraseAssociationDetails=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const ROUTES=Object.freeze({
    intelius:Object.freeze({name:'Intelius',country:'US',host:'app.intelius.com',url:'https://app.intelius.com/privacy-center/',entryUrl:'https://www.intelius.com/privacy-center/',brand:'Intelius',notice:'9269912886cff7721f238a769e7df7e85e4fa5bbcda7dec952ef45886426972a'}),
    truthfinder:Object.freeze({name:'TruthFinder',country:'US',host:'app.truthfinder.com',url:'https://app.truthfinder.com/privacy-center/',entryUrl:'https://www.truthfinder.com/privacy-center/',brand:'TruthFinder',notice:'d507778bd30101e1b2628f8902d77be76232013a33bb8a1c9a5b0da1ff985fda'}),
    instantcheckmate:Object.freeze({name:'Instant Checkmate',country:'US',host:'app.instantcheckmate.com',url:'https://app.instantcheckmate.com/privacy-center/',entryUrl:'https://www.instantcheckmate.com/privacy-center/',brand:'InstantCheckmate',notice:'278bf606312544fc954b4546c002cd2dd6eb0663e1f2ea9684770448e57c8015'}),
    ussearch:Object.freeze({name:'US Search',country:'US',host:'app.ussearch.com',url:'https://app.ussearch.com/privacy-center/',entryUrl:'https://www.ussearch.com/privacy-center/',brand:'USSearch',notice:'26ae355d50984660bdedf99e632e82efebe2d7a5a68485f9d5019b9c08b5c3d9'})
  });
  const STATES=Object.freeze({AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District Of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',PR:'Puerto Rico',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VI:'Virgin Islands',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'});
  const CONTRACT=Object.freeze({
    id:'association-prefill-2026-11-06-v1',
    authorization:'I confirm these are my own accurate details and authorize filling only this reviewed relative/associate-display opt-out once. This does not suppress my complete background report, delete an account, or submit the request. I will review and submit on the official site.'
  });
  const KEYS=Object.freeze(['first_name','last_name','date_of_birth','city','state','email']);
  const MONTHS='January|February|March|April|May|June|July|August|September|October|November|December'.split('|');
  const journal=new WeakSet();
  const normal=value=>String(value||'').replace(/\s+/g,' ').trim();
  const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  function text(value,max){
    if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f\x7f<>]/.test(value))throw new Error('Review only the requested association opt-out fields.');
    return normal(value);
  }
  function validateDetails(value,options={}){
    if(!exact(value,KEYS))throw new Error('Provide only the six reviewed association opt-out fields.');
    const details={first_name:text(value.first_name,120),last_name:text(value.last_name,120),date_of_birth:text(value.date_of_birth,10),city:text(value.city,120),state:text(value.state,2),email:text(value.email,254)};
    if(!Object.hasOwn(STATES,details.state)||! /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email))throw new Error('Enter your accurate US state and contact email.');
    const nameParts=normal(options.fullName).normalize('NFKC').toLowerCase().split(' '),firstParts=details.first_name.normalize('NFKC').toLowerCase().split(' '),lastParts=details.last_name.normalize('NFKC').toLowerCase().split(' ');
    if(firstParts.length+lastParts.length>nameParts.length||firstParts.join(' ')!==nameParts.slice(0,firstParts.length).join(' ')||lastParts.join(' ')!==nameParts.slice(-lastParts.length).join(' '))throw new Error('Type your own accurate first and complete surname to match your workspace name. Profile middle names may be left out; do not move them into another field.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(details.date_of_birth))throw new Error('Enter your accurate full birth date; no date is inferred.');
    const [year,month,day]=details.date_of_birth.split('-').map(Number),birth=new Date(Date.UTC(year,month-1,day)),now=new Date(options.now===undefined?Date.now():options.now);
    const age=now.getUTCFullYear()-year-(now.getUTCMonth()+1<month||now.getUTCMonth()+1===month&&now.getUTCDate()<day?1:0);
    if(!Number.isFinite(now.valueOf())||birth.getUTCFullYear()!==year||birth.getUTCMonth()+1!==month||birth.getUTCDate()!==day||!Number.isInteger(options.age)||options.age<18||options.age>120||age!==options.age||year>now.getFullYear()-17||year<now.getFullYear()-116)throw new Error('Your accurate birth date must match your workspace age and the official form’s supported years. Do not guess.');
    return details;
  }
  function validatePayload(payload,options={}){
    if(!exact(payload,['routeId','operationId','authorized','ownRequestConfirmed','consentId','identity','details'])||!Object.hasOwn(ROUTES,payload.routeId)||!/^[a-f0-9-]{32,40}$/.test(payload.operationId||'')||payload.authorized!==true||payload.ownRequestConfirmed!==true||payload.consentId!==CONTRACT.id||!exact(payload.identity,['full_name','age']))throw new Error('Review and authorize your own association-display opt-out first.');
    const full=text(payload.identity.full_name,120),details=validateDetails(payload.details,{fullName:full,age:payload.identity.age,now:options.now});
    if(full!==payload.identity.full_name||KEYS.some(key=>details[key]!==payload.details[key]))throw new Error('Review the normalized private fields again.');
    return{identity:{full_name:full,age:payload.identity.age},details};
  }
  function allowedURL(value,routeId){
    try{
      const route=ROUTES[routeId],url=new URL(value);
      return !!route&&url.protocol==='https:'&&url.hostname===route.host&&!url.username&&!url.password&&!url.port&&url.pathname==='/privacy-center/'&&!url.search&&!url.hash;
    }catch(_){return false;}
  }
  function shown(element,env){
    if(!element||element.hidden||!element.getClientRects?.().length)return false;
    for(let node=element;node;node=node.parentElement){const style=env.getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}
    return true;
  }
  function one(scope,selector){const values=[...scope.querySelectorAll(selector)];if(values.length!==1)throw new Error();return values[0];}
  function optionsEqual(element,values){
    const options=[...element.options];
    if(options.length!==values.length||options.some((option,index)=>option.disabled||option.value!==values[index][0]||normal(option.textContent)!==values[index][1]))throw new Error();
  }
  function inspect(routeId,env,{requireOpen=true,skipDayOptions=false}={}){
    const doc=env.document,route=ROUTES[routeId];
    if(!allowedURL(env.location.href,routeId)||doc.title!==route.name||doc.forms.length!==0||doc.querySelector('input[type="file"]')||normal(one(doc,'h1').textContent)!=='Data Privacy Center')throw new Error();
    const box=one(doc,'#right-to-opt-out'),container=box.parentElement,heading=one(box,'h3');
    if(box.tagName!=='DIV'||container?.tagName!=='DIV'||normal(heading.textContent)!=='Right to Opt Out'||!shown(heading,env))throw new Error();
    if(requireOpen&&(/(?:^|\s)_collapsed_/.test(container.className)||Number.parseFloat(env.getComputedStyle(container).height)<=0||container.getBoundingClientRect().bottom+1<box.getBoundingClientRect().bottom))throw new Error();
    const paragraphs=[...box.querySelectorAll('p')],noticeText=paragraphs.map(p=>normal(p.textContent)).join('\n');
    if(paragraphs.length!==7||paragraphs.some(p=>!shown(p,env)))throw new Error();
    const link=one(box,'a[href]');
    if(link.href!=='https://suppression.peopleconnect.us/?brand='+route.brand||normal(link.textContent)!=='here'||link.target!=='_blank'||link.getAttribute('rel')!=='noreferrer')throw new Error();
    const specs={first_name:['firstName','INPUT','text','First Name*',true,'John'],last_name:['lastName','INPUT','text','Last Name*',false,'Smith'],month:['month','SELECT','select-one','Month*',false],day:['day','SELECT','select-one','Day*',false],year:['year','SELECT','select-one','Year*',false],city:['city','INPUT','text','City*',false,'San Diego'],state:['state','SELECT','select-one','State*',false],email:['email','INPUT','text','Email*',false,'Enter any Email Address']},controls={};
    for(const[key,[name,tag,type,label,required,placeholder]]of Object.entries(specs)){
      const element=one(box,tag.toLowerCase()+'[name="'+name+'"]');controls[key]=element;
      const labels=[...element.parentElement.parentElement.querySelectorAll('label')];
      if(one(doc,tag.toLowerCase()+'[name="'+name+'"]')!==element||element.tagName!==tag||element.type!==type||element.form!==null||element.required!==required||element.disabled||element.readOnly||!shown(element,env)||labels.length!==1||normal(labels[0].textContent)!==label||placeholder!==undefined&&element.placeholder!==placeholder||tag==='SELECT'&&element.multiple!==false)throw new Error();
    }
    const middle=one(box,'input[name="middleInitial"]');
    if(middle.type!=='text'||middle.form!==null||middle.required||middle.disabled||middle.readOnly||middle.value!==''||middle.placeholder!=='A'||!shown(middle,env))throw new Error();
    optionsEqual(controls.month,[['0','Select'],...MONTHS.map((month,index)=>[String(index+1),month])]);
    if(!skipDayOptions){const month=Number(controls.month.value),days=month===2?29:[4,6,9,11].includes(month)?30:31;optionsEqual(controls.day,[['Select','Select'],...Array.from({length:days},(_,index)=>[String(index+1),String(index+1)])]);}
    const year=new Date(env.Date?.now?.()??Date.now()).getFullYear();
    optionsEqual(controls.year,[['Select','Select'],...Array.from({length:100},(_,index)=>[String(year-17-index),String(year-17-index)])]);
    optionsEqual(controls.state,[['ALL','All States'],...Object.entries(STATES)]);
    const buttons=[...box.querySelectorAll('button')];
    if(buttons.length!==2||normal(buttons[0].textContent)!=='Open Cookie Preferences'||normal(buttons[1].textContent)!=='Submit'||buttons.some(button=>button.type!=='button'||button.form!==null||button.disabled||!shown(button,env)))throw new Error();
    const approved=new Set([...Object.values(controls),middle,...buttons]);
    if([...box.querySelectorAll('input,select,textarea,button')].some(e=>!approved.has(e))||box.querySelectorAll('input,select,textarea,button').length!==11)throw new Error();
    const excluded=['retrievalEmail','deletionEmail'].map(name=>{const element=one(doc,'input[name="'+name+'"]');if(element.form!==null||element.type!=='email'||element.value!==''||element.disabled||element.readOnly)throw new Error();return element;});
    return{doc,box,container,heading,paragraphs,noticeText,link,controls,middle,buttons,excluded};
  }
  async function verifyNotice(routeId,record,env){
    if(!env.crypto?.subtle||!env.TextEncoder)throw new Error();
    const digest=[...new Uint8Array(await env.crypto.subtle.digest('SHA-256',new env.TextEncoder().encode(record.noticeText)))].map(value=>value.toString(16).padStart(2,'0')).join('');
    if(digest!==ROUTES[routeId].notice)throw new Error();
  }
  async function preparePage(payload,env=globalThis){
    try{
      if(!exact(payload,['routeId'])||!Object.hasOwn(ROUTES,payload.routeId))throw new Error();
      const routeId=payload.routeId,record=inspect(routeId,env,{requireOpen:false});await verifyNotice(routeId,record,env);
      const current=inspect(routeId,env,{requireOpen:false});if(current.box!==record.box||current.container!==record.container||current.noticeText!==record.noticeText)throw new Error();
      try{inspect(routeId,env);return{status:'ready'};}catch(_){}
      const buttons=[...env.document.querySelectorAll('button')].filter(button=>normal(button.textContent)==='View User Data Tools');
      if(buttons.length!==1||buttons[0].type!=='button'||buttons[0].form!==null||buttons[0].disabled||!shown(buttons[0],env)||!env.MutationObserver||!env.ResizeObserver||!env.setTimeout||!env.clearTimeout)throw new Error();
      const button=buttons[0],doc=env.document;
      return await new Promise(resolve=>{
        let done=false,observer,resize,timer;
        const finish=status=>{if(done)return;done=true;observer?.disconnect();resize?.disconnect();if(timer!==undefined)env.clearTimeout(timer);resolve({status});};
        const check=()=>{if(env.document!==doc||!allowedURL(env.location.href,routeId)){finish('blocked');return;}try{const fresh=inspect(routeId,env);if(fresh.box!==record.box||fresh.noticeText!==record.noticeText)throw new Error();finish('ready');}catch(_){}};
        try{
          observer=new env.MutationObserver(check);observer.observe(doc,{subtree:true,childList:true,attributes:true});resize=new env.ResizeObserver(check);resize.observe(record.container);timer=env.setTimeout(()=>finish('blocked'),3000);
          const fresh=inspect(routeId,env,{requireOpen:false});if(fresh.box!==record.box||fresh.noticeText!==record.noticeText||normal(button.textContent)!=='View User Data Tools')throw new Error();
          button.focus();button.click();check();
        }catch(_){finish('blocked');}
      });
    }catch(_){return{status:'blocked'};}
  }
  async function execute(payload,env=globalThis){
    try{
      const canonical=validatePayload(payload,{now:env.Date?.now?.()}),routeId=payload.routeId,record=inspect(routeId,env),signature=JSON.stringify(payload);
      if(journal.has(record.doc))return{status:'unknown',detail:'This association-display action already started. No fields were filled again.'};
      await verifyNotice(routeId,record,env);
      const expected={first_name:'',last_name:'',month:'0',day:'Select',year:'Select',city:'',state:'ALL',email:''};
      function same(skipDayOptions=false){
        if(env.document!==record.doc||JSON.stringify(payload)!==signature)throw new Error();
        const fresh=inspect(routeId,env,{skipDayOptions});
        if(['box','container','heading','link','middle'].some(key=>fresh[key]!==record[key])||fresh.noticeText!==record.noticeText||fresh.paragraphs.some((p,index)=>p!==record.paragraphs[index])||fresh.buttons.some((b,index)=>b!==record.buttons[index])||fresh.excluded.some((e,index)=>e!==record.excluded[index])||Object.keys(expected).some(key=>fresh.controls[key]!==record.controls[key]||fresh.controls[key].value!==expected[key]))throw new Error();
      }
      same();if(journal.has(record.doc))return{status:'unknown',detail:'This association-display action already started. No repeat was authorized.'};journal.add(record.doc);
      const [year,month,day]=canonical.details.date_of_birth.split('-').map(Number);
      const fields={first_name:canonical.details.first_name,last_name:canonical.details.last_name,year:String(year),month:String(month),day:String(day),city:canonical.details.city,state:canonical.details.state,email:canonical.details.email};
      for(const[key,value]of Object.entries(fields)){
        same();const element=record.controls[key],select=element.tagName==='SELECT',prototype=select?env.HTMLSelectElement.prototype:env.HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;
        if(!setter)throw new Error();setter.call(element,value);expected[key]=value;same(key==='month');
        element.dispatchEvent(new env.Event('input',{bubbles:true}));same(key==='month');element.dispatchEvent(new env.Event('change',{bubbles:true}));
        await Promise.resolve();await Promise.resolve();same();
      }
      return{status:'prepared',detail:'Only reviewed relative/associate-display opt-out fields were filled once. Review and submit on the official site. Complete background-report suppression, account deletion, acceptance and removal are not established.'};
    }catch(_){return{status:'blocked',detail:'The reviewed association-display controls or private details changed. No submission, account action or automatic repeat was performed.'};}
  }
  return Object.freeze({ROUTES,STATES,CONTRACT,KEYS,validateDetails,validatePayload,allowedURL,preparePage,execute});
});
