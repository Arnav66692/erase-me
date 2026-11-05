# Dedicated removal-only mailbox setup

This prepares a separate IMAP mailbox for removal-related messages. It does not
connect to a personal inbox, send mail, read messages, install a service or schedule
work. A separate mailbox is now permitted by the product requirements. No actual
mailbox address or provider has been supplied for this setup yet.

The public workspace and companion do not yet use this connection. Saving settings
is preparation, not evidence that hosted automatic confirmations are operational.
Mailbox processing needs separately reviewed broker sender and confirmation-link
contracts, request correlation and an explicit user-triggered processing action.
The existing archived email-sending routes remain disabled.

## What you need

Create or choose a mailbox used only for removal-related mail. It must support plus
addressing so each request can use a distinct `+erase-<request-id>` recipient. Do not
reuse a personal account, a Gmail dotted variant or a plus alias of that account.
The mailbox local part must contain only letters, digits, dots, hyphens or underscores
and be no more than 25 characters, leaving room for the generated request tag.

Obtain the provider's IMAP TLS hostname and its trusted inbound
`Authentication-Results` server ID from official provider information. The provider
must make trustworthy delivery-authentication results available. Do not guess this ID
or relax authentication checks to make a message pass. A provider-issued app password
or IMAP token may be necessary. No SMTP credentials are requested by this helper.

Never paste passwords, app passwords, recovery codes or capability secrets into chat,
GitHub, a browser form or a command-line flag.

## Prepare settings privately

Run in your own interactive terminal from the repository, replacing the example
addresses and hostnames with those of the new dedicated account:

```sh
python3 tools/configure_removal_mailbox.py \
  --dedicated \
  --mailbox removals@mail.example \
  --personal-email person@personal.example \
  --imap-host imap.mail.example \
  --authserv-id mx.mail.example
```

`--dedicated` asserts that this separate mailbox contains removal-related mail only.
The personal address is used only to reject the same inbox and aliases. The saved
file contains its canonical hash rather than the personal address. Password input is
hidden. Setup refuses piped input and a terminal unable to hide the password.

The default file is `~/.erase-me-removal-mail/config.json`, separate from the local app
configuration. The directory is mode 700, its marker and configuration are mode 600.
Repository paths, symlinks, unowned files, insecure permissions and unrelated directories
are refused. Existing settings require `--replace`. Replacement creates a new private
capability secret, so previously issued service capabilities would need to be renewed.

The file includes dedicated IMAP settings and a locally generated 64-hex capability
secret for the planned service. It is never printed. Do not publish or deploy this file.
This helper does not export or install hosted secrets.

## Check without connecting

```sh
python3 tools/configure_removal_mailbox.py --check
```

This validates only local structure, privacy permissions and the distinct-mailbox rule.
It does not prove that credentials or plus-address delivery work.

## Explicit connection test

```sh
python3 tools/configure_removal_mailbox.py --check --test-connection
```

Only this opt-in test connects. It uses TLS with certificate verification, a 15-second
connection timeout, login and read-only folder selection, then logs out. It never
searches or fetches messages, sends mail, marks messages read, deletes mail or starts
scheduled work. Output reports only success or a generic failure and never prints
credentials or provider error content. Success does not validate delivery, sender
authentication headers or any broker confirmation link.

## Address purpose remains important

A dedicated mailbox may be used as a removal contact where a broker accepts a separate
contact address. It cannot silently replace the email tied to a record when a broker
requires verification of that existing address. Those cases need a forwarded, specific
broker message or a user-completed verification step. ID uploads remain excluded.

A forwarded message is not automatically authenticated as coming from the broker.
Quoted or attached authentication headers are untrusted. Automatic handling of
forwards needs a separately validated provenance mechanism. Until then, those
messages stay held for review and their links are not executed automatically.
