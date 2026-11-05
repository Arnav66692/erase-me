'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Base = require('../extension/broker-executor.js');
const Automatic = require('../extension/automatic-executor.js');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function page(routeId = 'fastpeoplesearch') {
  let nativeSubmissions = 0, clicks = 0;
  const all = [], events = [], listeners = [];
  const normal = value => String(value).replace(/\s+/g, ' ').trim();
  class Element {
    constructor(tag = 'div', props = {}) {
      this.tagName = tag.toUpperCase(); this.id = ''; this.name = ''; this.type = ''; this.required = false;
      this.hidden = false; this.disabled = false; this.readOnly = false; this.parentElement = null;
      this.textContent = ''; this.children = []; this.labels = []; this.style = { display: 'block', visibility: 'visible', opacity: '1' };
      Object.assign(this, props); all.push(this);
    }
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
    getClientRects() { return this.hidden ? [] : [{}]; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) { return query(selector).filter(e => e !== this && (this === form ? e.form === this : descendant(e, this))); }
    focus() { env.document.activeElement = this; }
    dispatchEvent(event) { events.push([this.id || this.name, event.type]); this.onEvent?.(event); return true; }
  }
  class Input extends Element {
    constructor(props = {}) { super('input', { type: 'text', ...props }); this._value = ''; this._checked = false; }
    get value() { return this._value; } set value(value) { this._value = String(value); }
    get checked() { return this._checked; } set checked(value) { this._checked = Boolean(value); }
  }
  class Textarea extends Element {
    constructor(props = {}) { super('textarea', props); this._value = ''; }
    get value() { return this._value; } set value(value) { this._value = String(value); }
  }
  function descendant(element, ancestor) { for (let node = element.parentElement; node; node = node.parentElement) if (node === ancestor) return true; return false; }
  function matches(element, selector) {
    const parts = selector.split(/\s+/);
    if (parts.length > 1) {
      const last = parts.pop();
      if (!matches(element, last)) return false;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) if (matches(parent, parts.join(' '))) return true;
      return false;
    }
    const simple = selector.replace(/\[[^\]]+\]/g, '');
    const tag = simple.match(/^[A-Za-z]+/);
    if (tag && element.tagName !== tag[0].toUpperCase()) return false;
    const id = simple.match(/#([\w-]+)/); if (id && element.id !== id[1]) return false;
    const cls = simple.match(/\.([\w-]+)/); if (cls && !(element.className || '').split(/\s+/).includes(cls[1])) return false;
    for (const match of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g)) {
      const key = match[1] === 'role' ? 'role' : match[1], value = element[key];
      if (match[2] === undefined ? value === undefined : String(value) !== match[2]) return false;
    }
    return true;
  }
  const query = selector => all.filter(element => selector.split(',').some(part => matches(element, part.trim())));
  const body = new Element('body');
  const route = Base.ROUTES[routeId];
  const form = new Element('form', { id: routeId === 'fastpeoplesearch' ? 'optout-start' : 'contactForm', method: 'post', action: new URL(route.formPath, route.url).href }); body.append(form);
  Object.defineProperty(form, 'elements', { get: () => all.filter(e => e.form === form && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.tagName)) });
  form.addEventListener = (type, listener, options) => { if (type === 'submit') listeners.push({ listener, capture: options === true || options?.capture === true }); };
  form.removeEventListener = (type, listener) => { const index = listeners.findIndex(entry => entry.listener === listener); if (index >= 0) listeners.splice(index, 1); };
  form.checkValidity = () => { form.onValidate?.(); return form.elements.every(e => !e.required || e.type === 'hidden' || e.disabled || (e.type === 'checkbox' ? e.checked : Boolean(e.value))); };
  const add = (element, parent = form) => { element.form = form; parent.append(element); return element; };
  const fields = routeId === 'fastpeoplesearch' ? { first_name: 'Example', last_name: 'Person', email: 'person@example.test' } : { full_name: 'Örnek Kişi', email: 'person@example.test', request_text: 'Kendi numaramın kaldırılmasını talep ediyorum.' };
  const controls = {};
  for (const [key, value] of Object.entries(fields)) {
    const selector = route[key], id = selector.match(/#([\w-]+)/)?.[1] || '', name = selector.match(/\[name="([^"]+)"\]/)?.[1] || id;
    const element = key === 'request_text' ? new Textarea({ id, name, required: true }) : new Input({ id, name, type: key === 'email' ? 'email' : 'text', required: true });
    element.value = value; controls[key] = add(element);
  }
  const selection = add(new Element('select', { id: routeId === 'fastpeoplesearch' ? '' : 'form_Konu', name: routeId === 'fastpeoplesearch' ? 'am' : 'form.Konu', value: routeId === 'fastpeoplesearch' ? 'subject' : 'Numara Silme Talebi (KVKK)', required: true, options: [{ value: 'subject' }, { value: 'Numara Silme Talebi (KVKK)' }] }));
  const label = new Element(routeId === 'fastpeoplesearch' ? 'div' : 'label', { textContent: (routeId === 'fastpeoplesearch' ? '* ' : '') + Automatic.CONTRACTS[routeId].consentText }); form.append(label);
  const consent = add(new Input({ id: routeId === 'fastpeoplesearch' ? '' : 'form_Kvkk', name: routeId === 'fastpeoplesearch' ? 'legal' : 'form.Kvkk', type: 'checkbox', required: true }), label); consent.value = 'true';
  let token = null, answer = null, image = null, policy = null;
  if (routeId === 'fastpeoplesearch') {
    token = add(new Input({ name: 'cf-turnstile-response', type: 'hidden' })); token.value = 'site-issued-response';
    add(new Element('div', { className: 'cf-turnstile' }));
    for (const name of ['agentFirstname', 'agentLastname', 'agentEmail']) add(new Input({ id: name, name, hidden: true }));
    add(new Input({ id: 'middlename', name: 'middlename' }));
  } else {
    consent.labels = [label]; policy = new Element('a', { href: Automatic.CONTRACTS[routeId].policyUrl, textContent: 'Kişisel Verilerin Korunması Kanunu' }); label.append(policy);
    answer = add(new Input({ id: 'form_ResimKodu', name: 'form.ResimKodu', required: true, maxLength: 5 }));
    image = new Element('img', { id: 'captcha_imgContactResimKodu', src: 'https://www.numaraara.com/captcha?pid=426169674&transparent=1', currentSrc: 'https://www.numaraara.com/captcha?pid=426169674&transparent=1', naturalWidth: 130, naturalHeight: 40, complete: true, data: PNG }); form.append(image);
    for (const name of ['form.FormId', '__RequestVerificationToken', 'form.Kvkk']) add(new Input({ name, type: 'hidden' }));
    add(new Input({ id: 'form_Telefon', name: 'form.Telefon' }));
  }
  const button = add(new Element('button', { type: 'submit', textContent: routeId === 'fastpeoplesearch' ? 'Submit' : 'Talebi Gönder' }));
  button.click = () => {
    clicks++; button.onClick?.(); if (button.noEvent) return;
    if (!form.checkValidity()) return;
    const event = { type: 'submit', target: form, submitter: button, isTrusted: button.untrusted !== true, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
    for (const entry of [...listeners].sort((a, b) => Number(b.capture) - Number(a.capture))) { entry.listener(event); if (event.stopped) break; }
    if (!event.defaultPrevented) nativeSubmissions++;
  };
  const env = { location: { href: route.url }, HTMLInputElement: Input, HTMLTextAreaElement: Textarea, Event: class { constructor(type) { this.type = type; } },
    crypto: { randomUUID: () => 'b'.repeat(32) }, getComputedStyle: element => element.style,
    document: { activeElement: body, body, querySelector: selector => query(selector)[0] || null, querySelectorAll: query,
      createElement(tag) { assert.equal(tag, 'canvas'); let drawn; return { width: 0, height: 0, getContext: () => ({ drawImage: img => { drawn = img; } }), toDataURL: () => 'data:image/png;base64,' + drawn.data }; } } };
  const payload = { routeId, operationId: 'a'.repeat(32), fields, authorized: true, autoSubmit: true, consentId: Automatic.CONTRACTS[routeId].id, ...(routeId === 'tr-numaraara' ? { ownRequestConfirmed: true } : {}) };
  return { env, payload, form, button, controls, selection, label, consent, token, answer, image, policy, add, all, body, events, normal, clicks: () => clicks, sent: () => nativeSubmissions };
}

test('automatic contracts are frozen, narrowly scoped and distinguish initiation from request submission', () => {
  assert.equal(Object.isFrozen(Automatic.CONTRACTS), true);
  assert.deepEqual(Object.keys(Automatic.CONTRACTS), ['fastpeoplesearch', 'tr-numaraara']);
  for (const contract of Object.values(Automatic.CONTRACTS)) assert.equal(Object.isFrozen(contract), true);
  assert.equal(Automatic.CONTRACTS.fastpeoplesearch.stage, 'verification_initiation');
  assert.equal(Automatic.CONTRACTS['tr-numaraara'].stage, 'request_submission');
});

test('FPS requires the real broker response and never creates or alters a challenge token', () => {
  const p = page(); p.token.value = '';
  const result = Automatic.capture(p.payload, p.env);
  assert.equal(result.status, 'blocked'); assert.equal(result.reason, 'challenge_required');
  assert.equal(p.token.value, ''); assert.equal(p.consent.checked, false); assert.equal(p.clicks(), 0);
  p.token.value = 'site-issued-response'; assert.equal(Automatic.capture(p.payload, p.env).status, 'ready');
});

test('FPS submits exactly once after safe native submission and keeps acceptance unverified', () => {
  const p = page(); assert.equal(Automatic.capture(p.payload, p.env).status, 'ready');
  const result = Automatic.submit(p.payload, p.env);
  assert.equal(result.status, 'submission_attempted'); assert.equal(result.attempt_verified, true);
  assert.equal(result.stage, 'verification_initiation'); assert.equal(p.sent(), 1); assert.equal(p.clicks(), 1);
  assert.equal(p.consent.checked, true); assert.deepEqual(p.events, [['legal', 'input'], ['legal', 'change']]);
  assert.notEqual(Automatic.submit(p.payload, p.env).status, 'submission_attempted'); assert.equal(p.clicks(), 1);
  assert.notEqual(Automatic.capture(p.payload, p.env).status, 'ready');
});

test('automatic submission rejects missing authorization, stale consent id and unsupported routes', () => {
  for (const change of [{ autoSubmit: false }, { authorized: false }, { consentId: 'old' }, { routeId: 'usphonebook' }, { operationId: 'bad' }]) {
    const p = page(); assert.equal(Automatic.capture({ ...p.payload, ...change }, p.env).status, 'blocked'); assert.equal(p.sent(), 0);
  }
});

test('changed consent, purpose, submit control, required fields and old alerts block capture', () => {
  const mutations = [p => { p.label.textContent += ' Extra agreement.'; }, p => { p.form.action = 'https://evil.example/collect'; },
    p => { p.form.method = 'get'; }, p => { p.selection.value = 'agent'; }, p => { p.button.textContent = 'Export'; },
    p => { p.controls.email.value = 'changed@example.test'; }, p => { p.controls.email.readOnly = true; },
    p => { p.add(Object.assign(new p.env.HTMLInputElement({ name: 'date_of_birth', required: true }), { value: '2000-01-01' })); },
    p => { p.add(new p.env.HTMLInputElement({ name: 'new-terms', type: 'checkbox', required: true })); },
    p => { p.add(new p.env.HTMLInputElement({ name: 'identity', type: 'file' })); },
    p => { p.all.push({ tagName: 'DIV', role: 'alert', textContent: 'Old success', getClientRects: () => [{}], style: { display: 'block', visibility: 'visible', opacity: '1' } }); }];
  for (const mutate of mutations) { const p = page(); mutate(p); assert.equal(Automatic.capture(p.payload, p.env).status, 'blocked'); assert.equal(p.sent(), 0); assert.equal(p.clicks(), 0); }
});

test('unapproved populated optional or agent fields cannot hitchhike on an automatic request', () => {
  const p = page(); p.all.find(e => e.name === 'agentEmail').value = 'unapproved@example.test';
  assert.equal(Automatic.capture(p.payload, p.env).status, 'blocked'); assert.equal(p.sent(), 0);
});

test('a changed field or challenge after capture stops before consent or click', () => {
  for (const mutate of [p => { p.controls.email.value = 'changed@example.test'; }, p => { p.token.value = ''; }, p => { p.token.value = 'different-token'; }, p => { p.form.action += '?export=true'; }]) {
    const p = page(); assert.equal(Automatic.capture(p.payload, p.env).status, 'ready'); mutate(p);
    assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked'); assert.equal(p.consent.checked, false); assert.equal(p.clicks(), 0);
  }
});

test('changing both the payload and current fields cannot reuse the old captured authorization', () => {
  const p = page(); Automatic.capture(p.payload, p.env);
  p.payload.fields.email = 'changed@example.test'; p.controls.email.value = p.payload.fields.email;
  assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked'); assert.equal(p.consent.checked, false); assert.equal(p.clicks(), 0);
});

test('duplicate reviewed controls and extra form-associated submitters are rejected', () => {
  const duplicated = page(); duplicated.add(new duplicated.env.HTMLInputElement({ id: 'firstname', name: 'firstname' }));
  assert.equal(Automatic.capture(duplicated.payload, duplicated.env).status, 'blocked');
  const associated = page(), other = new associated.env.HTMLInputElement({ name: 'other-submit', type: 'submit' });
  other.form = associated.form; associated.body.append(other);
  assert.equal(Automatic.capture(associated.payload, associated.env).status, 'blocked'); assert.equal(associated.clicks(), 0);
});

test('input and change handlers are honored and unsafe drift cancels submission', () => {
  for (const eventType of ['input', 'change']) {
    const p = page(); Automatic.capture(p.payload, p.env);
    p.consent.onEvent = event => { if (event.type === eventType) p.form.action = 'https://evil.example/collect'; };
    assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked'); assert.equal(p.clicks(), 0); assert.equal(p.sent(), 0);
  }
});

test('replacing a captured control with equal values during an agreement event is still drift', () => {
  const p = page(); Automatic.capture(p.payload, p.env);
  p.consent.onEvent = () => {
    p.controls.email.id = 'old-email';
    const replacement = new p.env.HTMLInputElement({ id: 'email', name: 'email', type: 'email', required: true });
    replacement.value = p.payload.fields.email; p.add(replacement);
  };
  assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked'); assert.equal(p.clicks(), 0);
});

test('drift at the native submit event is prevented and never replayed', () => {
  const p = page(); Automatic.capture(p.payload, p.env); p.button.onClick = () => { p.controls.email.value = 'changed@example.test'; };
  assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked'); assert.equal(p.clicks(), 1); assert.equal(p.sent(), 0);
  Automatic.submit(p.payload, p.env); assert.equal(p.clicks(), 1);
});

test('missing or untrusted submit events stay unknown with no repeat', () => {
  for (const mode of ['noEvent', 'untrusted']) {
    const p = page(); Automatic.capture(p.payload, p.env); p.button[mode] = true;
    assert.notEqual(Automatic.submit(p.payload, p.env).status, 'submission_attempted'); assert.equal(p.sent(), 0);
    Automatic.submit(p.payload, p.env); assert.equal(p.clicks(), 1);
  }
});

test('an exception at the click boundary stays unknown and cannot trigger another click', () => {
  const p = page(); Automatic.capture(p.payload, p.env); p.button.onClick = () => { throw new Error('Interrupted page'); };
  assert.equal(Automatic.submit(p.payload, p.env).status, 'unknown');
  Automatic.submit(p.payload, p.env); assert.equal(p.clicks(), 1);
});

test('NumaraAra captures only the reviewed bounded PNG and returns no profile or source URL', () => {
  const p = page('tr-numaraara'), result = Automatic.capture(p.payload, p.env);
  assert.equal(result.status, 'image'); assert.equal(result.media, PNG); assert.equal(result.alphabet, ''); assert.match(result.challengeRef, /^[a-f0-9]{32}$/);
  assert.equal(JSON.stringify(result).includes('@'), false); assert.equal(JSON.stringify(result).includes('/captcha'), false);
  assert.equal(p.answer.value, ''); assert.equal(p.consent.checked, false); assert.equal(p.clicks(), 0);
});

test('captured image references cannot be submitted in another document', () => {
  const first = page('tr-numaraara'), captured = Automatic.capture(first.payload, first.env), other = page('tr-numaraara');
  assert.equal(Automatic.submit({ ...other.payload, challengeRef: captured.challengeRef, answer: 'A1b2C' }, other.env).status, 'blocked');
  assert.equal(other.clicks(), 0); assert.equal(other.answer.value, '');
});

test('NumaraAra requires its exact checkbox, privacy link, same-origin image and dimensions', () => {
  for (const mutate of [p => { p.policy.href = 'https://evil.example/privacy'; }, p => { p.consent.type = 'hidden'; },
    p => { p.label.textContent += 'Gizlilik Sağla'; }, p => { p.image.src = 'https://evil.example/captcha'; p.image.currentSrc = p.image.src; },
    p => { p.image.naturalWidth = 131; }, p => { p.answer.maxLength = 6; }, p => { p.image.data = 'A'.repeat(800000); },
    p => { p.image.src += '&pid=2'; p.image.currentSrc = p.image.src; }, p => { p.image.data = PNG.replace('iVBORw0KGgo', 'AAAAAAAAAAA'); }]) {
    const p = page('tr-numaraara'); mutate(p); assert.equal(Automatic.capture(p.payload, p.env).status, 'blocked'); assert.equal(p.sent(), 0);
  }
});

test('NumaraAra submits an exact five-character answer through native events once', () => {
  const p = page('tr-numaraara'), captured = Automatic.capture(p.payload, p.env);
  const result = Automatic.submit({ ...p.payload, challengeRef: captured.challengeRef, answer: 'A1b2C' }, p.env);
  assert.equal(result.status, 'submission_attempted'); assert.equal(result.attempt_verified, true); assert.equal(result.stage, 'request_submission');
  assert.equal(p.answer.value, 'A1b2C'); assert.equal(p.sent(), 1);
  assert.deepEqual(p.events, [['form_Kvkk', 'input'], ['form_Kvkk', 'change'], ['form_ResimKodu', 'input'], ['form_ResimKodu', 'change']]);
  Automatic.submit({ ...p.payload, challengeRef: captured.challengeRef, answer: 'A1b2C' }, p.env); assert.equal(p.clicks(), 1);
});

test('changed challenge pixels, source, form or answer rejects the original recognition', () => {
  for (const mutate of [p => { p.image.data = PNG.replace('AAAADU', 'AAAADQ'); }, p => { p.image.currentSrc += '&changed=1'; },
    p => { p.form.action += '?unexpected=1'; }, p => { p.answer.value = 'other'; }]) {
    const p = page('tr-numaraara'), captured = Automatic.capture(p.payload, p.env); mutate(p);
    assert.equal(Automatic.submit({ ...p.payload, challengeRef: captured.challengeRef, answer: 'A1b2C' }, p.env).status, 'blocked'); assert.equal(p.sent(), 0); assert.equal(p.consent.checked, false);
  }
  for (const answer of ['abcd', 'abcdef', 'a bcd', 'abc$5', 'é1234']) {
    const p = page('tr-numaraara'), captured = Automatic.capture(p.payload, p.env);
    assert.equal(Automatic.submit({ ...p.payload, challengeRef: captured.challengeRef, answer }, p.env).status, 'blocked'); assert.equal(p.clicks(), 0);
  }
});

test('NumaraAra rechecks image and fields after every native answer event', () => {
  const p = page('tr-numaraara'), captured = Automatic.capture(p.payload, p.env);
  p.answer.onEvent = () => { p.image.data = PNG.replace('AAAADU', 'AAAADQ'); };
  assert.equal(Automatic.submit({ ...p.payload, challengeRef: captured.challengeRef, answer: 'A1b2C' }, p.env).status, 'blocked'); assert.equal(p.sent(), 0);
});

test('an unsafe native submit is canceled even after valid challenge recognition', () => {
  const p = page('tr-numaraara'), captured = Automatic.capture(p.payload, p.env);
  p.button.onClick = () => { p.policy.href = 'https://evil.example/terms'; };
  assert.equal(Automatic.submit({ ...p.payload, challengeRef: captured.challengeRef, answer: 'A1b2C' }, p.env).status, 'blocked'); assert.equal(p.sent(), 0); assert.equal(p.clicks(), 1);
});

test('new module injection in the same document preserves the one-shot journal', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../extension/automatic-executor.js'), 'utf8');
  const p = page(), context = { ...p.env, EraseBrokerExecutor: Base, URL, Map, WeakMap, Object, JSON, Set };
  vm.runInNewContext(source, context); const first = context.EraseAutomaticExecutor;
  assert.equal(first.capture(p.payload, context).status, 'ready'); assert.equal(first.submit(p.payload, context).status, 'submission_attempted');
  vm.runInNewContext(source, context); assert.equal(context.EraseAutomaticExecutor, first);
  context.EraseAutomaticExecutor.submit(p.payload, context); assert.equal(p.clicks(), 1);
});
