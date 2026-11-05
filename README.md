# Erase Me

Tools for finding and requesting removal of your own personal information from data brokers and public directories.

[![CI](https://github.com/Arnav66692/erase-me/actions/workflows/ci.yml/badge.svg)](https://github.com/Arnav66692/erase-me/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Open the workspace](https://erase-me-preview.vercel.app/) · [Install the companion](https://erase-me-preview.vercel.app/companion.html) · [Documentation](docs/PUBLIC_WORKSPACE.md) · [Contributing](CONTRIBUTING.md)

Erase Me combines a browser workspace, a narrowly permissioned Chrome extension and an installable agent skill. It keeps a private record of the actions you authorize and separates form preparation, broker verification and removal evidence.

**Current scope:** companion 0.5.0 supports 11 reviewed initial form actions, two optional guarded submissions and one local text-challenge route. Other challenges, identity checks and broker steps can still need attention. No independently verified broker deletion has been established by this release.

## Get started

### Browser workspace

1. Open [Erase Me](https://erase-me-preview.vercel.app/) and create a workspace with your own details.
2. Select your country and prepare a route plan.
3. Find and confirm your own listings, then start a broker action or review a form batch.
4. Complete the broker's verification steps and record the result.

The workspace requires no account or email login. Your profile and ledger stay in this browser. Export a private backup before clearing site data or changing devices.

For supported form filling, install the free [Chrome companion](https://erase-me-preview.vercel.app/companion.html). Load the unpacked extension in desktop Chrome and grant access to its reviewed broker sites. Mobile browsers can use the workspace and official links, but companion actions require desktop Chrome. Updating an older copy requires replacing its extracted files and reloading the extension.

To fill several forms, complete their required details and own-record confirmations, then choose **Review form batch**. Review the selected brokers and exact outgoing fields, authorize the batch once and choose **Fill selected forms**. The companion works through eligible forms one at a time while the page stays open. Held, already-started, incomplete and manual routes are excluded with reasons. **Stop after current form** leaves the remaining forms untouched. Closing or reloading does not resume a batch.

The review also offers optional automation for FastPeopleSearch's initial verification form and NumaraAra's request form. Review their displayed agreements before enabling it. NumaraAra's text security code can use the free [local challenge helper](docs/LOCAL_CHALLENGE_HELPER.md). An observed submit event is recorded as an attempt; delivery and broker acceptance still require separate evidence.

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
| Chrome companion | Fill reviewed forms, initiate supported verification and optionally submit two reviewed forms | Changed controls, agreements or challenges stop the action. No ID uploads, paid solvers or background retries. |
| Local challenge helper | Recognize NumaraAra's reviewed five-character image code using local Tesseract | Separate desktop installation. Managed challenges and other site codes are not universally supported. |
| Structured record check | Check one approved Spokeo URL against its structured Person data | Requires exact name and typed identity-email matches. Missing or ambiguous evidence needs attention. |
| Contact drafts | Prepare, copy or download a request for a fixed published contact | Drafts are local. Erase Me does not send them. |
| Existing-tab checks | Reconcile narrowly supported, fresh broker acknowledgments | Unknown or unsupported results remain unverified. Forms are not resent. |
| Agent skill | Consent records, reference-based plans, request drafts and private reports | Requires an agent capable of running Python. Browser and submission permissions remain explicit. |

The companion covers initial actions for People Data Labs, USPhonebook, SearchPeopleFree, FastPeopleSearch, Apollo, Spokeo, AdvancedBackgroundChecks, No Sorgulama, NumaraAra, NumaraSor and TelefonSorgulama.

Apollo requires a separately entered business email. Spokeo requires a confirmed direct listing URL; its optional structured-record check can supply the own-listing approval only from a unique matching name and identity email on that exact page. Age and city alone are insufficient. The latest Spokeo research was blocked, so this is not evidence of a live matched record. The other structured forms retain their own-request affirmations.

[Current route contracts](docs/BROKER_ROUTE_RESEARCH.md) document the observed controls and their limits.

## Coverage and evidence

| Catalog measure | Current scope |
| --- | ---: |
| Reference routes | 43 |
| Reviewed initial companion actions | 11 |
| Optional guarded submission contracts | 2 |
| Other guided channels | 32 |
| Published contact-draft channels | 24 |
| Source-backed channel assessments | 37 |

Regional packs cover the United States, Canada, the United Kingdom, Germany and Turkey, alongside two global portals. A country without a pack receives the global portals and an explicit coverage notice. Reference coverage does not guarantee that a broker holds your information or accepts a request.

Some entries are provider preferences or marketing registrations. CMA Do Not Mail, Canada's DNCL and the UK's TPS are not broker-record deletion services. Other channels require a subscriber, postal request or manual self-service session.

Erase Me uses distinct evidence levels:

| Recorded event | What it establishes |
| --- | --- |
| Form or draft prepared | Approved fields or request text are ready. No final request acceptance is established. |
| Guarded submission attempted | The approved form produced a checked native submit event. Delivery, acceptance and deletion remain unverified. |
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

### Optional dedicated-mail pilot

An operator can connect a separate removal-only Gmail account through the [OAuth setup](docs/GMAIL_OAUTH.md). This is a gated private pilot, not a public shared-mailbox service or personal-inbox connection.

The batch review can prepare selected FastPeopleSearch and USPhonebook removal contacts together. Select eligible routes and enter the private operator key once. Contact preparation sends no broker request and reads no mail. It then rebuilds the review with the exact new addresses and fields; form, submission and mail approvals start unchecked again. Existing contacts are kept, and held or already-started routes are excluded.

For that open review, the key remains in memory so an optional mail pass can follow without another key entry. After every selected form outcome is saved, the pass checks qualifying bound operations once. A stopped queue, unknown outcome or failed result storage prevents the final pass. Closing or completing the review clears its key. Pending mail starts no future check; a separate authorized mail-only pass can check existing operations later.

Only USPhonebook has a reviewed confirmation-form destination. It still requires additional identity details and final broker steps; the held pilot request stays held. FastPeopleSearch links remain held, SearchPeopleFree cannot issue new shared aliases, and People Data Labs and Apollo retain their record-associated email requirements. OAuth credentials and the operator key remain outside public assets and backups.

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
- [Broker contracts](docs/BROKER_ROUTE_RESEARCH.md) and [evidence](docs/BROKER_VERIFICATION.md)
- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md)
- [Türkçe documentation](README.tr.md)

Use issues for reproducible bugs and changed broker routes. Do not include real personal information in issues, screenshots or test fixtures. Report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## License and acknowledgments

MIT. See [LICENSE](LICENSE). Data, fonts and other third-party material retain their applicable licenses and attribution in [NOTICE.md](NOTICE.md) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Related work includes [unbroker](https://github.com/NousResearch/hermes-agent), alongside the licensed projects credited in the notices. Erase Me does not reuse unbroker's broker data or the unlicensed Big Ass Data Broker Opt-Out List.

Privacy-law references are informational and may become outdated. Check their official sources. This software does not provide legal advice.

*Documentation reviewed November 5, 2026. Capability counts describe companion 0.5.0.*
