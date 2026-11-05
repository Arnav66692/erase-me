# Dedicated removal-mail receipt checks

The optional private-pilot receipt relay reads only a separately connected removal-only
Gmail account. It does not connect to the user's personal inbox. The user authorizes
each broker operation, and each mailbox read is an explicit action. No polling loop,
cron, background alarm or recurring timer is started. The public website does not
provide unrestricted shared-mailbox access. Credential configuration alone never
enables the relay.

This release implements receipt checking, not automatic confirmation navigation.
`CONFIRMATION_CONTRACTS` is an immutable empty table. Even an authenticated,
correlated broker message is held until its exact confirmation-purpose route and
later form have been inspected and tested. No link is returned or followed, and no
mail receipt is counted as an accepted removal request or verified deletion.

## Address roles

Only USPhonebook, SearchPeopleFree and FastPeopleSearch can request a dedicated
contact address through this interface. The subject must authorize use of that
address for the specific form and its consent wording. An address shared by a
service is not automatically an email address owned by each subject. An approved
contact address does not prove ownership of the original record.

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
A candidate returns only `held`, its reason, bound operation identifiers, receipt
time, authenticated status and an opaque receipt reference. Message bodies,
subjects, sender addresses, raw headers, Gmail message IDs and confirmation URLs
are not exposed. A receipt with an unfamiliar link stays held. A missing qualifying
message returns `pending`; neither result establishes deletion.

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
origin/body checks, offline configuration and secret-free error responses. These
fixtures do not demonstrate that a real broker accepted or completed a request.

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
