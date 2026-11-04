// Editorial links shuffle briefly on hover. Live readings are never animated.
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  for (const link of document.querySelectorAll('.hero-actions a')) {
    const original = link.textContent;
    let timer = null;
    const restore = () => { clearInterval(timer); timer = null; link.textContent = original; };
    link.setAttribute('aria-label', original);
    link.addEventListener('mouseenter', () => {
      if (reduced.matches) return;
      restore();
      let step = 0;
      timer = setInterval(() => {
        if (++step >= 4) return restore();
        link.textContent = original.split(' ').map(word => {
          const letters = [...word];
          for (let i = letters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [letters[i], letters[j]] = [letters[j], letters[i]];
          }
          return letters.join('');
        }).join(' ');
      }, 55);
    });
    link.addEventListener('mouseleave', restore);
    link.addEventListener('blur', restore);
    reduced.addEventListener('change', restore);
  }
})();
