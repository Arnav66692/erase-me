// First look: scripts, fonts, globals, canvases, page size, links, cookie banner. node probe.mjs
import { launch, open, VP, SITE, HOOK, wait, save, shot, rejectCookies, diskFreeMB } from './lib.mjs';
console.log('disk MB', diskFreeMB());
const b = await launch();
try {
  const { page, logs } = await open(b, VP.d1440);
  await page.addInitScript(HOOK);
  const req = [];
  page.on('response', async (r) => { const h = r.headers(); req.push({ url: r.url().slice(0, 200), type: r.request().resourceType(), status: r.status(), len: +(h['content-length'] || 0), ct: (h['content-type'] || '').slice(0, 40) }); });
  const t0 = Date.now();
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const dcl = Date.now() - t0;
  await wait(6000);
  const cookie = await rejectCookies(page);
  await shot(page, 'probe/d1440-first');
  const info = await page.evaluate(() => {
    const g = {};
    for (const k of ['THREE', '__THREE__', 'gsap', 'ScrollTrigger', 'Lenis', 'lenis', '__NEXT_DATA__', 'next', '__nuxt', 'Webflow', '__framer_importFromPackage', 'Framer', 'Swiper', 'barba', 'LocomotiveScroll', 'React', '__REACT_DEVTOOLS_GLOBAL_HOOK__', 'PIXI', 'Spline', 'Rive', 'lottie', 'posthog', 'gtag', 'dataLayer', 'Splide', 'anime', 'Motion']) g[k] = typeof window[k];
    const fonts = [...document.fonts].map((f) => ({ fam: f.family, w: f.weight, s: f.style, st: f.status }));
    const scripts = [...document.scripts].map((s) => s.src || ('inline:' + s.textContent.length));
    const links = [...document.querySelectorAll('a')].map((a) => ({ t: a.textContent.trim().slice(0, 40), h: a.getAttribute('href') }));
    const metas = [...document.querySelectorAll('meta')].map((m) => [m.name || m.getAttribute('property'), (m.content || '').slice(0, 80)]).filter((x) => x[0]);
    const canv = [...document.querySelectorAll('canvas')].map((c) => { const r = c.getBoundingClientRect(); return { w: c.width, h: c.height, r: [r.x, r.y, r.width, r.height].map(Math.round), pos: getComputedStyle(c).position, z: getComputedStyle(c).zIndex, parent: c.parentElement?.className?.toString().slice(0, 60) }; });
    const html = document.documentElement;
    const cs = getComputedStyle(html), bs = getComputedStyle(document.body);
    return { g, fonts, scripts, links, metas, canv, title: document.title, gen: document.querySelector('meta[name=generator]')?.content, htmlClass: html.className, bodyClass: document.body.className, rootFont: cs.fontSize, scrollBehavior: cs.scrollBehavior, overflowHtml: cs.overflow, overflowBody: bs.overflow, bodyBg: bs.backgroundColor, htmlBg: cs.backgroundColor, H: html.scrollHeight, bodyH: document.body.scrollHeight, imgs: document.images.length, videos: document.querySelectorAll('video').length, svgs: document.querySelectorAll('svg').length, iframes: [...document.querySelectorAll('iframe')].map((f) => f.src.slice(0, 120)), study: window.__study, elCount: document.querySelectorAll('*').length };
  });
  save('probe', { dcl, cookie, info, req, logs });
  console.log(JSON.stringify({ dcl, cookie, title: info.title, gen: info.gen, g: info.g, H: info.H, bodyH: info.bodyH, canv: info.canv, rootFont: info.rootFont, sb: info.scrollBehavior, ov: [info.overflowHtml, info.overflowBody], bg: [info.bodyBg, info.htmlBg], htmlClass: info.htmlClass, bodyClass: info.bodyClass, imgs: info.imgs, videos: info.videos, iframes: info.iframes, ctx: info.study?.ctx, el: info.elCount, nreq: req.length }, null, 0));
  console.log('links', JSON.stringify(info.links));
  console.log('fonts', JSON.stringify(info.fonts));
  console.log('scripts', JSON.stringify(info.scripts));
  console.log('logs', logs.slice(0, 10));
} finally { await b.close(); process.exit(0); }
