# Public browser workspace

The hosted app accepts a real self-attested profile and keeps it in this browser's
local storage. It needs no service account, email login, password or hosting database.
It does not upload the profile or its ledger to the Vercel API. Anyone who can use this
browser profile can read that local workspace. Clearing site data removes it. Explicit
export creates a personal JSON file. Keep that file private.

## Actions and evidence

Saving a profile, editing its location, opening the app and pressing Run check do not
submit forms. Run check prepares the route plan. The person starts an individual broker
action with its exact fields. No background alarms, scheduled runs or inbox reads are
part of this architecture.

The public catalog distinguishes researched official portals from functioning automated
removals. The browser companion may fill supported forms in an official broker tab.
Fields prepared is not sent. Opening a portal is not sent. People Data Labs verification
initiation is not a completed deletion request. The person finishes any CAPTCHA, email
verification and later broker forms.

Only a correlated companion result with fresh, visible broker acceptance evidence may
establish request acceptance. User reports remain self-reported. Imports downgrade
accepted broker history to self-reported history. No import, user button, network error
or HTTP 404 can establish removal. The current browser workspace has no verified deletion
state or independent public-listing scanner, and its found and removed counts remain zero.

An operation ID is saved before the companion is called. An uncertain write is held and
is not resent automatically, including after a page reload. Refresh may reconcile that
same operation with a later companion result. Each route uses its stable private item UUID
as the operation ID, so simultaneous browser tabs share the companion deduplication key.
The core reloads storage changes before dispatch and refuses actions after another tab deletes
the workspace. Extension-side operation reservation remains necessary for a simultaneous race. A storage failure prevents dispatch.

## Routes

The browser catalog currently includes People Data Labs, USPhonebook, SearchPeopleFree,
SmartBackgroundChecks, FastPeopleSearch, Spokeo and Apollo. Their capability labels describe the
work actually supported. People Data Labs can initiate verification. USPhonebook, SearchPeopleFree and FastPeopleSearch support companion prefill. SmartBackgroundChecks returned a 403 during the latest inspection and remains manual. Spokeo and Apollo are manual routes. Apollo requires the business email associated with its record. Research notes about a portal do not imply an accepted request
or completed removal. First and last names are explicit fields. They are never inferred
by splitting a full name. A Spokeo listing URL must use the exact approved HTTPS domain
and a direct listing path, with no credentials, query parameters or fragment.

No identity documents, purchases, login flows or account deletions are authorized by the
public workspace. Entering an email never proves ownership or becomes enough evidence
to identify a public listing.

## Core interface

`workspace-core.js` exposes `EraseWorkspace` in a browser and CommonJS for tests.
`api(path, options)` returns a response-like object with `ok`, `status` and async `json()`.
It handles config, signup, dashboard, location, on-demand plan controls, confirmation
reports and deletion. It never calls fetch.

Explicit helpers are `routes()`, `snapshot()`, `profile()`, `setEvidence(routeId, fields)`,
`prepare(routeId)`, `recordCompanion(routeId, operationId, result)`,
`recordUser(routeId, state)`, `opened(routeId)`, `exportData()`, `importData(text)` and
`remove()`. `prepare()` returns `{routeId, operationId, fields, authorized: true}` only
after saving the operation boundary. `recordCompanion()` accepts `prepared`,
`verification_sent`, `submitted`, challenge/unsupported states and uncertain outcomes.
Acceptance requires `route_verified: true` and `evidence: "fresh_visible_success"`.
The companion transport must validate its own origin and request correlation before
calling this method. It must never accept arbitrary page-supplied scripts or destinations.

Run `node --test tests/test_workspace_core.cjs` for the pure core's persistence, consent,
no-resend, import, evidence and URL-boundary checks.
