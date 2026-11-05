# Browser companion route research

Inspected November 4, 2026 through a separate gstack Chromium browser session.
This was a read-only inspection. No personal data was entered, no request was
submitted, no CAPTCHA was attempted, and no inbox was accessed. Current results
are observations from this environment, not a claim that a broker is universally
accessible or unavailable.

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
- No success, email-verification, final-request or removed-record state was
  observed. Prefill can be guarded, but a submit outcome must remain unknown
  until evidence is obtained from an authorized run.
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
- Neither successful first submission nor the second form was inspected today.
  No successful listing-match selectors or verified-absence contract exists.
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
- Consent: `input#o_terms[type="checkbox"]`. Its meaning includes ownership of
  the provided email and permission for the broker to email the person.
- Submit: `button#o_submit[type="submit"]`.
- CAPTCHA: `.cf-turnstile`. The companion must stop for a user challenge.
- `#o_success` and `#o_success_sent` both exist **hidden in the initial DOM**.
  `#o_success_sent` initially describes email sending. Existence, nonempty text,
  or a transient sending state is not acceptance.
- Prior source inspection recorded a POST to `/proxy/api/anonymous/begin` and
  a callback redirect to `/opt-out/email`. These remain source observations,
  not observed live acceptance. Do not submit directly to that endpoint.
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

## Routes blocked during this inspection

| Route | Result | Effect |
| --- | --- | --- |
| <https://www.spokeo.com/optout> | HTTP 403 | No current form contract was observed. |
| <https://www.smartbackgroundchecks.com/remove> | HTTP 403, blank rendered body | Earlier October 28 selectors remain historical research only. |

No fallback endpoint or selector was invented to work around these responses.

## Implications for the public app

A free browser workspace can store a real person's own details and their request
ledger on their device, and a narrowly permissioned companion can open and fill
these official forms in that same person's browser. This avoids giving the host
an inbox connection or retaining people's profiles in serverless storage.

It cannot prove broker acceptance or deletion from these initial controls alone.
For today's validated scope, represent one historically observed email
initiation and four current prefill contracts, with explicit user steps. Broader
fully automatic removals need actual accepted-request and absence evidence from
consenting subjects, not a change to an `enabled` flag. The browser workspace
should explain where the user's details stay and exactly which broker fields
leave the device when a submission is made.
