(() => {
  'use strict';
  const origin='https://erase-me-preview.vercel.app';
  if(location.origin!==origin)return;
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.source!==window||event.origin!==origin||!data||data.source!=='erase-workspace'||!/^[a-f0-9-]{32,40}$/.test(data.requestId||''))return;
    if(!['ping','helper-status','match','run','result','observe','continue','continuation-result','focus-existing'].includes(data.payload?.action))return;
    chrome.runtime.sendMessage({...data.payload,type:'erase-me'},reply=>{
      const error=chrome.runtime.lastError;
      window.postMessage({source:'erase-companion',requestId:data.requestId,reply:error?{ok:false,error:'Companion unavailable. Refresh this page after installing it.'}:reply},origin);
    });
  });
})();
