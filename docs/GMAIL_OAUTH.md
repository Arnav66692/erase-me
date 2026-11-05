# Dedicated Gmail OAuth connection

Use this connection only for a separate mailbox containing removal-related mail.
It does not use an app password or ask you to enable 2-Step Verification. Google
can still require its own account sign-in or verification steps. The connector
cannot bypass those checks.

The personal inbox remains excluded. The supplied dedicated address is compared
with the personal address, including Gmail dots and plus aliases. After Google
consent, the connector obtains the signed-in account identity over verified TLS
and checks that its verified email matches the dedicated mailbox. It never calls
any Gmail endpoint during connection. A different selected account is refused
and the newly issued grant is revoked.

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

Replace these example values with the addresses and private file path selected
for your own account:

```sh
python3 tools/connect_removal_gmail.py \
  --mailbox removal-only@gmail.com \
  --personal-email personal@gmail.com \
  --client-json /absolute/private/path/desktop-client.json
```

The connector opens Google's consent page in the browser. Choose the **dedicated
removal account only**. It requests just these scopes:

- `openid`
- `email`
- `https://www.googleapis.com/auth/gmail.readonly`

No sending, modification or deletion scope is accepted. Extra granted scopes are
refused. The flow uses PKCE S256, a cryptographically random state and a listener
bound to `127.0.0.1` on an ephemeral port, with callback path `/oauth/callback`.
Authorization waits at most 120 seconds. Invalid callback hosts, paths, states and
duplicate codes are refused. Codes and tokens are not printed or logged.

Successful connection stores `~/.erase-me-removal-mail/gmail-oauth.json` with mode
600 in an owner-private mode-700 directory. It contains the client credentials,
read-only tokens, approved scopes, verified dedicated identity and a hash used to
exclude the personal inbox. The setup refuses repository paths, unrelated data
directories, unsafe permissions and links. Reconnecting requires `--replace`.

## Check or refresh on demand

```sh
python3 tools/connect_removal_gmail.py --check-token
```

Only an explicit call checks the dedicated identity and refreshes a token when it
is near expiry. Nothing installs a service, starts a timer, polls messages, reads
Gmail contents or sends mail. A temporary provider error is reported without
printing its response. A selected-account mismatch revokes the grant rather than
proceeding. Future message readers must use the identity-checked credentials and
remain limited to correlated removal operations.

Google may expire or revoke a refresh token. External consent screens in Testing
can impose short token lifetimes and test-user limits. Gmail read-only is a
restricted scope and public authorization distribution may require Google's
verification process. This local connection does not establish an unlimited or
verified public Gmail application. The remaining broker-specific confirmation
and independent-removal evidence checks are separate work.
