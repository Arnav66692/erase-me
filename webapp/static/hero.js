// Landing motion in the jjettas.com design language. Original code, no libraries.
// Wheel smoothing (lerp .16, multiplier .72), the loader count, the hero wipe, the pinned card row,
// the quote reveal with thrown prints, the pinned feature pane, card tilt, tone switching and UI sounds.
// Everything stops for reduced motion. Dashboard numbers are never animated.
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(pointer: fine)');
  const phone = window.matchMedia('(max-width: 767px), (max-width: 900px) and (pointer: coarse)');
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const welcome = $('welcome-view');
  const stage = $('jj-stage');
  if (!welcome || !stage) return;
  const hero = $('jj-hero');
  const track = $('jj-track');
  const quote = $('jj-quote');
  const feature = $('jj-feature');
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const motion = () => !reduced.matches;
  const visible = () => !welcome.hidden;
  if (motion()) document.documentElement.classList.add('jj-motion');

  // ---- Sound. WebAudio voices made in code. Off until the visitor turns it on with a click.
  const sound = (() => {
    const btn = $('jj-sound');
    let ctx = null, on = false;
    try { on = localStorage.getItem('jj-sound') === 'on'; } catch { on = false; }
    function setLabel() {
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Interface sounds on. Turn off' : 'Interface sounds off. Turn on');
    }
    function voice(freq, dur, type, gain, slide) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + .006);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + .02);
    }
    function rub(dur, gain) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      f.type = 'bandpass';
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + dur);
      f.Q.value = .8;
      g.gain.value = gain;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t);
    }
    const api = {
      hover: () => voice(2200, .045, 'sine', .018),
      click: () => { voice(520, .09, 'triangle', .05, 260); rub(.05, .05); },
      slide: () => rub(.28, .06),
      reveal: () => { voice(660, .18, 'sine', .022); setTimeout(() => voice(990, .22, 'sine', .016), 70); },
    };
    if (btn) {
      setLabel();
      btn.addEventListener('click', () => {
        on = !on;
        if (on && !ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) ctx = new AC();
        }
        if (ctx && ctx.state === 'suspended') ctx.resume();
        try { localStorage.setItem('jj-sound', on ? 'on' : 'off'); } catch { /* storage blocked, keep the in-page state */ }
        setLabel();
        api.click();
      });
      // A remembered "on" still waits for a real click before any audio context exists.
      if (on) {
        const wake = () => {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!ctx && AC) ctx = new AC();
          window.removeEventListener('pointerdown', wake);
        };
        window.addEventListener('pointerdown', wake);
      }
    }
    return api;
  })();
  welcome.addEventListener('pointerover', (e) => {
    const t = e.target.closest('.jj-pill, .jj-roll, .jj-dot');
    if (t && !t.contains(e.relatedTarget)) sound.hover();
  });
  document.addEventListener('click', (e) => { if (e.target.closest('.jj-pill, .jj-roll, .jj-dot, .site-header a, .site-header button')) sound.click(); });

  // ---- Loader percent. The panel itself is timed in CSS and leaves by 1.2 s whatever happens here.
  const pct = $('jj-pct');
  if (pct && motion()) {
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.round(ease(clamp((now - t0) / 380)) * 100);
      pct.textContent = String(p);
      if (p < 100) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---- Ghost wordmarks behind the hero, long enough for a seamless 90 s loop.
  welcome.querySelectorAll('.jj-hero-ghost span').forEach((s) => { s.textContent = Array(8).fill('Erase me').join(' '); });

  // ---- Fit giant words to the frame width, capped at the measured reference sizes.
  function fitGiants() {
    const vu = Math.min(Math.min(innerWidth, 1728) / 100, 1.8 * Math.max(innerHeight / 100, 7));
    welcome.querySelectorAll('.jj-giant').forEach((g) => {
      const cap = phone.matches ? Infinity : (g.dataset.fit === 'feature' ? 30 : 21.76) * vu;
      const side = phone.matches ? 16 : (g.dataset.fit === 'feature' ? 64 : 40);
      let inner = g.firstElementChild;
      if (!inner) { inner = document.createElement('span'); inner.textContent = g.textContent; g.textContent = ''; g.append(inner); }
      g.style.setProperty('--gfs', '100px');
      const natural = inner.getBoundingClientRect().width || 1;
      const size = Math.min(cap, 100 * (Math.min(innerWidth, 1728) - side * 2) / natural);
      g.style.setProperty('--gfs', size.toFixed(2) + 'px');
    });
  }

  // ---- Wheel smoothing, written to match lerp .16 and wheel multiplier .72. Fine pointers only.
  const smooth = { on: false, target: 0, current: 0, ours: false };
  function scrollMax() { return document.documentElement.scrollHeight - innerHeight; }
  function startSmooth() {
    if (smooth.on || !motion() || !fine.matches) return;
    smooth.on = true;
    smooth.target = smooth.current = scrollY;
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', () => {
      if (smooth.ours) { smooth.ours = false; return; }
      if (Math.abs(scrollY - smooth.current) > 2) smooth.target = smooth.current = scrollY;
    }, { passive: true });
  }
  function scrollableParent(node) {
    for (let n = node; n && n !== document.body; n = n.parentElement) {
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'DIALOG') return true;
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return true;
    }
    return false;
  }
  function onWheel(e) {
    if (e.ctrlKey || !visible() || scrollableParent(e.target)) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    smooth.target = Math.max(0, Math.min(scrollMax(), smooth.target + e.deltaY * unit * .72));
  }
  function stepSmooth() {
    if (!smooth.on) return;
    const d = smooth.target - smooth.current;
    if (Math.abs(d) < .4) { if (d !== 0) { smooth.current = smooth.target; smooth.ours = true; window.scrollTo(0, smooth.current); } return; }
    smooth.current += d * .16;
    smooth.ours = true;
    window.scrollTo(0, smooth.current);
  }
  // Anchor links jump through the smoother so the target stays in sync.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !smooth.on || !visible()) return;
    const el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    const top = el.getBoundingClientRect().top + scrollY - (el.id === 'signup-panel' ? 120 : 0);
    smooth.target = Math.max(0, Math.min(scrollMax(), top));
    const focusable = el.querySelector('input') || el;
    setTimeout(() => focusable.focus({ preventScroll: true }), 900);
  });

  // ---- Pointer parallax for the hero object and the feature object.
  let px = 0, py = 0, tx = 0, ty = 0;
  if (fine.matches) {
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / innerWidth) * 2 - 1;
      ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  // ---- Card tilt with a sheen that follows the pointer.
  welcome.querySelectorAll('[data-tilt]').forEach((card) => {
    const frame = card.querySelector('.jj-frame');
    if (!frame || !fine.matches) return;
    card.addEventListener('pointerenter', () => { if (!motion()) return; card.classList.add('is-hover'); frame.style.setProperty('--hover', '1'); sound.hover(); });
    card.addEventListener('pointermove', (e) => {
      if (!motion()) return;
      const r = frame.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width);
      const y = clamp((e.clientY - r.top) / r.height);
      frame.style.setProperty('--ry', ((x - .5) * 22).toFixed(2) + 'deg');
      frame.style.setProperty('--rx', ((.5 - y) * 18).toFixed(2) + 'deg');
      frame.style.setProperty('--mx', x.toFixed(3));
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-hover');
      ['--hover', '--rx', '--ry'].forEach((p) => frame.style.removeProperty(p));
    });
  });

  // ---- Feature steps. The dot index jumps to a step inside the pin.
  const steps = feature ? [...feature.querySelectorAll('.jj-step')] : [];
  const objs = feature ? [...feature.querySelectorAll('.jj-fobj')] : [];
  const dots = feature ? [...feature.querySelectorAll('.jj-dot')] : [];
  let step = 0;
  function setStep(n, quiet) {
    if (n === step) return;
    const back = n < step;
    step = n;
    steps.forEach((s, i) => s.classList.toggle('is-on', i === n));
    objs.forEach((o, i) => { o.classList.toggle('is-on', i === n); o.classList.toggle('is-gone', back ? i > n : i < n); });
    dots.forEach((d, i) => { d.classList.toggle('is-on', i === n); if (i === n) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
    if (!quiet) sound.slide();
  }
  dots.forEach((d) => d.addEventListener('click', () => {
    const n = Number(d.dataset.go);
    if (!motion()) { setStep(n, true); return; }
    const span = feature.offsetHeight - innerHeight;
    const y = feature.getBoundingClientRect().top + scrollY + span * ((n + .5) / steps.length);
    if (smooth.on) smooth.target = y; else window.scrollTo(0, y);
  }));

  // ---- Scroll-linked state for the stage, quote and feature pane.
  let trackTravel = 0;
  function measure() {
    fitGiants();
    if (!track) return;
    const cards = track.querySelectorAll('.jj-card');
    const last = cards[cards.length - 1];
    if (!last) return;
    track.style.setProperty('--tx', '0px');
    const right = last.getBoundingClientRect().right - track.getBoundingClientRect().left;
    trackTravel = Math.max(0, right - innerWidth * (phone.matches ? .94 : .78));
    const note = track.querySelector('.jj-yard-note');
    if (note) trackTravel = Math.max(trackTravel, note.offsetLeft + note.offsetWidth - innerWidth + 48);
  }
  let lastTone = '';
  function setTone(t) {
    if (t === lastTone) return;
    lastTone = t;
    if (t) body.dataset.tone = t; else delete body.dataset.tone;
  }
  function frame() {
    if (!visible()) { setTone(''); return; }
    const vh = innerHeight;
    if (motion()) {
      // Stage. --wipe runs 0 to 1 over 227vh (2045px at 900 tall), then the card row travels.
      const top = -stage.getBoundingClientRect().top;
      const wipeLen = vh * (phone.matches ? 1.2 : 2.27);
      const travelLen = stage.offsetHeight - vh - wipeLen;
      const wipe = clamp(top / wipeLen);
      const tp = clamp((top - wipeLen) / Math.max(1, travelLen));
      stage.style.setProperty('--wipe', wipe.toFixed(4));
      if (track) track.style.setProperty('--tx', (-tp * trackTravel).toFixed(1) + 'px');
      // Quote. The solid fill wipes across the dotted words, then three prints land over them.
      if (quote) {
        const q = clamp(-quote.getBoundingClientRect().top / Math.max(1, quote.offsetHeight - vh));
        quote.style.setProperty('--qr', ease(clamp(q / .42)).toFixed(4));
        [.38, .56, .74].forEach((s, i) => quote.style.setProperty('--p' + (i + 1), ease(clamp((q - s) / .2)).toFixed(4)));
        if (q > .38 && !quote.dataset.thrown) { quote.dataset.thrown = '1'; sound.slide(); }
      }
      if (feature) {
        const f = clamp(-feature.getBoundingClientRect().top / Math.max(1, feature.offsetHeight - vh));
        setStep(Math.min(steps.length - 1, Math.floor(f * steps.length * .999)));
      }
      // Parallax, eased per frame.
      px += (tx - px) * .06;
      py += (ty - py) * .06;
      const obj = $('jj-object');
      if (obj) { obj.style.setProperty('--px', px.toFixed(4)); obj.style.setProperty('--py', py.toFixed(4)); }
      const fo = feature && feature.querySelector('.jj-objects');
      if (fo) { fo.style.setProperty('--px', px.toFixed(4)); fo.style.setProperty('--py', py.toFixed(4)); }
      stepSmooth();
    }
    // Tone under the header line decides the header colour.
    const line = 52;
    let tone = 'dark';
    const sr = stage.getBoundingClientRect();
    if (sr.top <= line && sr.bottom > line) {
      const w = motion() ? Number(stage.style.getPropertyValue('--wipe') || 0) : 0;
      tone = motion() ? (w > .93 ? 'dark' : 'light') : (hero.getBoundingClientRect().bottom > line ? 'light' : 'dark');
    } else {
      const start = $('start');
      if (start) {
        const r = start.getBoundingClientRect();
        const slant = innerWidth * (phone.matches ? .24 : .2);
        if (r.top + slant * .5 <= line && r.bottom > line) tone = 'light';
      }
    }
    setTone(tone);
  }
  function loop() { frame(); requestAnimationFrame(loop); }

  // ---- Reveals. Rows rise 26px and fade over .7s on the reveal curve.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        if (en.target.classList.contains('jj-closing')) sound.reveal();
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -20% 0px' });
    document.querySelectorAll('[data-reveal], .jj-closing').forEach((n) => io.observe(n));
  } else {
    document.querySelectorAll('[data-reveal], .jj-closing').forEach((n) => n.classList.add('is-in'));
  }

  reduced.addEventListener('change', () => {
    document.documentElement.classList.toggle('jj-motion', motion());
    if (!motion()) { stage.style.removeProperty('--wipe'); if (track) track.style.removeProperty('--tx'); }
  });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 120); });
  const go = () => { measure(); startSmooth(); requestAnimationFrame(loop); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go); else go();
})();
