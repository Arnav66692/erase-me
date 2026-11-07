// Scroll walk: frame plus state log per step. node walk.mjs d1440|d1920|m390 [stepFrac]
import { launch, open, VP, SITE, HOOK, wait, save, shot, rejectCookies, diskFreeMB } from './lib.mjs';
const key = process.argv[2] || 'd1440'; const frac = +(process.argv[3] || 0.5);
const vp = VP[key];
console.log('disk MB', diskFreeMB());
const b = await launch();
try {
  const { page, logs } = await open(b, vp);
  await page.addInitScript(HOOK);
  await page.goto(SITE, { waitUntil: 'load', timeout: 60000 }); await wait(5000);
  const cookie = await rejectCookies(page);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  const steps = [];
  const watch = ['_scene', '_headline', '_nav', '_scrim', '_clock', '_phone', '_acceptBg', '_forgeFixed', '_acceptOverlay', '_section2', '_s2line', '_section5', '_peelInner', '_totemPin', '_statsPin', '_guildsWrap', '_footPin', '_inkReveal', '_s4word', '_s5row', '_sheetClip'];
  let i = 0;
  for (let y = 0; y <= H - vp.h + 1; y += Math.round(vp.h * frac)) {
    await page.evaluate((v) => window.scrollTo(0, v), y); await wait(1300);
    const st = await page.evaluate((watch) => {
      const o = { sy: Math.round(scrollY) };
      for (const w of watch) {
        const el = [...document.querySelectorAll(`[class*="${w}"]`)].find((e) => [...e.classList].some((c) => c.startsWith(w + '_') || c === w));
        if (!el) continue; const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        o[w] = { r: [r.x, r.y, r.width, r.height].map(Math.round), op: cs.opacity, tf: cs.transform === 'none' ? '' : cs.transform.slice(0, 90), vis: cs.visibility, cp: cs.clipPath === 'none' ? '' : cs.clipPath.slice(0, 60), bg: cs.backgroundColor, f: cs.filter === 'none' ? '' : cs.filter };
      }
      o.htmlClass = document.documentElement.className; o.bodyBg = getComputedStyle(document.body).backgroundColor;
      return o;
    }, watch);
    steps.push(st);
    await shot(page, `walk/${key}/s${String(i).padStart(2, '0')}-y${y}`);
    i++;
  }
  const study = await page.evaluate(() => ({ raf: window.__study.raf, ctx: window.__study.ctx.length }));
  save(`walk-${key}`, { H, cookie, steps, logs, study });
  console.log('H', H, 'steps', steps.length, 'cookie', cookie, 'logs', logs.length, 'disk', diskFreeMB());
} finally { await b.close(); process.exit(0); }
