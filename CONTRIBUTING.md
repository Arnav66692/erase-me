# Contributing to Erase Me

Thank you for helping. The most useful contributions are country packs, law files, and fixes to sites whose opt-out pages changed.

## Ground rules

- **No real personal data.** Never put a real person's name, phone, email, address or listing URL in a file, test, issue, commit or screenshot. Use made-up values like `Jane Q Doe` and `example.com`.
- **Never copy from the Big Ass Data Broker Opt-Out List.** It states no license. You may read it to learn a site exists, then research the site yourself on the site itself.
- **Reuse only data with a license that allows it,** and credit it in the file's `sources` field. MIT data must keep its upstream notice in `skills/erase-me/references/SOURCES.md`.
- **Standard library only.** The engine has no dependencies. Do not add any.
- **Not legal advice.** Law files summarize official text. Do not add opinions about how a law should be read.

## Add a country pack

A country pack is a folder `skills/erase-me/references/countries/<cc>/`, where `<cc>` is the lowercase ISO 3166-1 alpha-2 code, such as `gb` or `tr`. It holds one JSON file per site.

1. Pick 5 to 10 sites where people in that country find someone's name, phone or address: people-search sites, phone directories, business directories that list home addresses, local caller-ID apps.
2. Write one file per site. The schema is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), under "Site file". Copy an existing file as a starting point.
3. Search the site for a made-up name to learn its URL pattern. Use `{first}`, `{last}`, `{full}`, `{city}`, `{region}`, `{region_name}`, `{country}`, `{phone}` and `{email}` only.
4. Find the opt-out or removal page on the site itself. Note the method, the fields it asks for and what it requires, such as email verification, a CAPTCHA or an ID upload.
5. Run the checks below and open a pull request with the "add a country" template.

If the country also needs a law file, see the next section.

## Add or fix a law file

Law files live in `skills/erase-me/references/jurisdictions/<code>.json`. The schema is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), under "Jurisdiction file".

- Cite the article for every right and for the deadline.
- Use the official text: a government gazette, a legislature site or the regulator's site. Secondary sources may point you to the text, but the citation must come from the text.
- List each source with its URL and the date you read it.
- Set `verified: true` only if you confirmed every required field in official text. Otherwise set `verified: false` and say what is missing in `verification_note`. Unverified files still help, and they are labeled as such.
- If a law is passed but not yet in force, set `status: not_in_force` and give the start date if it is known.

## Verification bar

A pull request is ready to merge when:

- [ ] `python skills/erase-me/scripts/erase_me.py validate` passes.
- [ ] `python -m pytest -m "not network"` passes.
- [ ] Every site file has `verified: true` only if you opened its opt-out URL on the site on the `last_verified` date.
- [ ] Every law file cites official sources with access dates.
- [ ] No real personal data appears anywhere in the diff.
- [ ] Nothing is copied from the Big Ass Data Broker Opt-Out List or from any source without a license that allows reuse.

## Fix a broken site

Opt-out pages move often. If a site file is wrong, update `optout`, `last_verified` and `verification_note`, then open a pull request. If you cannot fix it, open a "site changed" issue.

## Writing style

Docs, notes and letters use short sentences with periods and commas. No em dashes and no semicolons. Say what something does in plain words.

## Code changes

Write a failing test first, then the change. Tests must never touch real sites or the real home folder. Use the mock site in `tools/mock_broker/` and a temporary `ERASE_ME_HOME`. Mark any test that needs the network with `@pytest.mark.network`.

## Security issues

Do not open a public issue for a security problem. See [SECURITY.md](SECURITY.md).
