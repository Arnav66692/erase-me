# Interface design

## Approved division

Approved on November 7, 2026, replacing the November 4 Locomotive and Typesafe blend. The interface fuses two references. Words and story are Grail. Actions and transitions are jjettas.

- Grail owns the light all-caps serif, the chapter labels, the floating card field in the hero, the radius 24 cards and the single easing curve, cubic-bezier(.22,1,.36,1).
- jjettas owns the round pills with a domed fill rising from below, the link roll, the wide-tracked mono captions, the slanted wipe panel and the wheel smoothing at lerp .16.
- No element mixes both owners.

The page runs in four colours. Inky black is the exposed hero. Ashen gray, with a graphite smudge texture, is the fading middle. Stark white is the erased end and the workspace. Faded denim is the only accent. The workspace uses the same type and colour with no motion on data. Live numbers snap and never animate.

Decisions taken on November 7. The display face is the Grail serif, not the jjettas condensed caps. The ground runs black to white. The hero card field is plain CSS 3D with no three.js and no outside request. Motion is on the landing only, with no loader. Wheel smoothing, pointer follow, the letter rise, the wipe and the tilt-in all stop for reduced motion, touch and dialogs.

## Reference studies

Forensic studies were made with REA and real Chrome with the GPU on, at 1440, 1920 and 390 wide. They are in `docs/design-study/grail/STUDY.md` and `docs/design-study/jjettas/STUDY.md`. Raw frames and contact sheets stay in `qa/out/refs/`, which is git-ignored. No independent re-measure pass was run on either study.

No reference code, copy, fonts, images, models or marks are shipped. Cormorant Garamond 300 stands in for the Grail serif, Geist for body text and JetBrains Mono for captions, all under the included font licenses. Design quality relative to the references is a visual judgement, not a measured equivalence claim.

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
