// Landing motion for the fusion layer. Original code.
// Grail: card field, letter rise, tilt-in cards. jjettas: wheel smoothing (lerp .16) and the slanted wipe.
// Live readings on the dashboard are never animated. Everything here stops for reduced motion.
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const phone = window.matchMedia('(max-width: 767px)');
  const body = document.body;
  const welcome = document.getElementById('welcome-view');
  const stage = document.getElementById('fx-stage');
  const field = document.getElementById('fx-field');
  const heading = document.getElementById('hero-heading');
  if (!welcome || !stage) return;
  const landingVisible = () => !welcome.hidden;

  // ---- Card field. Fictional listing cards and flat tiles, built here so the HTML stays readable.
  const CARDS = [
    { x: 8, y: 50, z: -140, ry: 18, rz: -6, kind: 'listing', title: 'Your address', stamp: 'Listed' },
    { x: 21, y: 74, z: 30, ry: 10, rz: 4, kind: 'tile', tile: 'var(--denim)' },
    { x: 31, y: 44, z: -420, ry: -8, rz: 3, kind: 'listing', title: 'Your phone', stamp: 'Requested' },
    { x: 41, y: 70, z: 90, ry: -14, rz: -5, kind: 'listing', title: 'Your age', stamp: 'Listed' },
    { x: 53, y: 47, z: -260, ry: 12, rz: 6, kind: 'tile', tile: 'var(--ash)' },
    { x: 63, y: 72, z: -60, ry: -20, rz: -3, kind: 'listing', title: 'Your family', stamp: 'Removed', erased: true },
    { x: 76, y: 46, z: -120, ry: -10, rz: 5, kind: 'listing', title: 'Your name', stamp: 'Listed' },
    { x: 89, y: 70, z: -40, ry: -24, rz: -7, kind: 'tile', tile: 'var(--ink)', stroke: 'var(--paper)', border: true },
    { x: 15, y: 30, z: -620, ry: 22, rz: 8, kind: 'tile', tile: 'var(--paper)' },
    { x: 86, y: 28, z: -560, ry: -16, rz: 4, kind: 'listing', title: 'Your email', stamp: 'Requested' },
    { x: 47, y: 26, z: -720, ry: 6, rz: -4, kind: 'tile', tile: 'var(--denim)', stroke: 'var(--paper)' },
  ];
  const ROWS = [['Age', 72], ['Lives in', 88], ['Phone', 64], ['Relatives', 80], ['Email', 58]];

  function card(spec, index) {
    const el = document.createElement('div');
    el.className = 'fx-card' + (spec.kind === 'tile' ? ' is-tile' : '') + (spec.erased ? ' is-erased' : '');
    const set = (k, v) => el.style.setProperty(k, v);
    set('--x', spec.x + '%'); set('--y', spec.y + '%'); set('--z', spec.z + 'px');
    set('--ry', spec.ry + 'deg'); set('--rz', spec.rz + 'deg');
    set('--dur', (8 + (index % 4) * 1.3) + 's'); set('--delay', (-index * 1.7) + 's');
    set('--dx', ((index % 3) - 1) * 10 + 'px'); set('--dy', (index % 2 ? 12 : -16) + 'px');
    // Depth fog, as in the reference field. Far cards sink toward the black ground.
    el.style.filter = 'brightness(' + Math.max(.28, Math.min(1, 1 + spec.z / 640)).toFixed(2) + ')';
    if (spec.kind === 'tile') {
      set('--tile', spec.tile);
      if (spec.stroke) set('--stroke', spec.stroke);
      if (spec.border) el.style.boxShadow = '0 24px 50px rgba(0,0,0,.45), inset 0 0 0 1px rgba(251,251,250,.18)';
      return el;
    }
    const kicker = document.createElement('p');
    kicker.className = 'fx-card-kicker';
    kicker.innerHTML = '<span>Record ' + String(140 + index * 37).padStart(4, '0') + '</span><span>Public</span>';
    const name = document.createElement('p');
    name.className = 'fx-card-name';
    name.textContent = spec.title;
    el.append(kicker, name);
    for (let r = 0; r < 4; r++) {
      const [label, width] = ROWS[(index + r) % ROWS.length];
      const row = document.createElement('p');
      row.className = 'fx-card-row';
      const b = document.createElement('b'); b.textContent = label;
      const i = document.createElement('i'); i.style.setProperty('--w', (width - (r * 7 + index * 3) % 30) + '%');
      row.append(b, i);
      el.append(row);
    }
    const stamp = document.createElement('span');
    stamp.className = 'fx-card-stamp';
    stamp.textContent = spec.stamp;
    el.append(stamp);
    return el;
  }

  let tilt = null;
  if (field) {
    tilt = document.createElement('div');
    tilt.className = 'fx-tilt';
    CARDS.forEach((spec, i) => { if (!(phone.matches && i % 3 === 2)) tilt.append(card(spec, i)); });
    field.append(tilt);
  }

  // ---- Headline. Split into letters for the rise, keep one readable copy for assistive tech.
  if (heading) {
    const sr = document.createElement('span');
    sr.className = 'fx-sr';
    sr.textContent = heading.textContent.replace(/\s+/g, ' ').trim();
    let n = 0;
    for (const line of heading.querySelectorAll('.fx-line')) {
      const text = line.textContent;
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      for (const ch of text) {
        const s = document.createElement('span');
        s.className = 'fx-ch';
        s.textContent = ch === ' ' ? ' ' : ch;
        s.style.setProperty('--i', n++);
        line.append(s);
      }
    }
    heading.prepend(sr);
  }

  // Fit the headline to the width minus both side margins, Grail style.
  // Desktop sets it on one line, the phone on two.
  function fit() {
    if (!heading) return;
    heading.style.setProperty('--fit', '100px');
    const side = parseFloat(getComputedStyle(heading).paddingLeft) || 0;
    const room = heading.clientWidth - side * 2;
    let widest = 0;
    if (phone.matches) {
      widest = Math.max(...[...heading.querySelectorAll('.fx-line')].map(l => l.getBoundingClientRect().width));
    } else {
      const lines = [...heading.querySelectorAll('.fx-line')];
      widest = lines[lines.length - 1].getBoundingClientRect().right - lines[0].getBoundingClientRect().left;
    }
    if (widest > 0 && room > 0) heading.style.setProperty('--fit', Math.min(100 * room / widest, 260).toFixed(2) + 'px');
  }
  const ready = () => { fit(); heading && heading.classList.add('fx-ready'); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ready); else ready();
  window.addEventListener('resize', fit);
  phone.addEventListener('change', fit);

  // ---- Tilt-in for Grail cards.
  const tiltTargets = document.querySelectorAll('.fx .onboarding-column, .fx .step-rows li');
  if ('IntersectionObserver' in window && !reduced.matches) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px' });
    tiltTargets.forEach(el => { el.classList.add('fx-tilt-in'); io.observe(el); });
  }

  // ---- Scroll state. Tone under the header and the wipe value.
  const toned = [...document.querySelectorAll('[data-tone]')];
  function onScroll() {
    if (!landingVisible()) { body.dataset.tone = 'light'; return; }
    const probe = 36;
    let tone = 'dark';
    for (const el of toned) {
      const r = el.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe && el.offsetParent !== null) tone = el.dataset.tone;
    }
    // The slanted ash panel covers the stage before the stage itself scrolls away.
    const ash = document.getElementById('start');
    if (ash && ash.getBoundingClientRect().top <= probe) tone = tone === 'dark' ? 'ash' : tone;
    body.dataset.tone = tone;
    const travel = Math.max(1, stage.offsetHeight - window.innerHeight);
    const wipe = reduced.matches ? 0 : Math.min(1, Math.max(0, window.scrollY / travel));
    stage.style.setProperty('--wipe', wipe.toFixed(3));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  new MutationObserver(onScroll).observe(welcome, { attributes: true, attributeFilter: ['hidden'] });
  onScroll();

  // ---- Pointer follow for the field, eased per frame.
  let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
  function follow() {
    px += (tx - px) * .06; py += (ty - py) * .06;
    if (tilt) { tilt.style.setProperty('--px', px.toFixed(4)); tilt.style.setProperty('--py', py.toFixed(4)); }
    raf = Math.abs(tx - px) + Math.abs(ty - py) > .001 ? requestAnimationFrame(follow) : 0;
  }
  window.addEventListener('pointermove', e => {
    if (reduced.matches || !finePointer.matches || !landingVisible() || window.scrollY > window.innerHeight) return;
    tx = e.clientX / window.innerWidth * 2 - 1;
    ty = e.clientY / window.innerHeight * 2 - 1;
    if (!raf) raf = requestAnimationFrame(follow);
  }, { passive: true });

  // ---- Wheel smoothing on the landing only. Keyboard, anchors and touch stay native.
  let target = window.scrollY, current = window.scrollY, smoothing = false;
  function blocked(e) {
    if (e.ctrlKey || reduced.matches || !finePointer.matches || !landingVisible()) return true;
    if (document.querySelector('dialog[open]')) return true;
    for (let n = e.target; n && n !== document.body; n = n.parentElement) {
      if (n.matches && n.matches('textarea, select, dialog, [contenteditable]')) return true;
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return true;
    }
    return false;
  }
  function step() {
    current += (target - current) * .16;
    if (Math.abs(target - current) < .5) current = target;
    window.scrollTo(0, current);
    smoothing = current !== target;
    if (smoothing) requestAnimationFrame(step);
  }
  window.addEventListener('wheel', e => {
    if (blocked(e) || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (!smoothing) { target = current = window.scrollY; }
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    target = Math.max(0, Math.min(max, target + e.deltaY * unit * .72 * 1.4));
    if (!smoothing) { smoothing = true; requestAnimationFrame(step); }
  }, { passive: false });
  window.addEventListener('scroll', () => { if (!smoothing) target = current = window.scrollY; }, { passive: true });
})();
