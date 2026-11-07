// Sample rendered colours from lossless in-memory PNG screenshots. Nothing written but JSON. node pixels.mjs
import { launch, open, VP, SITE, wait, save, rejectCookies } from './lib.mjs';
const b = await launch();
try {
  const { page } = await open(b, VP.d1440);
  const ana = await b.newPage();
  await page.goto(SITE, { waitUntil: 'load', timeout: 60000 }); await wait(5000); await rejectCookies(page);
  // walk once so every section has rendered
  for (let y = 0; y < 11729; y += 450) { await page.evaluate((v) => scrollTo(0, v), y); await wait(250); }
  const stops = { hero: 0, problem: 900, timer: 2250, journey: 3600, voice: 4950, totem: 6300, stats: 8550, guilds: 9450, footer: 10829 };
  const pts = { hero: [[20, 880], [720, 300], [400, 300], [880, 300], [1000, 760]], timer: [[20, 450], [720, 880], [300, 450], [1400, 600]], journey: [[720, 300], [20, 880]], voice: [[200, 450], [1300, 450]], totem: [[100, 300], [1300, 200], [720, 880]], stats: [[200, 600], [1300, 300], [50, 860], [420, 800], [770, 860], [1200, 800]], guilds: [[720, 200], [20, 400]], footer: [[720, 180], [100, 400], [720, 700]] };
  const out = {};
  for (const [name, y] of Object.entries(stops)) {
    await page.evaluate((v) => scrollTo(0, v), y); await wait(1600);
    const png = (await page.screenshot({ type: 'png' })).toString('base64');
    out[name] = await ana.evaluate(async ({ png, pts }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
      const hist = {};
      for (let i = 0; i < d.length; i += 4 * 7) { const k = hex(d[i] & 0xf8, d[i + 1] & 0xf8, d[i + 2] & 0xf8); hist[k] = (hist[k] || 0) + 1; }
      const total = d.length / 28;
      const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => [k, +(n / total * 100).toFixed(1)]);
      const at = (pts || []).map(([px, py]) => { const i = (py * c.width + px) * 4; return [px, py, hex(d[i], d[i + 1], d[i + 2])]; });
      return { top, at };
    }, { png, pts: pts[name] });
  }
  save('pixels-d1440', out);
  for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v.top.slice(0, 6)), JSON.stringify(v.at));
} finally { await b.close(); process.exit(0); }
