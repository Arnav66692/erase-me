// Walk one page at one viewport with wheel input (Lenis listens to wheel), shooting a frame per step
// and logging type styles, section tones and backgrounds as they enter the viewport.
// usage: node walk.mjs <vpKey> <path> [stepFrac]
import { launch, open, VP, SITE, wait, shot, save, HOOK, guardDisk, rejectCookies, waitReady } from './lib.mjs';
const key = process.argv[2] || 'd1440';
const path = process.argv[3] || '/';
const stepFrac = +(process.argv[4] || 0.85);
const vp = VP[key];
const slug = path === '/' ? 'home' : path.replace(/\//g, '');
guardDisk();
const browser = await launch();
const COLLECT = () => {
  const out = { type: {}, sections: [], bgs: {} };
  const vh = innerHeight;
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.width === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (own) {
      const k = [cs.fontFamily.split(',')[0].replace(/"/g, ''), cs.fontSize, cs.lineHeight, cs.fontWeight, cs.letterSpacing, cs.textTransform, cs.color, cs.fontStyle, cs.fontVariationSettings].join(' | ');
      if (!out.type[k]) out.type[k] = { n: 0, tags: new Set(), ex: [] };
      out.type[k].n++; out.type[k].tags.add(el.tagName);
      if (out.type[k].ex.length < 2) out.type[k].ex.push(own.slice(0, 28));
    }
    const bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && r.width * r.height > 2000) { const kk = bg + ' ' + (cs.opacity !== '1' ? 'op' + cs.opacity : ''); out.bgs[kk] = (out.bgs[kk] || 0) + 1; }
    if (cs.backgroundImage && cs.backgroundImage !== 'none' && r.width * r.height > 20000) { const kk = 'IMG ' + cs.backgroundImage.slice(0, 90) + ' blend ' + cs.mixBlendMode; out.bgs[kk] = (out.bgs[kk] || 0) + 1; }
    if ((el.dataset.section || el.dataset.tone || el.tagName === 'SECTION') && !seen.has(el)) {
      seen.add(el);
      out.sections.push({ tag: el.tagName, sec: el.dataset.section, tone: el.dataset.tone, top: Math.round(r.top + scrollY), h: Math.round(r.height), bg: cs.backgroundColor, color: cs.color });
    }
  }
  for (const k in out.type) out.type[k].tags = [...out.type[k].tags];
  out.root = { fs: getComputedStyle(document.documentElement).fontSize, vars: ['--page-x', '--page-w', '--vu', '--pu', '--cu', '--mp-u', '--home-pane'].map((v) => [v, getComputedStyle(document.documentElement).getPropertyValue(v).trim() || getComputedStyle(document.body).getPropertyValue(v).trim()]) };
  out.theme = { html: document.documentElement.getAttribute('data-theme'), tone: document.documentElement.dataset.tone, cls: document.documentElement.className.replace(/__variable_\w+/g, '').trim() };
  return out;
};
try {
  const { page, logs } = await open(browser, vp);
  await page.addInitScript(HOOK);
  await page.goto(SITE.replace(/\/$/, '') + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const ready = await waitReady(page);
  const cookie = await rejectCookies(page);
  await wait(2500);
  if (!vp.mobile) await page.mouse.move(vp.w / 2, vp.h / 2);
  const steps = [];
  const agg = { type: {}, bgs: {}, sections: {} };
  let H = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0; let lastY = -1; let stuck = 0;
  while (i < 80) {
    const c = await page.evaluate(COLLECT);
    const y = await page.evaluate(() => Math.round(scrollY));
    for (const [k, v] of Object.entries(c.type)) { if (!agg.type[k]) agg.type[k] = { n: 0, tags: [], ex: [], at: [] }; agg.type[k].n += v.n; agg.type[k].tags = [...new Set([...agg.type[k].tags, ...v.tags])]; if (agg.type[k].ex.length < 3) agg.type[k].ex.push(...v.ex.slice(0, 3 - agg.type[k].ex.length)); if (agg.type[k].at.length < 4) agg.type[k].at.push(y); }
    for (const [k, v] of Object.entries(c.bgs)) agg.bgs[k] = (agg.bgs[k] || 0) + v;
    for (const s of c.sections) agg.sections[`${s.tag}|${s.sec}|${s.tone}|${s.top}`] = s;
    await shot(page, `walk/${key}/${slug}/s${String(i).padStart(2, '0')}-y${String(y).padStart(5, '0')}`);
    steps.push({ i, y, theme: c.theme, root: i === 0 ? c.root : undefined });
    if (y === lastY) { if (++stuck >= 2) break; } else stuck = 0;
    lastY = y;
    H = await page.evaluate(() => document.documentElement.scrollHeight);
    if (y + vp.h >= H - 2) break;
    if (vp.mobile) {
      await page.evaluate((d) => window.scrollBy(0, d), Math.round(vp.h * stepFrac));
    } else {
      const total = Math.round(vp.h * stepFrac); for (let d = 0; d < total; d += 120) await page.mouse.wheel(0, Math.min(120, total - d));
    }
    await wait(1400);
    i++;
  }
  const res = { key, path, ready, cookie, H, steps, type: agg.type, bgs: agg.bgs, sections: Object.values(agg.sections).sort((a, b) => a.top - b.top), logs, study: await page.evaluate(() => window.__study) };
  save(`walk-${key}-${slug}`, res);
  console.log(key, path, 'ready', ready, 'cookie', cookie, 'H', H, 'steps', steps.length, 'types', Object.keys(agg.type).length, 'lastY', lastY);
} finally { await browser.close(); }
