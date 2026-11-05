# Dedicated removal-mail receipt checks

The optional private-pilot receipt relay reads only a separately connected removal-only
Gmail account. It does not connect to the user's personal inbox. The user authorizes
each broker operation and can prepare selected eligible contacts together, approve
one session over bound contacts, or start a single route check. No polling loop,
cron, background alarm or recurring timer is started. The public website does not
provide unrestricted shared-mailbox access. Credential configuration alone never
enables the relay.

Mailbox checks remain read-only. An authorized continuation action can return
one reviewed USPhonebook or FastPeopleSearch privacy-form link to the authorized browser. The server
never follows it. `CONFIRMATION_CONTRACTS` contains only those exact reviewed routes;
other broker links remain held. Neither a receipt nor a ready form counts as an
accepted removal request or verified deletion.

## Address roles

Only USPhonebook and FastPeopleSearch can request a new dedicated
contact address through this interface. The subject must authorize use of that
address for the specific form and its consent wording. An address shared by a
service is not automatically an email address owned by each subject. An approved
contact address does not prove ownership of the original record.

SearchPeopleFree's current [opt-out consent](https://www.searchpeoplefree.com/opt-out)
identifies the requester as the person associated with the supplied email. Support
for a shared service contact has not been established. New shared-contact sessions
are therefore rejected before any Google call. Use an email associated with the
person, typed into their workspace, and complete the broker's verification directly;
the app does not read that inbox. Previously issued SearchPeopleFree capabilities
remain valid for explicit, authenticated receipt checks until their existing expiry,
but all resulting links stay held and no continuation is available. This preserves
request history without issuing another address or resubmitting anything.
The public `/opt-out/email` page displays email-sent instructions even when opened
without a submission. Its pathname or page text is not evidence that a particular
request was accepted or an email was sent.

People Data Labs and Apollo use a record-associated email for identification or
verification. The API rejects those routes. It never silently substitutes a
removal contact address for an identity email. Forwarded quotes and attached
`Authentication-Results` do not establish broker provenance. Supporting forwarded
mail requires a separately reviewed DKIM/ARC path.

## Connection

The operator connects the dedicated account through the separate OAuth setup
helper. Passwords, refresh tokens and client secrets never belong in the chat,
repository, browser profile, export or public configuration response. Deployment
uses these private server environment variables:

- `ERASE_DEDICATED_MAILBOX=true`, an explicit dedicated-account declaration.
- `ERASE_MAIL_RELAY_ENABLED=true`, literal opt-in activation for the private pilot.
- `ERASE_MAIL_PILOT_KEY`, a separate 32-byte private access key encoded as 64
  hexadecimal characters. This is not a shared public application key.
- `ERASE_REMOVAL_INBOX`, the untagged dedicated account address. Its local part
  must contain at most 25 letters, digits, dots, underscores or hyphens.
- `ERASE_GMAIL_CLIENT_ID`, `ERASE_GMAIL_CLIENT_SECRET`,
  `ERASE_GMAIL_REFRESH_TOKEN`.
- `ERASE_MAIL_CAPABILITY_SECRET`, 32 random bytes encoded as 64 hexadecimal
  characters, used only for signing per-operation capabilities and opaque receipt
  references.

OAuth requires Gmail read-only access plus `openid` and `email` for account-identity
preflight. Before issuing a contact alias and again before any message query, the relay
refreshes the access token and checks
Google's user-info email and verified-email flag against the configured dedicated
address. A mismatch stops before publishing an alias or reading messages. No SMTP or sending permission
is used. An unconnected or incomplete configuration returns HTTP 503 for checks
and sessions; the status endpoint reports `configured: false`.

The refresh token proves only the connected mailbox's identity. It does not prove
that the subject owns a broker record. Gmail's OAuth read-only scope is broad within
that dedicated account, so never connect an account containing personal mail.

## API

The browser sends neither the profile nor its personal email to these endpoints.
Personal-profile API writes remain rejected.

- `GET /api/removal-mail/status` reports configuration and on-demand operation.
- `POST /api/removal-mail/session` accepts exactly `route_id`, `operation_id`
  and `authorized: true`.
- `POST /api/removal-mail/check` accepts exactly `capability` and `explicit: true`.
- `POST /api/removal-mail/continue` accepts exactly `capability`, `explicit: true`
  and the `receipt_ref` returned by a previous explicit check.

POSTs require JSON, `X-Erase-Me: 1` and the exact production workspace Origin.
POSTs also require the exact private pilot key in `X-Erase-Mail-Key`. It is
compared in constant time and is never accepted in the body or query string.
An absent or incorrect key fails before any Google request. The activation flag
and private key are revalidated before every Google call, including refresh,
identity preflight, list and raw retrieval. Bodies are bounded to 8 KiB. Duplicate JSON keys, extra profile fields, unsupported
routes, altered capabilities and malformed operation identifiers are rejected.

The anonymous status response distinguishes `configured` credentials from `enabled`
private-pilot activation. It reports `access: private_pilot`,
`authorization_required: true` and `automatic_execution: false`, without exposing
credentials or the pilot key. The key must be entered privately by the operator,
never compiled into public JavaScript, committed to GitHub or stored in a shared
frontend configuration. Per-operation capability possession alone does not grant
relay access. Public shared-mailbox deployment needs durable authentication,
quotas and abuse controls before this private-pilot restriction can be removed.

An authorized session returns a signed capability and a fresh random
`mailbox+erase-<request_id>@domain` contact alias. Its HMAC binds the broker route,
workspace operation ID, request ID, alias, issue time and seven-day expiry.
The capability is a private bearer credential. Keep it in the subject's local
workspace and private backup, never in a public URL or log. An operation's alias
must be displayed before it is used in the broker form. Issuing an alias sends
nothing and starts no broker request.

## One authorized browser session

The web workspace can prepare selected FastPeopleSearch and USPhonebook contacts in
one pass through `contact-setup.js`. The operator selects the eligible routes and enters
the private key once. Each selected route is explicitly authorized before its alias is
requested and bound. The setup checks every selection before starting, keeps existing
contacts, and excludes held, started, paused or out-of-country routes. It freezes the
workspace identity, country, operation reference, fields and affirmations before the first
asynchronous step and checks for changes before issuing or binding a contact. An uncertain
outcome stops setup rather than automatically requesting another address. This phase
does not navigate to a broker, send a form or read messages.

After setup, the workspace rebuilds the exact-address and field review. The main form
approval, optional submission mode and optional mail pass are unchecked; creating an
address does not authorize its disclosure to a broker. The operator reviews the new
values and selects the desired actions. The key can remain only in memory for this open
review so this sequence does not require entering it again. Closing, stopping or completing
the review disposes that access. The current companion is 0.6.0.

The optional mail pass runs only after all selected form outcomes have been saved.
`form-batch.js` supplies `afterForms` with minimal operation references only for verified
verification-initiation or guarded submission-attempt outcomes. The UI checks the selected,
bound contacts in that final pass. Stopped queues, failed preparation, unknown form outcomes
and failed result persistence skip it. A mail-only pass can check existing bound operations
without filling or resending their forms. No alias is substituted for a record-associated
email, and contact preparation never enables mail checks by itself.

`removal-session.js` keeps the operator key only in page memory for this authorized
session and clears it on disposal. The input is cleared when contact preparation or a
mail session takes the key; it never enters the workspace, backup, URL or public frontend
configuration. `contact-setup.js` exposes only route IDs, bounded statuses and fixed
messages in its progress and result; it never returns the key or profile fields.
Each route/operation is checked at most once per session. Holds, campaign pause,
stop and missing operation references prevent further mail actions.

If no correlated mail has arrived, the result is `awaiting_mail`. No later mailbox check,
polling loop or future session is scheduled. Starting another check requires another
authorized session. A submitted form, an authenticated receipt and a checked
confirmation remain distinct stages.

The API's `explicit: true` and private-key requirements remain unchanged. The session
supplies those requests under the user's upfront approval rather than asking for a
new click between every call. A continuation still reauthenticates the exact receipt
and needs the previously reviewed fields and companion capability. Only the reviewed
USPhonebook and FastPeopleSearch contracts can release URLs; unfamiliar destinations
remain held. SearchPeopleFree's legacy receipt capabilities remain held-only.

The held USPhonebook pilot is excluded from these sessions. No session resumes a held
route, supplies missing identity details or certifies the broker's accuracy statement.
Pending mail after the page closes cannot be handled automatically with background
triggers disabled.

A check searches only the bound alias and messages after the server-issued time,
with at most ten raw messages, 256 KiB per message and a 25-second overall budget.
The relay uses Gmail read methods only, without changing read state or labels.
Fixed Google API endpoints reject redirects before credentials could be forwarded.
Provider errors are returned generically without tokens, request URLs or raw data.

A qualifying receipt requires all of:

- Exact matching tagged recipient in To or Delivered-To.
- Gmail internal receipt time after capability issuance and no more than five
  minutes in the future.
- One From address on an explicitly allowed broker sender domain.
- The first Authentication-Results header belongs to Gmail's `mx.google.com`,
  with one passing DMARC result and aligned passing DKIM or SPF evidence.
- Removal and confirmation purpose in a bounded text-only message inspection.

Attachments are not read. Parsing HTML does not render it or fetch its resources.
A check returns only `held`, its reason, bound operation identifiers, receipt
time, authenticated status, `continuation_available` and an opaque receipt
reference. Message bodies, subjects, sender addresses, raw headers, Gmail message
IDs and confirmation URLs are not exposed by a check. A receipt with an unfamiliar
link stays held with `continuation_available: false`. A missing qualifying message
returns `pending`; neither result establishes deletion.

## Reviewed USPhonebook continuation

The allowed destination is exactly
`https://www.usphonebook.com/removal/validate-record-info`. Its query must contain
exactly one nonempty `key` and one numeric `ticketid`, with no extra or duplicate
parameters. The opaque key is at most 512 characters, with URL-safe base64
characters and at most two trailing padding characters; the ticket ID is at most
32 digits. Credentials, fragments, alternate ports, encoded path variants and
other destinations are rejected. HTML attribute entities are decoded by the HTML
parser once; plain-text URL entities are decoded once. Every extracted link must
collapse to the same valid destination. Ambiguity stays held.

The authorized continuation endpoint rechecks the capability, private pilot key,
connected account identity and the same authenticated receipt. Its opaque
reference binds the request, Gmail message ID and raw-message digest. An altered
message or a reference from another operation cannot release a link. It returns
only `confirmation_ready`, the bound operation identifiers, receipt reference,
`confirmation_url` and `automatic_execution: false`. No broker request is made by
the server. The URL is private, transient browser input: do not log it, place it in
the dashboard, save it to an export or send it to an unrelated tab.

The reviewed second form requires first and last name, current city, state, ZIP
code and the authorized contact email. Live server validation also requires either
date of birth or street address, although neither input is marked required in the
HTML. The person must enter one directly on the broker form. Erase Me does not
collect or autofill those details; phone number also remains unfilled. The companion
must hold until ZIP is provided and journal the continuation before navigating.
The accuracy agreement, any broker challenge and final submission remain explicit
broker steps. The observed final form was rejected without that additional detail;
acceptance and deletion remain unverified. A form submission is recorded separately
from request acceptance, broker-reported completion and an independently verified
removal.

This stateless endpoint does not provide a durable consumed-nonce store or
server-enforced one-time execution. The companion's local action journal must
hold repeated or interrupted continuations instead of navigating again. An API
response or the broker's processing estimate does not prove removal.

## Reviewed FastPeopleSearch continuation

The destination is exactly `https://www.fastpeoplesearch.com/optout/removal`.
Its query has exactly five fields: `firstname`, `middlename`, `lastname`, `email`
and `ticketid`. The middle name must be empty because the initial companion action
does not supply one. First and last names are bounded, nonempty text. The email
must equal the capability's dedicated recipient, and the ticket ID has 1–32 ASCII
digits. Duplicate or extra parameters, malformed encoding, credentials, fragments,
different purposes and ambiguous destinations stay held. Entity decoding occurs once
at extraction, as for USPhonebook. The client, core and companion also check that
the URL names and contact match the reviewed initial operation before navigation.

The companion journals before opening this private URL and pins the resulting
document. It checks `form#optout-removal`, the exact POST destination, prefilled
first/last/contact values and ticket reference. This action reads the form; it does
not enter additional personal details, certify accuracy or submit the final request.
The approved initial names and contact are sufficient for this continuation; it
does not reuse USPhonebook's city/state/ZIP prefill contract.

The official form requires a full date of birth or street address, plus city, state
and ZIP. Its labels describe phone as optional despite initial HTML validation
attributes. Age alone cannot supply the missing date or establish the correct
record. Missing identity details remain a required action. A ready matching form
is not an accepted erasure request or deletion.

An authorized November 5 pilot reached this exact sequence: ordinary visible Chrome
received a genuine widget response; the initial verification form was submitted;
the operation's removal-only alias received broker mail passing the relay's sender,
recipient, time and Gmail authentication checks; the authenticated destination opened
the matching form. The pilot is awaiting a full date of birth or street address.
No final acceptance or independently verified deletion was established. Personal
inboxes and the held USPhonebook request were untouched.

## Free hosting limits

The implementation needs no hosted profile database or paid mail solver. Mail is
read through an account and deployment the operator controls. Provider quotas,
OAuth test-user expiration and hosting limits still apply. A free deployment is
not a promise of unlimited capacity. Account authorization and actual broker
confirmation contracts must be validated before automatic execution is enabled.

## Validation

`tests/test_removal_mail_api.py` uses synthetic messages and mocked Google calls.
It covers disabled activation, missing or wrong pilot keys, revocation between
Google calls, account mismatch, exact recipient and operation binding, HMAC tampering,
expiry, forged authentication, stale mail, bounded reads, held links, strict HTTP
origin/body checks, offline configuration and secret-free error responses. The
continuation fixtures also cover exact host/path/query contracts, entity decoding,
ambiguous links, changed message content and cross-operation receipt references. These
fixtures do not demonstrate that a real broker accepted or completed a request.

A November 5 dedicated-account OAuth identity check succeeded before the separately
authorized, operation-scoped FastPeopleSearch receipt check described above. Identity
preflight alone does not authenticate mail or establish deletion. Companion 0.6.0
adds the reviewed FastPeopleSearch confirmation path without expanding mailbox scopes
or installing recurring work.

Google's method contracts are documented at
[message listing](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)
and [message retrieval](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get).


## Deployment packaging

`preview/api/index.py` is the single Python function entrypoint. Its implementation
helper is `preview/lib/removal_mail.py`, loaded from an exact trusted path relative
to the entrypoint. It does not accept a module path from a request or environment
variable. The `lib` directory has an `__init__.py` marker and is included in the
Python project bundle.

Vercel's [file-based Python runtime](https://vercel.com/docs/functions/runtimes/python/api-directory)
turns each Python file under `api/` into a separate function and requires a handler.
Keeping the helper outside that directory avoids an unintended handlerless endpoint.
The packaging regression checks that only `api/index.py` remains discoverable and
that the API loads the helper from the expected project file.
