# Public browser workspace

Updated November 5, 2026.

The hosted app accepts a self-attested profile and keeps it in this browser's local
storage. It needs no service account, email login, password or hosting database. It
does not upload the profile or ledger to the hosting API. Anyone using this browser
profile can read that workspace. Clearing site data removes it. Explicit export
creates a private JSON backup; an opted-in mail capability is included, so keep the
backup out of GitHub and shared storage.

## Actions and evidence

Saving a profile, editing location, opening the app and preparing a route plan do not
submit forms. The person starts an individual broker action or authorizes a reviewed
batch with its displayed fields.
There are no recurring checks, background alarms, inbox polls or automatic resubmissions.

Companion 0.5.0 can initiate People Data Labs email verification and prefill the initial
USPhonebook, SearchPeopleFree, FastPeopleSearch, Apollo, Spokeo, AdvancedBackgroundChecks
and four reviewed Turkish request forms. Optional guarded submission applies only to
FastPeopleSearch's initial verification form and NumaraAra's request form. The review
displays their exact agreements and fields before the person opts in. An observed safe
native submit event produces `submission_attempted`, not proof of delivery, acceptance
or deletion. Other forms retain their existing manual submission steps.

NumaraAra's one reviewed image challenge can use a separately installed free local
helper. Managed challenges still require the site's real accepted response. The private
mail pilot can prepare USPhonebook's reviewed second form after an authorized receipt
check and field review; missing identity details, its final accuracy statement, CAPTCHA
and final submission remain user steps. Other confirmation destinations remain held.
ID uploads are excluded, and the held USPhonebook pilot stays held.

Only a correlated companion result with fresh, visible broker acceptance evidence may
establish request acceptance. User reports remain self-reported. Imports downgrade
accepted history and receipt evidence to unverified history. Neither a receipt nor an
HTTP 404 establishes removal. The current public workspace has no general listing scanner
or verified deletion state: found and removed counts remain zero. The narrow structured-
record check below can establish only a candidate match for the approved form.

Apollo requires an explicitly entered business email and a separate authorization for
that route; neither a profile email nor a service alias is substituted. Spokeo requires a
direct person-record URL and an own-listing confirmation, supplied manually or through
the supported exact structured-record check. Changing the URL or relevant identity
fields invalidates the derived approval; backup imports cannot restore trusted match proof.

The operation ID is saved before companion dispatch. Interrupted operations are held,
not repeated. An explicit result read can reconcile the same operation later. Browser
mutations use an origin-wide exclusive Web Lock and reread current storage inside it;
browsers without that support fail closed. Another tab deleting the workspace prevents
a stale dispatch. The companion also reserves the stable operation ID to prevent duplicate
execution. Storage failures stop actions before dispatch.

## Reviewed form batch

**Review form batch** collects the current form details and route-specific confirmations,
then shows the official destination and exact outgoing fields for each eligible form.
It explains why held, already-started, incomplete and manual routes are excluded. Required
own-listing, business-email and own-request confirmations still apply; the app does not
infer a record match, split a full name or substitute a contact address.

The person can deselect forms, then check the initially unchecked batch authorization and
choose **Fill selected forms**. Changing the selection clears that authorization. The
companion checks access to every selected broker before starting and fills one form at a
time while the workspace page remains open. Optional submission automation adds only
two contracts: FastPeopleSearch verification initiation and NumaraAra request submission.
Their agreements are shown in the review and checked again against the broker's actual
form. Turning automation off retains prefill behavior. People Data Labs retains its
existing verification-email initiation; other routes remain prefill-only.

For an automated route, the companion pins the owned document and checks its exact
destination, purpose, fields, agreement, expected controls and challenge before using
the native submit control. A changed form, additional unexpected field or earlier alert
stops it. NumaraAra can use one local OCR attempt on the reviewed five-character image;
FastPeopleSearch needs its real Turnstile response. No token is fabricated. A checked
native form event records `submission_attempted`. Broker acceptance needs separate
fresh evidence; this release has no new accepted-request or deletion contract.

The review binds each selected route to its current workspace identity, country, stable
operation reference, exact effective email, other approved fields and route affirmations.
Immediately before each dispatch, the core validates that snapshot against current
storage, including any hold, pause or action started in another tab. It reserves the
operation only for the form about to run. A stale review or failed validation stops the
remaining queue; no changed fields are sent under an earlier approval.

**Stop after current form** lets the current action settle and leaves later forms
untouched. Closing the review also requests that stop. A known blocked form is recorded
for attention while other approved forms may continue. An unknown outcome, interrupted
companion connection or failed result persistence stops the remaining work for review.
Started operations remain protected from replay.

Batch selections, approved snapshots and queue progress live only in page memory. They
are not saved in local storage or private backups, and refreshing or reopening the page
never resumes an unfinished batch. Recorded per-route outcomes and operation references
remain in the normal ledger. No mailbox poll, scheduled retry or ID upload is introduced.

## Local text-challenge helper

The optional [local helper](LOCAL_CHALLENGE_HELPER.md) uses native host
`org.eraseme.challenge` and separately installed Tesseract for NumaraAra's reviewed
five-character image. The extension requests `nativeMessaging` only when the person
enables that helper. The host handles bounded image/audio recognition messages, not
URLs, arbitrary commands or profile fields. No model is downloaded and no daemon runs.

This release has no reviewed Chrome reCAPTCHA audio contract. Audio capability in the
underlying local provider does not enable arbitrary challenge solving. Managed
Turnstile responses must come from the normal site widget; failed or changed challenges
remain blocked. A recognized answer is not evidence of broker acceptance.

## Country coverage

The catalog has 43 reference routes, with eleven supported initial companion actions and
32 other guided channels. Reference coverage is separate from live integration or removal evidence.

| Catalog group | Reference routes | Initial companion actions |
| --- | --- | --- |
| Global portals: People Data Labs and Apollo | 2 | 2 |
| United States | 23 | 5 |
| Canada | 4 | 0 |
| United Kingdom | 5 | 0 |
| Germany | 2 | 0 |
| Turkey | 7 | 4 |

All 37 routes outside the first six now have a source-backed channel review in
`broker-audit.js`. It records a check date, observed availability, channel kind, sources
and limits. Five of those reviews support new initial prefills; blocked, unavailable,
registration and provider channels remain explicit guides. No audit entry establishes
request acceptance or deletion. Follow current official instructions and stop for payment
or an identity-document upload.

AdvancedBackgroundChecks requires an own-request affirmation before filling the reviewed
name/email form. No Sorgulama, NumaraAra and TelefonSorgulama accept an explicitly reviewed
name, contact email and plain request text. NumaraSor also needs the person’s own target
phone number. The companion selects only the reviewed self-request/removal option.
NumaraAra alone has the optional guarded request-form submission and image-code helper;
the other Turkish forms leave submission, consent, challenges and later verification to
the person.
Request text retains Unicode and line breaks and is set as a field value, never executed.
Only NumaraSor receives the separately approved phone field; no call or SMS is sent.

CMA Do Not Mail, Canada’s DNCL and the UK’s TPS are marketing-suppression registrations,
not deletion of broker records. Provider directory preferences, phone, postal and
subscriber-SMS instructions are also manual and have their own scope and possible
provider conditions. The application does not perform paid lookups or dial/send messages.

Without a country, only the two global portals appear and the app asks for a country.
Selecting a pack shows its regional references plus global portals. A country without a
pack sees an explicit coverage notice. This supports using the workspace internationally;
it does not guarantee that a global broker holds a person's record or accepts their request.
Started operations remain available for follow-up after a country change. Older inactive
route history stays in private exports. Existing workspaces add newly available routes
only through an explicit plan refresh.

First and last names are explicit broker fields, never inferred by splitting a full name.
Names and cities retain Unicode characters; email local-part case is preserved and domains
are normalized. A Spokeo listing URL must have an approved HTTPS host and a direct person-record
path ending in `/p` plus digits, using a reviewed state/city ordering, without credentials,
query parameters or fragment. A name or typed email alone does
not prove ownership of a broker record.

## Discovery, holds and existing-tab checks

**Find my listing** is an explicit search action on routes marked searchable. It opens a
fixed Google search URL containing only the broker domain, quoted profile name and
optional quoted city. Google receives those terms when the person chooses the action.
Erase Me does not fetch the results or infer a match. The action records a search-open
event without changing discovery, request or removal counts. Country, active-campaign,
route-hold and storage checks run before a URL is returned.

Spokeo's optional structured-record check opens only the approved direct listing URL.
It reads bounded JSON-LD `Person` data whose `url` or `@id` identifies that exact page.
Automatic own-listing approval requires one unique compatible record with the exact
normalized profile name and the person's typed identity email. The removal-only contact
alias is not substituted for that email. Age and city can reject conflicting evidence;
they cannot establish a match by themselves.

Missing data, masked identifiers, malformed structured data, conflicting candidates,
redirected pages and blocked access require attention. The check does not search for an
unprovided listing or treat a URL's name slug as proof. The latest live Spokeo research
returned HTTP 403; no current matched record or deletion has been verified. Match
outcomes remain separate from submission and removal counts. The extension journal
keeps only operation references and outcome/evidence tags, while the private workspace
binds the approved identity and candidate. Imports do not restore trusted match approval.

**Hold this route** saves a hold independently of its last outcome. A held route is displayed
as “On hold” and included in “Needs you.” New form, search, mailbox and continuation
actions stop until **Resume this route** is explicitly chosen. Holds survive private backups
and campaign pause/resume. Existing local results may still be reconciled without
clearing the hold. Resuming never discards operation IDs or permits a duplicate action.

**Check existing broker tab** observes only the tab reserved for the original operation.
It sends no form and reads no mailbox. Only People Data Labs and the USPhonebook first
stage have enabled observation contracts. A supported fresh verification acknowledgment
requires the companion’s original baseline, browser-session proof and a trusted native
submission with the approved fields. USPhonebook acknowledgment names and email are
checked against an opaque keyed fingerprint kept only in browser-session storage; raw
profile fields never enter the local operation journal. Missing proof, changed tabs or unsupported broker
responses remain unknown. Verification initiation still does not establish acceptance of
a final removal request or deletion.

PeopleConnect remains a manual personal-use guide for eligible US users. The current
portal names Intelius, TruthFinder, InstantCheckmate and USSearch, with limited
name-search suppression scope. Its guide does not propagate an outcome to affiliated
records or claim coverage of every search type.

## Official contact drafts

The audit supplies 24 fixed published contact channels. **Current route review** shows
source links, dates, observations and any provider-only instruction. **Official contact
alternative** distinguishes a purpose-verified privacy channel from a registry/business
support address. These sources are evidence of a channel, not acceptance of a request.

For a privacy contact, **Prepare private request** requires an own-information affirmation
and a public listing or other reference supplied by the person. The local text includes
the person’s name and that reference. For support contacts, **Prepare procedure question**
rejects any record reference and creates only a generic procedure inquiry, without the
profile name or identifiers. The recipient and source are fixed audited metadata.

The draft is returned to the browser for review, **Copy private draft** or **Download
private draft**. It is not sent, uploaded to the host, added to the activity log or included
in the saved ledger as a message body. Only the draft-preparation event is recorded. The
person chooses a suitable account and sends it themselves if they wish. No inbox,
SMTP/Gmail send permission, email endpoint or scheduled job is involved.

Route holds, country selection, campaign pause, malformed contacts and uncertain previous
outcomes stop draft preparation. Editing the reference or authorization clears the prior
visible draft. Preparing, copying or downloading text never changes accepted-request or
deleted-record counts.

## Dedicated removal-mail pilot

The optional relay uses a separate, removal-only Gmail account. It never connects to a
personal inbox. Connection uses [private OAuth setup](GMAIL_OAUTH.md); deployment and
receipt authentication are described in [the relay contract](AUTOMATIC_CONFIRMATIONS.md).
Configuration alone does not enable the private pilot. Session issuance and checks also
require explicit server activation and a separate operator access key.

The availability button is an explicit status read. When the pilot is enabled, operator
controls let a person authorize a dedicated contact for USPhonebook or FastPeopleSearch. The address and shared-account disclosure appear before use. The person
must review the broker's email-ownership and consent wording. The original profile email
is unchanged; People Data Labs and Apollo never receive a substituted contact address.
Before a broker action starts, the person can switch back to the typed email. After the
operation starts, its recipient stays fixed. SearchPeopleFree requires the person’s typed
email; new shared contacts are disabled. Existing signed SearchPeopleFree capabilities
remain valid for held-only receipt checks. An unstarted old shared contact must be
explicitly removed before choosing the typed email; no silent fallback occurs.

Per-route controls clear the private pilot key after each click. The optional batch or
mail-only pass takes the key from its password field, holds it only in session memory,
and clears it when the session is disposed. It is never stored in the workspace, backup
or URL. OAuth credentials never enter the browser. The
browser sends only route and operation references to obtain an alias, and a scoped bearer
capability to check it. The capability stays in private local storage and backups; it does
not grant relay access without the operator key.

An explicit `/check` returns pending or authenticated held metadata without a message body
or confirmation URL. USPhonebook's exact official `/removal/validate-record-info` route is
the sole reviewed continuation. An authorized `/continue` re-reads and authenticates
the same correlated receipt, then returns that form URL transiently to the browser. Other
links remain held. The URL never enters workspace history or private backups.

The batch can opt into one removal-mail pass after a supported verification initiation
or guarded submission attempt. A mail-only pass checks already-bound started operations
without opening or resending their initial forms. Each operation is checked once per
session. Aliases remain separately authorized per route; a session never creates one
silently. Pending mail produces `awaiting_mail` and starts no polling or later check.
Unknown results, stop, campaign pause and route holds prevent further work. The held
USPhonebook pilot is excluded.

Before continuing, the person reviews and authorizes first name, last name, city, state,
five-digit ZIP and the bound removal contact. These fields go directly through the
companion to the broker form, not to the relay. USPhonebook also requires either date of
birth or street address; the person enters one directly on its official form. Erase Me
does not collect or autofill those details, and phone number remains unfilled. The
companion leaves the final accuracy checkbox, CAPTCHA and submission to the person. An
interrupted continuation is held rather than replayed.

Live pilot evidence establishes first-form acceptance and a correlated authenticated
email. A final submission without date of birth or street address was rejected, despite
neither input being marked required in the HTML. Final request acceptance and deletion
remain unverified. Receipt checks and second form preparation never establish deletion.
The relay remains a private pilot, not an
unlimited public mail service. Free hosting, provider quotas and OAuth restrictions apply.

## Core interface and checks

The public build loads the broker catalog before the workspace core, automatic-contract
metadata before the form-batch runner, and removal-mail/session modules before the
workspace UI. The shared `app.js` controller runs last. The recursively frozen audit is
static official-channel metadata only; it contains no person or request data.

`workspace-core.js` exposes `EraseWorkspace` in a browser and CommonJS for tests. Its
`api(path, options)` handles local config, signup, dashboard, location, plan controls,
user reports and deletion. It never calls fetch. Default exported mutation helpers are
asynchronous because they acquire Web Locks; callers must await them. The `create()`
test helper retains synchronous local mutations.

`prepare(routeId)` persists the operation boundary before returning approved companion
fields and required route-specific affirmations. `recordCompanion()` requires matching
operation correlation. An automatic attempt also needs `attempt_verified: true` and the
fixed route stage. It remains a needs-broker-step outcome, outside accepted-request and
deleted-record counts. Acceptance requires separate `route_verified: true` and
`evidence: "fresh_visible_success"` evidence. The companion transport validates its own
origin and correlation before calling it.

`fillPreview(routeId)` performs the same field and eligibility validation without
reserving or saving an operation. `prepareReviewed(snapshot)` rereads and compares the
complete approved preview under the mutation Web Lock, then persists the operation before
returning its companion payload. `form-batch.js` supplies the memory-only sequential
queue; it uses those helpers and `recordCompanion()` rather than adding a public broker
submission endpoint. The optional local helper adds a separate `nativeMessaging` grant;
the eleven approved broker origins are unchanged.

`matchRequest()` records the approved Spokeo candidate and identity before the companion
opens it. `recordMatch()` accepts only the correlated result for that current context.
Only the supported structured name/email proof can supply a derived own-listing
affirmation; manual approval remains a separate user statement. A record match does not
start a removal action.

`holdRoute()` and `resumeRoute()` preserve the last outcome and the no-replay guard.
`searchRequest()` persists the explicit search event before returning its fixed Google URL.
`privacyDraftRequest()` validates the route, fixed contact and own-reference authorization
and returns local text; it records no draft body and sends nothing.
`observationRequest()` and `recordObservation()` reconcile a supported existing-tab
verification outcome without starting another broker action.

`mailSessionRequest()` saves explicit contact authorization before any server request.
`bindMailContact()` validates the returned route, operation, alias, expiry and capability
shape. The server verifies its signature and dedicated mailbox identity. `mailCheckRequest()`
validates storage and the saved capability before dispatch. `recordMailReceipt()` saves
only pending or held metadata. `clearMailContact()` permits a local undo before the broker
action starts. These mutations share the same Web Lock as other writes.

For USPhonebook, `mailContinuationRequest()` saves the separately approved city, state
and ZIP before `/continue`. `prepareMailContinuation()` validates the transient response
and persists the no-replay boundary before companion navigation. `recordMailContinuation()`
records prepared, blocked or unknown results without accepting or verifying a removal.

`removal-mail-client.js` permits only fixed same-origin HTTPS endpoints, strict request
and response shapes, no redirects and explicit calls. It has no polling or account-login
flow. Run:

```sh
node --test tests/*.cjs
```

These are synthetic and local checks. Passing them does not demonstrate that a real broker
accepted a request or completed a removal.
