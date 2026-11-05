document.getElementById('enable').addEventListener('click',async()=>{
  try{
    const granted=await chrome.permissions.request({origins:[
      'https://privacy.peopledatalabs.com/*','https://www.usphonebook.com/*',
      'https://www.searchpeoplefree.com/*','https://www.fastpeoplesearch.com/*',
      'https://www.apollo.io/*','https://www.spokeo.com/*',
      'https://www.advancedbackgroundchecks.com/*','https://www.nosorgulama.com.tr/*',
      'https://www.numaraara.com/*','https://www.numarasor.com/*','https://www.telefonsorgulama.com/*'
    ]});
    document.getElementById('result').textContent=granted?'Broker access enabled. Refresh your workspace.':'Access was not granted. Official forms can still be opened by hand.';
  }catch(_){document.getElementById('result').textContent='Access could not be enabled. Open the extension settings and try again.';}
});
document.getElementById('enable-helper').addEventListener('click',async()=>{
  try{
    const granted=await chrome.permissions.request({permissions:['nativeMessaging']});
    document.getElementById('result').textContent=granted?'Local helper access enabled. Install the per-user host from the source instructions, then choose Check local challenge helper in your workspace.':'Local helper access was not granted. No recognition attempt started.';
  }catch(_){document.getElementById('result').textContent='Local helper access could not be enabled.';}
});
