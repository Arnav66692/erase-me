# Interface design

## Approved division

The user approved this blend on November 4, 2026. Locomotive owns the editorial type, wide grid, page rules, footer and link motion. Typesafe owns the forms, window frames and live readings. Paper, ink and muted green unify the interface. Live numbers always snap and never shuffle.

The conflicts remain resolved as approved. Serif display headings, 2px editorial rules, 1px window rules with a real 3px chrome inset, a fixed 60px header, native scroll, and short letter shuffle only on editorial links. There is no loading animation delaying the tool.

## Reference comparison

The existing Locomotive and Typesafe studies measured on November 3 were reused, and their desktop contact sheets were visually reviewed. They were not independently remeasured for this revision. The live Race Engineer calculator at https://fuel-stint-calc.vercel.app was captured at 1440 by 900 and compared directly with this interface. Its single serif page title and loose form rail informed the comparison, not copied code.

This revision strengthens the layers through crop-marked display type, 24px terminal window bars, explicit inner window borders, generous ruled editorial rows, and an oversized original footer signature. Page ground changes from paper to green when the workspace opens, while data remains still. Reduced motion disables colour transitions and hover shuffle.

No reference code, copy, proprietary fonts, images, assets or marks are shipped. Instrument Serif, Hanken Grotesk and VT323 remain free stand-ins under the included font licenses. Design quality relative to the references is a visual judgement, not a measured equivalence claim.

## Verification

Landing and signed-in dashboard were checked at 320, 390, 768, 1024, 1440 and 1920px without horizontal overflow. At 390px, all four progress readings finish within the first 844px view. Existing functional IDs and associated labels are preserved. The public workspace supplies its own state and actions. The visual design does not establish that a broker accepted a deletion or removed a listing.

Working screenshot evidence was kept outside the repository. Landing: /tmp/erase-me-upgrade-first-screen.png and /tmp/erase-me-upgrade-phone.png. Dashboard: /tmp/erase-me-upgrade-dashboard.png and /tmp/erase-me-upgrade-dashboard-phone.png. Race Engineer comparison: /tmp/erase-me-iracing-baseline.png. These temporary captures are not release assets.

## Text contrast

Computed from the CSS palette using WCAG relative luminance. Every listed body text and state pair exceeds 4.5:1.

| Ink | Ground | Ratio |
| --- | --- | --- |
| ink | paper | 14.69 |
| ink | green | 9.46 |
| ink | window | 13.21 |
| ink | chrome | 9.05 |
| ink | panel | 12.01 |
| ink | goodbg | 12.90 |
| ink | warnbg | 12.45 |
| muted | paper | 7.15 |
| muted | window | 6.42 |
| paper | ink | 14.69 |
| paper | good | 7.90 |
| bad | paper | 8.06 |
| bad | badbg | 7.19 |
| good | goodbg | 6.93 |
