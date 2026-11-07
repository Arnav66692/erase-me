// Component measurements at 1440: giant textured words, footer panel, pills, header per page, journal drag, inquiries form styling (nothing typed or submitted).
import { launch, open, VP, SITE, wait, shot, save, HOOK, guardDisk, waitReady } from './lib.mjs';
const key = process.argv[2] || 'd1440';
const vp = VP[key];
guardDisk();
const browser = await launch();
const out = {};
const go = async (page, p) => { await page.goto(SITE.replace(/\/$/, '') + p, { waitUntil: 'domcontentloaded', timeout: 60000 }); const r = await waitReady(page); await wait(2500); return r; };
const ST = ([sel2, all]) => { const f = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { tag: e.tagName, t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), r: [r.x, r.y, r.width, r.height].map(Math.round), font: cs.fontFamily.split(',')[0], fs: cs.fontSize, lh: cs.lineHeight, fw: cs.fontWeight, fvs: cs.fontVariationSettings, ls: cs.letterSpacing, tt: cs.textTransform, color: cs.color, bg: cs.backgroundColor, bgImg: cs.backgroundImage.slice(0, 120), clip: cs.webkitBackgroundClip || cs.backgroundClip, bgSize: cs.backgroundSize, radius: cs.borderRadius, border: cs.border, shadow: cs.boxShadow.slice(0, 120), pad: cs.padding, blend: cs.mixBlendMode, filter: cs.filter.slice(0, 80), cursor: cs.cursor, transition: cs.transition.slice(0, 160) }; }; const els = [...document.querySelectorAll(sel2)]; return all ? els.slice(0, 20).map(f) : (els[0] ? f(els[0]) : null); };
try {
  const { page, logs } = await open(browser, vp);
  await page.addInitScript(HOOK);
  // home: header, giant words, pills, footer panel
  out.homeReady = await go(page, '/');
  out.header = {
    logo: await page.evaluate(ST, ['[data-nav-logo]', false]), logoSvg: await page.evaluate(ST, ['[data-nav-logo] svg', false]),
    menuBtn: await page.evaluate(ST, ['button[aria-controls="site-navigation"]', false]), title: await page.evaluate(ST, ['header h1, h1', false]), sound: await page.evaluate(ST, ['[data-sound-toggle]', false]),
  };
  out.giant = await page.evaluate(ST, ['h2.display, h2', true]);
  // scroll to footer
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.mouse.wheel(0, 30000); await wait(3500);
  out.footer = {
    panel: await page.evaluate(() => { const n = document.querySelector('nav[aria-label="Footer"]'); let p = n; for (let i = 0; i < 6 && p; i++) { const cs = getComputedStyle(p); if (cs.borderRadius !== '0px' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') break; p = p.parentElement; } if (!p) return null; const r = p.getBoundingClientRect(); const cs = getComputedStyle(p); return { r: [r.x, r.y, r.width, r.height].map(Math.round), bg: cs.backgroundColor, bgImg: cs.backgroundImage.slice(0, 120), radius: cs.borderRadius, clip: cs.clipPath.slice(0, 200), shadow: cs.boxShadow.slice(0, 120), backdrop: cs.backdropFilter }; }),
    links: await page.evaluate(ST, ['nav[aria-label="Footer"] a', true]),
    cta: await page.evaluate(ST, ['a.rounded-full[href="/on-field"]', false]),
    social: await page.evaluate(ST, ['a[href*="instagram"], a[href*="tiktok"], a[href*="x.com"]', true]),
    headline: await page.evaluate(ST, ['[data-footer-center] span, [data-footer-center] h2', false]),
    small: await page.evaluate(ST, ['footer span, footer a', true]),
  };
  await shot(page, `comp/${key}/footer`);
  // footer link hover
  const fl = await page.$('nav[aria-label="Footer"] a:nth-child(2)');
  if (fl) { const b = await fl.boundingBox(); await page.mouse.move(b.x + 10, b.y + b.height / 2); await wait(600); out.footerLinkHover = await fl.evaluate((a) => [...a.querySelectorAll('span')].map((s) => { const cs = getComputedStyle(s); return [cs.color, cs.transform, cs.opacity, cs.transition.slice(0, 150)]; })); await shot(page, `comp/${key}/footer-link-hover`); }
  // CTA pill hover
  const cta = await page.$('a.rounded-full[href="/on-field"]');
  if (cta) { const b = await cta.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await wait(120); const mid = await cta.evaluate((e) => [getComputedStyle(e).scale, getComputedStyle(e.children[0]).translate, getComputedStyle(e.children[1]).scale]); await wait(600); const end = await cta.evaluate((e) => [getComputedStyle(e).scale, getComputedStyle(e.children[0]).translate, getComputedStyle(e.children[1]).scale, getComputedStyle(e).boxShadow, getComputedStyle(e.children[1]).color]); out.ctaHover = { mid, end }; await shot(page, `comp/${key}/cta-hover`); await page.mouse.move(5, 5); }
  // journal drag
  out.journalReady = await go(page, '/journal');
  out.journal = { hint: await page.evaluate(ST, ['p, span', true]), body: await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, cursor: document.body.getAttribute('data-cursor') })) };
  const tr = () => page.evaluate(() => [...document.querySelectorAll('a[href*="item="], [data-journal-item], li')].slice(0, 3).map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.x); }));
  out.journal.x0 = await tr();
  await page.mouse.move(900, 450); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(900 - i * 40, 450); await wait(16); } await page.mouse.up();
  const drag = []; for (let i = 0; i < 12; i++) { drag.push(await tr()); await wait(100); }
  out.journal.drag = drag; await shot(page, `comp/${key}/journal-drag`);
  await page.mouse.wheel(0, 300); await wait(1200); out.journal.afterWheel = await tr(); await shot(page, `comp/${key}/journal-wheel`);
  // inquiries form styling, read only
  out.inqReady = await go(page, '/inquiries');
  out.inquiries = { inputs: await page.evaluate(ST, ['input, textarea, select', true]), labels: await page.evaluate(ST, ['label', true]), buttons: await page.evaluate(ST, ['button[type=submit], form button', true]) };
  await shot(page, `comp/${key}/inquiries`);
  const inp = await page.$('input[type=text], input:not([type]), input[type=email]');
  if (inp) { await inp.focus(); await wait(400); out.inquiries.focus = await inp.evaluate((e) => { const cs = getComputedStyle(e); return { outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, border: cs.border, borderBottom: cs.borderBottom, shadow: cs.boxShadow, bg: cs.backgroundColor }; }); await shot(page, `comp/${key}/inquiries-focus`); }
  out.logs = logs;
  save(`components-${key}`, out);
  console.log(JSON.stringify(out).slice(0, 12000));
} finally { await browser.close(); }
