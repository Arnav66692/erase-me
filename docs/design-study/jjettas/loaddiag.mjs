// Why does the home loader stick at 0%? Log loader dataset, videos and WebGL each second.
import { launch, open, VP, SITE, wait, save, HOOK } from './lib.mjs';
const key = process.argv[2] || 'd1440';
const headed = process.argv[3] === 'headed';
const browser = headed ? await (await import('./lib.mjs')).launchHeaded() : await launch();
try {
  const { page, logs } = await open(browser, VP[key]);
  await page.addInitScript(HOOK);
  page.on('console', (m) => logs.push(m.type() + ' ' + m.text().slice(0, 160)));
  const reqs = [];
  page.on('requestfailed', (r) => reqs.push('FAIL ' + r.url().slice(0, 120) + ' ' + (r.failure() || {}).errorText));
  page.on('response', (r) => { const u = r.url(); if (/\.(mp4|webm|m3u8|glb|gltf|json|mp3|m4a)(\?|$)/.test(u)) reqs.push(r.status() + ' ' + u.slice(0, 140)); });
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const series = [];
  for (let i = 0; i < 24; i++) {
    await wait(1000);
    series.push(await page.evaluate(() => {
      const l = document.querySelector('[data-home-loader]');
      const v = [...document.querySelectorAll('video')].map((x) => ({ src: (x.currentSrc || x.src || '').slice(-60), rs: x.readyState, ns: x.networkState, paused: x.paused, err: x.error && x.error.code, w: x.videoWidth }));
      return { t: Math.round(performance.now()), phase: l && l.dataset.loaderPhase, hero: l && l.dataset.heroLoad, retry: l && l.getAttribute('data-loader-retry'), pct: l && l.innerText.trim(), v, vis: document.visibilityState, ctx: (window.__study || {}).ctx.length };
    }));
  }
  save(`loaddiag-${key}${headed ? '-headed' : ''}`, { series, logs, reqs });
  console.log(JSON.stringify(series.filter((_, i) => i % 3 === 0 || i === series.length - 1)).slice(0, 3000));
  console.log(JSON.stringify(reqs).slice(0, 1500)); console.log(JSON.stringify(logs).slice(0, 1500));
} finally { await browser.close(); }
