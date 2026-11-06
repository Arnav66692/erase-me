# Erase Me

Tools for finding and requesting removal of your own personal information from data brokers and public directories.

[![CI](https://github.com/Arnav66692/erase-me/actions/workflows/ci.yml/badge.svg)](https://github.com/Arnav66692/erase-me/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Open the workspace](https://erase-me-preview.vercel.app/) · [Install the companion](https://erase-me-preview.vercel.app/companion.html) · [Documentation](docs/PUBLIC_WORKSPACE.md) · [Contributing](CONTRIBUTING.md)

Erase Me combines a browser workspace, a narrowly permissioned Chrome extension and an installable agent skill. It keeps a private record of the actions you authorize and separates form preparation, broker verification and removal evidence.

**Current scope:** companion 0.12.0 supports 14 standard initial form actions, five separate transient form actions, ten optional broker initial submission contracts and seven reviewed privacy-email send channels, a reviewed FastPeopleSearch final-submission path and one local text-challenge route. Other challenges, identity checks and broker steps can still need attention. No independently verified broker deletion has been established by this release.

## Get started

### Browser workspace

1. Open [Erase Me](https://erase-me-preview.vercel.app/) and create a workspace with your own details.
2. Select your country and prepare a route plan.
3. Find and confirm your own listings, then start a broker action or review a form batch.
4. Complete the broker's verification steps and record the result.

The workspace requires no account or email login. Your profile and ledger stay in this browser. Export a private backup before clearing site data or changing devices.

**Next steps** shows the email used for each started request. For a supported, authenticated FastPeopleSearch continuation, choose **Enter missing information** inside Erase Me. The companion checks the existing form's requirements without reading identity values. Review the exact fields and certification, then approve one fill-and-submit attempt. Extra identity values stay in memory and are cleared after dispatch or closing; they are not saved in the ledger or backup. Missing or changed tabs stop the action. USPhonebook retains its official-form handoff; held requests stay untouched.

FastPeopleSearch currently marks DOB, street address **and phone** as required even though its text says DOB or address. Erase Me explains that conflict before offering the full set. It never silently adds fields or disables native validation. You can cancel or hold instead. A native submit event establishes an attempt, not broker acceptance or deletion.

**Plan other cleanup** imports your own JSON/CSV account list locally. Choose keep, export first or request removal, and record steps you performed. It includes official Google, Reddit and California DROP guidance. Account closure, social-content deletion and company-request delivery remain staged integrations. See the [cleanup roadmap](docs/CLEANUP_ROADMAP.md).

For supported form filling, install the free [Chrome companion](https://erase-me-preview.vercel.app/companion.html). Load the unpacked extension in desktop Chrome and grant access to its reviewed broker sites. Mobile browsers can use the workspace and official links, but companion actions require desktop Chrome. Updating an older copy requires replacing its extracted files and reloading the extension.

To fill several forms, complete their required details and own-record confirmations, then choose **Review form batch**. Review the selected brokers and exact outgoing fields, authorize the batch once and choose **Fill selected forms**. The companion works through eligible forms one at a time while the page stays open. Held, already-started, incomplete and manual routes are excluded with reasons. **Stop after current form** leaves the remaining forms untouched. Closing or reloading does not resume a batch.

The review offers optional guarded submissions for SmartBackgroundChecks, FamilyTreeNow, USPhonebook, FastPeopleSearch, SearchPeopleFree, AdvancedBackgroundChecks, Apollo, No Sorgulama, NumaraAra and NumaraSor. Review their displayed fields, agreements and policy sources before enabling it. AdvancedBackgroundChecks starts email verification; the Turkish contracts submit their reviewed request forms. Later verification and processing remain separate stages. NumaraAra's text security code can use the free [local challenge helper](docs/LOCAL_CHALLENGE_HELPER.md). An observed submit event is recorded as an attempt; delivery and broker acceptance still require separate evidence.

Companion 0.6.0 gives FastPeopleSearch's normal widget up to 12 seconds to supply its genuine challenge response while the approved action is open. It watches the original form rather than checking repeatedly or clicking a challenge. A changed form, navigation, expired wait or unresolved challenge stops the action. This does not bypass managed challenges or complete the broker's later email and record-selection steps.

### Agent skill

```sh
npx skills add Arnav66692/erase-me --skill erase-me
```

Choose Claude Code, Codex or another supported agent. The skill engine requires Python 3.9 or newer and uses the standard library only. In Claude Code, start a new session and use `/erase-me`.

The skill can assist with your own information or a consenting family member's information. It records consent, builds a country-aware plan, maintains a private ledger and drafts requests. Its submission approvals are separate from the web workspace. See [the skill instructions](skills/erase-me/SKILL.md) and [playbooks](skills/erase-me/references/playbooks.md).

### Local Python app

With Python 3.10 or newer, run from a repository checkout:

```sh
python3 tools/configure_service.py --local
python3 tools/run_service.py --check
python3 tools/run_service.py
```

Open [localhost:8766](http://127.0.0.1:8766). This mode uses a separate local database and starts no recurring removal schedule. Close the terminal to stop the server. See [deployment and local setup](docs/DEPLOYMENT.md).

## Capabilities

| Component | Available behavior | Boundary |
| --- | --- | --- |
| Workspace | Country-specific route plans, explicit listing searches, private backups and individual route holds | Searches return candidates. They do not establish identity or deletion. |
| Chrome companion | Fill reviewed forms, initiate supported verification and optionally submit reviewed initial or matching forms | Changed controls, agreements or challenges stop the action. No ID uploads, paid solvers or background retries. |
| Local challenge helper | Recognize NumaraAra's reviewed five-character image code using local Tesseract | Separate desktop installation. Managed challenges and other site codes are not universally supported. |
| Structured record check | Check one approved Spokeo URL against its structured Person data | Requires exact name and typed identity-email matches. Missing or ambiguous evidence needs attention. |
| Contact drafts | Prepare, copy or download a request for a fixed published contact | Draft preparation does not send mail. |
| Privacy-email delivery | Review an exact message and send once to one of seven verified privacy contacts | Requires optional sending consent for a separate Gmail account. Gmail acceptance is not delivery or deletion. |
| Existing-tab checks | Reconcile narrowly supported, fresh broker acknowledgments | Unknown or unsupported results remain unverified. Forms are not resent. |
| Agent skill | Consent records, reference-based plans, request drafts and private reports | Requires an agent capable of running Python. Browser and submission permissions remain explicit. |

People Trace UK has a separate **Enter private form details** dialog for UK workspaces. It collects the exact birth date, telephone and postcode required by the observed form, plus optional address components. Those details stay in memory and the one-action payload; they are excluded from the saved ledger, backups and companion journal. The challenge and submission remain on the official site. This route is excluded from standard batches.

CMA has a separate private Canadian mailing-address review and optional guarded registration. It suppresses eligible marketing; it is not broker-record deletion. The address is excluded from saved workspace data and backups.

The companion covers standard initial actions for People Data Labs, SmartBackgroundChecks, FamilyTreeNow, Whitepages, USPhonebook, SearchPeopleFree, FastPeopleSearch, Apollo, Spokeo, AdvancedBackgroundChecks, No Sorgulama, NumaraAra, NumaraSor and TelefonSorgulama.

Whitepages has a first-step URL-only prefill. Users must explicitly review their own exact person-record URL; the companion does not click Next or perform the later phone verification. This is not an automatic record match.

Apollo requires a separately entered business email. Spokeo requires a confirmed direct listing URL; its optional structured-record check can supply the own-listing approval only from a unique matching name and identity email on that exact page. Age and city alone are insufficient. The latest Spokeo research was blocked, so this is not evidence of a live matched record. The other structured forms retain their own-request affirmations.

[Current route contracts](docs/BROKER_ROUTE_RESEARCH.md) document the observed controls and their limits.

## Coverage and evidence

| Catalog measure | Current scope |
| --- | ---: |
| Reference routes | 43 |
| Reviewed form actions (including transient forms and registration) | 19 |
| Optional broker initial guarded submission contracts | 10 |
| Separate guarded marketing-registration contracts | 1 |
| Reviewed matching-form submission paths | 1 |
| Routes without reviewed form fill | 24 |
| Reviewed privacy-email send channels | 7 |
| Published contact-draft channels | 24 |
| Source-backed channel assessments | 37 |

Regional packs cover the United States, Canada, the United Kingdom, Germany and Turkey, alongside two global portals. A country without a pack receives the global portals and an explicit coverage notice. Reference coverage does not guarantee that a broker holds your information or accepts a request.

Six of the seven privacy-email routes are among the 24 routes without reviewed form fill; NumaraAra also has a form contract. These counts overlap: 25 catalog routes have an executable form or email action and 18 remain guidance only. MyLife, PeopleFinders and That’s Them use separate transient own-record reviews, alongside People Trace UK and CMA. Their extra identity fields are excluded from saved state and backups; their form submissions remain manual.

Some entries are provider preferences or marketing registrations. CMA Do Not Mail, Canada's DNCL and the UK's TPS are not broker-record deletion services. Other channels require a subscriber, postal request or manual self-service session.

Erase Me uses distinct evidence levels:

| Recorded event | What it establishes |
| --- | --- |
| Form or draft prepared | Approved fields or request text are ready. No final request acceptance is established. |
| Guarded submission attempted | The approved form produced a checked native submit event. Delivery, acceptance and deletion remain unverified. |
| Gmail API accepted message | The dedicated account’s send API returned message/thread references. Delivery, broker acceptance and deletion remain unverified. |
| Verification initiated | The broker reported a supported email-verification step. Later steps remain outstanding. |
| User-reported submission or completion | The person's report is recorded without promoting it to independently verified evidence. |
| Broker acceptance or completion | Requires correlated evidence of that specific outcome. An acknowledgment alone is insufficient. |
| Independently verified deletion | Requires checking the previously matched record. This has not been demonstrated by the release. |

A blocked page, empty search, HTTP 404, confirmation email or completed form is not proof of deletion. See [workspace behavior](docs/PUBLIC_WORKSPACE.md) and [verification notes](docs/BROKER_VERIFICATION.md).

## Privacy and execution model

- **Browser workspace:** the hosted API does not receive or store the profile and ledger. Other people using the same browser profile can read them.
- **Explicit disclosure:** broker actions send only the displayed, approved fields to the selected official form. Listing searches disclose the name and optional city to Google when opened.
- **Local state:** the agent skill stores its records outside the repository with private file permissions. The local Python app uses its own data directory. Private backups can contain personal information and scoped mail capabilities.
- **Agent processing:** your selected agent and its service provider may process the details you supply and the pages the agent reads.
- **Holds and retries:** a held route stays held across backups and campaign resume. Interrupted actions retain their operation references and are not automatically repeated.
- **Batch approval:** selected sites and exact fields are checked again before each form. Batch selections and approval stay in memory, outside backups. Changed fields, uncertain outcomes or failed result storage stop the remaining work for review.
- **No recurring work:** the workspace does not poll an inbox, schedule re-checks or resubmit listings in the background.

Use the tool only for your own information or within the skill's recorded family-consent workflow. Tests use synthetic fixtures and explicitly authorized own-record checks. Never submit requests for unrelated people as a test.

### Your own removal-only mailbox

Public users can install the [free local mail connector](docs/LOCAL_REMOVAL_MAIL.md) and authorize a genuinely separate Gmail account on their computer. Extract the download and open its local setup launcher. A browser form handles account details, Google file selection, existing-connection reuse and local installation; it does not ask Terminal questions. Choose **Connect my removal-only mailbox** in Erase Me, then use the supported route’s contact and one-time mail actions. No private operator key is needed for this transport, and Google tokens never enter the hosted app or workspace backup. Setup requires Python 3.10+, a supported desktop browser, a native helper and the user’s own installed OAuth client; it does not create a mailbox automatically.

Optional **Allow reviewed privacy-email sending** requires fresh Google consent for `gmail.send`; existing read-only setups remain valid. The same-account setup can reuse its saved Desktop client during an explicit reconnect. Seven fixed privacy recipients support a separate own-record message review and one-shot send. No hidden retry follows an uncertain result, and local message bodies are not retained. See [supported recipients and safeguards](docs/LOCAL_REMOVAL_MAIL.md#reviewed-privacy-email-delivery).

The local connector supports FastPeopleSearch, USPhonebook and SearchPeopleFree contacts. The latter receives an alias of the user’s own dedicated account. Its authenticated confirmation links remain held pending a reviewed route contract. People Data Labs and Apollo retain their record-associated email requirements. All checks are explicit; holds revoke local mail grants and no background schedule is installed.

### Optional hosted operator pilot

An operator can connect a separate removal-only Gmail account through the [OAuth setup](docs/GMAIL_OAUTH.md). This is a gated private pilot, not a public shared-mailbox service or personal-inbox connection.

The batch review can prepare selected FastPeopleSearch and USPhonebook removal contacts together. Select eligible routes and enter the private operator key once. Contact preparation sends no broker request and reads no mail. It then rebuilds the review with the exact new addresses and fields; form, submission and mail approvals start unchecked again. Existing contacts are kept, and held or already-started routes are excluded.

For that open review, the key remains in memory so an optional mail pass can follow without another key entry. After every selected form outcome is saved, the pass checks qualifying bound operations once. A stopped queue, unknown outcome or failed result storage prevents the final pass. Closing or completing the review clears its key. Pending mail starts no future check; a separate authorized mail-only pass can check existing operations later.

USPhonebook and FastPeopleSearch have reviewed confirmation-form destinations. After authenticating the exact operation's mail again, the companion can open FastPeopleSearch's matching form and check its prefilled name and contact fields. It initially leaves extra identity fields untouched. The separate in-app missing-information review can then collect and submit the exact approved matching details once, using companion 0.12.0. The broker's native required controls are checked and disclosed before collection. USPhonebook retains its reviewed prefill behavior; the held pilot request stays held. SearchPeopleFree cannot issue new shared aliases, and People Data Labs and Apollo retain their record-associated email requirements. OAuth credentials and the operator key remain outside public assets and backups.

A November 5 authorized pilot submitted FastPeopleSearch's initial form in ordinary visible Chrome, received an authenticated email in the removal-only mailbox and opened its matching form. The run was subsequently held at the user’s request before supplying the required identity detail. This establishes a real verification path, with no final removal acceptance or independently verified deletion yet.

See [the relay contract and deployment limits](docs/AUTOMATIC_CONFIRMATIONS.md). The public workspace and unpacked companion need no paid service. Optional account and hosting quotas still apply.

## Development

Use Python 3.10 or newer, Node.js 22 and the test dependencies below. CI tests Python 3.10 and 3.12. The skill engine has no runtime packages.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install pytest coverage

python tools/build_preview.py
node --test tests/*.cjs
python -m pytest -m "not network"
python skills/erase-me/scripts/erase_me.py validate
```

The JavaScript suite includes 6,000 reproducible synthetic cases across identity validation, consent, holds, replay protection, imports and cleanup choices. Cases are grouped into three Node tests; their diagnostic counts are separate from the unit-test total. Native-browser tests and consented live-record evidence are separate checks.

The public build writes generated assets to `preview/public/` and creates the companion ZIP from an explicit file allowlist. Tests and the mock broker must not use real profiles, credentials or live broker submissions. Passing tests establish implementation behavior, not a real-world deletion result.

| Location | Purpose |
| --- | --- |
| `webapp/static/` | Browser workspace, route catalog and channel assessments |
| `extension/` | Chrome companion and guarded form execution |
| `preview/` | Public deployment and optional receipt API |
| `skills/erase-me/` | Installable skill, Python engine, references and templates |
| `tools/` | Build, local setup and operator utilities |
| `tests/`, `tools/mock_broker/` | Synthetic fixtures and regression tests |

## Documentation and support

- [Architecture](docs/ARCHITECTURE.md)
- [Public workspace behavior](docs/PUBLIC_WORKSPACE.md)
- [Local challenge helper](docs/LOCAL_CHALLENGE_HELPER.md)
- [Local app](docs/WEB_APP.md) and [deployment](docs/DEPLOYMENT.md)
- [43-route integration matrix](docs/INTEGRATION_STATUS.md), [broker contracts](docs/BROKER_ROUTE_RESEARCH.md) and [evidence](docs/BROKER_VERIFICATION.md)
- [6,000 seeded simulation cases](docs/SIMULATION_TESTS.md) and their coverage limits
- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md)
- [Türkçe documentation](README.tr.md)

Use issues for reproducible bugs and changed broker routes. Do not include real personal information in issues, screenshots or test fixtures. Report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## License and acknowledgments

MIT. See [LICENSE](LICENSE). Data, fonts and other third-party material retain their applicable licenses and attribution in [NOTICE.md](NOTICE.md) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Related work includes [unbroker](https://github.com/NousResearch/hermes-agent), alongside the licensed projects credited in the notices. Erase Me does not reuse unbroker's broker data or the unlicensed Big Ass Data Broker Opt-Out List.

Privacy-law references are informational and may become outdated. Check their official sources. This software does not provide legal advice.

*Documentation reviewed November 5, 2026. Capability counts describe companion 0.12.0.*
