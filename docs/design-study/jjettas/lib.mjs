// Shared helpers for the jjettas.com design study. Real Chrome, Metal GPU, muted.
import { createRequire } from 'module';
const require = createRequire('/Users/arnavsingh/.claude/skills/gstack/package.json');
const { chromium } = require('playwright-core');
import fs from 'fs';
export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const ROOT = '/Users/arnavsingh/Desktop/Business/erase-me/qa/out/refs/jjettas/';
export const DATA = ROOT + 'data/';
export const SITE = 'https://jjettas.com/';
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(ROOT, { recursive: true }); fs.mkdirSync(DATA, { recursive: true });
export async function launch() {
  return chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
}
export const VP = { d1440: { w: 1440, h: 900 }, d1920: { w: 1920, h: 1080 }, m390: { w: 390, h: 844, mobile: true } };
export async function open(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, reducedMotion: vp.reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror ' + String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console ' + m.text().slice(0, 200)); });
  return { ctx, page, logs };
}
export const skipped = [];
export const shot = (page, name, opts = {}) => { if (diskFreeMB() < 1500) { skipped.push(name); return Promise.resolve(null); } fs.mkdirSync((ROOT + name).replace(/\/[^/]*$/, ''), { recursive: true }); return page.screenshot({ path: `${ROOT}${name}.jpg`, type: 'jpeg', quality: 60, ...opts }); };
export const save = (name, data) => fs.writeFileSync(DATA + name + '.json', JSON.stringify(data, null, 1));
// Decline the cookie banner with its Reject button, the privacy-preserving choice.
export async function rejectCookies(page) {
  const btn = page.locator('button', { hasText: /^\s*(Reject( all)?|Decline( all)?|Only necessary|Necessary only|Deny)\s*$/i }).first();
  try { await btn.waitFor({ state: 'visible', timeout: 6000 }); await btn.click({ timeout: 2000 }); await wait(500); return true; } catch { return false; }
}
// Walk the page in wheel steps so lazy and in-view content runs, then return to the top.
export async function warm(page, vp) {
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += Math.round(vp.h * 0.7)) { await page.evaluate((v) => scrollTo(0, v), y); await wait(250); }
  await page.evaluate(() => scrollTo(0, 0)); await wait(500);
  // lazily sized videos change the page height when metadata arrives, so wait for them
  for (let i = 0; i < 30; i++) { const pending = await page.evaluate(() => { const v = [...document.querySelectorAll('video')].find((x) => !x.videoWidth); if (v) { v.scrollIntoView({ block: 'center' }); return true; } return false; }); if (!pending) break; await wait(600); }
  await page.evaluate(() => scrollTo(0, 0)); await wait(600);
}
export function diskFreeMB() { const s = fs.statfsSync(ROOT); return Math.round(s.bavail * s.bsize / 1e6); }
export function guardDisk() { const f = diskFreeMB(); if (f < 1500) console.log('disk below 1.5 GB, frames are skipped, DOM logs continue', f); return f; }
// CDP screencast at JPEG q60, frames written with ms offsets from t0.
export async function screencast(page, dir, { every = 3, maxW, maxH } = {}) {
  if (diskFreeMB() < 1500) { skipped.push(dir); return { frames: [], stop: async () => {}, wallStart: Date.now() }; }
  fs.mkdirSync(ROOT + dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = []; let t0 = null; let i = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const ts = f.metadata.timestamp * 1000; if (t0 === null) t0 = ts;
    const name = `${dir}/f${String(i++).padStart(4, '0')}-t${String(Math.round(ts - t0)).padStart(5, '0')}.jpg`;
    fs.writeFileSync(ROOT + name, Buffer.from(f.data, 'base64')); frames.push(name);
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: every, ...(maxW ? { maxWidth: maxW, maxHeight: maxH } : {}) });
  return { frames, stop: async () => { await cdp.send('Page.stopScreencast').catch(() => {}); await cdp.detach().catch(() => {}); }, wallStart: Date.now() };
}
export const HOOK = `(() => {
  const log = window.__study = { ctx: [], audio: 0, t0: performance.now(), raf: 0, media: [], mo: [] };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { log.ctx.push({ t, w: this.width, h: this.height, at: Math.round(performance.now()) }); return gc.call(this, t, ...a); };
  for (const k of ['AudioContext', 'webkitAudioContext']) if (window[k]) { const C = window[k]; window[k] = function (...a) { log.audio++; return new C(...a); }; window[k].prototype = C.prototype; }
  const tick = () => { log.raf++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
})();`;
// Visible Chrome window, used only when headless cannot start the hero.
export async function launchHeaded() {
  return chromium.launch({ executablePath: CHROME, headless: false, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--window-position=0,0'] });
}
// Wait until the home loader and the inner-page veil are gone.
export async function waitReady(page) {
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => ({ home: !!document.querySelector('[data-home-loader]'), veil: !!document.querySelector('[data-page-veil]') }));
    if (!s.home && !s.veil) return Date.now() - t0;
    await wait(500);
  }
  return -1;
}
