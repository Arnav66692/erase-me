// prefers-reduced-motion: reduce. Does the loader, letter rise, Lenis, idle drift still run? node reduced.mjs
import { launch, open, VP, SITE, HOOK, wait, save, shot } from './lib.mjs';
const b = await launch();
try {
  const { page } = await open(b, VP.d1440, { reducedMotion: 'reduce' });
  await page.addInitScript(HOOK);
  await page.addInitScript(() => { const L = window.__rm = []; const t0 = performance.now(); const f = () => { const l = document.querySelector('[class*="_letter_"]'); if (l) L.push([Math.round(performance.now() - t0), getComputedStyle(l).opacity, getComputedStyle(l).transform.slice(0, 40)]); if (L.length < 400) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await page.goto(SITE, { waitUntil: 'commit', timeout: 60000 });
  await wait(900); await shot(page, 'reduced/t0900'); await wait(1300); await shot(page, 'reduced/t2200');
  await wait(4000); await shot(page, 'reduced/t6200');
  const ana = await b.newPage();
  const png = async () => (await page.screenshot({ type: 'png' })).toString('base64');
  const A = await png(); await wait(1000); const B = await png();
  const idle = await ana.evaluate(async ({ a, b2 }) => { const load = async (s) => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; }; const P = await load(a), Q = await load(b2); let n = 0, t = 0; for (let i = 0; i < P.length; i += 16) { t++; if (Math.abs(P[i] - Q[i]) + Math.abs(P[i + 1] - Q[i + 1]) > 30) n++; } return +(n / t * 100).toFixed(2); }, { a: A, b2: B });
  await page.mouse.move(720, 450);
  const rec = page.evaluate(() => new Promise((res) => { const L = []; const t0 = performance.now(); const f = () => { L.push([Math.round(performance.now() - t0), Math.round(scrollY)]); if (performance.now() - t0 < 1200) requestAnimationFrame(f); else res(L); }; requestAnimationFrame(f); }));
  await wait(40); await page.mouse.wheel(0, 100); const wheel = await rec;
  const st = await page.evaluate(() => ({ htmlCls: document.documentElement.className, anims: document.getAnimations().filter((a) => a.playState === 'running').length, ctx: window.__study.ctx.length }));
  await page.evaluate(() => scrollTo(0, 2250)); await wait(2000); await shot(page, 'reduced/y2250');
  const rm = await page.evaluate(() => window.__rm);
  const firstVisible = rm.find((r) => r[1] !== '0');
  save('reduced', { idle, wheel, st, rmHead: rm.slice(0, 5), firstVisible, rmLen: rm.length, moving: rm.filter((r) => r[2] !== 'none' && !/0, 0\)$/.test(r[2])).length });
  console.log(JSON.stringify({ idle, wheel: wheel.filter((_, i) => i % 6 === 0), st, firstVisible, moving: rm.filter((r) => r[2] !== 'none' && !/0, 0\)$/.test(r[2])).length }));
} finally { await b.close(); process.exit(0); }
