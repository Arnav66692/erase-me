# Public browser workspace

The hosted app accepts a self-attested profile and keeps it in this browser's local
storage. It needs no service account, email login, password or hosting database. It
does not upload the profile or ledger to the hosting API. Anyone using this browser
profile can read that workspace. Clearing site data removes it. Explicit export
creates a private JSON backup; an opted-in mail capability is included, so keep the
backup out of GitHub and shared storage.

## Actions and evidence

Saving a profile, editing location, opening the app and preparing a route plan do not
submit forms. The person starts an individual broker action with its displayed fields.
There are no recurring checks, background alarms, inbox polls or automatic resubmissions.

The companion can initiate People Data Labs email verification and prefill the initial
USPhonebook, SearchPeopleFree and FastPeopleSearch forms. Fields prepared is not sent;
opening a portal is not sent. Verification initiation is not a deletion request. The
private mail pilot can also prepare USPhonebook's reviewed second form after separate
authorization. Record matching, its final accuracy statement, CAPTCHA and submission
remain user steps. Other confirmation routes remain held. ID uploads are excluded.

Only a correlated companion result with fresh, visible broker acceptance evidence may
establish request acceptance. User reports remain self-reported. Imports downgrade
accepted history and receipt evidence to unverified history. Neither a receipt nor an
HTTP 404 establishes removal. The current public workspace has no independent listing
scanner or verified deletion state: found and removed counts remain zero.

The operation ID is saved before companion dispatch. Interrupted operations are held,
not repeated. An explicit result read can reconcile the same operation later. Browser
mutations use an origin-wide exclusive Web Lock and reread current storage inside it;
browsers without that support fail closed. Another tab deleting the workspace prevents
a stale dispatch. The companion also reserves the stable operation ID to prevent duplicate
execution. Storage failures stop actions before dispatch.

## Country coverage

The catalog has 43 reference routes, with four supported initial companion actions and
39 manual routes. Reference coverage is separate from live integration or removal evidence.

| Catalog group | Reference routes | Initial companion actions |
| --- | --- | --- |
| Global portals: People Data Labs and Apollo | 2 | 1 |
| United States | 23 | 3 |
| Canada | 4 | 0 |
| United Kingdom | 5 | 0 |
| Germany | 2 | 0 |
| Turkey | 7 | 0 |

The 36 added manual references use the existing country-pack source URLs. Their current
forms, request acceptance and deletion results have not been validated for this app.
They collect no additional profile fields in Erase Me. Follow their official instructions
directly and stop if they require payment or an identity-document upload.

Without a country, only the two global portals appear and the app asks for a country.
Selecting a pack shows its regional references plus global portals. A country without a
pack sees an explicit coverage notice. This supports using the workspace internationally;
it does not guarantee that a global broker holds a person's record or accepts their request.
Started operations remain available for follow-up after a country change. Older inactive
route history stays in private exports. Existing workspaces add newly available routes
only through an explicit plan refresh.

First and last names are explicit broker fields, never inferred by splitting a full name.
Names and cities retain Unicode characters; email local-part case is preserved and domains
are normalized. A Spokeo listing URL must have an approved HTTPS host and direct listing
path, without credentials, query parameters or fragment. A name or typed email alone does
not prove ownership of a broker record.

## Dedicated removal-mail pilot

The optional relay uses a separate, removal-only Gmail account. It never connects to a
personal inbox. Connection uses [private OAuth setup](GMAIL_OAUTH.md); deployment and
receipt authentication are described in [the relay contract](AUTOMATIC_CONFIRMATIONS.md).
Configuration alone does not enable the private pilot. Session issuance and checks also
require explicit server activation and a separate operator access key.

The availability button is an explicit status read. When the pilot is enabled, operator
controls let a person authorize a dedicated contact for USPhonebook, SearchPeopleFree or
FastPeopleSearch. The address and shared-account disclosure appear before use. The person
must review the broker's email-ownership and consent wording. The original profile email
is unchanged; People Data Labs and Apollo never receive a substituted contact address.
Before a broker action starts, the person can switch back to the typed email. After the
operation starts, its recipient stays fixed.

The private pilot key is entered in a password field and cleared on each click. It is never
stored in the workspace, backup or URL. OAuth credentials never enter the browser. The
browser sends only route and operation references to obtain an alias, and a scoped bearer
capability to check it. The capability stays in private local storage and backups; it does
not grant relay access without the operator key.

An explicit `/check` returns pending or authenticated held metadata without a message body
or confirmation URL. USPhonebook's exact official `/removal/validate-record-info` route is
the sole reviewed continuation. A separate explicit `/continue` re-reads and authenticates
the same correlated receipt, then returns that form URL transiently to the browser. Other
links remain held. The URL never enters workspace history or private backups.

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

`workspace-core.js` exposes `EraseWorkspace` in a browser and CommonJS for tests. Its
`api(path, options)` handles local config, signup, dashboard, location, plan controls,
user reports and deletion. It never calls fetch. Default exported mutation helpers are
asynchronous because they acquire Web Locks; callers must await them. The `create()`
test helper retains synchronous local mutations.

`prepare(routeId)` persists the operation boundary before returning approved companion
fields. `recordCompanion()` requires matching operation correlation; acceptance also
requires `route_verified: true` and `evidence: "fresh_visible_success"`. The companion
transport validates its own origin and correlation before calling it.

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
node --test tests/test_workspace_core.cjs tests/test_manual_ui.cjs tests/test_companion.cjs tests/test_broker_catalog.cjs tests/test_removal_mail_client.cjs
```

These are synthetic and local checks. Passing them does not demonstrate that a real broker
accepted a request or completed a removal.
