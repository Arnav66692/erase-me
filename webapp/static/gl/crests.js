// Card faces drawn into 2D canvases, used as WebGL textures. Original drawings in the four palette colours.
// Grail draws its quest faces at 690 by 980. These are drawn at the same size so text stays sharp up close.

export const INK = '#0e0f11';
export const GRAPHITE = '#1c1d20';
export const ASH = '#bcbbb6';
export const ASH_LIGHT = '#e6e5e1';
export const ASH_DEEP = '#4c4b47';
export const PAPER = '#fbfbfa';
export const DENIM = '#8ea6c2';
export const DENIM_INK = '#3f5a7a';

export const FACE_W = 690;
export const FACE_H = 980;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- Crest motifs. Each draws in a unit box of 100 by 100 with two colours.
const MOTIFS = {
  // A house, for a home address.
  house(ctx, fg) {
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(50, 10); ctx.lineTo(90, 44); ctx.lineTo(80, 44); ctx.lineTo(80, 90); ctx.lineTo(20, 90); ctx.lineTo(20, 44); ctx.lineTo(10, 44);
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(42, 58, 16, 32);
    ctx.fillRect(27, 52, 10, 10); ctx.fillRect(63, 52, 10, 10);
    ctx.globalCompositeOperation = 'source-over';
  },
  // A map pin, for where you live.
  pin(ctx, fg) {
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(50, 38, 28, Math.PI * .82, Math.PI * .18);
    ctx.lineTo(50, 92);
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(50, 38, 11, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
  // An envelope.
  envelope(ctx, fg) {
    ctx.fillStyle = fg;
    roundRect(ctx, 10, 24, 80, 54, 6); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(16, 30); ctx.lineTo(50, 56); ctx.lineTo(84, 30); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  },
  // A keyhole.
  keyhole(ctx, fg) {
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(50, 38, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(40, 46); ctx.lineTo(60, 46); ctx.lineTo(68, 88); ctx.lineTo(32, 88); ctx.closePath(); ctx.fill();
  },
  // An eye, for being watched.
  eye(ctx, fg) {
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(6, 50); ctx.quadraticCurveTo(50, 6, 94, 50); ctx.quadraticCurveTo(50, 94, 6, 50); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(50, 50, 20, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.arc(50, 50, 11, 0, Math.PI * 2); ctx.fill();
  },
  // An eraser rubbing out a line.
  eraser(ctx, fg) {
    ctx.fillStyle = fg;
    ctx.save(); ctx.translate(54, 42); ctx.rotate(-0.55);
    roundRect(ctx, -30, -15, 60, 30, 5); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(-4, -15, 4, 30);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillRect(8, 80, 30, 6);
    ctx.globalAlpha = .45; ctx.fillRect(42, 80, 20, 6); ctx.globalAlpha = .2; ctx.fillRect(66, 80, 14, 6); ctx.globalAlpha = 1;
  },
  // A tick in a ring.
  check(ctx, fg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(50, 50, 36, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(33, 51); ctx.lineTo(45, 63); ctx.lineTo(68, 38); ctx.stroke();
  },
  // A magnifier.
  lens(ctx, fg) {
    ctx.strokeStyle = fg; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(42, 42, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, 60); ctx.lineTo(84, 84); ctx.stroke();
  },
};
export const MOTIF_NAMES = Object.keys(MOTIFS);

// Background patterns for crest tiles. Bold and flat, like the reference, in palette colours.
function pattern(ctx, kind, w, h, a, b) {
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = b;
  const s = w / 6;
  if (kind === 'check') {
    for (let y = 0; y < h / s; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2) ctx.fillRect(x * s, y * s, s, s);
  } else if (kind === 'stripe') {
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 4);
    for (let i = -12; i < 12; i++) ctx.fillRect(i * s * 1.2, -h, s * .6, h * 2);
    ctx.restore();
  } else if (kind === 'scallop') {
    for (let y = 0; y < h / s + 1; y++) for (let x = -1; x < 7; x++) {
      ctx.beginPath(); ctx.arc(x * s + (y % 2) * s / 2 + s / 2, y * s, s / 2, 0, Math.PI); ctx.fill();
    }
  } else if (kind === 'wave') {
    ctx.lineWidth = s * .42; ctx.strokeStyle = b;
    for (let y = s / 2; y < h + s; y += s * 1.1) {
      ctx.beginPath();
      for (let x = -s; x <= w + s; x += 6) ctx.lineTo(x, y + Math.sin(x / s * Math.PI) * s * .28);
      ctx.stroke();
    }
  } else if (kind === 'dots') {
    for (let y = 0; y < h / s + 1; y++) for (let x = 0; x < 7; x++) {
      ctx.beginPath(); ctx.arc(x * s + (y % 2) * s / 2, y * s + s / 2, s * .3, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'diamond') {
    for (let y = 0; y < h / s + 1; y++) for (let x = 0; x < 7; x++) {
      const cx = x * s + (y % 2) * s / 2, cy = y * s;
      ctx.beginPath(); ctx.moveTo(cx, cy - s * .48); ctx.lineTo(cx + s * .34, cy); ctx.lineTo(cx, cy + s * .48); ctx.lineTo(cx - s * .34, cy); ctx.fill();
    }
  }
}

// Colour pairs. Background, pattern, crest field, motif.
export const SCHEMES = [
  [DENIM, DENIM_INK, PAPER, DENIM_INK],
  [ASH_LIGHT, INK, DENIM_INK, PAPER],
  [DENIM_INK, DENIM, PAPER, INK],
  [ASH_DEEP, GRAPHITE, DENIM, INK],
  [ASH, ASH_DEEP, INK, PAPER],
  [PAPER, DENIM, INK, DENIM],
];
const PATTERNS = ['check', 'scallop', 'stripe', 'wave', 'dots', 'diamond'];

function crestShield(ctx, x, y, w, h, field, motif, fg) {
  ctx.save();
  ctx.fillStyle = field;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * .62);
  ctx.quadraticCurveTo(x + w, y + h * .9, x + w / 2, y + h);
  ctx.quadraticCurveTo(x, y + h * .9, x, y + h * .62);
  ctx.closePath(); ctx.fill();
  ctx.translate(x + w * .14, y + h * .1);
  ctx.scale(w * .72 / 100, w * .72 / 100);
  MOTIFS[motif](ctx, fg);
  ctx.restore();
}

// A crest tile. A bold pattern ground with a shield and motif in front.
export function drawTile(i, size = 512) {
  const c = canvas(size, Math.round(size * 1.25));
  const ctx = c.getContext('2d');
  const [bg, pat, field, fg] = SCHEMES[i % SCHEMES.length];
  pattern(ctx, PATTERNS[(i * 5 + 1) % PATTERNS.length], c.width, c.height, bg, pat);
  if (i % 3 !== 2) {
    const w = size * .56;
    crestShield(ctx, (size - w) / 2, c.height * .2, w, w * 1.18, field, MOTIF_NAMES[i % MOTIF_NAMES.length], fg);
  }
  return c;
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

// A quest face. Crest, group, bold line, sentence, chips and a footer, laid out like a real card.
export function drawQuest(q, i, fonts) {
  const c = canvas(FACE_W, FACE_H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, FACE_H);
  g.addColorStop(0, PAPER); g.addColorStop(.55, '#f4f4f2'); g.addColorStop(1, '#dcdbd6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FACE_W, FACE_H);
  const pad = 52;
  const [bg, pat, field, fg] = SCHEMES[(i + 2) % SCHEMES.length];
  // Small crest at the top left, a patterned shield like the tiles.
  const cs = canvas(120, 140);
  const cx = cs.getContext('2d');
  pattern(cx, PATTERNS[i % PATTERNS.length], 120, 140, bg, pat);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pad, 60); ctx.lineTo(pad + 96, 60); ctx.lineTo(pad + 96, 60 + 70);
  ctx.quadraticCurveTo(pad + 96, 60 + 100, pad + 48, 60 + 112);
  ctx.quadraticCurveTo(pad, 60 + 100, pad, 60 + 70);
  ctx.closePath(); ctx.clip();
  ctx.drawImage(cs, pad, 60, 96, 112);
  ctx.restore();
  void field; void fg;

  ctx.fillStyle = '#6a6964';
  ctx.font = `400 30px ${fonts.sans}`;
  ctx.fillText(q.group, pad, 232);
  ctx.fillStyle = INK;
  ctx.font = `700 60px ${fonts.sans}`;
  let y = wrap(ctx, q.line, pad, 300, FACE_W - pad * 2, 62);
  ctx.fillStyle = '#3a3a38';
  ctx.font = `400 30px ${fonts.sans}`;
  wrap(ctx, q.small, pad, y + 24, FACE_W - pad * 2, 38);

  // Chips sit above the footer.
  let x = pad;
  ctx.font = `600 27px ${fonts.sans}`;
  for (const t of q.chips) {
    const w = ctx.measureText(t).width + 44;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, 800, w, 60, 30); ctx.fill();
    ctx.strokeStyle = '#d2d1cc'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2a2a28';
    ctx.fillText(t, x + 22, 840);
    x += w + 12;
  }
  ctx.fillStyle = '#d2d1cc';
  ctx.fillRect(pad, 892, FACE_W - pad * 2, 2);
  ctx.fillStyle = '#6a6964';
  ctx.font = `400 24px ${fonts.sans}`;
  ctx.textAlign = 'center';
  ctx.fillText('Removal depends on each site.', FACE_W / 2, 934);
  ctx.textAlign = 'left';
  return c;
}

// The back of every card. Plain ash with a faint mark, so a card turning edge-on still reads as paper.
export function drawBack(size = 256) {
  const c = canvas(size, Math.round(size * 1.42));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9d8d3';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// A generic opt-out form on paper, for the clipboard. No real site is named.
export function drawForm(fonts) {
  const W = 662, H = 1000;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  const pad = 54;
  ctx.fillStyle = INK;
  ctx.font = `700 46px ${fonts.sans}`;
  ctx.fillText('Opt-out request', pad, 210);
  ctx.fillStyle = '#5f5e5a';
  ctx.font = `400 22px ${fonts.sans}`;
  ctx.fillText('Remove a listing from public search results.', pad, 250);
  const fields = [['Full name', 'Alex Morgan'], ['City and state', 'San Diego, CA'], ['Listing link', 'example.com/alex-morgan-35'], ['Email for confirmation', 'you@example.com']];
  let y = 310;
  for (const [label, value] of fields) {
    ctx.fillStyle = '#5f5e5a';
    ctx.font = `600 20px ${fonts.sans}`;
    ctx.fillText(label, pad, y);
    ctx.strokeStyle = '#c9c8c3'; ctx.lineWidth = 2;
    roundRect(ctx, pad, y + 14, W - pad * 2, 64, 10); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `400 26px ${fonts.sans}`;
    ctx.fillText(value, pad + 20, y + 56);
    y += 120;
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  roundRect(ctx, pad, y, 32, 32, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad + 7, y + 17); ctx.lineTo(pad + 14, y + 24); ctx.lineTo(pad + 26, y + 9); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `400 22px ${fonts.sans}`;
  ctx.fillText('This listing is about me.', pad + 48, y + 24);
  ctx.fillStyle = INK;
  roundRect(ctx, pad, y + 66, 300, 70, 35); ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.font = `600 24px ${fonts.sans}`;
  ctx.fillText('Remove my listing', pad + 46, y + 109);
  return c;
}

// An email draft for the laptop screen. A generic address, plain words.
export function drawEmail(fonts) {
  const W = 1024, H = 768;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = ASH_LIGHT;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, 86);
  ctx.fillStyle = INK;
  ctx.font = `700 34px ${fonts.sans}`;
  ctx.fillText('New message', 48, 56);
  ctx.fillStyle = DENIM_INK;
  roundRect(ctx, W - 190, 22, 142, 44, 22); ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.font = `600 22px ${fonts.sans}`;
  ctx.fillText('Send', W - 146, 52);
  const rows = [['To', 'privacy@broker.example'], ['Subject', 'Delete my personal information']];
  let y = 140;
  for (const [k, v] of rows) {
    ctx.fillStyle = '#5f5e5a';
    ctx.font = `400 26px ${fonts.sans}`;
    ctx.fillText(k, 48, y);
    ctx.fillStyle = INK;
    ctx.fillText(v, 190, y);
    ctx.fillStyle = '#c9c8c3';
    ctx.fillRect(48, y + 22, W - 96, 2);
    y += 66;
  }
  ctx.fillStyle = INK;
  ctx.font = `400 28px ${fonts.sans}`;
  const body = ['Hello,', '', 'Please delete the personal information you', 'hold about me and remove my listing from', 'your site. My details are below so you can', 'find the right record.', '', 'Thank you,', 'Alex Morgan'];
  y += 30;
  for (const line of body) { ctx.fillText(line, 48, y); y += 42; }
  return c;
}
