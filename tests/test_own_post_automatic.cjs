'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Base = require('../extension/broker-executor.js');
const Automatic = require('../extension/automatic-executor.js');

function page(routeId) {
  const noSorgulama = routeId === 'tr-nosorgulama', route = Base.ROUTES[routeId], selectors = new Map();
  let clicks = 0, sent = 0;
  const listeners = [], alerts = [], files = [], challenges = [], extras = [], events = [];
  const element = (tag, props = {}) => ({ tagName: tag.toUpperCase(), type: '', name: '', value: '', required: false, disabled: false, readOnly: false, multiple: false,
    style: { display: 'block', visibility: 'visible', opacity: '1' }, parentElement: null, attributes: new Map(),
    hasAttribute(name) { return this.attributes.has(name.toLowerCase()); }, setAttribute(name, value) { this.attributes.set(name.toLowerCase(), String(value)); },
    getClientRects() { return this.hidden ? [] : [{}]; }, focus() { this.onFocus?.(); },
    dispatchEvent(event) { events.push(event.type); this.onEvent?.(event); }, ...props });
  const register = (selector, value) => { selectors.set(selector, [value]); return value; };
  const form = element('form', { method: 'post', action: route.url, target: '', noValidate: false, enctype: 'application/x-www-form-urlencoded',
    querySelectorAll(selector) {
      if (selector === (noSorgulama ? 'p.ic-tos' : 'p.muted.small')) return [notice];
      if (selector === 'a') return links;
      if (selector === 'button[type="submit"],input[type="submit"]') return [button];
      return [];
    }, querySelector(selector) { return selector === 'iframe,img,canvas' ? challenges[0] || null : null; },
    addEventListener(type, callback) { if (type === 'submit') listeners.push(callback); },
    removeEventListener(type, callback) { const index = listeners.indexOf(callback); if (index >= 0) listeners.splice(index, 1); },
    checkValidity() { this.onValidate?.(); return this.valid !== false && form.elements.every(control => !control.required || !!control.value); }
  });
  const fields = { full_name: 'Example Person', email: 'person@example.test', ...(noSorgulama ? {} : { phone: '+1 212 555 0100' }), request_text: 'Please remove my own information from this directory.' };
  const controls = {};
  for (const [key, value] of Object.entries(fields)) {
    const selector = route[key], name = selector.match(/\[name="([^"]+)"\]/)?.[1] || '';
    controls[key] = register(selector, element(key === 'request_text' ? 'textarea' : 'input', { form, name, required: true,
      type: key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text', value }));
  }
  const selection = register(route.selection.selector, element('select', { form, required: true, value: route.selection.value, options: [{ value: route.selection.value }] }));
  const optionalSpecs = noSorgulama ? [['input#ic-tel[name="telefon"]', 'tel'], ['input#ic-ilgili[name="ilgili_numara"]', 'text'], ['input[name="website_url"]', 'text']] :
    [['input#phone[name="phone"]', 'tel'], ['input[name="website"]', 'text']];
  const optionals = optionalSpecs.map(([selector, type]) => register(selector, element('input', { form, type })));
  const csrf = register('input[name="_csrf"]', element('input', { form, type: 'hidden', value: 'c'.repeat(64) }));
  const links = (noSorgulama ? ['https://www.nosorgulama.com.tr/kvkk', 'https://www.nosorgulama.com.tr/gizlilik'] : []).map(href => element('a', { href }));
  const notice = element('p', { textContent: noSorgulama ? "Gönderim ile KVKK ve Gizlilik Politikası'nı kabul etmiş olursunuz." : 'Talebiniz değerlendirilirken numaranın size ait olduğunu doğrulayan ek belge isteyebiliriz.',
    querySelectorAll() { return links; } });
  const button = element('button', { form, type: 'submit', formNoValidate: false, textContent: noSorgulama ? 'Mesajı Gönder' : 'Talebi Gönder',
    click() {
      clicks++; button.onClick?.(); if (button.noEvent || !form.checkValidity()) return;
      const event = { target: form, submitter: button, isTrusted: !button.untrusted, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
      for (const callback of [...listeners]) { callback(event); if (event.stopped) break; }
      if (!event.defaultPrevented) sent++;
    }
  });
  Object.defineProperty(form, 'elements', { get() { return [...Object.values(controls), selection, ...optionals, csrf, button, ...extras]; } });
  const document = { querySelectorAll(selector) {
    if (selector === '[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors') return alerts;
    if (selector === 'input[type="file"]') return files;
    if (selector === '.cf-turnstile,.g-recaptcha,.h-captcha,iframe[src*="recaptcha"],iframe[src*="hcaptcha"]') return challenges;
    return selectors.get(selector) || [];
  }, querySelector(selector) { return this.querySelectorAll(selector)[0] || null; } };
  const env = { document, location: { href: route.url }, getComputedStyle: value => value.style };
  const payload = { routeId, operationId: 'a'.repeat(32), fields, authorized: true, ownRequestConfirmed: true, autoSubmit: true, consentId: Automatic.CONTRACTS[routeId].id };
  return { routeId, payload, env, selectors, form, controls, selection, optionals, csrf, notice, links, button, alerts, files, challenges, extras, events,
    clicks: () => clicks, sent: () => sent };
}

for (const routeId of ['tr-nosorgulama', 'tr-numarasor']) {
  test(routeId + ' submits only its explicitly approved self-request once and returns no identity or CSRF values', () => {
    const p = page(routeId), csrf = p.csrf.value;
    assert.equal(Automatic.CONTRACTS[routeId].consentText, p.notice.textContent);
    assert.equal(Automatic.capture(p.payload, p.env).status, 'ready'); assert.equal(p.clicks(), 0); assert.deepEqual(p.events, []);
    const result = Automatic.submit(p.payload, p.env);
    assert.equal(result.status, 'submission_attempted'); assert.equal(result.attempt_verified, true); assert.equal(result.stage, 'request_submission');
    assert.equal(p.sent(), 1); assert.equal(p.clicks(), 1); assert.equal(p.form.noValidate, false); assert.equal(p.button.formNoValidate, false);
    assert.equal(p.csrf.value, csrf); assert.equal(p.optionals.every(control => control.value === ''), true); assert.deepEqual(p.events, []);
    for (const value of [...Object.values(p.payload.fields), csrf]) assert.equal(JSON.stringify(result).includes(value), false);
    assert.equal(Automatic.submit(p.payload, p.env).reason, 'already_started'); assert.equal(Automatic.capture(p.payload, p.env).reason, 'already_captured'); assert.equal(p.clicks(), 1);
  });

  test(routeId + ' rejects missing authorization, expanded fields, changed terms, new challenges and validation bypass', () => {
    const changes = [
      p => { p.payload.ownRequestConfirmed = false; }, p => { p.payload.authorized = false; }, p => { p.payload.consentId = 'stale'; },
      p => { p.payload.fields.extra = 'not approved'; }, p => { p.controls.full_name.value = 'Changed'; }, p => { p.controls.email.type = 'text'; },
      p => { p.controls.request_text.required = false; }, p => { p.selection.value = 'agent'; }, p => { p.selection.required = false; }, p => { p.selection.multiple = true; },
      p => { p.form.action += '?changed=1'; }, p => { p.form.method = 'get'; }, p => { p.form.noValidate = true; },
      p => { p.form.enctype = 'multipart/form-data'; }, p => { p.form.target = '_blank'; }, p => { p.button.name = 'unapproved'; }, p => { p.button.value = 'unapproved'; },
      p => { p.button.formNoValidate = true; }, p => { p.button.textContent = 'Export'; }, p => { p.optionals[0].value = 'not approved'; },
      p => { p.optionals[0].required = true; }, p => { p.csrf.value = ''; }, p => { p.csrf.value = 'c'.repeat(63) + '\n'; }, p => { p.csrf.type = 'text'; },
      p => { p.notice.textContent += ' More consent'; }, p => { p.notice.hidden = true; }, p => { p.links.push({ href: 'https://evil.example/terms' }); },
      p => { p.files.push({ type: 'file' }); }, p => { p.challenges.push({}); }, p => { p.extras.push({ type: 'hidden', value: '' }); },
      p => { p.alerts.push({ getClientRects: () => [{}], style: {} }); }, p => { p.env.location.href += '?changed=1'; }
    ];
    if (routeId === 'tr-nosorgulama') changes.push(p => { p.links[0].href = 'https://evil.example/terms'; });
    for (const change of changes) {
      const p = page(routeId); change(p);
      assert.equal(Automatic.capture(p.payload, p.env).status, 'blocked', change.toString()); assert.equal(p.clicks(), 0); assert.equal(p.sent(), 0);
    }
  });

  test(routeId + ' revalidates fields, exact notice and anti-forgery controls before click and at trusted submit', () => {
    const changes = [
      p => { p.csrf.value = 'd'.repeat(64); }, p => { p.controls.email.value = 'changed@example.test'; }, p => { p.selection.value = 'agent'; }, p => { p.selection.multiple = true; },
      p => { p.optionals[0].value = 'not approved'; }, p => { p.form.noValidate = true; }, p => { p.form.valid = false; },
      p => { p.form.enctype = 'multipart/form-data'; }, p => { p.button.name = 'unapproved'; }, p => { p.button.value = 'unapproved'; },
      p => { p.notice.textContent += ' Changed'; }, p => { p.button.onFocus = () => { p.csrf.value = 'd'.repeat(64); }; },
      p => { p.form.onValidate = () => { p.controls.email.value = 'changed@example.test'; }; },
      p => { p.selectors.set('input[name="_csrf"]', [{ ...p.csrf }]); }
    ];
    for (const change of changes) {
      const p = page(routeId); assert.equal(Automatic.capture(p.payload, p.env).status, 'ready'); change(p);
      assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked', change.toString()); assert.equal(p.clicks(), 0); assert.equal(p.sent(), 0);
      assert.equal(Automatic.submit(p.payload, p.env).reason, 'already_started');
    }
    const drift = page(routeId); Automatic.capture(drift.payload, drift.env); drift.button.onClick = () => { drift.controls.email.value = 'changed@example.test'; };
    assert.equal(Automatic.submit(drift.payload, drift.env).reason, 'unsafe_submit_event'); assert.equal(drift.sent(), 0); assert.equal(drift.clicks(), 1);
    const noEvent = page(routeId); Automatic.capture(noEvent.payload, noEvent.env); noEvent.button.noEvent = true;
    assert.equal(Automatic.submit(noEvent.payload, noEvent.env).status, 'unknown'); assert.equal(noEvent.sent(), 0); assert.equal(noEvent.clicks(), 1);
    assert.equal(Automatic.submit(noEvent.payload, noEvent.env).reason, 'already_started');
  });
  test(routeId + ' rejects every native submitter override before capture and throughout its one-shot action', () => {
    assert.equal(Automatic.CONTRACTS[routeId].requiredCapability, 'reviewed-initial-submit-v2');
    for (const attribute of ['formaction', 'formmethod', 'formtarget', 'formenctype', 'formnovalidate']) {
      for (const value of ['', 'false', 'https://evil.example/collect']) {
        const p = page(routeId); p.button.setAttribute(attribute, value);
        assert.equal(Automatic.capture(p.payload, p.env).reason, 'changed_submit'); assert.equal(p.clicks(), 0);
      }
      for (const phase of ['before_submit', 'validity', 'focus', 'click']) {
        const p = page(routeId); assert.equal(Automatic.capture(p.payload, p.env).status, 'ready');
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
        const p = page(routeId); assert.equal(Automatic.capture(p.payload, p.env).status, 'ready'); const insert = () => mutate(p);
        if (phase === 'validity') p.form.onValidate = insert; if (phase === 'focus') p.button.onFocus = insert; if (phase === 'click') p.button.onClick = insert;
        assert.equal(Automatic.submit(p.payload, p.env).status, 'blocked'); assert.equal(p.sent(), 0); assert.equal(p.clicks(), phase === 'click' ? 1 : 0);
      }
    }
  });
}
