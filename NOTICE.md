# Notice

Erase Me is released under the MIT License. See [LICENSE](LICENSE).

It reuses data from the sources below. `skills/erase-me/references/SOURCES.md` lists every reused source with its commit and what was taken. The upstream MIT license texts are in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). Each data file also names its own sources in its `sources` field.

## Reused data

| Source | License | What Erase Me uses | Where |
|---|---|---|---|
| JustDeleteMe, https://github.com/jdm-contrib/jdm, by the JustDeleteMe contributors | MIT | Account deletion links, difficulty ratings and notes | `skills/erase-me/references/accounts/jdm.json` |
| auto-identity-remove, https://github.com/stephenlthorn/auto-identity-remove | MIT | Fallback opt-out URLs, search URL patterns and captcha hints for sites that blocked our checks | per file, in `sources[].attribution` |
| nulltrace, https://github.com/4x3/nulltrace | MIT | Fallback opt-out URLs and confirmation flags | per file, in `sources[].attribution` |
| identity-eraser, https://github.com/AKCodez/identity-eraser | MIT | Verification and timing facts, rewritten in our own words | per file, in `sources[].attribution` |
| California Data Broker Registry, California Privacy Protection Agency | Public government record | Registration flags in site files | `registries` field of site files |
| Official law texts and regulator pages | Public government records | Citations, deadlines and regulator details, summarized | `skills/erase-me/references/jurisdictions/` |

Where a row says "per file", only the files that name that source in their `sources` field use it.

## Data we do not copy

unbroker, inside https://github.com/NousResearch/hermes-agent, is credited in the README as prior art. Its broker data is adapted from the Big Ass list under CC BY-NC-SA 4.0, so Erase Me takes nothing from it.


The Big Ass Data Broker Opt-Out List, https://github.com/yaelwrites/Big-Ass-Data-Broker-Opt-Out-List, states no license. Erase Me links to it and copies nothing from it. Contributors must not copy from it. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Trademarks

Names of sites, apps, search engines and laws appear only to identify them. Erase Me is not affiliated with or endorsed by any of them.
