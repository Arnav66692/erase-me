// The story phones, as real geometry. Original code on vendored three.js r170.
// A brushed metal frame with a bevel, a black glass front, side buttons, and a lit screen whose face is drawn
// into a canvas at 3x. The phone sits flat at rest so the CSS story card lands on its screen exactly.
// It flies in tilted as the ash ground burns in, like the reference's phone, then settles flat.
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { INK, GRAPHITE, ASH_LIGHT, PAPER, DENIM } from './crests.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const PAD = 70; // extra canvas room round the phone for the tilt and the shadow, in CSS px

function rounded(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function faceGeometry(w, h, r) {
  const g = new THREE.ShapeGeometry(rounded(w, h, r), 24);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return g;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The screen face, drawn in CSS px at 3x so it stays sharp. Mirrors the CSS screens it replaces.
function drawScreen(w, h, dark, fonts) {
  const k = 3;
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext('2d');
  ctx.scale(k, k);
  ctx.fillStyle = ASH_LIGHT;
  ctx.fillRect(0, 0, w, h);
  // Island, status and brand.
  ctx.fillStyle = INK;
  rr(ctx, w / 2 - 34, 10, 68, 20, 10); ctx.fill();
  ctx.font = `600 11px ${fonts.ui}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('9:41', 26, 18);
  rr(ctx, w - 22 - 22, 13.5, 22, 9, 3); ctx.fill();
  ctx.font = `700 14px ${fonts.sans}`;
  const label = 'Erase Me';
  const tw = ctx.measureText(label).width;
  const bx = (w - (13 + 5 + tw)) / 2, by = 44;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6 * 13 / 20;
  ctx.beginPath();
  const m = 13 / 20;
  ctx.moveTo(bx + 2 * m, by - 6.5 + 5 * m); ctx.lineTo(bx + 18 * m, by - 6.5 + 5 * m);
  ctx.moveTo(bx + 2 * m, by - 6.5 + 10 * m); ctx.lineTo(bx + 13 * m, by - 6.5 + 10 * m);
  ctx.moveTo(bx + 2 * m, by - 6.5 + 15 * m); ctx.lineTo(bx + 8 * m, by - 6.5 + 15 * m);
  ctx.stroke();
  ctx.fillText(label, bx + 18, by);

  const chip = (x, y, text, fill, stroke, color, font) => {
    ctx.font = font;
    const cw = ctx.measureText(text).width + 24;
    ctx.fillStyle = fill; rr(ctx, x, y, cw, 26, 13); ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = color; ctx.fillText(text, x + 12, y + 13.5);
    return cw;
  };
  if (!dark) {
    // Two chips near the bottom, as on the CSS screen.
    ctx.font = `600 11px ${fonts.ui}`;
    const a = ctx.measureText('Recheck').width + 24, b = ctx.measureText('Saved').width + 24;
    let x = (w - (a + 8 + b)) / 2;
    const y = h - 62 - 26;
    x += chip(x, y, 'Recheck', PAPER, 'rgba(14,15,17,.14)', INK, `600 11px ${fonts.ui}`) + 8;
    chip(x, y, 'Saved', PAPER, 'rgba(14,15,17,.14)', INK, `600 11px ${fonts.ui}`);
    return c;
  }
  // The dark variant. A paper slot for the card, and a graphite sheet asking what came back.
  ctx.fillStyle = PAPER;
  rr(ctx, 22, 118, w - 44, 72, 12); ctx.fill();
  ctx.fillStyle = GRAPHITE;
  rr(ctx, 6, 148, w - 12, h - 154, 24); ctx.fill();
  ctx.fillStyle = 'rgba(251,251,250,.3)';
  rr(ctx, w / 2 - 15, 160, 30, 3, 1.5); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = PAPER;
  // The title and the line under it wrap the way the CSS sheet wraps them.
  ctx.font = `300 25px ${fonts.display}`;
  ctx.fillText('WHAT CAME', w / 2, 192);
  ctx.fillText('BACK?', w / 2, 214.5);
  ctx.fillStyle = '#b5b4af';
  ctx.font = `400 11px ${fonts.ui}`;
  ctx.fillText('Save the broker’s reply,', w / 2, 242);
  ctx.fillText('then look again.', w / 2, 257);
  ctx.textAlign = 'left';
  let y = 278;
  for (const [l, r] of [['Request sent', 'Saved'], ['Reply', 'Saved'], ['Listing', 'Recheck']]) {
    ctx.fillStyle = 'rgba(251,251,250,.14)';
    ctx.fillRect(20, y, w - 40, 1);
    ctx.fillStyle = '#d6d5d0';
    ctx.font = `400 11px ${fonts.ui}`;
    ctx.fillText(l, 22, y + 15);
    ctx.fillStyle = DENIM;
    ctx.font = `600 11px ${fonts.ui}`;
    ctx.textAlign = 'right';
    ctx.fillText(r, w - 22, y + 15);
    ctx.textAlign = 'left';
    y += 30;
  }
  ctx.font = `500 11px ${fonts.ui}`;
  const g1 = ctx.measureText('Gone').width + 22, g2 = ctx.measureText('Still listed').width + 22;
  let x = (w - (g1 + 6 + g2)) / 2;
  x += chip(x, y + 12, 'Gone', 'rgba(251,251,250,.13)', null, PAPER, `500 11px ${fonts.ui}`) - 2 + 6;
  chip(x, y + 12, 'Still listed', 'rgba(251,251,250,.13)', null, PAPER, `500 11px ${fonts.ui}`);
  return c;
}

export function startPhone(el, { dark = false, fonts, stage = () => 1 }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'g-gl g-gl-phone';
  canvas.setAttribute('aria-hidden', 'true');
  el.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  const pm = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture;
  pm.dispose();
  const camera = new THREE.PerspectiveCamera(16, 1, .1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const phone = new THREE.Group();
  scene.add(phone);

  // Sizes in CSS px of the element. One world unit is 100 px.
  let built = null;
  function build() {
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return false;
    if (built && built.W === W && built.H === H) return true;
    phone.clear();
    lastT = -1;
    const w = W / 100, h = H / 100, depth = .26, rOut = Math.min(.42, w * .19);
    const bevel = .035;
    const body = new THREE.ExtrudeGeometry(rounded(w - bevel * 2, h - bevel * 2, rOut - bevel), {
      depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 28,
    });
    body.translate(0, 0, -depth / 2 + bevel);
    const metal = new THREE.MeshPhysicalMaterial({ color: dark ? 0x8f8e89 : 0xd9d8d3, metalness: 1, roughness: .32, clearcoat: .4, clearcoatRoughness: .2 });
    phone.add(new THREE.Mesh(body, metal));
    // Black glass front, slightly inside the frame edge.
    const glassW = w - .06, glassH = h - .06;
    const glass = new THREE.Mesh(faceGeometry(glassW, glassH, rOut - .03), new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: .06, metalness: 0, clearcoat: 1, clearcoatRoughness: .04 }));
    glass.position.z = depth / 2 + .002;
    phone.add(glass);
    // The screen. It matches the CSS screen box, 8 px in from the frame, radius 35.
    const sw = (W - 16) / 100, sh = (H - 16) / 100;
    const tex = new THREE.CanvasTexture(drawScreen(W - 16, H - 16, dark, fonts));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const screenMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, roughness: .05, clearcoat: 1, clearcoatRoughness: .02 });
    screenMat.toneMapped = false;
    const screen = new THREE.Mesh(faceGeometry(sw, sh, Math.min(.35, rOut - .07)), screenMat);
    screen.position.z = depth / 2 + .004;
    phone.add(screen);
    // Side buttons.
    const btn = new THREE.MeshPhysicalMaterial({ color: dark ? 0x7c7b77 : 0xc9c8c3, metalness: 1, roughness: .28 });
    for (const [x, y, len] of [[-1, .26, .22], [-1, .02, .42], [-1, -.24, .42], [1, .1, .62]]) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(.025, len, 4, 10), btn);
      b.position.set(x * (w / 2 + .006), y * h, 0);
      phone.add(b);
    }
    // A soft contact shadow behind, so the phone sits on the ground instead of floating.
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const sx = sc.getContext('2d');
    const gr = sx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, 'rgba(14,15,17,.32)'); gr.addColorStop(1, 'rgba(14,15,17,0)');
    sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, h * 1.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.position.set(.12, -.28, -depth / 2 - .3);
    phone.add(shadow);

    // Camera distance so the screen plane maps to the element's CSS px exactly.
    const cw = W + PAD * 2, ch = H + PAD * 2;
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    const fov = camera.fov * Math.PI / 180;
    camera.position.set(0, 0, (ch / 100) / (2 * Math.tan(fov / 2)) + depth / 2 + .004);
    camera.updateProjectionMatrix();
    built = { W, H };
    return true;
  }

  let visible = false, raf = 0, lastT = -1;
  function draw(force) {
    if (!build()) return;
    const t = reduced.matches ? 1 : clamp(stage());
    // Only redraw when the fly-in moves. At rest the phone is a still image.
    if (!force && t === lastT) return;
    lastT = t;
    const e = 1 - Math.pow(1 - t, 3);
    phone.rotation.set((1 - e) * .55, (1 - e) * -.42, (1 - e) * .08);
    phone.position.set(0, (1 - e) * -.6, (1 - e) * -1.2);
    renderer.render(scene, camera);
  }
  function loop() {
    raf = 0;
    if (!visible || document.hidden) return;
    draw();
    raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };
  new IntersectionObserver((es) => { for (const x of es) visible = x.isIntersecting; kick(); }, { rootMargin: '10% 0px' }).observe(el);
  document.addEventListener('visibilitychange', kick);
  window.addEventListener('resize', () => { built = null; draw(true); });
  draw(true);
}
