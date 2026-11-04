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

The Vercel deployment is a synthetic demo. It does not run the local browser, SQLite
database or real removal requests. Local data and credentials are never copied into
that preview. No domain or public server is needed for the local app.

A public signup service requires a separate authenticated backend, HTTPS, persistent
storage and a host for browser execution. The local self-attested session mode must
not be published as a public login system. Free source code does not guarantee free
managed hosting at arbitrary scale.

The application is MIT-licensed. Browser, recognition binaries and model weights
retain their own licenses; see [third-party licenses](../THIRD_PARTY_LICENSES.md).
