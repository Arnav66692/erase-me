/* Explicit, same-origin receipt relay. No inbox credentials or profile fields. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseRemovalMail = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';
  const ROUTES = new Set(['usphonebook', 'searchpeoplefree', 'fastpeoplesearch']);
  const NEW_CONTACT_ROUTES = new Set(['usphonebook', 'fastpeoplesearch']);
  const OPERATION = /^[a-f0-9-]{32,40}$/;
  const CAPABILITY = /^[A-Za-z0-9_-]{1,1800}\.[A-Za-z0-9_-]{43}$/;
  class RelayError extends Error {}
  function object(value, keys) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  }
  function continuationURL(value) {
    try {
      if (typeof value !== 'string' || value.length > 2048 || /\s/.test(value)) return false;
      const u = new URL(value), entries = [...u.searchParams], key = u.searchParams.get('key');
      return u.protocol === 'https:' && u.hostname === 'www.usphonebook.com' && !u.port && !u.username && !u.password && !u.hash &&
        u.pathname === '/removal/validate-record-info' && entries.length === 2 && u.searchParams.getAll('key').length === 1 &&
        typeof key === 'string' && key.length <= 512 && /^[A-Za-z0-9_-]+={0,2}$/.test(key) &&
        u.searchParams.getAll('ticketid').length === 1 && /^[0-9]{1,32}$/.test(u.searchParams.get('ticketid'));
    } catch (_) { return false; }
  }
  function create(options = {}) {
    const fetcher = options.fetch || ((...args) => root.fetch(...args));
    const location = options.location || root.location;
    async function request(action, body, pilotKey) {
      let origin;
      try {
        origin = new URL(location.origin);
        if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error();
      } catch (_) { throw new Error('Removal-mail checks require the secure HTTPS workspace.'); }
      const headers = { Accept: 'application/json' };
      if (body) {
        if (typeof pilotKey !== 'string' || !/^[a-fA-F0-9]{64}$/.test(pilotKey)) throw new Error('A private operator pilot key is required. It is not saved by Erase Me.');
        headers['Content-Type'] = 'application/json'; headers['X-Erase-Me'] = '1'; headers['X-Erase-Mail-Key'] = pilotKey;
      }
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
      let response, value;
      try {
        response = await fetcher('/api/removal-mail/' + action, { method: body ? 'POST' : 'GET', headers,
          ...(body ? { body: JSON.stringify(body) } : {}), credentials: 'omit', mode: 'same-origin', redirect: 'error',
          cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal });
        if (!response.ok) {
          if (response.status === 410) throw new RelayError('This removal contact has expired. No request was repeated.');
          if (response.status === 403) throw new RelayError('Private operator pilot authorization is required.');
          if (response.status === 503) throw new RelayError('The dedicated removal mailbox is not connected or enabled for the private pilot.');
          throw new RelayError('The dedicated mailbox request could not be completed.');
        }
        const raw = await response.text();
        if (raw.length > 8192) throw new RelayError('The dedicated mailbox returned an invalid result.');
        try { value = JSON.parse(raw); } catch (_) { throw new RelayError('The dedicated mailbox returned an invalid result.'); }
      } catch (error) {
        if (error instanceof RelayError) throw error;
        throw new Error('The dedicated mailbox is unavailable. No broker action was repeated.');
      } finally { clearTimeout(timeout); }
      return value;
    }
    async function status() {
      const value = await request('status');
      if (!object(value, ['configured', 'enabled', 'provider', 'on_demand', 'automatic_execution', 'access', 'authorization_required']) ||
          typeof value.configured !== 'boolean' || typeof value.enabled !== 'boolean' || value.provider !== 'gmail' ||
          value.on_demand !== true || value.automatic_execution !== false || value.access !== 'private_pilot' || value.authorization_required !== true ||
          (value.enabled && !value.configured)) throw new Error('The dedicated mailbox returned an invalid configuration.');
      return value;
    }
    async function session(body, pilotKey) {
      if (!object(body, ['route_id', 'operation_id', 'authorized']) || !NEW_CONTACT_ROUTES.has(body.route_id) ||
          typeof body.operation_id !== 'string' || !OPERATION.test(body.operation_id) || body.authorized !== true) throw new Error('Authorize a supported removal contact operation first.');
      const value = await request('session', body, pilotKey);
      if (!object(value, ['status', 'capability', 'request_id', 'route_id', 'operation_id', 'contact_email', 'expires_at', 'automatic_execution']) ||
          value.status !== 'ready' || value.automatic_execution !== false || value.route_id !== body.route_id || value.operation_id !== body.operation_id ||
          typeof value.capability !== 'string' || !CAPABILITY.test(value.capability) || !/^[a-f0-9]{32}$/.test(value.request_id) ||
          typeof value.contact_email !== 'string' || value.contact_email.length > 254 || !Number.isSafeInteger(value.expires_at)) throw new Error('The dedicated mailbox returned an invalid contact.');
      return value;
    }
    async function check(body, pilotKey) {
      if (!object(body, ['capability', 'explicit']) || typeof body.capability !== 'string' || !CAPABILITY.test(body.capability) || body.explicit !== true) throw new Error('Choose an explicit check for a saved removal contact.');
      const value = await request('check', body, pilotKey);
      const base = ['status', 'request_id', 'route_id', 'operation_id', 'automatic_execution'];
      const keys = value?.status === 'held' ? [...base, 'reason', 'received_at', 'authenticated', 'receipt_ref', 'continuation_available'] : base;
      if (!object(value, keys) || !['pending', 'held'].includes(value.status) || !ROUTES.has(value.route_id) ||
          typeof value.operation_id !== 'string' || !OPERATION.test(value.operation_id) || !/^[a-f0-9]{32}$/.test(value.request_id) || value.automatic_execution !== false ||
          (value.status === 'held' && (value.authenticated !== true || !['route_validation_required', 'confirmation_link_unvalidated'].includes(value.reason) ||
            !Number.isSafeInteger(value.received_at) || !/^[a-f0-9]{64}$/.test(value.receipt_ref) || typeof value.continuation_available !== 'boolean' ||
            (value.continuation_available && value.route_id !== 'usphonebook')))) throw new Error('The dedicated mailbox returned an invalid receipt.');
      return value;
    }
    async function continuation(body, pilotKey) {
      if (!object(body, ['capability', 'explicit', 'receipt_ref']) || typeof body.capability !== 'string' || !CAPABILITY.test(body.capability) ||
          body.explicit !== true || !/^[a-f0-9]{64}$/.test(body.receipt_ref)) throw new Error('Choose a verified confirmation for this operation.');
      const value = await request('continue', body, pilotKey);
      if (!object(value, ['status', 'request_id', 'route_id', 'operation_id', 'receipt_ref', 'confirmation_url', 'automatic_execution']) ||
          value.status !== 'confirmation_ready' || value.route_id !== 'usphonebook' || value.receipt_ref !== body.receipt_ref ||
          typeof value.operation_id !== 'string' || !OPERATION.test(value.operation_id) || !/^[a-f0-9]{32}$/.test(value.request_id) ||
          value.automatic_execution !== false || !continuationURL(value.confirmation_url)) throw new Error('The broker confirmation could not be validated.');
      return value;
    }
    return Object.freeze({ status, session, check, continuation });
  }
  let instance;
  const defaults = () => instance || (instance = create());
  return Object.freeze({ create, continuationURL, status: () => defaults().status(), session: (...args) => defaults().session(...args), check: (...args) => defaults().check(...args), continuation: (...args) => defaults().continuation(...args) });
});
