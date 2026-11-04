# Erase Me

[Live interface demo](https://erase-me-preview.vercel.app). The hosted version accepts sample data only. For real supported requests, run the local app below or install the skill.

## Local app

Enter your own name, age and email, authorize requests, and run checks when you choose.
The app has no inbox connection and requires no email password. Broker verification
emails go directly to the address you enter; you finish any required broker steps.
Recurring checks are off.

```sh
python3 tools/configure_service.py --local
python3 tools/run_service.py
```

Open http://127.0.0.1:8766. See [setup](docs/DEPLOYMENT.md),
[app behavior](docs/WEB_APP.md), and [broker evidence](docs/BROKER_VERIFICATION.md).
Only supported routes run. Requests are never counted as removals without evidence.
The app does not yet have verified end-to-end removal coverage for the whole catalog.

CAPTCHA attempts use free local Tesseract and whisper.cpp where supported. No paid
solver or cloud inference is required; unsupported challenges remain blocked.
See [recognition limits](docs/LOCAL_CAPTCHA.md).

The Vercel preview is a synthetic interface demo. It has no personal data or real
removal worker. The application is MIT-licensed; dependencies keep their own licenses.

## Original agent skill

The documentation below describes the original manual-approval skill. Its permissions
are separate from the web app's one-time authorization.

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

## Works in any country

Most removal tools we found are built for the United States. Erase Me starts from where the person lives.

The jurisdiction engine reads one file per privacy law in `skills/erase-me/references/jurisdictions/`. Each file holds the law's rights with article citations, the response deadline and extension, the regulator and its complaint page, who may act for someone else, and the official sources it was checked against, with a date. The engine matches the person's country and region to those files and picks the channel:

- A regional law first where one applies, such as a US state law.
- A national or regional law next, such as GDPR in the EU, UK GDPR, KVKK in Turkey or LGPD in Brazil.
- Global channels everywhere: Google and Bing removal forms, caller-ID app unlisting and account deletion links.
- Country packs of local people-search sites and directories where someone has contributed one, under `references/countries/<cc>/`.

A law file that could not be checked against official text is marked unverified. The agent tells you so and does not quote its deadline as fact. A law that exists but is not yet in force is reported and never used for a letter.

Where no law gives an erasure right, the global channels and site opt-outs still work.

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
