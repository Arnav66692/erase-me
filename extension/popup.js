document.getElementById('enable').addEventListener('click',async()=>{
  try{
    const granted=await chrome.permissions.request({origins:[
      'https://privacy.peopledatalabs.com/*','https://www.usphonebook.com/*',
      'https://www.searchpeoplefree.com/*','https://www.fastpeoplesearch.com/*',
      'https://www.apollo.io/*','https://www.spokeo.com/*',
      'https://www.advancedbackgroundchecks.com/*','https://www.smartbackgroundchecks.com/*','https://www.familytreenow.com/*','https://www.nosorgulama.com.tr/*',
      'https://www.numaraara.com/*','https://www.numarasor.com/*','https://www.telefonsorgulama.com/*',
      'https://www.peopletraceuk.com/*','https://www.mylife.com/*','https://mylife.jotform.com/*','https://www.whitepages.com/*','https://cmadnm.cawebhosting.ca/*','https://thatsthem.com/*','https://www.peoplefinders.com/*','https://www.lnnte-dncl.gc.ca/*','https://www.tpsonline.org.uk/*','https://www.canada411.ca/*','https://www.truepeoplesearch.com/*','https://www.192.com/*','https://app.intelius.com/*','https://app.truthfinder.com/*','https://app.instantcheckmate.com/*','https://app.ussearch.com/*'
    ]});
    document.getElementById('result').textContent=granted?'Broker access enabled. Refresh your workspace.':'Access was not granted. Official forms can still be opened by hand.';
  }catch(_){document.getElementById('result').textContent='Access could not be enabled. Open the extension settings and try again.';}
});
document.getElementById('enable-helper').addEventListener('click',async()=>{
  try{
    const granted=await chrome.permissions.request({permissions:['nativeMessaging']});
    document.getElementById('result').textContent=granted?'Local connector access enabled. Install the specific challenge or removal-mail host from the source instructions, then explicitly connect it in your workspace.':'Local connector access was not granted. No connector action started.';
  }catch(_){document.getElementById('result').textContent='Local helper access could not be enabled.';}
});
// An extension ID is public, bounded and never contains profile or credential data.
const mailSetupField=document.getElementById('mail-setup-command');
const mailSetupCopy=document.getElementById('copy-mail-setup');
const mailSetupId=chrome.runtime?.id;
const mailIdField=document.getElementById('mail-companion-id'),mailIdCopy=document.getElementById('copy-companion-id');
if(typeof mailSetupId==='string'&&/^[a-p]{32}$/.test(mailSetupId)){
  const command='python3 tools/mail_setup_web.py --extension-id '+mailSetupId;
  mailIdField.value=mailSetupId;
  mailIdCopy.addEventListener('click',async()=>{
    try{if(!globalThis.navigator?.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(mailSetupId);document.getElementById('result').textContent='Companion ID copied. Paste it into the local setup page.';}
    catch(_){document.getElementById('result').textContent='Select and copy the companion ID above.';}
  });
  mailSetupField.value=command;
  mailSetupCopy.addEventListener('click',async()=>{
    try{
      if(!globalThis.navigator?.clipboard?.writeText)throw new Error();
      await navigator.clipboard.writeText(command);
      document.getElementById('result').textContent='Setup command copied. Run it from the extracted connector folder. No account was connected or permission requested.';
    }catch(_){document.getElementById('result').textContent='Select and copy the setup command above. No account was connected.';}
  });
}else{
  mailSetupCopy.disabled=true;mailIdCopy.disabled=true;mailIdField.value='Unavailable';
  mailSetupField.value='Reload the companion to obtain its installation ID.';
}
