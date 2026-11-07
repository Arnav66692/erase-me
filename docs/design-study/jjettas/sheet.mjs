// node sheet.mjs <output-name> <cols> <thumbWidth> <frame paths...>  builds a labelled contact sheet, JPEG q60.
import { CHROME, ROOT, wait } from './lib.mjs';
import { createRequire } from 'module';
const { chromium } = createRequire('/Users/arnavsingh/.claude/skills/gstack/package.json')('playwright-core');
import fs from 'fs'; import path from 'path';
export async function sheet(outName, cols, tw, files, title = '') {
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await b.newPage({ viewport: { width: cols * (tw + 8) + 8, height: 800 } });
  const html = `<!doctype html><body style="margin:0;background:#111;color:#ddd;font:12px monospace;padding:4px">
  ${title ? `<div style="padding:6px 4px;font-size:15px">${title}</div>` : ''}
  <div style="display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:8px;padding:4px">
  ${files.map((f) => `<figure style="margin:0"><img src="file://${f}" decoding="sync" style="width:100%;display:block"><figcaption style="padding:2px 0">${path.basename(f, '.jpg')}</figcaption></figure>`).join('')}
  </div></body>`;
  const tmp = ROOT + '.sheet-tmp.html'; fs.writeFileSync(tmp, html);
  await page.goto('file://' + tmp, { waitUntil: 'load', timeout: 60000 }); await wait(500);
  const out = `${ROOT}sheets/${outName}.jpg`; fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'jpeg', quality: 60, fullPage: true });
  fs.unlinkSync(tmp); await b.close(); return out;
}
if (process.argv[1].endsWith('/sheet.mjs')) {
  const [, , n, c, w, ...fl] = process.argv;
  console.log(await sheet(n, +c, +w, fl));
}
