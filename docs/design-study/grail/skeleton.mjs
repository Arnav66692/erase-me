// DOM skeleton with rects and computed type, colour per element. node skeleton.mjs d1440|d1920|m390 [path]
import { launch, open, VP, SITE, wait, rejectCookies, DATA } from './lib.mjs';
import fs from 'fs';
const key = process.argv[2] || 'd1440'; const path = process.argv[3] || '';
const b = await launch();
try {
  const { page, logs } = await open(b, VP[key]);
  await page.goto(SITE + path, { waitUntil: 'load', timeout: 60000 }); await wait(5000); await rejectCookies(page);
  // walk once so scroll-driven state settles
  const H0 = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H0; y += VP[key].h * 0.8) { await page.evaluate((v) => window.lenis?.scrollTo ? window.scrollTo(0, v) : window.scrollTo(0, v), y); await wait(200); }
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(1500);
  const out = await page.evaluate(() => {
    const lines = []; const sy = scrollY;
    const walk = (el, d) => {
      if (d > 14) return; const cs = getComputedStyle(el); if (cs.display === 'none') return;
      const r = el.getBoundingClientRect(); const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').slice(0, 60);
      const cls = (el.className && el.className.baseVal === undefined ? el.className : el.getAttribute('class') || '').toString().replace(/_[a-z0-9]{5}_\d+/g, '').trim().slice(0, 50);
      let s = `${'  '.repeat(d)}${el.tagName.toLowerCase()}${cls ? '.' + cls.replace(/\s+/g, '.') : ''} [${Math.round(r.x)},${Math.round(r.y + sy)},${Math.round(r.width)}x${Math.round(r.height)}]`;
      if (cs.position !== 'static') s += ` pos:${cs.position}${cs.top !== 'auto' ? ' top:' + cs.top : ''}`;
      if (own) s += ` "${own}" ${cs.fontFamily.split(',')[0]} ${cs.fontSize}/${cs.lineHeight} w${cs.fontWeight} ls:${cs.letterSpacing} ${cs.textTransform !== 'none' ? cs.textTransform : ''} c:${cs.color}`;
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') s += ` bg:${cs.backgroundColor}`;
      if (cs.borderRadius !== '0px') s += ` rad:${cs.borderRadius}`;
      if (cs.transform !== 'none') s += ` tf:${cs.transform.slice(0, 60)}`;
      if (cs.opacity !== '1') s += ` op:${cs.opacity}`;
      lines.push(s);
      if (el.tagName === 'svg' || el.tagName === 'SVG') return;
      for (const c of el.children) walk(c, d + 1);
    };
    walk(document.body, 0); return { lines, H: document.documentElement.scrollHeight };
  });
  fs.writeFileSync(`${DATA}skeleton-${(path || 'home').replace(/\W/g, '')}-${key}.txt`, `H ${out.H}\n` + out.lines.join('\n'));
  console.log('H', out.H, 'lines', out.lines.length, logs.slice(0, 3));
} finally { await b.close(); process.exit(0); }
