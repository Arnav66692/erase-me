# Interface design

## Approved division

Approved on November 7, 2026, replacing the November 4 Locomotive and Typesafe blend. Revised the same night after the first pass read as AI made. The second pass takes each reference's signature moves instead of a light mix.

- Grail owns the serif headlines, the about and chapter labels, the hero belt of statement cards and flat pattern tiles, the cloudy colour chapter with a giant faint number behind the form, the full-width chapter card that tilts in from 7 degrees and .84 scale, the header button and the travelling dock.
- jjettas owns the giant textured condensed word, the row of framed cards with tracked mono captions that walks sideways while the section is pinned, the yard-line numbers, the slanted wipes, the pills with a rising fill, the link roll and the dark footer nav panel with its closing line.
- No element mixes both owners. The giant condensed word is a backdrop, so headlines stay in the Grail serif as approved.

The page runs in four colours. Inky black is the hero, graphite is the card row, ashen gray with a smudge texture is the colour chapter, and stark white is the chapter card, the footer and the workspace. Faded denim is the only accent. The workspace uses the same type and colour with no motion on data. Live numbers snap and never animate.

The 45 day figure on the yard ruler and the faint clock comes from `skills/erase-me/references/jurisdictions/us-ca-ccpa.json`, which cites Cal. Civ. Code 1798.130(a)(2)(A).

Motion is on the landing only, with no loader. Wheel smoothing, pointer follow, the letter rise, the belt spin, the pinned row, the chapter card tilt and the dock travel all stop for reduced motion. Touch and phone keep native scroll, and the card row becomes a swipe row.

## Reference studies

Forensic studies were made with REA and real Chrome with the GPU on, at 1440, 1920 and 390 wide. They are in `docs/design-study/grail/STUDY.md` and `docs/design-study/jjettas/STUDY.md`. Raw frames and contact sheets stay in `qa/out/refs/`, which is git-ignored. No independent re-measure pass was run on either study.

No reference code, copy, fonts, images, models or marks are shipped. Cormorant Garamond 300 stands in for the Grail serif, Saira Extra Condensed 700 for the jjettas condensed face, Geist for body text and JetBrains Mono for captions, all under the included font licenses. Card faces and pattern tiles are drawn in CSS. Design quality relative to the references is a visual judgement, not a measured equivalence claim.

## Verification

The landing was checked at 1440 by 900 and 375 by 812, and the signed-in demo dashboard at 1440 by 900. Neither width had horizontal overflow. Existing functional IDs and form classes are preserved. All 785 JavaScript tests and 1495 Python tests passed after the change. The 1920 width, tablet widths, keyboard-only navigation and the published preview build in a browser were not checked by hand.

## Text contrast

Computed from the CSS palette using WCAG relative luminance.

| Ink | Ground | Ratio |
| --- | --- | --- |
| ink #0e0f11 | white #fbfbfa | 18.52 |
| white | ink | 18.52 |
| ink | ash #bcbbb6 | 9.97 |
| ink | ash light #e6e5e1 | 15.21 |
| denim #8ea6c2 | ink | 7.66 |
| denim ink #3f5a7a | white | 6.86 |
| white | denim ink | 6.86 |
| denim ink | ash light | 5.64 |
| muted #55554f | white | 7.25 |
| muted | ash light | 5.95 |
| ash deep #4c4b47 | ash | 4.54 |
| good | good bg | 6.30 |
| warn | warn bg | 6.47 |
| bad | bad bg | 7.18 |

Rules that follow from the table. Small text on the ash ground is always ink. Denim ink fails on ash (3.70) and is never used there. Accent words on ash use ash deep, which passes at 4.54.
