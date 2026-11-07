# grail-app.com forensic study

Measured 2026-11-07 in real headless Chrome with the Metal GPU, muted, at 1440x900, 1920x1080 and 390x844 (touch, DPR 2). No cookie banner appeared on any run, so there was nothing to decline. The waitlist form was focused once by keyboard and never typed into or submitted. No login, nothing created.

Paths below are relative to `qa/out/refs/grail/`, which is git-ignored. Frames are in `walk/`, `load/`, `field/`, `hero/`, `hover/`, `totem/`, `focus/`, `reduced/`, `legal/`. Sheets are in `sheets/`. Raw JSON, DOM trees and the fetched bundles are in `data/` and `src/`, kept out of the repo because they hold site text and code. Scripts are next to this file.

Anything I could not measure is marked "not measured". See Caveats at the end.

## 1. The site in one paragraph

A one-page scroll story for a waitlist app, told in eight numbered chapters on black, lilac, warm grey and smoky brown grounds. A light, high-contrast all-caps serif carries every headline, a variable grotesk and the system UI face carry the rest. The hero is a three.js field of floating quest cards and patterned crest tiles. As you scroll, the field gathers into one card, that card folds into an hourglass while a lilac ground burns in, then lands inside a phone. Later chapters bring a gold 3D totem with its name set in front of and behind it, physics blobs piling up for stats, and full-width rounded cards that tilt in and out. A small pill dock with Join Waitlist rides along the bottom and slides left to right as a progress bar.

## 2. System

### Root, scaling and breakpoints

- Root font size is 16px at all three widths. Display type is in vw with clamps, body and UI type are fixed px. Evidence `data/measure-home-*.json` field `comp.rootFont`, `src/HomePage-B7z74ohK.css`.
- Breakpoints read from the shipped CSS. The main switch is 768 (9 rules at max-width 768, and min-width 769 for desktop). Others are 560, 720, 1000 and 1279 wide, plus two height rules at 760 and 820 tall for desktop. Hover-free devices get three `pointer: coarse` rules. A JS check treats a coarse pointer with a screen under 820 as mobile.
- Page height is 11729 at 1440, 14018 at 1920 and 10065 at 390. Evidence `data/walk-*.json`.
- Built with Vite and React, hosted on Vercel, smooth scroll by Lenis. See section 6 for the stack.

### Frame, gutters and rhythm

No 12-column grid. Each chapter is a 100vh stage, often pinned with `position: sticky`, with absolutely placed parts. Evidence `data/skeleton-home-d1440.txt`.

| Measure at 1440 | Value | Where |
|---|---|---|
| Nav padding | 30 top, 40 sides | logo at x 40, CTA ends at x 1400 |
| Headline side margin | 40 | hero headline spans 1360 |
| Body side margin | 40 | Timer lead, Journey list, legal back link sits at 360 |
| Chapter label inset | 32 sides, 25 top | `_colontitle`, 16 on phone |
| Stats columns | 4 at a 360 pitch | labels at x 32, 392, 752, 1112, with 1px rules between |
| Journey rows | grid, column gap 5%, padding-top 17 | each row steps in about 17px from the one before, a staircase |
| Footer form | 1376 wide, padding 54 0, gap 26 | 32 inset |
| Legal column | 720 wide at x 360 | body text 16 on 25.6 |

- 1920 scales display type up through vw until each clamp hits its cap, while margins stay 32 and 40. The hero headline is fitted to the width minus 80, so it is 145.2 at 1440 and 196.5 at 1920.
- Phone stacks everything into one column at 16 or 20 side. The header becomes a centred logo with the tagline under it, the header CTA is `display: none`, and the dock is the only waitlist button.

### Grounds, radii, shadows, borders

- Body and html are #000. Chapters swap grounds by drawing them, the lilac and brown grounds are canvas layers, not CSS backgrounds. Evidence `data/pixels-d1440.json`.
- Radii. Pills are 999 or 99. The dock is 84. Chapter cards are 24. The footer app tile is 32. The phone sheet in the voice chapter is 20 20 34 34. Images in the Journey list are square. Evidence `data/measure-home-d1440.json` field `acc.radii`.
- Shadows are rare. Mic button has a 4px ring `rgba(255,255,255,.06) 0 0 0 4px`. The header CTA gets `rgba(236,210,243,.28) 0 8px 22px` on hover. The focus ring adds a 2px black halo. Nothing else at rest.
- Borders. Only the dock has a CSS border, 1px, whose colour follows the theme. Rules are 1px fills, for example the Timer divider at `rgba(98,53,98,.28)` and the totem divider at `rgba(255,255,255,.16)`.
- Blur. The hero scrim under the nav is two blur layers plus a black to transparent gradient (black to 38 percent, clear by 100 percent) over the top 504px. The phone image enters at `blur(14px)` and clears to 0. The totem name back plate uses `blur(26px)`.

## 3. Type

Loaded from `document.fonts` and computed styles at all three widths.

| Family | Weight | Job | Source |
|---|---|---|---|
| PP Pangaia Light | 300 | every headline, the clock, the totem name, the email field | self-hosted woff2, 67,796 bytes, a paid Pangram Pangram face |
| Switzer Variable | 100 to 900 | tagline, buttons, body in early chapters, legal pages | self-hosted woff2, 43,220 bytes, a free Fontshare face |
| System UI (-apple-system, SF Pro on Mac) | 400 to 700 | chapter labels, later body text, totem pills, stats, footer | not loaded, falls back to system-ui |

The Pangaia caps carry the look. V and W are drawn as looped U shapes (see `walk/d1440/s02-y900.jpg`), and the light weight has very high contrast.

Scale at 1440, then 1920 and 390. Sizes and line heights are px. Every display role is uppercase at weight 300 with tracking of -0.01em, except where noted.

| Role | Size / LH at 1440 | 1920 | 390 | Rule | Colour |
|---|---|---|---|---|---|
| Timer clock digits | 345.6 / 345.6 | 460.8 | 97.5 | 24vw (25vw phone), LH 1, tracking -0.01em, not uppercase | #e7afe7 on lilac |
| Totem name | 208 / 183.04 | 208 | 48.75 | capped at 208, LH .88, tracking -0.005em | #fff |
| Hero headline | 145.2 / 127.8 | 196.5 | 60.45 | fitted to width minus 80, phone 15.5vw on two lines | #fff |
| Problem headline, guild lead, journey lines in some sizes | 92.16 / 81.1 | 122.88 | 50.7 | 6.4vw, LH .88 | #fff or #000 |
| Stats head, email field, voice head | 92 / 80.96 | 92 | 40 | cap 92, LH .88 | #fff, placeholder letters at .4 white |
| Journey head | 89.28 / 78.57 | 92 | 39.78 | 6.2vw capped at 92 | #000 |
| Voice head (Tell future self) | 86.4 / 74.3 | 92 | 40 | 6vw capped at 92, LH .86 | #000 |
| Timer head | 81 / 71.28 | 97.2 | 33.54 | 9vh | #623562 |
| Totem counter (1) | 104 / 91.52 | 104 | 58.5 | not uppercase, no tracking | #fff |
| Totem tagline (Six totems) | 72 / 63.36 | 72 | 39.78 | cap 72, tracking -0.005em | #fff |
| Legal h1 | 92 / 82.8 | not measured | 44 | LH .9 | #fff |
| Stat count | 24 / 25.92, 700 | same | same | system | #fff |
| Lead line | 18 / 20.16, 700 | same | same | Switzer or system | #623562 on lilac, #000, #eee |
| Body | 16 / 19.84, 400 | same | 15 / 18.6 for voice | Switzer early, system later | #b8b8b8 on black, rgba(0,0,0,.6) on grey, rgba(0,0,0,.62) on lilac |
| Tagline | 15 / 20.25, 400 | same | 14 / 18.9 | Switzer | rgba(255,255,255,.72), #989898 on phone |
| Header CTA | 15, 600 | same | hidden | Switzer | #1a1018 |
| Dock button | 16 / 19.84, 600 | same | same | Switzer | theme colour, see Colour |
| Totem pill | 16, 600 | same | same | system | #000 on active, #fff on others |
| Chapter label | 14 / 18.34, 500 | same | same | system | #fff or #000 |
| Footer, small body | 14 / 18.34, 500 or 400 | same | same | system | #b8b8b8, rgba(255,255,255,.5) |
| Phone mock pills | 13, 400 | same | 11 | system | #f5f5f5 |

Patterns worth keeping.

- Display line height is .88 almost everywhere, and the caps nearly touch between lines.
- One weight for display, 300. All emphasis comes from size, never bold serif.
- Headlines are split into words or letters so each piece can rise on its own.
- Body never goes above 18. The jump from 18 to 81 or more is the whole hierarchy, there is no middle size.

Evidence `data/measure-home-d1440.json`, `data/measure-home-d1920.json`, `data/measure-home-m390.json`, `data/legal.json`.

## 4. Colour

Read from computed styles, and from lossless in-memory screenshots for canvas grounds. Canvas values vary a little because the grounds have texture. Evidence `data/measure-home-d1440.json`, `data/pixels-d1440.json`, `data/hero.json`, `data/scroll-d1440.json`.

| Role | Value | Where |
|---|---|---|
| Ground black | #000 | body, hero, Problem, footer |
| Legal ground | #0a0a0a | privacy and terms |
| Lilac ground | about #ebbceb, a soft cloudy texture from #e8b8e8 to #f0c0f0 | Timer and Voice chapters, canvas |
| Loader lilac | #f2cdf8 | loader screen |
| Warm grey card | #f6f6f6 | Journey and Guilds cards |
| Smoke brown | #130e09 to #20180f, mottled | Totem and Stats chapters, canvas |
| Brand lilac | #ffcdff | dock text on dark, logo mark tile, active totem pill, stat blobs |
| CTA lilac | #ecd2f3, hover #f6e3fb | header Join Waitlist |
| CTA ink | #1a1018 | header CTA text |
| Clock lilac | #e7afe7 | clock digits on lilac |
| Plum | #623562 | Timer head and text, divider at .28 |
| Grey text | #b8b8b8, #eee | body and footer on black |
| Loader card | frame #837052, inner #f2f2f2 | loading card |
| Tile mark | #221826 on a radial lilac (#ffe4ff, #ffcdff at 55%, #f6bdf6) | footer app tile |
| Legal link | #e9b8ff | privacy and terms links |
| Crest red | about #ff3300 | crest patterns, stat blobs |
| Crest yellow | about #f8c800 | crest patterns |
| Crest brown | about #807050 | crest patterns |
| Crest cyan and blue | #adefff, #0a66de | Wind Shifters crest, stat blobs |

In the 3D hero the same crest colours read darker, around #b02000, #b08800, #b088b0 and #584838, because the scene is lit and fades to black.

### Dock themes

The dock swaps class by chapter. Evidence `data/scroll-d1440.json`.

| Theme | Dock ground | Border | Button ground | Button text | Mark | Scroll range at 1440 |
|---|---|---|---|---|---|---|
| Dark | rgba(24,24,24,.6) | rgba(255,255,255,.14) | rgba(255,255,255,.14) | #ffcdff | #ffcdff | 0 to 1800, 5400 to 8400, 10200 |
| Pink | rgba(96,42,86,.2) | rgba(255,255,255,.3) | rgba(255,255,255,.5) | #7c4f74 | rgba(84,36,76,.42) | 2100 to 2700, 4200 to 5100 |
| Light | #fff | rgba(0,0,0,.14) | #f4f1ec | #5f5138 | #5f5138 | 3000 to 3900, 8700 to 9900 |

There is no dark mode and no `prefers-color-scheme` rule. The theme-color meta is #FAFAFA.

## 5. Components

### Header

- Nav is a grid at the top of the hero, 104 tall, padding 30 40, gap 24, not fixed. It scrolls away. Evidence `data/measure-home-d1440.json` field `comp.o._nav`.
- Logo button 128 by 24 at x 40, a lilac mark plus a bold grotesk wordmark, an SVG.
- Tagline centred, 430 wide, two lines at 15 on 20.25.
- Join Waitlist pill 129 by 44, padding 12 22, #ecd2f3 with #1a1018 text. Hover lifts to scale 1.03 and translateY -2, background to #f6e3fb, glow `rgba(236,210,243,.28) 0 8px 22px`. Press goes to scale .99. Transition 150ms ease on background and transform. Evidence `data/hover.json` fields `ctaIn`, `ctaDown`, `ctaOut`, `hover/cta-on.jpg`.

### Dock, the floating Join Waitlist

- A fixed pill at the bottom, 194 by 58, radius 84, padding 6 6 6 16, gap 12, 1px border. Left is the logo mark, right is a 131 by 44 button pill. Bottom 24 at 1440, 20 on phone.
- On desktop it is hidden at the top with opacity 0 and translate 0 16px, and appears once you scroll. On phone it shows from the start. Transition 350ms on opacity, translate, background and border, 200ms on scale.
- Desktop only, its x tracks scroll progress. Left edge goes 24, 64, 104 at scroll 0, 300, 600, which is 0.133 px per px, and it stops at x 1222 (right edge 24 from the side) at about 9000, then hides at the footer. Phone keeps it centred at x 98. Evidence `data/scroll-d1440.json`, `data/scroll-m390.json`.
- Hover on the dock changed nothing I could log in its button colours. Evidence `data/hover.json` field `dockIn`.

### Chapter labels

Every chapter has a top bar, 14 system 500, an "About" label left and a chapter number right, 32 from each side, 25 from the top. Eight chapters, Problem, Timer, Journey, Voice Feedback, Totems, Stats, Guilds, Get In Early.

### Hero card field

- One WebGL canvas, 1440 by 770, inside a fixed layer that starts at y 130. Cards are textured planes. Quest card faces are drawn into 2D canvases of 690 by 980 (ratio .70) and used as textures. 41 canvas contexts were created during one walk, most of them 690 by 980. Crest tiles are webp patterns. Evidence `data/probe.json` field `ctx`, `data/walk-d1440.json` field `study`.
- Quest card face. Crest icon, a small grey guild name, a bold grotesk quest line, a grey sentence, a row of round avatar chips with times, a count chip, and a footer line. Rounded corners.
- The field is always moving. 23 percent of screen pixels changed in 1 second with no input. Pointer moves the field, 31 percent of pixels differ between pointer at left and pointer at right. Evidence `data/hero.json`, `sheets/field-d1440.jpg`.

### Journey list (Chapter 03)

A full-width #f6f6f6 card with radius 24. Head 89 on two lines with a crest tile set inline in the first line. Five rows, each with "A chance", a bold 18 title, a number 01 to 05, a photo in the centre column and a grey sentence on the right. Rows step in like a staircase, and rows further down are lighter. `walk/d1440/s08-y3600.jpg`.

### Phone mock (Chapters 02 and 04)

A phone image, 214 by 420 at 1440, centred. In Voice it shows a dark sheet, radius 20 20 34 34, #161616, with a gold vine drawing round a mic button (#3a3a3a with a 4px ring) and three small pills. Big words flank it, three lines left, three lines right, aligned to the outer edges. `walk/d1440/s11-y4950.jpg`.

### Totem chapter (Chapter 05)

- A gold 3D animal in armour, loaded as a GLB from the TotemStage chunk. Six models, duck, cat, bear, rat, frog, penguin. Evidence `src/totems-6Ag_iF3F.js` model list.
- The name is set twice at 208, a back copy behind the model and a front copy over it, so the model sits inside the words. `walk/d1440/s14-y6300.jpg`.
- Counter "(1)" at 104 top right, a bold one-liner top left, a 1px rule, a two-line tagline at 72 bottom left, a short grey paragraph and the pills bottom right.
- Pills 37 tall, padding 0 15, radius 99. Active is #ffcdff with black text. Others are rgba(255,255,255,.13) with white text, hover goes to about .22 over 200ms ease. Clicking Cat changed the name, one-liner and counter to (2). Only the active pill is in the tab order. Evidence `data/hover.json` fields `pillHover`, `afterCat`, `totem/after-cat-2000.jpg`.
- Custom cursor. Over the stage the native cursor is hidden and a 96 by 96 arrow follows the pointer. It points right on the right half and turns 180 degrees on the left half, in 420ms with cubic-bezier(.22,1,.36,1). The click goes to the next or previous totem, I did not click the stage. Evidence `data/hover.json` fields `totemCursorRight`, `cursorFlip`, `totem/cursor-right.jpg`, `totem/cursor-left.jpg`.

### Stats (Chapter 06)

Head at 92 top left, grey paragraph, four labelled columns with a name and a 24 bold count. At the bottom, coloured blob shapes pile up in each column, made with matter.js physics and a goo canvas. On phone the columns become a 2 by 2 grid of big flat glyph tiles with no physics. `walk/d1440/s19-y8550.jpg`, `walk/m390/s11-y7425.jpg`.

### Guilds (Chapter 07)

A second #f6f6f6 card with radius 24. Crest tiles ride on ten rotated ring layers round the centre, five show in the frame at once, a guild name under the top one, then a 14 kicker line and the head at 92 with its words placed one by one. `walk/d1440/s21-y9450.jpg`.

### Footer and waitlist form (Chapter 08)

- Black, with a light ray canvas behind a 123 by 123 app tile of radius 32. A bold 18 line and a grey 14 paragraph under it.
- The email field is the form. It is a 1376 wide input set in Pangaia 92, uppercase, white, with a 1px bottom rule. The placeholder is drawn as separate letters at .4 white, not the native placeholder. A hidden honeypot text input sits beside it with tabindex -1. A small grey note line sits under the rule.
- Bottom row at 14, made-by and Privacy left, the wordmark button with a short slogan centred, email and Terms right.
- Phone shows the same form at 40.

### Legal pages

/privacy and /terms are plain, #0a0a0a ground, a 720 column at x 360, a back link at 14, h1 at 92 in Pangaia, a 13 grey date, h2 at 18 bold, body 16 on 25.6 at #c9c9c9, links #e9b8ff. Evidence `data/legal.json`, `legal/privacy-d1440-top.jpg`.

## 6. Motion

### Stack, from REA and the bundles

REA `analyze_web_bundle` on the live page (Evidence `ev_0e0e6b9e2aa7abee0ea1863c0f328d4bae901dd4221a9e1251c745b9492e41dc`) parsed 17 scripts with no failures. It inferred Vite as the bundle runtime and React as a vendor, each at medium confidence, from `index-qyEp212_.js` and `HomePage-SelUD7Yz.js`. The chunk graph has `HomePage` statically importing `three.module`, `quests`, `warpFill`, `VoiceGarden`, `totems`, `device` and `viewport`. three.js shows up through WebGL extension lookups in `three.module-DHIuxIYb.js`. A second REA call, `capture_browser_scenario`, timed out at cleanup and returned no Evidence ID.

From my own reads of the fetched bundles in `src/`.

| Library | Evidence |
|---|---|
| three.js r185 | `__THREE__` set to 185, and the global exists at runtime |
| Lenis 1.3.25 | version string in HomePage, `html.lenis` class at runtime, created with `syncTouch: false` and defaults otherwise |
| matter.js | `matter-DegRgWhp.js`, loaded by dynamic import for Stats |
| React Router | path table in `index-qyEp212_.js` |
| PostHog 1.369.3 | `module-BDwWso9v.js` and eu-assets requests |
| Supabase | dynamic import from HomePage, waitlist backend, not exercised |
| Not seen | GSAP, ScrollTrigger, Framer Motion, Webflow, Next, Barba, Locomotive |

The floating cards are WebGL, not CSS 3D. The only CSS 3D is the phone image, which has a matrix3d tilt while it flies in.

### Loader and entrance

Frames `load/d1440/`, `sheets/load-d1440.jpg`, log `data/load-d1440.json`.

1. A #f2cdf8 lilac screen with a small card in the centre, a #837052 frame round a #f2f2f2 face, the mark and a loading word with a percent in Pangaia. It turns slightly in 3D. It was on screen from about 0.3 to 2.3 s in this run.
2. The card swings and grows, its face becomes the black hero scene, and that black plane tilts and zooms until it fills the screen, 2.4 to 3.4 s.
3. The headline rises letter by letter. Each letter starts at translateY 90.04 (.62em) and opacity 0, and settles in about 600ms. Half the distance is gone at about 105ms and 90 percent at about 250ms, with no overshoot. Letters start 48ms apart, so letter 15 lands about 1.27 s after letter 1.
4. Nav, tagline and CTA were already at opacity 1 with no transform during this.

### Scrolling

- Lenis smooth scroll with its default lerp of .1. One 100px wheel tick started moving about 100ms after the event, reached 90 percent at about 450ms, 99 percent at about 800ms and stopped at about 950ms. Five quick ticks moved 500px in about 1.3 s. Evidence `data/scroll-d1440.json` fields `tick100`, `burst500`.
- Scroll restoration is set to manual and the page scrolls to 0 on load.

### Scroll-linked choreography at 1440

| Scroll | What happens | Frames |
|---|---|---|
| 0 to 450 | Headline scales to .38, fades out and drifts up at .18 of scroll. Cards spread, then gather into a fanned row | `field/d1440/y0000` to `y0450` |
| 450 to 900 | Problem lines rise 46px (.5em) and fade in. The fan shrinks to one card | `walk/d1440/s01-y450.jpg` |
| 1200 to 1800 | One card holds still in the centre on black | `field/d1440/y1500.jpg` |
| about 2100 | Lilac ground burns in from the edges with a ragged ink mask. The card folds into an hourglass shape over a brown base. The 48 hour clock counts down at 24vw. The phone image fades in from blur 14 to 0 | `field/d1440/y2100.jpg` |
| 2250 to 2700 | Timer head words rise 40.5px (.5em) and fade in. Card sits in the phone. Divider grows from scaleX 0 | `walk/d1440/s05-y2250.jpg` |
| 2700 to 3600 | Journey card rises from rotate 7 degrees and scale .84 to flat at 1 when its top hits the viewport top. Clock fades out | `walk/d1440/s07-y3150.jpg` |
| 3600 to 4950 | Journey card leaves by rotating to -7 and scaling to .84 | data only |
| 4950 to 5400 | Voice chapter pinned, phone shows the voice sheet | `walk/d1440/s11-y4950.jpg` |
| 5850 to 7600 | Totem stage pinned for about 1.7 screens | `walk/d1440/s14-y6300.jpg` |
| 8244 to 9300 | Stats pinned, blobs fall and pile up | `walk/d1440/s19-y8550.jpg` |
| 9000 to 9900 | Guilds card rotates in from 7 degrees and .84 to flat | `walk/d1440/s21-y9450.jpg` |
| 9929 on | Footer pinned, the guilds card slides away above it | `walk/d1440/s24-y10800.jpg` |

On phone the cards use 3.2 degrees and a .12 scale change instead of 7 and .16, read from the shipped CSS.

### Hover and state timing

| Motion | Measured | Source |
|---|---|---|
| Main easing | cubic-bezier(.22,1,.36,1), 35 uses in the home CSS | `src/HomePage-B7z74ohK.css` |
| Header CTA | background and transform 150ms ease, hover scale 1.03 and -2px, press .99 | `data/hover.json` |
| Dock | opacity, translate, background, border 350ms, scale 200ms, button colours 350ms, filter 150ms | computed styles |
| Totem pill | background and colour 200ms ease | `data/hover.json` |
| Totem cursor turn | transform 420ms on the main easing, fade 250ms | `data/hover.json` field `cursorFlip` |
| Footer letters | transform and colour 300ms on the main easing, 53 split spans | computed styles |
| Footer tile | transform .55 s on the main easing after .15 s delay, opacity .15 s | computed styles |
| Footer rays | opacity 1.2 s with a .7 s delay | computed styles |
| Email field | opacity .5 s with a .85 s delay, rule 1.1 s on the main easing after .9 s | computed styles |
| Journey photos | opacity and transform .55 s | computed styles |

### Always-on motion

- Hero field drifts with no input, see Components.
- The clock ticks down once a second from 47:59:59.
- No sound. 0 AudioContext calls and no audio files in the bundles.

## 7. Structure

Home, in order at 1440, with top y.

| y | Block |
|---|---|
| 0 | Hero, 900 tall, nav, headline, card field |
| 900 | Chapter 01 Problem, 900 |
| 1800 to 3600 | Two empty 900 stages that drive the fold and the Timer chapter, which is a fixed overlay |
| 3636 | Chapter 03 Journey card, about 1243 tall |
| 4014 | Chapter 04 Voice, sticky inside a 2385 tall wrapper |
| 6219 | Chapter 05 Totems, sticky inside 1530 |
| 8244 | Chapter 06 Stats, sticky inside 2160 |
| 9540 | Chapter 07 Guilds card, about 1252 |
| 9929 | Chapter 08 footer, sticky inside 1800 |

Evidence `data/skeleton-home-d1440.txt`.

Other pages. /privacy and /terms are linked from the footer. The router also lists /admin, /demo, /guilds, /home, /hometest, /light-lab, /loader-lab, /q/:slug, /spiral, /spiral-gl, /stats, /totem-lab, /totem-motion, /totems, /v1, /vine, /vine-garden and /warp. These are not linked from the site and I did not visit them.

## 8. What makes it recognisable

1. One light, high-contrast serif in caps at huge sizes with looped V and W, line height .88. `walk/d1440/s02-y900.jpg`.
2. A black stage with a lit 3D field of cards and crest tiles that drifts and follows the pointer. `probe/d1440-first.jpg`.
3. The scroll is a story with one object. A card gathers, folds into an hourglass and lands in a phone. `sheets/field-d1440.jpg`.
4. Grounds that are textured, not flat. Cloudy lilac, smoky brown, warm grey cards on black.
5. Chapter labels on every screen, an About label and a chapter number.
6. Full-width rounded cards that tilt in at 7 degrees and leave at -7.
7. Text set in front of and behind a 3D model. `walk/d1440/s14-y6300.jpg`.
8. A small pill dock that travels across the bottom as a progress bar and changes theme by chapter.
9. Bold, flat crest patterns in red, yellow, lilac, brown and blue as the brand texture.
10. A waitlist field typed in the display face at 92.

## 9. Accessibility gaps worth not copying

Contrast from measured colours, alpha composited.

| Pair | Ratio | Where |
|---|---|---|
| Clock #e7afe7 on lilac | 1.11 | 345px clock, decorative but it is real text |
| Placeholder letters, white .4 on black | 3.66 | email field |
| Dock pink #7c4f74 on its pink pill | 4.48 | dock button on lilac, 16px 600, just under 4.5 |
| Body #000 at .62 on lilac | 5.20 | Voice body, passes |
| #623562 on lilac | 5.86 | Timer text, passes |
| White .5 on smoke brown | 5.33 | Totem and Stats body, passes on the darkest sample only |

- Reduced motion is only half honoured. With `prefers-reduced-motion: reduce` the hero drift stopped (0 percent pixel change in 1 s), letters appeared in place without rising, and the CSS cuts transitions to .001ms. But the loader still ran, letters still appeared one by one, and Lenis still smoothed the wheel on the same curve (55px at 183ms, 99 at 751ms after a 100px tick). Evidence `data/reduced.json`, `sheets/reduced.jpg`.
- Keyboard. From the top the tab order is logo, header CTA, the active totem pill, then straight to the email field at the footer, footer links and the dock. The whole story between has no stops. Focus rings are good, 2px rgba(255,255,255,.95) with a 2px offset and a 2px black halo, but the email field sets outline none. Evidence `data/hover.json` field `focus`, `focus/tab1.jpg`.
- Structure. No `main` landmark and no `footer` element. Headings are present, with an sr-only h2 copy of several split headlines, so screen readers get whole sentences. One h1. A visually hidden list repeats the stats.
- Alt text. 23 of 25 images have empty alt, mostly decorative crest and story images. The story photos carry meaning and have no alt. Evidence `data/measure-home-d1440.json` field `comp.imgs`.
- Totem stage hides the native cursor and relies on a drawn arrow.
- Pill heights. Totem pills are 37 tall, under 44.
- No cookie banner while PostHog analytics loads. Whether consent is needed is a legal question, not measured here.

Worth copying instead. The sr-only sentence copies of split headlines, the focus ring with a halo that works on any ground, the honeypot field taken out of the tab order, and the global reduced-motion CSS rule as a start.

## 10. Caveats

- Machine load was shared with another study running at the same time. Absolute load times are not site speed. The letter entrance and Lenis curves come from per-frame logs, which are more reliable.
- The loader timings are from one run. The first render ran the letter rise once at about 0.2 s, then the app reset it and ran it again after the zoom. I used the second run.
- Canvas grounds are sampled at a few points and quantised in a histogram. Treat them as close, not exact.
- Not measured. Card count and camera of the hero field, pointer follow speed and easing for the field, the drift speed, the ink burn mask and fold timing, matter.js settings, totem model turn speed and the click on the stage, VoiceGarden vine timing, guild ring rotation speed, the email field focus and typing states, the 1920 and phone loader, unlinked routes, the exact width of the rotated cards before they flatten (they are full width with 24 radius when flat).
- No site code, fonts, images, models or running copy were copied into this repo. Raw dumps with site text and the fetched bundles stay in the git-ignored folder.
