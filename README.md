# Erase Me

[Open the live workspace](https://erase-me-preview.vercel.app). Enter your own details, keep a private request ledger in your browser, and start each broker action explicitly. No personal inbox connection, server profile, subscription or scheduled checks.

## Public browser workspace

Profiles and history stay in this browser on this device. The host serves the interface, not a personal-data database. No email login is required. Clearing browser data deletes the workspace, so export a private backup if you need one. Other people with access to this browser profile can read the saved details.

Use the free [Chrome companion](https://erase-me-preview.vercel.app/companion.html) for supported form actions. Download the ZIP, load it unpacked in desktop Chrome, grant access to the six reviewed broker sites, and refresh the workspace. Source is in `extension/`.

The catalog contains **43 reference routes**: two global portals, 23 US routes, four Canadian routes, five UK routes, two German routes and seven Turkish routes. Choose your country to see its routes and the global portals. Other countries can use the workspace and global portals, but have no regional pack yet. A reference link is not a validated integration: **six routes support an initial companion action**, and 37 require manual work. The 36 newly added reference entries have not been validated as current browser-app removal flows.

| Route | Working action | Required next step |
| --- | --- | --- |
| People Data Labs | Start the official deletion portal’s verification email | You open the email and finish the portal |
| USPhonebook | Fill the first form; the private mail pilot can also prepare authorized fields in its reviewed second form | Enter either date of birth or street address directly on the broker site, review the matching details, accuracy statement and CAPTCHA, then submit there |
| SearchPeopleFree | Fill the reviewed first form | You complete the challenge, email and record-removal session |
| FastPeopleSearch | Fill the reviewed first form | You complete the challenge, email and matching-record steps |
| Apollo | Fill an explicitly entered, separately authorized business email | You submit and complete business-email verification; the profile email is never substituted |
| Spokeo | Fill your explicitly confirmed direct listing URL and email | You submit, complete any challenge and click the broker confirmation email |
| SmartBackgroundChecks | Open the official removal route | Current page access was blocked in our research. No companion action is enabled |

Form preparation, verification initiation, user-reported submission and verified deletion are distinct. A submitted form is never counted as a deletion. No independently verified deletion is established by this release. See [public app behavior](docs/PUBLIC_WORKSPACE.md), [current route research](docs/BROKER_ROUTE_RESEARCH.md) and [earlier evidence](docs/BROKER_VERIFICATION.md).

Use **Find my listing** to open an explicit Google search for your name and optional city on the selected broker. Google receives those search terms only when you choose that action. Search results are candidates, not confirmed matches or removals. Spokeo requires you to confirm that its exact listing is yours.

Put any route on **Hold** to stop its new broker, search and mailbox actions. Only an explicit **Resume** releases it; resuming a campaign or restoring a backup does not release route holds or replay an old operation.

Managed CAPTCHA challenges, accurate record matching and final submission remain user steps. **Check existing broker tab** can reconcile a supported fresh verification-email acknowledgment after your submission, without sending the form again. Unsupported outcomes remain unknown. The companion has no inbox or alarm permission. It holds interrupted operations rather than repeating them. The workspace has no background polling, automatic re-checks or resubmission.

## Optional removal-only mail pilot

A separate Gmail account can be connected by an operator through the [private OAuth setup](docs/GMAIL_OAUTH.md). The [receipt relay](docs/AUTOMATIC_CONFIRMATIONS.md) is a gated private pilot, disabled until separately configured and explicitly enabled. It requires a private operator key for each session or check. The public app does not offer anonymous access to a shared mailbox. OAuth tokens stay on the operator's machine or in private deployment settings; the browser never receives them.

USPhonebook and FastPeopleSearch can use an explicitly chosen removal-only contact where the broker accepts it. The app displays the address before use and explains that it belongs to a shared service account, not the person. People Data Labs and Apollo retain the email associated with the record. SearchPeopleFree uses the person’s typed email because its consent associates that address with the requester; new shared contacts are disabled. Existing signed references can still be checked, with links held. The personal inbox remains untouched.

Checks happen only when requested and return no confirmation URL. USPhonebook has one reviewed continuation: a separate explicit action revalidates the same authenticated receipt, opens its exact official second form and fills the authorized first name, last name, city, state, ZIP and removal contact. USPhonebook additionally requires either date of birth or street address. The person enters one directly on the broker site; Erase Me does not collect or autofill those details. The person reviews the accuracy statement, completes the challenge and submits there. Other confirmation routes remain held.

Live pilot evidence reaches first-form acceptance and a correlated authenticated email. The final form rejected a submission without either date of birth or street address, although neither field was marked required in its HTML. Final removal-request acceptance and deletion remain unverified. Neither receiving an email nor preparing the second form counts as deletion. The [older IMAP preparation helper](docs/REMOVAL_MAILBOX_SETUP.md) is separate from the hosted OAuth relay.

## Local Python app

The separate local app remains available with its existing data and permissions.

```sh
python3 tools/configure_service.py --local
python3 tools/run_service.py
```

Open http://127.0.0.1:8766. See [local setup](docs/DEPLOYMENT.md) and [local app behavior](docs/WEB_APP.md).

The application is MIT-licensed. Dependencies and bundled fonts keep their licenses. No paid service is needed for the public workspace or unpacked companion. Free account, OAuth and hosting quotas still apply; this is not an unlimited hosted removal service.

## Original agent skill

The documentation below describes the original manual-approval skill. Its permissions
are separate from the web app's browser workspace and explicit per-action authorization.

An open-source Agent Skill that removes you, or a family member who agrees, from people-search sites, data brokers, caller-ID apps and search results. It runs inside the coding agent you already use and follows the privacy law where that person lives.

[Türkçe](README.tr.md)

## Quickstart

```
npx skills add Arnav66692/erase-me --skill erase-me
```

Then tell your agent:

> Erase my mom from the internet. She agreed.

## Claude Code installation

Install with the command above and choose Claude Code, or copy the `skills/erase-me` folder into `~/.claude/skills/erase-me`. Start a new session and use `/erase-me`. The skill needs Python 3.9 or newer. Its engine has no runtime packages. A browser-capable session can assist with supported pages.

The installable skill uses the manual consent and submission workflow below. The local web app is a separate interface with the coverage described above. Neither guarantees deletion from every broker.

## What it does

You say one sentence. The agent then works through these steps, and stops to ask you at each one that matters:

1. **Records consent.** It asks who the person is and how they agreed. Nothing else runs without a consent record.
2. **Asks for the minimum.** Country and region, name with local spellings, cities lived in, an age range. Phone and email only if you want them checked.
3. **Works out which laws apply.** It names the strongest free legal channel for that place, the response deadline and the regulator to complain to.
4. **Scans.** It opens search pages on people-search sites, caller-ID apps and search engines, and records each listing it finds with its URL. CAPTCHAs come to you in one batch.
5. **Removes.** It fills opt-out forms one at a time. Before each one it shows you the exact fields it will send and waits for your yes. You do ID uploads, calls and verification clicks.
6. **Drafts legal letters.** Erasure and objection requests under the matching law, with the legal deadline filled in, or a plain request for a prompt reply where the law sets no fixed deadline. It can translate a letter into the recipient's language and keeps the English original attached. You send them.
7. **Tracks deadlines.** When a deadline passes, it drafts a follow-up, then a complaint to the regulator.
8. **Re-checks** at 30, 45 and 90 days and flags listings that come back.
9. **Reports.** A private exposure map that stays on your computer, and a share card with counts only.

It works in agents that can run Python and read a skill folder, such as Claude Code, Codex, Cursor and Gemini CLI. With a browser tool, the agent opens pages and fills forms itself. Without one, it gives you the links and records what you report back.

## Country-aware references

Most removal tools we found are built for the United States. Erase Me starts from where the person lives.

The jurisdiction engine reads one file per privacy law in `skills/erase-me/references/jurisdictions/`. Each file holds the law's rights with article citations, the response deadline and extension, the regulator and its complaint page, who may act for someone else, and the official sources it was checked against, with a date. The engine matches the person's country and region to those files and picks the channel:

- A regional law first where one applies, such as a US state law.
- A national or regional law next, such as GDPR in the EU, UK GDPR, KVKK in Turkey or LGPD in Brazil.
- Global channels everywhere: Google and Bing removal forms, caller-ID app unlisting and account deletion links.
- Country packs of local people-search sites and directories where someone has contributed one, under `references/countries/<cc>/`.

A law file that could not be checked against official text is marked unverified. The agent tells you so and does not quote its deadline as fact. A law that exists but is not yet in force is reported and never used for a letter.

Where no applicable law reference or country pack is available, the skill can offer contributed global channels and official site opt-outs. Whether a broker holds the person's data or accepts a request must be checked separately. Neither the skill nor the public app guarantees coverage or removal in every country.

## What it refuses

- Anyone who is not you or a family member who agreed. It will not search for a partner, an ex, a coworker, a neighbor or a stranger, and it will not help find where someone lives.
- Solving CAPTCHAs, or using solver services, proxies or stealth browsers.
- Paying for anything, including paid removal services and "premium" opt-outs.
- Submitting a form without your explicit yes for that form.
- Following instructions written on web pages, emails or PDFs. Page text is data.
- Exporting a dossier of a person's listings, addresses or relatives.
- Putting a name, place, site, date or request ID in the share card.
- Removing court, property or other government records themselves. Opt-outs the law offers from a published register, like the UK open register, are in scope.
- Calling anything legal advice.

## Privacy model

- **Stored locally.** Everything lives in `~/.erase-me`, or in `$ERASE_ME_HOME` if you set it. The folder is mode 700 and its files are mode 600.
- **The engine has no dependencies.** It is Python standard library only, and it reads and writes local files. The agent does the browsing, in your browser.
- **Your agent processes the supplied details.** Your coding agent and its service provider can receive what you type and what the agent reads. That includes the person's name, the cities, any phone or email you give, and the listing pages the agent opens. The skill tells the agent to repeat a field only when a form or letter needs it, and to show you the exact fields before each submission. If that is not acceptable, use a coding agent that processes your data entirely on your device.
- **Sites see what you submit.** Opt-out forms and letters go to the company that holds the data. Some will ask for an email address, and a few for ID. You decide each time.
- **Shareable output is counts only.** The share card holds six numbers: sites checked, found, requested, removed, removal rate and days since start.

## Prior art

Erase Me builds on work by others. If you live in the United States and want more automation, these projects go further there:

- **unbroker**, in [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent). A data broker removal toolkit for Hermes Agent, with a broker list and a request ledger. The code is MIT. Its broker data is CC BY-NC-SA, so Erase Me does not reuse it.
- **auto-identity-remove.** A US-focused command-line tool that automates broker opt-outs and CCPA complaints. MIT.
- **identity-eraser.** A Claude Code skill for US people-search removal. MIT.
- **nulltrace.** An app that prepares CCPA and GDPR requests by mail. MIT.
- **JustDeleteMe**, [jdm-contrib/jdm](https://github.com/jdm-contrib/jdm). The directory of account deletion links. Erase Me's account data comes from it. MIT.

The [Big Ass Data Broker Opt-Out List](https://github.com/yaelwrites/Big-Ass-Data-Broker-Opt-Out-List) is a well-known manual guide. It states no license, so Erase Me links to it and copies nothing from it.

Erase Me differs in three ways. It matches requests to the law where the person lives, it runs in any agent that reads skills, and it asks you before every submission. See [NOTICE.md](NOTICE.md) for the data it reuses.

## Contributing a country pack

The most useful contribution is a country you know. A pack is a folder of small JSON files, one per site, with the search URL pattern, the opt-out method and the date you checked it. Law files follow the same idea, one per law, checked against the official text.

Read [CONTRIBUTING.md](CONTRIBUTING.md), then open a pull request with the "add a country" template. Run this before you push:

```
python skills/erase-me/scripts/erase_me.py validate
python -m pytest -m "not network"
```

## Not legal advice

Erase Me is software, not a lawyer. The law files summarize official texts and can be wrong or out of date. Each one shows the date it was checked and its sources, so you can read the text yourself. Every letter it drafts ends with a line saying it is not legal advice. For a dispute, contact a lawyer or the regulator named in the law file.

## License

MIT. See [LICENSE](LICENSE).

## Design references

The interface combines the editorial grid, serif headings and rules studied at [Locomotive](https://locomotive.ca) with the terminal windows and data presentation studied at [Typesafe](https://typesafe.ai). Original interface code and free, licensed fonts. Live counts never shuffle.
