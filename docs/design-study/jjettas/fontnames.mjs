// Read family names from the site's font files in place (woff2 brotli stream or raw otf), for identification only.
import fs from 'fs'; import zlib from 'zlib';
for (const f of process.argv.slice(2)) {
  let buf = fs.readFileSync(f); let data = null;
  if (buf.slice(0, 4).toString() === 'wOF2') {
    const total = buf.readUInt32BE(20);
    for (let off = 48; off < 48 + 2000 && !data; off++) { try { const d = zlib.brotliDecompressSync(buf.slice(off, off + total)); if (d.length > 1000) data = d; } catch {} }
  } else data = buf;
  const strs = new Set();
  if (data) { let cur = ''; for (let i = 0; i + 1 < data.length; i += 1) { const hi = data[i], lo = data[i + 1]; if (hi === 0 && lo >= 32 && lo < 127) { cur += String.fromCharCode(lo); i++; } else { if (cur.length >= 6) strs.add(cur); cur = ''; } } }
  console.log(f.split('/').pop(), [...strs].filter((s) => /[A-Za-z]{3}/.test(s)).slice(0, 14).join(' || '));
}
