document.getElementById('enable').addEventListener('click',async()=>{
  try{
    const granted=await chrome.permissions.request({origins:[
      'https://privacy.peopledatalabs.com/*','https://www.usphonebook.com/*',
      'https://www.searchpeoplefree.com/*','https://www.fastpeoplesearch.com/*',
      'https://www.apollo.io/*','https://www.spokeo.com/*',
      'https://www.advancedbackgroundchecks.com/*','https://www.nosorgulama.com.tr/*',
      'https://www.numaraara.com/*','https://www.numarasor.com/*','https://www.telefonsorgulama.com/*',
      'https://www.peopletraceuk.com/*'
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
if(typeof mailSetupId==='string'&&/^[a-p]{32}$/.test(mailSetupId)){
  const command='python3 tools/setup_removal_mail.py --extension-id '+mailSetupId;
  mailSetupField.value=command;
  mailSetupCopy.addEventListener('click',async()=>{
    try{
      if(!globalThis.navigator?.clipboard?.writeText)throw new Error();
      await navigator.clipboard.writeText(command);
      document.getElementById('result').textContent='Setup command copied. Run it from the extracted connector folder. No account was connected or permission requested.';
    }catch(_){document.getElementById('result').textContent='Select and copy the setup command above. No account was connected.';}
  });
}else{
  mailSetupCopy.disabled=true;
  mailSetupField.value='Reload the companion to obtain its installation ID.';
}
