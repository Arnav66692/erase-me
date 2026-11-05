'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../webapp/static/workspace-core.js');
const Automatic = require('../extension/automatic-executor.js');
const ContactSetup = require('../webapp/static/contact-setup.js');
const NextSteps = require('../webapp/static/next-steps.js');
const listing = 'https://www.spokeo.com/Example-Person/California/Example-City/p123456';
const key = 'a'.repeat(64);
function gate() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

async function fixture({ bound = [], started = [], held = [], delayed = false, delayedMail = false, delayedContact = false, preMatched = false, globals = true, country = 'US', matchResult,focusAvailable=true,focusCapability=true,beforeFocusPing } = {}) {
  const values = new Map(); let sequence = 0, stamp = '2026-11-05T00:00:00.000Z';
  const core = Core.create({ storage: { getItem: id => values.get(id) || null, setItem: (id, value) => values.set(id, value), removeItem: id => values.delete(id) },
    uuid: () => (++sequence).toString(16).padStart(32, '0'), now: () => stamp });
  await core.api('/api/signup', { method: 'POST', body: JSON.stringify({ name: 'Example Person', age: 35, email: 'person@example.test', authorized: true }) });
  await core.api('/api/profile', { method: 'POST', body: JSON.stringify({ country, city: 'Example City' }) });
  for (const id of new Set([...bound, ...started])) {
    core.setEvidence(id, { first_name: 'Example', last_name: 'Person' });
    if (bound.includes(id)) {
      core.mailSessionRequest(id);
      const operation_id = core.snapshot().items[id].id, request_id = (id === 'usphonebook' ? 'b' : 'c').repeat(32);
      const issued_at = Math.floor(Date.parse(stamp) / 1000), expires_at = issued_at + 7 * 86400;
      const contact_email = 'removal+erase-' + request_id + '@gmail.com';
      const claims = { v: 1, request_id, route_id: id, operation_id, recipient: contact_email, issued_at, expires_at };
      core.bindMailContact(id, { status: 'ready', request_id, route_id: id, operation_id, contact_email, expires_at,
        capability: Buffer.from(JSON.stringify(claims)).toString('base64url') + '.' + 'a'.repeat(43), automatic_execution: false });
    }
    if (started.includes(id)) core.prepare(id);
  }
  if (preMatched) {
    const request = core.matchRequest('spokeo', listing);
    core.recordMatch('spokeo', request.operationId, { status: 'matched', candidateUrl: listing, source: 'structured_person_v1', match_verified: true,
      evidence: ['structured_person', 'exact_candidate_url', 'name', 'email'] });
  }
  for (const id of held) core.holdRoute(id);
  let document;
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.attributes = new Map(); this._text = ''; this._disabled = false; this.value = ''; this.checked = false; this.hidden = false; this.open = false; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.children = []; }
    get disabled() { return this._disabled; }
    set disabled(value) { this._disabled = Boolean(value); if (value && document?.activeElement === this) document.activeElement = document.body; }
    get isConnected() { let current = this; while (current) { if (current === document.body) return true; current = current.parentElement; } return false; }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; this._text = ''; this.append(...children); }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    querySelector(selector) { return find(this, element => selector === '.listing-title' ? element.className === 'listing-title' : selector === '.listing-info' ? element.className === 'listing-info' : selector==='summary'?element.tagName==='SUMMARY':false); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; find(this, element => ['INPUT', 'BUTTON'].includes(element.tagName))?.focus(); }
    close() { this.open = false; this.listeners.close?.(); }
  }
  function find(element, predicate) { if (predicate(element)) return element; for (const child of element.children) { const found = find(child, predicate); if (found) return found; } }
  const body = new Element('body'), changes = [], posted = [], saves = [], batches = [], sessions = [], mailCalls = [], contactCalls = [], creates = [], deadlines = [], events = [];
  document = { body, activeElement: body, createElement: tag => new Element(tag), getElementById: id => find(body, element => element.id === id), dispatchEvent: event => changes.push(event.type) };
  const feedback = new Element('p'); feedback.id = 'campaign-feedback'; const toolbox = new Element('div'); toolbox.id = 'public-tools'; const list = new Element('div'); list.id = 'listing-items'; body.append(feedback, toolbox, list);
  const byId = id => document.getElementById(id), runGate = gate(), mailGate = gate(), contactGate = gate();
  const workspace = { ...core, setEvidence: (...args) => { saves.push(args); return core.setEvidence(...args); } };
  const batch = { create: config => {
    creates.push(config); let stopped = false;
    return { stop: () => { stopped = true; }, run: async (previews, options) => {
      batches.push({ previews, options, keyAtStart: byId('form-batch-mail-key')?.value });
      config.onUpdate({ status: 'running', entries: previews.map(preview => ({ routeId: preview.routeId, status: 'queued' })) });
      if (delayed) await runGate.promise;
      const finished=[];
      for (const preview of previews) {
        if (stopped) break;
        const operation = core.prepareReviewed(preview);
        const result = options.automate && preview.routeId === 'fastpeoplesearch'
          ? { status: 'submission_attempted', attempt_verified: true, stage: 'verification_initiation' } : { status: 'prepared' };
        core.recordCompanion(preview.routeId, operation.operationId, result);
        events.push('saved:'+preview.routeId);
        if(result.status==='submission_attempted')finished.push({routeId:preview.routeId,operationId:operation.operationId,result});
        if (config.afterResult && result.status === 'submission_attempted') await config.afterResult({ routeId: preview.routeId, operationId: operation.operationId, result, isStopped: () => stopped });
      }
      if(!stopped&&config.afterForms)await config.afterForms({entries:finished,isStopped:()=>stopped});
      config.onUpdate({ status: stopped ? 'stopped' : 'finished', entries: [] });
    } };
  } };
  const session = { create: config => {
    const record = { receivedKey: config.operatorKey, keyAtCreation: byId('form-batch-mail-key').value, continuationFields:JSON.parse(JSON.stringify(config.continuationFields)),disposed: false, disposeCount: 0 };
    sessions.push(record);
    return { dispose: () => { record.disposed = true; record.disposeCount++; }, process: async payload => {
      mailCalls.push({ routeId: payload.routeId, stopped: payload.isStopped?.() || record.disposed });
      events.push('mail:'+payload.routeId);
      if (delayedMail) await mailGate.promise;
      return { status: 'awaiting_mail', detail: 'No correlated message in this one pass.' };
    } };
  } };
  const mail={status:async()=>({configured:true,enabled:true}),continuation:async request=>{
    const routeId=JSON.parse(Buffer.from(request.capability.split('.')[0],'base64url').toString()).route_id;
    const item=core.dashboard().items.find(item=>item.site_id===routeId);
    assert.equal(item.site_id,'fastpeoplesearch');
    return {status:'confirmation_ready',route_id:item.site_id,request_id:item.mail_contact.request_id,operation_id:item.operation_id,receipt_ref:request.receipt_ref,automatic_execution:false,
      confirmation_url:'https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:item.input_fields.first_name,middlename:'',lastname:item.input_fields.last_name,email:item.mail_contact.contact_email,ticketid:'12345678'})};
  },session:async(request,operatorKey)=>{
    contactCalls.push({request,operatorKey,keyAtCall:byId('form-batch-mail-key').value});
    if(delayedContact)await contactGate.promise;
    const request_id=(request.route_id==='usphonebook'?'d':'e').repeat(32),issued_at=Math.floor(Date.parse(stamp)/1000),expires_at=issued_at+7*86400;
    const contact_email='removal+erase-'+request_id+'@gmail.com';
    const claims={v:1,request_id,route_id:request.route_id,operation_id:request.operation_id,recipient:contact_email,issued_at,expires_at};
    return {status:'ready',request_id,route_id:request.route_id,operation_id:request.operation_id,contact_email,expires_at,
      capability:Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+'a'.repeat(43),automatic_execution:false};
  }};
  const listeners = new Map(); let timeoutId = 0;
  const window = {
    addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener: type => listeners.delete(type),
    postMessage: message => {
      const payload = message.payload; posted.push(payload);
      let result;
      if (payload.action === 'helper-status') result = { available: true, image: true, audio: false };
      else if (payload.action === 'match') {
        assert.equal(core.snapshot().items.spokeo.matching_request.id, payload.operationId);
        assert.equal(core.snapshot().items.spokeo.operation_id, null);
        result = matchResult || { status: 'matched', candidateUrl: payload.listingUrl, evidence: ['structured_person', 'exact_candidate_url', 'name', 'email'], source: 'structured_person_v1', match_verified: true };
      } else if(payload.action==='continue'){
        assert.equal(core.snapshot().items[payload.routeId].continuation.result,'unknown');result={status:'prepared'};
      }else if(payload.action==='focus-existing')result={status:focusAvailable?'focused':'unavailable',routeId:payload.routeId,stage:payload.stage};
      else {
        if(payload.action==='ping')beforeFocusPing?.(core);
        result = { routes: core.routes().filter(route => route.automationLevel === 'companion').map(route => route.id), capabilities: ['explicit-fields-v1', 'structured-fields-v1','fastpeoplesearch-continuation-v1',...(focusCapability?['owned-tab-focus-v1']:[])] };
      }
      queueMicrotask(() => listeners.get('message')?.({ source: window, origin: 'https://erase-me-preview.vercel.app', data: { source: 'erase-companion', requestId: message.requestId, reply: { ok: true, result } } }));
    }
  };
  const context = { document, EraseWorkspace: workspace, EraseFormBatch: batch,EraseNextSteps:NextSteps, ...(globals ? { EraseAutomaticExecutor: Automatic, EraseRemovalSession: session, EraseRemovalMail: mail, EraseContactSetup: ContactSetup } : {}),
    URL, Blob, CustomEvent: class { constructor(type) { this.type = type; } }, location: { origin: 'https://erase-me-preview.vercel.app' },
    crypto: { randomUUID: () => (++sequence).toString(16).padStart(32, '0') }, setTimeout: (_callback, delay) => { deadlines.push(delay); return ++timeoutId; }, clearTimeout() {}, window };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../webapp/static/workspace-ui.js'), 'utf8'), context);
  function render() {
    list.replaceChildren(); const items = core.dashboard().items;
    for (const item of items) { const row = new Element('article'), title = new Element('a'), info = new Element('div'); title.className = 'listing-title'; title.textContent = item.name; info.className = 'listing-info'; info.append(title); row.append(info); list.append(row); }
    context.EraseWorkspaceUI.decorate(items); context.EraseWorkspaceUI.tools();
  }
  render();
  const button = text => find(body, element => element.tagName === 'BUTTON' && element.textContent === text);
  const input = label => find(body, element => ['INPUT', 'TEXTAREA'].includes(element.tagName) && element.attributes.get('aria-label') === label);
  const click = async target => { if (typeof target === 'string') target = button(target); assert.ok(target); assert.equal(target.disabled, false); target.focus(); return target.listeners.click(); };
  const toggle = (id, checked = true) => { const element = typeof id === 'string' ? byId(id) : id; assert.ok(element); assert.equal(element.disabled, false); element.checked = checked; element.listeners.change?.(); };
  const fillNames = id => { input(core.routes().find(route => route.id === id).name + ' Your first name').value = 'Example'; input(core.routes().find(route => route.id === id).name + ' Your last name').value = 'Person'; };
  return { core, workspace, body, document, values, byId, button, input, click, toggle, fillNames, render, changes, posted, saves, batches, sessions, mailCalls, contactCalls, events, creates, deadlines,
    text: () => body.textContent, time: value => { stamp = value; }, complete: runGate.resolve, completeMail: mailGate.resolve,completeContact:contactGate.resolve };
}

test('automatic options are fresh and exact consent appears only after explicit opt-in', async () => {
  const ui = await fixture(); ui.fillNames('fastpeoplesearch'); await ui.click('Review form batch');
  assert.equal(ui.byId('form-batch-automate').checked, false); assert.equal(ui.byId('form-batch-mail').checked, false);
  assert.equal(ui.byId('form-batch-approval').checked, false); assert.deepEqual(ui.posted, []);
  ui.toggle('form-batch-approval'); ui.toggle('form-batch-automate');
  assert.equal(ui.byId('form-batch-approval').checked, false);
  assert.ok(ui.text().includes(Automatic.CONTRACTS.fastpeoplesearch.consentText));
  await ui.click('Close review'); await ui.click('Review form batch');
  assert.equal(ui.byId('form-batch-automate').checked, false); assert.equal(ui.byId('form-batch-mail').checked, false);
});

test('automatic submission is never selected implicitly and absent modules keep the original run contract', async () => {
  for (const globals of [true, false]) {
    const ui = await fixture({ globals }); await ui.click('Review form batch'); ui.toggle('form-batch-approval'); await ui.click(ui.byId('form-batch-start'));
    assert.deepEqual(JSON.parse(JSON.stringify(ui.batches[0].options)), { authorized: true });
    assert.equal(Object.hasOwn(ui.creates[0], 'afterResult'), false);
    if (!globals) assert.equal(ui.byId('form-batch-automate'), undefined);
    assert.equal(ui.sessions.length, 0);
  }
});

test('NumaraAra shows the original policy agreement and the reviewed policy destination', async () => {
  const ui = await fixture({ country: 'TR' });
  ui.input('NumaraAra Your removal request text').value = 'Please remove my own record.';
  ui.input('NumaraAra I reviewed these fields and confirm this request concerns my own information.').checked = true;
  await ui.click('Review form batch'); ui.toggle('form-batch-automate');
  assert.ok(ui.text().includes(Automatic.CONTRACTS['tr-numaraara'].consentText));
  function links(element) { return [...(element.href ? [element.href] : []), ...element.children.flatMap(links)]; }
  assert.ok(links(ui.body).includes(Automatic.CONTRACTS['tr-numaraara'].policyUrl));
});

test('invalid private mail key is cleared and blocks all form starts', async () => {
  const ui = await fixture({ bound: ['fastpeoplesearch'] }); await ui.click('Review form batch');
  ui.toggle('form-batch-mail'); ui.byId('form-batch-mail-key').value = 'invalid-private-key'; ui.toggle('form-batch-approval');
  await ui.click(ui.byId('form-batch-start'));
  assert.equal(ui.byId('form-batch-mail-key').value, ''); assert.equal(ui.batches.length, 0); assert.equal(ui.sessions.length, 0);
  assert.equal(ui.core.snapshot().items.fastpeoplesearch.operation_id, null);
});

test('one-pass mail key reaches only the session and final pass follows all saved forms', async () => {
  const ui = await fixture({ bound: ['fastpeoplesearch'] }); await ui.click('Review form batch');
  ui.toggle('form-batch-automate'); ui.toggle('form-batch-mail'); ui.byId('form-batch-mail-key').value = key; ui.toggle('form-batch-approval');
  await ui.click(ui.byId('form-batch-start'));
  assert.equal(ui.sessions.length, 1); assert.equal(ui.sessions[0].receivedKey, key); assert.equal(ui.sessions[0].keyAtCreation, '');
  assert.equal(ui.batches[0].keyAtStart, ''); assert.equal(ui.batches[0].options.automate, true);
  assert.deepEqual(ui.mailCalls.map(call => call.routeId), ['fastpeoplesearch']); assert.equal(ui.sessions[0].disposed, true);
  assert.equal(Object.hasOwn(ui.creates[0],'afterResult'),false);
  assert.ok(ui.events.indexOf('mail:fastpeoplesearch')>Math.max(...ui.events.map((event,index)=>event.startsWith('saved:')?index:-1)));
  assert.equal(ui.mailCalls.length, 1);
  assert.equal(ui.core.exportData().includes(key), false); assert.equal(JSON.stringify(ui.batches).includes(key), false); assert.equal(JSON.stringify(ui.posted).includes(key), false);
  assert.equal(ui.byId('form-batch-mail').checked, false); assert.equal(ui.byId('form-batch-automate').checked, false);
});

test('closing or stopping a running session disposes the key and blocks later mail legs', async () => {
  for (const close of [true, false]) {
    const ui = await fixture({ bound: ['fastpeoplesearch'], delayed: true }); await ui.click('Review form batch');
    ui.toggle('form-batch-mail'); ui.byId('form-batch-mail-key').value = key; ui.toggle('form-batch-approval');
    const run = ui.click(ui.byId('form-batch-start'));
    assert.equal(ui.sessions[0].disposed, false);
    await ui.click(close ? 'Close review' : 'Stop after current form');
    assert.equal(ui.sessions[0].disposed, true); ui.complete(); await run;
    assert.deepEqual(ui.mailCalls, []); assert.equal(ui.byId('form-batch-mail-key').value, '');
  }
});

test('contact setup is unselected, excludes held and started routes, and keeps identity-email routes unchanged',async()=>{
  const ui=await fixture({held:['usphonebook']});await ui.click('Review form batch');
  assert.equal(ui.byId('form-batch-contact-fastpeoplesearch').checked,false);
  for(const id of ['usphonebook','searchpeoplefree','peopledatalabs-form','apollo'])assert.equal(ui.byId('form-batch-contact-'+id),undefined);
  assert.equal(ui.byId('form-batch-contact-prepare').disabled,true);assert.deepEqual(ui.contactCalls,[]);assert.equal(ui.byId('form-batch-mail-key').disabled,true);
  ui.toggle('form-batch-contact-fastpeoplesearch');assert.equal(ui.byId('form-batch-mail-key').disabled,false);
  const started=await fixture({started:['fastpeoplesearch']});await started.click('Review form batch');assert.equal(started.byId('form-batch-contact-fastpeoplesearch'),undefined);
});

test('invalid contact setup key is cleared before any alias, broker or mailbox action',async()=>{
  const ui=await fixture();await ui.click('Review form batch');ui.toggle('form-batch-contact-fastpeoplesearch');ui.byId('form-batch-mail-key').value='bad-key';
  await ui.click('Prepare selected removal contacts');assert.deepEqual(ui.contactCalls,[]);assert.deepEqual(ui.batches,[]);assert.deepEqual(ui.mailCalls,[]);
  assert.equal(ui.byId('form-batch-mail-key').value,'');assert.equal(Boolean(ui.core.dashboard().items.find(item=>item.site_id==='fastpeoplesearch').mail_contact),false);
});

test('contact setup shows the exact new address in a fresh unapproved review and one key serves the later final pass',async()=>{
  const ui=await fixture({held:['usphonebook']});ui.fillNames('fastpeoplesearch');await ui.click('Review form batch');
  ui.toggle('form-batch-approval');ui.toggle('form-batch-contact-fastpeoplesearch');assert.equal(ui.byId('form-batch-approval').checked,false);
  ui.byId('form-batch-mail-key').value=key;await ui.click('Prepare selected removal contacts');
  assert.equal(ui.contactCalls.length,1);assert.equal(ui.contactCalls[0].keyAtCall,'');assert.equal(ui.contactCalls[0].request.route_id,'fastpeoplesearch');
  const address=ui.core.dashboard().items.find(item=>item.site_id==='fastpeoplesearch').mail_contact.contact_email;
  assert.ok(ui.text().includes(address));assert.equal(ui.byId('form-batch-approval').checked,false);assert.equal(ui.byId('form-batch-mail').checked,false);
  assert.equal(ui.sessions.length,1);assert.equal(ui.byId('form-batch-mail-key').value,'');assert.equal(ui.byId('form-batch-contact-fastpeoplesearch'),undefined);
  assert.deepEqual(ui.batches,[]);assert.deepEqual(ui.mailCalls,[]);assert.deepEqual(ui.posted,[]);
  ui.toggle('form-batch-automate');ui.toggle('form-batch-mail');ui.toggle('form-batch-approval');await ui.click(ui.byId('form-batch-start'));
  assert.equal(ui.sessions.length,1);assert.equal(ui.sessions[0].disposed,true);assert.deepEqual(ui.mailCalls.map(call=>call.routeId),['fastpeoplesearch']);
  assert.equal(ui.batches[0].previews.find(entry=>entry.routeId==='fastpeoplesearch').fields.email,address);
  assert.equal(ui.batches[0].previews.find(entry=>entry.routeId==='peopledatalabs-form').fields.email,'person@example.test');
  assert.equal(ui.core.exportData().includes(key),false);assert.equal(JSON.stringify(ui.posted).includes(key),false);
  assert.equal(ui.core.dashboard().items.find(item=>item.site_id==='usphonebook').held,true);
});

test('closing or stopping while contact issuance is pending never binds, reopens or starts a form',async()=>{
  for(const close of [true,false]){
    const ui=await fixture({delayedContact:true});ui.fillNames('fastpeoplesearch');await ui.click('Review form batch');ui.toggle('form-batch-contact-fastpeoplesearch');ui.byId('form-batch-mail-key').value=key;
    const run=ui.click('Prepare selected removal contacts');await new Promise(resolve=>setImmediate(resolve));
    assert.equal(ui.contactCalls.length,1);await ui.click(close?'Close review':'Stop after current form');ui.completeContact();await run;
    assert.equal(Boolean(ui.core.dashboard().items.find(item=>item.site_id==='fastpeoplesearch').mail_contact),false);
    assert.deepEqual(ui.sessions,[]);assert.deepEqual(ui.batches,[]);assert.deepEqual(ui.mailCalls,[]);assert.equal(ui.byId('form-batch-mail-key').value,'');
    if(close)assert.equal(ui.byId('form-batch-dialog').open,false);
  }
});

test('a profile change during contact setup cannot retain a key or bind the prior result',async()=>{
  const ui=await fixture({delayedContact:true});await ui.click('Review form batch');ui.toggle('form-batch-contact-fastpeoplesearch');ui.byId('form-batch-mail-key').value=key;
  const run=ui.click('Prepare selected removal contacts');await new Promise(resolve=>setImmediate(resolve));
  await ui.core.api('/api/profile',{method:'POST',body:JSON.stringify({city:'Changed City'})});ui.completeContact();await run;
  assert.equal(Boolean(ui.core.dashboard().items.find(item=>item.site_id==='fastpeoplesearch').mail_contact),false);assert.deepEqual(ui.sessions,[]);assert.deepEqual(ui.mailCalls,[]);
});

test('closing the prepared review disposes retained access and a new review needs a new key',async()=>{
  const ui=await fixture();ui.fillNames('fastpeoplesearch');await ui.click('Review form batch');ui.toggle('form-batch-contact-fastpeoplesearch');ui.byId('form-batch-mail-key').value=key;
  await ui.click('Prepare selected removal contacts');assert.equal(ui.sessions[0].disposed,false);await ui.click('Close review');assert.equal(ui.sessions[0].disposed,true);
  await ui.click('Review form batch');ui.toggle('form-batch-mail');ui.toggle('form-batch-approval');await ui.click(ui.byId('form-batch-start'));
  assert.deepEqual(ui.batches,[]);assert.deepEqual(ui.mailCalls,[]);assert.equal(ui.sessions.length,1);
});

test('existing-mail-only checks show bound recipients, exclude held routes and never run a form batch', async () => {
  const ui = await fixture({ bound: ['fastpeoplesearch', 'usphonebook'], started: ['fastpeoplesearch', 'usphonebook'], held: ['usphonebook'] });
  await ui.click('Review form batch');
  assert.ok(ui.byId('form-batch-mail-route-fastpeoplesearch')); assert.equal(ui.byId('form-batch-mail-route-usphonebook'), undefined);
  const target = ui.byId('form-batch-mail-route-fastpeoplesearch'); assert.equal(target.attributes.get('aria-label'), target.parentElement.textContent);
  assert.ok(ui.text().includes(ui.core.dashboard().items.find(item => item.site_id === 'fastpeoplesearch').mail_contact.contact_email));
  await ui.click('Check existing removal mail once'); assert.deepEqual(ui.mailCalls, []);
  ui.toggle('form-batch-mail'); ui.byId('form-batch-mail-key').value = key; ui.toggle('form-batch-approval'); await ui.click('Check existing removal mail once');
  assert.deepEqual(ui.mailCalls.map(call => call.routeId), ['fastpeoplesearch']); assert.deepEqual(ui.batches, []); assert.deepEqual(ui.posted, []);
});

test('automatic continuation review discloses all six fields and rejects a changed requester name',async()=>{
  const ui=await fixture({bound:['usphonebook'],started:['usphonebook']});
  let state=JSON.parse(ui.values.get(Core.KEY));state.items.usphonebook.continuation_fields={city:'Example City',state:'CA',zip_code:'92101'};ui.values.set(Core.KEY,JSON.stringify(state));ui.render();
  await ui.click('Review form batch');
  const review=ui.byId('form-batch-mail-list').textContent;
  for(const label of ['first name','last name','email','city','state','zip code'])assert.ok(review.includes(label));
  for(const value of ['Example','Person','Example City','CA','92101',ui.core.dashboard().items.find(item=>item.site_id==='usphonebook').mail_contact.contact_email])assert.ok(review.includes(value));
  state=JSON.parse(ui.values.get(Core.KEY));state.items.usphonebook.fields.first_name='Changed';ui.values.set(Core.KEY,JSON.stringify(state));
  ui.toggle('form-batch-mail');ui.byId('form-batch-mail-key').value=key;ui.toggle('form-batch-approval');await ui.click('Check existing removal mail once');
  assert.deepEqual(ui.mailCalls,[]);
});

test('FPS mail review discloses only original names and contact before its matching-form opening',async()=>{
  const ui=await fixture({bound:['fastpeoplesearch'],started:['fastpeoplesearch'],held:['usphonebook']});await ui.click('Review form batch');
  const review=ui.byId('form-batch-mail-list').textContent;
  for(const label of ['first name','last name','email'])assert.ok(review.includes(label));
  for(const label of ['zip code','state','date of birth','street address'])assert.equal(review.includes(label),false);
  assert.match(review,/No additional identity fields are filled or submitted/);
  ui.toggle('form-batch-mail');ui.byId('form-batch-mail-key').value=key;ui.toggle('form-batch-approval');await ui.click('Check existing removal mail once');
  assert.deepEqual(ui.sessions[0].continuationFields,{fastpeoplesearch:{}});assert.equal(ui.sessions[0].disposed,true);
});

test('FPS per-route confirmation needs explicit original-field approval and reserves before navigation',async()=>{
  const ui=await fixture({bound:['fastpeoplesearch'],started:['fastpeoplesearch'],held:['usphonebook']});
  const item=ui.core.dashboard().items.find(item=>item.site_id==='fastpeoplesearch');
  ui.core.recordMailReceipt('fastpeoplesearch',{status:'held',route_id:'fastpeoplesearch',operation_id:item.operation_id,request_id:item.mail_contact.request_id,reason:'route_validation_required',
    received_at:Math.floor(Date.parse('2026-11-05T00:00:00.000Z')/1000),receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:true});
  await ui.click('Check removal-mail availability');ui.render();
  const action=ui.button('Open verified matching form');assert.ok(action);
  await ui.click(action);assert.equal(ui.posted.length,0);
  const review=ui.input('FastPeopleSearch I reviewed the original name and removal contact and authorize opening this verified matching form.');
  ui.toggle(review);
  const privateKey=ui.input('FastPeopleSearch private operator pilot key');privateKey.value=key;
  await ui.click(action);
  assert.deepEqual(ui.posted.map(payload=>payload.action),['ping','continue']);assert.equal(privateKey.value,'');
  assert.deepEqual(Object.keys(ui.posted[1].fields).sort(),['email','first_name','last_name']);
  assert.equal(ui.core.snapshot().items.fastpeoplesearch.continuation.result,'prepared');assert.equal(ui.core.dashboard().counts.removed,0);assert.equal(ui.core.exportData().includes('ticketid'),false);
});

test('mail-only stop checks no later contacts and a changed reviewed workspace blocks mailbox access', async () => {
  const ui = await fixture({ bound: ['fastpeoplesearch', 'usphonebook'], started: ['fastpeoplesearch', 'usphonebook'], delayedMail: true });
  await ui.click('Review form batch'); ui.toggle('form-batch-mail'); ui.byId('form-batch-mail-key').value = key; ui.toggle('form-batch-approval');
  const run = ui.click('Check existing removal mail once'); await new Promise(resolve => setImmediate(resolve));
  await ui.click('Stop after current form'); ui.completeMail(); await run;
  assert.equal(ui.mailCalls.length, 1); assert.equal(ui.sessions[0].disposed, true);
  const changed = await fixture({ bound: ['fastpeoplesearch'], started: ['fastpeoplesearch'] });
  await changed.click('Review form batch'); changed.core.remove(); changed.toggle('form-batch-mail'); changed.byId('form-batch-mail-key').value = key; changed.toggle('form-batch-approval');
  await changed.click('Check existing removal mail once'); assert.deepEqual(changed.mailCalls, []); assert.deepEqual(changed.batches, []);
});

test('helper capability lookup is explicit and reports separate image/audio availability', async () => {
  const ui = await fixture(); assert.deepEqual(ui.posted, []); assert.deepEqual(ui.deadlines, []);
  await ui.click('Check local challenge helper'); assert.deepEqual(ui.posted.map(payload => payload.action), ['helper-status']);
  assert.match(ui.text(), /Text-image recognition: available/); assert.match(ui.text(), /Audio recognition: unavailable/);
});

test('record matching needs an explicit candidate and persists its check before the companion call', async () => {
  const ui = await fixture(); await ui.click('Match this record'); assert.deepEqual(ui.posted, []);
  assert.match(ui.text(), /Enter your public Spokeo record URL/);
  ui.input('Spokeo Your confirmed listing URL').value = listing; await ui.click('Match this record');
  assert.deepEqual(ui.posted.map(payload => payload.action), ['match']); assert.ok(ui.deadlines.includes(60000));
  assert.equal(ui.core.dashboard().items.find(item => item.site_id === 'spokeo').automatic_match, true);
  assert.equal(ui.core.snapshot().items.spokeo.operation_id, null); assert.deepEqual(ui.changes, ['erase-workspace-change']);
  const held = await fixture({ held: ['spokeo'] }); assert.equal(held.button('Match this record'), undefined);
});

test('unsupported structured matching never creates a manual ownership affirmation', async () => {
  const ui = await fixture({ matchResult: { status: 'needs_identity', candidateUrl: listing, evidence: ['name', 'age', 'city'], source: 'structured_person_v1', match_verified: true } });
  ui.input('Spokeo Your confirmed listing URL').value = listing; await ui.click('Match this record');
  assert.equal(ui.core.dashboard().items.find(item => item.site_id === 'spokeo').automatic_match, false);
  assert.notEqual(ui.core.snapshot().items.spokeo.affirmations.own_listing, true);
});

test('derived checkboxes keep a scoped automatic reference and stale proof never becomes manual through Review', async () => {
  const ui = await fixture({ preMatched: true });
  const automatic = ui.input('Spokeo This listing has a current automatic match using my name and identity email.');
  assert.equal(automatic.checked, true); ui.time('2026-11-05T00:31:00.000Z');
  await ui.click('Review form batch'); assert.equal(ui.input('Include Spokeo in this form batch'), undefined);
  const save = ui.saves.find(args => args[0] === 'spokeo'); assert.equal(typeof save[3].automaticReference, 'string');
  assert.equal(ui.core.snapshot().items.spokeo.affirmations.own_listing, false);
  await ui.click('Close review'); ui.toggle(automatic, true); await ui.click('Review form batch');
  assert.ok(ui.input('Include Spokeo in this form batch'));
  assert.equal(ui.saves.filter(args => args[0] === 'spokeo').at(-1)[3].manualListingReview, true);
});

test('editing a derived record clears its checkbox without losing the reference that blocks stale promotion', async () => {
  const ui = await fixture({ preMatched: true }); const input = ui.input('Spokeo Your confirmed listing URL');
  const approval = ui.input('Spokeo This listing has a current automatic match using my name and identity email.');
  input.value = listing.replace('p123456', 'p654321'); input.listeners.input(); assert.equal(approval.checked, false);
  approval.checked = true; await ui.click('Review form batch');
  assert.equal(ui.input('Include Spokeo in this form batch'), undefined);
  assert.equal(typeof ui.saves.find(args => args[0] === 'spokeo')[3].automaticReference, 'string');
});

async function detailPromptFixture(options={}){
  const ui=await fixture({bound:['fastpeoplesearch'],started:['fastpeoplesearch'],held:['usphonebook'],...options});
  const item=ui.core.dashboard().items.find(item=>item.site_id==='fastpeoplesearch');
  const receipt={status:'held',route_id:item.site_id,operation_id:item.operation_id,request_id:item.mail_contact.request_id,reason:'route_validation_required',
    received_at:Math.floor(Date.parse('2026-11-05T00:00:00.000Z')/1000),receipt_ref:'c'.repeat(64),authenticated:true,automatic_execution:false,continuation_available:true};
  ui.core.recordMailReceipt('fastpeoplesearch',receipt);ui.core.mailContinuationRequest('fastpeoplesearch',{});
  const response={status:'confirmation_ready',route_id:item.site_id,operation_id:item.operation_id,request_id:item.mail_contact.request_id,receipt_ref:receipt.receipt_ref,automatic_execution:false,
    confirmation_url:'https://www.fastpeoplesearch.com/optout/removal?'+new URLSearchParams({firstname:'Example',middlename:'',lastname:'Person',email:item.mail_contact.contact_email,ticketid:'12345678'})};
  const operation=ui.core.prepareMailContinuation(item.site_id,response,{});ui.core.recordMailContinuation(item.site_id,operation.operationId,{status:'prepared'});ui.render();
  return ui;
}

test('a prominent next-step prompt shows the request-specific removal email and exact identity requirement without sending anything',async()=>{
  const ui=await detailPromptFixture(),panel=ui.byId('next-steps-panel'),card=ui.byId('next-step-fastpeoplesearch');
  assert.ok(panel);assert.equal(panel.attributes.get('aria-labelledby'),'next-steps-heading');
  const email=ui.core.dashboard().items.find(item=>item.site_id==='fastpeoplesearch').mail_contact.contact_email;
  assert.ok(card.textContent.includes(email));assert.equal(card.textContent.includes('person@example.test'),false);
  assert.match(card.textContent,/date of birth/i);assert.match(card.textContent,/street address/i);assert.match(card.textContent,/city/i);assert.match(card.textContent,/ZIP/i);
  assert.equal(ui.byId('next-step-usphonebook'),undefined);assert.deepEqual(ui.posted,[]);assert.deepEqual(ui.mailCalls,[]);
  const action=ui.byId('next-step-fastpeoplesearch-primary');assert.match(action.attributes.get('aria-label'),/FastPeopleSearch/);assert.equal(action.attributes.get('aria-describedby'),'next-step-fastpeoplesearch-help');
});

test('verification prompts name the broker and show its captured recipient without opening a mailbox',async()=>{
  const ui=await fixture();const operation=ui.core.prepare('peopledatalabs-form');
  ui.core.recordCompanion('peopledatalabs-form',operation.operationId,{status:'verification_sent',route_verified:true,evidence:'fresh_visible_success'});ui.render();
  const card=ui.byId('next-step-peopledatalabs-form');assert.ok(card.textContent.includes('person@example.test'));
  assert.ok(ui.byId('next-step-peopledatalabs-form-heading').textContent.includes('People Data Labs'));assert.match(card.textContent,/verification message/);
  assert.deepEqual(ui.posted,[]);assert.deepEqual(ui.mailCalls,[]);
});

test('providing missing information focuses only the existing continuation using opaque references',async()=>{
  const ui=await detailPromptFixture();await ui.click(ui.byId('next-step-fastpeoplesearch-primary'));
  assert.deepEqual(ui.posted.map(value=>value.action),['ping','focus-existing']);
  const request=ui.posted[1];assert.equal(request.stage,'continuation');assert.equal(request.routeId,'fastpeoplesearch');
  assert.deepEqual(Object.keys(request).sort(),['action','authorized','operationId','receiptRef','requestId','routeId','stage'].sort());
  assert.equal(JSON.stringify(request).includes('@'),false);assert.equal(JSON.stringify(request).includes('https:'),false);assert.deepEqual(ui.mailCalls,[]);
  assert.match(ui.byId('campaign-feedback').textContent,/existing form is open in Chrome/);assert.equal(ui.core.dashboard().counts.removed,0);
});

test('a changed request or route hold while the companion preflights prevents stale focus',async()=>{
  const ui=await detailPromptFixture({beforeFocusPing:core=>core.holdRoute('fastpeoplesearch')});
  await ui.click(ui.byId('next-step-fastpeoplesearch-primary'));assert.deepEqual(ui.posted.map(value=>value.action),['ping']);
  ui.render();assert.equal(ui.byId('next-step-fastpeoplesearch'),undefined);
});

test('unavailable or outdated companions give a manual existing-tab fallback without opening or repeating anything',async()=>{
  for(const options of [{focusAvailable:false},{focusCapability:false}]){
    const ui=await detailPromptFixture(options);await ui.click(ui.byId('next-step-fastpeoplesearch-primary'));
    assert.ok(ui.posted.every(value=>['ping','focus-existing'].includes(value.action)));assert.deepEqual(ui.mailCalls,[]);
    assert.match(ui.byId('campaign-feedback').textContent,/existing|current tab|Chrome/);assert.equal(ui.core.snapshot().items.fastpeoplesearch.continuation.result,'prepared');
  }
});

test('reviewing a next step opens its existing request details and moves keyboard focus to the summary',async()=>{
  const ui=await detailPromptFixture();await ui.click(ui.byId('next-step-fastpeoplesearch-review'));
  const details=ui.byId('request-steps-fastpeoplesearch');assert.equal(details.open,true);assert.equal(ui.document.activeElement,details.querySelector('summary'));assert.deepEqual(ui.posted,[]);
});

test('next-step renders preserve an intentional focused control and pause suppresses action cards',async()=>{
  const ui=await detailPromptFixture();ui.byId('next-step-fastpeoplesearch-primary').focus();ui.render();
  assert.equal(ui.document.activeElement,ui.byId('next-step-fastpeoplesearch-primary'));
  await ui.core.api('/api/campaign',{method:'POST',body:JSON.stringify({action:'pause'})});ui.render();
  assert.equal(ui.byId('next-step-fastpeoplesearch'),undefined);assert.match(ui.byId('next-steps-panel').textContent,/paused/);assert.deepEqual(ui.posted,[]);
});
