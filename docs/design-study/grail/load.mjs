// Load and entrance: screencast plus per-frame DOM log of loader, headline letters, nav, scene. node load.mjs d1440|m390
import { launch, open, VP, SITE, HOOK, wait, save, screencast, rejectCookies } from './lib.mjs';
const key = process.argv[2] || 'd1440';
const b = await launch();
try {
  const { page, logs } = await open(b, VP[key]);
  await page.addInitScript(HOOK);
  await page.addInitScript(() => {
    const L = window.__frames = []; const t0 = performance.now();
    const q = (s) => [...document.querySelectorAll(`[class*="${s}"]`)];
    const tick = () => {
      const f = { t: Math.round(performance.now() - t0) };
      const loader = q('loader')[0] || q('Loader')[0];
      if (loader) { const cs = getComputedStyle(loader); f.loader = [cs.opacity, cs.transform.slice(0, 50), cs.clipPath.slice(0, 50), loader.getAttribute('class').slice(0, 40)]; }
      const L0 = q('_letter_')[0], L1 = q('_letter_')[7], L2 = q('_letter_')[14];
      for (const [n, el] of [['l0', L0], ['l7', L1], ['l14', L2]]) if (el) { const cs = getComputedStyle(el); f[n] = [cs.opacity, cs.transform.slice(0, 60), cs.filter]; }
      const nav = q('_nav_')[0]; if (nav) f.nav = getComputedStyle(nav).opacity;
      const tag = q('_tagline_')[0]; if (tag) { const cs = getComputedStyle(tag); f.tag = [cs.opacity, cs.transform.slice(0, 40)]; }
      const cta = q('_cta_')[0]; if (cta) { const cs = getComputedStyle(cta); f.cta = [cs.opacity, cs.transform.slice(0, 40)]; }
      const sc = q('_scene_')[0]; if (sc) { const cs = getComputedStyle(sc); f.scene = [cs.opacity, cs.transform.slice(0, 40)]; }
      L.push(f); if (L.length < 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const sc = await screencast(page, `load/${key}`, { every: 2 });
  const t0 = Date.now();
  await page.goto(SITE, { waitUntil: 'commit', timeout: 60000 });
  await wait(7000);
  await sc.stop();
  const frames = await page.evaluate(() => window.__frames);
  const cookie = await rejectCookies(page);
  const loaderDom = await page.evaluate(() => [...document.querySelectorAll('[class*="oader"]')].map((e) => e.getAttribute('class')));
  save(`load-${key}`, { frames, cookie, loaderDom, nframes: sc.frames.length, logs });
  console.log('frames', sc.frames.length, 'log', frames.length, 'loaderDom', loaderDom, 'wall', Date.now() - t0);
} finally { await b.close(); process.exit(0); }
