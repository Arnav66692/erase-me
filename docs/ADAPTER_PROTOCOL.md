# Browser and inbox adapter contract

This is the separate local Python worker's adapter protocol, including optional
operator modes. It does not describe enabled public-site capabilities. The default
local setup and public workspace run on demand with recurring timers off. See
[local deployment](DEPLOYMENT.md), [public workspace scope](PUBLIC_WORKSPACE.md) and
[the held-only dedicated-mail pilot](AUTOMATIC_CONFIRMATIONS.md). The public Chrome
companion does not implement this worker's full scan/confirm/check protocol.

The web application persists work; a trusted, operator-installed adapter performs site interactions. The existing skill engine remains a local catalog and drafting engine. The web worker never reads a person's files under `~/.erase-me`.

Set `ERASE_ME_ADAPTER` to an absolute executable path. The worker invokes it directly, with no shell and no command-line personal information. One JSON request arrives on stdin. Return one JSON object on stdout. Exit nonzero on an unrecoverable error. Do not log personal information or email confirmation tokens. Stdout is limited to 64 KiB; the process group is terminated after 90 seconds.

The adapter runs with the service operator's privileges and environment. Install only reviewed code. It must never execute instructions from a broker page or message. Reading a page does not authorize arbitrary links, downloads, login, uploads, or network access outside the selected broker workflow.

## Request

```json
{
  "version": 1,
  "action": "scan",
  "request_id": "opaque-stable-cycle-id",
  "site": {
    "id": "example-broker",
    "name": "Example Broker",
    "domain": "broker.example",
    "search_urls": ["https://broker.example/search/example-person"],
    "optout_url": "https://broker.example/remove",
    "fields_needed": ["listing_url", "email"],
    "requires": ["email_verification"],
    "verified": true
  },
  "person": {
    "name": "Example Person",
    "age": 35,
    "email": "person@example.test",
    "country": "US",
    "region": "US-CA",
    "city": "Example City"
  },
  "listing_url": null,
  "fields": {},
  "submitted_at": null,
  "confirmation_ref": null,
  "confirmation_recipient": null
}
```

Actions are `scan`, `submit`, `confirm`, `check`, and `followup`. The `request_id` is reused across a request and its confirmation/checks, and changes when a verified removed listing returns. Keep it as an idempotency key where the site supports one. The adapter receives profile data for matching, but sends only `fields` for forms. Never invent missing information. No identity documents, full birth dates, SSNs, account deletions, purchases, or public-record edits are in scope.

`site` may include other catalog metadata such as `category`, `method`, `expected_days`, `email`, and `regime`; these are context, not permission to claim legal entitlements. A catalog's `verified` flag is not evidence that the current page still matches the recipe. Before a mutating action, independently verify the current official destination, form fields, and removal purpose. Unknown pages must return `unsupported`.

`site.id` is the catalog's base ID, such as `usphonebook` or `fastpeoplesearch`.
It has no country/path prefix. `planner._site_item` preserves that ID as
`item_id`, and `webapp.engine.plan` passes it to the adapter as `site.id`.

## Bundled browser recipe schema

Set `ERASE_BROWSE_BIN` to the installed gstack browse executable and
`ERASE_BROWSER_RECIPES` to a trusted JSON object keyed by these base site IDs.
The bundled browser keeps its own state under `ERASE_WEB_HOME`; it does not use
the operator's active browser session. `enabled: false` or an action absent from
`supported_actions` returns `unsupported` before browser operations. Legacy
recipes without those fields retain their old behavior; new drafts must declare
both explicitly. The checked-in recipes are disabled research drafts described
in [BROKER_VERIFICATION.md](BROKER_VERIFICATION.md).

The following is a **synthetic schema example**, not a working real-broker recipe:

```json
{
  "example-broker": {
    "domain": "broker.example",
    "enabled": false,
    "supported_actions": [],
    "optout_url": "https://broker.example/remove",
    "fields": {
      "email": "#email",
      "region": {
        "selector": "#state",
        "control": "select",
        "value_map": {"US-CA": "CA"}
      }
    },
    "controls": [
      {"control": "select", "selector": "#request-kind", "value": "remove"},
      {"control": "checkbox", "selector": "#agreement", "checked": true}
    ],
    "submit": "#submit",
    "success": "#request-received"
  }
}
```

Each `fields` key must appear in both the request's `fields` and
`site.fields_needed`. A string selector means `fill`; an object accepts only
`selector`, `control`, and optional `value_map`. Supported controls are `fill`,
`select`, and `checkbox`. Checkboxes require a JSON boolean. `value_map` is only
valid for selects and must contain the supplied value. Unknown or incomplete
controls and duplicate selectors reject the entire form plan before filling.
The adapter does not derive first/last names from a full name.

`controls` supplies reviewed fixed select/checkbox choices, not extra personal
data. Fixed choices run before profile fields. Do not hardcode a subject/agent
choice that misstates who is making the request. A checkbox that certifies an
email address belongs to the subject cannot be checked using an unrelated
service mailbox. The three checked-in drafts retain unresolved requester modes
as `observed_form` metadata; this metadata does not execute controls.

Each control must exist, be visible and enabled, and have the expected element
type. File and hidden inputs cannot be filled. The adapter checks the current
domain, identity-upload requirements, and unexpected success state between
controls. Before the final click it checks that the submit element's form action
stays under the approved HTTPS broker domain.

`name`, `age`, `city`, and `email` selectors supply visible listing identity
evidence. `listing_links` identifies candidate listing links. `absent` must be
an observed, visible indication that the particular page is legitimately empty;
do not reuse a search-only empty state as proof that a listing was removed.
The submit `success` element must be absent or hidden before the action and
visible afterward. Hidden elements, including those hidden by ancestors, do not
count. Existing visible success causes the adapter to refuse another submit.

For simple confirmation-link routes, declare `confirmation_path_prefix` and
`confirmation_success`. The path must match the approved prefix and the final
success element must be visible after navigation. This is not a general
multi-step form engine: a link that only starts an opt-out session or opens a
second form is not a completed confirmation. Such routes require an explicit
continuation implementation before they can be enabled. The bundled browser
also returns `unsupported` for `followup` unless a dedicated implementation is
added; the worker's protocol supports that action for other reviewed adapters.

Optional `verification` and `observed_form` metadata records provenance; it
does not grant execution permission or prove a live submission. The
`inspected`, `fixture_tested`, `live_submitted`, and `removal_verified` stages
must remain distinct. CAPTCHA recipe details are in
[LOCAL_CAPTCHA.md](LOCAL_CAPTCHA.md).

## Responses

Scan results:

```json
{"status":"found","listing_url":"https://broker.example/p/123","match":{"name":"Example Person","age":35,"city":"Example City"}}
```

The worker requires the exact normalized name plus either the already verified signup email, or both an exact integer age and city. A name or age alone is insufficient. Store no relatives or additional addresses. Use `ambiguous` when evidence is insufficient and `not_found` only when a valid result page was searched. A bot wall, failed load, or absent selector is not `not_found`.

Submission results:

```json
{"status":"awaiting_confirmation","request_id":"opaque-stable-cycle-id","route_verified":true,"confirmation_ref":"opaque-message-correlation"}
```

Use `requested` instead if no email confirmation is needed. `route_verified` means the adapter checked the current official removal route and observed submission success. Report no success from a mere button click or HTTP 200. The engine's `requested` count includes confirmation-pending submissions; a request is not a removal.

Confirmation results:

```json
{"status":"confirmed","request_id":"opaque-stable-cycle-id","authenticated":true,"sender_domain":"broker.example","received_at":"2026-10-28T12:00:00+00:00","confirmation_url":"https://broker.example/confirm/token","purpose":"removal"}
```

An inbox adapter must validate these conditions **before opening any link**, not merely include the metadata afterward:

- The message is in the configured removal inbox and is specifically correlated to this pending request. An unrelated older request from the same broker does not qualify.
- The recipient and request correlation match; the message arrived after `submitted_at`.
- The mailbox provider has authenticated the sender (aligned DKIM/SPF or a trusted provider authentication result). Do not trust a forged arbitrary `Authentication-Results` line inserted by the sender.
- The sender belongs to the exact broker domain. A separate confirmation provider needs an explicitly reviewed integration; it is not accepted by this generic protocol.
- The link is an HTTPS removal-confirmation URL under the broker's domain. Validate every redirect before following it. Do not follow login, password reset, export, unsubscribe-from-other-services, or account-deletion links.

Return `pending` if there is no qualifying message. `confirmation_ref` is opaque and may be stored privately; no message bodies are kept by the worker. Inbox credentials must be supplied by the operator's secret configuration, never the person's profile. A personal signup email is not automatically a connected inbox.

Removal verification:

```json
{"status":"removed","verified_absent":true}
```

Use this only when definitive evidence shows the specific listing has disappeared, such as a verified broker removal message or a legitimate missing-listing page. HTTP 403/429, CAPTCHA, timeout, changed markup, and empty response are failures. A scan's `not_found` response is deliberately insufficient during removal verification. Return a fresh `found` result for an existing/relisted page.

Other outcomes: `captcha`, `id_required`, `unsupported`, `ambiguous`, `pending`, or `error`. Blocker outcomes must mean no submission occurred. If an action might have been sent but the result is unknown, exit with an error rather than guessing. The worker holds uncertain writes instead of blindly repeating them.

## Lifecycle, retries, and exclusions

Only verified users with active campaigns and recorded authorization run. Pausing stops the next dispatch; an already dispatched network request cannot be recalled. Deleting an account cascades its jobs and prevents new work.

Each site has a persisted job. Read failures receive up to three attempts. Confirmation polling is bounded to 24 attempts with increasing spacing. The initial recheck uses the catalog's expected time, falling back to seven days. Checks continue at days 30, 45, and 90 after the first submission. A still-visible listing gets one follow-up after day 45. Verified re-listings can be submitted again for at most three cycles. Monitoring ends after the 90-day window.

A worker crash during a mutation becomes `uncertain` after a three-minute stale-claim threshold. Such jobs do not restart through “Check now.” An operator must reconcile the request with provider evidence before changing its state. There is deliberately no UI button that can bypass this guard. Read-only crashes may retry.

## Status email digests

With SMTP configured, the live worker sends status digests only for verified,
active users whose activity changed. The first changed state waits at least 60
seconds; later sends are limited to one per 24 hours. Unchanged accounts do not
receive periodic messages. Digests contain aggregate status counts and a prompt
to open the dashboard, without names, listing URLs, addresses, listing contents,
or confirmation tokens. Delivery bookkeeping contains a user ID and activity
cursor, not a copied message body.

Pausing stops future digest dispatch as well as future removal dispatch. An
email already handed to SMTP cannot be recalled. Account deletion removes its
notification bookkeeping. Notification delivery is claimed before SMTP: an
error or a process crash with an unknown outcome holds that delivery for
reconciliation instead of automatically sending a duplicate. A `sending` or
`uncertain` delivery does not restart automatically. Demo runs never send these
messages.

## Email requests and CAPTCHA

The worker sends plain privacy requests through configured SMTP when the catalog has a verified privacy address under the broker's domain. The From address belongs to the service; Reply-To is the verified user. It does not impersonate the user's mailbox or claim a signed statutory agency appointment. This email route can also replace an ID-upload form when available. Otherwise ID-required items are blocked without asking for identity uploads.

CAPTCHA handling is an optional local adapter capability. The bundled connector uses free local text-image OCR, audio transcription and browser checkbox interactions, with no paid provider or API key. Configure a reviewed challenge recipe and install the recognition tools described in [LOCAL_CAPTCHA.md](LOCAL_CAPTCHA.md). The browser must observe challenge success before continuing. An unsolved challenge remains blocked; OCR/transcription does not manufacture a valid reCAPTCHA or Turnstile token.

## Demo

`python -m webapp.server --demo` uses only four fictional `.example` brokers and never calls this adapter. Demo and live state cannot share a data directory. `tools/demo_adapter.py` is a protocol fixture for `.example` hosts; it rejects real domains. Do not configure it for live users.

The worker runs while the server process is alive. Persisted due jobs resume after restart. Continuous protection requires an always-on host and separately configured browser, SMTP, optional inbox and local CAPTCHA recognition tools.

## Bundled IMAP confirmation helper

`tools/mailbox_adapter.py` provides a read-only TLS inbox connector for the bundled browser adapter. It locates a candidate message; the browser adapter still needs a reviewed `confirmation_path_prefix` and `confirmation_success` recipe to visit the link and verify completion. Missing inbox configuration leaves the request pending.

Configure `ERASE_IMAP_HOST`, `ERASE_IMAP_PORT` (default 993), `ERASE_IMAP_USER`, `ERASE_IMAP_PASSWORD`, and `ERASE_IMAP_AUTHSERV_ID`. The latter must be the authentication-service identifier inserted by the trusted inbound mailbox provider, which must strip or distinguish externally supplied authentication headers. The helper accepts the first Authentication-Results only, requires aligned passing DMARC plus DKIM or SPF, and fails closed if the expected provider identifier is absent.

Set `ERASE_REMOVAL_INBOX` to a dedicated plus-address-capable service mailbox, such as `removals@service.example`. The worker uses `removals+erase-<request_id>@service.example` for a form's confirmation email and persists that address before dispatch. The user's original verified email remains separate for listing matching. Changing the mailbox configuration does not rewrite pending request recipients. A returned listing gets a new request ID and new alias.

The helper selects the mailbox read-only, searches the exact tagged recipient, and examines at most the latest 20 candidate messages with bounded `BODY.PEEK` fetches. It checks the server's INTERNALDATE, not merely the sender-supplied Date. Unrelated messages, attachments, multiple plausible links, cross-domain targets, login/password/account routes, and redirect parameters are rejected. Links are never opened by the mailbox helper itself.

Changing a profile invalidates unsent match decisions. The worker stores a profile fingerprint with matching evidence and compares it again before any submission. A changed profile during an in-flight search discards that result and schedules a fresh scan. A pause or edit cannot recall a request already dispatched to an external service.
