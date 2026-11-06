# Dedicated Gmail OAuth connection

Use this connection only for a separate mailbox containing removal-related mail.
The [local browser setup](LOCAL_REMOVAL_MAIL.md#browser-setup) also offers a Gmail
app-password method for eligible accounts. That method needs no Google Cloud client,
but Google requires 2-Step Verification and may not offer it for every account.
Google recommends Sign in with Google; this OAuth method remains the default and
does not require an app password. Erase Me does not enable account security settings.
It does not use an app password or ask you to enable 2-Step Verification. Google
can still require its own account sign-in or verification steps. The connector
cannot bypass those checks.

The personal inbox remains excluded. The supplied dedicated address is compared
with the personal address, including Gmail dots and plus aliases. After Google
consent, the connector obtains the signed-in account identity over verified TLS
and checks that its verified email matches the dedicated mailbox. It never calls
any Gmail endpoint during connection. A different selected account is refused
and its unused local credential is discarded without activating it.

## Prepare the Google client

In a Google Cloud project owned by the operator, enable the Gmail API and create
an OAuth client of type **Desktop app**. Configure the OAuth consent screen and,
while it is in Testing status, add the dedicated mailbox as a test user. No
billing setup is required by this connector. Use the official
[installed-app flow documentation](https://developers.google.com/identity/protocols/oauth2/native-app)
and [Gmail scopes reference](https://developers.google.com/workspace/gmail/api/auth/scopes).

Download the client JSON into a private directory outside the repository. Keep it
owner-readable only, with file mode 600. Never paste its client secret, an
authorization code, an access token or a refresh token into chat, GitHub or a
command-line argument. Keep the existing IMAP/app-password configuration separate.

The client must be a Google `installed` client. Web clients, arbitrary OAuth
endpoints, symlinks, hardlinks and non-private files are refused.

## Connect explicitly

The recommended per-user setup is the local browser screen, opened by the source
download’s Mac/Linux launcher or this command:

```sh
python3 -I -B tools/mail_setup_web.py
```

It collects account addresses and a selected client file locally, completes this
same OAuth flow and installs/checks the companion connector. A matching existing
connection is reused with an identity-only check. The companion popup can copy a
command with `--extension-id` already filled. See
[the guided instructions](LOCAL_REMOVAL_MAIL.md#browser-setup). The Desktop client
preparation above is still required; no broadly approved shared client is supplied.

For an advanced connection without installing the native connector, use the original
command below.

Replace these example values with the addresses and private file path selected
for your own account:

```sh
python3 tools/connect_removal_gmail.py \
  --mailbox removal-only@gmail.com \
  --personal-email personal@gmail.com \
  --client-json /absolute/private/path/desktop-client.json
```

The connector opens Google's consent page in the browser. Choose the **dedicated
removal account only**. By default it requests only these scopes:

- `openid`
- `email`
- `https://www.googleapis.com/auth/gmail.readonly`

Sending is a separate, optional choice. **Allow reviewed privacy-email sending** in
the setup screen (advanced CLI: `--allow-sending`) adds exactly
`https://www.googleapis.com/auth/gmail.send`. An existing read-only connection remains
valid and cannot send. Upgrading it requires explicit reconnect and fresh Google
consent; the screen may reuse the saved Desktop client only for that same account
and primary-email fingerprint. It never silently broadens an existing grant.

Only the exact default scope set or that set plus `gmail.send` is accepted.
Modification, deletion and unrelated extra scopes are refused. The flow uses PKCE S256, a cryptographically random state and a listener
bound to `127.0.0.1` on an ephemeral port, with callback path `/oauth/callback`.
Authorization waits at most 120 seconds. Invalid callback hosts, paths, states and
duplicate codes are refused. Codes and tokens are not printed or logged.

Guided connections create an owner-only `gmail-oauth-<random>.json` in the private
`~/.erase-me-removal-mail/` directory. A versioned `provider-selection.json` pins the
exact provider-specific filename and account/profile hashes. Credentials are staged
privately and activated only after a guarded reservation and a locked comparison of
the prior selection and active file. Cancellation or a conflicting setup discards
only this attempt’s inactive file. Selected versioned files are not rewritten; an
on-demand token refresh stays in memory.

Legacy `gmail-oauth.json` files remain readable. Standalone legacy writes use the same
private commit lock. Use intentional replacement in guided setup to change a selected
versioned connection; the advanced CLI refuses to overwrite it. All configuration
files are mode 600 in an owner-private mode-700 directory, outside the repository.

## Check or refresh on demand

```sh
python3 tools/connect_removal_gmail.py --check-token
```

Only an explicit call checks the dedicated identity and refreshes a token when it
is near expiry. Nothing installs a service, starts a timer, polls messages, reads
Gmail contents or sends mail. A temporary provider error is reported without
printing its response. A selected-account mismatch stops before any Gmail action. Message readers use identity-checked credentials and remain limited to
correlated removal operations. The separate reviewed sender needs an exact message
preview and one explicit approval per operation; connection/check-token never sends mail.

Google may expire or revoke a refresh token. External consent screens in Testing
can impose short token lifetimes and test-user limits. Gmail read-only is a
restricted scope and public authorization distribution may require Google's
verification process. This local connection does not establish an unlimited or
verified public Gmail application. The remaining broker-specific confirmation
and independent-removal evidence checks are separate work.

## Reviewed outbound messages

The optional sender uses Google's fixed
[`users.messages.send` endpoint](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send)
for eight purpose-verified privacy contacts. It accepts no arbitrary recipient,
attachment or provider endpoint. The user reviews the dedicated From address, fixed
To address, subject and body before a single attempt. An opaque digest-bound grant
expires after fifteen minutes; a durable local outbox reserves the attempt before
the API call. An uncertain result is held without retry.

A returned Google message/thread ID establishes API acceptance only, not successful
delivery, broker acceptance or deletion. No public Gmail verification or unrestricted
shared-client distribution has been established by this connector.

## Alternative: dedicated Gmail app password

For an eligible separate account, the local setup screen can authenticate Gmail with
its 16-letter app password. It uses only the fixed `imap.gmail.com:993` and
`smtp.gmail.com:465` hosts with certificate-checked implicit TLS; arbitrary servers,
usernames or ordinary account-password fields are not supported. See [Google’s
requirements](https://support.google.com/accounts/answer/185833) and [protocol
hosts](https://developers.google.com/workspace/gmail/imap/imap-smtp).

App passwords cannot be restricted to the OAuth read-only/send scope sets. The local
connector enforces `allow_sending`, exact reviewed recipients, per-operation grants,
quotas and a durable one-shot outbox. Setup and status authenticate the exact separate
account without opening messages. Receipt checks use read-only INBOX and bounded
operation-alias `BODY.PEEK` queries with the existing provenance parser. Personal-email
fingerprints and Gmail alias normalization are checked before provider work.

New app-password activations use a private `gmail-app-password-<random>.json` file.
Legacy `gmail-app-password.json` remains readable. The explicit versioned
`provider-selection.json` pins the selected method, exact credential filename,
account fingerprint and workspace's primary-email fingerprint. Legacy installations
without a selector retain OAuth behavior. A broken or changed explicit selection never
silently falls back to another method. Changing methods requires intentional replacement.
An unused app password must be removed in Google; changing methods or uninstalling the
connector does not revoke it. The same applies to an unused OAuth grant.

SMTP success is recorded only after Gmail returns DATA status 250, as `smtp_accepted`
with a local observation reference. It never manufactures Gmail message/thread IDs or
claims delivery, broker acceptance or deletion. Interrupted sends remain unknown and
are never automatically retried. Nothing polls mail or starts recurring work.

## Canceling and retiring Google consent

Cancellation prevents an unreserved local activation; an activation already reserved
may finish. Unused local credentials are discarded without automatically calling
Google’s revocation endpoint. Google documents that revocation can affect other
clients in the same project, so the tool does not claim that cancellation withdraws
provider consent. Retire an unwanted grant yourself in your Google account. See
[Google’s revocation semantics](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke).
