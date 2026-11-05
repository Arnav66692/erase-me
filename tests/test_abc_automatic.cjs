'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Automatic = require('../extension/automatic-executor.js');

function page() {
  const routeId = 'advancedbackgroundchecks', events = [], listeners = [], all = new Map();
  let clicks = 0, submits = 0;
  function element(tag, props = {}) {
    return { tagName: tag.toUpperCase(), name: '', value: '', type: '', required: false, disabled: false, readOnly: false, multiple: false,
      parentElement: null, style: { display: 'block', visibility: 'visible', opacity: '1' }, attributes: new Map(),
      hasAttribute(name) { return this.attributes.has(name.toLowerCase()); }, setAttribute(name, value) { this.attributes.set(name.toLowerCase(), String(value)); },
      getClientRects() { return this.hidden ? [] : [{}]; }, focus() { this.onFocus?.(); },
      dispatchEvent(event) { events.push(event.type); this.onEvent?.(event); }, ...props };
  }
  const form = element('form', { action: 'https://www.advancedbackgroundchecks.com/opt-out', method: 'get', target: '', noValidate: true, enctype: 'application/x-www-form-urlencoded',
    addEventListener(type, callback) { if (type === 'submit') listeners.push(callback); },
    removeEventListener(type, callback) { const index = listeners.indexOf(callback); if (index >= 0) listeners.splice(index, 1); },
    checkValidity() { this.onValidate?.(); return this.valid !== false && form.elements.every(control => !control.required || !!control.value); }
  });
  const register = (selector, value) => { all.set(selector, [value]); return value; };
  const add = props => element('input', { form, type: 'text', value: '', ...props });
  const fields = { first_name: 'Example', last_name: 'Person', email: 'person@example.test' };
  const first = register('#sfn', add({ id: 'sfn', required: true, value: fields.first_name }));
  const last = register('#sln', add({ id: 'sln', required: true, value: fields.last_name }));
  const email = register('#semail', add({ id: 'semail', type: 'email', required: true, value: fields.email }));
  const selection = register('select#mode', element('select', { id: 'mode', form, value: 'subject', options: [{ value: 'subject' }, { value: 'agent' }] }));
  const middle = register('input#smn', add({ id: 'smn' }));
  const honeypot = register('input[name="company"]', add({ name: 'company', style: { display: 'block', visibility: 'visible', opacity: '0' } }));
  const links = [
    'https://www.advancedbackgroundchecks.com/terms', 'https://www.advancedbackgroundchecks.com/notice-at-collection',
    'https://www.advancedbackgroundchecks.com/privacy', 'https://policies.google.com/privacy', 'https://policies.google.com/terms'
  ].map(href => element('a', { href }));
  const paragraphs = [
    'By clicking submit, I authorize AdvancedBackgroundChecks to send communications relating to my privacy request to the email address(es) provided. I understand that information provided relating to this request will not be used for any purpose other than the processing of this request.',
    'By using our site and services, you agree to our Terms of Use. Visit our Notice at Collection and Privacy Notice for information about our privacy practices.',
    'This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.'
  ].map((textContent, index) => element('p', { textContent, links: index === 0 ? [] : index === 1 ? links.slice(0, 3) : links.slice(3), querySelectorAll() { return this.links; } }));
  const challengeResponse = register('textarea[name="g-recaptcha-response"]', element('textarea', { form: null, name: 'g-recaptcha-response', hidden: true }));
  Object.defineProperty(challengeResponse, 'value', { get() { throw new Error('A challenge token must not be read.'); }, set() { throw new Error('A challenge token must not be written.'); } });
  const challengeScript = register('script[src]', element('script', { src: 'https://www.google.com/recaptcha/api.js?render=6LdYzessAAAAACnQqZugXee4rNpMsD-6X1paSkS8' }));
  const button = element('button', { type: 'submit', textContent: 'Submit', form, formNoValidate: false,
    click() {
      clicks++; button.onClick?.(); if (button.noEvent) return;
      const event = { target: form, submitter: button, isTrusted: button.untrusted !== true, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
      for (const callback of [...listeners]) { callback(event); if (event.stopped) break; }
      if (!event.defaultPrevented) submits++;
    }
  });
  const extras = [], alerts = [], files = [];
  Object.defineProperty(form, 'elements', { get() { return [first, last, email, selection, middle, honeypot, button, ...extras]; } });
  form.querySelectorAll = selector => selector === 'p' ? paragraphs : selector === 'a' ? links : selector === 'button[type="submit"],input[type="submit"]' ? [button] : [];
  const document = { querySelectorAll(selector) {
    if (selector === '[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors') return alerts;
    if (selector === 'input[type="file"]') return files;
    return all.get(selector) || [];
  }, querySelector(selector) { return this.querySelectorAll(selector)[0] || null; } };
  const env = { document, location: { href: form.action }, getComputedStyle: value => value.style };
  const payload = { routeId, operationId: 'a'.repeat(32), authorized: true, autoSubmit: true,
    ownRequestConfirmed: true, consentId: Automatic.CONTRACTS[routeId].id, fields };
  return { env, payload, form, first, last, email, selection, middle, honeypot, paragraphs, links, challengeResponse, challengeScript, button,
    extras, alerts, files, all, events, clicks: () => clicks, sent: () => submits };
}

test('ABC initial contract discloses exact terms and submits once without reading or writing a challenge token', () => {
  const p = page(), contract = Automatic.CONTRACTS.advancedbackgroundchecks;
  assert.equal(contract.stage, 'verification_initiation'); assert.equal(contract.policyUrls.length, 5);
  assert.equal(contract.consentText, p.paragraphs.map(paragraph => paragraph.textContent).join(' '));
  assert.equal(Automatic.capture(p.payload, p.env).status, 'ready'); assert.equal(p.clicks(), 0); assert.deepEqual(p.events, []);
  const result = Automatic.submit(p.payload, p.env);
  assert.equal(result.status, 'submission_attempted'); assert.equal(result.attempt_verified, true); assert.equal(result.stage, 'verification_initiation');
  assert.equal(p.clicks(), 1); assert.equal(p.sent(), 1); assert.equal(p.form.noValidate, true); assert.equal(p.button.formNoValidate, false); assert.deepEqual(p.events, []);
  for (const secret of Object.values(p.payload.fields)) assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(Automatic.submit(p.payload, p.env).reason, 'already_started'); assert.equal(Automatic.capture(p.payload, p.env).reason, 'already_captured'); assert.equal(p.clicks(), 1);
});

test('ABC requires its exact self-request authorization and unchanged initial form contract before capturing', () => {
  const changes = [
    p => { p.payload.ownRequestConfirmed = false; }, p => { p.payload.authorized = false; }, p => { p.payload.autoSubmit = false; },
    p => { p.payload.consentId = 'stale'; }, p => { p.payload.fields.additional = 'unapproved'; }, p => { p.form.method = 'post'; },
    p => { p.form.action += '?other=1'; }, p => { p.form.action = 'https://evil.example/collect'; }, p => { p.env.location.href += '?other=1'; },
    p => { p.form.noValidate = false; }, p => { p.form.target = '_blank'; }, p => { p.button.formNoValidate = true; },
    p => { p.form.enctype = 'multipart/form-data'; }, p => { p.button.name = 'unapproved'; }, p => { p.button.value = 'unapproved'; },
    p => { p.first.name = 'first_name'; }, p => { p.first.required = false; }, p => { p.email.type = 'text'; }, p => { p.last.disabled = true; },
    p => { p.first.value = 'Different'; }, p => { p.selection.value = 'agent'; }, p => { p.selection.name = 'requester'; }, p => { p.selection.multiple = true; },
    p => { p.middle.value = 'Not approved'; }, p => { p.honeypot.value = 'Not approved'; }, p => { p.honeypot.style.opacity = '1'; },
    p => { p.extras.push({ type: 'checkbox', value: '', required: false }); }, p => { p.extras.push({ type: 'hidden', value: '', required: false }); },
    p => { p.paragraphs[0].textContent += ' Extra permission'; }, p => { p.paragraphs[1].hidden = true; },
    p => { p.links[0].href = 'https://evil.example/terms'; }, p => { p.links.push(p.links[0]); }, p => { p.button.textContent = 'Export'; },
    p => { p.challengeResponse.form = p.form; }, p => { p.challengeResponse.required = true; }, p => { p.challengeResponse.hidden = false; },
    p => { p.challengeScript.src = 'https://evil.example/recaptcha/api.js'; }, p => { p.all.set('script[src]', [p.challengeScript, p.challengeScript]); },
    p => { p.alerts.push({ getClientRects: () => [{}], style: {} }); }, p => { p.files.push({ type: 'file' }); },
    p => { p.all.set('#sfn', [p.first, p.first]); }
  ];
  for (const change of changes) {
    const p = page(); change(p); const result = Automatic.capture(p.payload, p.env);
    assert.equal(result.status, 'blocked', change.toString()); assert.equal(p.clicks(), 0); assert.equal(p.sent(), 0); assert.deepEqual(p.events, []);
  }
});

test('ABC rechecks captured identity, terms, purpose, validation and original document controls before the one click', () => {
  for (const change of [
    p => { p.email.value = 'different@example.test'; }, p => { p.selection.value = 'agent'; }, p => { p.selection.multiple = true; }, p => { p.form.noValidate = false; },
    p => { p.form.enctype = 'multipart/form-data'; }, p => { p.button.name = 'unapproved'; }, p => { p.button.value = 'unapproved'; },
    p => { p.paragraphs[1].textContent += ' Changed'; }, p => { p.links[2].href += '?other=1'; }, p => { p.challengeResponse.disabled = true; },
    p => { p.payload.fields.email = 'different@example.test'; p.email.value = p.payload.fields.email; },
    p => { p.paragraphs[0] = { ...p.paragraphs[0] }; }, p => { p.all.set('input#smn', [{ ...p.middle }]); },
    p => { p.all.set('script[src]', [{ ...p.challengeScript }]); }, p => { p.links[0] = { ...p.links[0] }; },
    p => { p.form.valid = false; }, p => { p.form.onValidate = () => { p.first.value = 'Changed during validation'; }; },
    p => { p.button.onFocus = () => { p.selection.value = 'agent'; }; }
  ]) {
    const p = page(); assert.equal(Automatic.capture(p.payload, p.env).status, 'ready'); change(p);
    assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked', change.toString()); assert.equal(p.clicks(), 0); assert.equal(p.sent(), 0);
    assert.equal(Automatic.submit(p.payload, p.env).reason, 'already_started');
  }
});

test('ABC checked native event remains an attempt and an unsafe or interrupted event can never become accepted or repeated', () => {
  const untrusted = page(); Automatic.capture(untrusted.payload, untrusted.env); untrusted.button.untrusted = true;
  assert.equal(Automatic.submit(untrusted.payload, untrusted.env).reason, 'unsafe_submit_event'); assert.equal(untrusted.sent(), 0);
  const drift = page(); Automatic.capture(drift.payload, drift.env); drift.button.onClick = () => { drift.email.value = 'changed@example.test'; };
  assert.equal(Automatic.submit(drift.payload, drift.env).reason, 'unsafe_submit_event'); assert.equal(drift.sent(), 0);
  const missing = page(); Automatic.capture(missing.payload, missing.env); missing.button.noEvent = true;
  assert.equal(Automatic.submit(missing.payload, missing.env).status, 'unknown'); assert.equal(missing.sent(), 0); assert.equal(missing.clicks(), 1);
  assert.equal(Automatic.submit(missing.payload, missing.env).reason, 'already_started'); assert.equal(missing.clicks(), 1);
});

test('ABC rejects all native submitter overrides at capture, validation, focus and native submit boundaries', () => {
  assert.equal(Automatic.CONTRACTS.advancedbackgroundchecks.requiredCapability, 'reviewed-initial-submit-v2');
  for (const attribute of ['formaction', 'formmethod', 'formtarget', 'formenctype', 'formnovalidate']) {
    for (const value of ['', 'false', 'https://evil.example/collect']) {
      const p = page(); p.button.setAttribute(attribute, value);
      assert.equal(Automatic.capture(p.payload, p.env).reason, 'changed_submit'); assert.equal(p.clicks(), 0);
    }
    for (const phase of ['before_submit', 'validity', 'focus', 'click']) {
      const p = page(); assert.equal(Automatic.capture(p.payload, p.env).status, 'ready');
      const insert = () => p.button.setAttribute(attribute, 'https://evil.example/collect');
      if (phase === 'before_submit') insert(); if (phase === 'validity') p.form.onValidate = insert;
      if (phase === 'focus') p.button.onFocus = insert; if (phase === 'click') p.button.onClick = insert;
      assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked', attribute + ':' + phase);
      assert.equal(p.sent(), 0); assert.equal(p.clicks(), phase === 'click' ? 1 : 0);
      assert.equal(Automatic.submit(p.payload, p.env).reason, 'already_started');
    }
  }
  for (const mutate of [p => { p.form.enctype = 'multipart/form-data'; }, p => { p.button.name = 'unapproved'; }, p => { p.button.value = 'unapproved'; }, p => { p.selection.multiple = true; }]) {
    for (const phase of ['validity', 'focus', 'click']) {
      const p = page(); assert.equal(Automatic.capture(p.payload, p.env).status, 'ready'); const insert = () => mutate(p);
      if (phase === 'validity') p.form.onValidate = insert; if (phase === 'focus') p.button.onFocus = insert; if (phase === 'click') p.button.onClick = insert;
      assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked'); assert.equal(p.sent(), 0); assert.equal(p.clicks(), phase === 'click' ? 1 : 0);
    }
  }
});
