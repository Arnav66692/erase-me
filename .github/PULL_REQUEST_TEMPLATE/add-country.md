## Add a country pack

Country: <!-- name and ISO code, for example Turkey, TR -->

Folder: `skills/erase-me/references/countries/<cc>/`

### Sites added

| Site id | Category | Opt-out method | Opened the opt-out page on |
|---|---|---|---|
| | | | |

### Law file

- [ ] This country already has a law file in `references/jurisdictions/`.
- [ ] This PR adds or updates a law file. Official sources are listed in it with access dates.
- [ ] No law gives an erasure right here yet, and the pack relies on site opt-outs.

### Checks

- [ ] Every file follows the "Site file" schema in `docs/ARCHITECTURE.md`.
- [ ] Search URLs use only the allowed placeholders.
- [ ] `verified: true` only where I opened the opt-out page on the site on the `last_verified` date. Others are `verified: false` with a note.
- [ ] Every file lists its sources. Reused data has a license that allows it and is credited.
- [ ] Nothing is copied from the Big Ass Data Broker Opt-Out List.
- [ ] No real person's name, phone, email, address or listing URL appears anywhere, including screenshots.
- [ ] `python skills/erase-me/scripts/erase_me.py validate` passes.
- [ ] `python -m pytest -m "not network"` passes.

### How people in this country usually get exposed

<!-- Two or three sentences. For example, caller-ID apps, a national phone directory, business registries. This helps the agent pick channels. -->
