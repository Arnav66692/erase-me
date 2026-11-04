# Country packs

A country pack is a folder named after the ISO 3166-1 alpha-2 code in lowercase, such as `gb` or `tr`. It holds one JSON file per site or channel that leaks personal data in that country. The planner runs these after the global sites in `references/global/`.

Global sites such as Google, Bing, Truecaller, GetContact, Sync.ME, Eyecon, CallApp and Hiya live in `references/global/`, not here. The US pack lives in `us/` and is maintained separately, so its rows are not listed below.

## What is in each pack

All rows were checked on 2026-10-21. Verified means the site's own removal or help page loaded that day and describes the process.

| Country | id | Site or channel | Category | Method | Verified |
|---|---|---|---|---|---|
| GB | `192com` | 192.com | people_search | web_form | no |
| GB | `ukphonebook` | ukphonebook.com | people_search | web_form | yes |
| GB | `gb-peopletraceuk` | People Trace UK | people_search | web_form | yes |
| GB | `gb-open-register` | Open electoral register opt-out (local council) | directory | web_form | yes |
| GB | `gb-bt-phonebook` | BT Phone Book and 118 500 (ex-directory) | directory | phone | yes |
| GB | `gb-companies-house` | Companies House register (home address removal) | directory | postal | yes |
| GB | `gb-tps` | Telephone Preference Service (TPS) | marketing | web_form | yes |
| CA | `canada411` | Canada411 | directory | web_form | yes |
| CA | `ca-411` | 411.ca | directory | email | no |
| CA | `ca-phone-unlisted` | Phone company unlisted number (Bell and others) | directory | phone | yes |
| CA | `ca-dncl` | National Do Not Call List (DNCL) | marketing | web_form | yes |
| CA | `ca-cma-do-not-mail` | CMA Do Not Mail Service | marketing | web_form | yes |
| TR | `tr-kvkk-request` | KVKK request to any Turkish site | data_broker | legal_request | yes |
| TR | `tr-turkcell-rehber` | Turkcell Rehber and Bilinmeyen Numaralar | caller_id | phone | yes |
| TR | `tr-mobile-operator-rehber` | Vodafone and Türk Telekom directory (rehber) listing | caller_id | phone | no |
| TR | `tr-ceptennumarasorgula` | Cepten Numara Sorgula 11877 (Mobilişim) | caller_id | legal_request | no |
| TR | `tr-numarasor` | numarasor.com | caller_id | web_form | yes |
| TR | `tr-numaraara` | NumaraAra | caller_id | web_form | yes |
| TR | `tr-nosorgulama` | No Sorgulama (nosorgulama.com.tr) | caller_id | web_form | yes |
| TR | `tr-telefonsorgulama` | TelefonSorgulama | caller_id | web_form | yes |
| DE | `de-das-telefonbuch` | Das Telefonbuch (DTM Deutsche Tele Medien) | directory | email | yes |
| DE | `de-das-oertliche` | Das Örtliche | directory | email | yes |
| DE | `de-11880` | 11880.com | directory | phone | yes |
| DE | `de-teilnehmerverzeichnis-widerspruch` | Widerspruch through the phone provider | directory | phone | yes |
| DE | `de-melderegister` | Melderegister (resident registration office) | directory | legal_request | yes |

Totals. GB 7 files, 6 verified. CA 5 files, 4 verified. TR 8 files, 6 verified. DE 5 files, 5 verified.

`tr-kvkk-request` is a legal channel, not a site. It is filed as `data_broker` because the schema has no category for a generic request route. Use it for any Turkish site that shows the person's data and has no form of its own.

### Checked and left out

- Canpages.ca now redirects to YellowPages.ca, which lists businesses only.
- whitepages.ca redirects to the US site whitepages.com, which the US pack covers.
- ukelectoralroll.co.uk is an affiliate page that links to 192.com.
- LocateFamily, Tracesmart and the UK caller sites who-called.co.uk and tellows.co.uk returned HTTP 403, so no process could be confirmed.
- Gelbe Seiten lists businesses. Private German entries are handled through DTM, see `de-das-telefonbuch`.
- US people-search sites such as Spokeo and Radaris also list some Canadians. The US pack covers them.

## How to add your country

1. Make a folder named after your country code in lowercase, for example `fr`.
2. Add one JSON file per site. The file name must equal the `id`, for example `fr-pagesjaunes.json`. Use lowercase letters, digits and hyphens. Put the country code in front when the brand name is generic.
3. Follow the binding schema in `docs/ARCHITECTURE.md`, section "Site file". In plain words, each file says
   - what the site is (`name`, `domain`, `category`, `countries`, `priority`),
   - how to find a person on it (`search`). Use `url_template` only if you saw the real URL pattern on the site, and test it with an obviously fake name such as Zelda Quuxington. Otherwise use `search_engine` or `manual` and explain in `notes`,
   - how to get removed (`optout`). Give the real removal page, the method, what the person must provide, short imperative steps, and the expected days. Use `null` for `expected_days` if the site states no time. Do not guess,
   - how likely the listing is to come back (`relist_risk`),
   - where the facts came from (`sources`), with `official` for the site's own pages and `own-research` for third-party guides,
   - whether it was checked (`verified`, `last_verified`, `verification_note`).
4. If one opt-out also removes another site, list the child ids in the parent's `covers` and set the child's `cluster` to the parent id.
5. Think about how data really leaks in your country. Phone directories, electoral rolls, company registers, operator caller-name lookups and comment sites about phone numbers often matter more than US-style people-search sites.
6. Check that each file parses with `python3 -c 'import json,sys; json.load(open(sys.argv[1]))' FILE`.

### The bar for `verified: true`

Set `verified` to `true` only if the site's own removal page or help page loaded on the date in `last_verified` and it describes the process you wrote down. A third-party guide is not enough. If the site blocks automated requests, the page is unclear, or you used a guide, set `verified` to `false` and say exactly what you tried and what happened in `verification_note`, for example "HTTP 403 to curl on 2026-10-21".

Never invent a URL, a form field or a process. Never look up a real private person to test a site. Never solve a CAPTCHA for a test. Write prose with periods and commas only.
