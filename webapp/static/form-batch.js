/* An explicit, memory-only fill queue. Reloading never resumes a batch. */
(function (root, factory) {
  const automatic = typeof module === 'object' && module.exports ? require('../../extension/automatic-executor.js') : root.EraseAutomaticExecutor;
  const api = factory(automatic);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseFormBatch = api;
})(typeof globalThis === 'object' ? globalThis : this, function (automatic) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  function create({ workspace, companion, onUpdate = () => {}, afterResult, afterForms }) {
    let running = false, stopping = false;
    let state = { status: 'idle', entries: [], current: null, detail: '' };
    const snapshot = () => copy(state);
    const emit = () => onUpdate(snapshot());
    const stop = () => { if (running) stopping = true; };
    async function run(previews, { authorized = false, automate = false } = {}) {
      if (running) throw new Error('A form batch is already running.');
      if (authorized !== true) throw new Error('Review and authorize the selected forms first.');
      if (typeof automate !== 'boolean') throw new Error('Choose whether to automate the reviewed submission steps.');
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
      const completed = [];
      let recordedCount = 0;
      running = true; stopping = false;
      state = { status: 'running', current: null, detail: '',
        entries: queue.map(preview => ({ routeId: preview.routeId, status: 'queued', detail: 'Waiting for this batch.' })) };
      try {
        emit();
        const ping = await companion({ action: 'ping' });
        if(automate && !ping?.capabilities?.includes('automatic-submit-v1'))throw new Error('Update the companion before automating reviewed submissions. No form was started.');
        for (const preview of queue) {
          const route = routes.find(route => route.id === preview.routeId);
          if (!Array.isArray(ping?.routes) || !ping.routes.includes(route.id))
            throw new Error('Enable companion access to every selected broker, then review the batch again. No form was started.');
          const capability = route.id === 'whitepages' ? 'whitepages-prefill-v1' : route.requiredAffirmations.includes('own_request') ? 'structured-fields-v1' :
            ['apollo', 'spokeo'].includes(route.id) ? 'explicit-fields-v1' : null;
          if (capability && !ping.capabilities?.includes(capability))
            throw new Error('Update the companion before using these forms. No form was started.');
          const submitContract = automate ? automatic?.CONTRACTS?.[route.id] : null;
          if (submitContract?.requiredCapability && !ping.capabilities?.includes(submitContract.requiredCapability))
            throw new Error('Update the companion before using these reviewed submissions. No form was started.');
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
          const contract = automate ? automatic?.CONTRACTS?.[preview.routeId] : null;
          try { result = await companion({ action: 'run', ...operation, ...(contract ? {autoSubmit:true,consentId:contract.id} : {}) }); }
          catch (_) { result = { status: 'unknown', detail: 'The companion connection was interrupted. Check the existing broker tab; no repeat was sent.' }; }
          if (!result || !['prepared', 'verification_sent', 'submission_attempted', 'blocked', 'unknown'].includes(result.status) ||
              result.status === 'submission_attempted' && !(contract && result.attempt_verified === true && result.stage === contract.stage) ||
              result.status === 'verification_sent' && !(result.route_verified === true && result.evidence === 'fresh_visible_success'))
            result = { status: 'unknown', detail: 'The broker result could not be verified. Check its existing tab before doing anything further.' };
          try { await workspace.recordCompanion(preview.routeId, operation.operationId, result); }
          catch (_) {
            entry.status = 'unknown'; entry.detail = 'The form may have been filled, but its result could not be saved. Check the existing broker tab. No repeat will be sent.';
            stopping = true; break;
          }
          entry.status = result.status;
          entry.detail = String(result.detail || (result.status === 'prepared' ? 'Fields filled. Complete the remaining broker steps.' : 'Review this broker’s remaining steps.')).slice(0, 600);
          recordedCount++;
          if (result.status === 'verification_sent') completed.push({ routeId: preview.routeId, operationId: operation.operationId,
            result: { status: result.status, route_verified: true, evidence: 'fresh_visible_success' } });
          if (result.status === 'submission_attempted') completed.push({ routeId: preview.routeId, operationId: operation.operationId,
            result: { status: result.status, attempt_verified: true, stage: contract.stage } });
          emit();
          if (result.status === 'unknown') { stopping = true; break; }
          if(!stopping && afterResult && ['verification_sent','submission_attempted'].includes(result.status)){
            try{
              const followup=await afterResult({routeId:preview.routeId,operationId:operation.operationId,result,isStopped:()=>stopping});
              if(followup?.detail){entry.detail+=' '+String(followup.detail).slice(0,600);emit();}
              if(followup?.status==='unknown'){stopping=true;break;}
            }catch(_){entry.detail+=' The removal-mail step could not be completed. Check the existing operation before continuing.';stopping=true;break;}
          }
        }
        // One optional foreground pass runs only after the entire approved queue
        // has durable outcomes. It never resumes a stopped or uncertain batch.
        if (!stopping && recordedCount === queue.length && afterForms) {
          state.current = null; state.detail = 'Checking the approved final session steps.'; emit();
          if (!stopping) {
            try {
              const followup = await afterForms({ entries: copy(completed), isStopped: () => stopping });
              state.detail = followup?.detail ? String(followup.detail).slice(0, 600) : '';
              if (followup?.status === 'unknown') stopping = true;
            } catch (_) {
              state.detail = 'The final session step could not be completed. Check the existing operations before continuing.';
              stopping = true;
            }
          } else state.detail = 'The final session step was not started.';
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
