const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function popup(id='a'.repeat(32),clipboard=true){
  const nodes=new Map(),writes=[],permissions=[];
  const getElementById=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,events:{},addEventListener(name,fn){this.events[name]=fn;}});return nodes.get(id);};
  const context={document:{getElementById},chrome:{runtime:{id},permissions:{async request(value){permissions.push(value);return true;}}},navigator:clipboard?{clipboard:{async writeText(value){writes.push(value);}}}:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../extension/popup.js'),'utf8'),context);
  return {nodes,writes,permissions,click:async id=>getElementById(id).events.click?.()};
}
test('mail setup command uses only this validated public extension ID and requires an explicit copy click',async()=>{
  const p=popup();assert.deepEqual(p.writes,[]);assert.deepEqual(p.permissions,[]);
  const command='python3 tools/mail_setup_web.py --extension-id '+'a'.repeat(32);
  assert.equal(p.nodes.get('mail-setup-command').value,command);
  await p.click('copy-mail-setup');assert.deepEqual(p.writes,[command]);assert.deepEqual(p.permissions,[]);
  assert.match(p.nodes.get('result').textContent,/No account was connected/);
});
test('unrecognized extension identity cannot produce executable setup text',async()=>{
  for(const id of [undefined,'','q'.repeat(32),'a'.repeat(31),'a'.repeat(32)+';echo secret']){
    const p=popup(id===undefined?null:id);assert.equal(p.nodes.get('copy-mail-setup').disabled,true);
    await p.click('copy-mail-setup');assert.deepEqual(p.writes,[]);assert.deepEqual(p.permissions,[]);
    assert.doesNotMatch(p.nodes.get('mail-setup-command').value,/python3/);
  }
});
test('clipboard denial keeps selectable setup text and never connects an account',async()=>{
  const p=popup('b'.repeat(32),false);await p.click('copy-mail-setup');
  assert.match(p.nodes.get('result').textContent,/Select and copy/);assert.match(p.nodes.get('mail-setup-command').value,/--extension-id b{32}$/);
  assert.deepEqual(p.permissions,[]);
});

test('copying the public companion ID is explicit and sends no credential or permission request',async()=>{
  const p=popup('c'.repeat(32));assert.equal(p.nodes.get('mail-companion-id').value,'c'.repeat(32));assert.deepEqual(p.writes,[]);
  await p.click('copy-companion-id');assert.deepEqual(p.writes,['c'.repeat(32)]);assert.deepEqual(p.permissions,[]);
});
