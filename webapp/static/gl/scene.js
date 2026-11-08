// The landing's WebGL. Original code on vendored three.js r170 (MIT).
// 1. The hero card field. Real card planes with canvas faces, lit, drifting on a belt round the camera.
//    hero.js owns the scroll story and publishes gather (g), converge (c) and pointer (px, py) on window.EraseMeStage.
// 2. The routes chapter. Four CC0 scanned models from Poly Haven, one per removal route, set in one ashen finish.
// If WebGL is missing, nothing here runs and the CSS fallback stays on screen.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { drawQuest, drawTile, drawBack, drawForm, drawEmail, INK } from './crests.js';
import { startPhone } from './phone.js';

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const phone = window.matchMedia('(max-width: 767px)');
const motion = () => !reduced.matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const DEG = Math.PI / 180;

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1;
  r.setClearColor(0x000000, 0);
  return r;
}

function environment(renderer, intensity) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return { env, intensity };
}

// Only draw while the canvas is on screen and the tab is visible.
function watch(node, onChange) {
  if (!('IntersectionObserver' in window)) { onChange(true); return; }
  new IntersectionObserver((es) => { for (const e of es) onChange(e.isIntersecting); }, { rootMargin: '10% 0px' }).observe(node);
}

// ---------------------------------------------------------------- Hero field
const QUESTS = [
  { group: 'People search', line: 'Ask a people-search site to drop your home address.', small: 'Use its own form. Keep the confirmation.', chips: ['Form', 'Email'] },
  { group: 'California', line: 'Send one deletion request to every registered broker.', small: 'Through the state DROP platform. Free for residents.', chips: ['Portal', 'One request'] },
  { group: 'Caller ID', line: 'Take your number out of a caller ID app.', small: 'Unlisting is a setting, not a deletion.', chips: ['App', 'Settings'] },
  { group: 'Verify', line: 'Check that last week’s request actually stuck.', small: 'A request sent is not yet a removal.', chips: ['Recheck', 'Record'] },
  { group: 'Search', line: 'Find every listing with your age and city on it.', small: 'Name plus age or city tells you apart.', chips: ['Search', 'Match'] },
  { group: 'Old accounts', line: 'Close the sign-ups you forgot about.', small: 'Import your list, then choose keep or remove.', chips: ['List', 'Plan'] },
];

// A rounded card plane, UVs from 0 to 1 across the face.
function cardGeometry(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 10);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x) / w, (p.getY(i) - y) / h);
  return g;
}

function texture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function startField(field, fonts) {
  const canvas = document.createElement('canvas');
  canvas.className = 'g-gl';
  canvas.setAttribute('aria-hidden', 'true');
  field.append(canvas);
  const renderer = makeRenderer(canvas);
  const { env } = environment(renderer);
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = .55;
  scene.fog = new THREE.Fog(new THREE.Color(INK), 10.5, 19);
  const camera = new THREE.PerspectiveCamera(24, 1, .1, 60);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-2, 4, 3);
  scene.add(key, new THREE.AmbientLight(0xffffff, .25));
  const rig = new THREE.Group();
  scene.add(rig);

  const backTex = texture(drawBack(), renderer);
  const QW = 1, QH = 1.42, TW = .64, TH = .8;
  const qGeo = cardGeometry(QW, QH, .07), tGeo = cardGeometry(TW, TH, .055);
  const items = [];
  const SPAN = 60;
  // Two strands on a belt round the camera, falling from upper left to lower right.
  // The screen spans about 19 degrees each side at 1440 by 900, so the belt is kept just wider than that.
  const rnd = (n) => { const x = Math.sin(n * 91.7 + 13.1) * 43758.5; return x - Math.floor(x); };
  const LAYOUT = [];
  const PER = 11;
  for (let strand = 0; strand < 2; strand++) {
    for (let i = 0; i < PER; i++) {
      const n = strand * PER + i;
      const a = -SPAN / 2 + (i + strand * .5 + rnd(n) * .35) * (SPAN / PER);
      const y = (strand ? -.55 : .75) - (a + SPAN / 2) / SPAN * 1.5 + (rnd(n + 50) - .5) * .35;
      const isQ = (i + strand * 2) % 4 === 1;
      LAYOUT.push([isQ ? 'q' : 't', a, y, 9.6 + rnd(n + 9) * 2.2 - (isQ ? .5 : 0), (rnd(n + 3) - .5) * 12]);
    }
  }
  let qi = 0, ti = 0;
  LAYOUT.forEach((L, n) => {
    const isQ = L[0] === 'q';
    const face = isQ ? drawQuest(QUESTS[qi % QUESTS.length], qi, fonts) : drawTile(ti);
    const mat = new THREE.MeshStandardMaterial({ map: texture(face, renderer), roughness: isQ ? .62 : .5, metalness: 0, transparent: true, side: THREE.FrontSide });
    const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: .8, transparent: true });
    const card = new THREE.Group();
    const front = new THREE.Mesh(isQ ? qGeo : tGeo, mat);
    const back = new THREE.Mesh(isQ ? qGeo : tGeo, backMat);
    back.rotation.y = Math.PI;
    back.position.z = -.004;
    card.add(front, back);
    rig.add(card);
    items.push({ card, mats: [mat, backMat], isQ, k: isQ ? qi : -1, a0: L[1], y0: L[2], r0: L[3], roll: L[4], seed: n * 1.37 });
    if (isQ) qi++; else ti++;
  });

  const st = { px: 0, py: 0, g: 0, c: 0 };
  let visible = true, last = performance.now(), drift = 0, raf = 0;

  function resize() {
    const w = field.clientWidth || window.innerWidth, h = field.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the belt the same on screen height, widen the view on narrow screens.
    camera.fov = phone.matches ? 40 : 24;
    camera.updateProjectionMatrix();
    rig.position.y = phone.matches ? -.3 : -.38;
    draw();
  }

  const tmp = new THREE.Vector3();
  function pose(it, t) {
    const s = window.EraseMeStage || st;
    const g = clamp(s.g || 0), c = clamp(s.c || 0);
    // The belt. Cards slide along a band from upper left to lower right and wrap round.
    const span = SPAN;
    let a = it.a0 + drift;
    a = ((a + span / 2) % span + span) % span - span / 2;
    const edge = clamp((span / 2 - Math.abs(a)) / 4);
    const y = it.y0 - (a - it.a0) * .034;
    const bob = motion() ? Math.sin(t * .00055 + it.seed) : 0;
    let ang = a, yy = y + bob * .06, rad = it.r0, roll = it.roll, op = edge;
    // Gather into a fanned row of quests. Tiles fall back and fade.
    if (it.isQ) {
      const k = it.k - 2.5;
      ang = lerp(ang, k * 3.3, g);
      yy = lerp(yy, .02 + Math.abs(k) * .05, g);
      rad = lerp(rad, 9 - it.k * .03, g);
      roll = lerp(roll, k * 2.6, g);
      op = lerp(op, 1, g);
    } else {
      rad = lerp(rad, rad + 4, g);
      op *= 1 - g * .92;
    }
    // Converge into one, then fade as the story card takes over.
    ang = lerp(ang, 0, c); yy = lerp(yy, 0, c); roll = lerp(roll, 0, c);
    op *= 1 - c;
    tmp.set(Math.sin(ang * DEG) * rad, yy, -Math.cos(ang * DEG) * rad);
    it.card.position.copy(tmp);
    it.card.rotation.set(bob * .07, -ang * DEG + bob * .05, roll * DEG);
    it.card.visible = op > .003;
    for (const m of it.mats) m.opacity = op;
  }

  function draw(t = performance.now()) {
    const s = window.EraseMeStage || st;
    rig.rotation.y = -(s.px || 0) * .07;
    rig.rotation.x = -(s.py || 0) * .035;
    for (const it of items) pose(it, t);
    renderer.render(scene, camera);
  }

  function loop(t) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(64, t - last);
    last = t;
    if (motion()) drift += dt * .0011;
    draw(t);
    raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  watch(field, (on) => { visible = on; kick(); });
  document.addEventListener('visibilitychange', kick);
  window.addEventListener('resize', resize);
  phone.addEventListener('change', resize);
  reduced.addEventListener('change', () => draw());
  resize();
  kick();
}

// ---------------------------------------------------------------- Routes chapter
const PAPER_Y = .0046;
const SCREEN_FLIP = false;
// One model per route, in the order of the pills. yaw turns the scan to face the camera.
const MODELS = [
  { dir: 'clipboard', file: 'clipboard_1k.gltf', yaw: 0, pitch: 1.42, size: 2.3 },
  { dir: 'classic_laptop', file: 'classic_laptop_1k.gltf', yaw: 0, pitch: .18, size: 2.05 },
  { dir: 'marble_bust_01', file: 'marble_bust_01_1k.gltf', yaw: 0, pitch: 0, size: 2.25 },
  { dir: 'kite_shield', file: 'kite_shield_1k.gltf', yaw: 0, pitch: -.05, size: 2.5 },
];

// One ashen finish across every scan. The diffuse colour becomes its own luminance with a faint cool cast,
// so wood, beige plastic and red paint all read as the same graphite and marble family.
function ashen(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float ashL = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
      ashL = pow(ashL, .92) * 1.06;
      diffuseColor.rgb = vec3(ashL) * vec3(.955, .975, 1.0);`);
  };
  material.customProgramCacheKey = () => 'ashen';
  material.needsUpdate = true;
}

function startRoutes(wrap, fonts) {
  const canvas = document.createElement('canvas');
  canvas.className = 'g-gl g-gl-totem';
  canvas.setAttribute('aria-hidden', 'true');
  wrap.append(canvas);
  const renderer = makeRenderer(canvas);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const { env } = environment(renderer);
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = .32;
  const camera = new THREE.PerspectiveCamera(26, 1, .1, 50);
  camera.position.set(0, .05, 7.4);
  // A warm key from the upper left, a denim rim from behind right, a low fill. Real light on real scans.
  const key = new THREE.DirectionalLight(0xfff6ea, 3.2);
  key.position.set(-3.5, 4, 4.5);
  const rim = new THREE.DirectionalLight(0x8ea6c2, 5.5);
  rim.position.set(4, 2.2, -4);
  const rim2 = new THREE.DirectionalLight(0xe6e5e1, 2.2);
  rim2.position.set(-4.5, .5, -3);
  const fill = new THREE.HemisphereLight(0xe6e5e1, 0x1c1d20, .35);
  scene.add(key, rim, rim2, fill);
  const stage = new THREE.Group();
  scene.add(stage);

  const loader = new GLTFLoader();
  const loaded = new Map();
  const holders = [];
  let current = -1, want = 0, swapAt = 0, prev = -1, visible = false, raf = 0, last = performance.now(), turn = 0;
  let tx = 0, px = 0;

  function load(i) {
    if (loaded.has(i)) return loaded.get(i);
    const m = MODELS[i];
    const p = new Promise((resolve, reject) => {
      loader.load(`/gl/models/${m.dir}/${m.file}`, (gltf) => {
        const obj = gltf.scene;
        obj.traverse((n) => {
          if (n.isMesh) {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach(ashen);
          }
        });
        dress(i, obj);
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        obj.position.sub(centre);
        const holder = new THREE.Group();
        const inner = new THREE.Group();
        inner.add(obj);
        inner.scale.setScalar(m.size / Math.max(size.x, size.y, size.z));
        inner.rotation.set(m.pitch, m.yaw, 0);
        holder.add(inner);
        holder.visible = false;
        stage.add(holder);
        holders[i] = holder;
        resolve(holder);
        draw();
      }, undefined, reject);
    });
    loaded.set(i, p);
    p.catch(() => loaded.delete(i));
    return p;
  }

  // Real content on two scans. A paper opt-out form under the clipboard's clip, an email draft on the laptop screen.
  function dress(i, obj) {
    if (MODELS[i].dir === 'clipboard') {
      const tex = texture(drawForm(fonts), renderer);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(.205, .31), new THREE.MeshStandardMaterial({ map: tex, roughness: .85 }));
      ashen(paper.material);
      paper.rotation.x = -Math.PI / 2;
      paper.position.set(0, PAPER_Y, .0);
      obj.add(paper);
    }
    if (MODELS[i].dir === 'classic_laptop') {
      obj.traverse((n) => {
        if (!n.isMesh) return;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        const k = mats.findIndex((m) => m.name === 'classic_laptop_screen');
        if (k < 0) return;
        const tex = texture(drawEmail(fonts), renderer);
        tex.flipY = SCREEN_FLIP;
        // The scan maps the screen to a small patch of UV space. Stretch the draft over exactly that patch.
        const uv = n.geometry.attributes.uv;
        if (uv) {
          let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
          for (let j = 0; j < uv.count; j++) {
            const u = uv.getX(j), v = uv.getY(j);
            u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
          }
          const su = 1 / Math.max(1e-4, u1 - u0), sv = 1 / Math.max(1e-4, v1 - v0);
          tex.repeat.set(su, sv);
          tex.offset.set(-u0 * su, -v0 * sv);
          window.__screenUV = [u0, u1, v0, v1];
        }
        const screen = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .55, roughness: .35 });
        screen.name = 'erase-me-screen';
        if (Array.isArray(n.material)) n.material[k] = screen; else n.material = screen;
      });
    }
  }

  function show(i) {
    want = i;
    load(i).then(() => {
      if (want !== i) return;
      prev = current;
      current = i;
      swapAt = performance.now();
      kick();
    }).catch(() => {});
  }

  const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
  function draw(t = performance.now()) {
    const k = motion() ? ease((t - swapAt) / 900) : 1;
    px += (tx - px) * .05;
    holders.forEach((h, i) => {
      if (!h) return;
      if (i === current) {
        h.visible = true;
        h.scale.setScalar(lerp(.86, 1, k));
        h.position.y = lerp(-.5, 0, k);
        h.rotation.y = (motion() ? Math.sin(turn) * .55 + lerp(-1.4, 0, k) : 0) + px * .35;
      } else if (i === prev && k < 1) {
        h.visible = true;
        const o = ease((t - swapAt) / 420);
        h.scale.setScalar(lerp(1, .7, o));
        h.position.y = lerp(0, .6, o);
        h.rotation.y += .04;
        if (o >= 1) h.visible = false;
      } else h.visible = false;
    });
    renderer.render(scene, camera);
  }
  function loop(t) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(64, t - last);
    last = t;
    if (motion()) turn += dt * .00042;
    draw(t);
    raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = phone.matches ? 30 : 26;
    camera.updateProjectionMatrix();
    draw();
  }
  window.addEventListener('resize', resize);
  phone.addEventListener('change', resize);
  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width * 2 - 1;
  });
  document.addEventListener('g-route', (e) => show(Number(e.detail) || 0));
  document.addEventListener('visibilitychange', kick);

  // Load the first scan when the chapter comes near, the rest once it is on screen.
  let started = false;
  const near = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting) || started) return;
    started = true;
    near.disconnect();
    resize();
    const pressed = document.querySelector('.g-pill[aria-pressed="true"]');
    show(pressed ? Number(pressed.dataset.route) || 0 : 0);
  }, { rootMargin: '120% 0px' });
  near.observe(wrap);
  watch(wrap, (on) => {
    visible = on;
    if (on) { resize(); MODELS.forEach((_, i) => load(i).catch(() => {})); }
    kick();
  });
}

// ---------------------------------------------------------------- Boot
function boot() {
  if (!webglOK()) return;
  const field = document.getElementById('g-field');
  const wrap = document.querySelector('.g-token-wrap');
  const sans = getComputedStyle(document.documentElement).getPropertyValue('--sans').trim() || 'system-ui, sans-serif';
  const go = () => {
    try {
      if (field) startField(field, { sans });
      if (wrap) startRoutes(wrap, { sans });
      const css = getComputedStyle(document.documentElement);
      const fonts = { sans, ui: 'system-ui, -apple-system, sans-serif', display: css.getPropertyValue('--display').trim() || 'serif' };
      const storyPhone = document.querySelector('.g-burn .g-phone');
      if (storyPhone) startPhone(storyPhone, { fonts, stage: () => (window.EraseMeStage ? window.EraseMeStage.ph : 1) });
      const voicePhone = document.querySelector('.g-voice .g-phone');
      if (voicePhone) startPhone(voicePhone, { fonts, dark: true });
      root.classList.add('gl-on');
    } catch {
      root.classList.remove('gl-on');
    }
  };
  // Card faces need the real font before they are drawn into textures.
  if (document.fonts && document.fonts.load) {
    const display = getComputedStyle(document.documentElement).getPropertyValue('--display').trim() || 'serif';
    Promise.all([document.fonts.load(`700 60px ${sans}`), document.fonts.load(`400 30px ${sans}`), document.fonts.load(`300 25px ${display}`)]).then(go, go);
  } else go();
}
boot();
