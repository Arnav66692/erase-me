# Your own removal-only mailbox

This optional connector runs on your computer when you explicitly request a mail
action. It uses your own separate Gmail account and the existing installed-app OAuth
setup. Google OAuth credentials never enter the hosted workspace, Chrome extension storage,
private workspace backup or public repository. No daemon or scheduled check is installed.

This is an installable per-user connector, not an anonymous shared-mail service or a
mailbox provider. You still create a separate account and complete its provider login.
Each user supplies their own installed OAuth client until a broadly approved client
can be distributed. Your personal inbox must remain disconnected.

## Guided setup

You need desktop Python 3.10 or newer, the Erase Me Chrome companion, a separate Gmail
account and your own Google Desktop OAuth client. No paid service, app password or
personal-inbox connection is required.

1. Create a Gmail account used only for removal requests. Keep its password and
   login checks out of chat and Terminal. If you already have this separate account,
   reuse it.
2. Follow [the installed-app OAuth guide](GMAIL_OAUTH.md#prepare-the-google-client)
   to enable the Gmail API and download a **Desktop app** client JSON outside the
   checkout. Google account/client creation and consent remain provider-controlled
   steps; this software cannot create them silently.
3. Install or reload the Erase Me companion. Extract the
   [connector source ZIP](https://erase-me-preview.vercel.app/downloads/erase-me-local-mail.zip)
   into a permanent folder, open Terminal in that folder and run:

   ```sh
   python3 tools/setup_removal_mail.py
   ```

   The guide asks for the primary email used in your Erase Me profile, the separate
   removal address, the companion ID from `chrome://extensions` and the Desktop
   client JSON path. The companion popup can copy a command with its exact ID
   already included. Paste the file path, **never its contents, a password or code**.
   If that selected client file is not private, the guide offers to make it owner-only.

   Choose **only the separate removal account** in Google's consent window. Setup
   verifies its identity, saves credentials privately and installs/checks the native
   connector. A matching saved connection is reused after an identity-only check,
   so rerunning setup does not repeat consent. Changes to an existing connector
   registration require an explicit local approval. No Gmail messages are read.
4. In Erase Me choose **Connect my removal-only mailbox**. Enable **local connectors**
   in the companion when requested. Check that the displayed account is your separate
   removal-only account before preparing a broker contact.

macOS Chrome and Linux Chrome/Chromium are supported. Linux Chromium users append
`--browser chromium` to the guided command. Mobile browsers can use the workspace
and official broker links, but this native connector requires a supported desktop.
The setup installs no service, daemon or timer. OAuth's temporary loopback callback
listener closes when consent finishes or times out.

To check an existing setup explicitly, without installing a missing connection:

```sh
python3 tools/setup_removal_mail.py --check
```

An intentional account/profile change requires `--reconnect` and fresh consent. It
does not alter held requests or replace their existing operation references. If you
prefer separate advanced commands, the original
[OAuth connection](GMAIL_OAUTH.md#connect-explicitly) and
`install_mail_host.py --extension-id YOUR_32_LETTER_ID --install` interfaces remain
available. Credentials are stored at `~/.erase-me-removal-mail/gmail-oauth.json`,
outside the extracted source folder and browser workspace.

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
| New contacts | 10 per workspace and 20 per connected account per UTC day |
| Receipt/continuation checks | 30 per workspace and 100 per account per UTC day |
| Status/cached-contact identity checks | 120 per workspace and account per UTC day |
| Repeated receipt scans | At least 60 seconds between checks of the same grant |
| Simultaneous provider work | One account lease lasting at most 25 seconds |

An approved continuation can immediately follow its receipt check; the repeated-scan
cooldown does not block it. A consumed continuation cannot be released again. Failed
or interrupted contact issuance is held rather than silently issuing another address.
Lease expiry and quota-day changes are evaluated only on the next explicit action.

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
history. Revoke the dedicated provider grant and remove private local files yourself
when you intentionally retire the mailbox. Never commit them to GitHub or share a
private workspace backup publicly.
