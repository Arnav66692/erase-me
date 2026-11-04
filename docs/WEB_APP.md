# Erase Me local app

The current app is local, inbox-free and on demand. Type a name, age and email,
authorize requests for your own information, and press Run check. Country, city and
region clarify public-listing matches. A typed email is not treated as verified ownership.

## Start

```sh
python3 tools/configure_service.py --local
python3 tools/run_service.py
```

Open http://127.0.0.1:8766. No Gmail login, app password, SMTP or IMAP is required.
The configuration contains local paths only. The app uses a separate private SQLite
directory, `~/.erase-me-web-local`, and never imports the older family profiles.
See [setup and recovery](DEPLOYMENT.md) for details.

## What happens

- Signup stores a local self-attested profile and a private browser session.
- Work starts only on an explicit Run check. Refreshing and reopening do not send requests.
- Supported forms use the email exactly as entered. The app never reads the inbox,
  sends from that address, or silently replaces it with a service mailbox.
- Broker email verification remains a user step. Reporting that step complete queues
  a check where one is supported; it does not prove data deletion.
- Public listings require enough matching evidence. Name alone is insufficient.
- Sent requests, broker steps and independently verified removals remain distinct.
- Unknown layouts, failed CAPTCHA attempts and ID requirements stop that route.
- Pausing blocks future actions; deletion removes local history but cannot recall
  requests already delivered to a broker.

## Coverage and limits

The People Data Labs route starts its deletion portal using the supplied email.
The official portal's **Email sent!** state was observed in an authorized pilot.
The user must finish the broker email and portal steps. This initiation contributes
zero found listings, submitted deletions or verified removals to dashboard counts.
A user completion report remains unverified and does not cause another email.

[Broker verification](BROKER_VERIFICATION.md) records observed pages, fixture tests,
actual submissions and removal evidence separately. The bundled directory recipes
remain disabled unless the relevant path has been validated. An accessible form or a
passing synthetic test is not evidence of a completed removal.

Email request sending is disabled, including the published Apollo address that bounced
in the pilot. [Email behavior](EMAIL_REQUESTS.md) documents this change. No recurring
checks, inbox polls, status emails or app automations are started by local setup.
Existing delayed deadlines in the database run only when another check is explicitly requested.

Free local OCR and audio recognition are available for supported challenges. They do
not guarantee passage through managed bot walls or every CAPTCHA. See
[CAPTCHA setup and limits](LOCAL_CAPTCHA.md).

## Access and deployment

The server binds to loopback and rejects local mode on public origins. The same browser
keeps its session. Email alone cannot recover a profile; the machine owner can use
`python3 tools/local_access.py` to reopen it locally without sending email.

The Vercel preview remains synthetic-only and accepts only its sample profile.
It contains no real-user database or removal worker. Public signup requires separate
hosting and authentication work; do not publish local-mode authentication as a public API.

The app uses Python 3.10+ and the standard library. Run verification with
`.venv/bin/python -m pytest -q` and `node --test tests/test_manual_ui.cjs`.
