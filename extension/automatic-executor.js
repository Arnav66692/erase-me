/* Reviewed one-shot native submissions. An attempt never establishes acceptance. */
(function (root) {
  'use strict';
  // Reinjecting the file into the same isolated document must not reset its journal.
  if (root.EraseAutomaticExecutor?.version === 'automatic-executor-v1') {
    if (typeof module !== 'undefined') module.exports = root.EraseAutomaticExecutor;
    return;
  }
  const BASE = root.EraseBrokerExecutor || (typeof require === 'function' ? require('./broker-executor.js') : null);
  const CONTRACTS = Object.freeze({
    fastpeoplesearch: Object.freeze({ id: 'fastpeoplesearch-submit-2026-11-05-v1', stage: 'verification_initiation',
      consentText: 'I authorize FastPeopleSearch.com to send communications relating to my privacy request to the email address(es) provided. I certify that I am the subject of the request, or an agent authorized to act on behalf of the subject of the request. I understand that information provided relating to this request will not be used for any purpose other than the processing of this request.', policyUrl: null }),
    'tr-numaraara': Object.freeze({ id: 'numaraara-submit-2026-11-05-v1', stage: 'request_submission',
      consentText: "Kişisel Verilerin Korunması Kanunu uyarınca gerçekleştirilen ilgili Bilgilendirme'yi okudum ve kabul ediyorum.",
      policyUrl: 'https://www.numaraara.com/kvkk-aydinlatma-metni' })
  });
  const documents = new WeakMap(), MAX_MEDIA = 512 * 1024;
  const normal = value => String(value || '').replace(/\s+/g, ' ').trim();
  const blocked = (reason, detail = 'The reviewed form changed. No automatic submission was performed.') => ({ status: 'blocked', reason, detail });
  function reject(reason) { const error = new Error(reason); error.reason = reason; throw error; }
  function stateFor(document) { if (!documents.has(document)) documents.set(document, new Map()); return documents.get(document); }
  function visible(element, env) {
    if (!element || element.hidden || !element.getClientRects?.().length) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = env.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  }
  function one(document, selector) {
    const matches = [...document.querySelectorAll(selector)];
    if (matches.length !== 1) reject('changed_controls');
    return matches[0];
  }
  function signature(payload) {
    return JSON.stringify({ routeId: payload.routeId, operationId: payload.operationId, consentId: payload.consentId,
      authorized: payload.authorized, autoSubmit: payload.autoSubmit,
      fields: Object.entries(payload.fields).sort(([a], [b]) => a.localeCompare(b)),
      ownRequestConfirmed: payload.ownRequestConfirmed === true });
  }
  function inspect(payload, env) {
    const contract = CONTRACTS[payload?.routeId], doc = env.document;
    if (!BASE || !contract || payload.autoSubmit !== true || payload.authorized !== true || payload.consentId !== contract.id ||
        !/^[a-f0-9-]{32,40}$/.test(payload.operationId || '')) reject('approval_required');
    const route = BASE.validate(payload.routeId, payload.fields, payload);
    if (!BASE.allowed(env.location.href, route) || doc.querySelector('input[type="file"]')) reject('changed_destination');
    const form = one(doc, route.form);
    if (form.tagName !== 'FORM' || form.method?.toLowerCase() !== 'post' || !BASE.formAllowed(form.action || env.location.href, route)) reject('changed_destination');
    if ([...doc.querySelectorAll('[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors')].some(e => visible(e, env))) reject('existing_alert');
    const controls = Object.entries(payload.fields).map(([key, value]) => {
      const element = one(doc, route[key]);
      const tag = key === 'request_text' ? 'TEXTAREA' : 'INPUT', type = key === 'email' ? 'email' : 'text';
      if (!visible(element, env) || element.disabled || element.readOnly || element.form !== form || element.tagName !== tag ||
          tag === 'INPUT' && element.type !== type || element.value !== (key === 'request_text' ? value.replace(/\r\n?/g, '\n') : value)) reject('changed_fields');
      return element;
    });
    const numara = payload.routeId === 'tr-numaraara';
    const selection = one(doc, numara ? '#form_Konu[name="form.Konu"]' : 'select[name="am"]');
    const choice = numara ? 'Numara Silme Talebi (KVKK)' : 'subject';
    if (!visible(selection, env) || selection.tagName !== 'SELECT' || selection.form !== form || selection.disabled || selection.readOnly ||
        selection.value !== choice || ![...selection.options].some(option => option.value === choice && !option.disabled)) reject('changed_purpose');
    const checkbox = one(doc, numara ? 'input#form_Kvkk[name="form.Kvkk"][type="checkbox"]' : '#optout-start input[name="legal"][type="checkbox"]');
    if (!visible(checkbox, env) || checkbox.form !== form || checkbox.disabled || checkbox.readOnly || !checkbox.required) reject('changed_consent');
    const label = numara ? checkbox.labels?.length === 1 && checkbox.labels[0] : checkbox.parentElement;
    const text = normal(label?.textContent), expected = contract.consentText;
    if (!label || !visible(label, env) || !(text === expected || !numara && text === '* ' + expected)) reject('changed_consent');
    const links = [...label.querySelectorAll('a')];
    if (numara ? links.length !== 1 || links[0].href !== contract.policyUrl : links.length !== 0) reject('changed_consent');
    const submits = [...form.querySelectorAll('button[type="submit"],input[type="submit"]')];
    if (submits.length !== 1) reject('changed_submit');
    const button = submits[0];
    if (!visible(button, env) || button.tagName !== 'BUTTON' || button.form !== form || button.disabled ||
        normal(button.textContent) !== (numara ? 'Talebi Gönder' : 'Submit')) reject('changed_submit');
    const facts = { route, contract, form, controls, selection, checkbox, label, button };
    if (numara) {
      facts.answer = one(doc, 'input#form_ResimKodu[name="form.ResimKodu"]');
      facts.image = one(doc, 'img#captcha_imgContactResimKodu');
      if (!visible(facts.answer, env) || facts.answer.form !== form || facts.answer.type !== 'text' || !facts.answer.required ||
          facts.answer.disabled || facts.answer.readOnly || facts.answer.maxLength !== 5) reject('changed_challenge');
      imageSource(facts.image, env);
    } else {
      facts.token = one(doc, '#optout-start input[name="cf-turnstile-response"]');
      if (facts.token.form !== form || facts.token.type !== 'hidden' || typeof facts.token.value !== 'string' || facts.token.value.length > 16384) reject('changed_challenge');
      if (!facts.token.value.trim()) reject('challenge_required');
      if (![...doc.querySelectorAll('#optout-start .cf-turnstile')].some(e => visible(e, env))) reject('changed_challenge');
    }
    const approved = new Set([...controls, selection, checkbox, button, facts.answer, facts.token]);
    const hiddenNames = new Set(numara ? ['form.FormId', '__RequestVerificationToken', 'form.Kvkk'] : []);
    for (const element of [...form.elements]) {
      if (approved.has(element)) continue;
      if (element.type === 'file' || ['checkbox', 'radio', 'submit'].includes(element.type)) reject('additional_fields');
      if (element.type === 'hidden') { if (!hiddenNames.has(element.name)) reject('additional_fields'); continue; }
      if (element.required && visible(element, env) || typeof element.value === 'string' && element.value.trim()) reject('additional_fields');
    }
    return facts;
  }
  function imageSource(image, env) {
    if (!visible(image, env) || !image.complete || image.naturalWidth !== 130 || image.naturalHeight !== 40) reject('changed_challenge');
    const source = image.currentSrc || image.src;
    let url;
    try { url = new URL(source); } catch (_) { reject('changed_challenge'); }
    if (url.protocol !== 'https:' || url.origin !== 'https://www.numaraara.com' || url.username || url.password || url.port || url.hash ||
        url.pathname !== '/captcha' || [...url.searchParams].length !== 2 || url.searchParams.getAll('pid').length !== 1 ||
        !/^\d{1,20}$/.test(url.searchParams.get('pid')) || url.searchParams.getAll('transparent').length !== 1 || url.searchParams.get('transparent') !== '1' || image.src !== source) reject('changed_challenge');
    return source;
  }
  function imageData(image, env) {
    const source = imageSource(image, env), canvas = env.document.createElement('canvas'); canvas.width = 130; canvas.height = 40;
    const context = canvas.getContext('2d'); if (!context) reject('challenge_unavailable');
    context.drawImage(image, 0, 0, 130, 40);
    const encoded = canvas.toDataURL('image/png');
    if (typeof encoded !== 'string' || !encoded.startsWith('data:image/png;base64,')) reject('challenge_unavailable');
    const media = encoded.slice('data:image/png;base64,'.length), padding = media.endsWith('==') ? 2 : media.endsWith('=') ? 1 : 0;
    if (!media.startsWith('iVBORw0KGgo') || !/^[A-Za-z0-9+/]+={0,2}$/.test(media) || media.length % 4 ||
        Math.floor(media.length * 3 / 4) - padding > MAX_MEDIA || imageSource(image, env) !== source) reject('challenge_unavailable');
    return { source, media };
  }
  function same(record, fresh, payload, env, consent, answer) {
    if (record.signature !== signature(payload) || ['form', 'selection', 'checkbox', 'label', 'button', 'image', 'answer', 'token'].some(key => record[key] !== fresh[key]) ||
        record.controls.length !== fresh.controls.length || record.controls.some((element, index) => element !== fresh.controls[index]) ||
        fresh.checkbox.checked !== consent || fresh.checkbox.value !== record.checkboxValue) reject('changed_form');
    if (fresh.token && fresh.token.value !== record.tokenValue) reject('changed_challenge');
    if (fresh.answer) {
      if (fresh.answer.value !== answer) reject('changed_challenge');
      const current = imageData(fresh.image, env);
      if (current.source !== record.source || current.media !== record.media) reject('changed_challenge');
    }
    return fresh;
  }
  function capture(payload, env = root) {
    try {
      const fresh = inspect(payload, env), journal = stateFor(env.document);
      if (journal.has(payload.operationId)) return blocked('already_captured', 'This document already has an automatic action reference. No repeat was started.');
      const record = { ...fresh, signature: signature(payload), checkboxValue: fresh.checkbox.value, initialConsent: fresh.checkbox.checked,
        tokenValue: fresh.token?.value, phase: 'captured' };
      if (fresh.image) {
        if (fresh.answer.value) reject('existing_challenge_answer');
        Object.assign(record, imageData(fresh.image, env));
        record.challengeRef = env.crypto.randomUUID().replace(/-/g, '');
        if (!/^[a-f0-9]{32}$/.test(record.challengeRef)) reject('challenge_unavailable');
        same(record, inspect(payload, env), payload, env, record.initialConsent, ''); journal.set(payload.operationId, record);
        return { status: 'image', media: record.media, alphabet: '', challengeRef: record.challengeRef };
      }
      journal.set(payload.operationId, record);
      return { status: 'ready', detail: 'The reviewed broker challenge response is present. Broker acceptance remains unverified.' };
    } catch (error) { return blocked(error.reason || 'changed_form', error.reason === 'challenge_required' ? 'The broker requires its actual challenge response. No token was created or submission attempted.' : undefined); }
  }
  function submit(payload, env = root) {
    const journal = stateFor(env.document), record = journal.get(payload?.operationId);
    if (!record || record.phase !== 'captured') return blocked('already_started', 'No unused captured action is available. No repeat was sent.');
    // Consume before any event: an interrupted click or unknown event is never retried.
    record.phase = 'consuming'; let result, listener, seen = false, unsafe = false, clicked = false;
    try {
      const answer = record.answer ? payload.answer : undefined;
      if (record.answer && (payload.challengeRef !== record.challengeRef || typeof answer !== 'string' || !/^[A-Za-z0-9]{5}$/.test(answer))) reject('invalid_challenge_answer');
      let fresh = same(record, inspect(payload, env), payload, env, record.initialConsent, record.answer ? '' : undefined);
      const checked = Object.getOwnPropertyDescriptor(env.HTMLInputElement.prototype, 'checked')?.set;
      if (!checked) reject('native_controls_unavailable');
      checked.call(fresh.checkbox, true);
      for (const type of ['input', 'change']) {
        fresh.checkbox.dispatchEvent(new env.Event(type, { bubbles: true }));
        fresh = same(record, inspect(payload, env), payload, env, true, record.answer ? '' : undefined);
      }
      if (fresh.answer) {
        const setter = Object.getOwnPropertyDescriptor(env.HTMLInputElement.prototype, 'value')?.set;
        if (!setter) reject('native_controls_unavailable');
        setter.call(fresh.answer, answer);
        for (const type of ['input', 'change']) {
          fresh.answer.dispatchEvent(new env.Event(type, { bubbles: true }));
          fresh = same(record, inspect(payload, env), payload, env, true, answer);
        }
      }
      if (typeof fresh.form.checkValidity !== 'function' || !fresh.form.checkValidity()) reject('invalid_form');
      fresh = same(record, inspect(payload, env), payload, env, true, answer);
      listener = event => {
        try {
          if (event.target !== record.form || event.submitter !== record.button || event.isTrusted !== true) reject('unsafe_submit_event');
          same(record, inspect(payload, env), payload, env, true, answer); seen = true;
        } catch (_) { unsafe = true; event.preventDefault(); event.stopImmediatePropagation?.(); }
      };
      fresh.form.addEventListener('submit', listener, { capture: true });
      fresh.button.focus(); same(record, inspect(payload, env), payload, env, true, answer);
      clicked = true; fresh.button.click();
      result = unsafe ? blocked('unsafe_submit_event', 'The form changed at submission. The unsafe event was canceled; no automatic repeat is allowed.') :
        seen ? { status: 'submission_attempted', attempt_verified: true, stage: fresh.contract.stage,
          detail: 'A guarded native form-submit event was observed. Delivery, broker acceptance and deletion remain unverified.' } :
          { status: 'unknown', detail: 'No safe native submission event was observed. Check the existing broker tab; no repeat will be sent.' };
    } catch (error) {
      result = clicked ? { status: 'unknown', detail: 'The submit action was interrupted. Check the existing broker tab; no repeat will be sent.' } : blocked(error.reason || 'changed_form');
    }
    finally {
      if (listener) record.form.removeEventListener('submit', listener, { capture: true });
      journal.set(payload.operationId, { phase: 'done', result });
    }
    return result;
  }
  const api = Object.freeze({ version: 'automatic-executor-v1', CONTRACTS, capture, submit });
  root.EraseAutomaticExecutor = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);
