# Browser companion route research

Inspected November 4, 2026 through a separate gstack Chromium browser session.
The form and terms inspections were read-only: no personal data, submission, CAPTCHA
attempt or inbox access was used for those inspections. Later authorized live-pilot
observations are identified separately below without personal data. Results are specific
to this environment, not a claim that a broker is universally accessible or unavailable.

A November 5 recheck of the official FastPeopleSearch and NumaraAra forms and their
form scripts informs the two companion 0.5.0 submission contracts described below.
The latest Spokeo inspection returned HTTP 403. These source checks establish no
new accepted request, live structured-record match or verified deletion. References
to “today” in the original first-form notes refer to the November 4 inspection.

A further November 5 check loaded the official FastPeopleSearch form with HTTP 200
and the expected consent and controls. Its response field stayed empty in a separate
headless browser. In an ordinary visible, isolated Chrome session, the normal
Turnstile widget supplied a nonempty response automatically while the form remained
blank. No challenge click, fabricated token, paid service, personal data entry or
submission was used in those checks. This establishes normal widget readiness in
that session, not request acceptance or deletion.

## Coverage is a sequence

A supported prefill means the initial official form and controls were observed.
It does not establish a matched listing, successful submission, completed request,
or deletion. The application should keep at least these states distinct:

1. Official form opened.
2. Fields filled locally in the broker tab.
3. A guarded submission attempted, when the route has an approved contract.
4. Outstanding user action, including unsupported CAPTCHA or verification email.
5. Verification initiation observed, using a fresh visible success state.
6. Final broker request accepted, using evidence from the actual final form.
7. Broker-reported completion.
8. Previously matched listing independently verified absent.

`submission_attempted` proves only that the guarded native submit event was observed.
It does not prove network delivery, server acceptance, challenge passage or deletion.

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
- The November 5 contract permits an optional guarded initial submission after
  review of its exact communications/authorization agreement. It requires the
  normal widget's real Turnstile response; no token is invented. The fixed stage
  is `verification_initiation`, while the result remains `submission_attempted`
  until a separate fresh broker acknowledgment proves more.
- Conditional agent identity fields must not be populated for self requests.
- Companion 0.6.0 allows one event-driven foreground wait of at most 12 seconds for
  the real widget response. The exact approved form is validated first and the
  original document, destination, controls, values and agreement stay pinned.
  Changes or navigation stop the wait. No polling or challenge click is introduced;
  an unresolved managed challenge still needs attention.

### Spokeo

- Official entry: <https://www.spokeo.com/optout>, accessible on November 4.
  The November 5 inspection returned HTTP 403, so current access is unverified.
- Exact origin `https://www.spokeo.com`, path `/optout`, without query or fragment.
- The form has no stable ID, GET method and same-page action. Scope it through
  `input[name="url"][type="url"]`; require its `input[name="email"][type="email"]`
  and scoped submit button labeled `OPT OUT` to belong to that same form.
- The person supplies a direct record URL. Own-listing approval can be a separate
  manual affirmation or the narrow structured-record check described below.
  Reviewed paths use four segments: name, city, state abbreviation,
  record ID; or name, full state, city, record ID. The final segment is `/p` plus digits.
  Search pages, purchase links, query parameters, fragments and credential-bearing
  URLs are rejected. A name match alone is not ownership evidence.
- The companion only fills these authorized fields. Submission, any CAPTCHA and the
  broker confirmation email remain user steps. No accepted-request, authenticated
  confirmation-link or independent-deletion contract was observed.

### AdvancedBackgroundChecks

- Official entry: <https://www.advancedbackgroundchecks.com/opt-out>.
- Exact HTTPS origin and `/opt-out` path; the reviewed containing form uses GET and
  the same-page action. Inputs are `#sfn`, `#sln` and `#semail`, with a scoped Submit
  control. The companion selects only `#mode=subject` after an own-request affirmation.
- Version 0.9.0 adds an optional guarded initial submission after review of the
  exact communications agreement and policy sources. The normal site security handler
  remains responsible for its challenge. Email continuation and the unobserved second
  form remain outstanding; neither acceptance nor deletion was observed.

### Turkish request forms

All four require a separate own-request affirmation and review of each displayed field.
Request text is plain Unicode text, retaining line breaks, not executable content.
NumaraAra has the separate optional 0.5.0 consent, text-code and submission contract
below. Version 0.9.0 also adds guarded submission for No Sorgulama and NumaraSor;
TelefonSorgulama remains guarded prefill only. The companion does not forge
hidden tokens, upload ID or perform phone/SMS verification. An unreviewed challenge or
unfamiliar page needs attention.

| Route and exact purpose path | Approved fields | Reviewed destination/selection |
| --- | --- | --- |
| [No Sorgulama](https://www.nosorgulama.com.tr/iletisim/), `/iletisim/` | `#ic-ad`, `#ic-email`, `#ic-mesaj` | Same-page POST; `#ic-konu=profil-kaldir` |
| [NumaraAra](https://www.numaraara.com/iletisim), `/iletisim` | `#form_AdSoyad`, `#form_Eposta`, `#form_Mesaj` | `form#contactForm`, POST `/Contact/ContactFormSend`; removal-topic option |
| [NumaraSor](https://www.numarasor.com/numara-kaldirma-talebi), `/numara-kaldirma-talebi` | `#name`, `#email`, `#number`, `#reason` | Same-page POST; `#relation=Numara sahibiyim` |
| [TelefonSorgulama](https://www.telefonsorgulama.com/iletisim.html), `/iletisim.html` | Scoped name/email/message fields in `#iletisimForm` | POST `/iletisim-gonder.php`; subject `kaldirma` |

NumaraSor’s target phone number must belong to the requester. The other contracts do
not add a phone field. Final server validation, record matching, request acceptance and
deletion remain unverified for all four.

The November 5 NumaraAra contract checks the required `#form_Kvkk` agreement and its
single link to the [official KVKK notice](https://www.numaraara.com/kvkk-aydinlatma-metni).
Its `#form_ResimKodu` answer field has a five-character limit. The reviewed
`#captcha_imgContactResimKodu` image is 130 by 40 pixels and comes from the same-origin
`/captcha` path with exactly `pid` and `transparent=1` parameters. One optional local
Tesseract attempt supplies only ASCII text. The original image pixels, destination,
fields, controls and agreement are checked again before the native submit control is
used. The fixed stage is `request_submission`; its result remains an attempt, with
no newly observed server-acceptance or deletion contract.

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

## Version 0.6.0 execution boundaries

`extension/automatic-executor.js` defines only two immutable submission contracts:
FastPeopleSearch's [initial opt-out form](https://www.fastpeoplesearch.com/optout)
and NumaraAra's [contact/removal form](https://www.numaraara.com/iletisim). Contract
identifiers bind the November 5 review. The workspace displays the applicable
agreements before automation is enabled; runtime checks require the same text,
policy destination, purpose and controls. An earlier alert, additional unexpected
field, changed challenge or changed document stops the action.

The optional submission contracts were introduced in 0.5.0. Version 0.6.0 adds
`waitReady()` for FastPeopleSearch before the existing capture/submission sequence.
It observes DOM and input/change events on the original approved form, plus one
12-second foreground deadline with a final response read. A `pagehide` event or
changed document, URL, control, field value or agreement stops it. Observers and
listeners are removed when the wait settles. It neither clicks a challenge nor
returns its response token to the workspace, and creates no recurring work or
additional vendor permissions.

Each operation is consumed before the submit control is activated. No direct API
request, `form.submit()` bypass, automatic retry or fabricated vendor token is used.
The new result is `submission_attempted`, with its route stage and checked-event
evidence. No fresh accepted-request or deletion contract was observed for either
route. Later native navigation can also leave the result unknown and held for
reconciliation.

NumaraAra's image code uses the optional [local challenge helper](LOCAL_CHALLENGE_HELPER.md).
The provider also has an audio-recognition interface, but this release does not
enable a Chrome reCAPTCHA audio flow or guarantee managed-challenge passage.

The Spokeo structured-record reader is a conservative code contract tested with
synthetic `Person` JSON-LD. It requires the approved page URL to match the record's
`url` or `@id`, one compatible person, the exact normalized name and the typed
identity email. Age and city alone cannot establish approval. Missing or malformed
data, conflicts, ambiguity and blocked pages stay unresolved. No live matching
result was established by the November 5 HTTP 403 response, and a match would still
be distinct from submission or deletion.

The dedicated-mail session checks existing scoped contacts once. USPhonebook's reviewed
second form and FastPeopleSearch's exact matching-form link can be released after
reauthentication and field review. Missing identity details and final broker steps
remain outstanding, and the held USPhonebook pilot remains held.

### November 5 authorized FastPeopleSearch verification pilot

An ordinary visible Chrome session received a genuine Turnstile response and submitted
the initial form once for the authorized subject, using a new removal-only contact.
The resulting email passed the relay's exact recipient, official sender, timestamp and
Gmail authentication checks. Its destination was exactly the official `/optout/removal`
path with `firstname`, empty `middlename`, `lastname`, `email` and numeric `ticketid`.
Plain-text and HTML destinations canonicalized to the same link after one entity decode.
The link was opened once, after journaling the action outside the repository.

The matching form is `form#optout-removal`, POST to the same origin and path with no
query in its action. It contains prefilled first/last/contact fields and a hidden
ticket reference. Date selectors are named `dobMonth`, `dobDay` and `dobYear`; the
address, city, state, ZIP and phone controls use `streetAddress`, `city`, `state`,
`zipcode` and `phone`. The page says date of birth is required when street address
is absent, and vice versa. City, state and ZIP are required. Phone has no asterisk
in its label despite initial HTML `required` attributes. The accuracy checkbox and
normal Turnstile widget remain final broker steps.

Companion 0.6.0 validates and reads this matching form after the authenticated link
opens; it does not enter new identity details, certify accuracy or submit it. The
live run is awaiting a full date of birth or street address. No final erasure request
acceptance, correct-record match or independently verified deletion was established.
No personal inbox or held USPhonebook action was accessed during this pilot.

## Implications for the public app

A free browser workspace can store a real person's own details and their request
ledger on their device, and a narrowly permissioned companion can open and fill
these official forms in that same person's browser. Personal inboxes remain
disconnected, and profiles are not retained in serverless storage. The optional
removal-only mailbox is a separately gated operator relay.

It cannot prove broker acceptance or deletion from these initial controls alone.
The public companion enables eleven initial actions: the historically observed email
initiation and ten guarded prefill routes. Version 0.5.0 adds optional guarded
submissions for FastPeopleSearch and NumaraAra over those existing routes, plus the
local text-code helper and narrow structured-record check. The source-backed audit covers all 37 routes
outside the first six, including blocked pages, manual provider channels, registrations
and the five additional initial forms. SmartBackgroundChecks remains manual after the
access failure above. An audit is not proof of an accepted request or automatic removal. Broader
fully automatic removals need actual accepted-request and absence evidence from
consenting subjects, not a change to an `enabled` flag. The browser workspace
should explain where the user's details stay and exactly which broker fields
leave the device when a submission is made.


## Existing-tab reconciliation

The explicit `observe` action reads only the tab reserved for the original operation.
Only People Data Labs and the USPhonebook first stage have enabled success contracts.
The companion records a pre-action form-present/success-absent baseline and owned tab
metadata. A trusted native submit event with matching approved fields creates a
nonce-bound proof in browser-session storage. Expected field values remain transient;
no profile fields enter the local operation journal. USPhonebook response correlation
also uses an opaque keyed name/email fingerprint and a random HMAC key kept only in
browser-session storage; losing that proof leaves the outcome unknown.

Observation requires that current session proof and tab/document lineage. People Data
Labs requires its same-document exact fresh alert. USPhonebook requires a new document,
the initial form absent, its specific headings and one exact visible acknowledgment
paragraph. Missing, stale, forged or unsupported evidence stays unknown. Observation
never sends a request, reads mail or starts polling, and can establish only verification
initiation, never final request acceptance or deletion.


## Remaining-channel audit and contact alternatives

`webapp/static/broker-audit.js` contains the 37 official-channel reviews, with date,
source links, observed status, channel kind and limitations. It is recursively frozen
static metadata with no person or request data. The route catalog attaches these checks;
manual guidance uses the current review rather than an older generic unverified label.
A block, redirect or provider procedure is recorded as such, never counted as deletion.

There are 24 fixed contact alternatives. A contact verified for privacy requests can be
used to prepare a local own-record request after explicit review. Registry or uncertain
business/support addresses receive only a generic procedure question without identifiers.
Draft preparation, copy and download are browser-local; that feature has no sending endpoint. The optional local sender added in 0.12.0 is a separate reviewed action.
Published contacts are not tested deletion endpoints or evidence of accepted requests.

CMA Do Not Mail, Canada’s DNCL and the UK’s TPS are marketing-suppression registrations,
not removal of underlying broker records. Other provider phone, postal, directory and
subscriber-SMS instructions remain human actions. The app makes no calls, sends no SMS,
performs no paid lookup and does not promise a provider channel has no charges.

Validation uses synthetic fixtures and explicitly consenting own-record checks only.
No removal request is submitted for a random person to test a route. No independently
verified deletion has been established by these inspections or fixtures.

## Version 0.8.0 final matching-form contract

A November 5 read-only metadata check of the existing authenticated FastPeopleSearch
form found native required attributes on all three date selectors, street address and
phone, with form.noValidate and submitter.formNoValidate both false. No conditional
validation handler was observed. This conflicts with the page's DOB-or-address wording.
The application neither removes required attributes nor silently adds personal fields.

The new requirements probe returns only five boolean flags under the existing tab,
document, session and private URL proof. The in-app dialog explains the conflict before
offering an explicitly reviewed full-details variant. It normalizes US phone text to
(212) 555-0100 format and rejects changed requirement flags or unexpected field values.
The executor checks the exact accuracy statement and genuine widget response, uses the
native button, and records only a checked submit attempt. Sensitive values are transient;
only action references and bounded outcome metadata persist. Unsupported forms remain held.

Synthetic native-browser tests establish execution behavior, not live acceptance. The
personal pilot remains awaiting identity details; no final deletion was verified.

## Version 0.9.0 additional initial submission contracts

November 5 official-page checks used anonymous, read-only gstack browser sessions. No
personal fields were entered into these three forms and no request was submitted.

- [AdvancedBackgroundChecks](https://www.advancedbackgroundchecks.com/opt-out): exact
  subject selector and required first/last/email controls; same-page GET form, native
  noValidate=true, URL-encoded encoding and empty target. The review pins its exact
  three legal paragraphs and five policy URLs. Its own normal reCAPTCHA handler runs
  after a native button action. Erase Me neither reads nor writes that token.
- [No Sorgulama](https://www.nosorgulama.com.tr/iletisim/): same-page POST, subject
  profil-kaldir, required name/email/message, exact KVKK/privacy notice and two policy
  links. Optional phone and related-number fields remain empty.
- [NumaraSor](https://www.numarasor.com/numara-kaldirma-talebi): same-page POST,
  relation Numara sahibiyim, required own-number/name/email/reason. The review shows
  its warning that additional ownership evidence may be requested later. No ID is
  uploaded, and optional contact-phone fields remain empty.

Both POST forms have native validation enabled and an existing hidden anti-forgery
value. That value stays unchanged in document memory and is never returned to the
workspace or stored in an extension journal. Empty honeypot fields remain empty.
Unrecognized fields, new challenges, new documents or changed legal text stop the action.

All five initial contracts now pin the observed native form method, encoding, target
and validation flag. All reject submitter destination, method, target, encoding and
validation overrides, plus unapproved serialized submitter fields. Rechecks cover event
handlers and the trusted native submit event. The three new contracts require a new
companion capability before any selected batch operation is reserved.

The existing FastPeopleSearch and NumaraAra forms were also checked live on November 5:
URL-encoded POST forms, empty target, noValidate=false, empty submitter name/value and
no submitter override attributes. Synthetic native-browser checks validate the executor's
behavior; they do not establish live delivery, correct-record matching or deletion.

## Version 0.10.0 SearchPeopleFree initial contract

A November 5 read-only check confirmed form#o_form, same-page GET, URL-encoded encoding,
empty target and native validation enabled. Its exact own-email agreement and four
policy links are reviewed before the native action. Inputs have no name attributes;
the normal site handler intercepts submission. The companion uses that normal button,
requires the genuine Turnstile response, and never calls the site's internal API.
Hidden success/sending elements are not accepted as proof. A native event records an
attempt only. A per-user local-owned contact is allowed; shared operator aliases are not.

TelefonSorgulama's observed handler asynchronously calls form.submit() after its normal
security callback. That bypasses the current native submit event guard, so no automatic
contract was enabled. Its approved fields can still be entered in Erase Me and filled.

## Version 0.10.0 Apollo initial contract

A November 5 read-only check confirmed the required work-email input, its associated
label, the MUI fieldset and the exact **Get verification information** submit control.
The form uses same-page GET and has no consent checkbox or challenge. The workspace
requires a separately affirmed business email and displays Erase Me's own authorization
as such; it does not attribute that authorization to Apollo.

Because a native GET fallback would put the named email field into the URL, the
companion installs and pins an additional `form-action 'none'` CSP before disclosure.
This blocks default form navigation while permitting Apollo's normal React handler to
prevent default and make its own request. Local Chromium checks verified both paths
with synthetic data. The companion calls no internal broker API. Only the checked
initial event is recorded; later email verification and deletion remain unintegrated.

## Version 0.11.0 observations and contracts

Fresh anonymous November 5 inspection loaded USPhonebook's initial `/removal` form
with HTTP 200. The POST form's normal handler validates the email and permits its
native submission. The new contract pins the exact subject selection, agreement,
privacy and purpose text, empty optional agent fields, unchanged CSRF value and a
genuine Enterprise response. A bounded foreground wait does not manufacture a
response. Synthetic Chromium checks exercised native submission and rejected drift;
no live request or held pilot was submitted for this change.

People Trace UK's official `RequestRecordRemoval.asp` loaded with HTTP 200. The
single same-page POST form requires Full_Name, DOB day/month/year, Email_Address,
Telephone_Number and Postcode. Its separate address components are optional.
The new private review discloses exactly those values and obtains Erase Me's own
authorization; the site has no observed consent checkbox. Exact headings, purpose
paragraphs, policy links, labels and controls are pinned before and during filling.
The genuine reCAPTCHA response is left untouched. This is prefill only, with no
matched-record, acceptance or deletion evidence.

Spokeo, Nuwber and FamilyTreeNow returned HTTP 403 on fresh anonymous checks.
ClustrMaps refused the inspected connection. Those results do not establish global
unavailability and do not justify an invented form or completion adapter.
TelefonSorgulama retains its prior asynchronous-submit limitation.

## Version 0.12.0 official paths and marketing registration

Fresh anonymous inspection found SmartBackgroundChecks' cold opt-out entry blocked,
but its official privacy page publicly links the opt-out form. A fresh normal browser
confirmed privacy-first navigation to the canonical `/remove` form without account,
profile, cookie or header manipulation. The companion verifies the privacy purpose
and exact published link twice in the same document before fixed navigation. Only
the final subject/name/email form receives approved values. Hidden agent fields stay
empty; the exact agreement and genuine reCAPTCHA response are required for an optional
initial submit attempt. Later email, record matching and deletion remain unverified.

CMA's official `https://cmadnm.cawebhosting.ca/submit.asp` and same-origin validator
were inspected read-only. The native POST registers a mailing preference. Fixed list
and language controls, selected DNM service, exact policy/notices and canonical Canadian
mailing fields are pinned. Company, deceased-person and alternate-name controls remain
untouched. The separate private flow supports prefill and an optional unchecked
registration attempt. It sends no email, DOB or phone and stores no address values.
Synthetic native tests establish guarded execution, not registration acceptance.

Fresh DNCL and TPS pages expose early telephone steps; later purpose, consent and
outcome controls were not inspected using a real number. They remain guided marketing
registrations. 192.com remained blocked. Provider-owned subscriber, SMS, postal and
manual-only routes retain the specific boundaries in the stage matrix.

A normal visible desktop browser exposed Whitepages' first suppression step after a
headless inspection had been blocked. Its published `standardizeWpUrl.js` describes
a person URL with `/name/<name>/<location>/<id>`. The conservative reviewed adapter
requires that exact official origin/path shape, no query/fragment or paid/login URL,
and manual own-listing review. It pins the sole first-step text field, panel purpose
and Next control, uses normal input/change events and never clicks Next. Synthetic
native fixtures establish prefill behavior; they establish no live match, phone
verification, accepted request or deletion.

## Additional 0.12.0 observed contracts and privacy contacts

Later November 5 normal-browser inspection exposed FamilyTreeNow’s official privacy
entry and `/optout` form, superseding the earlier anonymous 403 observation for this
contract. The subject-only first/last-name and email POST targets
`/optout/beginoptoutidv`. Its exact privacy-request purpose, communications agreement,
anti-forgery fields, absent optional agent details and genuine hCaptcha are pinned.
The adapter can attempt initial verification once; email continuation, matching,
acceptance and deletion remain unverified. No held live request was submitted.

MyLife’s [official privacy request](https://www.mylife.com/privacyrequest) links
[the observed JotForm](https://mylife.jotform.com/260284407610047), titled
“DELETION AND OPT OUT OF SALE OF PERSONAL INFORMATION”. The transient contract pins
that purpose and fills only first name, last name, state, city, ZIP and birth year
after an exact own-information review. Email, phone, street and identity uploads
are excluded. Genuine challenge and final submission remain manual. This supersedes
the old inaccessible CCPA entry as a usable form observation, not as deletion evidence.

[That’s Them](https://thatsthem.com/optout) has a separate reviewed transient prefill
for the own name, contact email, street, city, state, ZIP and phone.
[PeopleFinders](https://www.peoplefinders.com/opt-out) has a separate matching-field
prefill for first/last name and US street, city and state. Its optional middle name,
email, phone and birth date stay untouched. Both pin the observed purpose and controls,
exclude extra identity values from persistence and leave genuine challenge, accuracy
certification and submission on the official site. Synthetic tests validate contract
boundaries, not live broker acceptance or independent removal.

The official [BeenVerified privacy FAQ](https://www.beenverified.com/faq/privacy/)
and [PeopleLooker privacy policy](https://www.peoplelooker.com/privacy-policy/)
publish own-information deletion/opt-out request procedures and respectively
`privacy@beenverified.com` and `privacy@peoplelooker.com`. Their privacy-rights sections
18.3, 19.12 and public-data opt-out section 19.13 support classifying these as privacy
contacts rather than registry-only support addresses. Written agent authorization
requirements are not generalized into an agent-send service: the implemented sender
accepts own-information requests only. Public-record suppression is distinct from
account deletion; no acceptance or deletion result has been established.

Seven fixed privacy contacts now have a separate optional native Gmail sender.
Its exact reviewed message, fresh optional sending consent and one-shot durable
outbox are documented in [local removal mail](LOCAL_REMOVAL_MAIL.md#reviewed-privacy-email-delivery).
Support/registry contacts and Vodafone’s recorded-sender instructions are excluded.
No credentials, real mail send, new pilot submission or recurring timer was used
for this implementation and its synthetic tests.

## November 6 reviewed additions

Normal browser readiness exposed TruePeopleSearch’s initial POST `/removal/beginremovalidv` form. Its 13-control contract keeps optional middle/agent fields blank, checks the own-subject/contact authorization, fixed policy sources, checkbox fallback and two genuine hCaptcha fields. Privacy entry is checked before a pinned form receives name/email. An optional guarded submit is only a verification-initiation attempt.

The four named PeopleConnect brands each expose a distinct association/relative opt-out in their own `app.<brand>.com/privacy-center/`. Public accordion readiness receives no identity fields. The reviewed six-field prefill is separate from retrieval, account deletion and complete background-report suppression. No action propagates between brands.

DNCL and TPS have exact first-number prefills; TPS public navigation selects Residential only. 192.com has an own-record four-field prefill, keeping optional telephone and other-person controls empty. Canada411’s FAQ publishes a web-only listing-removal modal with reviewed own-name, listed number, email and a fixed privacy reason; comments and challenge are untouched. None of these forms was submitted with real personal data. Later confirmation, matching and deletion remain unverified.
