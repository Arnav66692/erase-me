/* Browser-local profile. Optional receipt checks send only scoped operation references. */
(function (root, factory) {
  const routes = typeof module === 'object' && module.exports ? require('./broker-routes.js') : root.EraseBrokerRoutes;
  const api = factory(root, routes);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseWorkspace = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root, routes) {
  'use strict';
  const KEY = 'erase-me-workspace-v1';
  const VERSION = 1;
  const AUTHORIZATION = 'I request removal of my own information. I authorize only the broker actions I explicitly start using the fields shown. My email is self-reported. I will complete broker verification myself. Dedicated removal-mail receipt checks require separate explicit authorization. No personal inbox access, ID uploads, account deletions or recurring checks are authorized.';
  const USER_STATES = new Set(['user_reported_requested', 'user_reported_completed']);
  const RESULT_STATES = new Set(['prepared', 'verification_sent', 'submitted', 'captcha', 'id_required', 'unsupported', 'pending', 'unknown', 'error', 'blocked']);
  const MAIL_ROUTES = new Set(['usphonebook', 'searchpeoplefree', 'fastpeoplesearch']);
  const OPERATION = /^[a-f0-9-]{32,40}$/;
  const TEXT = {
    ready: 'Ready to open the official broker form. No request has been sent.',
    opened: 'The official form was opened. Opening it does not send a removal request.',
    prepared: 'Fields were prepared in the broker form. Complete the broker steps yourself.',
    needs_broker_step: 'Fields were prepared in the broker form. Complete the broker steps yourself. No request has been sent by the companion.',
    running: 'A broker action was started. Its result has not yet been established.',
    verification_sent: 'The broker accepted a verification-email step. Complete its email and portal steps yourself.',
    requested: 'The broker accepted a removal request. Deletion has not been verified.',
    user_reported_requested: 'You reported submitting a removal request. Broker acceptance has not been independently verified.',
    user_reported_completed: 'You reported finishing the broker steps. Deletion has not been independently verified.',
    blocked: 'The broker needs your attention. No completed removal has been established.',
    uncertain: 'The action outcome is unknown. Do not repeat it until you check the broker result.'
  };
  class WorkspaceError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  function text(value, max, required = true) {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new WorkspaceError('Invalid profile or request field.');
    const result = value.trim().replace(/\s+/g, ' ');
    if (required && !result) throw new WorkspaceError('A required profile field is missing.');
    return result;
  }
  function email(value) {
    const result = text(value, 254);
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(result)) throw new WorkspaceError('Enter a valid email address.');
    const [local, suppliedDomain] = result.split('@');
    let domain;
    try {
      if (/[\\/:?#%]/.test(suppliedDomain)) throw new Error();
      domain = new URL('https://' + suppliedDomain).hostname;
      if (domain.length > 253 || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error();
    } catch (_) { throw new WorkspaceError('Enter a valid email address.'); }
    const normalized = local + '@' + domain;
    if (normalized.length > 254) throw new WorkspaceError('Enter a valid email address.');
    return normalized;
  }
  function routeFor(id) {
    const route = routes.find(item => item.id === id);
    if (!route) throw new WorkspaceError('Choose a supported broker route.', 404);
    return route;
  }
  function listingURL(value, route) {
    const raw = text(value, 2048);
    let url;
    try { url = new URL(raw); } catch (_) { throw new WorkspaceError('Enter an official listing URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.search ||
        !route.allowedHosts.includes(url.hostname) || !/^\/[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(url.pathname) ||
        /^\/(?:optout|opt-out|privacy|account|login|remove|removal|policies)(?:\/|$)/i.test(url.pathname)) {
      throw new WorkspaceError('Use a direct HTTPS listing URL on this broker’s approved domain, without query parameters.');
    }
    return url.href;
  }
  function appliesToCountry(route, country) {
    return route.countries.includes('*') || Boolean(country && route.countries.includes(country));
  }
  function operationStarted(item) {
    return Boolean(item.operation_id) || USER_STATES.has(item.status) || ['running', 'verification_sent', 'requested', 'uncertain', 'needs_broker_step'].includes(item.status);
  }
  function approvedFields(route, fields) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new WorkspaceError('Supply approved broker fields.');
    const approved = {};
    for (const [key, value] of Object.entries(fields)) {
      if (!route.fields.includes(key) || key === 'email') throw new WorkspaceError('This broker field is not editable here.');
      approved[key] = key === 'listing_url' ? listingURL(value, route) : text(value, 120);
    }
    return approved;
  }
  function locationFields(body) {
    const next = {};
    for (const key of Object.keys(body)) {
      if (!['country', 'region', 'city'].includes(key)) throw new WorkspaceError('Only location fields can be changed here.');
      if (body[key] == null) { next[key] = null; continue; }
      const value = text(body[key], key === 'country' ? 2 : key === 'region' ? 12 : 120, false);
      if (key === 'country' && value && !/^[A-Za-z]{2}$/.test(value)) throw new WorkspaceError('Use a two-letter country code.');
      next[key] = value ? (key === 'country' ? value.toUpperCase() : value) : null;
    }
    return next;
  }
  function mailContact(value, routeId, operationId, now, allowExpired = false) {
    if (!MAIL_ROUTES.has(routeId) || !OPERATION.test(operationId) || !value || typeof value !== 'object' || Array.isArray(value))
      throw new WorkspaceError('Choose a supported removal contact operation.');
    const { capability, request_id, route_id, operation_id, contact_email, expires_at } = value;
    if (route_id !== routeId || operation_id !== operationId || typeof request_id !== 'string' || !/^[a-f0-9]{32}$/.test(request_id) ||
        typeof capability !== 'string' || capability.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(capability) ||
        !Number.isSafeInteger(expires_at) || typeof contact_email !== 'string') throw new WorkspaceError('The removal contact does not match this operation.');
    let claims;
    try {
      const encoded = capability.split('.')[0], alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      if (encoded.length > 1800 || encoded.length % 4 === 1) throw new Error();
      let bits = 0, count = 0, decoded = '';
      for (const char of encoded) {
        bits = (bits << 6) | alphabet.indexOf(char); count += 6;
        if (count >= 8) { count -= 8; decoded += String.fromCharCode((bits >>> count) & 255); }
      }
      claims = JSON.parse(decoded);
    } catch (_) { throw new WorkspaceError('The removal contact capability is malformed.'); }
    const keys = ['v', 'request_id', 'route_id', 'operation_id', 'recipient', 'issued_at', 'expires_at'];
    if (!claims || typeof claims !== 'object' || Array.isArray(claims) || Object.keys(claims).length !== keys.length || !keys.every(key => Object.hasOwn(claims, key)) ||
        claims.v !== 1 || claims.request_id !== request_id || claims.route_id !== routeId || claims.operation_id !== operationId ||
        claims.recipient !== contact_email || claims.expires_at !== expires_at || !Number.isSafeInteger(claims.issued_at) ||
        expires_at - claims.issued_at !== 7 * 86400 || claims.issued_at > now + 60 ||
        email(contact_email) !== contact_email || !new RegExp('^[a-z0-9._-]{1,25}\\+erase-' + request_id + '@').test(contact_email))
      throw new WorkspaceError('The removal contact does not match this operation.');
    if (!allowExpired && expires_at <= now) throw new WorkspaceError('This removal contact has expired. No request was repeated.', 410);
    // The server verifies the signature; this local check prevents accidental
    // route/recipient mixups and never establishes broker acceptance.
    return { capability, request_id, route_id, operation_id, contact_email, expires_at };
  }
  function confirmationURL(value) {
    try {
      if (typeof value !== 'string' || value.length > 2048 || /\s/.test(value)) return false;
      const u = new URL(value), key = u.searchParams.get('key');
      return u.protocol === 'https:' && u.hostname === 'www.usphonebook.com' && !u.port && !u.username && !u.password && !u.hash &&
        u.pathname === '/removal/validate-record-info' && [...u.searchParams].length === 2 &&
        u.searchParams.getAll('key').length === 1 && typeof key === 'string' && key.length <= 512 && /^[A-Za-z0-9_-]+={0,2}$/.test(key) &&
        u.searchParams.getAll('ticketid').length === 1 && /^[0-9]{1,32}$/.test(u.searchParams.get('ticketid'));
    } catch (_) { return false; }
  }
  function create(options = {}) {
    const storage = options.storage || {
      getItem: key => root.localStorage.getItem(key),
      setItem: (key, value) => root.localStorage.setItem(key, value),
      removeItem: key => root.localStorage.removeItem(key)
    };
    const clock = options.now || (() => new Date().toISOString());
    const uuid = options.uuid || (() => root.crypto.randomUUID());
    let state;
    let cachedRaw;
    function empty() { return { version: VERSION, profile: null, campaign: { status: 'active' }, items: {}, activity: [] }; }
    function read() {
      let raw;
      try { raw = storage.getItem(KEY); } catch (_) { throw new WorkspaceError('Browser storage is unavailable. Enable local storage to save your workspace.', 503); }
      if (state && raw === cachedRaw) return state;
      cachedRaw = raw;
      if (!raw) { state = empty(); return state; }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION || !parsed.items || !Array.isArray(parsed.activity) ||
            !parsed.campaign || !['active', 'paused'].includes(parsed.campaign.status)) throw new Error();
        if (parsed.profile && (!parsed.profile.id || typeof parsed.profile.name !== 'string' || !Number.isInteger(parsed.profile.age) || typeof parsed.profile.email !== 'string')) throw new Error();
        if (parsed.profile) {
          text(parsed.profile.name, 120); email(parsed.profile.email);
          if (parsed.profile.age < 18 || parsed.profile.age > 120) throw new Error();
          parsed.profile.verification_method = 'self_attested_browser'; parsed.profile.email_verified = false;
        }
        for (const [id, item] of Object.entries(parsed.items)) {
          const knownRoute = routeFor(id);
          if (!item || item.site_id !== id || !Object.hasOwn(TEXT, item.status)) throw new Error();
          item.url = knownRoute.url; item.name = knownRoute.name; item.domain = knownRoute.domain;
          if (item.mail_contact) item.mail_contact = mailContact(item.mail_contact, id, item.operation_id || item.id, Math.floor(Date.parse(clock()) / 1000), true);
        }
        state = parsed;
        // A browser closed during a write cannot safely establish its outcome.
        let changed = false;
        for (const item of Object.values(state.items)) if (options.recoverInterrupted !== false && item.status === 'running') {
          item.status = 'uncertain'; item.detail = TEXT.uncertain; changed = true;
        }
        if (changed) save();
        return state;
      } catch (error) {
        if (error instanceof WorkspaceError && error.status === 503) throw error;
        state = undefined;
        throw new WorkspaceError('Saved workspace data could not be read. Export or clear this workspace before starting again.', 409);
      }
    }
    function save() {
      try {
        const encoded = JSON.stringify(state);
        storage.setItem(KEY, encoded); cachedRaw = encoded;
      }
      catch (_) { state = undefined; throw new WorkspaceError('Your browser could not save this change. No broker action should start until storage works.', 503); }
    }
    function active() {
      const current = read();
      if (!current.profile) throw new WorkspaceError('Create a workspace on this browser first.', 401);
      return current;
    }
    function event(message) { state.activity.unshift({ at: clock(), message }); state.activity = state.activity.slice(0, 150); }
    function seed() {
      for (const route of routes) if (!state.items[route.id]) state.items[route.id] = {
        id: uuid(), site_id: route.id, name: route.name, domain: route.domain, status: 'ready', detail: TEXT.ready,
        url: route.url, updated_at: clock(), fields: {}, operation_id: null, operation_started_at: null, evidence: null
      };
    }
    function itemFor(id) { active(); routeFor(id); const item = state.items[id]; if (!item) throw new WorkspaceError('Run your route plan first.', 409); return item; }
    function requireCountryRoute(route, item) {
      if (!appliesToCountry(route, state.profile.country) && !operationStarted(item))
        throw new WorkspaceError('This route is outside your selected country. Update your location to choose the applicable routes.', 409);
    }
    function changed(item, status, detail) { item.status = status; item.detail = detail || TEXT[status]; item.updated_at = clock(); }
    function signup(data) {
      read();
      if (state.profile) throw new WorkspaceError('A workspace already exists in this browser. Open it or delete it before creating another.', 409);
      if (data.authorized !== true) throw new WorkspaceError('Authorize requests for your own information first.');
      const name = text(data.name, 120), address = email(data.email), age = data.age;
      if (!Number.isInteger(age) || age < 18 || age > 120) throw new WorkspaceError('Enter an age from 18 to 120.');
      state.profile = { id: uuid(), name, age, email: address, country: null, region: null, city: null,
        verification_method: 'self_attested_browser', email_verified: false, authorized_at: clock(), authorization_statement: AUTHORIZATION };
      state.campaign.status = 'active';
      seed(); event('Workspace saved on this browser. No broker was contacted and email ownership is unverified.'); save();
      return { ok: true };
    }
    function dashboard() {
      active();
      const country = state.profile.country;
      const eligible = routes.filter(route => appliesToCountry(route, country));
      const historical = Object.values(state.items).filter(item => !appliesToCountry(routeFor(item.site_id), country) && operationStarted(item));
      const items = Object.values(state.items).filter(item => appliesToCountry(routeFor(item.site_id), country) || operationStarted(item)).map(({ fields, operation_id, operation_started_at, evidence, mail_contact, ...item }) => ({
        ...item, input_fields: clone(fields || {}), automationLevel: routeFor(item.site_id).automationLevel, fields_needed: routeFor(item.site_id).fields,
        operation_id, evidence: evidence ? clone(evidence) : null,
        mail_contact: mail_contact ? { ...mail_contact, capability: undefined } : null
      }));
      return { mode: 'browser', profile: clone(state.profile), campaign: { status: state.campaign.status,
        authorized_at: state.profile.authorized_at, next_check_at: null, run_in_progress: false },
        counts: { found: 0, requested: items.filter(item => item.evidence && item.evidence.acceptance_verified === true).length, removed: 0,
          blocked: items.filter(item => ['blocked', 'uncertain', 'verification_sent', 'needs_broker_step'].includes(item.status)).length },
        coverage: { country, supportedCountries: [...new Set(routes.flatMap(route => route.countries).filter(value => value !== '*'))].sort(),
          globalRouteCount: eligible.filter(route => route.countries.includes('*')).length,
          countryRouteCount: eligible.filter(route => !route.countries.includes('*')).length,
          companionRouteCount: eligible.filter(route => route.automationLevel === 'companion').length,
          manualRouteCount: eligible.filter(route => route.automationLevel === 'manual').length,
          routeCount: eligible.length, historicalRouteCount: historical.length,
          unplannedRouteCount: eligible.filter(route => !state.items[route.id]).length,
          hasCountryPack: Boolean(country && eligible.some(route => !route.countries.includes('*'))),
          independentDeletionVerification: false },
        items, questions: country ? [] : [{ id: 'country', field: 'country', prompt: 'Which country do you live in? This selects the regional privacy routes. Global portals are available meanwhile.' }],
        activity: clone(state.activity) };
    }
    function setEvidence(id, fields) {
      const route = routeFor(id), item = itemFor(id);
      if (item.operation_id) throw new WorkspaceError('This action has already started. Check its result before changing submitted fields.', 409);
      const approved = approvedFields(route, fields);
      item.fields = { ...item.fields, ...approved }; item.updated_at = clock(); save(); return clone(item.fields);
    }
    function prepare(id) {
      const route = routeFor(id), item = itemFor(id);
      requireCountryRoute(route, item);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before starting a broker action.', 409);
      if (item.operation_id || USER_STATES.has(item.status)) throw new WorkspaceError('This broker action has already started. Refresh its result or finish its broker steps instead of resending.', 409);
      const contact = item.mail_contact ? mailContact(item.mail_contact, id, item.id, Math.floor(Date.parse(clock()) / 1000)) : null;
      const fields = {};
      for (const key of route.fields) {
        const value = key === 'email' ? (contact?.contact_email || state.profile.email) : item.fields[key];
        if (!value) throw new WorkspaceError('Provide the broker’s required ' + key.replace(/_/g, ' ') + ' first.');
        fields[key] = key === 'listing_url' ? listingURL(value, route) : text(value, key === 'email' ? 254 : 120);
      }
      // The route's pre-existing UUID also deduplicates simultaneous tab dispatches.
      item.operation_id = item.id; item.operation_started_at = clock(); changed(item, 'running');
      event('You started the ' + route.name + ' broker action. Its result is not yet established.'); save();
      return { routeId: id, operationId: item.operation_id, fields, authorized: true };
    }
    function mailSessionRequest(id) {
      const route = routeFor(id), item = itemFor(id);
      requireCountryRoute(route, item);
      if (!MAIL_ROUTES.has(id)) throw new WorkspaceError('This broker needs its record-associated email. A removal contact cannot replace it.');
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before choosing a removal contact.', 409);
      if (operationStarted(item)) throw new WorkspaceError('This action has already started. Its contact email cannot be changed.', 409);
      if (!OPERATION.test(item.id)) throw new WorkspaceError('This workspace operation has no valid private reference.', 409);
      if (item.mail_contact && item.mail_contact.expires_at > Math.floor(Date.parse(clock()) / 1000)) throw new WorkspaceError('This operation already has a removal contact.', 409);
      item.mail_contact_authorized_at = clock();
      event('You authorized a dedicated contact address for ' + route.name + '. No broker was contacted.'); save();
      return { route_id: id, operation_id: item.id, authorized: true };
    }
    function bindMailContact(id, response) {
      const item = itemFor(id);
      requireCountryRoute(routeFor(id), item);
      if (state.campaign.status !== 'active' || operationStarted(item)) throw new WorkspaceError('This action is paused or already started. Its contact email cannot be changed.', 409);
      if (!item.mail_contact_authorized_at) throw new WorkspaceError('Explicitly authorize the dedicated contact address first.');
      const contact = mailContact(response, id, item.id, Math.floor(Date.parse(clock()) / 1000));
      if (item.mail_contact && item.mail_contact.expires_at > Math.floor(Date.parse(clock()) / 1000)) throw new WorkspaceError('This operation already has a removal contact.', 409);
      item.mail_contact = contact; item.updated_at = clock();
      event('The dedicated contact address is saved for ' + routeFor(id).name + '. Review it before starting the broker form.'); save();
      return dashboard();
    }
    function clearMailContact(id) {
      const item = itemFor(id);
      if (operationStarted(item)) throw new WorkspaceError('This action has already started. Its contact email cannot be changed.', 409);
      delete item.mail_contact; delete item.mail_contact_authorized_at;
      event('You chose your typed profile email for ' + routeFor(id).name + '. No broker was contacted.'); save();
      return dashboard();
    }
    function mailCheckRequest(id) {
      const item = itemFor(id);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before reading a removal receipt.', 409);
      if (!item.operation_id || !item.mail_contact) throw new WorkspaceError('Start the matching broker action before checking its removal contact.', 409);
      const contact = mailContact(item.mail_contact, id, item.operation_id, Math.floor(Date.parse(clock()) / 1000));
      item.mail_check_authorized_at = clock(); save();
      return { capability: contact.capability, explicit: true };
    }
    function recordMailReceipt(id, result) {
      const item = itemFor(id), now = Math.floor(Date.parse(clock()) / 1000);
      if (!item.mail_contact || !item.operation_id) throw new WorkspaceError('No matching removal contact operation is saved.', 409);
      const contact = mailContact(item.mail_contact, id, item.operation_id, now, true);
      if (!result || result.route_id !== id || result.operation_id !== item.operation_id || result.request_id !== contact.request_id ||
          !['pending', 'held'].includes(result.status) || result.automatic_execution !== false) throw new WorkspaceError('The mailbox result does not match this operation.');
      const receipt = { status: result.status, checked_at: clock(), acceptance_verified: false, deletion_verified: false };
      if (result.status === 'held') {
        if (result.authenticated !== true || !['route_validation_required', 'confirmation_link_unvalidated'].includes(result.reason) ||
            !Number.isSafeInteger(result.received_at) || result.received_at < contact.expires_at - 7 * 86400 || result.received_at > now + 300 ||
            typeof result.receipt_ref !== 'string' || !/^[a-f0-9]{64}$/.test(result.receipt_ref) || typeof result.continuation_available !== 'boolean' ||
            (result.continuation_available && id !== 'usphonebook')) throw new WorkspaceError('The removal receipt could not be validated.');
        Object.assign(receipt, { authenticated: true, reason: result.reason, received_at: result.received_at, receipt_ref: result.receipt_ref,
          continuation_available: result.continuation_available });
        changed(item, 'blocked', result.continuation_available ? 'An authenticated removal email is ready for the reviewed broker confirmation form. Review its required fields before continuing. Deletion is unverified.' : 'An authenticated removal-related email was received. Confirmation is held pending broker-route validation; no link was followed and deletion is unverified.');
      }
      // A later empty check must not erase a previously observed held receipt.
      if (item.mail_receipt?.status !== 'held' || result.status === 'held') item.mail_receipt = receipt;
      event(routeFor(id).name + (result.status === 'held' ? '. A removal email is held for route validation.' : '. No qualifying removal receipt was found in this explicit check.'));
      save(); return dashboard();
    }
    function continuationContext(id) {
      const item = itemFor(id);
      if (id !== 'usphonebook' || state.campaign.status !== 'active' || !item.operation_id || !item.mail_contact ||
          !item.mail_receipt?.authenticated || item.mail_receipt.continuation_available !== true || item.status === 'user_reported_completed')
        throw new WorkspaceError('Choose a current authenticated confirmation for this active operation.', 409);
      const contact = mailContact(item.mail_contact, id, item.operation_id, Math.floor(Date.parse(clock()) / 1000));
      return { item, contact };
    }
    function continuationFields(item, contact, supplied) {
      if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || Object.keys(supplied).length !== 3 ||
          !['city', 'state', 'zip_code'].every(key => Object.hasOwn(supplied, key))) throw new WorkspaceError('Review the city, state and ZIP required by this broker.');
      const city = text(supplied.city, 120), stateCode = text(supplied.state, 2).toUpperCase(), zip = text(supplied.zip_code, 5);
      if (!/^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|AA|AE|AP|AS|FM|GU|MH|MP|PR|PW|VI)$/.test(stateCode) || !/^\d{5}$/.test(zip))
        throw new WorkspaceError('Use a US state abbreviation and your accurate five-digit ZIP code.');
      return { first_name: text(item.fields.first_name, 120), last_name: text(item.fields.last_name, 120), email: contact.contact_email,
        city, state: stateCode, zip_code: zip };
    }
    function mailContinuationRequest(id, supplied) {
      const { item, contact } = continuationContext(id);
      if (item.continuation) throw new WorkspaceError('This confirmation action already started. Check its existing broker tab; no replay is allowed.', 409);
      continuationFields(item, contact, supplied);
      item.continuation_fields = { city: text(supplied.city, 120), state: text(supplied.state, 2).toUpperCase(), zip_code: text(supplied.zip_code, 5) };
      item.mail_continuation_authorized_at = clock(); save();
      return { capability: contact.capability, explicit: true, receipt_ref: item.mail_receipt.receipt_ref };
    }
    function prepareMailContinuation(id, response, reviewedFields) {
      const { item, contact } = continuationContext(id);
      if (!item.mail_continuation_authorized_at || item.continuation) throw new WorkspaceError('This confirmation action is unapproved or already started. No replay is allowed.', 409);
      if (!response || response.status !== 'confirmation_ready' || response.route_id !== id || response.operation_id !== item.operation_id ||
          response.request_id !== contact.request_id || response.receipt_ref !== item.mail_receipt.receipt_ref ||
          response.automatic_execution !== false || !confirmationURL(response.confirmation_url)) throw new WorkspaceError('The confirmation does not match this operation.');
      const fields = continuationFields(item, contact, reviewedFields);
      const authorizedFields = continuationFields(item, contact, item.continuation_fields);
      if (Object.keys(fields).some(key => fields[key] !== authorizedFields[key]))
        throw new WorkspaceError('The confirmation fields changed in another tab. Review them again before continuing.', 409);
      // Persist the uncertain boundary before the private URL leaves this call.
      // The URL itself is transient and must never enter history or a backup.
      item.continuation = { started_at: clock(), receipt_ref: response.receipt_ref, result: 'unknown', acceptance_verified: false, deletion_verified: false };
      changed(item, 'uncertain', 'The confirmation-form action started. Check the existing broker tab before any further action.');
      event('You started the ' + routeFor(id).name + ' confirmation-form action. No request acceptance or deletion was established.'); save();
      return { routeId: id, operationId: item.operation_id, requestId: contact.request_id, receiptRef: response.receipt_ref,
        confirmationUrl: response.confirmation_url, contactEmail: contact.contact_email, fields, authorized: true };
    }
    function recordMailContinuation(id, operationId, result) {
      const item = itemFor(id);
      if (id !== 'usphonebook' || item.operation_id !== operationId || !item.continuation || !result || !['prepared', 'blocked', 'unknown'].includes(result.status))
        throw new WorkspaceError('The confirmation result does not match a started action.', 409);
      if (item.continuation.result !== 'unknown' && item.continuation.result !== result.status) throw new WorkspaceError('The confirmation result is already recorded. No replay was sent.', 409);
      item.continuation.result = result.status; item.continuation.observed_at = clock();
      changed(item, result.status === 'prepared' ? 'needs_broker_step' : result.status === 'blocked' ? 'blocked' : 'uncertain',
        result.status === 'prepared' ? 'The confirmation form was filled. Review its accuracy statement, complete the broker challenge and submit on the broker site. Deletion is unverified.' : undefined);
      event(routeFor(id).name + '. Confirmation form outcome recorded; request acceptance and deletion remain unverified.'); save(); return dashboard();
    }
    function recordCompanion(id, operationId, result) {
      const item = itemFor(id);
      if (!item.operation_id || operationId !== item.operation_id) throw new WorkspaceError('The broker result does not match a started action.', 409);
      if (!result || !RESULT_STATES.has(result.status)) throw new WorkspaceError('The companion returned an unsupported result.');
      if (item.evidence) {
        if (item.evidence.result === result.status) return dashboard();
        if (!['unknown', 'pending', 'error'].includes(item.evidence.result))
        throw new WorkspaceError('A result is already recorded for this operation. No repeat was sent.', 409);
      }
      let status = 'uncertain';
      if (result.status === 'prepared') status = 'needs_broker_step';
      else if (['captcha', 'id_required', 'unsupported', 'blocked'].includes(result.status)) status = 'blocked';
      else if (result.status === 'verification_sent' && result.route_verified === true && result.evidence === 'fresh_visible_success') status = 'verification_sent';
      else if (result.status === 'submitted' && result.route_verified === true && result.evidence === 'fresh_visible_success') status = 'requested';
      item.evidence = { source: 'browser_companion', result: result.status, observed_at: clock(), acceptance_verified: status === 'requested' };
      changed(item, status); event(routeFor(id).name + '. ' + TEXT[status]); save(); return dashboard();
    }
    function recordUser(id, value) {
      if (!USER_STATES.has(value)) throw new WorkspaceError('A user report cannot establish verified deletion.');
      const item = itemFor(id);
      if (!item.operation_id) { item.operation_id = item.id; item.operation_started_at = clock(); }
      changed(item, value); event(routeFor(id).name + '. ' + TEXT[value]); save(); return dashboard();
    }
    function opened(id) {
      const item = itemFor(id);
      requireCountryRoute(routeFor(id), item);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before opening a broker action.', 409);
      if (!item.operation_id && !USER_STATES.has(item.status)) changed(item, 'opened');
      event('You opened the ' + routeFor(id).name + ' official form. No submission was established.'); save(); return dashboard();
    }
    function exportData() { active(); return JSON.stringify({ version: VERSION, exported_at: clock(), profile: clone(state.profile), items: clone(state.items), activity: clone(state.activity) }, null, 2); }
    function importData(raw) {
      read();
      if (state.profile) throw new WorkspaceError('Delete this browser workspace before importing another one.', 409);
      if (typeof raw !== 'string' || raw.length > 500000) throw new WorkspaceError('Choose a valid workspace export smaller than 500 KB.');
      let data;
      try { data = JSON.parse(raw); } catch (_) { throw new WorkspaceError('Invalid workspace export.'); }
      if (!data || data.version !== VERSION || !data.profile || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) throw new WorkspaceError('Invalid workspace export.');
      const forbidden = new Set(['removed', 'verified_removed', 'not_found']);
      const restoredFields = {}, restoredContacts = {};
      for (const [id, item] of Object.entries(data.items)) {
        const route = routeFor(id);
        if (!item || forbidden.has(item.status) || !Object.hasOwn(TEXT, item.status)) throw new WorkspaceError('Imports cannot establish verified removal or listing absence.');
        restoredFields[id] = approvedFields(route, item.fields === undefined ? {} : item.fields);
        if (item.mail_contact) restoredContacts[id] = mailContact(item.mail_contact, id, item.operation_id || item.id, Math.floor(Date.parse(clock()) / 1000), true);
      }
      const input = data.profile;
      const candidate = { name: text(input.name, 120), email: email(input.email), age: input.age, authorized: true };
      if (!Number.isInteger(candidate.age) || candidate.age < 18 || candidate.age > 120) throw new WorkspaceError('Invalid imported age.');
      const restoredLocation = locationFields({ country: input.country, region: input.region, city: input.city });
      // Imported evidence is a user report, never an authenticated companion result.
      state = empty();
      state.profile = { id: uuid(), ...candidate, ...restoredLocation, verification_method: 'self_attested_browser', email_verified: false,
        authorized_at: clock(), authorization_statement: AUTHORIZATION };
      delete state.profile.authorized;
      seed();
      for (const [id, imported] of Object.entries(data.items)) {
        const item = state.items[id];
        item.fields = restoredFields[id];
        if (restoredContacts[id]) {
          item.id = restoredContacts[id].operation_id; item.mail_contact = restoredContacts[id];
          if (imported.mail_receipt && ['held', 'pending'].includes(imported.mail_receipt.status)) item.mail_receipt = {
            status: imported.mail_receipt.status, checked_at: clock(), source: 'imported_user_history', authenticated: false,
            acceptance_verified: false, deletion_verified: false
          };
        }
        if (imported.continuation && typeof imported.continuation.started_at === 'string' && Number.isFinite(Date.parse(imported.continuation.started_at))) {
          item.continuation = { started_at: new Date(imported.continuation.started_at).toISOString(), result: 'unknown',
            acceptance_verified: false, deletion_verified: false, source: 'imported_user_history' };
        }
        if (imported.status === 'opened') changed(item, 'opened');
        else if (imported.status !== 'ready') {
          const report = USER_STATES.has(imported.status) ? imported.status :
            imported.status === 'requested' ? 'user_reported_requested' : 'uncertain';
          changed(item, report, 'Imported history is self-reported. Check the broker outcome before starting another action.');
          // Keep the reference needed to reconcile the same held operation with
          // the companion. Importing its reference does not import its evidence.
          item.operation_id = typeof imported.operation_id === 'string' && /^[a-f0-9-]{32,40}$/.test(imported.operation_id)
            ? imported.operation_id : uuid();
          item.operation_started_at = typeof imported.operation_started_at === 'string' && imported.operation_started_at.length <= 40 && Number.isFinite(Date.parse(imported.operation_started_at))
            ? new Date(imported.operation_started_at).toISOString() : clock();
        }
      }
      event('Workspace imported as self-reported history. No broker was contacted and no deletion was verified.'); save(); return dashboard();
    }
    function remove() {
      try { storage.removeItem(KEY); } catch (_) { throw new WorkspaceError('The browser could not delete this workspace.', 503); }
      state = empty(); cachedRaw = null; return { ok: true };
    }
    function updateProfile(body) {
      active();
      const next = { ...state.profile, ...locationFields(body) };
      state.profile = next; event('Location saved on this browser. No request was started.'); save(); return { ok: true };
    }
    async function api(path, options = {}) {
      try {
        const method = options.method || 'GET';
        let body = {};
        if (options.body) {
          if (typeof options.body !== 'string' || options.body.length > 10000) throw new WorkspaceError('Invalid request.');
          try { body = JSON.parse(options.body); } catch (_) { throw new WorkspaceError('Invalid request.'); }
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new WorkspaceError('Invalid request.');
        }
        let result;
        if (path === '/api/config' && method === 'GET') result = { mode: 'browser', browser_workspace: true, local_only: true, manual: true, synthetic_only: false,
          email_configured: false, automation_configured: true, authorization_statement: AUTHORIZATION };
        else if (path === '/api/signup' && method === 'POST') result = signup(body);
        else if (path === '/api/dashboard' && method === 'GET') result = dashboard();
        else if (path === '/api/profile' && method === 'POST') result = updateProfile(body);
        else if (path === '/api/account' && method === 'DELETE' && body.confirm === true) result = remove();
        else if (path === '/api/campaign' && method === 'POST') {
          active();
          if (!['run', 'pause', 'resume'].includes(body.action)) throw new WorkspaceError('Unknown workspace action.');
          if (body.action === 'pause') state.campaign.status = 'paused';
          else if (body.action === 'resume') state.campaign.status = 'active';
          else if (state.campaign.status === 'active') { seed(); event('Your route plan is ready. Start each broker action explicitly. No broker was contacted.'); }
          save(); result = { ok: true };
        } else if (path === '/api/routes' && method === 'GET') result = clone(routes);
        else if (path === '/api/confirmation' && method === 'POST') { recordUser(body.site_id, 'user_reported_completed'); result = { ok: true }; }
        else throw new WorkspaceError('This browser workspace has no email login or server account.', 404);
        return { ok: true, status: 200, json: async () => clone(result) };
      } catch (error) {
        const status = error instanceof WorkspaceError ? error.status : 503;
        const message = error instanceof WorkspaceError ? error.message : 'Browser workspace storage is unavailable.';
        return { ok: false, status, json: async () => ({ error: message }) };
      }
    }
    return Object.freeze({ api, snapshot: () => clone(read()), profile: () => clone(active().profile), routes: () => clone(routes),
      setEvidence, prepare, mailSessionRequest, bindMailContact, clearMailContact, mailCheckRequest, recordMailReceipt,
      mailContinuationRequest, prepareMailContinuation, recordMailContinuation,
      recordCompanion, recordUser, opened, exportData, importData, remove, dashboard,
      updateRoute: setEvidence, applyCompanionResult: recordCompanion });
  }
  let instance;
  // Default browser mutations share an origin-wide exclusive lock. Read-only
  // access must not persist recovery updates outside that lock.
  const defaults = () => { if (!instance) instance = create({ recoverInterrupted: false }); return instance; };
  async function exclusive(action) {
    const locks = root.navigator?.locks;
    if (!locks || typeof locks.request !== 'function') throw new WorkspaceError('This browser cannot safely coordinate workspace changes. Use a current browser with Web Locks support.', 503);
    return locks.request(KEY + '-write', { mode: 'exclusive' }, action);
  }
  const mutators = new Set(['setEvidence', 'prepare', 'mailSessionRequest', 'bindMailContact', 'clearMailContact', 'mailCheckRequest', 'recordMailReceipt', 'mailContinuationRequest', 'prepareMailContinuation', 'recordMailContinuation', 'recordCompanion', 'recordUser', 'opened', 'importData', 'remove', 'updateRoute', 'applyCompanionResult']);
  const exported = { create, KEY, AUTHORIZATION, WorkspaceError, routes: () => clone(routes), listingURL };
  for (const name of ['snapshot', 'profile', 'setEvidence', 'prepare', 'mailSessionRequest', 'bindMailContact', 'clearMailContact', 'mailCheckRequest', 'recordMailReceipt', 'mailContinuationRequest', 'prepareMailContinuation', 'recordMailContinuation', 'recordCompanion', 'recordUser', 'opened', 'exportData', 'importData', 'remove', 'dashboard', 'updateRoute', 'applyCompanionResult']) {
    exported[name] = (...args) => mutators.has(name) ? exclusive(() => defaults()[name](...args)) : defaults()[name](...args);
  }
  exported.api = async (...args) => {
    try { return await exclusive(() => defaults().api(...args)); }
    catch (error) {
      return { ok: false, status: error instanceof WorkspaceError ? error.status : 503,
        json: async () => ({ error: error instanceof WorkspaceError ? error.message : 'Browser workspace coordination is unavailable.' }) };
    }
  };
  return Object.freeze(exported);
});
