// Landing motion in the grail-app.com design language. Original code.
// The loader, the letter rise, the CSS 3D card field, the pinned scroll story with the listing card
// that gets erased, folds and lands in the phone, the tilting chapter card, the route pills,
// the falling tiles, the travelling dock and wheel smoothing at lerp .1.
// Live readings on the dashboard are never animated. Reduced motion stops all of it.
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const phone = window.matchMedia('(max-width: 767px)');
  const $ = (id) => document.getElementById(id);
  const welcome = $('welcome-view');
  const story = $('g-story');
  const stage = $('g-stage');
  if (!welcome || !story || !stage) return;
  root.classList.add('g-js');

  const body = document.body;
  const motion = () => !reduced.matches;
  const landingVisible = () => !welcome.hidden;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (v) => { const t = clamp(v); return t * t * (3 - 2 * t); };
  const range = (s, a, b) => clamp((s - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const set = (node, prop, value) => { if (node) node.style.setProperty(prop, value); };
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  // ---- Loader. The CSS runs the timeline, this only counts the percent and sizes the zoom.
  const loader = $('g-loader');
  const loaderRan = Boolean(loader) && motion() && landingVisible();
  if (loader) {
    if (!loaderRan) loader.remove();
    else {
      const card = loader.querySelector('.g-loader-card');
      set(card, '--zs', (Math.max(window.innerWidth / 74, window.innerHeight / 108) * 1.12).toFixed(2));
      const pc = $('g-loader-pc');
      const t0 = performance.now();
      const count = (t) => {
        const k = clamp((t - t0) / 760);
        if (pc) pc.textContent = String(Math.round(k * k * (3 - 2 * k) * 100));
        if (k < 1) requestAnimationFrame(count);
      };
      requestAnimationFrame(count);
      setTimeout(() => loader.remove(), 1550);
    }
  }

  // ---- The card field. Removal tasks written as short statements, plus flat pattern tiles.
  const QUESTS = [
    { pat: 'pat-check', group: 'People search', line: 'Ask a people-search site to drop your home address.', small: 'Use its own form. Keep the confirmation.', chips: ['Form', 'Email'] },
    { pat: 'pat-wave', group: 'California', line: 'Send one deletion request to every registered broker.', small: 'Through the state DROP platform. Free for residents.', chips: ['Portal', 'One request'] },
    { pat: 'pat-key', group: 'Caller ID', line: 'Take your number out of a caller ID app.', small: 'Unlisting is a setting, not a deletion.', chips: ['App', 'Settings'] },
    { pat: 'pat-stamp', group: 'Verify', line: 'Check that last week’s request actually stuck.', small: 'A request sent is not yet a removal.', chips: ['Recheck', 'Record'] },
    { pat: 'pat-zig', group: 'Search', line: 'Find every listing with your age and city on it.', small: 'Name plus age or city tells you apart.', chips: ['Search', 'Match'] },
    { pat: 'pat-lines', group: 'Old accounts', line: 'Close the sign-ups you forgot about.', small: 'Import your list, then choose keep or remove.', chips: ['List', 'Plan'] },
  ];
  // [kind, angle to the right in deg, screen y from the rig centre in px, depth, roll, pattern]
  const ITEMS = [
    ['t', -31, -300, -120, -3, 'pat-wave'], ['t', -16, -250, -60, 2, 'pat-key'], ['t', 2, -215, -80, -2, 'pat-stamp'],
    ['t', 15, -240, -170, 3, 'pat-check'], ['t', 36, -225, -40, -2, 'pat-key'], ['t', -49, -30, -220, 4, 'pat-zig'],
    ['t', 53, 50, -260, -4, 'pat-lines'], ['t', -22, 120, 40, -5, 'pat-stamp'], ['t', -6, 150, -110, 2, 'pat-check'],
    ['t', 11, 205, 30, 4, 'pat-key'], ['t', 29, 255, 60, 7, 'pat-stamp'], ['t', 45, 310, 40, -9, 'pat-zig'],
    ['t', -36, 300, -40, 6, 'pat-lines'],
    ['q', -9, -10, 0, -1.5], ['q', 18, -75, -40, 2], ['q', -41, 60, 20, 0],
    ['q', 43, -140, -120, 0], ['q', -1, 330, -260, 3], ['q', 29, 285, -210, -3],
  ];
  function quest(q) {
    const face = el('div', 'g-face is-quest');
    const chips = el('p', 'g-chips');
    q.chips.forEach((t) => chips.append(el('span', '', t)));
    face.append(el('i', 'g-crest ' + q.pat), el('p', 'g-card-group', q.group), el('p', 'g-card-line', q.line),
      el('p', 'g-card-small', q.small), chips, el('p', 'g-card-foot', 'Removal depends on each site.'));
    return face;
  }
  const field = $('g-field');
  const rig = el('div', 'g-rig');
  const cards = [];
  if (field) {
    let qi = 0;
    ITEMS.forEach((it, n) => {
      const isQuest = it[0] === 'q';
      const card = el('div', 'g-card');
      const face = isQuest ? quest(QUESTS[qi % QUESTS.length]) : el('div', 'g-face is-tile ' + it[5]);
      if (isQuest) card.dataset.k = String(qi++);
      card.append(face);
      set(card, '--w', isQuest ? '290px' : '178px');
      set(face, '--rad', isQuest ? '18px' : '12px');
      set(face, '--dur', (6 + (n % 4) * .9).toFixed(1) + 's');
      set(face, '--delay', (-n * 1.37).toFixed(2) + 's');
      set(face, '--lit', (1 - Math.min(.2, Math.abs(it[1]) / 200) - Math.max(0, -it[3]) / 1600).toFixed(3));
      card.dataset.item = String(n);
      rig.append(card);
      cards.push({ card, it, isQuest });
    });
    field.append(rig);
  }
  // Place each card so it lands at the screen y we asked for, whatever its depth.
  function placeCards() {
    const vh = stage.clientHeight || window.innerHeight;
    const oy = vh * (phone.matches ? .2 : .2);
    const yFor = (deg, sy, dz) => {
      const z = 250 + (dz - 780) * Math.cos(deg * Math.PI / 180);
      const s = 1000 / (1000 - z);
      return (oy + sy) / s - oy;
    };
    const k = phone.matches ? .86 : clamp(Math.min(window.innerWidth / 1440, vh / 900), .72, 1.3);
    set(rig, '--k', k.toFixed(3));
    for (const { card, it, isQuest } of cards) {
      const [, deg, sy, dz, rz] = it;
      const qk = isQuest ? Number(card.dataset.k) : 0;
      const fa = isQuest ? (qk - 2.5) * 8.5 : deg * .45;
      const fsy = isQuest ? -30 + Math.abs(qk - 2.5) * 10 : sy * .45 - 40;
      const fdz = isQuest ? 90 - Math.abs(qk - 2.5) * 20 : dz - 220;
      set(card, '--a', (-deg).toFixed(1) + 'deg');
      set(card, '--y', yFor(deg, sy, dz).toFixed(1) + 'px');
      set(card, '--dz', dz + 'px');
      set(card, '--rz', rz + 'deg');
      set(card, '--fa', (-fa).toFixed(1) + 'deg');
      set(card, '--fy', yFor(fa, fsy, fdz).toFixed(1) + 'px');
      set(card, '--fdz', fdz + 'px');
      set(card, '--frz', (isQuest ? (qk - 2.5) * 3 : rz * 2) + 'deg');
      set(card, '--fade', isQuest ? '0' : '1');
    }
  }

  // ---- Headline letters, with one readable copy for assistive tech.
  const heading = $('hero-heading');
  if (heading) {
    const sr = el('span', 'g-sr', heading.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    for (const line of heading.querySelectorAll('.g-line')) {
      const text = line.textContent;
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      for (const ch of text) {
        const s = el('span', 'g-ch', ch === ' ' ? '\u00a0' : ch);
        set(s, '--i', String(i++));
        line.append(s);
      }
    }
    heading.prepend(sr);
  }
  // Rising lines get their stagger index.
  for (const node of document.querySelectorAll('[data-rise]')) {
    node.querySelectorAll('.g-l').forEach((l, i) => set(l, '--li', String(i)));
  }

  // Fit the hero line to the width minus 80, as the reference does.
  function fitHero() {
    if (!heading) return;
    if (phone.matches) { heading.style.removeProperty('--fit'); return; }
    set(heading, '--fit', '100px');
    const lines = [...heading.querySelectorAll('.g-line')];
    const w = lines[lines.length - 1].getBoundingClientRect().right - lines[0].getBoundingClientRect().left;
    const room = heading.clientWidth - 80;
    if (w > 0 && room > 0) set(heading, '--fit', Math.min(100 * room / w, 260).toFixed(2) + 'px');
  }

  // ---- Chapter 05. Route pills change the name, the counter, the lines and the token face.
  const ROUTES = [
    { name: ['The', 'web form'], pat: 'pat-stamp', one: 'Most sites ask for a form. The workspace opens the right one.', p: 'Each broker has its own removal process. Supported routes can use the browser companion to fill required fields. You complete any broker email or verification step yourself.' },
    { name: ['The', 'email'], pat: 'pat-wave', one: 'Some sites take requests by email. You send it, and it is recorded.', p: 'Drafts are written for where you live. Replies go to the address you enter, and the workspace keeps the date each request went out.' },
    { name: ['The', 'state portal'], pat: 'pat-check', one: 'California residents can reach every registered broker with one request.', p: 'Through the state DROP platform, free for residents. Brokers must process a request within 45 days of receiving it.' },
    { name: ['The', 'companion'], pat: 'pat-key', one: 'A small Chrome extension fills the fields a form asks for.', p: 'It is narrowly permissioned and never adds fields on its own. A submitted form is an attempt, not a confirmed deletion.' },
  ];
  const token = $('g-token');
  let tokenFace = null;
  if (token) {
    for (let i = -7; i <= 7; i++) {
      const layer = el('i', i === 7 ? 'is-face' : i === -7 ? 'is-back' : '');
      set(layer, '--z', (i * 2.2).toFixed(1) + 'px');
      if (i !== 7 && i !== -7) set(layer, '--edge', `hsl(225 4% ${14 + (i + 7) * 1.2}%)`);
      token.append(layer);
      if (i === 7) tokenFace = layer;
    }
  }
  const nameBack = $('g-name-back');
  const nameFront = $('feature-name');
  function fitName() {
    if (!nameFront) return;
    const lastFront = nameFront.querySelector('span:last-child');
    set(nameFront, '--nfit', '100px');
    set(nameBack, '--nfit', '100px');
    const r = document.createRange();
    r.selectNodeContents(lastFront);
    const w = r.getBoundingClientRect().width;
    const room = nameFront.clientWidth - (phone.matches ? 32 : 80);
    const size = Math.min(100 * room / Math.max(1, w), phone.matches ? 60 : 208);
    set(nameFront, '--nfit', size.toFixed(1) + 'px');
    set(nameBack, '--nfit', size.toFixed(1) + 'px');
  }
  function showRoute(n) {
    const r = ROUTES[n];
    if (!r) return;
    for (const node of [nameBack, nameFront]) {
      if (!node) continue;
      const spans = node.querySelectorAll('span[aria-hidden], .g-name-back > span');
      const visible = [...node.children].filter((c) => !c.classList.contains('g-sr'));
      if (visible[0]) visible[0].textContent = r.name[0];
      if (visible[1]) visible[1].textContent = r.name[1];
      void spans;
    }
    const sr = nameFront && nameFront.querySelector('.g-sr');
    if (sr) sr.textContent = r.name.join(' ');
    const count = $('g-count');
    if (count) count.textContent = `(${n + 1})`;
    const one = $('g-feature-one');
    if (one) one.textContent = r.one;
    const p = $('g-feature-p');
    if (p) p.textContent = r.p;
    if (tokenFace) tokenFace.className = 'is-face ' + r.pat;
    for (const b of document.querySelectorAll('.g-pill')) b.setAttribute('aria-pressed', String(Number(b.dataset.route) === n));
    fitName();
  }
  for (const b of document.querySelectorAll('.g-pill')) b.addEventListener('click', () => showRoute(Number(b.dataset.route)));
  showRoute(0);

  // ---- Chapter 06. Flat pattern tiles that fall and pile up in each column.
  const pile = $('g-pile');
  if (pile) {
    const PATS = ['pat-zig', 'pat-wave', 'pat-key', 'pat-stamp', 'pat-check', 'pat-lines'];
    const SHAPES = ['50%', '28%', '50% 50% 16% 16%', '34% 34% 50% 50%', '22%'];
    const COLS = [
      [[2, 0, 128, -8], [44, 0, 104, 12], [14, 116, 96, 24]],
      [[4, 0, 150, 6], [52, 0, 96, -14], [30, 136, 100, -4]],
      [[0, 0, 110, -6], [34, 0, 132, 10], [70, 0, 92, -20], [20, 104, 118, 16]],
      [[6, 0, 140, 14], [56, 0, 112, -8], [36, 126, 90, 4]],
    ];
    let n = 0;
    COLS.forEach((col, ci) => col.forEach(([x, b, s, rot]) => {
      const blob = el('i', 'g-blob ' + PATS[n % PATS.length]);
      set(blob, '--x', `calc(${ci * 25}% + ${x}% * .25 + 16px)`);
      set(blob, '--b', (b - 26) + 'px');
      set(blob, '--s', s + 'px');
      set(blob, '--rot', rot + 'deg');
      set(blob, '--r', SHAPES[n % SHAPES.length]);
      set(blob, '--d', ((n % 5) * .12 + ci * .09).toFixed(2) + 's');
      pile.append(blob);
      n++;
    }));
  }

  // ---- Lines that rise as they enter, outside the pinned story.
  const stageRise = new Set(stage.querySelectorAll('[data-rise]'));
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: .25 }) : null;
  for (const node of document.querySelectorAll('[data-rise]')) {
    if (stageRise.has(node)) continue;
    if (io && motion()) io.observe(node); else node.classList.add('is-in');
  }

  // ---- The scroll story and everything that follows scroll.
  const head = heading;
  const problem = $('g-problem');
  const burn = $('g-burn');
  const object = $('g-object');
  const phoneMock = burn && burn.querySelector('.g-phone');
  const problemHead = $('problem-heading');
  const problemBody = problem && problem.querySelector('.g-problem-body');
  const burnHead = $('start-heading');
  const rule = $('g-burn-rule');
  const ccard = $('g-ccard');
  const rows = [...document.querySelectorAll('.g-row')];
  const stats = $('g-stats');
  const get = $('start');
  const dock = $('g-dock');
  let land = { oy: 80, os: .88 };

  function measureLanding() {
    if (!object || !phoneMock) return;
    const sr = stage.getBoundingClientRect();
    const pr = phoneMock.getBoundingClientRect();
    const scale = pr.width / 220;
    const os = .88 * scale;
    const objCy = object.offsetTop + object.offsetHeight / 2;
    const phoneCy = pr.top + pr.height / 2 - sr.top;
    land = { oy: phoneCy - objCy + object.offsetHeight / 4 * os + 6 * scale, os };
  }
  const toggle = (node, cls, on) => { if (node) node.classList.toggle(cls, on); };

  function storyFrame(vh) {
    const s = motion() ? -story.getBoundingClientRect().top / vh : 0;
    if (!motion()) {
      set(head, '--hs', '1'); set(head, '--ho', '1'); set(head, '--hy', '0px');
      set(rig, '--g', '0'); set(rig, '--c', '0');
      set(object, '--oy', land.oy.toFixed(1) + 'px'); set(object, '--os', land.os.toFixed(3));
      set(object, '--fold', '1'); set(object, '--e', '1');
      set(burn, '--ph', '1'); set(burn, '--rule', '1');
      [problemHead, problemBody, burnHead].forEach((n) => toggle(n, 'is-in', true));
      stage.dataset.tone = 'dark';
      return;
    }
    const hs = range(s, 0, .5);
    set(head, '--hs', (1 - .62 * hs).toFixed(4));
    set(head, '--ho', (1 - hs).toFixed(3));
    set(head, '--hy', (-.18 * s * vh).toFixed(1) + 'px');
    const c = smooth(range(s, .6, 1.1));
    set(rig, '--g', smooth(range(s, .02, .55)).toFixed(4));
    set(rig, '--c', c.toFixed(4));
    if (field) field.style.visibility = c >= 1 ? 'hidden' : '';
    if (problem) {
      problem.style.visibility = s > 2.3 ? 'hidden' : '';
      set(problem, '--pt', ((1 - s) * vh).toFixed(1) + 'px');
    }
    toggle(problemHead, 'is-in', s > .28);
    toggle(problemBody, 'is-in', s > .42);
    const l = smooth(range(s, 2.3, 2.62));
    const oy = Math.max(0, 1.65 - s) * vh;
    set(object, '--oy', lerp(oy, land.oy, l).toFixed(1) + 'px');
    set(object, '--os', lerp(1, land.os, l).toFixed(4));
    set(object, '--e', range(s, 1.8, 2.1).toFixed(3));
    set(object, '--fold', smooth(range(s, 2.2, 2.45)).toFixed(4));
    const b = range(s, 2.12, 2.5);
    if (burn) {
      set(burn, '--bv', b > 0 ? 'visible' : 'hidden');
      set(burn, '--bs', (360 * Math.pow(1 - smooth(b), 1.15)).toFixed(2) + '%');
      set(burn, '--ph', range(s, 2.28, 2.55).toFixed(3));
      set(burn, '--rule', smooth(range(s, 2.55, 2.85)).toFixed(3));
    }
    toggle(burnHead, 'is-in', s > 2.4);
    stage.dataset.tone = s > 2.32 ? 'ash' : 'dark';
  }

  function toneUnderDock(vh) {
    const stack = document.elementsFromPoint(window.innerWidth / 2, vh - 30);
    for (const n of stack) {
      if (dock && dock.contains(n)) continue;
      const t = n.closest && n.closest('[data-tone]');
      if (t) return t.dataset.tone;
    }
    return 'dark';
  }

  function frame() {
    ticking = false;
    if (!landingVisible()) return;
    const vh = window.innerHeight;
    storyFrame(vh);
    if (ccard) {
      const r = ccard.getBoundingClientRect();
      set(ccard, '--cp', motion() ? clamp((vh - r.top) / vh).toFixed(4) : '1');
      set(ccard, '--lp', motion() ? clamp((vh - r.bottom) / vh).toFixed(4) : '0');
    }
    for (const row of rows) {
      const t = row.getBoundingClientRect().top;
      set(row, '--ro', motion() ? (.32 + .68 * clamp((vh * .95 - t) / (vh * .3))).toFixed(3) : '1');
    }
    if (pile && stats && !pile.classList.contains('is-down')) {
      const r = stats.getBoundingClientRect();
      if (r.top < vh * .25 || !motion()) pile.classList.add('is-down');
    }
    if (dock) {
      const getTop = get ? get.getBoundingClientRect().top : Infinity;
      const end = get ? get.offsetTop - vh * .6 : document.documentElement.scrollHeight - vh;
      const on = window.scrollY > vh * .6 && getTop > vh * .55;
      dock.classList.toggle('is-on', on);
      dock.classList.toggle('is-off', getTop <= vh * .55);
      set(dock, '--dp', phone.matches || !motion() ? '0' : clamp(window.scrollY / Math.max(1, end)).toFixed(4));
      dock.dataset.theme = toneUnderDock(vh);
    }
  }
  let ticking = false;
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };

  function layout() {
    const banner = $('demo-banner');
    set(body, '--banner-h', (banner && !banner.hidden ? banner.offsetHeight : 0) + 'px');
    placeCards();
    fitHero();
    fitName();
    measureLanding();
    request();
  }
  const ready = () => {
    layout();
    if (heading) {
      const wait = loaderRan ? Math.max(120, 1250 - performance.now()) : 120;
      set(heading, '--rise-at', Math.round(wait) + 'ms');
      heading.classList.add('g-ready');
    }
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ready); else ready();
  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('scroll', request, { passive: true });
  phone.addEventListener('change', layout);
  reduced.addEventListener('change', layout);
  new MutationObserver(layout).observe(welcome, { attributes: true, attributeFilter: ['hidden'] });
  const banner = $('demo-banner');
  if (banner) new MutationObserver(layout).observe(banner, { attributes: true, attributeFilter: ['hidden'] });

  // ---- Pointer follow for the field, eased per frame.
  let px = 0, py = 0, tx = 0, ty = 0, praf = 0;
  function follow() {
    px += (tx - px) * .06; py += (ty - py) * .06;
    set(rig, '--px', px.toFixed(4)); set(rig, '--py', py.toFixed(4));
    praf = Math.abs(tx - px) + Math.abs(ty - py) > .001 ? requestAnimationFrame(follow) : 0;
  }
  window.addEventListener('pointermove', (e) => {
    if (!motion() || !finePointer.matches || !landingVisible() || window.scrollY > window.innerHeight) return;
    tx = e.clientX / window.innerWidth * 2 - 1;
    ty = e.clientY / window.innerHeight * 2 - 1;
    if (!praf) praf = requestAnimationFrame(follow);
  }, { passive: true });

  // ---- Wheel smoothing like Lenis at lerp .1, landing only. Keyboard, anchors and touch stay native.
  let target = window.scrollY, current = window.scrollY, smoothing = false, last = 0;
  function blocked(e) {
    if (e.ctrlKey || !motion() || !finePointer.matches || !landingVisible()) return true;
    if (document.querySelector('dialog[open]')) return true;
    for (let n = e.target; n && n !== body; n = n.parentElement) {
      if (n.matches && n.matches('textarea, select, dialog, [contenteditable]')) return true;
      const st = getComputedStyle(n);
      if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight) return true;
    }
    return false;
  }
  function step(t) {
    const dt = last ? Math.min(64, t - last) : 16.7;
    last = t;
    current += (target - current) * (1 - Math.pow(.9, dt / 16.67));
    if (Math.abs(target - current) < .5) current = target;
    window.scrollTo(0, current);
    smoothing = current !== target;
    if (smoothing) requestAnimationFrame(step); else last = 0;
  }
  window.addEventListener('wheel', (e) => {
    if (blocked(e) || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (!smoothing) target = current = window.scrollY;
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    target = clamp(target + e.deltaY * unit, 0, max);
    if (!smoothing) { smoothing = true; requestAnimationFrame(step); }
  }, { passive: false });
  window.addEventListener('scroll', () => { if (!smoothing) target = current = window.scrollY; }, { passive: true });
})();
