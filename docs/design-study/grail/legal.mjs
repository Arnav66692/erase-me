// Legal pages: frames and type roles at 1440 and 390. node legal.mjs
import { launch, open, VP, SITE, wait, save, shot, rejectCookies } from './lib.mjs';
const b = await launch();
const out = {};
try {
  for (const key of ['d1440', 'm390']) for (const path of ['privacy', 'terms']) {
    const { page, ctx } = await open(b, VP[key]);
    await page.goto(SITE + path, { waitUntil: 'load', timeout: 60000 }); await wait(4000); await rejectCookies(page);
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    await shot(page, `legal/${path}-${key}-top`);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await wait(1500);
    await shot(page, `legal/${path}-${key}-end`);
    out[`${path}-${key}`] = await page.evaluate(() => {
      const roles = {}; const short = (el) => ((el.getAttribute('class') || '').replace(/_[a-z0-9]{5}_\d+/g, '').trim().split(/\s+/)[0] || el.tagName.toLowerCase());
      const bgs = {};
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el); if (cs.display === 'none') continue;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
        if (own) { const k = [cs.fontFamily.split(',')[0].replace(/"/g, ''), cs.fontSize, cs.lineHeight, cs.fontWeight, cs.letterSpacing, cs.textTransform, cs.color].join(' | '); roles[k] = roles[k] || { n: 0, cls: short(el), tag: el.tagName }; roles[k].n++; }
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') bgs[cs.backgroundColor] = short(el);
      }
      const main = document.querySelector('main, article, [class*="_legal"], [class*="_page"]'); const r = main ? main.getBoundingClientRect() : null;
      return { roles, bgs, body: getComputedStyle(document.body).backgroundColor, main: r ? [r.x, r.width].map(Math.round) : null, mainCls: main ? main.getAttribute('class') : null, heads: [...document.querySelectorAll('h1,h2,h3')].length, links: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).slice(0, 12) };
    });
    out[`${path}-${key}`].H = H;
    await ctx.close();
  }
  save('legal', out);
  for (const [k, v] of Object.entries(out)) { console.log(k, v.H, v.body, JSON.stringify(v.main), v.mainCls, JSON.stringify(v.bgs)); for (const [r, x] of Object.entries(v.roles)) console.log('   ', x.n, r, x.cls, x.tag); }
} finally { await b.close(); process.exit(0); }
