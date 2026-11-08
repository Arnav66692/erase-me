// Landing motion for the fusion layer. Original code.
// Grail: the curved card belt, the letter rise, the chapter card tilt and the travelling dock.
// jjettas: the pinned card row, card tilt with a sheen, wheel smoothing at lerp .16.
// Live readings on the dashboard are never animated. Everything here stops for reduced motion.
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const phone = window.matchMedia('(max-width: 767px)');
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const welcome = $('welcome-view');
  const stage = $('fx-stage');
  if (!welcome || !stage) return;
  const field = $('fx-field');
  const heading = $('hero-heading');
  const giant = $('fx-giant');
  const moments = $('fx-moments');
  const track = $('fx-track');
  const chapterCard = $('fx-chapter-card');
  const dock = $('fx-dock');
  const landingVisible = () => !welcome.hidden;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const motion = () => !reduced.matches;

  // ---- The card belt. Removal tasks written as short statements, plus flat pattern tiles.
  const QUESTS = [
    { pat: 'pat-check', group: 'People search', line: 'Ask a people-search site to drop your home address.', small: 'Use its own form. Keep the confirmation.', chips: ['Form', 'Email', '+12'] },
    { pat: 'pat-stripe', group: 'California', line: 'Send one deletion request to every registered broker.', small: 'Through the state DROP platform. Free for residents.', chips: ['Portal', 'One request'] },
    { pat: 'pat-dots', group: 'Caller ID', line: 'Take your number out of a caller-ID app.', small: 'Unlisting is a setting, not a deletion.', chips: ['App', 'Settings'] },
    { pat: 'pat-check-denim', group: 'Verify', line: 'Check that last week’s request actually stuck.', small: 'A request sent is not yet a removal.', chips: ['Recheck', 'Record'] },
    { pat: 'pat-wave', group: 'Search', line: 'Find every listing with your age and city on it.', small: 'Name plus age or city tells you apart.', chips: ['Search', 'Match'] },
    { pat: 'pat-diamond', group: 'Old accounts', line: 'Close the sign-ups you forgot about.', small: 'Deletion links, sorted by how hard they are.', chips: ['Link', 'Account'] },
  ];
  const TILES = ['pat-check', 'pat-wave', 'pat-bars', 'pat-dots', 'pat-stripe', 'pat-steps', 'pat-diamond', 'pat-check-denim', 'pat-wave', 'pat-bars'];

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function quest(q) {
    const c = el('div', 'fx-card is-quest');
    const chips = el('p', 'fx-chips');
    q.chips.forEach((t) => chips.append(el('span', '', t)));
    c.append(el('i', 'fx-crest ' + q.pat), el('p', 'fx-card-group', q.group), el('p', 'fx-card-line', q.line),
      el('p', 'fx-card-small', q.small), chips, el('p', 'fx-card-foot', 'Removal depends on each site.'));
    return c;
  }
  if (field) {
    const ring = el('div', 'fx-ring');
    // Two strands that wrap around the camera and fall from upper left to lower right.
    const count = phone.matches ? 6 : 6;
    const spread = phone.matches ? 44 : 78;
    let qi = 0, ti = 0, n = 0;
    for (let strand = 0; strand < 2; strand++) {
      for (let k = 0; k < count; k++) {
        const t = (k + strand * .5) / (count - .5);
        const isQuest = (k + strand) % 2 === (strand ? 1 : 0) && qi < QUESTS.length;
        const card = isQuest ? quest(QUESTS[qi++]) : el('div', 'fx-card is-tile ' + TILES[ti++ % TILES.length]);
        const a = spread - 2 * spread * t;
        const y = (phone.matches ? -150 : -250) + t * (phone.matches ? 300 : 470) + strand * (phone.matches ? 150 : 190) + (((k * 53) % 40) - 20);
        card.style.setProperty('--a', a.toFixed(1) + 'deg');
        card.style.setProperty('--r', (phone.matches ? -460 : -780) + 'px');
        card.style.setProperty('--y', y.toFixed(0) + 'px');
        card.style.setProperty('--rz', (((n * 7) % 9) - 4) + 'deg');
        card.style.setProperty('--dur', (6 + (n % 4)) + 's');
        card.style.setProperty('--delay', (-n * 1.3) + 's');
        ring.append(card);
        n++;
      }
    }
    field.append(ring);
  }

  // ---- Headline letters, with one readable copy for assistive tech.
  if (heading) {
    const sr = el('span', 'fx-sr', heading.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    for (const line of heading.querySelectorAll('.fx-line')) {
      const text = line.textContent;
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      for (const ch of text) {
        const s = el('span', 'fx-ch', ch === ' ' ? ' ' : ch);
        s.style.setProperty('--i', i++);
        line.append(s);
      }
    }
    heading.prepend(sr);
  }

  // Fit text to the width minus both margins. Grail fits its hero line, jjettas fills the width with its giant word.
  function textWidth(node) {
    if (node === heading) {
      const ls = [...node.querySelectorAll('.fx-line')];
      if (phone.matches) return Math.max(...ls.map((l) => l.getBoundingClientRect().width));
      return ls[ls.length - 1].getBoundingClientRect().right - ls[0].getBoundingClientRect().left;
    }
    const r = document.createRange();
    r.selectNodeContents(node);
    return r.getBoundingClientRect().width;
  }
  function fitTo(node, prop, max) {
    if (!node) return;
    node.style.setProperty(prop, '100px');
    const side = parseFloat(getComputedStyle(node).paddingLeft) || 0;
    const room = node.clientWidth - side * 2;
    const w = textWidth(node);
    if (w > 0 && room > 0) node.style.setProperty(prop, Math.min(100 * room / w, max).toFixed(2) + 'px');
  }
  function fitAll() { fitTo(heading, '--fit', 260); fitTo(giant, '--gfit', 520); layout(); }
  const ready = () => { fitAll(); if (heading) heading.classList.add('fx-ready'); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ready); else ready();
  window.addEventListener('resize', fitAll);
  phone.addEventListener('change', fitAll);

  // ---- Pinned card row. The section is as tall as the row is wide, so vertical scroll walks it sideways.
  let travel = 0;
  function layout() {
    if (!moments || !track) return;
    const pinned = motion() && !phone.matches;
    travel = pinned ? Math.max(0, track.scrollWidth - window.innerWidth) : 0;
    track.style.setProperty('--travel', travel + 'px');
    moments.style.height = pinned ? (window.innerHeight + travel) + 'px' : '';
    onScroll();
  }

  // ---- Scroll state.
  const toned = [...document.querySelectorAll('[data-tone]')].filter((n) => n !== body);
  function toneAt(y) {
    let tone = 'dark';
    for (const n of toned) {
      const r = n.getBoundingClientRect();
      if (r.height && r.top <= y && r.bottom > y) tone = n.dataset.tone;
    }
    return tone;
  }
  function onScroll() {
    if (!landingVisible()) { body.dataset.tone = 'light'; return; }
    body.dataset.tone = toneAt(36);
    const vh = window.innerHeight;
    stage.style.setProperty('--p', motion() ? clamp(window.scrollY / Math.max(1, stage.offsetHeight - vh)).toFixed(3) : '0');
    if (moments && travel) moments.style.setProperty('--mp', clamp(-moments.getBoundingClientRect().top / travel).toFixed(4));
    if (chapterCard) chapterCard.style.setProperty('--cp', motion() ? clamp((vh - chapterCard.getBoundingClientRect().top) / vh).toFixed(3) : '1');
    if (dock) {
      const max = document.documentElement.scrollHeight - vh;
      const footer = document.querySelector('.site-footer');
      const atFooter = footer && footer.getBoundingClientRect().top < vh - 40;
      dock.classList.toggle('is-on', window.scrollY > vh * .6 && !atFooter);
      dock.style.setProperty('--dp', phone.matches || !motion() ? '0' : clamp(window.scrollY / Math.max(1, max)).toFixed(4));
      dock.dataset.theme = toneAt(vh - 50);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  new MutationObserver(layout).observe(welcome, { attributes: true, attributeFilter: ['hidden'] });
  reduced.addEventListener('change', layout);
  layout();

  // ---- Pointer follow for the belt, eased per frame.
  const ring = field && field.querySelector('.fx-ring');
  let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
  function follow() {
    px += (tx - px) * .06; py += (ty - py) * .06;
    if (ring) { ring.style.setProperty('--px', px.toFixed(4)); ring.style.setProperty('--py', py.toFixed(4)); }
    raf = Math.abs(tx - px) + Math.abs(ty - py) > .001 ? requestAnimationFrame(follow) : 0;
  }
  window.addEventListener('pointermove', (e) => {
    if (!motion() || !finePointer.matches || !landingVisible() || window.scrollY > window.innerHeight) return;
    tx = e.clientX / window.innerWidth * 2 - 1;
    ty = e.clientY / window.innerHeight * 2 - 1;
    if (!raf) raf = requestAnimationFrame(follow);
  }, { passive: true });

  // ---- Framed cards tilt toward the pointer and catch a sheen.
  for (const card of document.querySelectorAll('.fx-rcard')) {
    const frame = card.querySelector('.fx-rcard-frame');
    card.addEventListener('pointermove', (e) => {
      if (!motion() || !finePointer.matches) return;
      const r = frame.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      frame.style.setProperty('--ty', ((x - .5) * 16).toFixed(2) + 'deg');
      frame.style.setProperty('--tx', ((.5 - y) * 12).toFixed(2) + 'deg');
      frame.style.setProperty('--sx', (x * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => { frame.style.setProperty('--ty', '0deg'); frame.style.setProperty('--tx', '0deg'); });
  }

  // ---- Wheel smoothing on the landing only. Keyboard, anchors and touch stay native.
  let target = window.scrollY, current = window.scrollY, smoothing = false;
  function blocked(e) {
    if (e.ctrlKey || !motion() || !finePointer.matches || !landingVisible()) return true;
    if (document.querySelector('dialog[open]')) return true;
    for (let n = e.target; n && n !== body; n = n.parentElement) {
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
  window.addEventListener('wheel', (e) => {
    if (blocked(e) || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (!smoothing) target = current = window.scrollY;
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    target = Math.max(0, Math.min(max, target + e.deltaY * unit * .72 * 1.4));
    if (!smoothing) { smoothing = true; requestAnimationFrame(step); }
  }, { passive: false });
  window.addEventListener('scroll', () => { if (!smoothing) target = current = window.scrollY; }, { passive: true });
})();
