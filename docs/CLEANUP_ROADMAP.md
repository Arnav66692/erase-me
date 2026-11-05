# Digital footprint cleanup

Updated November 5, 2026. This is a staged product plan, not a claim of universal erasure.

The workflow is **discover → choose → export → submit → verify → manually recheck**.
Discovery starts from a person's own imported account list or explicitly selected public
pages. It does not require access to a personal inbox, centralized passwords or a recurring job.

## Available now and staged work

| Area | Available now | Next integration and evidence required |
| --- | --- | --- |
| Old accounts | Local JSON/CSV import; keep, export first or removal choices; closure warning; explicit export acknowledgement | Reviewed official export and closure contracts per service. Confirm files, purchases and dependent sign-ins before closure. Never treat a clicked button as deletion. |
| Selected social content | Separate social items, export-first choice and self-reported content review | Selection and preview of the exact posts/comments; export; then supported content deletion before account closure. No bulk deletion without review. |
| Broker listings | Regional route plans, reviewed form actions, supported dedicated-mail continuations and one reviewed final matching-form submission path | More observed contracts and consented listing tests. Keep submission attempt, acknowledgement, reported completion and independently verified absence separate. |
| Search results | Selected search-result URLs, official Google guidance, separate user reports for result and source removal | Eligibility-specific Google request contracts and correlated outcome evidence. Source removal remains its own task. |
| Company privacy requests | Published-contact drafts for supported routes; local company cleanup items | Reviewed delivery integration without personal-inbox access; exact recipient, fields and approval before sending. Company acknowledgement is not completion. |
| Privacy and marketing settings | Local preference items and explicit user reports | Reviewed service-specific controls for privacy, sale/sharing and marketing choices. Changing a preference is not record deletion. |

The local planner is implemented. It imports at most 100 entries from a bounded local
JSON/CSV list, rejects credential fields and private verification URLs, and keeps choices
and history in the browser workspace. Imports require an own-information affirmation.
Private backups include this plan; deleting the workspace removes it. The planner sends
no requests and performs no account closure, content deletion or automatic export.

## Ordering and outcomes

- **Choose:** a saved keep decision performs no outgoing action. Removal choices are plans,
  not authorization for arbitrary later actions. Review exact service, destination and fields.
- **Export:** account-closure choices show a files, purchases and sign-in warning. An export-first
  choice blocks later reported steps until the person acknowledges saving their export.
- **Submit:** each new integration needs its own observed contract, consent and interruption guard.
  The existing companion can make one approved FastPeopleSearch final submission attempt;
  it does not promise that the broker has identified the right record or deleted it.
- **Verify:** local planner reports remain self-reported. Source deletion and search-result
  removal have separate outcomes. Independent verification needs the previously matched
  record and appropriate evidence; an email, empty search or HTTP 404 alone is insufficient.
- **Recheck:** people can explicitly review and report an item again. No polling, alarms,
  scheduled runs, recurring emails or automatic resubmission are enabled.

## Service-specific guidance

On Reddit, closing an account leaves its posts and comments behind, disassociated from
the account. Delete selected content before account closure when that is the goal.
[Reddit's official explanation](https://support.reddithelp.com/hc/en-us/articles/360043047932-If-I-delete-my-account-what-happens-to-my-username-posts-and-comments/).

Google can review eligible personal-information removal requests. Removing a result does
not remove the source webpage, and public-interest exceptions can apply.
[Google's removal guidance](https://support.google.com/websearch/answer/9673730?hl=en).

California's free DROP system is for eligible California residents and includes its own
eligibility verification. It is an official guided route, not worldwide coverage or an
instant removal promise. Broker processing periods do not authorize an Erase Me timer.
[California's official DROP service](https://privacy.ca.gov/drop/).

## Release gates

Each staged integration needs synthetic regression coverage, native-browser checks,
security review, an explicit list of unsupported steps and a consented own-record pilot.
No test should submit requests for unrelated people. An unresolved challenge or missing
identity requirement must produce an actionable held state rather than invented success.
The free MIT core does not depend on a paid solver, hosted model or personal-inbox connection.
