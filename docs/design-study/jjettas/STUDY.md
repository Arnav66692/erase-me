# jjettas.com forensic study

Measured 2026-11-07 in real headless Chrome with the Metal GPU flags, muted, at 1440x900, 1920x1080 and 390x844 (touch, DPR 2). No cookie banner appeared on any run, so there was nothing to decline. Nothing was typed, submitted or logged into. The robots-disallowed lab pages were not visited.

Raw frames, JSON, DOM data, downloaded bundles and contact sheets are in `/Users/arnavsingh/Desktop/Business/erase-me/qa/out/refs/jjettas/`, which is git-ignored. Paths below are relative to that folder. Scripts are next to this file. The site's code, fonts, images and copy are kept there for measurement only and are not copied into any repo file.

Anything I could not measure is marked "not measured". Numbers marked "from the bundle" are values read from the shipped JavaScript or CSS, not from a live capture. Everything else comes from a live capture.

## 1. The site in two sentences

A personal site for an NFL receiver, built as a dark purple and bone editorial scroll story with football leather texture everywhere, huge condensed caps, gold trading cards and a WebGL hero portrait whose sunglasses reflect a game video. It is a Next.js app with GSAP ScrollTrigger pinning, Lenis smooth scroll, three.js for the hero, UI sound effects and slanted wipe panels between every state.

## 2. Stack fingerprint

| Layer | Finding | Evidence |
|---|---|---|
| Framework | Next.js App Router, React. REA vendor fingerprints Next.js high, React medium | REA `ev_c67170576a68c09321c024bd914341efdf6c374c55a15eb5c745d29d2efa560d` |
| Resources | 33 scripts, 37 images, 5 fonts, 6 stylesheets on home. Typekit, Sanity image CDN through next/image, Vercel insights, a vendored `lottie-svg.min.js` | REA `ev_c6401918b82cc5e71e01990ed555b284c47ade54466810d71419edc12f474346`, saved as `data/rea-inspect-home.json` |
| WebGL | WebGL extension lookups (multi draw, anisotropic, clip control, compressed textures) in chunk `2a9a6835`, three.js revision string `"174"` and `__THREE__` in chunk `e6502385`. Live hook saw webgl2 contexts created at about 2.5 s | REA endpoint list in the first Evidence, `raw/js/`, `data/interact-d1440.json` field `hero.ctx` |
| Animation | GSAP 3.15.0 with ScrollTrigger | version strings in `raw/js/04763798…js`, `6899…js` |
| Smooth scroll | Lenis 1.3.23, loaded only on fine pointer and no reduced motion | `raw/js/9366…js`, `8556…js` |
| Vector | lottie-web 5.13.0 for the drawn signature, fetch of `/signature/optimised.json` | REA endpoint list, `lottie-svg.min.js` |
| Audio | 14 m4a UI sounds requested on load (click, hover, tick, toggle on and off, slide, reveal, power on, card in, drag), plus `/audio/onfield/fragments.json` | `data/loaddiag-d1440.json` field `reqs` |
| Video | hero video from a Bunny CDN host at 1080p, other clips from the Sanity CDN | `data/loaddiag-d1440.json` |
| CSS | Tailwind-style utility classes with v4 style tokens (`--spacing:.25rem`, oklch palette entries). Tailwind version is my inference | `raw/css/67646cfa69d02575.css` |
| CMS | Sanity (image URLs and a `sanity` query param check) | REA endpoint list |
| Not seen | Framer Motion, Locomotive, Barba, Webflow, Framer, react-three-fiber. One `startViewTransition` string sits inside the React runtime chunk, route changes use their own veil | grep of `raw/js/` |

## 3. System

### Units and scaling

- Root font size is 16px at every width.
- Display type scales on a custom unit, read from the live root. `--page-w` is `min(100vw,1728px)`. `--vu` is `min(page-w/100, 1.8 * max(1vh, 7px))`. On phone `--pu` is `min(1vw, .5 * max(1lvh, 6.4px))`.
- At 1440x900 `--vu` is 14.4px. At 1920x1080 the page width caps at 1728, so `--vu` is 17.28px and every display size is exactly 1.2 times the 1440 size (Partnerships word 432.96 to 519.54). Small UI type stays fixed px.
- Above 1728 the content frame centres with `--page-x = (100vw - 1728) / 2`. Grounds and textures stay full bleed.

### Breakpoints

From the CSS. 767 and 768, a coarse pointer band up to 900, 1023 and 1024, a 1219 or 1299 with aspect under 7/5 band, and 1729 where the page cap starts. Tailwind steps at 40, 48, 64, 80 and 96rem are also present. Phone layout is chosen by width 767 or by width 900 with a coarse pointer.

### Frame and margins

| Width | Side margin | Where measured |
|---|---|---|
| 1440 | 48 | logo x 48, hero text x 48, partnerships copy x 104 after a 56 wide index rail |
| 1920 | 144 (96 page offset plus 48) | `walk/d1920/home/s00-y00000.jpg` |
| 390 | 24 | logo x 24, `data/interact-m390.json` |

No visible column grid. Layouts are centred stacks, a left and right copy pair around a centre image on the hero, and three equal cards on inquiries (397 wide, 24 gap at 1440, read from `comp/d1440/inquiries.jpg`).

### Page lengths

| Page | 1440 | 1920 | 390 |
|---|---|---|---|
| Home | 17158 | 20590 | 7016 |
| On-field | 10678 | not measured | 6545 |
| Off-field | 13170 | not measured | 5373 |
| Partnerships | 2889 | not measured | 2504 |
| Foundation | 7288 | not measured | 6461 |
| Journal | 900, horizontal | not measured | 844 |
| Inquiries | 1800 | not measured | 1603 |

Home at 1440 is a chain of pinned panes. The home stage section is 6750 tall for a 900 viewport, the quote and photos section 2124, partnerships 6480, then the foundation and the closing CTA. Evidence `data/walk-d1440-home.json` field `sections`.

### Radii, borders, shadows

- Pills are fully round. Sound toggle is a 40 circle. Inquiry cards have a small radius and a faint 1px border (radius value not measured). Trading cards have rounded corners with a gold frame baked into the image, the hover ring uses `rounded-[4%]`.
- Shadows are soft and dark. Card at rest `drop-shadow(0 8px 16px rgba(0,0,0,.28))`, on hover `drop-shadow(0 34px 50px rgba(0,0,0,.6))`.
- Pill hover shadow from the bundle is `0 12px 34px -12px` in the hover colour mixed at 55 or 60 percent.

## 4. Type

### Families

| Job | Face on the site | Licence | Free stand-in |
|---|---|---|---|
| Display caps | beachwood-variable via Typekit, axes wdth 50 to 75, wght 200 to 900, slnt | paid, Adobe Fonts | Saira (Google, has a wdth axis down to 50) at wdth 50, or Big Shoulders Display |
| Text and UI | ABC Diatype by Dinamo, Regular 400 and Heavy 800 (Heavy name read from the file, Regular file has no readable name, family inferred) | paid | Inter or Geist at 400 and 800 |
| Labels | ABC Diatype Mono Medium (declared 500, computed 400 falls back to it) | paid | Geist Mono or JetBrains Mono at 500 |
| Page titles | NuMono Free (name read from the OTF) | free, licence terms not checked | VT323 or Silkscreen for the pixel feel, or check NuMono Free's own licence |

Names come from `fontnames.mjs` reading `raw/fonts/` in place.

### Roles at 1440 (`--vu` 14.4)

| Role | Face | Size / LH | Weight, axes | Tracking | Colour | Phone 390 |
|---|---|---|---|---|---|---|
| Giant section word (Partnerships, Features) | display | 432.96 (30.07 vu) / .85 | 700, wdth 50 | -.03em | transparent, texture clipped | 114.39 |
| Moments word | display | 313.34 (21.76 vu) / .83 | 700, wdth 50 | -.03em | transparent, texture clipped | 79.95 (20.5 pu) |
| Section headline | display | 144 (10 vu) / .9 | 700, wdth 50 | -.02em | purple-deep on sand | 74.1 (19vw) |
| Quote | display | 136.8 (9.5 vu) / .92 | 700, wdth 50 | -.015em | taupe | 74.1 |
| Closing headline | display | 141.96 / .83 | 700, wdth 50 | -.01em | bone | 78 |
| Page lead headline | display | 129.6 (9 vu) / .98 | 700, wdth 50 | -.01em | bone with lavender words | not measured |
| Track numbers 10, 20, 30 | display | 129.6 / 1 | 300, wdth 50 | +.07em | bone | not shown |
| Stat numbers | display | 84 to 122.4 | 700 | -.01em | bone | not measured |
| Giant stat (8,815) | display | 892.8 (62 vu) / .78 | wght 500 axis | -.02em | bone | not measured |
| Menu links | display | 100.8 (7 vu) / .83 | 700, wdth 50 | -.01em | bone active, grey rest | 62.4 (16vw) |
| Header page title | display | 20 / .83 | 700, wdth 75 | -.01em | bone or ink | not measured |
| Page title (On-, Off) | pixel mono | 208.8 / .75, 247.68 | 400 | -.01em | bone | not measured |
| Card and panel heading | text | 20 / 21, 22 / 23.1, 37.44 / 39.3, 43.2 / 45.36 | 800 | -.015em | bone or ink-deep | 18 to 20 |
| Footer nav | text | 30.96 (2.15 vu) / 32.5 | 800 | -.015em | taupe-light, gold copy on hover | not measured |
| Hero side copy | text | 15.12 (1.05 vu) / 23.44 | 400 | .15px | ink-deep | 15 / 23.25 |
| Body | text | 14 / 20, 16 / 26, 17 / 28.9, 19 / 28.5 | 400 | .15px | bone at .55 to .92, or ink | 12.5 to 15 |
| Button label | text | 14 (sm), 24 (lg) | 800 | -.015em | ink-deep | 14 |
| Card title | mono | 13.68 (.95 vu) / 1.55 | Medium | .12em, caps | bone | 13 |
| Card stat line | mono | 11.23 (.78 vu) / 1.55 | Medium | .16em, caps | taupe | 11 |
| Legal | text | 12 / 19.5 | 400 | .15px | bone at .55 | 11 |
| Scroll hint (journal) | text | 10 / 15.5 | 400 | 1px, caps | bone at .4 | not measured |

Evidence `data/walk-*.json` field `type`, which also holds sample strings. Classes from the CSS: `.display` sets wdth 50, wght 700, tracking -.01em, line height .83 and caps. `.heading` sets Diatype 800, tracking -.015em, line height 1.05.

What it adds up to. One very narrow display face carries every headline at sizes that fill the width. A heavy grotesk does all short headings and buttons. A wide tracked mono does captions and stats. Lines sit at .78 to .92 so caps nearly touch.

## 5. Colour

Tokens from the CSS root, with where each showed up in captures.

| Token | Value | Use |
|---|---|---|
| ink | #0b0a0f | dark theme ground, menu on phone |
| ink-deep | #171220 | loader panel, wipe panel, desktop menu, text on light, pill label |
| smoke | #1e1a2a | dark surfaces, inquiry cards look like this (not measured on the card) |
| bone | #f4efe6 | text on dark, light pill |
| sand | #d3c8ba | light theme ground, foundation surface |
| taupe-light | #f0e4d4 | footer nav links |
| taupe | #b0a89d | quote, stat lines |
| taupe-deep | #746c62 | mono labels on sand |
| purple-deep | #2c1352 | headlines on sand |
| purple-ink | #1a0e30 | foundation headline, partnerships copy on sand |
| purple-rich | #4f2bab | dark pill hover fill |
| purple-fog | #563b80 | footer gradient stop |
| purple-shade | #251c34 | not seen in captures |
| purple-muted | #a9a1b5 | not seen in captures |
| lavender | #9e6de9 | accent words in headlines, CTA pill hover fill, signature |
| gold | #d4a24a | focus ring, text selection |
| gold-bright | #f2c766 | not seen in captures |
| cta-yellow | #eeac1a | CTA pill, gold copy in link hover |
| giant word fill | #6c4aa2 (rgb 108,74,162) | the purple layer under the leather texture in giant words, not a token |

Grounds. Every page sits on a fixed `bg-layers` stack. A base colour from the theme, a pebble leather texture (`textures/pebble.webp`, 480px tile) in multiply on dark or screen on light, soft-light light washes (`light-01`, `light-03`, `light-04`), a paper grain and a grass texture in places. On light sections two giant name wordmarks scroll behind everything as 55vh tall masks in soft-light, blurred 1px, on 90s linear marquees in opposite directions.

Themes. Sections carry `data-tone` light, dark or purple. Light sets ground sand, ink ink-deep, logo ink-deep, wash .45. Dark sets ground ink, ink bone. `body` colour moves on a 1s `cubic-bezier(.65,.05,.36,1)` transition. A footer progress variable `--fdp` mixes every surface towards ink-deep as the footer arrives. There is no prefers-color-scheme rule.

## 6. Components

### Header

- Fixed, 104 tall at 1440, 80 on phone, no bar and no background.
- Logo mark at 48, 28, 41 by 48 (24, 20, 34 by 40 on phone). It recolours with the theme on a .8s editorial curve (measured on phone). From the bundle it scales to 1.1 on hover, motion safe only.
- Centre title in the display face at 20px wdth 75. On home it reads the athlete's name, on inner pages the page name.
- Menu button 64 by 46 with 16 padding, two slanted bars that become an X.
- Sound toggle, fixed bottom right, 40 circle, 24 from both edges, black at .25 with eq bars that bounce on a .85s alternate loop when sound is on.

### Menu

- Full screen overlay, `#171220` on desktop, `#0b0a0f` with grain on phone. Fades opacity 0 to 1 in about 550ms (logged .026 at 127ms, .54 at 256, .99 at 508).
- Desktop links sit in two centred rows, four then three, in the display face at 100.8px. Phone stacks seven links centred at 62.4px. Active link is bone, the rest grey.
- Under the links, four social icons in 72 squares, then a bottom row of legal text at 12px.
- Escape closes it. The button sets aria-expanded and the panel uses inert while closed.

### Pill button

From the bundle, confirmed by `comp/d1440/cta-hover.jpg`.

- Fully round, Diatype 800 caps. The label measured -.015em tracking. Sizes sm 32 by 16 padding at 14px, md 48 by 18 at 18px, lg 80 by 32 at 24px. The lg pill measured 271 by 89.
- Variants. Light is bone on ink-deep text. Dark is ink-deep with bone text. CTA is cta-yellow. Secondary is clear with a 1px bone .45 inset ring.
- Hover. The pill grows to 1.12 (1.06 pressed) over 200ms `cubic-bezier(.4,0,.2,1)`. A domed fill (`border-radius 50% 50% 0 0 / 42% 42% 0 0`) rises from below in cta-yellow, purple-rich or lavender. The label shrinks to .82 on a 320ms back-out curve `cubic-bezier(.34,1.56,.64,1)`. A coloured glow appears under it.

### Nav link roll

Footer and menu links have two layers. On hover the base word lifts 2px and a cta-yellow copy wipes over it with a clip-path, both on .38s `cubic-bezier(.16,1,.3,1)`. Evidence `data/components-d1440.json` field `footerLinkHover`.

### Trading cards

- Gold framed player cards, 230 by about 338 at 1440, floating on a 7s ease-in-out loop of plus and minus 1.3 percent.
- Hover tilts the card in 3D toward the pointer, scales it to about 1.06, deepens the shadow, and turns on two sheen layers. A 102deg white band follows the pointer x in screen blend, and a violet to cyan tint sits on top in color dodge at .7. A white inset ring fades in. Measured `--hover` 0 to 1 and `--mxf` .20 then .80 as the pointer crossed. Evidence `data/interact-d1440.json` field `cardHover`, `motion/d1440/hover-card-a.jpg`.
- On home the cards ride a horizontal track over a field of yard numbers and tick rails, labelled in the wide mono.

### Giant textured words

Section names fill the width in the display face with transparent text. Two background layers are clipped to the glyphs, a flat #6c4aa2 fill and the pebble leather tile at 480px, so the letters read as purple football leather. The Moments word uses a 170px texture size. Evidence `data/components-d1440.json` field `giant`.

### Photo stacks and polaroids

Quote and foundation sections throw tilted white bordered photos over the headline, stacked and offset like prints on a table.

### Partnerships

A pinned pane with the giant word, one product cutout centred, a short copy block bottom left with a vertical dot index (8 by 8 dots, the active one a 34 tall bar), a light "View all" pill bottom right and a greyscale logo marquee along the bottom.

### Footer

A closing CTA scene. Signature mark, a two line headline in bone, an lg CTA pill and a player cutout on the right. On the left a dark rounded panel 16 from the edges holds the logo, seven nav links at 30.96px heavy, a small product image, social icons and two rows of legal text. The panel has a stepped notch on its right edge about halfway down (read from `comp/d1440/footer.jpg`, exact shape not measured).

### Journal

A horizontal carousel of object cutouts on a deep purple ground, one centred with a three line mono caption and a "drag, scroll, click" hint. One 300px wheel moved to the next item. Drag numbers were not measured, my selector missed the track.

### Inquiries

No form. Three dark cards with a mono "Details" label, a heavy title, a mono email address and a one line description. Nothing to submit.

### Cursor

No custom cursor. Cards use pointer. The body `data-cursor` attribute was empty in every capture.

## 7. Motion

### Curves from the bundle

| Name | Value | Use |
|---|---|---|
| editorial | cubic-bezier(.65,.05,.36,1) | wipes, theme colour changes |
| ui | cubic-bezier(.4,0,.2,1) | pills, small UI |
| cover | cubic-bezier(.85,0,.15,1) | not seen in a capture |
| reveal | cubic-bezier(.16,1,.3,1) | link roll, row reveals, card hover transitions |
| back-out | cubic-bezier(.34,1.56,.64,1) | pill label |

GSAP eases in use include power2.inOut, power2.out, power3.out and sine.inOut. ScrollTrigger defaults from the bundle are start top 80 percent, end bottom 60 percent, scrub .6.

### Loader (home only)

- Full screen ink-deep panel with the logo mark and a mono percent under it at 11 to 12px, tracking .2em, bone at .5.
- The logo fills from the bottom as progress rises. Progress is tied to the hero being ready (fonts plus hero media), not a timer. A retry state is set after 20s.
- At 1440 the percent sat at 0 from 246ms to about 4.3s while media downloaded, reached 34 percent by 4.87s, jumped to "completing" when the hero was ready at 5.5s, ran to 99 by 6.05s, hit 100 at 6.15s, waited 180ms, then the panel slid away 800ms on the editorial curve with a slanted left edge (the panel is 118vw wide with an 18vw clipped edge). Gone at 7.19s. On phone the same run finished in about 2.0s. On my first run the loader stayed at 0 percent for over 9s, a network stall. Evidence `data/interact-d1440.json` field `loader`, `data/interact-m390.json`, `sheets/load-d1440.jpg`.

### Hero intro after the loader

From the screencast (`sheets/load-d1440.jpg`, screencast clock, offsets approximate). The game clip plays full bleed, warms to an orange grade, then shrinks with a fisheye bulge into the sunglasses lens while the portrait resolves around it. Then header, card and copy fade in and the signature draws stroke by stroke over about a second. In the bundle the copy fades use 1.4s power2.out at 2.9 to 3.2s into the intro timeline, and the hero progress runs .4 over 1.2s sine.inOut then to 1 over 1.8s (2.1s on touch) power3.out.

### Hero WebGL portrait, from the bundle

Depth displacement of a flat portrait with a depth map. Displacement .165, mouse parallax intensity .12 with ease .025 per frame, pan .15, camera z 2.65 at fov 19, a slow breathing motion at speed .75. The lens shows the game video with fisheye 3.45, a CRT grille at .5, a mouse driven RGB split and an HSB grade. Live frame rate not measured.

### Scroll

- Lenis with lerp .16, wheel multiplier .72, touch multiplier 1.5, smooth wheel on, sync touch off, driven by the GSAP ticker with lag smoothing off. It is skipped on touch devices and with reduced motion.
- One 100px wheel tick at 1440 moved scrollY from 0 to 14 at 675ms, 60 at 882ms and 67 at 965ms, heading for 72. The late start came during heavy load, so treat the start time as an upper bound. Evidence `data/interact-d1440.json` field `wheel`.
- Phone uses native scroll.
- Home stage. A `--wipe` variable runs 0 to 1 over about 2045px of scroll (.073 at 150, .293 at 600, .587 at 1200). It scales the hero down to 1 minus .18 times wipe, origin bottom centre, and a dark panel with a slanted edge wipes across to reveal the Moments section. Evidence `data/interact-d1440.json` field `stage`, `motion/d1440/stage-*.jpg`.
- Sections pin with sticky 100svh panes and scrub with ScrollTrigger. Partnerships steps through brands inside its pin. Quote photos fly in over the headline.
- Reveal pattern from the bundle. Rows rise 26px and fade over .7s on the reveal curve. Text blocks fade up from 8px blur to sharp over .65s power3.out with .07s stagger.

### Route change

Clicking a menu link logged a dark ink-deep veil with a slanted edge sweeping left to right. The clip polygon went from 1.6 percent to 118 percent between 471ms and 873ms of the log, so about 400ms. The veil then holds with the logo centred until the new page is ready (3.2s on this run, network bound) and leaves. From the bundle the panel timings are 420, 560 and 220ms on the editorial curve, and inner pages run a short logo fill veil of at least 900ms. Evidence `data/transition-reduced.json` field `route`, `sheets/route-onfield-d1440.jpg`.

### Always on

| Loop | Value |
|---|---|
| Name marquees behind light sections | 90s linear, opposite directions |
| Card float | 7s ease-in-out, plus and minus 1.3 percent |
| Partner logo marquee | running, period not measured |
| Sound eq bars | .85s ease-in-out alternate |
| Scroll hint arrow | 1.8s bob of 5px |
| Footer panel float | running, period not measured |

15 animations were running on home at rest. Evidence `data/transition-reduced.json` field `normal`.

### Sound

UI sounds play on hover, click, slide and reveal. On desktop the site turns sound on at the first pointer press unless the visitor turned it off before. On touch it stays off unless the visitor turned it on. Every run here was muted.

## 8. What makes it recognisable

1. The football leather. Pebble texture on the grounds and clipped inside giant purple words.
2. One ultra narrow display face at sizes that fill the screen, set tight.
3. Gold framed trading cards that tilt and catch a holographic sheen.
4. The hero portrait with depth and a live game video reflected in the sunglasses.
5. Slanted 18 percent wipe panels for the loader exit, route changes and the hero handoff.
6. Purple, bone, sand and a single hot yellow CTA.
7. A drawn signature that writes itself.
8. Small UI sounds.

## 9. Accessibility notes

Good, keep these. Reduced motion is respected. With it on, 0 animations were running, Lenis did not start, no videos played, the loader fades in 150ms instead of wiping, and a wheel tick jumped straight to 100. There is a skip link. Focus rings are a 2px gold outline with a 3px offset on most controls. The menu uses inert and aria-expanded.

Gaps, do not copy.

- Four of the five home cards are `div role=button` stops whose computed outline was none while focused at 1440. Only the first card showed the ring.
- Partnership index dots are 8 by 8 buttons, far under a 24px target.
- Sound starts on the first click on desktop without asking.
- Stat captions at 11px in bone at .4 on ink measure 3.45 to 1, under 4.5. Bone at .45 is 4.08. The loader percent at .5 is 4.86.
- The giant purple word fill #6c4aa2 on ink is 2.95 to 1. It is decorative, but the words are the section names.
- The header logo sits on top of photos in the foundation section with no halo on the light theme.
- The home loader blocks the page until the hero media is ready. On a slow link it held at 0 percent for more than 9s.

Contrast that passes. Bone on ink-deep 16.03, taupe on ink 8.39, ink-deep on sand 11.14, purple-deep on sand 9.64, lavender on ink 5.47, ink-deep on cta-yellow 9.22.

## 10. Not measured

- Live WebGL frame rate and the exact intro timeline in page time.
- Card tilt spring or easing, and the final transform of the menu link roll beyond the 2px lift.
- Journal drag distance and inertia.
- Scroll numbers for the quote, partnerships and foundation pins, only the home stage `--wipe` was logged.
- Hover and menu motion at 1920. 1920 was walked and type was logged, interactions were not run there.
- Inner page lengths at 1920.
- Inquiry card radius and border colour, footer panel radius and notch geometry.
- Marquee periods for partner logos and the footer float.
- Sound file content and levels, all runs were muted.
- Journal ground colour as a value.

## 11. Caveats

- The machine was under load and the network was slow at times, so load timings vary by run. Ready times ranged from 3.0s to 14.3s.
- Pill hover computed values were read mid transition and froze at scale 1.028, so the final pill state comes from the bundle values and the frame, not from computed style.
- No independent re-measure pass was run.
