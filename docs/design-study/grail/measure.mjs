// Computed-style survey: type roles, colours, radii, shadows, transitions, components, a11y. node measure.mjs d1440|d1920|m390 [path]
import { launch, open, VP, SITE, wait, save, rejectCookies } from './lib.mjs';
const key = process.argv[2] || 'd1440'; const path = process.argv[3] || '';
const vp = VP[key];
const b = await launch();
try {
  const { page, logs } = await open(b, vp);
  await page.goto(SITE + path, { waitUntil: 'load', timeout: 60000 }); await wait(5000);
  const cookie = await rejectCookies(page);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  // walk so lazy chunks and scroll-revealed text reach their end state; collect styles at each step
  const acc = { roles: {}, colors: {}, bgs: {}, radii: {}, shadows: {}, trans: {}, backdrop: {}, borders: {} };
  for (let y = 0; y <= H; y += Math.round(vp.h * 0.5)) {
    await page.evaluate((v) => scrollTo(0, v), y); await wait(700);
    const part = await page.evaluate(() => {
      const o = { roles: {}, colors: {}, bgs: {}, radii: {}, shadows: {}, trans: {}, backdrop: {}, borders: {} };
      const short = (el) => ((el.getAttribute('class') || '').replace(/_[a-z0-9]{5}_\d+/g, '').trim().split(/\s+/)[0] || el.tagName.toLowerCase());
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        const r = el.getBoundingClientRect(); const onScreen = r.bottom > 0 && r.top < innerHeight && r.width > 0;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
        if (own && onScreen && +cs.opacity > 0.05) {
          const k = [cs.fontFamily.split(',')[0].replace(/"/g, ''), cs.fontSize, cs.lineHeight, cs.fontWeight, cs.letterSpacing, cs.textTransform, cs.color].join(' | ');
          o.roles[k] = o.roles[k] || { n: 0, cls: short(el), tag: el.tagName.toLowerCase(), t: own.slice(0, 30), stack: cs.fontFamily }; o.roles[k].n++;
        }
        if (!onScreen) continue;
        const add = (m, v, c) => { if (!v) return; m[v] = m[v] || { n: 0, cls: c }; m[v].n++; };
        if (own) add(o.colors, cs.color, short(el));
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') add(o.bgs, cs.backgroundColor, short(el));
        if (cs.backgroundImage !== 'none') add(o.bgs, 'IMG ' + cs.backgroundImage.slice(0, 160), short(el));
        if (cs.borderRadius !== '0px') add(o.radii, cs.borderRadius, short(el));
        if (cs.boxShadow !== 'none') add(o.shadows, cs.boxShadow, short(el));
        if (cs.transitionDuration !== '0s') add(o.trans, `${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction} ${cs.transitionDelay}`.slice(0, 260), short(el));
        if (cs.backdropFilter !== 'none') add(o.backdrop, cs.backdropFilter, short(el));
        if (cs.filter !== 'none') add(o.backdrop, 'filter ' + cs.filter, short(el));
        for (const s of ['Top', 'Bottom', 'Left', 'Right']) if (cs['border' + s + 'Style'] !== 'none' && cs['border' + s + 'Width'] !== '0px') add(o.borders, `${s} ${cs['border' + s + 'Width']} ${cs['border' + s + 'Style']} ${cs['border' + s + 'Color']}`, short(el));
      }
      return o;
    });
    for (const m of Object.keys(acc)) for (const [k, v] of Object.entries(part[m])) { if (!acc[m][k]) acc[m][k] = { ...v, at: y }; else acc[m][k].n = Math.max(acc[m][k].n, v.n); }
  }
  await page.evaluate(() => scrollTo(0, 0)); await wait(1500);
  const comp = await page.evaluate(() => {
    const pick = (sel) => { const el = [...document.querySelectorAll('*')].find((e) => [...e.classList].some((c) => c.startsWith(sel + '_') || c === sel)); if (!el) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { r: [r.x, r.y + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10), font: `${cs.fontFamily} ${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight} ls ${cs.letterSpacing}`, color: cs.color, bg: cs.backgroundColor, rad: cs.borderRadius, pad: cs.padding, gap: cs.gap, border: cs.border, shadow: cs.boxShadow, backdrop: cs.backdropFilter, trans: `${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction}`, pos: cs.position, left: cs.left, bottom: cs.bottom, z: cs.zIndex, cursor: cs.cursor, op: cs.opacity, tf: cs.transform, mix: cs.mixBlendMode, display: cs.display }; };
    const names = ['_nav', '_logoBtn', '_logo', '_tagline', '_cta', '_headline', '_letter', '_scene', '_colontitle', '_s2head', '_s2line', '_s2body', '_s4head', '_s4lead', '_s4para', '_s4divider', '_section5', '_s5head', '_s5sub', '_s5row', '_voice', '_sheetClip', '_bodyL', '_pill', '_pillOn', '_nameFront', '_number', '_oneLiner', '_selector', '_head', '_body', '_labels', '_guilds', '_guildName', '_kicker', '_lead', '_blurbBody', '_footer', '_tile', '_tileMark', '_pitch', '_formZone', '_inputWrap', '_emailInput', '_waitPill', '_pillBtn', '_cursor', '_wordmarkBtn', '_clockDigit', '_phone'];
    const o = {}; for (const n of names) o[n] = pick(n);
    const root = getComputedStyle(document.documentElement);
    const imgs = [...document.images].map((i) => ({ src: i.currentSrc.split('/').slice(-2).join('/'), alt: i.getAttribute('alt'), w: i.naturalWidth, h: i.naturalHeight }));
    const heads = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => h.tagName + ' ' + h.textContent.trim().slice(0, 50));
    const inputs = [...document.querySelectorAll('input,textarea,select')].map((i) => { const cs = getComputedStyle(i); return { type: i.type, name: i.name, ph: i.placeholder, aria: i.getAttribute('aria-label'), label: i.labels?.[0]?.textContent?.trim().slice(0, 40), font: `${cs.fontFamily} ${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight}`, color: cs.color, caret: cs.caretColor, tabindex: i.tabIndex, hidden: i.offsetParent === null }; });
    const ph = (() => { const i = document.querySelector('input[class*="_emailInput"]'); if (!i) return null; const cs = getComputedStyle(i, '::placeholder'); return { color: cs.color, font: `${cs.fontFamily} ${cs.fontSize} ${cs.fontWeight}`, ls: cs.letterSpacing, tt: cs.textTransform }; })();
    return { o, rootFont: root.fontSize, htmlCls: document.documentElement.className, lang: document.documentElement.lang, imgs, heads, inputs, ph, landmarks: { main: document.querySelectorAll('main').length, header: document.querySelectorAll('header').length, nav: document.querySelectorAll('nav').length, footer: document.querySelectorAll('footer').length }, skip: [...document.querySelectorAll('a')].filter((a) => /skip/i.test(a.textContent)).length, sr: document.querySelectorAll('.sr-only').length, ariaHidden: document.querySelectorAll('[aria-hidden="true"]').length, cursorNone: getComputedStyle(document.body).cursor + ' ' + getComputedStyle(document.documentElement).cursor };
  });
  save(`measure-${(path || 'home').replace(/\W/g, '')}-${key}`, { H, cookie, acc, comp, logs });
  console.log('H', H, 'roles', Object.keys(acc.roles).length, 'colors', Object.keys(acc.colors).length, 'bgs', Object.keys(acc.bgs).length);
} finally { await b.close(); process.exit(0); }
