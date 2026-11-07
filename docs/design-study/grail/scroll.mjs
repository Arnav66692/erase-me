// Lenis wheel response, dock position and theme by scroll, hero field frames by scroll. node scroll.mjs d1440|m390
import { launch, open, VP, SITE, wait, save, shot, rejectCookies } from './lib.mjs';
const key = process.argv[2] || 'd1440'; const vp = VP[key];
const b = await launch();
const out = {};
try {
  const { page } = await open(b, vp);
  await page.goto(SITE, { waitUntil: 'load', timeout: 60000 }); await wait(6000); await rejectCookies(page);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  if (!vp.mobile) {
    await page.mouse.move(720, 450);
    const rec = (ms) => page.evaluate((ms) => new Promise((res) => { const L = []; const t0 = performance.now(); const f = () => { L.push([Math.round(performance.now() - t0), +scrollY.toFixed(1)]); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(L); }; requestAnimationFrame(f); }), ms);
    const p1 = rec(1800); await wait(50); await page.mouse.wheel(0, 100); out.tick100 = await p1;
    await wait(500);
    const p2 = rec(2200); await wait(50); for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 100); await wait(16); } out.burst500 = await p2;
    await page.evaluate(() => scrollTo(0, 0)); await wait(1500);
  }
  // dock and fixed layers by scroll
  out.dock = [];
  for (let y = 0; y <= H - vp.h; y += 300) {
    await page.evaluate((v) => scrollTo(0, v), y); await wait(900);
    out.dock.push(await page.evaluate(() => {
      const g = (s) => document.querySelector(`[class*="${s}"]`);
      const p = g('_waitPill_'); const cs = getComputedStyle(p); const r = p.getBoundingClientRect();
      const btn = g('_pillBtn_'); const bs = getComputedStyle(btn); const mk = g('_pillMark_'); const ms = mk ? getComputedStyle(mk) : null;
      const S = (e) => e ? getComputedStyle(e) : { opacity: 'absent', transform: '', visibility: '', filter: '' };
      const ss = S(g('_scene_')); const cks = S(g('_clock_')); const phs = S(g('_phone_')); const as = S(g('_acceptBg_'));
      return { sy: Math.round(scrollY), dock: [Math.round(r.x), Math.round(r.y), Math.round(r.width), cs.opacity, cs.translate, cs.scale, cs.backgroundColor, cs.borderTopColor, bs.color, bs.backgroundColor, ms ? ms.backgroundColor : '', p.getAttribute('class').replace(/_[a-z0-9]{5}_\d+/g, '')], scene: [ss.opacity, ss.transform.slice(0, 50), ss.visibility], clock: [cks.opacity, cks.transform.slice(0, 50), cks.visibility], phone: [phs.opacity, phs.filter, phs.transform.slice(0, 40)], accept: [as.opacity, as.visibility] };
    }));
  }
  // hero field by scroll
  for (const y of [0, 150, 300, 450, 600, 750, 900, 1200, 1500, 1800, 2100]) { await page.evaluate((v) => scrollTo(0, v), y); await wait(1400); await shot(page, `field/${key}/y${String(y).padStart(4, '0')}`); }
  save(`scroll-${key}`, out);
  if (out.tick100) { console.log('tick', JSON.stringify(out.tick100.filter((_, i) => i % 3 === 0))); console.log('burst', JSON.stringify(out.burst500.filter((_, i) => i % 4 === 0))); }
  for (const d of out.dock) console.log(d.sy, JSON.stringify(d.dock), 'scene', d.scene[0], 'clock', d.clock[0], 'phone', d.phone[0], d.phone[1], 'acc', d.accept[0]);
} finally { await b.close(); process.exit(0); }
