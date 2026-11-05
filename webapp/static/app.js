'use strict';

(() => {
  const $ = id => document.getElementById(id);
  let config = null;
  let dashboard = null;
  let pendingEmail = '';
  let pendingChallenge = '';
  let pendingFlow = 'login';
  let filter = 'all';
  let pollTimer = null;
  let loadingDashboard = false;
  let locationOpen = false;
  let sessionGeneration = 0;

  const statusLabels = {
    ready: 'Ready to start', opened: 'Form opened', uncertain: 'Check broker outcome', verification_sent: 'Finish broker verification',
    user_reported_requested: 'You reported submitting', user_reported_completed: 'You reported completing',
    planned: 'Queued', queued: 'Queued', scanning: 'Checking', found: 'Match found',
    requested: 'Requested', submitted: 'Requested', pending: 'In progress',
    awaiting_confirmation: 'Confirming', confirmation_pending: 'Confirming',
    confirmed: 'Confirmation sent', removed: 'Removal verified', not_found: 'Not found',
    blocked: 'Blocked', needs_human: 'Needs attention', needs_info: 'Needs detail',
    ambiguous: 'Uncertain match', skipped: 'Skipped', rejected: 'Declined',
    relisted: 'Listed again', failed: 'Needs attention', error: 'Needs attention',
    submitting: 'Sending request', checking: 'Checking', verifying: 'Verifying',
    waiting: 'Waiting', retry: 'Retry scheduled', confirming: 'Confirming',
    awaiting_integration: 'Setup needed', clarification: 'Needs detail',
    delivery_failed: 'Email not delivered', acknowledged: 'Receipt acknowledged',
    broker_reported_completed: 'Broker reports completion',
    needs_broker_step: 'Complete broker steps', unverified: 'Completion not verified'
  };
  const attentionStatuses = new Set(['verification_sent', 'uncertain', 'blocked', 'needs_human', 'needs_info', 'ambiguous', 'rejected', 'failed', 'error', 'awaiting_integration', 'clarification', 'delivery_failed', 'needs_broker_step']);
  const completeStatuses = new Set(['removed', 'not_found', 'skipped']);
  const manualMode = () => config?.manual ?? (config?.mode !== 'demo');

  function show(element, visible = true) { element.hidden = !visible; }
  function setText(id, value) { $(id).textContent = value == null ? '' : String(value); }
  function errorAt(id, message) { setText(id, message); show($(id), Boolean(message)); }
  function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value != null) element.textContent = String(value);
    return element;
  }
  async function api(path, options = {}) {
    let response;
    if (document.documentElement?.dataset?.browserWorkspace === 'true' && typeof EraseWorkspace === 'undefined') {
      throw new Error('Workspace components did not load. Refresh this page before entering details.');
    }
    try {
      response = await (typeof EraseWorkspace !== 'undefined' ? EraseWorkspace.api : fetch)(path, {
        credentials: 'same-origin', cache: 'no-store', ...options,
        headers: { 'Content-Type': 'application/json', 'X-Erase-Me': '1', ...options.headers }
      });
    } catch (_) {
      throw new Error('We couldn’t reach the service. Check your connection and try again.');
    }
    let data;
    try { data = await response.json(); } catch (_) { data = {}; }
    if (!response.ok) {
      const error = new Error(data.error || 'That request didn’t finish. Please try again.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
  async function busy(button, callback) {
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try { await callback(); }
    finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      if (button.id === 'run-button' && dashboard) renderRunControl();
    }
  }
  function onboarding(panel) {
    for (const id of ['signup-panel', 'login-panel', 'verification-panel']) show($(id), id === panel);
    errorAt('page-error', '');
  }
  function stopPolling() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null; }
  function signedOut() {
    sessionGeneration += 1;
    dashboard = null;
    stopPolling();
    show($('dashboard-view'), false);
    show($('welcome-view'));
    show($('logout-button'), false);
    onboarding(config?.local_only ? 'signup-panel' : 'login-panel');
  }
  function verifyStep(email, result, flow = 'login') {
    pendingEmail = email;
    pendingFlow = flow;
    pendingChallenge = result.challenge_id || '';
    setText('verification-email', email);
    $('verification-code').value = '';
    errorAt('verification-error', '');
    onboarding('verification-panel');
    const isDemoCode = config && config.mode === 'demo' && result.demo_code;
    show($('demo-code-notice'), Boolean(isDemoCode));
    setText('demo-code', isDemoCode || '');
    $('verification-code').focus();
  }
  function dateLabel(value, withTime = false) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      month: 'short', day: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {})
    });
  }
  function safeURL(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }
  function statusPill(status) {
    const tone = attentionStatuses.has(status) ? ' attention' : (status === 'removed' ? '' : ' neutral');
    return node('span', 'status-pill' + tone, statusLabels[status] || 'In progress');
  }
  function renderListings() {
    const items = Array.isArray(dashboard.items) ? dashboard.items : [];
    const selected = items.filter(item => filter === 'all' || (filter === 'removed' && item.status === 'removed') ||
      (filter === 'blocked' && attentionStatuses.has(item.status)) ||
      (filter === 'pending' && !completeStatuses.has(item.status) && !attentionStatuses.has(item.status)));
    const fragment = document.createDocumentFragment();
    for (const item of selected) {
      const row = node('article', 'listing-item');
      const icon = node('span', 'site-icon', (item.name || 'Site').slice(0, 1));
      icon.setAttribute('aria-hidden', 'true');
      row.append(icon);
      const info = node('div', 'listing-info');
      const url = safeURL(item.url);
      const title = node(url ? 'a' : 'span', 'listing-title', item.name || item.domain || 'Site');
      if (url) { title.href = url; title.target = '_blank'; title.rel = 'noopener noreferrer'; title.setAttribute('aria-label', `${item.name || 'Site'} — open ${item.status === 'needs_broker_step' ? 'broker portal' : 'listing'} in a new tab`); }
      info.append(title, node('p', 'listing-domain', item.domain || ''));
      if (item.detail) info.append(node('p', 'listing-detail', item.detail));
      if (config?.local_only && !config?.browser_workspace && ['awaiting_confirmation', 'needs_broker_step'].includes(item.status) && typeof item.site_id === 'string') {
        const brokerSteps = item.status === 'needs_broker_step';
        if (brokerSteps) info.append(node('p', 'listing-detail', 'Open the broker email and finish the portal steps before recording completion here.'));
        const confirmation = node('button', 'button button-secondary broker-confirmation', brokerSteps ? 'I completed the broker steps' : 'I completed the broker email step');
        confirmation.type = 'button';
        confirmation.disabled = Boolean(dashboard.campaign?.run_in_progress);
        confirmation.addEventListener('click', () => busy(confirmation, async () => {
          errorAt('page-error', '');
          try {
            await post('/api/confirmation', { site_id: item.site_id });
            await loadDashboard();
            setText('campaign-feedback', brokerSteps ?
              'Your report that you completed the broker portal steps is recorded. Deletion has not been verified.' :
              'Your email step is recorded. A listing check has started; removal is not yet verified. Use Refresh status for the result.');
            show($('campaign-feedback'));
          } catch (error) { errorAt('page-error', error.message); }
        }));
        info.append(confirmation);
      }
      const meta = node('div', 'listing-meta');
      meta.append(statusPill(item.status), node('time', 'listing-time', dateLabel(item.updated_at)));
      row.append(info, meta);
      fragment.append(row);
    }
    $('listing-items').replaceChildren(fragment);
    if (config?.browser_workspace && typeof EraseWorkspaceUI !== 'undefined') EraseWorkspaceUI.decorate(items);
    setText('listing-total', `${items.length} ${items.length === 1 ? 'site' : 'sites'}`);
    show($('listings-empty'), selected.length === 0);
    const empty = $('listings-empty');
    empty.querySelector('h3').textContent = items.length ? 'Nothing in this view yet.' : 'Your first check starts here.';
    empty.querySelector('p').textContent = items.length ? 'Choose another filter to see the rest of your removal activity.' : 'Once a site has been checked, its progress will appear here.';
  }
  function renderActivity() {
    const entries = Array.isArray(dashboard.activity) ? dashboard.activity : [];
    const fragment = document.createDocumentFragment();
    for (const entry of entries.slice(0, 8)) {
      const item = node('li');
      item.append(node('span', '', entry.message), node('time', '', dateLabel(entry.at, true)));
      fragment.append(item);
    }
    $('activity-list').replaceChildren(fragment);
    show($('activity-empty'), entries.length === 0);
  }
  function renderQuestions() {
    if (config?.synthetic_only) {
      show($('clarification-panel'), false);
      show($('reply-attention-panel'), false);
      return;
    }
    const questions = Array.isArray(dashboard.questions) ? dashboard.questions : [];
    const locationQuestions = questions.filter(q => ['country', 'region', 'city'].includes(q.field));
    const otherQuestions = questions.filter(q => !['country', 'region', 'city'].includes(q.field));
    show($('reply-attention-panel'), otherQuestions.length > 0);
    $('reply-questions').replaceChildren(...otherQuestions.map(q => node('li', '', q.prompt)));
    show($('clarification-panel'), locationOpen || locationQuestions.length > 0);
    setText('clarification-prompt', locationQuestions[0]?.prompt || 'A location helps us distinguish people with the same name.');
    const list = $('additional-questions');
    list.replaceChildren(...locationQuestions.slice(1).map(q => node('li', '', q.prompt)));
    show(list, locationQuestions.length > 1);
    if (!document.activeElement || !document.activeElement.closest('#profile-form')) {
      for (const field of ['country', 'region', 'city']) $('profile-' + field).value = dashboard.profile[field] || '';
    }
  }
  function renderRunControl() {
    const campaign = dashboard.campaign || {};
    const setupNeeded = dashboard.mode !== 'demo' && config && !config.automation_configured;
    $('run-button').disabled = campaign.status === 'paused' || setupNeeded || Boolean(campaign.run_in_progress);
    setText('run-button', config?.browser_workspace ? 'Prepare route plan' : campaign.run_in_progress ? 'Check running' : 'Run check');
  }
  function renderDashboard() {
    const profile = dashboard.profile || {};
    const campaign = dashboard.campaign || {};
    const paused = campaign.status === 'paused';
    const setupNeeded = dashboard.mode !== 'demo' && config && !config.automation_configured;
    const firstName = (profile.name || '').trim().split(/\s+/)[0] || 'there';
    setText('dashboard-greeting', paused ? `${firstName}, protection is paused. Your existing history is still here.` : `${firstName}, here’s where your information stands.`);
    setText('campaign-status', paused ? 'Paused' : setupNeeded ? 'Setup needed' : manualMode() ? 'On demand' : 'Protection active');
    $('campaign-status').className = 'status-pill' + (paused || setupNeeded || manualMode() ? ' neutral' : '');
    setText('pause-button', paused ? 'Allow checks' : 'Pause checks');
    renderRunControl();
    show($('refresh-button'), manualMode());
    for (const name of ['found', 'requested', 'removed', 'blocked']) setText('count-' + name, Number(dashboard.counts?.[name]) || 0);
    setText('account-email', profile.email);
    setText('next-check-label', manualMode() ? 'CHECKS ON DEMAND' : 'NEXT CHECK');
    setText('next-check-date', paused ? 'Paused until you allow checks' : setupNeeded ? 'Waiting for service setup' : manualMode() ?
      (campaign.run_in_progress ? 'One check is running. Refresh status to see its progress.' : 'Choose Run check when you’re ready. No recurring checks are scheduled.') :
      (dateLabel(campaign.next_check_at, true) || 'Waiting for the first scan'));
    renderListings(); renderActivity(); renderQuestions();
    if (config?.browser_workspace && typeof EraseWorkspaceUI !== 'undefined') EraseWorkspaceUI.tools();
    show($('welcome-view'), false); show($('dashboard-view')); show($('logout-button'), !config?.local_only);
    show($('edit-location'), !config?.synthetic_only);
    if(config?.browser_workspace) { setText('run-button', 'Prepare route plan'); setText('next-check-date', 'Choose a broker action below. Nothing runs on a schedule.'); }
  }
  function schedulePoll() {
    stopPolling();
    if (!manualMode() && dashboard && !document.hidden) pollTimer = setTimeout(() => loadDashboard(false), 5000);
  }
  async function loadDashboard(initial = false) {
    if (loadingDashboard) return;
    loadingDashboard = true;
    const generation = sessionGeneration;
    try {
      const data = await api('/api/dashboard');
      if (generation !== sessionGeneration) return;
      dashboard = data;
      errorAt('page-error', '');
      renderDashboard();
    } catch (error) {
      if (generation !== sessionGeneration) return;
      if (error.status === 401) {
        const hadSession = Boolean(dashboard);
        signedOut();
        if (hadSession) errorAt('page-error', config?.local_only ?
          'Your local session has expired. Run tools/local_access.py from the Erase Me folder on this Mac to reopen your profile.' :
          'Your session has expired. Sign in again to see your progress.');
        else if (initial) onboarding('signup-panel');
      } else errorAt('page-error', error.message);
    } finally { loadingDashboard = false; schedulePoll(); }
  }

  $('show-login').addEventListener('click', () => { onboarding('login-panel'); $('login-email').focus(); });
  $('show-signup').addEventListener('click', () => { onboarding('signup-panel'); $('signup-name').focus(); });
  $('back-to-login').addEventListener('click', () => {
    pendingChallenge = '';
    onboarding(pendingFlow === 'signup' ? 'signup-panel' : 'login-panel');
    const email = $(pendingFlow === 'signup' ? 'signup-email' : 'login-email');
    email.value = pendingEmail; email.focus();
  });
  $('signup-form').addEventListener('submit', async event => {
    event.preventDefault();
    await busy(event.submitter, async () => {
      errorAt('signup-error', '');
      const email = $('signup-email').value.trim();
      try {
        const result = await post('/api/signup', { name: $('signup-name').value.trim(), age: Number($('signup-age').value), email, authorized: $('signup-consent').checked });
        if (config?.local_only && result.ok) {
          await loadDashboard();
          $('dashboard-heading').setAttribute('tabindex', '-1'); $('dashboard-heading').focus();
        } else verifyStep(email, result, 'signup');
      } catch (error) {
        errorAt('signup-error', config?.local_only && error.status === 409 ?
          `${error.message} To reopen your local profile, run tools/local_access.py from the Erase Me folder on this Mac.` : error.message);
      }
    });
  });
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    await busy(event.submitter, async () => {
      errorAt('login-error', '');
      const email = $('login-email').value.trim();
      try { verifyStep(email, await post('/api/login', { email })); }
      catch (error) { errorAt('login-error', error.message); }
    });
  });
  $('verification-form').addEventListener('submit', async event => {
    event.preventDefault();
    await busy(event.submitter, async () => {
      errorAt('verification-error', '');
      try {
        await post('/api/verify', { email: pendingEmail, code: $('verification-code').value.trim(), challenge_id: pendingChallenge });
        $('verification-code').value = '';
        pendingChallenge = '';
        setText('demo-code', '');
        await loadDashboard();
        $('dashboard-heading').setAttribute('tabindex', '-1'); $('dashboard-heading').focus();
      } catch (error) { errorAt('verification-error', error.message); }
    });
  });
  $('profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    await busy(event.submitter, async () => {
      errorAt('profile-error', '');
      try {
        await post('/api/profile', { country: $('profile-country').value.trim().toUpperCase(), region: $('profile-region').value.trim().toUpperCase(), city: $('profile-city').value.trim() });
        locationOpen = false;
        await loadDashboard();
        setText('campaign-feedback', 'Location saved. Future checks will use these details.'); show($('campaign-feedback'));
      } catch (error) { errorAt('profile-error', error.message); }
    });
  });
  $('edit-location').addEventListener('click', () => { locationOpen = true; renderQuestions(); $('profile-country').focus(); });
  for (const button of document.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () => {
      filter = button.dataset.filter;
      for (const other of document.querySelectorAll('[data-filter]')) {
        const selected = other === button;
        other.classList.toggle('selected', selected); other.setAttribute('aria-pressed', String(selected));
      }
      renderListings();
    });
  }
  async function campaignAction(button, action) {
    await busy(button, async () => {
      errorAt('page-error', '');
      try {
        await post('/api/campaign', { action });
        await loadDashboard();
        setText('campaign-feedback', action === 'pause' ? 'Future work is paused. Requests already sent may still be processed by sites.' : action === 'resume' ?
          (manualMode() ? 'Checks are allowed. Choose Run check to start; recurring checks remain off.' : 'Protection resumed. The next check is queued.') :
          (config?.browser_workspace ? 'Your route plan is ready. Start a broker action below. No broker has been contacted.' : manualMode() ? 'One check has started. Use Refresh status to see progress. Recurring checks remain off.' : 'A check is queued. Progress will appear here as sites are processed.'));
        show($('campaign-feedback'));
      } catch (error) { errorAt('page-error', error.message); }
    });
  }
  $('pause-button').addEventListener('click', () => campaignAction($('pause-button'), dashboard?.campaign?.status === 'paused' ? 'resume' : 'pause'));
  $('run-button').addEventListener('click', () => campaignAction($('run-button'), 'run'));
  $('refresh-button').addEventListener('click', () => busy($('refresh-button'), () => loadDashboard()));
  $('logout-button').addEventListener('click', () => busy($('logout-button'), async () => {
    try { await post('/api/logout', {}); signedOut(); $('login-email').focus(); }
    catch (error) { errorAt('page-error', error.message); }
  }));
  $('privacy-button').addEventListener('click', () => $('privacy-dialog').showModal());
  $('delete-account').addEventListener('click', () => { errorAt('delete-error', ''); $('delete-dialog').showModal(); });
  for (const button of document.querySelectorAll('.dialog-close')) button.addEventListener('click', () => button.closest('dialog').close());
  $('confirm-delete').addEventListener('click', () => busy($('confirm-delete'), async () => {
    try {
      await api('/api/account', { method: 'DELETE', body: JSON.stringify({ confirm: true }) });
      $('delete-dialog').close(); signedOut(); onboarding('signup-panel');
      $('signup-form').reset(); $('login-form').reset();
      setText('page-error', 'Your account and history have been deleted.'); show($('page-error'));
    } catch (error) { errorAt('delete-error', error.message); }
  }));
  document.addEventListener('erase-workspace-change', () => loadDashboard());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPolling(); else if (dashboard) loadDashboard(); });

  async function init() {
    // Fragments never reach the HTTP server. Remove the recovery credential from
    // the address bar before any request, and exchange it only in local mode.
    const fragment = location.hash;
    const localToken = /^#local-session=([A-Za-z0-9_-]{20,100})$/.exec(fragment)?.[1];
    if (fragment.startsWith('#local-session=')) history.replaceState(null, '', location.pathname + location.search);
    try {
      config = await api('/api/config');
      if (localToken && config.local_only) await post('/api/local-session', { token: localToken });
      if (config.authorization_statement) setText('authorization-statement', config.authorization_statement);
      const demo = config.mode === 'demo';
      setText('mode-badge', demo ? 'Demo' : 'Private workspace'); show($('mode-badge'));
      show($('demo-banner'), demo);
      if (config.local_only) {
        setText('mode-badge', 'Local profile');
        show($('show-login').closest('.login-switch'), false);
        $('signup-panel').querySelector('.card-footnote').textContent = 'No inbox connection. Broker verification emails go to the address you enter; open them yourself if required.';
        $('signup-panel').querySelector('button[type="submit"]').textContent = 'Create local profile';
        $('signup-panel').querySelector('.form-description').textContent = 'Enter your own details. This local profile does not verify ownership of the email address.';
        $('privacy-dialog').querySelector('.dialog-body > p').textContent = 'This local app stores your profile and request history on this computer. It does not connect to or read your inbox.';
      }
      if(config.browser_workspace && typeof EraseWorkspaceUI !== 'undefined') EraseWorkspaceUI.configure();
      if (config.synthetic_only) {
        setText('mode-badge', 'Public demo');
        $('privacy-dialog').querySelector('.dialog-body > p').textContent = 'This public demo uses a fixed sample profile. It does not accept personal profiles or send real removal requests.';
        $('demo-banner').querySelector('span:last-child').textContent = 'Public demo — sample data only. All listings and removal activity are simulated. No personal information or real requests are processed.';
        for (const [id, value] of Object.entries({ 'signup-name': 'Alex Morgan', 'signup-age': '35', 'signup-email': 'alex@example.com', 'login-email': 'alex@example.com' })) {
          $(id).value = value;
          $(id).defaultValue = value;
          $(id).readOnly = true;
          $(id).setAttribute('aria-describedby', 'demo-banner');
        }
      }
      if (!demo && !config.local_only && (!config.email_configured || !config.automation_configured)) {
        setText('setup-banner', !config.email_configured ? 'Email verification is not connected yet. New signups cannot start until the service owner connects email.' : 'Removal connections are not configured yet. You can create your profile; requests will remain queued until setup is complete.');
        show($('setup-banner'));
        if (!config.email_configured) {
          for (const form of [$('signup-form'), $('login-form')]) form.querySelector('button[type="submit"]').disabled = true;
        }
      }
      await loadDashboard(true);
    } catch (error) { errorAt('page-error', error.message); }
  }
  init();
})();
