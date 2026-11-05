/* Browser-only privacy workspace. Personal data is never sent to the hosting API. */
(function (root, factory) {
  const routes = typeof module === 'object' && module.exports ? require('./broker-routes.js') : root.EraseBrokerRoutes;
  const api = factory(root, routes);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseWorkspace = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root, routes) {
  'use strict';
  const KEY = 'erase-me-workspace-v1';
  const VERSION = 1;
  const AUTHORIZATION = 'I request removal of my own information. I authorize only the broker actions I explicitly start using the fields shown. My email is self-reported. I will complete broker verification myself. No inbox access, ID uploads, account deletions or recurring checks are authorized.';
  const USER_STATES = new Set(['user_reported_requested', 'user_reported_completed']);
  const RESULT_STATES = new Set(['prepared', 'verification_sent', 'submitted', 'captcha', 'id_required', 'unsupported', 'pending', 'unknown', 'error', 'blocked']);
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
    const result = text(value, 254).toLowerCase();
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(result)) throw new WorkspaceError('Enter a valid email address.');
    return result;
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
        }
        state = parsed;
        // A browser closed during a write cannot safely establish its outcome.
        let changed = false;
        for (const item of Object.values(state.items)) if (item.status === 'running') {
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
      const items = Object.values(state.items).map(({ fields, operation_id, operation_started_at, evidence, ...item }) => ({
        ...item, input_fields: clone(fields || {}), automationLevel: routeFor(item.site_id).automationLevel, fields_needed: routeFor(item.site_id).fields,
        operation_id, evidence: evidence ? clone(evidence) : null
      }));
      return { mode: 'browser', profile: clone(state.profile), campaign: { status: state.campaign.status,
        authorized_at: state.profile.authorized_at, next_check_at: null, run_in_progress: false },
        counts: { found: 0, requested: items.filter(item => item.evidence && item.evidence.acceptance_verified === true).length, removed: 0,
          blocked: items.filter(item => ['blocked', 'uncertain', 'verification_sent'].includes(item.status)).length },
        items, questions: [], activity: clone(state.activity) };
    }
    function setEvidence(id, fields) {
      const route = routeFor(id), item = itemFor(id);
      if (item.operation_id) throw new WorkspaceError('This action has already started. Check its result before changing submitted fields.', 409);
      const approved = approvedFields(route, fields);
      item.fields = { ...item.fields, ...approved }; item.updated_at = clock(); save(); return clone(item.fields);
    }
    function prepare(id) {
      const route = routeFor(id), item = itemFor(id);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before starting a broker action.', 409);
      if (item.operation_id || USER_STATES.has(item.status)) throw new WorkspaceError('This broker action has already started. Refresh its result or finish its broker steps instead of resending.', 409);
      const fields = {};
      for (const key of route.fields) {
        const value = key === 'email' ? state.profile.email : item.fields[key];
        if (!value) throw new WorkspaceError('Provide the broker’s required ' + key.replace(/_/g, ' ') + ' first.');
        fields[key] = key === 'listing_url' ? listingURL(value, route) : text(value, key === 'email' ? 254 : 120);
      }
      // The route's pre-existing UUID also deduplicates simultaneous tab dispatches.
      item.operation_id = item.id; item.operation_started_at = clock(); changed(item, 'running');
      event('You started the ' + route.name + ' broker action. Its result is not yet established.'); save();
      return { routeId: id, operationId: item.operation_id, fields, authorized: true };
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
      const restoredFields = {};
      for (const [id, item] of Object.entries(data.items)) {
        const route = routeFor(id);
        if (!item || forbidden.has(item.status) || !Object.hasOwn(TEXT, item.status)) throw new WorkspaceError('Imports cannot establish verified removal or listing absence.');
        restoredFields[id] = approvedFields(route, item.fields === undefined ? {} : item.fields);
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
        if (imported.status === 'opened') changed(item, 'opened');
        else if (imported.status !== 'ready') {
          const report = USER_STATES.has(imported.status) ? imported.status :
            imported.status === 'requested' ? 'user_reported_requested' : 'uncertain';
          changed(item, report, 'Imported history is self-reported. Check the broker outcome before starting another action.');
          item.operation_id = uuid(); item.operation_started_at = clock();
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
      setEvidence, prepare, recordCompanion, recordUser, opened, exportData, importData, remove, dashboard,
      updateRoute: setEvidence, applyCompanionResult: recordCompanion });
  }
  let instance;
  const defaults = () => { if (!instance) instance = create(); return instance; };
  const exported = { create, KEY, AUTHORIZATION, WorkspaceError, routes: () => clone(routes), listingURL };
  for (const name of ['api', 'snapshot', 'profile', 'setEvidence', 'prepare', 'recordCompanion', 'recordUser', 'opened', 'exportData', 'importData', 'remove', 'dashboard', 'updateRoute', 'applyCompanionResult']) exported[name] = (...args) => defaults()[name](...args);
  return Object.freeze(exported);
});
