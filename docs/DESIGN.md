# Interface design

Approved blend, November 4, 2026. Locomotive owns editorial headings, the wide grid, page rules and link motion. Typesafe owns forms, data windows and terminal readings. Paper, ink and muted green unify the interface.

The approved conflicts use serif display headlines, 2px page rules, 1px window borders, a fixed 60px header and native scroll. Live counts snap without animation. Editorial hover shuffle stops within 220ms and respects reduced motion. No loader delays the tool.

Existing measured studies for both references were reused. The references were not independently remeasured for this release. No reference code, copy, imagery or proprietary fonts is included. Instrument Serif, Hanken Grotesk and VT323 are free stand-ins under the included font licenses.

Screens were checked at 390, 768, 1024, 1440 and 1920px with no horizontal overflow. The public deployment is a synthetic interaction demo. Local mode and its privacy boundaries are retained. This visual release does not expand live broker coverage.

## Text contrast

Computed from the CSS palette using WCAG relative luminance. All listed text and state pairs exceed 4.5:1.

| Ink | Ground | Ratio |
| --- | --- | --- |
| ink | paper | 14.69 |
| ink | green | 9.46 |
| ink | window | 13.06 |
| ink | panel | 12.20 |
| ink | goodbg | 12.90 |
| ink | warnbg | 12.45 |
| muted | paper | 7.15 |
| muted | window | 6.35 |
| paper | ink | 14.69 |
| paper | good | 7.90 |
| bad | paper | 8.06 |
| bad | badbg | 7.19 |
