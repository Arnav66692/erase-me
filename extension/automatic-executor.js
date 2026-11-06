/* Reviewed one-shot native submissions. An attempt never establishes acceptance. */
(function (root) {
  'use strict';
  // Reinjecting the file into the same isolated document must not reset its journal.
  if (root.EraseAutomaticExecutor?.version === 'automatic-executor-v5') {
    if (typeof module !== 'undefined') module.exports = root.EraseAutomaticExecutor;
    return;
  }
  const BASE = root.EraseBrokerExecutor || (typeof require === 'function' ? require('./broker-executor.js') : null);
  const SPF_CONSENT = 'I confirm that I am the person associated with this email address and consent to receive an email from Search People FREE. The Information you provide here will only be used to process your request. We will not sell or use the information or use it for any other purpose. Please see our Privacy Policy for more details.';
  const SPF_TERMS = 'By using our site and services, you agree to our Terms of Use. Visit our Notice at Collection and Privacy Notice for information about our privacy practices.';
  const CONTRACTS = Object.freeze({
    fastpeoplesearch: Object.freeze({ id: 'fastpeoplesearch-submit-2026-11-05-v1', stage: 'verification_initiation', requiredCapability: 'reviewed-initial-submit-v2',
      consentText: 'I authorize FastPeopleSearch.com to send communications relating to my privacy request to the email address(es) provided. I certify that I am the subject of the request, or an agent authorized to act on behalf of the subject of the request. I understand that information provided relating to this request will not be used for any purpose other than the processing of this request.', policyUrl: null }),
    'tr-numaraara': Object.freeze({ id: 'numaraara-submit-2026-11-05-v1', stage: 'request_submission', requiredCapability: 'reviewed-initial-submit-v2',
      consentText: "Kişisel Verilerin Korunması Kanunu uyarınca gerçekleştirilen ilgili Bilgilendirme'yi okudum ve kabul ediyorum.",
      policyUrl: 'https://www.numaraara.com/kvkk-aydinlatma-metni' }),
    advancedbackgroundchecks: Object.freeze({ id: 'advancedbackgroundchecks-submit-2026-11-05-v1', stage: 'verification_initiation', requiredCapability: 'reviewed-initial-submit-v2',
      consentText: 'By clicking submit, I authorize AdvancedBackgroundChecks to send communications relating to my privacy request to the email address(es) provided. I understand that information provided relating to this request will not be used for any purpose other than the processing of this request. By using our site and services, you agree to our Terms of Use. Visit our Notice at Collection and Privacy Notice for information about our privacy practices. This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.',
      policyUrl: null, policyUrls: Object.freeze(['https://www.advancedbackgroundchecks.com/terms', 'https://www.advancedbackgroundchecks.com/notice-at-collection', 'https://www.advancedbackgroundchecks.com/privacy', 'https://policies.google.com/privacy', 'https://policies.google.com/terms']) }),
    'tr-nosorgulama': Object.freeze({ id: 'nosorgulama-submit-2026-11-05-v1', stage: 'request_submission', requiredCapability: 'reviewed-initial-submit-v2',
      consentText: "Gönderim ile KVKK ve Gizlilik Politikası'nı kabul etmiş olursunuz.", policyUrl: null,
      policyUrls: Object.freeze(['https://www.nosorgulama.com.tr/kvkk', 'https://www.nosorgulama.com.tr/gizlilik']) }),
    'tr-numarasor': Object.freeze({ id: 'numarasor-submit-2026-11-05-v1', stage: 'request_submission', requiredCapability: 'reviewed-initial-submit-v2',
      consentText: 'Talebiniz değerlendirilirken numaranın size ait olduğunu doğrulayan ek belge isteyebiliriz.', policyUrl: null,
      policyUrls: Object.freeze([]) }),
    searchpeoplefree: Object.freeze({ id: 'searchpeoplefree-submit-2026-11-05-v1', stage: 'verification_initiation', requiredCapability: 'reviewed-initial-submit-v3',
      consentText: SPF_CONSENT + ' ' + SPF_TERMS, policyUrl: null,
      policyUrls: Object.freeze(['https://www.searchpeoplefree.com/privacy', 'https://www.searchpeoplefree.com/terms', 'https://www.searchpeoplefree.com/notice-at-collection', 'https://www.searchpeoplefree.com/privacy']) }),
    apollo: Object.freeze({ id: 'apollo-submit-2026-11-05-v1', stage: 'verification_initiation', requiredCapability: 'reviewed-initial-submit-v3',
      consentText: 'Erase Me authorization: I authorize my approved business email associated with my own Apollo record to be submitted to Apollo’s verification-information form. This starts verification only and does not establish deletion.', policyUrl: null,
      policyUrls: Object.freeze([]) })
  });
  const documents = new WeakMap(), pendingReadiness = new WeakMap(), nativeSubmissionGuards = new WeakMap(), MAX_MEDIA = 512 * 1024, READINESS_TIMEOUT_MS = 12000;
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
  function nativeSubmitter(button) {
    // Native submitter attributes override the corresponding form properties.
    // The reviewed forms have none; even an empty override is a contract change.
    if (!button || typeof button.hasAttribute !== 'function' || button.formNoValidate !== false || button.name !== '' || button.value !== '' ||
        ['formaction', 'formmethod', 'formtarget', 'formenctype', 'formnovalidate'].some(name => button.hasAttribute(name))) reject('changed_submit');
  }
  function nativeForm(form, method, noValidate) {
    if (!form || form.tagName !== 'FORM' || form.method?.toLowerCase() !== method || form.enctype !== 'application/x-www-form-urlencoded' ||
        form.target !== '' || form.noValidate !== noValidate) reject('changed_destination');
  }
  function signature(payload) {
    return JSON.stringify({ routeId: payload.routeId, operationId: payload.operationId, consentId: payload.consentId,
      authorized: payload.authorized, autoSubmit: payload.autoSubmit,
      fields: Object.entries(payload.fields).sort(([a], [b]) => a.localeCompare(b)),
      ownRequestConfirmed: payload.ownRequestConfirmed === true, businessEmailConfirmed: payload.businessEmailConfirmed === true });
  }
  function blockNativeSubmission(doc) {
    // Apollo's React handler sends the request; a missing handler must never fall
    // back to a GET containing the approved business email in its URL. A meta CSP
    // adds a browser-enforced restriction and cannot relax the site's own policy.
    let record = nativeSubmissionGuards.get(doc);
    if (!record) {
      if (!doc.head || typeof doc.createElement !== 'function' || typeof doc.head.appendChild !== 'function') reject('submission_guard_unavailable');
      const meta = doc.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy'; meta.content = "form-action 'none'";
      doc.head.appendChild(meta); record = { meta, head: doc.head }; nativeSubmissionGuards.set(doc, record);
    }
    if (doc.head !== record.head || record.meta.ownerDocument !== doc || record.meta.parentElement !== record.head || record.meta.isConnected !== true ||
        record.meta.tagName !== 'META' || record.meta.httpEquiv !== 'Content-Security-Policy' || record.meta.content !== "form-action 'none'") reject('submission_guard_unavailable');
    return record.meta;
  }
  function inspectApollo(payload, env, route, contract) {
    const doc = env.document, field = one(doc, route.business_email), form = field.form;
    nativeForm(form, 'get', false);
    if (!BASE.formAllowed(form.action || env.location.href, route) || form.getAttribute?.('onsubmit') !== null) reject('changed_destination');
    if ([...doc.querySelectorAll('[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors')].some(element => visible(element, env))) reject('existing_alert');
    if (!visible(field, env) || field.tagName !== 'INPUT' || field.type !== 'email' || field.name !== 'email' || !field.required || field.disabled || field.readOnly ||
        field.value !== payload.fields.business_email || field.labels?.length !== 1) reject('changed_fields');
    const label = field.labels[0];
    if (!visible(label, env) || label.tagName !== 'LABEL' || label.htmlFor !== 'email' || label.control !== field || normal(label.textContent) !== 'Work email') reject('changed_fields');
    const fieldsets = [...form.elements].filter(element => element.tagName === 'FIELDSET'), decorator = fieldsets[0];
    if (fieldsets.length !== 1 || decorator.form !== form || decorator.name !== '' || decorator.disabled || decorator.type !== 'fieldset' ||
        decorator.getAttribute?.('aria-hidden') !== 'true' || decorator.textContent !== '\u200b') reject('additional_fields');
    const submits = [...form.elements].filter(element => ['BUTTON', 'INPUT'].includes(element.tagName) && ['submit', 'image'].includes(element.type)), button = submits[0];
    nativeSubmitter(button);
    if (submits.length !== 1 || !visible(button, env) || button.form !== form || button.tagName !== 'BUTTON' || button.type !== 'submit' || button.disabled ||
        normal(button.textContent) !== 'Get verification information') reject('changed_submit');
    if (normal(form.textContent) !== 'Work email\u200bGet verification information' || form.querySelectorAll('a').length) reject('changed_consent');
    const approved = new Set([field, decorator, button]);
    if ([...form.elements].some(element => !approved.has(element))) reject('additional_fields');
    const submissionGuard = blockNativeSubmission(doc);
    return { route, contract, form, controls: [field], selection: null, checkbox: null, label, button, decorator, submissionGuard };
  }
  function inspectABC(payload, env, route, contract) {
    const doc = env.document, first = one(doc, '#sfn'), form = first.form;
    nativeForm(form, 'get', true);
    if (!BASE.formAllowed(form.action || env.location.href, route)) reject('changed_destination');
    if ([...doc.querySelectorAll('[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors')].some(e => visible(e, env))) reject('existing_alert');
    const controls = Object.entries(payload.fields).map(([key, value]) => {
      const element = one(doc, route[key]);
      if (!visible(element, env) || element.disabled || element.readOnly || !element.required || element.form !== form ||
          element.tagName !== 'INPUT' || element.name !== '' || element.type !== (key === 'email' ? 'email' : 'text') || element.value !== value) reject('changed_fields');
      return element;
    });
    const selection = one(doc, 'select#mode');
    if (!visible(selection, env) || selection.form !== form || selection.name !== '' || selection.disabled || selection.readOnly || selection.required || selection.multiple !== false ||
        selection.value !== 'subject' || ![...selection.options].some(option => option.value === 'subject' && !option.disabled)) reject('changed_purpose');
    const middle = one(doc, 'input#smn'), honeypot = one(doc, 'input[name="company"]');
    for (const element of [middle, honeypot]) if (element.form !== form || element.type !== 'text' || element.disabled || element.readOnly || element.required || element.value !== '') reject('additional_fields');
    if (middle.name !== '' || !visible(middle, env) || visible(honeypot, env)) reject('additional_fields');
    const paragraphs = [...form.querySelectorAll('p')], expected = [
      'By clicking submit, I authorize AdvancedBackgroundChecks to send communications relating to my privacy request to the email address(es) provided. I understand that information provided relating to this request will not be used for any purpose other than the processing of this request.',
      'By using our site and services, you agree to our Terms of Use. Visit our Notice at Collection and Privacy Notice for information about our privacy practices.',
      'This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.'
    ];
    if (paragraphs.length !== expected.length || paragraphs.some((element, index) => !visible(element, env) || normal(element.textContent) !== expected[index])) reject('changed_consent');
    const policyLinks = [...form.querySelectorAll('a')];
    if (policyLinks.length !== contract.policyUrls.length || policyLinks.some((link, index) => !visible(link, env) || link.href !== contract.policyUrls[index]) || paragraphs[0].querySelectorAll('a').length ||
        paragraphs[1].querySelectorAll('a').length !== 3 || paragraphs[2].querySelectorAll('a').length !== 2) reject('changed_consent');
    const submits = [...form.querySelectorAll('button[type="submit"],input[type="submit"]')], button = submits[0];
    nativeSubmitter(button);
    if (submits.length !== 1 || !visible(button, env) || button.tagName !== 'BUTTON' || button.form !== form || button.disabled || button.formNoValidate !== false || normal(button.textContent) !== 'Submit') reject('changed_submit');
    const challengeResponse = one(doc, 'textarea[name="g-recaptcha-response"]');
    const challengeScripts = [...doc.querySelectorAll('script[src]')].filter(element => element.src === 'https://www.google.com/recaptcha/api.js?render=6LdYzessAAAAACnQqZugXee4rNpMsD-6X1paSkS8');
    if (challengeScripts.length !== 1 || challengeResponse.form !== null || challengeResponse.required || challengeResponse.disabled || challengeResponse.readOnly || visible(challengeResponse, env)) reject('changed_challenge');
    const approved = new Set([...controls, selection, middle, honeypot, button]);
    if ([...form.elements].some(element => !approved.has(element))) reject('additional_fields');
    return { route, contract, form, controls, selection, checkbox: null, label: paragraphs[0], terms: paragraphs[1], notice: paragraphs[2],
      policyLinks, button, middle, honeypot, challengeResponse, challengeScript: challengeScripts[0] };
  }
  function inspectOwnPost(payload, env, route, contract) {
    const doc = env.document, noSorgulama = payload.routeId === 'tr-nosorgulama';
    const form = one(doc, route.full_name).form;
    nativeForm(form, 'post', false);
    if (!BASE.formAllowed(form.action || env.location.href, route)) reject('changed_destination');
    if ([...doc.querySelectorAll('[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors')].some(e => visible(e, env))) reject('existing_alert');
    const controls = Object.entries(payload.fields).map(([key, value]) => {
      const element = one(doc, route[key]), tag = key === 'request_text' ? 'TEXTAREA' : 'INPUT';
      const type = key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text';
      if (!visible(element, env) || element.disabled || element.readOnly || !element.required || element.form !== form || element.tagName !== tag ||
          tag === 'INPUT' && element.type !== type || element.value !== (key === 'request_text' ? value.replace(/\r\n?/g, '\n') : value)) reject('changed_fields');
      return element;
    });
    const selection = one(doc, route.selection.selector);
    if (!visible(selection, env) || selection.form !== form || selection.disabled || selection.readOnly || !selection.required || selection.multiple !== false ||
        selection.value !== route.selection.value || ![...selection.options].some(option => option.value === route.selection.value && !option.disabled)) reject('changed_purpose');
    const optionals = noSorgulama ? [['input#ic-tel[name="telefon"]', 'tel'], ['input#ic-ilgili[name="ilgili_numara"]', 'text'], ['input[name="website_url"]', 'text']] :
      [['input#phone[name="phone"]', 'tel'], ['input[name="website"]', 'text']];
    const optionalControls = optionals.map(([selector, type]) => {
      const element = one(doc, selector);
      if (element.form !== form || element.type !== type || element.disabled || element.readOnly || element.required || element.value !== '') reject('additional_fields');
      return element;
    });
    const csrf = one(doc, 'input[name="_csrf"]');
    if (csrf.form !== form || csrf.type !== 'hidden' || csrf.disabled || csrf.readOnly || csrf.required || typeof csrf.value !== 'string' ||
        csrf.value.length !== 64 || /[\s\x00-\x1f\x7f]/.test(csrf.value)) reject('changed_form');
    const labels = [...form.querySelectorAll(noSorgulama ? 'p.ic-tos' : 'p.muted.small')], label = labels[0];
    if (labels.length !== 1 || !visible(label, env) || normal(label.textContent) !== contract.consentText) reject('changed_consent');
    const policyLinks = [...form.querySelectorAll('a')], noticeLinks = [...label.querySelectorAll('a')];
    if (policyLinks.length !== contract.policyUrls.length || noticeLinks.length !== policyLinks.length ||
        policyLinks.some((link, index) => link !== noticeLinks[index] || !visible(link, env) || link.href !== contract.policyUrls[index])) reject('changed_consent');
    const submits = [...form.querySelectorAll('button[type="submit"],input[type="submit"]')], button = submits[0];
    nativeSubmitter(button);
    if (submits.length !== 1 || !visible(button, env) || button.tagName !== 'BUTTON' || button.form !== form || button.disabled || button.formNoValidate !== false ||
        normal(button.textContent) !== (noSorgulama ? 'Mesajı Gönder' : 'Talebi Gönder')) reject('changed_submit');
    if (form.querySelector('iframe,img,canvas') || doc.querySelector('.cf-turnstile,.g-recaptcha,.h-captcha,iframe[src*="recaptcha"],iframe[src*="hcaptcha"]')) reject('changed_challenge');
    const approved = new Set([...controls, selection, ...optionalControls, csrf, button]);
    if ([...form.elements].some(element => !approved.has(element))) reject('additional_fields');
    return { route, contract, form, controls, selection, checkbox: null, label, policyLinks, button, optionalControls, csrf };
  }
  function inspectSPF(payload, env, route, contract, allowPendingToken) {
    const doc = env.document, form = one(doc, '#o_form');
    nativeForm(form, 'get', false);
    if (!BASE.formAllowed(form.action || env.location.href, route) || form.getAttribute?.('onsubmit') !== 'return o_beginRemoval()') reject('changed_destination');
    if ([...doc.querySelectorAll('[role="alert"],.swal2-popup,.alert-success,.alert-danger,.validation-summary-errors,#o_fail,#o_success,#o_success_sent')].some(element => visible(element, env))) reject('existing_alert');
    const controls = Object.entries(payload.fields).map(([key, value]) => {
      const element = one(doc, route[key]);
      if (!visible(element, env) || element.form !== form || element.tagName !== 'INPUT' || element.name !== '' || element.required ||
          element.disabled || element.readOnly || element.type !== (key === 'email' ? 'email' : 'text') || element.value !== value) reject('changed_fields');
      return element;
    });
    const middle = one(doc, '#o_middle');
    if (!visible(middle, env) || middle.form !== form || middle.tagName !== 'INPUT' || middle.type !== 'text' || middle.name !== '' ||
        middle.required || middle.disabled || middle.readOnly || middle.value !== '') reject('additional_fields');
    const checkbox = one(doc, '#o_terms');
    if (!visible(checkbox, env) || checkbox.form !== form || checkbox.tagName !== 'INPUT' || checkbox.type !== 'checkbox' || checkbox.name !== '' ||
        checkbox.required || checkbox.disabled || checkbox.readOnly || checkbox.labels?.length !== 1) reject('changed_consent');
    const label = checkbox.labels[0], labelLinks = [...label.querySelectorAll('a')];
    if (label.tagName !== 'LABEL' || !visible(label, env) || normal(label.textContent) !== SPF_CONSENT || labelLinks.length !== 1 ||
        !visible(labelLinks[0], env) || labelLinks[0].href !== contract.policyUrls[0]) reject('changed_consent');
    const paragraphs = [...form.querySelectorAll('p')], terms = paragraphs[0];
    if (paragraphs.length !== 1 || !visible(terms, env) || normal(terms.textContent) !== SPF_TERMS) reject('changed_consent');
    const policyLinks = [...form.querySelectorAll('a')], termsLinks = [...terms.querySelectorAll('a')];
    if (policyLinks.length !== contract.policyUrls.length || termsLinks.length !== 3 || policyLinks[0] !== labelLinks[0] ||
        policyLinks.some((link, index) => !visible(link, env) || link.href !== contract.policyUrls[index] || index > 0 && link !== termsLinks[index - 1])) reject('changed_consent');
    const button = one(doc, '#o_submit');
    // The reviewed button omits a type attribute, so use the native type property.
    const submits = [...form.elements].filter(element => ['BUTTON', 'INPUT'].includes(element.tagName) && ['submit', 'image'].includes(element.type));
    nativeSubmitter(button);
    if (submits.length !== 1 || submits[0] !== button || !visible(button, env) || button.form !== form || button.tagName !== 'BUTTON' || button.type !== 'submit' || button.disabled ||
        normal(button.innerText) !== 'Begin removal process.' || normal(button.textContent) !== 'Begin removal process.' || button.children.length !== 0) reject('changed_submit');
    const token = one(doc, '#o_form input[name="cf-turnstile-response"]'), widget = one(doc, '#o_form .cf-turnstile');
    if (token.form !== form || token.tagName !== 'INPUT' || token.type !== 'hidden' || token.disabled || token.readOnly || token.required ||
        typeof token.value !== 'string' || token.value.length > 16384 || !visible(widget, env)) reject('changed_challenge');
    if (!token.value.trim() && !allowPendingToken) reject('challenge_required');
    const approved = new Set([...controls, middle, checkbox, button, token]);
    if ([...form.elements].some(element => !approved.has(element))) reject('additional_fields');
    return { route, contract, form, controls, selection: null, checkbox, label, terms, policyLinks, button, middle, token, widget };
  }
  function inspect(payload, env, allowPendingToken = false) {
    const contract = CONTRACTS[payload?.routeId], doc = env.document;
    if (!BASE || !contract || payload.autoSubmit !== true || payload.authorized !== true || payload.consentId !== contract.id ||
        !/^[a-f0-9-]{32,40}$/.test(payload.operationId || '')) reject('approval_required');
    const route = BASE.validate(payload.routeId, payload.fields, payload);
    if (!BASE.allowed(env.location.href, route) || doc.querySelector('input[type="file"]')) reject('changed_destination');
    if (payload.routeId === 'advancedbackgroundchecks') return inspectABC(payload, env, route, contract);
    if (['tr-nosorgulama', 'tr-numarasor'].includes(payload.routeId)) return inspectOwnPost(payload, env, route, contract);
    if (payload.routeId === 'searchpeoplefree') return inspectSPF(payload, env, route, contract, allowPendingToken);
    if (payload.routeId === 'apollo') return inspectApollo(payload, env, route, contract);
    const form = one(doc, route.form);
    nativeForm(form, 'post', false);
    if (!BASE.formAllowed(form.action || env.location.href, route)) reject('changed_destination');
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
    if (!visible(selection, env) || selection.tagName !== 'SELECT' || selection.form !== form || selection.disabled || selection.readOnly || selection.multiple !== false ||
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
    nativeSubmitter(button);
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
      facts.widget = one(doc, '#optout-start .cf-turnstile');
      if (facts.token.form !== form || facts.token.type !== 'hidden' || facts.token.disabled || facts.token.readOnly || typeof facts.token.value !== 'string' || facts.token.value.length > 16384 || !visible(facts.widget, env)) reject('changed_challenge');
      if (!facts.token.value.trim() && !allowPendingToken) reject('challenge_required');
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
  function waitReady(payload, env = root) {
    let record, doc, operationId;
    try {
      if (!['fastpeoplesearch', 'searchpeoplefree'].includes(payload?.routeId)) reject('approval_required');
      const fresh = inspect(payload, env, true);
      doc = env.document; operationId = payload.operationId;
      if (documents.get(doc)?.has(operationId)) reject('already_captured');
      record = { ...fresh, signature: signature(payload), url: env.location.href,
        initialConsent: fresh.checkbox.checked, checkboxValue: fresh.checkbox.value };
      const previous = pendingReadiness.get(doc)?.get(operationId);
      if (previous) return previous.signature === record.signature && previous.promise ? previous.promise : Promise.resolve(blocked('already_waiting'));
      // This observes a response already produced by the normal broker widget;
      // it does not consume the later one-shot capture or disclose its token.
      if (fresh.token.value.trim()) return Promise.resolve({ status: 'ready' });
      if (typeof env.MutationObserver !== 'function' || typeof env.setTimeout !== 'function' || typeof env.clearTimeout !== 'function' ||
          typeof doc.addEventListener !== 'function' || typeof doc.removeEventListener !== 'function' ||
          typeof env.addEventListener !== 'function' || typeof env.removeEventListener !== 'function') reject('challenge_unavailable');
    } catch (error) { return Promise.resolve(blocked(error.reason || 'changed_form')); }
    let waiting = pendingReadiness.get(doc);
    if (!waiting) { waiting = new Map(); pendingReadiness.set(doc, waiting); }
    const entry = { signature: record.signature };
    waiting.set(operationId, entry);
    entry.promise = new Promise(resolve => {
      let finished = false, observer, timeout;
      const finish = result => {
        if (finished) return;
        finished = true;
        try { observer?.disconnect(); } catch (_) {}
        try { if (timeout !== undefined) env.clearTimeout(timeout); } catch (_) {}
        for (const event of ['input', 'change']) { try { doc.removeEventListener(event, changed, true); } catch (_) {} }
        try { env.removeEventListener('pagehide', pageHidden, true); } catch (_) {}
        if (waiting.get(operationId) === entry) waiting.delete(operationId);
        resolve(result);
      };
      const check = finalRead => {
        if (finished) return;
        try {
          if (env.document !== doc || env.location.href !== record.url || signature(payload) !== record.signature) reject('changed_form');
          const fresh = inspect(payload, env, true);
          if (['form', 'selection', 'checkbox', 'label', 'button', 'token', 'widget', 'terms', 'middle'].some(key => record[key] !== fresh[key]) ||
              record.controls.length !== fresh.controls.length || record.controls.some((element, index) => element !== fresh.controls[index]) ||
              fresh.policyLinks && (record.policyLinks.length !== fresh.policyLinks.length || record.policyLinks.some((element, index) => element !== fresh.policyLinks[index])) ||
              fresh.checkbox.checked !== record.initialConsent || fresh.checkbox.value !== record.checkboxValue) reject('changed_form');
          if (fresh.token.value.trim()) finish({ status: 'ready' });
          else if (finalRead) finish(blocked('challenge_required', 'The broker still requires its actual challenge response. No token was created or submission attempted.'));
        } catch (error) { finish(blocked(error.reason || 'changed_form')); }
      };
      const changed = () => check(false);
      const pageHidden = () => finish(blocked('changed_destination', 'The broker page was left before its normal challenge was ready. No submission was attempted.'));
      try {
        observer = new env.MutationObserver(changed);
        observer.observe(doc, { subtree: true, childList: true, attributes: true, characterData: true });
        for (const event of ['input', 'change']) doc.addEventListener(event, changed, true);
        env.addEventListener('pagehide', pageHidden, true);
        // One foreground deadline, with a final read for value-property writes
        // that emit no DOM mutation or input/change event. No polling is started.
        timeout = env.setTimeout(() => check(true), READINESS_TIMEOUT_MS);
        check(false);
      } catch (_) { finish(blocked('challenge_unavailable')); }
    });
    return entry.promise;
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
    if (record.signature !== signature(payload) || ['form', 'selection', 'checkbox', 'label', 'button', 'image', 'answer', 'token', 'widget', 'terms', 'notice', 'middle', 'honeypot', 'challengeResponse', 'challengeScript', 'csrf', 'decorator', 'submissionGuard'].some(key => record[key] !== fresh[key]) ||
        record.controls.length !== fresh.controls.length || record.controls.some((element, index) => element !== fresh.controls[index]) ||
        fresh.checkbox && (fresh.checkbox.checked !== consent || fresh.checkbox.value !== record.checkboxValue) ||
        fresh.policyLinks && (record.policyLinks.length !== fresh.policyLinks.length || record.policyLinks.some((element, index) => element !== fresh.policyLinks[index])) ||
        fresh.optionalControls && (record.optionalControls.length !== fresh.optionalControls.length || record.optionalControls.some((element, index) => element !== fresh.optionalControls[index])) ||
        fresh.csrf && fresh.csrf.value !== record.csrfValue) reject('changed_form');
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
      const record = { ...fresh, signature: signature(payload), checkboxValue: fresh.checkbox?.value, initialConsent: fresh.checkbox?.checked,
        tokenValue: fresh.token?.value, csrfValue: fresh.csrf?.value, phase: 'captured' };
      if (fresh.image) {
        if (fresh.answer.value) reject('existing_challenge_answer');
        Object.assign(record, imageData(fresh.image, env));
        record.challengeRef = env.crypto.randomUUID().replace(/-/g, '');
        if (!/^[a-f0-9]{32}$/.test(record.challengeRef)) reject('challenge_unavailable');
        same(record, inspect(payload, env), payload, env, record.initialConsent, ''); journal.set(payload.operationId, record);
        return { status: 'image', media: record.media, alphabet: '', challengeRef: record.challengeRef };
      }
      journal.set(payload.operationId, record);
      return { status: 'ready', detail: 'The reviewed controls are ready for one native submission attempt. Broker acceptance remains unverified.' };
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
      if (fresh.checkbox) {
        const checked = Object.getOwnPropertyDescriptor(env.HTMLInputElement.prototype, 'checked')?.set;
        if (!checked) reject('native_controls_unavailable');
        checked.call(fresh.checkbox, true);
        for (const type of ['input', 'change']) {
          fresh.checkbox.dispatchEvent(new env.Event(type, { bubbles: true }));
          fresh = same(record, inspect(payload, env), payload, env, true, record.answer ? '' : undefined);
        }
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
  const api = Object.freeze({ version: 'automatic-executor-v5', CONTRACTS, waitReady, capture, submit });
  root.EraseAutomaticExecutor = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);
