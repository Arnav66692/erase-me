# Broker route verification

Directory inspection date: 2026-10-28. Inspected with the free gstack Chromium browser,
using a separate browser state file. No personal profiles were searched, no
removal forms were submitted, and no email was sent. The only name search used
the deliberately synthetic name `Zzxqfixture Erasemeverification`.

This statement describes the public-route research recorded here. Authorized
pilot runs and their personal evidence are tracked privately and must not be
published in this document or in fixtures.

`config/broker-recipes.json` contains **three disabled drafts**, not three working
removal integrations. The routes preserve observed form selectors and the work
needed to finish each integration. `enabled: false` and an empty
`supported_actions` list prevent the bundled adapter from using the drafts.
Do not activate them just by changing those flags.

## Evidence stages

| Stage | Meaning | Current drafts |
| --- | --- | --- |
| `inspected` | Public official form and DOM were read successfully | Yes |
| `fixture_tested` | Synthetic fixture structure and disabled execution are checked locally | Yes |
| `live_submitted` | An authorized real request reached an observed success state | No |
| `removal_verified` | A previously matched listing was independently verified absent | No |

The older catalog's `verified` field describes source/page research. It must not
be interpreted as proof that the browser adapter can complete a removal.
Recipe keys use base catalog IDs, for example `usphonebook`, without a country
prefix. The adapter validates `enabled` and `supported_actions` before use.

The runtime supports declarative text fields, select controls, and checkboxes,
and rejects hidden or disabled controls. It requires visible success evidence
that was not already visible before submitting. These capabilities make the
first forms representable; they do not establish the second-form or final
removal evidence needed to activate these drafts. The complete schema and
notification delivery rules are in [ADAPTER_PROTOCOL.md](ADAPTER_PROTOCOL.md).

## Observed routes

### People Data Labs: verification initiation

On 2026-10-29, the official [deletion portal](https://privacy.peopledatalabs.com/policies?action=ERASURE&modal=log-in)
was inspected and an authorized pilot reached the visible **Email sent!** state.
Only the supplied email was entered. No inbox was connected or read. The portal
requires the person to follow that email and finish the broker's deletion flow.
This is verified initiation of email verification, **not** a completed deletion
request, discovery of a listing, or evidence that any data was deleted.

The bundled `peopledatalabs-form` route implements this initiation. It checks the
exact origin, deletion-action query, enabled email input and same-purpose form,
and requires a fresh visible success message. Ambiguous writes are held without
resubmission. A persisted initiation is never repeated by Run check. The dashboard
asks the person to finish the broker steps; their completion report remains
unverified. Private pilot details are stored outside the repository.

### USPhonebook

The [official removal page](https://www.usphonebook.com/removal) returned HTTP 200.
Its first form is `#verifyEmailForm`, posting to `/removal`. Required profile
fields are `#subject-firstname`, `#subject-lastname`, and `#subject-email`.
`#subject-middlename` is optional. `#user-type` distinguishes `subject` and `agent`;
the agent mode has separate identity fields. `#agreement` is required and `#BRP`
submits. The form loads reCAPTCHA Enterprise.

The page describes an email link valid for 24 hours. That link opens another
opt-out form; it does not complete the removal by itself. The page asks users to
allow three days after that second form is submitted. Neither the second form
nor a successful submission was inspected.

A synthetic search at
`/zzxqfixture-erasemeverification/california` returned HTTP 404 with a specific
`.no-results-content-wrapper` and a zero-results title. This is evidence about
empty **search results only**, not a reliable removed-profile detector. An HTTP
404, blocked page, or missing selector alone is never proof of removal.

The [privacy notice](https://www.usphonebook.com/privacy) lists
`support@usphonebook.com` for contact, but describes web/phone methods for privacy
requests. This research did not verify email as a complete removal route.

### SearchPeopleFree

The [official opt-out page](https://www.searchpeoplefree.com/opt-out) returned HTTP
200. `#o_form` contains `#o_first`, `#o_middle`, `#o_last`, `#o_email`, `#o_terms`,
and `#o_submit`. The form's HTML has no method or action; the observed script
intercepts submission and posts to `/proxy/api/anonymous/begin`. It uses a
Turnstile response. Calling native `form.submit()` would not execute that route.

The observed success callback redirects to `/opt-out/email`. That callback is
source evidence only: it was not executed, and its destination was not
successfully inspected. Both `#o_success` and `#o_success_sent` already exist in
the initial DOM with `display: none` via `.d-none`. Their existence must not be
reported as success. A recipe needs a visible state transition and a real
submission outcome before enabling its submit action.

The email link starts a 30-minute removal session, within which the user must
find and remove their record. The first form's consent also certifies ownership
of the supplied email address. Do not silently use a shared operator address as
though it belongs to the subject.

### SmartBackgroundChecks

The [official removal page](https://www.smartbackgroundchecks.com/remove)
returned HTTP 200. Its form posts to `/remove`. It requires `#subject_fn`,
`#subject_ln`, `#subject_email`, and `#confirm_authorize`. `#subject_mn` is
optional. `#requester_type` distinguishes `subject` and `agent`, with separate
agent identity fields. The submit button is
`form[action="/remove"] button[type="submit"]`; the form uses reCAPTCHA.

The page describes the same two-form sequence: email initiation, a link valid
for 24 hours, then a record-matching opt-out form. It asks users to allow three
days after the final form is submitted. Post-submit and removed-listing states
were not inspected.

### FastPeopleSearch

The [official opt-out page](https://www.fastpeoplesearch.com/optout) returned HTTP
200 during the parent agent's public inspection on the same date. The observed
form is `#optout-start`, posting to `/optout-start-submitted`.
`select[name="am"]` offers `subject` and `agent`. Profile inputs are
`#firstname`, optional `#middlename`, `#lastname`, and `#email`.
`[name="legal"]` is the authorization checkbox. The form uses Turnstile and has
conditional `agentFirstname`, `agentLastname`, and `agentEmail` fields.

No success selector, confirmation-link path, second form, or removed-listing
state was established by that public inspection. This observation is recorded
as research only; it does not add an enabled recipe. Do not infer that the first
email request or a successful Turnstile check completes removal.

## Unreachable routes

These are observations from this environment, not claims that the websites are
unavailable for everyone. No replacement selectors were invented.

| Official URL | Result on 2026-10-28 |
| --- | --- |
| [That's Them](https://thatsthem.com/optout) | HTTP 403, CloudFront request-blocked page |
| [ClustrMaps](https://clustrmaps.com/bl/opt-out) | `net::ERR_CONNECTION_REFUSED` |
| [Nuwber](https://nuwber.com/removal/link) | `net::ERR_NAME_NOT_RESOLVED` |

## Fixtures and next steps

The HTML under `tests/fixtures/broker_pages/` is an original minimal reconstruction
of observed element IDs, input types, form actions, and hidden states. Its prose
and any names are synthetic. It contains no real listings, cookies, CSRF tokens,
live CAPTCHA keys, broker scripts, or saved confirmation links. Fixture tests
verify these contracts; they do not demonstrate live acceptance or deletion.

To finish a route, use a consenting subject who completes their own broker email verification.
Capture a strongly matched listing, approve the exact fields, and supply first
and last names explicitly rather than guessing how to split a full name. Select
the correct subject/agent mode and complete any required agent authorization.
Observe the initial submit result and inspect the second form reached by the
subject's verification step using its actual DOM. Only then
record a request as submitted. Independently check the original listing after
the broker's processing interval before marking it removed. Keep private
evidence outside the repository and commit only sanitized structural fixtures.

Run the local contract checks with:

```sh
.venv/bin/python -m pytest tests/test_broker_recipes.py
```
