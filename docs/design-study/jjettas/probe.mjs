// First look: load home at one viewport, screencast the load, log canvases, buttons, fixed layers.
import { launch, open, VP, SITE, wait, shot, save, screencast, HOOK, guardDisk } from './lib.mjs';
const key = process.argv[2] || 'd1440';
const vp = VP[key];
guardDisk();
const browser = await launch();
try {
  const { page, logs } = await open(browser, vp);
  await page.addInitScript(HOOK);
  const sc = await screencast(page, `load/${key}`, { every: 2 });
  const t0 = Date.now();
  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const tDom = Date.now() - t0;
  await wait(9000);
  await sc.stop();
  await shot(page, `probe/${key}-after9s`);
  const info = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0; };
    const fixed = [...document.querySelectorAll('body *')].filter((e) => ['fixed', 'sticky'].includes(getComputedStyle(e).position)).slice(0, 40).map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { tag: e.tagName, id: e.id, cls: String(e.className).slice(0, 120), pos: cs.position, z: cs.zIndex, op: cs.opacity, vis: cs.visibility, r: [r.x, r.y, r.width, r.height].map(Math.round), txt: (e.innerText || '').slice(0, 60) }; });
    const buttons = [...document.querySelectorAll('button,a,[role=button]')].filter(vis).slice(0, 60).map((e) => { const r = e.getBoundingClientRect(); return { tag: e.tagName, txt: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40), href: e.getAttribute('href'), r: [r.x, r.y, r.width, r.height].map(Math.round) }; });
    const canvases = [...document.querySelectorAll('canvas')].map((c) => { const r = c.getBoundingClientRect(); return { w: c.width, h: c.height, r: [r.x, r.y, r.width, r.height].map(Math.round), cls: String(c.className).slice(0, 80), pos: getComputedStyle(c).position }; });
    return { url: location.href, title: document.title, H: document.documentElement.scrollHeight, sy: scrollY, htmlCls: document.documentElement.className, bodyCls: document.body.className, bodyOverflow: getComputedStyle(document.body).overflow, htmlOverflow: getComputedStyle(document.documentElement).overflow, rootFS: getComputedStyle(document.documentElement).fontSize, bodyBg: getComputedStyle(document.body).backgroundColor, fixed, buttons, canvases, videos: document.querySelectorAll('video').length, audios: document.querySelectorAll('audio').length, study: window.__study, lenis: !!window.lenis || !!document.querySelector('.lenis') || document.documentElement.className.includes('lenis'), gsap: !!window.gsap };
  });
  save(`probe-${key}`, { tDom, logs, frames: sc.frames.length, ...info });
  console.log(JSON.stringify({ tDom, frames: sc.frames.length, H: info.H, title: info.title, htmlCls: info.htmlCls, bodyOverflow: info.bodyOverflow, htmlOverflow: info.htmlOverflow, rootFS: info.rootFS, bodyBg: info.bodyBg, canvases: info.canvases, nFixed: info.fixed.length, ctx: info.study && info.study.ctx, audio: info.study && info.study.audio, logs }, null, 0));
  console.log('FIXED', JSON.stringify(info.fixed.map((f) => [f.tag, f.id, f.pos, f.z, f.op, f.vis, f.r.join(','), f.txt.replace(/\n/g, ' ').slice(0, 40), f.cls.slice(0, 60)])));
  console.log('BUTTONS', JSON.stringify(info.buttons.map((b) => [b.tag, b.txt.replace(/\n/g, ' '), b.href, b.r.join(',')])));
} finally { await browser.close(); }
