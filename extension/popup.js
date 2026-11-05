document.getElementById('enable').addEventListener('click',async()=>{
  try{
    const granted=await chrome.permissions.request({origins:[
      'https://privacy.peopledatalabs.com/*','https://www.usphonebook.com/*',
      'https://www.searchpeoplefree.com/*','https://www.fastpeoplesearch.com/*'
    ]});
    document.getElementById('result').textContent=granted?'Broker access enabled. Refresh your workspace.':'Access was not granted. Official forms can still be opened by hand.';
  }catch(_){document.getElementById('result').textContent='Access could not be enabled. Open the extension settings and try again.';}
});
