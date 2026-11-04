# Email addresses in the form-only app

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
