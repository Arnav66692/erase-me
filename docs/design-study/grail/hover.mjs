// Hover timings per rAF, keyboard focus walk, totem cursor and pill switch. node hover.mjs
import { launch, open, VP, SITE, wait, save, shot, rejectCookies } from './lib.mjs';
const b = await launch();
const out = {};
try {
  const { page } = await open(b, VP.d1440);
  await page.goto(SITE, { waitUntil: 'load', timeout: 60000 }); await wait(6000); await rejectCookies(page);
  // per-frame logger of chosen props on one element while an action runs
  const track = async (sel, props, action, ms = 700) => {
    const p = page.evaluate(({ sel, props, ms }) => new Promise((res) => {
      const el = document.querySelector(sel); if (!el) return res(null);
      const L = []; const t0 = performance.now(); let last = '';
      const f = () => { const cs = getComputedStyle(el); const v = props.map((k) => cs[k]).join(' | '); const t = Math.round(performance.now() - t0); if (v !== last) { L.push([t, v]); last = v; } if (t < ms) requestAnimationFrame(f); else res(L); };
      requestAnimationFrame(f);
    }), { sel, props, ms });
    await wait(40); await action(); return p;
  };
  const center = async (sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  await page.mouse.move(700, 600);
  let [x, y] = await center('[class*="_cta_"]');
  out.ctaIn = await track('[class*="_cta_"]', ['backgroundColor', 'transform', 'color'], () => page.mouse.move(x, y, { steps: 2 }));
  await shot(page, 'hover/cta-on', { clip: { x: 1240, y: 10, width: 190, height: 80 } });
  out.ctaDown = await track('[class*="_cta_"]', ['backgroundColor', 'transform'], () => page.mouse.down(), 400);
  await page.mouse.up();
  out.ctaOut = await track('[class*="_cta_"]', ['backgroundColor', 'transform'], () => page.mouse.move(700, 600, { steps: 2 }));
  await page.keyboard.press('Escape');
  // dock
  await page.evaluate(() => scrollTo(0, 600)); await wait(1200);
  [x, y] = await center('[class*="_waitPill_"]');
  out.dockIn = await track('[class*="_pillBtn_"]', ['backgroundColor', 'color', 'filter', 'transform'], () => page.mouse.move(x + 30, y, { steps: 2 }));
  out.dockPillIn = await track('[class*="_waitPill_"]', ['scale', 'translate', 'backgroundColor'], async () => {}, 300);
  out.markIn = await page.evaluate(() => { const m = document.querySelector('[class*="_pillMark_"]'); const cs = getComputedStyle(m); return [cs.transform, cs.backgroundColor]; });
  await shot(page, 'hover/dock-on', { clip: { x: 60, y: 800, width: 260, height: 100 } });
  out.dockOut = await track('[class*="_pillBtn_"]', ['backgroundColor', 'color', 'filter'], () => page.mouse.move(700, 400, { steps: 2 }));
  await shot(page, 'hover/dock-off', { clip: { x: 60, y: 800, width: 260, height: 100 } });
  // totem section: cursor and pills
  const tY = await page.evaluate(() => { const e = document.querySelector('[class*="_totemWrap_"]'); return e.getBoundingClientRect().top + scrollY; });
  await page.evaluate((v) => scrollTo(0, v + 200), tY); await wait(3000);
  await page.mouse.move(1100, 400, { steps: 6 }); await wait(800);
  out.totemCursorRight = await page.evaluate(() => { const c = document.querySelector('[class*="_cursor_"]'); const a = c.firstElementChild; return { cls: c.getAttribute('class'), side: c.dataset.side, op: getComputedStyle(c).opacity, tf: getComputedStyle(c).transform, arrow: getComputedStyle(a).transform, bodyCursor: getComputedStyle(document.elementFromPoint(1100, 400)).cursor }; });
  await shot(page, 'totem/cursor-right');
  out.cursorFlip = await track('[class*="_cursorArrow_"]', ['transform'], () => page.mouse.move(300, 400, { steps: 4 }), 700);
  await shot(page, 'totem/cursor-left');
  // pill hover then click Cat (UI state only, no form)
  const pills = await page.$$('[class*="_pill_"]');
  let cat = null; for (const p of pills) { if ((await p.textContent()).trim() === 'Cat') cat = p; }
  if (cat) {
    const bb = await cat.boundingBox();
    out.pillHover = await track('button[class*="_pill_"]:nth-child(2)', ['backgroundColor', 'color'], () => page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 2 }), 400);
    await shot(page, 'totem/pill-hover', { clip: { x: 1040, y: Math.max(0, bb.y - 60), width: 400, height: 160 } });
    await cat.click(); await wait(400); await shot(page, 'totem/after-cat-400'); await wait(1600); await shot(page, 'totem/after-cat-2000');
    out.afterCat = await page.evaluate(() => [...document.querySelectorAll('[class*="_nameInner_"],[class*="_number_"],[class*="_oneLiner_"]')].map((e) => e.textContent.trim().slice(0, 40)));
  }
  // keyboard focus walk from top
  await page.evaluate(() => scrollTo(0, 0)); await wait(1200); await page.mouse.move(5, 5);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  out.focus = [];
  for (let i = 0; i < 22; i++) {
    await page.keyboard.press('Tab'); await wait(350);
    out.focus.push(await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { tag: e.tagName, cls: (e.getAttribute('class') || '').replace(/_[a-z0-9]{5}_\d+/g, '').trim().slice(0, 30), name: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} off ${cs.outlineOffset}`, shadow: cs.boxShadow, fv: e.matches(':focus-visible'), r: [r.x, r.y, r.width, r.height].map(Math.round), sy: Math.round(scrollY) }; }));
    if (i === 1 || i === 2) await shot(page, `focus/tab${i}`);
  }
  save('hover', out);
  console.log(JSON.stringify(out).slice(0, 6000));
} finally { await b.close(); process.exit(0); }
