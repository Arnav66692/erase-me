/* One approved pass to prepare dedicated contact addresses. No broker actions. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseContactSetup = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const ROUTES = new Set(['fastpeoplesearch', 'usphonebook']);
  const STARTED = new Set(['running', 'verification_sent', 'requested', 'uncertain', 'needs_broker_step', 'user_reported_requested', 'user_reported_completed']);
  const OPERATION = /^[a-f0-9-]{32,40}$/;
  const copy = value => JSON.parse(JSON.stringify(value));
  const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
  const same = (left, right) => JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));

  function create({ workspace, mail, onUpdate = () => {} }) {
    let running = false, stopping = false, used = false;
    let state = { status: 'idle', entries: [], current: null, detail: '' };
    const snapshot = () => copy(state);
    const emit = () => { try { onUpdate(snapshot()); } catch (_) { /* Observers cannot restart or repeat an action. */ } };
    const stop = () => { if (running) stopping = true; };
    function context(dashboard, routeId) {
      const item = dashboard?.items?.find(item => item.site_id === routeId);
      if (!dashboard?.profile || dashboard.campaign?.status !== 'active' || !item || item.held === true || item.status === 'held' ||
          item.operation_id || STARTED.has(item.status) || typeof item.id !== 'string' || !OPERATION.test(item.id)) return null;
      const route = workspace.routes().find(route => route.id === routeId);
      if (!route || !Array.isArray(route.countries) || !route.countries.some(country => country === '*' || country === dashboard.profile.country)) return null;
      return copy({ profile: dashboard.profile, id: item.id, status: item.status, fields: item.input_fields || {},
        affirmations: item.affirmations || {}, contact: item.mail_contact || null });
    }
    function stillReviewed(routeId, approved) {
      try { const current = context(workspace.dashboard(), routeId); return current !== null && same(current, approved); }
      catch (_) { return false; }
    }
    async function prepare(routeIds, options = {}) {
      if (running) throw new Error('Contact setup is already running.');
      if (used) throw new Error('This contact setup already finished or stopped. Review a new setup before continuing.');
      if (options?.authorized !== true) throw new Error('Authorize the selected removal-only contacts first.');
      if (!Array.isArray(routeIds) || !routeIds.length || routeIds.length > ROUTES.size || new Set(routeIds).size !== routeIds.length ||
          routeIds.some(id => typeof id !== 'string' || !ROUTES.has(id))) throw new Error('Select each supported removal-only contact route once.');
      if (typeof options.operatorKey !== 'string' || !/^[a-fA-F0-9]{64}$/.test(options.operatorKey))
        throw new Error('Enter the private removal-mail operator key for this setup.');
      const queue = [...routeIds];
      let approved;
      try {
        const dashboard = workspace.dashboard();
        approved = new Map(queue.map(routeId => [routeId, context(dashboard, routeId)]));
        if ([...approved.values()].some(value => value === null)) throw new Error();
      } catch (_) { throw new Error('A selected contact route is paused, held, already started or outside this workspace. Review the selection again.'); }
      let key = options.operatorKey; options = null;
      used = true; running = true; stopping = false;
      state = { status: 'running', entries: queue.map(routeId => ({ routeId, status: 'queued', detail: 'Waiting for this contact setup.' })), current: null, detail: '' };
      try {
        emit();
        for (const [index, routeId] of queue.entries()) {
          if (stopping) break;
          const entry = state.entries[index], review = approved.get(routeId);
          if (!stillReviewed(routeId, review)) {
            entry.status = 'blocked'; entry.detail = 'The reviewed workspace or route changed. No contact request started.'; stopping = true; break;
          }
          if (review.contact) {
            entry.status = 'existing'; entry.detail = 'The existing contact was kept. No new address was requested.'; emit(); continue;
          }
          state.current = routeId; entry.status = 'running'; entry.detail = 'Preparing this route’s dedicated contact address.'; emit();
          if (stopping) break;
          let request;
          try { request = await workspace.mailSessionRequest(routeId); }
          catch (_) { entry.status = 'blocked'; entry.detail = 'Contact authorization could not be saved. No contact address was requested.'; stopping = true; break; }
          if (stopping) { entry.status = 'not_started'; entry.detail = 'Stopped before requesting a contact address.'; break; }
          if (!stillReviewed(routeId, review) || !request || typeof request !== 'object' || Array.isArray(request) ||
              Object.keys(request).length !== 3 || !['route_id', 'operation_id', 'authorized'].every(field => Object.hasOwn(request, field)) ||
              request.route_id !== routeId || request.operation_id !== review.id || request.authorized !== true) {
            entry.status = 'blocked'; entry.detail = 'The reviewed contact authorization changed. No address was requested.'; stopping = true; break;
          }
          let response;
          try { response = await mail.session(request, key); }
          catch (_) { entry.status = 'unknown'; entry.detail = 'The contact request outcome is unknown. No retry or broker action was started.'; stopping = true; break; }
          if (stopping || !stillReviewed(routeId, review)) {
            entry.status = 'unknown'; entry.detail = 'The contact request finished after the session stopped or changed. Its result was not bound or used.'; stopping = true; break;
          }
          try { await workspace.bindMailContact(routeId, response); }
          catch (_) { entry.status = 'unknown'; entry.detail = 'The contact result could not be saved. Review the workspace before requesting another address.'; stopping = true; break; }
          let bound;
          try { bound = context(workspace.dashboard(), routeId); } catch (_) { bound = null; }
          if (!bound || !same({ ...bound, contact: null }, { ...review, contact: null }) || !bound.contact ||
              !['request_id', 'route_id', 'operation_id', 'contact_email', 'expires_at'].every(field => bound.contact[field] === response[field])) {
            entry.status = 'unknown'; entry.detail = 'The workspace changed while saving this contact. Review the saved route before continuing.'; stopping = true; break;
          }
          entry.status = 'ready'; entry.detail = 'The contact is saved. Review its exact address and broker fields before starting forms.'; emit();
          // A completed binding changes only this route. Later routes must still
          // match the values captured before the first asynchronous boundary.
        }
      } finally {
        key = '';
        for (const entry of state.entries) if (entry.status === 'queued' || entry.status === 'running') {
          entry.status = 'not_started'; entry.detail = 'Not started. A new review is required.';
        }
        state.current = null; state.status = stopping ? 'stopped' : 'finished'; running = false; emit();
      }
      return snapshot();
    }
    return Object.freeze({ prepare, stop, snapshot });
  }
  return Object.freeze({ create });
});
