'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Details=require('../extension/association-details.js');
const NOW='2026-11-06T12:00:00.000Z';
const privateFields=()=>({first_name:'Example',last_name:'Person',date_of_birth:'1990-01-15',city:'Example City',state:'CA',email:'removal.fixture@example.test'});
const payload=()=>({routeId:'intelius',operationId:'a'.repeat(32),authorized:true,ownRequestConfirmed:true,consentId:Details.CONTRACT.id,identity:{full_name:'Example Person',age:36},details:privateFields()});
test('only four observed brand-specific association display tools are included',()=>{
  assert.deepEqual(Object.keys(Details.ROUTES).sort(),['instantcheckmate','intelius','truthfinder','ussearch']);
  for(const[id,route]of Object.entries(Details.ROUTES)){
    assert.equal(route.country,'US');assert.equal(new URL(route.url).hostname,route.host);assert.equal(Details.allowedURL(route.url,id),true);
    assert.equal(Details.allowedURL(route.url+'?',id),true);assert.equal(Details.allowedURL(route.url+'?other=true',id),false);
    for(const candidate of ['http://'+route.host+'/privacy-center/',route.url+'#right-to-delete',route.url.replace('app.','www.'),route.url.replace('/privacy-center/','/dashboard/'),'https://'+route.host+'.example.test/privacy-center/'])assert.equal(Details.allowedURL(candidate,id),false,candidate);
  }
  assert.equal(Details.allowedURL('https://app.zabasearch.com/privacy-center/','zabasearch'),false);
  assert.equal(Details.allowedURL('https://app.addresses.com/privacy-center/','addresses'),false);
});
test('six explicit fields normalize only reviewed text, with real full-date and exact workspace age checks',()=>{
  const result=Details.validateDetails(privateFields(),{fullName:'Example Person',age:36,now:NOW});assert.deepEqual(result,privateFields());
  assert.equal(Details.validateDetails({...privateFields(),date_of_birth:'1990-11-07'},{fullName:'Example Person',age:35,now:NOW}).date_of_birth,'1990-11-07');
  assert.equal(Details.validateDetails({...privateFields(),date_of_birth:'1988-02-29'},{fullName:'Example Person',age:38,now:NOW}).date_of_birth,'1988-02-29');
  for(const details of [
    {...privateFields(),first_name:'Other'}, {...privateFields(),state:'ALL'}, {...privateFields(),state:'California'},
    {...privateFields(),email:'invalid'}, {...privateFields(),date_of_birth:'1990'}, {...privateFields(),date_of_birth:'1990-02-29'},
    {...privateFields(),date_of_birth:'1990-04-31'}, {...privateFields(),date_of_birth:'1990-13-01'}, {...privateFields(),date_of_birth:'2010-01-15'},
    {...privateFields(),date_of_birth:'1890-01-15'}, {...privateFields(),date_of_birth:'1990-01-15',middle_name:'Unapproved'},
    {...privateFields(),city:'Example\nCity'}, {...privateFields(),email:'private@example.test\r\nBcc: other@example.test'}
  ])assert.throws(()=>Details.validateDetails(details,{fullName:'Example Person',age:36,now:NOW}));
  for(const options of [{fullName:'Example Person',age:35,now:NOW},{fullName:'Example Person',age:36,now:'invalid'},{fullName:'Example Person',age:36.5,now:NOW}])assert.throws(()=>Details.validateDetails(privateFields(),options));
});
test('association review never requires moving a middle name into the first-name field',()=>{
  const own=privateFields(),options={fullName:'Example Private Person',age:36,now:NOW};assert.deepEqual(Details.validateDetails(own,options),own);
  const compound={...own,first_name:'Mary Ann',last_name:'van der Meer'};assert.deepEqual(Details.validateDetails(compound,{...options,fullName:'Mary Ann Private van der Meer'}),compound);
  assert.throws(()=>Details.validateDetails({...own,last_name:'Other'},options));assert.throws(()=>Details.validateDetails({...own,first_name:'Different'},options));
  const p={...payload(),identity:{full_name:'Example Private Person',age:36}};Details.validatePayload(p,{now:NOW});assert.equal(p.details.first_name,'Example');assert.equal(Object.hasOwn(p.details,'middle_name'),false);
});
test('payload is bound to the reviewed own-information contract and canonical values',()=>{
  Details.validatePayload(payload(),{now:NOW});
  for(const change of [{authorized:false},{ownRequestConfirmed:false},{consentId:'other'},{routeId:'usphonebook'},{details:{...privateFields(),first_name:' Example '}},{details:{...privateFields(),phone:'5555555555'}},{identity:{full_name:'Example Person',age:36,email:'private@example.test'}},{autoSubmit:true},{action:'delete-account'}])assert.throws(()=>Details.validatePayload({...payload(),...change},{now:NOW}));
  assert.match(Details.CONTRACT.authorization,/does not suppress my complete background report/);assert.match(Details.CONTRACT.authorization,/delete an account/);
});
test('unknown routes and missing browser proof cannot disclose fields or trigger public UI actions',async()=>{
  let writes=0;
  const env={location:{href:Details.ROUTES.intelius.url},document:{querySelector(){writes++;throw Error('unproven');}},Date:{now:()=>Date.parse(NOW)}};
  assert.equal((await Details.execute({...payload(),routeId:'addresses'},env)).status,'blocked');assert.equal(writes,0);
  assert.equal((await Details.preparePage({routeId:'addresses'},env)).status,'blocked');assert.equal(writes,0);
  assert.equal((await Details.execute(payload(),env)).status,'blocked');
  assert.equal((await Details.preparePage({routeId:'intelius',identity:payload().identity},env)).status,'blocked');
});
