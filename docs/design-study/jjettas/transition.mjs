// Route change from home to /on-field through the menu, screencast plus clip-path log. Then reduced-motion load.
import { launch, open, VP, SITE, wait, shot, save, screencast, HOOK, guardDisk, waitReady } from './lib.mjs';
guardDisk();
const browser = await launch();
const out = {};
try {
  { // transition
    const { page, logs } = await open(browser, VP.d1440);
    await page.addInitScript(HOOK);
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    out.ready = await waitReady(page); await wait(2500);
    await page.click('button[aria-controls="site-navigation"]'); await wait(1200);
    const sc = await screencast(page, 'motion/d1440/route-onfield', { every: 1, maxW: 720, maxH: 450 });
    const log = page.evaluate(() => new Promise((res) => { const L = []; const t0 = performance.now(); const f = () => { const v = document.querySelector('[data-page-veil]'); const w = [...document.querySelectorAll('.jj-wipe-panel')].map((p) => { const par = p.parentElement; const cs = getComputedStyle(par); return [cs.opacity, cs.visibility[0], (par.style.clipPath || getComputedStyle(p).clipPath || '').slice(0, 60), p.style.translate || getComputedStyle(p).translate]; }); L.push([Math.round(performance.now() - t0), location.pathname, !!v, JSON.stringify(w).slice(0, 220)]); if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(L); }; requestAnimationFrame(f); }));
    await page.click('#site-navigation a[href="/on-field"]');
    out.route = await log;
    await sc.stop();
    out.routeReady = await waitReady(page);
    await wait(2000);
    await shot(page, 'motion/d1440/route-onfield-landed');
    out.logs = logs;
    await page.context().close();
  }
  { // reduced motion
    const vp = { ...VP.d1440, reduce: true };
    const { page, logs } = await open(browser, vp);
    await page.addInitScript(HOOK);
    const t0 = Date.now();
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    out.reducedReady = await waitReady(page); out.reducedReadyWall = Date.now() - t0;
    await wait(3000);
    await shot(page, 'motion/d1440/reduced-hero');
    out.reduced = await page.evaluate(() => {
      const anims = document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a.animationName || a.constructor.name) + ' ' + (a.effect && a.effect.target ? a.effect.target.className.toString().slice(0, 40) : ''));
      return { running: anims.length, sample: anims.slice(0, 12), lenis: document.documentElement.className.includes('lenis'), ctx: window.__study.ctx.length, videosPlaying: [...document.querySelectorAll('video')].filter((v) => !v.paused).length };
    });
    const wl = page.evaluate(() => new Promise((res) => { const L = []; const t0 = performance.now(); const f = () => { L.push([Math.round(performance.now() - t0), Math.round(scrollY)]); if (performance.now() - t0 < 1200) requestAnimationFrame(f); else res(L); }; requestAnimationFrame(f); }));
    await page.mouse.move(720, 450); await page.mouse.wheel(0, 100);
    out.reducedWheel = await wl;
    await page.context().close();
  }
  { // normal motion running animations for comparison
    const { page } = await open(browser, VP.d1440);
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitReady(page); await wait(3000);
    out.normal = await page.evaluate(() => { const anims = document.getAnimations().filter((a) => a.playState === 'running'); return { running: anims.length, sample: anims.slice(0, 12).map((a) => (a.animationName || a.constructor.name) + ' ' + (a.effect && a.effect.target ? a.effect.target.className.toString().slice(0, 40) : '')), videosPlaying: [...document.querySelectorAll('video')].filter((v) => !v.paused).length }; });
    await page.context().close();
  }
  save('transition-reduced', out);
  console.log(JSON.stringify({ ready: out.ready, route: out.route.filter((_, i) => i % 4 === 0).slice(0, 60), routeReady: out.routeReady, reducedReady: out.reducedReady, reduced: out.reduced, reducedWheel: out.reducedWheel.filter((_, i) => i % 5 === 0), normal: out.normal }).slice(0, 7000));
} finally { await browser.close(); }
