/* An explicit, memory-only fill queue. Reloading never resumes a batch. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseFormBatch = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  function create({ workspace, companion, onUpdate = () => {} }) {
    let running = false, stopping = false;
    let state = { status: 'idle', entries: [], current: null, detail: '' };
    const snapshot = () => copy(state);
    const emit = () => onUpdate(snapshot());
    const stop = () => { if (running) stopping = true; };
    async function run(previews, { authorized = false } = {}) {
      if (running) throw new Error('A form batch is already running.');
      if (authorized !== true) throw new Error('Review and authorize the selected forms first.');
      const routes = workspace.routes();
      if (!Array.isArray(previews) || !previews.length || previews.length > routes.length)
        throw new Error('Select at least one reviewed form.');
      const seen = new Set();
      for (const preview of previews) {
        const route = routes.find(route => route.id === preview?.routeId);
        if (!route || route.automationLevel !== 'companion' || seen.has(route.id))
          throw new Error('Select each supported form only once.');
        seen.add(route.id);
      }
      // Freeze the approved values before the first asynchronous boundary.
      const queue = copy(previews);
      running = true; stopping = false;
      state = { status: 'running', current: null, detail: '',
        entries: queue.map(preview => ({ routeId: preview.routeId, status: 'queued', detail: 'Waiting for this batch.' })) };
      try {
        emit();
        const ping = await companion({ action: 'ping' });
        for (const preview of queue) {
          const route = routes.find(route => route.id === preview.routeId);
          if (!Array.isArray(ping?.routes) || !ping.routes.includes(route.id))
            throw new Error('Enable companion access to every selected broker, then review the batch again. No form was started.');
          const capability = route.requiredAffirmations.includes('own_request') ? 'structured-fields-v1' :
            ['apollo', 'spokeo'].includes(route.id) ? 'explicit-fields-v1' : null;
          if (capability && !ping.capabilities?.includes(capability))
            throw new Error('Update the companion before using these forms. No form was started.');
        }
        for (const [index, preview] of queue.entries()) {
          if (stopping) break;
          const entry = state.entries[index];
          state.current = preview.routeId; entry.status = 'running'; entry.detail = 'Checking the approved fields before filling.'; emit();
          let operation;
          try { operation = await workspace.prepareReviewed(preview); }
          catch (error) {
            entry.status = 'failed'; entry.detail = error.message || 'Review this form again before starting.';
            stopping = true; break;
          }
          let result;
          try { result = await companion({ action: 'run', ...operation }); }
          catch (_) { result = { status: 'unknown', detail: 'The companion connection was interrupted. Check the existing broker tab; no repeat was sent.' }; }
          if (!result || !['prepared', 'verification_sent', 'blocked', 'unknown'].includes(result.status) ||
              result.status === 'verification_sent' && !(result.route_verified === true && result.evidence === 'fresh_visible_success'))
            result = { status: 'unknown', detail: 'The broker result could not be verified. Check its existing tab before doing anything further.' };
          try { await workspace.recordCompanion(preview.routeId, operation.operationId, result); }
          catch (_) {
            entry.status = 'unknown'; entry.detail = 'The form may have been filled, but its result could not be saved. Check the existing broker tab. No repeat will be sent.';
            stopping = true; break;
          }
          entry.status = result.status;
          entry.detail = String(result.detail || (result.status === 'prepared' ? 'Fields filled. Complete the remaining broker steps.' : 'Review this broker’s remaining steps.')).slice(0, 600);
          emit();
          if (result.status === 'unknown') { stopping = true; break; }
        }
      } catch (error) {
        stopping = true;
        state.detail = error.message || 'The form batch could not continue. Review it before starting again.';
      } finally {
        for (const entry of state.entries) if (entry.status === 'queued') {
          entry.status = 'not_started'; entry.detail = 'Not started. A new review is required.';
        }
        state.current = null; state.status = stopping ? 'stopped' : 'finished';
        running = false; emit();
      }
      return snapshot();
    }
    return Object.freeze({ run, stop, isRunning: () => running, snapshot });
  }
  return Object.freeze({ create });
});
