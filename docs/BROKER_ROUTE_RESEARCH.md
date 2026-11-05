# Browser companion route research

Inspected November 4, 2026 through a separate gstack Chromium browser session.
The form and terms inspections were read-only: no personal data, submission, CAPTCHA
attempt or inbox access was used for those inspections. Later authorized live-pilot
observations are identified separately below without personal data. Results are specific
to this environment, not a claim that a broker is universally accessible or unavailable.

## Coverage is a sequence

A supported prefill means the initial official form and controls were observed.
It does not establish a matched listing, successful submission, completed request,
or deletion. The application should keep at least these states distinct:

1. Official form opened.
2. Fields filled locally in the broker tab.
3. User action required, including CAPTCHA or verification email.
4. Verification initiation observed, using a fresh visible success state.
5. Final broker request accepted, using evidence from the actual second form.
6. Broker-reported completion.
7. Previously matched listing independently verified absent.

Unknown writes must stop for reconciliation. Reopening a workspace must not
repeat a request. An HTTP error, empty result set, missing selector, closed tab,
or user completion report never proves deletion.

## Current first-form contracts

These selector contracts were observed directly today. Keep an exact HTTPS
origin allowlist and a specific purpose path. A browser companion should check
that each required control is visible and enabled, confirm its type and form,
and recheck the page after filling before offering submission. Stop for an ID
upload or an unfamiliar page. Normal site JavaScript must receive native input
and change events. Do not call `form.submit()` to bypass site handlers.

### People Data Labs

- Official entry: <https://privacy.peopledatalabs.com/policies?action=ERASURE&modal=log-in>.
- Exact origin: `https://privacy.peopledatalabs.com`.
- Purpose: path `/policies`, one `action=ERASURE`, one `modal=log-in`.
  Reject missing, conflicting or duplicate purpose parameters.
- Field: `input#pc-email-login-input[name="email"][type="email"]`.
- Submit: `button#email-login-submit[type="submit"]`, associated with a form
  whose action resolves to the same deletion-purpose URL.
- No CAPTCHA or identity-upload control was visible in today's initial form.
- The existing authorized pilot on October 29 observed a new visible
  `[role="alert"]` with exact text `Email sent!`. Today no new submission was
  performed. That evidence establishes verification initiation only.
- The person must open the broker's email and finish its deletion portal.
- No final accepted-request or independent deletion contract has been observed.

### Apollo

- Official entry: <https://www.apollo.io/privacy-policy/remove>.
- Exact origin: `https://www.apollo.io`, path `/privacy-policy/remove`.
- Field: `input#email[name="email"][type="email"]`, required.
- The containing form has no stable ID, a default GET method and an action that
  resolves to the same page. Its only submit button is `button[type="submit"]`
  within that form. Scope the button through the email field's containing form,
  not through all buttons in the page.
- The initial submit label asks for verification information. No CAPTCHA or
  identity-upload control was visible in this form.
- The page specifically requests a **business email**. Do not silently replace
  a user's address or assume that a personal email will be accepted.
- The page explains that the supplied address is retained to respect the opt-out
  preference. Supply only the user's explicitly approved address.
- The companion supports guarded prefill only after an explicit per-route business
  email and affirmation. The profile email and service mailbox are never substituted.
- No success, email-verification, final-request or removed-record state was
  observed. Submission and verification remain user steps; an unreviewed outcome
  stays unknown until evidence exists from an authorized run.
- The earlier `privacy@apollo.io` email route bounced and remains disabled.

### USPhonebook

- Official entry: <https://www.usphonebook.com/removal>.
- Exact origin: `https://www.usphonebook.com`, path `/removal`.
- Form: `form#verifyEmailForm`, POST, action resolves to `/removal` on that origin.
- Requester: `select#user-type[name="user-type"]`, use `subject` only for the
  actual person requesting their own removal. The other observed value is `agent`.
- Required fields: `input#subject-firstname[type="text"]`,
  `input#subject-lastname[type="text"]`, `input#subject-email[type="email"]`.
- Optional field: `input#subject-middlename[type="text"]`.
- Required consent: `input#agreement[type="checkbox"]`.
- Submit: `button#BRP[type="submit"]`.
- The first form contains reCAPTCHA Enterprise. Its token is not an application
  field and must not be forged or treated as solved merely because it exists.
- The page describes an emailed link, a second record-matching opt-out form,
  a final request confirmation and processing time. The email link is valid
  for 24 hours. The stated processing period is three days after the final form.
- The initial inspection did not reach successful first submission or the second
  form. A later November 4 live validation reached the official second form and
  observed rejection without either date of birth or street address, despite those
  inputs lacking HTML `required` attributes. The person enters one directly on the
  broker form; Erase Me does not collect or autofill it. Final request acceptance
  and deletion remain unverified. No successful listing-match selectors or
  verified-absence contract exists.
- Agent fields are present but are outside a self-service companion's scope.
- First and last names must be supplied explicitly. Do not guess a split from
  a full name and silently submit the result.

### SearchPeopleFree

- Official entry: <https://www.searchpeoplefree.com/opt-out>.
- Exact origin: `https://www.searchpeoplefree.com`, path `/opt-out`.
- Form: `form#o_form`. The DOM has a default GET method and same-page action,
  but site JavaScript intercepts submission.
- Fields: `input#o_first[type="text"]`, `input#o_last[type="text"]`,
  `input#o_email[type="email"]`. Middle name `input#o_middle` is optional.
  The fields lack `name` attributes, so native form serialization is insufficient.
- Consent: `input#o_terms[type="checkbox"]` identifies the requester as the person
  associated with the supplied email. This does not validate a shared service alias.
  New shared-contact sessions are disabled; the person uses their typed email.
  Existing signed capabilities remain available for authenticated held-only checks.
- Submit: `button#o_submit[type="submit"]`.
- CAPTCHA: `.cf-turnstile`. The companion must stop for a user challenge.
- `#o_success` and `#o_success_sent` both exist **hidden in the initial DOM**.
  `#o_success_sent` initially describes email sending. Existence, nonempty text,
  or a transient sending state is not acceptance.
- Prior source inspection recorded a POST to `/proxy/api/anonymous/begin` and
  a callback redirect to `/opt-out/email`. A direct public GET of `/opt-out/email`
  displays generic initiation/email-sent text without any submitted session. That
  path or static text cannot establish success. Do not submit directly to the API.
  No current observer acceptance contract is enabled for this route.
- The email begins a removal session in which the person must find and remove
  their own record. The page explains a three-day processing period after the
  final request. No final form or deletion evidence was observed today.

### FastPeopleSearch

- Official entry: <https://www.fastpeoplesearch.com/optout>.
- Exact origin: `https://www.fastpeoplesearch.com`, path `/optout`.
- Form: `form#optout-start`, POST, action on the same origin at
  `/optout-start-submitted`.
- Requester: `select[name="am"]`, required, with `subject` and `agent` values.
  Self-service requests select `subject` only with the person's authorization.
- Required fields: `input#firstname[name="firstname"][type="text"]`,
  `input#lastname[name="lastname"][type="text"]`,
  `input#email[name="email"][type="email"]`.
- Optional middle name: `input#middlename[name="middlename"]`.
- Consent: `input[name="legal"][type="checkbox"]`, required.
- Submit: `form#optout-start button[type="submit"]`.
- CAPTCHA: `.cf-turnstile`.
- This is another email-link initiation form followed by a record-matching
  second form. The page describes a 24-hour link and a three-day processing
  period after final submission.
- No first-submit success selector, final second-form action, independent
  identity-match contract or deletion evidence has been observed.
- Conditional agent identity fields must not be populated for self requests.

### Spokeo

- Official entry: <https://www.spokeo.com/optout>, accessible in the current inspection.
  The earlier 403 observation is historical.
- Exact origin `https://www.spokeo.com`, path `/optout`, without query or fragment.
- The form has no stable ID, GET method and same-page action. Scope it through
  `input[name="url"][type="url"]`; require its `input[name="email"][type="email"]`
  and scoped submit button labeled `OPT OUT` to belong to that same form.
- The person supplies a direct record URL and explicitly confirms that it is their
  own listing. Reviewed paths use four segments: name, city, state abbreviation,
  record ID; or name, full state, city, record ID. The final segment is `/p` plus digits.
  Search pages, purchase links, query parameters, fragments and credential-bearing
  URLs are rejected. A name match alone is not ownership evidence.
- The companion only fills these authorized fields. Submission, any CAPTCHA and the
  broker confirmation email remain user steps. No accepted-request, authenticated
  confirmation-link or independent-deletion contract was observed.

### PeopleConnect

- Official <https://suppression.peopleconnect.us/> redirects to `/login`.
- The public form has no stable ID, GET method and same-page action. It contains
  `input[name="login-email"][type="email"]`, a required consent checkbox and a
  scoped Continue button. Later verification and record matching were not observed.
- The public description names Intelius, TruthFinder, InstantCheckmate and USSearch,
  and limits its suppression description to background reports returned by name search.
  Common ownership does not prove suppression of other brands or report types.
- The [official terms](https://peopleconnect.us/terms-of-use) restrict personal use,
  third-party services, automated access and use outside the US or its territories
  without approval. The app provides a manual personal-use guide for eligible users,
  centered on the Intelius route; no service-mail automation or cross-brand outcome
  propagation is enabled.

## Routes blocked during this inspection

| Route | Result | Effect |
| --- | --- | --- |
| <https://www.smartbackgroundchecks.com/remove> | HTTP 403, blank rendered body | Earlier October 28 selectors remain historical research only. |
| <https://nuwber.com/removal/link> | Managed access-block page, no removal form | No current form contract; manual guidance remains. |

No fallback endpoint or selector was invented to work around these responses.

## Implications for the public app

A free browser workspace can store a real person's own details and their request
ledger on their device, and a narrowly permissioned companion can open and fill
these official forms in that same person's browser. This avoids giving the host
an inbox connection or retaining people's profiles in serverless storage.

It cannot prove broker acceptance or deletion from these initial controls alone.
The public companion enables six initial actions: the historically observed email
initiation and five guarded prefill routes. SmartBackgroundChecks remains manual
after the access failure above. The 36 added country-pack reference links are manual
guidance, not newly validated browser contracts. Broader
fully automatic removals need actual accepted-request and absence evidence from
consenting subjects, not a change to an `enabled` flag. The browser workspace
should explain where the user's details stay and exactly which broker fields
leave the device when a submission is made.


## Existing-tab reconciliation

The explicit `observe` action reads only the tab reserved for the original operation.
Only People Data Labs and the USPhonebook first stage have enabled success contracts.
The companion records a pre-action form-present/success-absent baseline and owned tab
metadata. A trusted native submit event with matching approved fields creates a
nonce-only proof in browser-session storage. Expected field values remain transient;
no profile fields enter the operation journal.

Observation requires that current session proof and tab/document lineage. People Data
Labs requires its same-document exact fresh alert. USPhonebook requires a new document,
the initial form absent, its specific headings and one exact visible acknowledgment
paragraph. Missing, stale, forged or unsupported evidence stays unknown. Observation
never sends a request, reads mail or starts polling, and can establish only verification
initiation, never final request acceptance or deletion.
