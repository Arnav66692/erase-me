# Data sources

Every external dataset checked while seeding `global/`, `countries/us/` and `accounts/jdm.json`. Licenses were read from each repository's own LICENSE file with `gh api`. Site pages were fetched with curl on the dates shown.

| Dataset | License | URL | Commit or fetch date | What we took |
|---|---|---|---|---|
| JustDeleteMe (jdm-contrib/jdm) `_data/sites.json` | MIT (LICENSE file) | https://github.com/jdm-contrib/jdm | commit e596e510859fe920fda0dcd8d458ad0a1b4cb91c, fetched 2026-10-21 | name, url, difficulty, domains, English notes and email for 2,664 of 2,672 entries, converted to `accounts/jdm.json`. See the http fixes below. |
| auto-identity-remove (stephenlthorn) `brokers.js` | MIT (LICENSE file) | https://github.com/stephenlthorn/auto-identity-remove | commit 99fb638d31ff5f5d1af497ac3440943622a0c448 | Fallback opt-out URLs, search URL patterns for Whitepages, MyLife, FastPeopleSearch and Nuwber, and captcha hints, only for sites that blocked our fetch. Its `data/badbool-extra.json` and its bundled Markup CSV were not used. |
| nulltrace (4x3) `source/internal/broker/data/webforms.yaml` | MIT (LICENSE file) | https://github.com/4x3/nulltrace | commit 7fd59edc097c70788dd79e5ab4c31c62cdaa8fe7 | Fallback opt-out URLs and captcha or email confirmation flags for sites that blocked our fetch. |
| identity-eraser (AKCodez) `references/site-playbooks.md` | MIT (LICENSE file) | https://github.com/AKCodez/identity-eraser | commit 539e408fd49f9266b09c70abe22e67aff4207964 | Verification and timing facts for blocked sites (Whitepages, BeenVerified, MyLife, PeopleConnect, PeopleFinders, Nuwber, TruePeopleSearch), rewritten in our own words. |
| California data broker registry, 2026 (`registry.csv`) | official, public record | https://cppa.ca.gov/data_broker_registry/ | fetched 2026-10-21 and again 2026-10-27, 603 rows, sha256 067eb5a3ff1f6e34fba5be93ec047847bc992d6043f542e593850ca98928b303 | `registries.US-CA` flags and the operator clusters (PeopleConnect and Intelius, BeenVerified, Spokeo, Mississippi Tornado Alley). |
| Vermont data broker registry | official, public record | https://bizfilings.vermont.gov/online/DatabrokerInquire/ | tried 2026-10-21 | Nothing. The public search puts a reCAPTCHA in front of every query and there is no open export, so we did not fill `US-VT` flags. |
| The Markup, investigation-data-broker-opt-out-pages | Apache-2.0 (LICENSE.md) | https://github.com/the-markup/investigation-data-broker-opt-out-pages | commit 232cf13f51670e5131abad41536e8ba62a5feb2c | Nothing. Reuse is allowed with attribution, but the data covers hidden opt-out pages of other brokers, not our 25 sites. |
| The Markup, January 2023 data broker opt-out list (copy bundled in auto-identity-remove) | not confirmed | https://themarkup.org/privacy/2023/01/26/which-data-brokers-offer-opt-outs | not fetched | Nothing, since no license file was found. |
| Official site and help pages (Google, Bing, Truecaller, GetContact, Sync.ME, Eyecon, CallApp, Hiya, PeopleConnect and the US sites) | official | listed in each site file under `sources` | fetched 2026-10-27 | Opt-out URLs, steps, timing and captcha presence for every file marked `verified: true`. |

## Not used

- NousResearch/hermes-agent, `optional-skills/security/unbroker`. The repository LICENSE is MIT (commit 1186b6bd5330185ba61c4f80fbfc073f7febbf0e), but the unbroker README says its broker dataset is adapted from the Big Ass Data Broker Opt-Out List under CC BY-NC-SA 4.0, and most broker files carry `"source": "BADBOOL"`. We took nothing from it.
- The Big Ass Data Broker Opt-Out List (yaelwrites). Never copied or paraphrased, per project rules.

## jdm.json http fixes

- 17 entries had `http://` URLs. 9 answered over https and were switched: 2captcha, burst.net, crackerbarrel (429 rate limit), fooducate, gametracker, hypem, sdc, whirlpool.net.au (403), epark.
- 8 were dropped because the https URL failed or returned 404 or 405: Animal Crossing Community, Atavi, CA Cert, Doneo, Holiday Pirates, Journal du geek, NovoEd, Wilds.io.
- Two notes had http links. The DaFont link was switched to https. The Experian CreditExpert link no longer resolves, so it was removed from the note and the rest of the note was kept.

## Dropped US sites

- Radaris. On 2026-10-21 and 2026-10-27 radaris.com showed a notice that the domain was transferred by New Jersey court order (Atlas Data Privacy Corporation v. Radaris.com). It no longer serves listings or an opt-out.
- PeekYou. peekyou.com showed a notice on the same dates that Atlas Data Privacy Corporation now controls the domain after a settlement.
