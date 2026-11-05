/* Public route metadata. A researched portal is not proof of a completed removal. */
(function (root, factory) {
  const routes = factory();
  if (typeof module === 'object' && module.exports) module.exports = routes;
  else root.EraseBrokerRoutes = routes;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const routes = [
    { id: 'peopledatalabs-form', name: 'People Data Labs', domain: 'privacy.peopledatalabs.com',
      url: 'https://privacy.peopledatalabs.com/policies?action=ERASURE&modal=log-in',
      fields: ['email'], automationLevel: 'companion', automationMode: 'initiate', inspectedAt: '2026-11-04', allowedHosts: ['privacy.peopledatalabs.com'],
      steps: ['Start email verification in the official deletion portal.', 'Open the broker email yourself and finish the deletion steps.'],
      evidence: 'Verification initiation was observed. Completed deletion is not independently verified.' },
    { id: 'usphonebook', name: 'USPhonebook', domain: 'usphonebook.com', url: 'https://www.usphonebook.com/removal',
      fields: ['first_name', 'last_name', 'email'], automationLevel: 'companion', automationMode: 'prefill', inspectedAt: '2026-11-04', allowedHosts: ['www.usphonebook.com', 'usphonebook.com'],
      steps: ['Enter your own first name, last name and email.', 'Complete the broker challenge and submit.', 'Open the broker email and finish the record selection and removal form.'],
      evidence: 'Official first form inspected. The email step starts another removal form.' },
    { id: 'searchpeoplefree', name: 'SearchPeopleFree', domain: 'searchpeoplefree.com', url: 'https://www.searchpeoplefree.com/opt-out',
      fields: ['first_name', 'last_name', 'email'], automationLevel: 'companion', automationMode: 'prefill', inspectedAt: '2026-11-04', allowedHosts: ['www.searchpeoplefree.com', 'searchpeoplefree.com'],
      steps: ['Enter your own name and email in the official opt-out form.', 'Complete the broker challenge and email verification.', 'Find your record and remove it during the broker session.'],
      evidence: 'Official first form inspected. Completing email verification alone does not remove a record.' },
    { id: 'smartbackgroundchecks', name: 'SmartBackgroundChecks', domain: 'smartbackgroundchecks.com', url: 'https://www.smartbackgroundchecks.com/remove',
      fields: ['first_name', 'last_name', 'email'], automationLevel: 'manual', availability: 'blocked_in_research', inspectedAt: '2026-11-04', allowedHosts: ['www.smartbackgroundchecks.com', 'smartbackgroundchecks.com'],
      steps: ['Enter your own first name, last name and email.', 'Complete the broker challenge and email verification.', 'Complete the second opt-out form for the matching record.'],
      evidence: 'The official route returned HTTP 403 in the November 4 inspection. Open it manually if accessible in your browser. Submission and deletion are unverified.' },
    { id: 'fastpeoplesearch', name: 'FastPeopleSearch', domain: 'fastpeoplesearch.com', url: 'https://www.fastpeoplesearch.com/optout',
      fields: ['first_name', 'last_name', 'email'], automationLevel: 'companion', automationMode: 'prefill', inspectedAt: '2026-11-04', allowedHosts: ['www.fastpeoplesearch.com', 'fastpeoplesearch.com'],
      steps: ['Choose the subject option for your own information.', 'Enter your name and email, then complete the broker challenge.', 'Complete the broker email and matching-record steps.'],
      evidence: 'Official initial form inspected. Submission and removal outcomes remain unverified.' },
    { id: 'spokeo', name: 'Spokeo', domain: 'spokeo.com', url: 'https://www.spokeo.com/optout',
      fields: ['listing_url', 'email'], automationLevel: 'manual', allowedHosts: ['www.spokeo.com', 'spokeo.com'],
      steps: ['Find and confirm your own matching listing first.', 'Provide its exact URL and your email in the official opt-out form.', 'Complete the broker challenge and confirmation email for each listing.'],
      evidence: 'Listing URL and broker verification are required. A name alone is insufficient.' },
    { id: 'apollo', name: 'Apollo', domain: 'apollo.io', url: 'https://www.apollo.io/privacy-policy/remove',
      fields: ['email'], automationLevel: 'manual', inspectedAt: '2026-11-04', allowedHosts: ['www.apollo.io', 'apollo.io'],
      steps: ['Open Apollo’s official removal portal and enter the business email associated with its record.', 'Apollo may require the business email associated with its record.', 'Complete its verification yourself. A typed personal email may not identify a business record.'],
      evidence: 'The official removal portal loaded on November 4 and requests a business email. Manual submission and verification are required. No email is sent from your account.' }
  ];
  return Object.freeze(routes.map(route => Object.freeze({ ...route,
    fields: Object.freeze(route.fields), allowedHosts: Object.freeze(route.allowedHosts), steps: Object.freeze(route.steps) })));
});
