/* Public route metadata. A researched portal is not proof of a completed removal. */
(function (root, factory) {
  const audit = typeof module === 'object' && module.exports ? require('./broker-audit.js') : root.EraseBrokerAudit;
  const routes = factory(audit);
  if (typeof module === 'object' && module.exports) module.exports = routes;
  else root.EraseBrokerRoutes = routes;
})(typeof globalThis === 'object' ? globalThis : this, function (audit) {
  'use strict';
  const routes = [
    { id: 'peopledatalabs-form', countries: ['*'], name: 'People Data Labs', domain: 'privacy.peopledatalabs.com',
      url: 'https://privacy.peopledatalabs.com/policies?action=ERASURE&modal=log-in',
      fields: ['email'], automationLevel: 'companion', automationMode: 'initiate', inspectedAt: '2026-11-04', allowedHosts: ['privacy.peopledatalabs.com'],
      steps: ['Start email verification in the official deletion portal.', 'Open the broker email yourself and finish the deletion steps.'],
      evidence: 'Verification initiation was observed. Completed deletion is not independently verified.' },
    { id: 'usphonebook', countries: ['US'], name: 'USPhonebook', domain: 'usphonebook.com', url: 'https://www.usphonebook.com/removal',
      fields: ['first_name', 'last_name', 'email'], automationLevel: 'companion', automationMode: 'prefill', inspectedAt: '2026-11-04', allowedHosts: ['www.usphonebook.com', 'usphonebook.com'],
      steps: ['Enter your own first name, last name and email.', 'Optionally approve the exact own-request agreement in Review form batch. The companion requires the genuine Enterprise response before one guarded initial submission attempt.', 'The verified broker email opens a second form requiring your accurate city, state and ZIP code, plus either date of birth or street address. Enter the birth date or street address directly on USPhonebook; Erase Me does not collect or autofill it.', 'The local removal-only connector or private operator pilot can fill the separately authorized name, city, state, ZIP and contact fields. Complete the additional broker detail, accuracy statement and challenge before submitting on the official site.'],
      evidence: 'Official first form, authenticated verification email and second form inspected. Live validation rejected the final form without either date of birth or street address, despite neither field being marked required in the HTML. Final request acceptance and deletion remain unverified.' },
    { id: 'searchpeoplefree', countries: ['US'], name: 'SearchPeopleFree', domain: 'searchpeoplefree.com', url: 'https://www.searchpeoplefree.com/opt-out',
      fields: ['first_name', 'last_name', 'email'], automationLevel: 'companion', automationMode: 'prefill', inspectedAt: '2026-11-05', allowedHosts: ['www.searchpeoplefree.com', 'searchpeoplefree.com'],
      steps: ['Enter your own first name, last name and personally owned email inside Erase Me. A local connector may supply an alias of your own separate Gmail account; shared operator contacts remain unavailable.', 'In Review form batch, optional guarded submission checks the exact own-email agreement, policy sources and genuine Turnstile response before one native attempt. Unresolved challenges stop the action. Local mail checks authenticate receipts, but confirmation links remain held pending a reviewed continuation contract.', 'Find your record and remove it during the broker session.'],
      evidence: 'Official initial form, own-email agreement, policy links and submission handler checked read-only on November 5. A guarded attempt or authenticated receipt does not establish correct-record matching, acceptance or deletion.' },
    { id: 'smartbackgroundchecks', countries: ['US'], name: 'SmartBackgroundChecks', domain: 'smartbackgroundchecks.com', url: 'https://www.smartbackgroundchecks.com/optout',
      fields: ['first_name', 'last_name', 'email'], requiredAffirmations: ['own_request'], automationLevel: 'companion', availability: 'reviewed_initial_form', automationMode: 'prefill', inspectedAt: '2026-11-05', allowedHosts: ['www.smartbackgroundchecks.com', 'smartbackgroundchecks.com'],
      steps: ['Enter and review your own name and contact email inside Erase Me.', 'The companion opens the official privacy page and checks its published Opt-Out Form link before navigating to the removal form. No profile fields go to the privacy page.', 'Optional guarded submission requires review of the exact own-request agreement and the genuine broker challenge response. Changed forms or blocked navigation stop the action.', 'Later verification, correct-record matching, final request processing and deletion remain unverified. A native submit event establishes an initial attempt only.'],
      evidence: 'The official privacy entry and initial removal form were inspected read-only. Exact form filling and optional guarded initial submission are supported; later broker stages and deletion remain unverified.' },
    { id: 'fastpeoplesearch', countries: ['US'], name: 'FastPeopleSearch', domain: 'fastpeoplesearch.com', url: 'https://www.fastpeoplesearch.com/optout',
      fields: ['first_name', 'last_name', 'email'], automationLevel: 'companion', automationMode: 'prefill', inspectedAt: '2026-11-05', allowedHosts: ['www.fastpeoplesearch.com', 'fastpeoplesearch.com'],
      steps: ['Enter your own first name, last name and email inside Erase Me. Review the exact authorization before optionally submitting the initial form.', 'A separately configured local removal-only Gmail connector or the private operator pilot can authenticate this request’s confirmation and open its matching form. Personal inboxes stay disconnected.', 'For an authenticated prepared continuation, choose Enter missing information inside Erase Me. The companion checks the existing form’s requirements, then you review the exact identity fields and accuracy statement before approving one fill-and-submit attempt.', 'The current matching form marks date of birth, street address and phone required despite wording that date of birth or address is enough. Erase Me explains this conflict before collection. Cancel or hold instead if you do not want to provide those fields.', 'A genuine broker challenge response is still required. A checked submit event establishes an attempt; correct-record matching, broker acceptance and independently verified deletion need separate evidence.'],
      evidence: 'Reviewed initial submission and authenticated matching-form submission contracts are implemented. Additional identity details are transient. Neither form preparation, a confirmation email nor a submit event establishes deletion.' },
    { id: 'spokeo', countries: ['US'], name: 'Spokeo', domain: 'spokeo.com', url: 'https://www.spokeo.com/optout',
      fields: ['listing_url', 'email'], requiredAffirmations: ['own_listing'], automationLevel: 'companion', automationMode: 'prefill', inspectedAt: '2026-11-04', allowedHosts: ['www.spokeo.com', 'spokeo.com'],
      steps: ['Find your own matching listing and explicitly confirm that it belongs to you.', 'Supply its exact official record URL and your typed email for the reviewed opt-out form.', 'Review and submit on Spokeo, then complete its challenge and confirmation email for each listing.', 'If the form is inaccessible, Spokeo’s official opt-out page also lists privacy@spokeo.com for assistance. Contact that address from your chosen removal account and identify only your confirmed listing. Erase Me does not send this email or connect to your personal inbox. Reconcile any uncertain earlier submission first.'],
      evidence: 'Official initial opt-out form inspected. Prefill requires your explicit record selection; URL syntax alone never proves identity, acceptance or deletion.' },
    { id: 'apollo', countries: ['*'], name: 'Apollo', domain: 'apollo.io', url: 'https://www.apollo.io/privacy-policy/remove',
      fields: ['business_email'], requiredAffirmations: ['business_email'], automationLevel: 'companion', automationMode: 'prefill', inspectedAt: '2026-11-05', allowedHosts: ['www.apollo.io', 'apollo.io'],
      steps: ['Explicitly supply the business email associated with your own Apollo record and authorize using it for this request.', 'The companion can fill that address in the reviewed official form. Your profile email and the shared removal contact are never substituted.', 'Optional guarded submission can start verification-information processing after review of the associated business address. A browser-enforced policy blocks native GET fallback. Complete the later verification directly; an attempt does not establish acceptance or deletion.'],
      evidence: 'Official business-email form checked read-only on November 5. Optional guarded initial submission is supported; later verification, record matching, acceptance and deletion remain unverified.' },
    // Manual references add geographic coverage, not automation claims.
    { "id": "addresses", "name": "Addresses.com", "domain": "addresses.com", "url": "https://www.addresses.com/optout.php",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["addresses.com","www.addresses.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/addresses.json", "cluster": "peopleconnect", "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    {
      "id": "advancedbackgroundchecks",
      "name": "AdvancedBackgroundChecks",
      "domain": "advancedbackgroundchecks.com",
      "url": "https://www.advancedbackgroundchecks.com/opt-out",
      "countries": [
        "US"
      ],
      "fields": [
        "first_name",
        "last_name",
        "email"
      ],
      "automationLevel": "companion",
      "availability": "reviewed_initial_form",
      "allowedHosts": [
        "advancedbackgroundchecks.com",
        "www.advancedbackgroundchecks.com"
      ],
      "manualMethod": "web_form",
      "referenceVerified": true,
      "referenceCheckedAt": "2026-10-27",
      "sourceCatalog": "us/advancedbackgroundchecks.json",
      "cluster": "tornado-alley",
      "covers": [],
      "steps": [
        "Enter and review your own name and contact email inside Erase Me. You can fill the initial form or explicitly approve its exact communications agreement, policy links and optional guarded submission.",
        "Confirm that the target information is your own before filling. Never submit for an unrelated person without explicit authorization.",
        "The broker handles its normal reCAPTCHA through the official page. An unresolved challenge needs attention. A checked native submit event establishes an initial attempt, not acceptance or deletion. Email continuation, the second form and record matching remain manual or unobserved."
      ],
      "evidence": "The official initial form contract was inspected without entering personal data or submitting. Later identity matching, request acceptance and deletion remain unverified.",
      "requiredAffirmations": [
        "own_request"
      ],
      "automationMode": "prefill",
      "inspectedAt": "2026-11-05"
    },
    { "id": "beenverified", "name": "BeenVerified", "domain": "beenverified.com", "url": "https://www.beenverified.com/app/optout/search",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["beenverified.com","www.beenverified.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/beenverified.json", "cluster": "beenverified", "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, state or region, email. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "clustrmaps", "name": "ClustrMaps", "domain": "clustrmaps.com", "url": "https://clustrmaps.com/bl/opt-out",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["clustrmaps.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/clustrmaps.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, listing URL. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "cyberbackgroundchecks", "name": "CyberBackgroundChecks", "domain": "cyberbackgroundchecks.com", "url": "https://www.cyberbackgroundchecks.com/removal",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["cyberbackgroundchecks.com","www.cyberbackgroundchecks.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/cyberbackgroundchecks.json", "cluster": "tornado-alley", "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, email. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { id: 'familytreenow', name: 'FamilyTreeNow', domain: 'familytreenow.com', url: 'https://www.familytreenow.com/optout',
      countries: ['US'], fields: ['first_name', 'last_name', 'email'], requiredAffirmations: ['own_request'], automationLevel: 'companion', availability: 'reviewed_initial_form', automationMode: 'prefill', inspectedAt: '2026-11-05', allowedHosts: ['www.familytreenow.com', 'familytreenow.com'], referenceVerified: true, referenceCheckedAt: '2026-11-05', sourceCatalog: 'us/familytreenow.json', cluster: null, covers: [],
      steps: ['Enter and review your own first name, last name and contact email in Erase Me.', 'The companion checks the official privacy page and its published Opt-Out Form link before the exact initial form. If the normal page remains blocked, no details are filled.', 'Optional guarded submission requires the exact communications authorization and the genuine hCaptcha response. Erase Me preserves the site’s verification values and leaves agent and middle-name fields empty.', 'The initial attempt starts email verification only. Later matching, final processing and deletion remain unverified. This route has no automatic mailbox continuation.'],
      evidence: 'The current official privacy entry and initial Privacy Request form were inspected read-only. Exact prefill and a guarded native initial attempt are supported; no live request, confirmation, record match or deletion was verified.' },
    { "id": "instantcheckmate", "name": "Instant Checkmate", "domain": "instantcheckmate.com", "url": "https://www.instantcheckmate.com/opt-out/",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["instantcheckmate.com","www.instantcheckmate.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/instantcheckmate.json", "cluster": "peopleconnect", "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, email. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "intelius", "name": "Intelius (PeopleConnect suppression center)", "domain": "intelius.com", "url": "https://suppression.peopleconnect.us/login",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["intelius.com","suppression.peopleconnect.us"], "manualMethod": "web_form",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-27", "sourceCatalog": "us/intelius.json", "cluster": "peopleconnect", "covers": ["truthfinder","instantcheckmate","ussearch","zabasearch","addresses"],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for email, full name, date of birth. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "mylife", "transientPrefill": true, "myLifePrefill": true, "name": "MyLife", "domain": "mylife.com", "url": "https://www.mylife.com/privacyrequest",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "reviewed_transient_prefill", "allowedHosts": ["mylife.com","www.mylife.com","mylife.jotform.com"], "manualMethod": "web_form",
      "referenceVerified": true, "referenceCheckedAt": "2026-11-05", "sourceCatalog": "us/mylife.json", "cluster": null, "covers": [],
      "steps": ["Choose Review MyLife identity fields to enter your own exact name, state, city, ZIP and accurate birth year inside Erase Me. The birth year is never guessed from your age.","Review the six exact fields and approve one fill in MyLife’s officially embedded JotForm. Birth year and location remain transient; no email, street address, alias or optional profile URL is supplied.","The companion verifies the original privacy page and its exact branded form before navigating. Blocked or changed entry stops without disclosure.","Complete any email/identity verification, genuine challenge and submission yourself on the official form. No acceptance, matching or deletion is established. Stop for payment or ID uploads."], "evidence": "The official privacyrequest page and branded JotForm were observed read-only on November 5. A separate guarded prefill is supported; verification, request acceptance and deletion remain unverified." },
    { "id": "nuwber", "name": "Nuwber", "domain": "nuwber.com", "url": "https://nuwber.com/removal/link",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["nuwber.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/nuwber.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for listing URL, email. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "peoplefinders", "transientPrefill": true, "peopleFindersPrefill": true, "name": "PeopleFinders", "domain": "peoplefinders.com", "url": "https://www.peoplefinders.com/opt-out",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "reviewed_transient_prefill", "allowedHosts": ["peoplefinders.com","www.peoplefinders.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/peoplefinders.json", "cluster": null, "covers": [],
      "steps": ["Choose Review PeopleFinders matching fields to enter the required first/last name, street address, city and state privately. Use your accurate name in the punctuation-free format requested by the provider; nothing is silently changed.", "The companion can advance the exact public, non-form Next control to show the suppression form, then fills only the reviewed required matching fields. Middle name, optional phone and DOB stay empty; the disabled email remains the provider’s literal opt-out value.", "Address and name-component values stay outside the saved workspace, backups and companion journal. The accuracy checkbox, genuine challenge and final Submit are left for your direct review. No matched-record, acceptance or deletion evidence is established."], "evidence": "Official public form observed November 5, 2026. Exact transient prefill is supported separately from normal batches; no submitted request or deletion has been established." },
    { "id": "peoplelooker", "name": "PeopleLooker", "domain": "peoplelooker.com", "url": "https://www.peoplelooker.com/opt-out",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["peoplelooker.com","www.peoplelooker.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/peoplelooker.json", "cluster": "beenverified", "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, state or region, email. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "thatsthem", "transientPrefill": true, "thatsThemPrefill": true, "name": "That's Them", "domain": "thatsthem.com", "url": "https://thatsthem.com/optout",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "reviewed_transient_prefill", "allowedHosts": ["thatsthem.com"], "manualMethod": "web_form",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-27", "sourceCatalog": "us/thatsthem.json", "cluster": "spokeo", "covers": [],
      "steps": ["Choose Review That’sThem matching fields to enter your accurate US street address, city, state, ZIP and phone in a private review. Your typed profile name and email are disclosed with those exact fields.", "Additional matching details stay only in the open review and one-action payload. No private address or phone enters the ledger or backup.", "The companion fills the exact public opt-out form once, leaving the genuine Turnstile challenge and Submit control untouched. Review and submit on the official site. No correct-record match, acceptance or deletion is established."], "evidence": "Official public form observed November 5, 2026. Exact transient prefill is supported separately from normal batches; no submitted request or deletion has been established." },
    { "id": "truepeoplesearch", "name": "TruePeopleSearch", "domain": "truepeoplesearch.com", "url": "https://www.truepeoplesearch.com/removal",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["truepeoplesearch.com","www.truepeoplesearch.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/truepeoplesearch.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for email, full name, city, state or region. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "truthfinder", "name": "TruthFinder", "domain": "truthfinder.com", "url": "https://www.truthfinder.com/opt-out/",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["truthfinder.com","www.truthfinder.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/truthfinder.json", "cluster": "peopleconnect", "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, email. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "ussearch", "name": "US Search", "domain": "ussearch.com", "url": "https://www.ussearch.com/opt-out/",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["ussearch.com","www.ussearch.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/ussearch.json", "cluster": "peopleconnect", "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "whitepages", "name": "Whitepages", "domain": "whitepages.com", "url": "https://www.whitepages.com/suppression-requests",
      "countries": ["US"], "fields": ["listing_url"], "requiredAffirmations": ["own_listing"], "automationLevel": "companion", "automationMode": "prefill", "availability": "reviewed_listing_prefill", "inspectedAt": "2026-11-05", "allowedHosts": ["whitepages.com","www.whitepages.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/whitepages.json", "cluster": null, "covers": [],
      "steps": ["Find your own Whitepages person record and explicitly confirm that the exact direct URL belongs to you before filling.","The companion fills only that reviewed URL in Step 1 of 5. It does not click Next, select a record or submit a removal.","Review the existing official page, continue Next yourself and complete the broker’s later verification. Phone verification or other identity steps stay manual. Stop for ID uploads or payment."], "evidence": "The official listing-URL intake and published person-URL formatter were inspected read-only in ordinary visible Chrome on November 5. Prefill is supported; no live match, accepted request, phone verification or deletion is established." },
    { "id": "zabasearch", "name": "ZabaSearch", "domain": "zabasearch.com", "url": "https://suppression.peopleconnect.us/login",
      "countries": ["US"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["zabasearch.com","suppression.peopleconnect.us"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": null, "sourceCatalog": "us/zabasearch.json", "cluster": "peopleconnect", "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for email, full name, date of birth. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "ca-411", "name": "411.ca", "domain": "411.ca", "url": "https://www.411.ca/privacy-policy",
      "countries": ["CA"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["411.ca","www.411.ca"], "manualMethod": "email",
      "referenceVerified": false, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "ca/ca-411.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, email, listing URL. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "ca-cma-do-not-mail", "transientPrefill": true, "cmaRegistration": true, "name": "CMA Do Not Mail Service", "domain": "thecma.ca", "url": "https://cmadnm.cawebhosting.ca/submit.asp",
      "countries": ["CA"], "fields": [], "automationLevel": "manual", "availability": "reviewed_transient_registration", "allowedHosts": ["thecma.ca","cmadnm.cawebhosting.ca"], "manualMethod": "web_form",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "ca/ca-cma-do-not-mail.json", "cluster": null, "covers": [],
      "steps": ["Choose Review mailing preference to enter and review your own Canadian name and mailing address privately inside Erase Me.","CMA is a marketing-suppression registration, not deletion of broker records. It lasts six years, takes about six weeks, can suppress wanted offers and does not stop unaddressed flyers.","Additional address values stay only in the open review and one-action payload. No email, phone, company, deceased-person or alternate-name information is sent.","Optional guarded submission starts unchecked and records only one native marketing-registration attempt. Acceptance and deletion remain unverified."], "evidence": "Official CMA registration form, privacy link, six-year/six-week notice and normal validation handler inspected read-only November 5, 2026. No actual registration or deletion has been established." },
    { "id": "ca-dncl", "name": "National Do Not Call List (DNCL)", "domain": "lnnte-dncl.gc.ca", "url": "https://www.lnnte-dncl.gc.ca/en/Consumer/Register-your-number",
      "countries": ["CA"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["lnnte-dncl.gc.ca","www.lnnte-dncl.gc.ca"], "manualMethod": "web_form",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "ca/ca-dncl.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for phone number. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "canada411", "name": "Canada411", "domain": "canada411.ca", "url": "https://www.canada411.ca/help.html?key=faq",
      "countries": ["CA"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["canada411.ca","www.canada411.ca"], "manualMethod": "web_form",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "ca/canada411.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, email, phone number. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "192com", "name": "192.com", "domain": "192.com", "url": "https://www.192.com/c01/new-request/",
      "countries": ["GB"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["192.com","www.192.com"], "manualMethod": "web_form",
      "referenceVerified": false, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "gb/192com.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for first name, surname, postal code, email. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "gb-bt-phonebook", "name": "BT Phone Book and 118 500 (ex-directory)", "domain": "bt.com", "url": "https://www.bt.com/help/home-phone/manage-service/how-do-i-sign-up-to-ex-directory-services-",
      "countries": ["GB"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["bt.com","www.bt.com"], "manualMethod": "phone",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "gb/gb-bt-phonebook.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, phone number. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "gb-peopletraceuk", "transientPrefill": true, "name": "People Trace UK", "domain": "peopletraceuk.com", "url": "https://www.peopletraceuk.com/RequestRecordRemoval.asp",
      "countries": ["GB"], "fields": [], "automationLevel": "manual", "availability": "reviewed_transient_prefill", "allowedHosts": ["peopletraceuk.com","www.peopletraceuk.com"], "manualMethod": "web_form",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "gb/gb-peopletraceuk.json", "cluster": null, "covers": [],
      "steps": ["Choose Enter private form details to review your own name, email, birth date, phone and UK address inside Erase Me.","Additional identity values stay only in the open dialog and one-action payload; they are not saved in the workspace or backup.","After your exact-field authorization, the companion can fill the reviewed official form once. Complete its genuine challenge and submission yourself.","One form concerns one true data subject and one address. Identity checks, acceptance and deletion remain unverified. Stop for ID uploads or payment."], "evidence": "Official public form checked read-only November 5, 2026. Transient prefill is supported separately from normal form batches. No correct-record match, accepted request or deletion was established." },
    { "id": "gb-tps", "name": "Telephone Preference Service (TPS)", "domain": "tpsonline.org.uk", "url": "https://www.tpsonline.org.uk/register",
      "countries": ["GB"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["tpsonline.org.uk","www.tpsonline.org.uk"], "manualMethod": "web_form",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "gb/gb-tps.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for phone number, postal code, email. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "ukphonebook", "name": "ukphonebook.com", "domain": "ukphonebook.com", "url": "https://www.ukphonebook.com/remove-me",
      "countries": ["GB"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["ukphonebook.com","www.ukphonebook.com"], "manualMethod": "web_form",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "gb/ukphonebook.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for first name, surname, street address, postal code, email. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "de-11880", "name": "11880.com", "domain": "11880.com", "url": "https://unternehmen.11880.com/faq",
      "countries": ["DE"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["11880.com","unternehmen.11880.com"], "manualMethod": "phone",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "de/de-11880.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, phone number. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "de-teilnehmerverzeichnis-widerspruch", "name": "Widerspruch through the phone provider (all directories)", "domain": "dasoertliche.de", "url": "https://www.dasoertliche.de/datenschutz",
      "countries": ["DE"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["dasoertliche.de","www.dasoertliche.de"], "manualMethod": "phone",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "de/de-teilnehmerverzeichnis-widerspruch.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, phone number. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "tr-ceptennumarasorgula", "name": "Cepten Numara Sorgula 11877 (Mobilişim)", "domain": "ceptennumarasorgula.com", "url": "https://www.ceptennumarasorgula.com/PrivacyPolicy",
      "countries": ["TR"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["ceptennumarasorgula.com","www.ceptennumarasorgula.com"], "manualMethod": "legal_request",
      "referenceVerified": false, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "tr/tr-ceptennumarasorgula.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, phone number. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    { "id": "tr-mobile-operator-rehber", "name": "Vodafone and Türk Telekom directory (rehber) listing", "domain": "vodafone.com.tr", "url": "https://www.vodafone.com.tr/",
      "countries": ["TR"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["vodafone.com.tr","www.vodafone.com.tr"], "manualMethod": "phone",
      "referenceVerified": false, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "tr/tr-mobile-operator-rehber.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for full name, phone number. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." },
    {
      "id": "tr-nosorgulama",
      "name": "No Sorgulama (nosorgulama.com.tr)",
      "domain": "nosorgulama.com.tr",
      "url": "https://www.nosorgulama.com.tr/iletisim/",
      "referenceUrl": "https://www.nosorgulama.com.tr/iletisim",
      "countries": [
        "TR"
      ],
      "fields": [
        "full_name",
        "email",
        "request_text"
      ],
      "automationLevel": "companion",
      "availability": "reviewed_initial_form",
      "allowedHosts": [
        "nosorgulama.com.tr",
        "www.nosorgulama.com.tr"
      ],
      "manualMethod": "web_form",
      "referenceVerified": true,
      "referenceCheckedAt": "2026-10-21",
      "sourceCatalog": "tr/tr-nosorgulama.json",
      "cluster": null,
      "covers": [],
      "steps": [
        "Enter your own name, contact email and plain request inside Erase Me. The companion selects the removal topic. In Review form batch, enable optional guarded submission after reviewing the exact KVKK/privacy notice and policy sources. Unreviewed changes or challenges stop the action.",
        "Confirm that the target information is your own before filling. Never submit for an unrelated person without explicit authorization.",
        "Form preparation is not request acceptance or deletion. Review the broker response and complete its required verification."
      ],
      "evidence": "The official POST form, exact notice and permitted fields were checked read-only on November 5. Optional guarded submission records an attempt only; correct-record matching, acceptance and deletion remain unverified.",
      "requiredAffirmations": [
        "own_request"
      ],
      "automationMode": "prefill",
      "inspectedAt": "2026-11-05"
    },
    {
      "id": "tr-numaraara",
      "name": "NumaraAra",
      "domain": "numaraara.com",
      "url": "https://www.numaraara.com/iletisim",
      "countries": [
        "TR"
      ],
      "fields": [
        "full_name",
        "email",
        "request_text"
      ],
      "automationLevel": "companion",
      "availability": "reviewed_initial_form",
      "allowedHosts": [
        "numaraara.com",
        "www.numaraara.com"
      ],
      "manualMethod": "web_form",
      "referenceVerified": true,
      "referenceCheckedAt": "2026-10-21",
      "sourceCatalog": "tr/tr-numaraara.json",
      "cluster": null,
      "covers": [],
      "steps": [
        "Write and review a request for your own number or listing inside Erase Me. You can fill the official form, or explicitly approve its reviewed KVKK agreement and optional guarded submission.",
        "Confirm that the target information is your own before filling. Never submit for an unrelated person without explicit authorization.",
        "The optional free local challenge helper can recognize this form’s reviewed five-character image code. Unresolved challenges stop submission. Hidden CSRF and form fields remain page-owned.",
        "A checked native submit event establishes an attempt, not request acceptance or deletion. Review the broker response and complete its required verification."
      ],
      "evidence": "The official initial form contract was inspected without entering personal data or submitting. Later identity matching, request acceptance and deletion remain unverified.",
      "requiredAffirmations": [
        "own_request"
      ],
      "automationMode": "prefill",
      "inspectedAt": "2026-11-05"
    },
    {
      "id": "tr-numarasor",
      "name": "numarasor.com",
      "domain": "numarasor.com",
      "url": "https://www.numarasor.com/numara-kaldirma-talebi",
      "countries": [
        "TR"
      ],
      "fields": [
        "full_name",
        "email",
        "phone",
        "request_text"
      ],
      "automationLevel": "companion",
      "availability": "reviewed_initial_form",
      "allowedHosts": [
        "numarasor.com",
        "www.numarasor.com"
      ],
      "manualMethod": "web_form",
      "referenceVerified": true,
      "referenceCheckedAt": "2026-10-21",
      "sourceCatalog": "tr/tr-numarasor.json",
      "cluster": null,
      "covers": [],
      "steps": [
        "Enter your own target phone number, name, contact email and request inside Erase Me. The companion selects the number-owner option. In Review form batch, optional guarded submission sends only those reviewed fields. The site may request additional ownership evidence later; Erase Me uploads no ID or payment.",
        "Confirm that the target information is your own before filling. Never submit for an unrelated person without explicit authorization.",
        "Form preparation is not request acceptance or deletion. Review the broker response and complete its required verification."
      ],
      "evidence": "The official POST form, exact notice and permitted fields were checked read-only on November 5. Optional guarded submission records an attempt only; correct-record matching, acceptance and deletion remain unverified.",
      "requiredAffirmations": [
        "own_request"
      ],
      "automationMode": "prefill",
      "inspectedAt": "2026-11-05"
    },
    {
      "id": "tr-telefonsorgulama",
      "name": "TelefonSorgulama",
      "domain": "telefonsorgulama.com",
      "url": "https://www.telefonsorgulama.com/iletisim.html",
      "countries": [
        "TR"
      ],
      "fields": [
        "full_name",
        "email",
        "request_text"
      ],
      "automationLevel": "companion",
      "availability": "reviewed_initial_form",
      "allowedHosts": [
        "telefonsorgulama.com",
        "www.telefonsorgulama.com"
      ],
      "manualMethod": "web_form",
      "referenceVerified": true,
      "referenceCheckedAt": "2026-10-21",
      "sourceCatalog": "tr/tr-telefonsorgulama.json",
      "cluster": null,
      "covers": [],
      "steps": [
        "Write a removal request for your own number. The companion selects the removal topic; the site retains its CAPTCHA/token and final submission controls.",
        "Confirm that the target information is your own before filling. Never submit for an unrelated person without explicit authorization.",
        "Form preparation is not request acceptance or deletion. Review the broker response and complete its required verification."
      ],
      "evidence": "The official initial form contract was inspected without entering personal data or submitting. Later identity matching, request acceptance and deletion remain unverified.",
      "requiredAffirmations": [
        "own_request"
      ],
      "automationMode": "prefill",
      "inspectedAt": "2026-11-04"
    },
    { "id": "tr-turkcell-rehber", "name": "Turkcell Rehber and Bilinmeyen Numaralar", "domain": "turkcell.com.tr", "url": "https://www.turkcell.com.tr/servisler/arama-fatura-tl/bilinmeyen-numaralar",
      "countries": ["TR"], "fields": [], "automationLevel": "manual", "availability": "unverified_current", "allowedHosts": ["turkcell.com.tr","www.turkcell.com.tr"], "manualMethod": "phone",
      "referenceVerified": true, "referenceCheckedAt": "2026-10-21", "sourceCatalog": "tr/tr-turkcell-rehber.json", "cluster": null, "covers": [],
      "steps": ["Open the linked official privacy or opt-out instructions for your own information.","The broker may ask for phone number. Enter any required details directly on that site. Erase Me does not collect them for this manual route.","Complete the broker’s required verification and save its response. No request is sent by Erase Me for this manual route.","Stop if the route requires payment or an identity-document upload."], "evidence": "Official reference route from the existing country pack. Its current form, request acceptance and deletion outcome have not been validated for this browser app." }
  ];
  // Channel inspection is not accepted-request or deletion evidence.
  for (const route of routes) {
    const review = audit && audit[route.id];
    if (!review) continue;
    route.review = review; route.operationKind = review.operationKind;
    if (review.privacyContact) route.privacyContact = review.privacyContact;
    if (review.manualContact) route.manualContact = review.manualContact;
    if (route.automationLevel === 'manual' && !route.transientPrefill) {
      route.steps = [review.summary, review.limits, 'No request is sent automatically. An acknowledgment, registration or provider preference is not verified deletion.'];
      route.evidence = 'Official-channel review: ' + review.checkedAt + '. ' + review.status + '. No request acceptance or deletion was observed.';
    }
  }
  // A common owner is not evidence that one request covers every affiliated
  // service. Only the four brands explicitly named by the inspected portal get
  // a shared manual guide; no action or removal state propagates between them.
  const peopleConnectBrands = ['intelius', 'truthfinder', 'instantcheckmate', 'ussearch'];
  const searchableDirectories = new Set(['ca-411', 'canada411', '192com', 'gb-peopletraceuk', 'ukphonebook', 'tr-nosorgulama', 'tr-numaraara', 'tr-numarasor', 'tr-telefonsorgulama']);
  for (const route of routes) route.searchable = route.countries.includes('US') || searchableDirectories.has(route.id);
  for (const route of routes.filter(item => item.cluster === 'peopleconnect')) {
    route.covers = [];
    if (peopleConnectBrands.includes(route.id)) {
      route.manualGroup = 'peopleconnect'; route.groupRouteId = 'intelius';
      route.steps = ['Use the PeopleConnect self-service suppression center once for your own request. It names Intelius, TruthFinder, Instant Checkmate and US Search.',
        'The portal describes suppression of name-based background reports. It does not promise removal from every phone, address or email report, or other affiliated brands.',
        'Enter required details and complete verification directly on the official portal. This is a manual personal-use route for eligible US users. No request is sent by Erase Me for this manual route, and no shared-mail automation is offered.',
        'Stop if the portal requires payment, an identity-document upload or access that is not authorized.'];
      route.evidence = 'Official self-service login and four-brand description inspected. Later matching, request acceptance and deletion have not been validated. No request is sent by Erase Me for this manual route.';
    } else {
      route.steps.push('A historical PeopleConnect affiliation does not establish that the current suppression center covers this brand. Confirm its official instructions separately.');
    }
  }
  return Object.freeze(routes.map(route => Object.freeze({ ...route,
    countries: Object.freeze(route.countries), covers: Object.freeze(route.covers || []), requiredAffirmations: Object.freeze(route.requiredAffirmations || []), fields: Object.freeze(route.fields), allowedHosts: Object.freeze(route.allowedHosts), steps: Object.freeze(route.steps) })));
});
