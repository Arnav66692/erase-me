// Home at 1440 (or given vp): loader timeline, entrance, wheel response, header, menu, hovers, cursor, focus.
import { launch, open, VP, SITE, wait, shot, save, screencast, HOOK, guardDisk, waitReady } from './lib.mjs';
const key = process.argv[2] || 'd1440';
const vp = VP[key];
guardDisk();
const browser = await launch();
const out = { key };
const box = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10); }, sel);
try {
  const { page, logs } = await open(browser, vp);
  await page.addInitScript(HOOK);
  await page.addInitScript(() => {
    const L = window.__loader = [];
    const t0 = performance.now();
    const mo = new MutationObserver(() => {
      const l = document.querySelector('[data-home-loader]');
      const rec = l ? { ph: l.dataset.loaderPhase, hero: l.dataset.heroLoad, pct: (l.innerText || '').trim() } : { gone: true };
      const k = JSON.stringify(rec);
      if (!L.length || L[L.length - 1].k !== k) L.push({ t: Math.round(performance.now() - t0), k, ...rec });
    });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.documentElement, { subtree: true, attributes: true, childList: true, characterData: true }));
  });
  // 1. loader and entrance
  const sc = await screencast(page, `motion/${key}/load`, { every: 1, maxW: 720, maxH: 450 });
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  out.ready = await waitReady(page);
  await wait(4000);
  await sc.stop();
  out.loader = await page.evaluate(() => window.__loader.map(({ k, ...r }) => r));
  out.loadFrames = sc.frames.length;
  // loader geometry from CSS is static, hero state now
  out.hero = await page.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { r: [r.x, r.y, r.width, r.height].map(Math.round), font: cs.fontFamily.split(',')[0], fs: cs.fontSize, fw: cs.fontWeight, color: cs.color, bg: cs.backgroundColor, radius: cs.borderRadius, shadow: cs.boxShadow.slice(0, 120), transition: cs.transition.slice(0, 200) }; };
    return { header: q('header'), logo: q('[data-nav-logo]'), logoSvg: q('[data-nav-logo] svg'), menuBtn: q('button[aria-controls="site-navigation"]'), h1: q('h1'), sound: q('[data-sound-toggle]'), soundAria: document.querySelector('[data-sound-toggle]')?.getAttribute('aria-label'), canvases: [...document.querySelectorAll('canvas')].map((c) => ({ w: c.width, h: c.height, cls: String(c.className).slice(0, 60) })), ctx: window.__study.ctx, audioCtx: window.__study.audio };
  });
  await shot(page, `motion/${key}/hero-rest`);
  // 2. wheel response, Lenis smoothing
  const wheelLog = page.evaluate(() => new Promise((res) => { const L = []; const t0 = performance.now(); const f = () => { L.push([Math.round(performance.now() - t0), Math.round(scrollY * 10) / 10]); if (performance.now() - t0 < 1800) requestAnimationFrame(f); else res(L); }; requestAnimationFrame(f); }));
  await wait(100); await page.mouse.move(720, 450); await page.mouse.wheel(0, 100);
  out.wheel = await wheelLog;
  await wait(500);
  // 3. scroll-linked hero to moments: frames at fixed scroll offsets through the pinned stage
  out.stage = [];
  for (const y of [0, 150, 300, 450, 600, 900, 1200]) {
    let cur = await page.evaluate(() => scrollY);
    for (let k = 0; k < 6 && Math.abs(y - cur) > 8; k++) { await page.mouse.wheel(0, (y - cur) / 0.72); await wait(700); cur = await page.evaluate(() => scrollY); }
    await wait(500);
    const st = await page.evaluate(() => ({ y: Math.round(scrollY), wipe: getComputedStyle(document.documentElement).getPropertyValue('--wipe') || [...document.querySelectorAll('[style*="--wipe"]')].map((e) => e.style.getPropertyValue('--wipe'))[0], fdp: getComputedStyle(document.documentElement).getPropertyValue('--fdp') }));
    out.stage.push(st);
    await shot(page, `motion/${key}/stage-y${String(st.y).padStart(5, '0')}`);
  }
  await page.evaluate(() => scrollTo(0, 0)); await page.mouse.wheel(0, -5000); await wait(1500);
  // 4. menu open and close
  if (await page.$('button[aria-controls="site-navigation"]')) {
    const msc = await screencast(page, `motion/${key}/menu-open`, { every: 1, maxW: 720, maxH: 450 });
    const mlog = page.evaluate(() => new Promise((res) => { const n = document.getElementById('site-navigation'); const L = []; const t0 = performance.now(); const f = () => { const cs = getComputedStyle(n); L.push([Math.round(performance.now() - t0), +(+cs.opacity).toFixed(3), cs.visibility[0]]); if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(L); }; requestAnimationFrame(f); }));
    await page.click('button[aria-controls="site-navigation"]');
    out.menuOpacity = await mlog;
    await msc.stop();
    await shot(page, `motion/${key}/menu-open-rest`);
    out.menu = await page.evaluate(() => {
      const n = document.getElementById('site-navigation');
      const items = [...n.querySelectorAll('a,button')].map((a) => { const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); const s = a.querySelector('span') || a; const ss = getComputedStyle(s); return { t: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 20), r: [r.x, r.y, r.width, r.height].map(Math.round), font: ss.fontFamily.split(',')[0], fs: ss.fontSize, lh: ss.lineHeight, fw: ss.fontWeight, ls: ss.letterSpacing, color: ss.color, tt: ss.textTransform }; });
      return { bg: getComputedStyle(n).backgroundColor, items, aria: { hidden: n.getAttribute('aria-hidden'), inert: n.inert }, btn: document.querySelector('button[aria-controls="site-navigation"]').getAttribute('aria-expanded') };
    });
    // hover a menu link
    const link = await page.$('#site-navigation nav a');
    if (link) {
      const before = await link.evaluate((a) => [...a.querySelectorAll('span')].map((s) => { const cs = getComputedStyle(s); return [cs.color, cs.transform, cs.opacity, cs.transition.slice(0, 160)]; }));
      const lb = await link.boundingBox(); await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2); await wait(700);
      const after = await link.evaluate((a) => [...a.querySelectorAll('span')].map((s) => { const cs = getComputedStyle(s); return [cs.color, cs.transform, cs.opacity]; }));
      out.menuHover = { before, after };
      await shot(page, `motion/${key}/menu-hover`);
    }
    await page.keyboard.press('Escape'); await wait(900);
    out.menuAfterEsc = await page.evaluate(() => getComputedStyle(document.getElementById('site-navigation')).opacity);
    if (out.menuAfterEsc !== '0') { await page.click('button[aria-controls="site-navigation"]').catch(() => {}); await wait(900); }
  }
  // 5. hover on a moments card and the View all pill, with transition logging
  const hov = async (sel, name) => {
    const el = await page.$(sel); if (!el) return { missing: sel };
    await el.scrollIntoViewIfNeeded().catch(() => {}); await wait(1200);
    const b = await el.boundingBox(); if (!b) return { nobox: sel };
    const read = () => el.evaluate((e) => { const cs = getComputedStyle(e); return { t: cs.transform, sc: cs.scale, bg: cs.backgroundColor, c: cs.color, sh: cs.boxShadow.slice(0, 100), hover: e.style.getPropertyValue('--hover') || getComputedStyle(e).getPropertyValue('--hover'), tr: cs.transition.slice(0, 220) }; });
    const before = await read();
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3); await wait(80);
    const mid = await read();
    await wait(700);
    const after = await read();
    await shot(page, `motion/${key}/hover-${name}`);
    await page.mouse.move(5, vp.h - 5); await wait(700);
    return { b: [b.x, b.y, b.width, b.height].map(Math.round), before, mid, after };
  };
  out.hoverPill = await hov('a[href="/partnerships"].rounded-full, a.rounded-full[href="/partnerships"], a[href="/partnerships"]', 'pill');
  await page.evaluate(() => scrollTo(0, 0)); await page.mouse.wheel(0, -9000); await wait(1200);
  for (const y of [1650, 2200]) { await page.mouse.wheel(0, 550); await wait(900); }
  await wait(1200);
  const card = await page.evaluateHandle(() => [...document.querySelectorAll('[role=button][aria-label^="Open "]')].find((e) => { const r = e.getBoundingClientRect(); return r.left > 100 && r.right < innerWidth - 100 && r.top > 0 && r.bottom < innerHeight; }) || null);
  if (card && (await card.evaluate((e) => !!e))) {
    const b = await card.boundingBox();
    const read = () => card.evaluate((e) => { const all = [e, ...e.querySelectorAll('*')].slice(0, 6); return all.map((x) => { const cs = getComputedStyle(x); return [x.tagName, cs.transform.slice(0, 80), cs.getPropertyValue('--hover'), cs.getPropertyValue('--mxf'), cs.filter.slice(0, 60)]; }); });
    const before = await read();
    await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.2); await wait(600);
    const after = await read();
    await shot(page, `motion/${key}/hover-card-a`);
    await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.8, { steps: 8 }); await wait(600);
    const after2 = await read();
    await shot(page, `motion/${key}/hover-card-b`);
    out.cardHover = { b: [b.x, b.y, b.width, b.height].map(Math.round), before, after, after2, cursor: await page.evaluate(() => ({ data: document.body.getAttribute('data-cursor'), css: getComputedStyle(document.querySelector('[role=button][aria-label^="Open "]')).cursor })) };
    await page.mouse.move(5, vp.h - 5); await wait(500);
  }
  out.cursor = await page.evaluate(() => ({ data: document.body.getAttribute('data-cursor'), css: getComputedStyle(document.body).cursor }));
  // 6. focus ring on first tab stops
  await page.evaluate(() => scrollTo(0, 0)); await wait(800);
  out.focus = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab'); await wait(250);
    out.focus.push(await page.evaluate(() => { const e = document.activeElement; if (!e) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { tag: e.tagName, t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24), r: [r.x, r.y, r.width, r.height].map(Math.round), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} off ${cs.outlineOffset}`, shadow: cs.boxShadow.slice(0, 80), fv: e.matches(':focus-visible') }; }));
    if (i === 0 || i === 2) await shot(page, `motion/${key}/focus-${i}`);
  }
  out.logs = logs;
  save(`interact-${key}`, out);
  console.log(JSON.stringify({ ready: out.ready, loader: out.loader.slice(0, 30), hero: out.hero, wheel: out.wheel.filter((_, i) => i % 6 === 0), stage: out.stage, menuOpacity: (out.menuOpacity || []).filter((_, i) => i % 5 === 0), menu: out.menu, menuHover: out.menuHover, esc: out.menuAfterEsc, pill: out.hoverPill, card: out.cardHover, cursor: out.cursor, focus: out.focus }).slice(0, 9000));
} finally { await browser.close(); }
