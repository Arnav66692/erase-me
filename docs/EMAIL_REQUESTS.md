# Email addresses in the local form-only app

The app does not connect to users' inboxes, request mailbox passwords, or send
privacy-request emails. An email address entered by the user is supplied only to
an approved broker removal form. It is self-reported; entering it does not verify
ownership. Any required broker confirmation email remains an action for the user.

Earlier own-mailbox email routes are archived and disabled, including for historical
jobs. Environment SMTP/IMAP credentials cannot reenable those routes. Their metadata
remains only to identify old requests without sending another request.

Apollo's published `privacy@apollo.io` address rejected a live request, so it is not
a working sending route. An accepted SMTP send or a published privacy address never
establishes that a broker accepted a deletion request or removed a record.

No background inbox polling, scheduled email checks, or automatic resubmission is
provided by these archived routes. Requests previously sent through an assistant's
connected mailbox are separate historical actions; they are not imported or resent.

## Separate public receipt pilot

The public browser workspace has an optional [dedicated removal-mail receipt
pilot](AUTOMATIC_CONFIRMATIONS.md), connected by an operator through [Gmail
OAuth](GMAIL_OAUTH.md). It has no personal-inbox access or sending permission and
does not reactivate the archived SMTP/IMAP sending routes above.

Only USPhonebook and FastPeopleSearch can use an explicitly chosen
shared removal contact. The original profile email stays unchanged. People Data Labs
and Apollo keep their record-associated email. Apollo’s business email is entered and
authorized separately rather than copied from the profile. SearchPeopleFree uses the
person’s typed email; new shared contacts are disabled because its consent associates
the address with the requester. Existing signed references remain available for held-only
receipt checks. A shared contact does not establish
ownership of the subject's record or satisfy a broker's ownership terms automatically.

The relay requires private-pilot activation and an operator key for every explicit
action. Receipt checks return held or pending metadata without a confirmation URL.
USPhonebook alone has a reviewed continuation: a separate action revalidates the same
authenticated receipt and opens its exact official second form through the companion.
Only authorized name, city, state, ZIP and contact fields are filled. USPhonebook also
requires either date of birth or street address, entered directly on its official form
by the person. Erase Me does not collect or autofill those details or a phone number;
the accuracy checkbox, CAPTCHA and final submission stay with the person. Other
confirmation routes remain held. Neither a
receipt nor form preparation proves accepted removal or deletion. No recurring
mailbox checks run, and personal inboxes stay disconnected.
