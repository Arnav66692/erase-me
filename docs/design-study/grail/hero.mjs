// Loader colours, hero idle drift, pointer response, custom cursor. node hero.mjs
import { launch, open, VP, SITE, wait, save, shot } from './lib.mjs';
const b = await launch();
const out = {};
try {
  const { page } = await open(b, VP.d1440);
  const ana = await b.newPage();
  const sample = async (png, pts) => ana.evaluate(async ({ png, pts }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const hex = (i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    return pts.map(([px, py]) => [px, py, hex((py * c.width + px) * 4)]);
  }, { png, pts });
  const diff = async (a, b2) => ana.evaluate(async ({ a, b2 }) => {
    const load = async (s) => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const A = await load(a), B = await load(b2); let n = 0, t = 0;
    for (let i = 0; i < A.length; i += 16) { t++; if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) n++; }
    return +(n / t * 100).toFixed(2);
  }, { a, b2 });
  const png = async () => (await page.screenshot({ type: 'png' })).toString('base64');
  await page.goto(SITE, { waitUntil: 'commit', timeout: 60000 });
  // find loader card centre frame by polling for lilac ground
  const loaderSamples = [];
  for (let i = 0; i < 14; i++) { await wait(200); const p = await png(); loaderSamples.push(await sample(p, [[40, 40], [720, 450], [668, 380], [700, 470], [720, 485]])); }
  out.loaderSamples = loaderSamples;
  await wait(5000);
  const A = await png(); await wait(1000); const B = await png(); await wait(2000); const C = await png();
  out.idleDiff1s = await diff(A, B); out.idleDiff3s = await diff(A, C);
  await shot(page, 'hero/idle-a');
  // pointer
  await page.mouse.move(720, 450, { steps: 5 }); await wait(1500); const P0 = await png(); await shot(page, 'hero/ptr-center');
  await page.mouse.move(80, 450, { steps: 20 }); await wait(1500); const PL = await png(); await shot(page, 'hero/ptr-left');
  await page.mouse.move(1360, 450, { steps: 40 }); await wait(1500); const PR = await png(); await shot(page, 'hero/ptr-right');
  await page.mouse.move(720, 120, { steps: 20 }); await wait(1500); await shot(page, 'hero/ptr-top');
  await page.mouse.move(720, 860, { steps: 20 }); await wait(1500); await shot(page, 'hero/ptr-bottom');
  out.ptrDiffLR = await diff(PL, PR); out.ptrDiffC_L = await diff(P0, PL);
  // cursor state over places
  const cur = async (label) => page.evaluate((label) => { const c = document.querySelector('[class*="_cursor_"]'); if (!c) return null; const cs = getComputedStyle(c); return { label, op: cs.opacity, tf: cs.transform.slice(0, 60), html: c.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60), inner: [...c.querySelectorAll('*')].map((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return `${(e.getAttribute('class') || e.tagName).toString().replace(/_[a-z0-9]{5}_\d+/g, '').slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)} bg ${s.backgroundColor} rad ${s.borderRadius} op ${s.opacity}`; }), bodyCursor: getComputedStyle(document.elementFromPoint(innerWidth / 2, innerHeight / 2)).cursor }; }, label);
  out.cursor = [];
  for (const [x, y, l] of [[720, 500, 'hero-center'], [1335, 52, 'cta'], [100, 42, 'logo'], [300, 600, 'hero-empty']]) { await page.mouse.move(x, y, { steps: 8 }); await wait(700); out.cursor.push(await cur(l)); }
  await page.mouse.move(720, 500, { steps: 8 }); await wait(700); await shot(page, 'hero/cursor-center');
  save('hero', out);
  console.log(JSON.stringify(out, null, 0).slice(0, 3000));
} finally { await b.close(); process.exit(0); }
