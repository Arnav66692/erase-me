# Run the local app without an inbox connection

The default local app runs on demand on a Mac or Linux computer. It uses Python,
SQLite and optional free browser/CAPTCHA tools. No paid solver or hosting subscription
is required. A working app interface is not proof that every broker has a supported
removal route: the route checks report that separately.

## Local setup

From the repository, with Python 3.10 or newer:

```sh
python3 tools/configure_service.py --local
python3 tools/run_service.py --check
python3 tools/run_service.py
```

Open `http://127.0.0.1:8766`. Enter your name, age and email, authorize requests for
your own data, then click **Run check** when you want to perform work. The local app
records the supplied email as self-attested; it does not pretend mailbox ownership
was verified. Name plus age and city are required to distinguish public listings.

There is no inbox connection, app password, SMTP/IMAP setup or sign-in-to-Google step
for this mode. Your email is supplied only to supported broker forms where needed.
If a broker sends a confirmation email, open it yourself. After completing its step,
use the dashboard confirmation button. That action records your report and queues
an explicit check where one is supported; it does not declare the listing removed.
For People Data Labs, completion remains unverified because an independent deletion
check is not available yet.

The local configuration is stored outside the repository in
`~/.erase-me-service/config.json` (directory 700, file 600). Local profiles use the
separate `~/.erase-me-web-local` database; the existing skill's `~/.erase-me` family
profiles and any earlier live/demo databases are not imported. `--replace` is required
to change an existing configuration. Switching from a mail-connected configuration
with `--local --replace` removes mail settings from the new configuration and chooses
the isolated local data directory.

The helper refuses unsafe file paths, symlinks, unowned or non-private configuration,
and unrelated directories. It never sends mail or installs a background service.

## Runs happen only when requested

**Recurring checks are off.** Opening the app, signing up, refreshing, changing a
profile, or resuming a paused campaign does not start a removal run. The command above
does not create a cron job, app automation, launchd service or systemd timer.

Each explicit **Run check** starts a bounded batch for the signed-in profile only.
It drains immediate discovery/submission steps for up to four cycles and stops starting
new jobs after two minutes. An external operation already in progress can finish within
its adapter timeout. Delayed checks are retained as deadlines in storage, but no timer
wakes up to run them. Clicking Run check again requests the next check. Unknown outcomes
are held rather than automatically resent. The dashboard must be refreshed manually.

The server binds to loopback. Local profiles are rejected when a public origin or
non-loopback bind is requested. An email address alone cannot sign into an existing
local profile. Keep the browser session; it expires after seven days. Local recovery
uses `tools/local_access.py`, which creates a local access link without sending email
or printing the token. Anyone with access to your OS account can access these local
files, so use normal device security and disk encryption.

For direct development use:

```sh
python3 -m webapp.server --local --manual --port 8766
```

The optional service-manifest utility remains available for operators, but it is not
part of local setup and is not run automatically. Generated manifests launch the
on-demand server; they do not turn its removal scheduler on. Do not install services
if you want the app to stop when you close your terminal.

## Readiness is specific

`run_service.py --check --json` reports whether the interface can start separately from
`live_removals_ready`. A local app can start with no mail credentials and no browser
installed, but unsupported browser routes will show blocked. A complete browser route
requires compatible selectors, the correct approved fields, and recorded live evidence.
Inspected or disabled recipes are not counted as verified removals.

See [broker verification](BROKER_VERIFICATION.md) and
[free CAPTCHA setup](LOCAL_CAPTCHA.md) for current coverage and actual limits.
The original SMTP/IMAP setup helpers are retained for explicit operator configurations;
`--local` does not use them, and mail-connection/test commands are refused in local mode.

## Vercel and public hosting

The public deployment runs a browser-local workspace. Build it with `python3 tools/build_preview.py`, then deploy `preview/` to Vercel. The generated public HTML loads the broker audit and catalog, workspace core, removal-mail client, shared automatic-submission contracts, removal-session controller, form batch and workspace UI before the shared interface controller. The audit is public official-channel metadata, with no person or request data. It fails closed if the core is missing. Public CSP blocks native HTML form submissions. The hosted API rejects personal-profile writes without parsing or storing their bodies.

The optional local challenge host is installed on the person's computer, separately
from Vercel. Hosting the website does not install Tesseract, provide a universal solver
or connect browsers to the operator's computer. Follow the [per-user helper setup](LOCAL_CHALLENGE_HELPER.md).

No database, account login, inbox, paid API, cron or persistent hosted browser is needed for the workspace and companion. Its catalog has 43 reference routes: two global portals plus US, Canadian, UK, German and Turkish packs. Fourteen standard initial actions and five separate transient forms have companion support. Twenty-four routes lack reviewed form fill; six of these have a reviewed privacy-email alternative. Seven email routes are supported in total, including NumaraAra’s existing form route. CMA is a marketing registration, not broker deletion. All 37 routes outside the original six have an official-channel audit, which does not establish automatic execution or deletion. Other countries see the global portals and an explicit coverage limit. The companion ZIP is generated from an explicit file allowlist and served at `/downloads/erase-me-companion.zip`. No Chrome Web Store purchase is required for loading the unpacked extension. The current companion is version 0.12.0; replace an older extracted copy and reload it in Chrome before using automatic submissions, record matching or local challenge recognition. The extension requests only the twenty reviewed optional form origins.

Version 0.6.0 waits at most 12 seconds for FastPeopleSearch's ordinary widget response
within the original approved document and form. It uses DOM/input events and one
foreground deadline, without polling, recurring work, challenge clicks or additional
vendor permissions. Expiry, navigation, changed controls or an unresolved challenge
stop the action. Readiness alone does not establish broker acceptance or removal.

Apollo requires an explicitly entered business email and authorization. Spokeo requires a confirmed direct listing URL. The public workspace can open a Google name/city search on an explicit click; it does not crawl or classify those results. Individual route holds survive backup and campaign resume. Existing-tab checks observe supported fresh verification evidence only, without resending forms or reading mail.

The five added form contracts cover AdvancedBackgroundChecks and No Sorgulama, NumaraAra, NumaraSor and TelefonSorgulama. Each requires explicit own-request review. Plain request text and NumaraSor’s own-number field remain local until the chosen companion action sends only those approved fields to the broker form. NumaraAra has the separately approved agreement, local text-code and submission contract introduced in 0.5.0. Version 0.9.0 adds optional guarded initial submissions for AdvancedBackgroundChecks, No Sorgulama and NumaraSor. The app displays their current agreements and policy sources before authorization. TelefonSorgulama remains prefill only; later confirmation, identity and processing steps need separate contracts.

Audited contact alternatives provide 24 fixed published recipients. Draft preparation, copying and downloading happen only in the browser; the hosted app has no sending endpoint. Seven fixed privacy contacts also support a separate, explicitly approved one-shot send from the local dedicated Gmail connector, after optional fresh `gmail.send` consent. Verified privacy channels can use an explicitly supplied own-record reference; registry/support contacts get a generic procedure question with no profile identifiers. Marketing registrations and provider phone/SMS/postal instructions are separate manual channels, not verified deletion.

The optional hosted receipt relay is a separate, disabled-by-default private pilot. It uses a dedicated Gmail account connected through [OAuth](GMAIL_OAUTH.md), private server secrets and a separate operator access key. The public app has no personal-inbox connection. Profile data is not sent to the relay; it accepts only scoped operation references and capabilities. The API entry point is `preview/api/index.py`; its trusted helper is `preview/lib/removal_mail.py`, outside Vercel's independently discovered API directory. Keep both in the deployment source.

New service-contact aliases are available only for USPhonebook and FastPeopleSearch where accepted. SearchPeopleFree uses the person’s typed email; existing signed references remain readable with their links held.

An enabled relay checks receipts only after an explicit request. `/check` remains URL-free. USPhonebook and FastPeopleSearch have reviewed continuations: a separate `/continue` revalidates the same authenticated receipt and returns its exact official form URL transiently to the browser. The companion can fill USPhonebook's separately approved name, city, state, ZIP and removal contact, or check FastPeopleSearch's original prefilled name/contact and ticket without entering additional data. Both official forms require either date of birth or street address before final matching and submission. Erase Me does not collect or autofill those details or a phone number. Accuracy statements, final challenges and submissions remain separate steps. Other confirmation links stay held. Neither receipt checking nor second-form preparation establishes a deleted record.

Follow [the relay deployment contract](AUTOMATIC_CONFIRMATIONS.md). Never put OAuth tokens, client secrets, pilot keys, private capability backups or mailbox configuration into public assets. Confirmation URLs must not be logged or persisted. Free provider and hosting quotas apply. The private pilot is not an unrestricted public mail service, and it starts no recurring timers.

Never expose the separate local Python API or its session-recovery mode publicly. Do not copy local configuration, profiles or SQLite data into the deployment.

Current scope is documented in [PUBLIC_WORKSPACE.md](PUBLIC_WORKSPACE.md). Broker verification, CAPTCHA and record matching remain user steps. No independently verified deletion is established by this release.

The application is MIT-licensed. Browser, recognition binaries, fonts and model weights retain their own licenses. See [third-party licenses](../THIRD_PARTY_LICENSES.md).

## Public users' local removal-only email

The public workspace offers a [per-user native connector](LOCAL_REMOVAL_MAIL.md) that
uses each person's own removal-only Gmail account on their computer. No hosted OAuth
credential store, operator key or new paid dependency is needed for that transport.
One-time provider/client and native-host setup is required; supported desktop platforms
and seven-day capability limits are documented explicitly. The separate hosted shared
relay retains its existing private gate. Never publish its credentials to enable users.

The public build packages a second explicit source archive at
`/downloads/erase-me-local-mail.zip`. It contains the six required Python sources,
two setup documents and MIT license, preserving relative imports. No private config,
OAuth file, SQLite grant database or user profile is included.

The local-mail source archive also includes the temporary loopback browser setup
server, its three static assets and Mac/Linux launchers. They are downloaded sources,
not hosted credential-upload endpoints. Do not run that setup server as a public
service or add it to a process supervisor, startup task or schedule.

Version 0.12.0 includes guarded FamilyTreeNow initial verification and separate transient
MyLife, PeopleFinders and That’s Them prefill reviews. Those three leave challenge and
submission on the official site. The companion source ZIP has 18 allowlisted files;
the local-mail source ZIP has 17 and includes the optional sender. Local mail requires
Python 3.10+, macOS Chrome or Linux Chrome/Chromium, a dedicated Gmail account and an
own Google Desktop client. It is not a publicly verified zero-setup Gmail service.
No real deletion has been independently verified; both live pilot requests stay held.
