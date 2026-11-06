# Your own removal-only mailbox

This optional connector runs on your computer only when you request a mail action.
Use a separate Gmail account containing removal-related mail only. Credentials never
enter the hosted workspace, extension storage, workspace backup or repository. No
daemon, recurring check or automatic retry is installed. Personal inboxes stay excluded.

## Browser setup

You need Python 3.10+, the desktop Chrome companion and a separate Gmail account.
The local screen offers two connection methods:

| Method | What you need | Boundary |
| --- | --- | --- |
| App password | A 16-letter Google app password for the separate account | No Google Cloud project or client file. Google requires 2-Step Verification and may not offer app passwords for every account. |
| Google sign-in | Your own Google Desktop OAuth client JSON | Remains available without an app password. [Prepare the connection file](GMAIL_OAUTH.md#prepare-the-google-client). A publicly approved shared client is not included. |

Google recommends [Sign in with Google](https://support.google.com/accounts/answer/185833).
Erase Me keeps that method selected by default. If Google offers app passwords for
your dedicated account, that option avoids Google Cloud setup. Erase Me does not
create the mailbox, enable 2-Step Verification or bypass provider login requirements.

1. Install/reload the companion and extract the [connector download](https://erase-me-preview.vercel.app/downloads/erase-me-local-mail.zip)
   into a folder you will keep. On Mac open `tools/setup-removal-mail.command`.
   On Linux run `tools/setup-removal-mail.sh`. A private local setup page opens.
2. Copy the companion ID from its toolbar popup into the setup page. Enter the email
   used in your Erase Me profile to exclude it, then the separate Gmail address.
3. Choose your connection method. For **App password**, create one in the separate
   account at [Google App Passwords](https://myaccount.google.com/apppasswords) and
   enter it only in this local password field. Never enter your ordinary Google
   password, paste credentials into chat or upload them to the live site. For
   **Google sign-in**, select your Desktop client file and complete Google's own
   consent screen with the separate account.
4. Confirm the account contains removal mail only. Sending starts **off**; enable it
   only if you want individually reviewed privacy emails. Choose **Connect separate
   account**. Setup verifies the account and installs the on-demand connector without
   opening messages or sending a test email.
5. Return to Erase Me, enable local connectors in the companion and choose **Connect
   my removal-only mailbox**. Each supported receipt check and email send still needs
   its own explicit action.

Already connected? Use the same method and leave its password/client-file field empty
to reuse the matching connection. Switching methods, accounts, credentials or adding
sending requires the intentional replacement option. Unchecking sending does not revoke
an existing permission. App passwords cannot be limited to read-only at Google; Erase
Me's local `allow_sending` setting prevents its sender from using them unless approved.
Do not use this option for a mailbox containing personal mail.

If your file manager does not run a launcher, the same browser screen starts with:

```sh
python3 -I -B tools/mail_setup_web.py
```

The popup can copy that command with `--extension-id` already filled. Supported:
macOS Chrome and Linux Chrome/Chromium. Choose Chromium in the setup screen if needed.
Windows and mobile native installation are not included.

The setup listener binds only to `127.0.0.1` on a random port. A private session link,
exact local Host/Origin and strict request schema protect setup actions. Google client files go only to the local process, are staged owner-readable in a private directory and
removed after use. The app-password field is cleared before its local request is sent and
after errors or closing. Only the private local configuration retains that credential. Passwords, verification codes, tokens and file contents do not go
into the hosted app or chat. The setup reads no Gmail messages.

Choose **Close local setup** to stop further actions. If installation was already
reserved, it may finish; an earlier close prevents it. Merely closing the browser tab
does not reliably cancel a Google operation. The foreground listener expires after
its ten-minute session; no background service, recurring timer or mail polling is installed.

### Advanced Terminal guide

The original guided command remains available:

```sh
python3 tools/setup_removal_mail.py
python3 tools/setup_removal_mail.py --check
```

The advanced command above manages Google sign-in. App-password setup uses the local browser form.
Account or method changes require explicit intentional replacement; Google sign-in
reconnection and adding OAuth sending require fresh consent. For the same saved account, the local screen
can reuse its private Desktop client during this explicit upgrade; changing the
account still requires selecting its client file. The advanced command accepts
`--allow-sending --reconnect`. These setup actions
do not alter held requests or replace existing broker operation references.
New guided connections use owner-only `gmail-oauth-<random>.json` or
`gmail-app-password-<random>.json` files inside `~/.erase-me-removal-mail/`, outside the
source folder and browser workspace. Legacy fixed-name files remain readable.
`provider-selection.json` pins the selected method, exact private filename and
account/profile fingerprints; it contains no password. An inactive stage is discarded
if setup is canceled or another connection wins activation. Selected versioned files
are not rewritten. A changed
or missing selected configuration fails closed instead of falling back to another account. The [standalone OAuth guide](GMAIL_OAUTH.md#connect-explicitly)
and native installer remain available for advanced use.

The personal email in setup must match the primary email in this Erase Me workspace.
Gmail dots, plus aliases, case and `googlemail.com` variants are normalized before
comparison. A removal account matching that primary identity is rejected before mail
access. Other local account changes also require a new provider identity check.

## What a mail action does

- **Status:** verify only the dedicated Google account identity; read no messages.
- **Prepare contact:** create one random operation-scoped alias, without submitting a
  broker request or reading mail. Retrying the same saved operation returns the same
  alias after identity preflight; it does not create another contact.
- **Check once:** read a bounded set of messages for that exact alias and submission
  window. The existing receipt engine checks provider authentication, sender, recipient,
  timestamps and purpose. Other personal or unrelated mail is not queried.
- **Continue once:** reauthenticate a specifically checked receipt before releasing an
  approved official broker form URL to the companion. The native host does not open
  links or submit forms. An interrupted release remains held and is not repeated.
- **Revoke:** durably disable a saved local grant. This works without contacting Google,
  including after credentials expire. Resuming a local UI route does not restore a
  revoked mail grant; reconcile the original request before preparing anything else.

Local contact issuance covers FastPeopleSearch, USPhonebook and SearchPeopleFree.
SearchPeopleFree receives an alias of the user's own dedicated account; it does not
receive an operator-shared address. Its authenticated messages still remain held because
no automatic continuation destination has been established. The hosted operator relay
continues to refuse new shared SearchPeopleFree contacts. People Data Labs and Apollo
still require their record-associated addresses; this connector does not substitute one.
Existing held USPhonebook and FastPeopleSearch requests stay held.

## Reviewed privacy-email delivery

Optional sending covers only these fixed contacts and their published purposes:

| Route | Fixed privacy recipient | Official source |
| --- | --- | --- |
| 11880 (processing objection) | `datenschutz.solutions@11880.com` | [Privacy policy](https://unternehmen.11880.com/datenschutz) |
| 411.ca | `privacy@411.ca` | [Privacy policy](https://www.411.ca/privacy-policy) |
| ukphonebook.com | `dpo@simunix.com` | [Privacy policy](https://www.ukphonebook.com/privacy) |
| Das Örtliche/DTM | `datenschutz@dasoertliche-marketing.de` | [Privacy information](https://www.dasoertliche.de/datenschutz) |
| Cepten Numara Sorgula | `mh@mobilisim.com.tr` | [Privacy policy](https://www.ceptennumarasorgula.com/PrivacyPolicy) |
| NumaraAra | `bilgi@numaraara.com` | [Contact](https://www.numaraara.com/iletisim) |
| BeenVerified | `privacy@beenverified.com` | [Privacy FAQ](https://www.beenverified.com/faq/privacy/) |
| PeopleLooker | `privacy@peoplelooker.com` | [Privacy policy](https://www.peoplelooker.com/privacy-policy/) |

Enable reviewed privacy-email sending in local setup and intentionally reconnect.
Google sign-in requests fresh OAuth consent; app-password setup verifies the same
separate account and records its explicit local sending permission. Existing read-only connections remain supported. The optional
OAuth grant adds exactly `gmail.send`; it grants no modify/delete access. App passwords
have broader provider access, so their sender permission is enforced by this local tool. This is a separate
action from copying a local draft or checking a broker confirmation.

Choose the route's email review, affirm that it is your own information and enter an
accurate public record or identity reference. The native helper verifies the dedicated
Google identity and returns the exact From, To, subject and body. Review that message
and approve **Send once**. The primary email is never appended automatically; a
reference you intentionally type is included in the reviewed message. No attachments,
ID documents, hidden recipients or unrelated support requests are sent.

Before an approved send contacts Google, a private local outbox durably reserves the original
operation. Google sign-in uses the fixed Gmail API; app-password sending uses only
`smtp.gmail.com:465` with verified implicit TLS and the exact authenticated account. Its capability binds the reviewed body digest, account, workspace and route
for fifteen minutes. It stores hashes and outcome references, not the name, reference
or message body. The approved message exists in memory and, if accepted, in the
dedicated mailbox's sent mail. The hosted app receives no Google credential.

A `provider_accepted` result means the Gmail API returned message/thread references.
A separate `smtp_accepted` result means Gmail explicitly returned SMTP DATA status 250.
Its local `receipt_ref` identifies that recorded observation; it is not a Google message
or thread ID. Neither result proves delivery, broker acceptance or deletion. Lost, blocked and ambiguous results
are never retried automatically. Read the saved original result without sending
again. Closing an unsent review first records a local tombstone before revoking its
grant; a send already reserved may finish. Imports cannot reactivate a send capability.
Holds and campaign pauses prevent new sends. Both held live requests remain held.

Support/registry contacts remain identifier-free procedure drafts. Vodafone's
record-associated sender requirement is excluded from this separate-account sender.
Record matching, broker verification and independent deletion evidence still require
their own supported stages. No recurring work is installed.

## State, limits and interrupted actions

The native host is `org.eraseme.mail`. The installer pins one exact companion origin.
Calls require the workspace UUID and canonical primary-email fingerprint. Local grants
bind that workspace, fingerprint, dedicated account, broker and original operation.
They are checked before provider access. The app sends no password, refresh token,
client secret, arbitrary provider host or filesystem path through native messaging.

`~/.erase-me-mail-native/` is private to this user (mode 0700). Its secret keys,
registration and SQLite grant/limit files use mode 0600. The database stores operation
references, fingerprints and outcomes; it stores no message bodies, raw confirmation
URLs, access tokens, refresh tokens or full capabilities. Existing capabilities in
workspace backups remain sensitive, operation-scoped bearer references.

Limits are enforced transactionally before network work:

| Action | Local limit |
| --- | --- |
| Privacy-email previews / send attempts | 10 per workspace and 20 per connected account per UTC day, independently for each action |
| New contacts | 10 per workspace and 20 per connected account per UTC day |
| Receipt/continuation checks | 30 per workspace and 100 per account per UTC day |
| Status/cached-contact identity checks | 120 per workspace and account per UTC day |
| Repeated receipt scans | At least 60 seconds between checks of the same grant |
| Simultaneous provider work | One account lease lasting at most 25 seconds |

An approved continuation can immediately follow its receipt check; the repeated-scan
cooldown does not block it. A consumed continuation cannot be released again. Failed
or interrupted contact issuance is held rather than silently issuing another address.
Lease expiry and quota-day changes are evaluated only on the next explicit action.

App-password receipt checks authenticate `imap.gmail.com:993` over verified TLS,
select INBOX read-only and search only the exact operation alias and submission window.
Bounded `BODY.PEEK` reads reuse the same sender/provenance/purpose and confirmation
checks as the OAuth reader. Status and contact preparation authenticate without selecting
a folder, searching messages or marking anything read.

The existing v1 capability expires after seven days. It enables reviewed confirmation
stages, not indefinite monitoring or general completion-email interpretation. An
acknowledgement is not deletion. Independent deletion verification still needs the
correct previously matched record and separate evidence.

## Update or remove

After moving the checkout or updating the connector, rerun installation with `--replace`.
To stop Chrome from discovering it:

```sh
python3 tools/install_mail_host.py --extension-id YOUR_32_LETTER_ID --uninstall
```

Uninstall removes the registration and launcher. It keeps private OAuth credentials,
grant tombstones and secrets so removing/reinstalling cannot silently reset request
history. Retire an unwanted dedicated OAuth grant or app password yourself in Google, then remove private local files yourself
when you intentionally retire the mailbox. Switching methods selects a connection; it does not
revoke the other method’s authorization at Google. Retire an unused grant there explicitly. Never commit them to GitHub or share a
private workspace backup publicly.

Canceling setup does not automatically revoke Google consent: Google’s revocation
endpoint can invalidate other connections in the same project. A cancellation that
wins before activation leaves the prior local connection selected. If activation was
already reserved it may finish, and the local screen reports that state. Unused local
staged credentials are removed without claiming a provider-wide consent rollback.
