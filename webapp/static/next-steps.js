/* Broker-specific prompts derived from this browser's existing request history. */
(function (root, factory) {
  const routes = typeof module === 'object' && module.exports ? require('./broker-routes.js') : root.EraseBrokerRoutes;
  const api = factory(routes);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseNextSteps = api;
})(typeof globalThis === 'object' ? globalThis : this, function (routes) {
  'use strict';
  const catalog = new Map((routes || []).map(route => [route.id, route]));
  const matchingForms = new Set(['fastpeoplesearch', 'usphonebook']);
  const inactive = new Set(['held', 'requested', 'user_reported_completed']);
  function address(value) {
    return typeof value === 'string' && value.length <= 254 && value === value.trim() &&
      /^[^\s<>@\x00-\x1f\x7f]+@[^\s<>@\x00-\x1f\x7f]+\.[^\s<>@\x00-\x1f\x7f]+$/.test(value) ? value : null;
  }
  function requestEmail(item) {
    const saved = address(item.operation_email);
    if (saved && ['profile', 'business', 'removal'].includes(item.operation_email_role))
      return { email: saved, emailRole: item.operation_email_role };
    const contact = item.mail_contact;
    if (contact?.operation_id === item.operation_id && address(contact.contact_email))
      return { email: contact.contact_email, emailRole: 'removal' };
    if (item.site_id === 'apollo' && address(item.input_fields?.business_email))
      return { email: item.input_fields.business_email, emailRole: 'business' };
    // Earlier releases did not snapshot the address used by a typed-email form.
    // The current profile is not evidence of the historic recipient.
    return { email: null, emailRole: 'unknown' };
  }
  function build(dashboard) {
    if (!dashboard || dashboard.campaign?.status !== 'active' || !Array.isArray(dashboard.items)) return [];
    const cards = [];
    for (const item of dashboard.items) {
      const route = catalog.get(item?.site_id);
      if (!route || !item.operation_id || item.held === true || inactive.has(item.status)) continue;
      const base = { routeId: route.id, name: route.name, ...requestEmail(item) };
      const add = (kind, title, detail, action = 'review', stage = null) => cards.push({ ...base, kind, title, detail, action, stage });
      const imported = item.operation_source === 'imported_user_history' || item.continuation?.source === 'imported_user_history' ||
        item.mail_receipt?.source === 'imported_user_history' || item.evidence?.source === 'imported_user_history';
      if (imported) {
        add('history_review', 'Review imported request history', 'This request was restored from a backup. Review its existing broker outcome before continuing; restored history does not verify a message, matching form or deletion.');
        continue;
      }
      if (item.status === 'user_reported_requested') {
        add('outcome_review', 'Review the broker’s response', 'You reported submitting this request. Review its existing broker response and any required verification in Request steps. A submission report does not establish broker acceptance or deletion.');
        continue;
      }
      const receipt = item.mail_receipt;
      const authenticated = receipt?.status === 'held' && receipt.authenticated === true && receipt.continuation_available === true &&
        /^[a-f0-9]{64}$/.test(receipt.receipt_ref || '') && item.mail_contact?.operation_id === item.operation_id &&
        receipt.source !== 'imported_user_history';
      if (item.continuation) {
        if (matchingForms.has(route.id) && item.continuation.result === 'prepared' && authenticated &&
            item.continuation.receipt_ref === receipt.receipt_ref && item.mail_contact) {
          add('detail_required', route.name + ' needs one more detail',
            'Provide either your full date of birth or your current street address directly on ' + route.name + '’s official matching form. City, state and ZIP code are also required. Age and city alone cannot identify the correct record. Completing these details does not establish deletion.',
            'focus', 'continuation');
        } else {
          add('outcome_review', 'Review the existing matching-form result', 'The matching-form outcome needs review. Check the existing request steps before continuing; do not repeat the confirmation or assume that a record was removed.');
        }
        continue;
      }
      if (authenticated && matchingForms.has(route.id)) {
        add('confirmation_ready', 'Review the verified broker email', 'An authenticated message for this removal contact has a reviewed matching-form destination. Review the original request fields in Request steps before opening it. Opening the form does not establish a matched record or deletion.');
        continue;
      }
      if (receipt?.authenticated === true) {
        add('confirmation_review', 'The broker email needs review', 'A broker message was authenticated for this request, but its confirmation destination is not supported automatically. Review the existing request steps; no link or removal should be assumed complete.');
        continue;
      }
      const result = item.evidence;
      if (item.status === 'uncertain' || item.status === 'running' || ['unknown', 'error', 'pending'].includes(result?.result)) {
        add('outcome_review', 'Check the existing broker action', 'The previous action’s outcome is unknown. Review its existing tab and request history before continuing. No request should be resent automatically.');
        continue;
      }
      const verification = item.status === 'verification_sent' && result?.result === 'verification_sent' && result.source === 'browser_companion';
      const initiationAttempt = route.id === 'fastpeoplesearch' && result?.result === 'submission_attempted' &&
        result.attempt_verified === true && result.stage === 'verification_initiation';
      if (verification || initiationAttempt) {
        if (base.emailRole === 'removal') {
          add('removal_mail', 'Review removal-mail verification',
            (verification ? 'The broker reported a verification step. ' : 'A verification submission was attempted; email delivery is not yet established. ') +
            'Any confirmation for this request goes to the separate removal-only mailbox shown here. Use the one-time confirmation check in Request steps. Personal inbox access is not needed.');
        } else if (base.email) {
          add('email_verification', 'Check the email for this request', 'Open the broker’s verification message in the email account shown here and complete its official removal steps. Erase Me does not connect to that inbox. A verification email is not a completed deletion.');
        } else {
          add('email_verification', 'Find the original verification email', 'The original request email was not saved by this earlier workspace version. Check the account used for that request and review the broker’s official verification message. The current profile address is not substituted.');
        }
        continue;
      }
      if (result?.result === 'prepared') {
        add('finish_form', 'Finish ' + route.name + '’s official form', 'The reviewed fields were filled in the existing broker tab. Review its agreements and remaining steps there. A prepared form does not establish a submitted request or deletion.', 'focus', 'operation');
      } else if (item.status === 'blocked' || result) {
        add('broker_attention', route.name + ' needs attention', 'Review this broker’s existing request steps and reported result. Missing details or challenges must be resolved before a completed removal can be established.');
      }
    }
    return cards;
  }
  return Object.freeze({ build });
});
