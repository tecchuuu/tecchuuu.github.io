/* Shared behaviour for every page: menu, email copy, image viewer, galleries,
   the drifting margin marks, and diagrams that draw themselves once. */
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- mobile menu ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const hidden = mobileMenu.classList.toggle('hidden');
      menuBtn.setAttribute('aria-expanded', String(!hidden));
    });
    mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
      menuBtn.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------- email: click to copy ---------- */
  const emailBtn = document.getElementById('emailCopy');
  const emailText = document.getElementById('emailText');
  if (emailBtn && emailText) {
    const original = emailBtn.dataset.email;
    emailBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(original);
      } catch (e) {
        const r = document.createRange(); r.selectNode(emailText);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        document.execCommand('copy'); s.removeAllRanges();
      }
      emailText.textContent = 'Copied';
      setTimeout(() => { emailText.textContent = original; }, 1400);
    });
  }

  /* ---------- image viewer (gallery-aware, with prev/next) ---------- */
  const lb = document.getElementById('lightbox');
  let openAt = () => {};
  if (lb) {
    const lbImg = document.getElementById('lbImg');
    const lbTitle = document.getElementById('lbTitle');
    const lbPdf = document.getElementById('lbPdf');
    const lbPrev = document.getElementById('lbPrev');
    const lbNext = document.getElementById('lbNext');
    const lbCount = document.getElementById('lbCount');
    let items = [];   // [{ src, caption, pdf }]
    let index = 0;
    let opener = null;

    const render = () => {
      const it = items[index];
      if (!it) return;
      lbImg.src = it.src;
      lbImg.alt = it.caption || '';
      lbTitle.textContent = it.caption || '';
      lbPdf.classList.toggle('hidden', !it.pdf);
      if (it.pdf) lbPdf.href = it.pdf;
      const multi = items.length > 1;
      lbPrev.classList.toggle('hidden', !multi);
      lbNext.classList.toggle('hidden', !multi);
      lbCount.textContent = multi ? `${index + 1} of ${items.length}` : '';
    };
    openAt = (list, i) => {
      items = list; index = i; opener = document.activeElement;
      render();
      lb.classList.remove('hidden'); lb.classList.add('flex');
      document.body.style.overflow = 'hidden';
      document.getElementById('lbClose').focus();
    };
    const step = (d) => {
      if (items.length < 2) return;
      index = (index + d + items.length) % items.length;
      render();
    };
    const close = () => {
      lb.classList.add('hidden'); lb.classList.remove('flex');
      lbImg.src = '';
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };

    // each set of .project-shot buttons sharing a parent is one gallery
    const groups = new Map();
    document.querySelectorAll('.project-shot').forEach((btn) => {
      const key = btn.closest('[data-gallery]') || btn.parentElement;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(btn);
    });
    groups.forEach((btns) => {
      const list = btns.map((b) => ({ src: b.dataset.full, caption: b.dataset.caption, pdf: null }));
      btns.forEach((b, i) => b.addEventListener('click', () => openAt(list, i)));
    });

    document.getElementById('lbClose').addEventListener('click', close);
    lbPrev.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
    lbNext.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (lb.classList.contains('hidden')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
  }
  window.viewer = { openAt: (list, i) => openAt(list, i) };

  /* ---------- horizontal galleries: arrow buttons ---------- */
  document.querySelectorAll('[data-track]').forEach((wrap) => {
    const track = wrap.querySelector('.track');
    const by = (d) => track.scrollBy({ left: d * track.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
    wrap.querySelector('.track-prev')?.addEventListener('click', () => by(-1));
    wrap.querySelector('.track-next')?.addEventListener('click', () => by(1));
  });

  /* ---------- margin marks drift with the scroll, each at its own depth ---------- */
  const marks = [...document.querySelectorAll('.margin[data-depth]')];
  const place = () => {
    const mid = innerHeight / 2;
    for (const el of marks) {
      if (el.offsetParent === null) continue;            // hidden at this width
      const host = el.parentElement.getBoundingClientRect();
      const shift = reduceMotion ? 0 : (host.top + host.height / 2 - mid) * -Number(el.dataset.depth);
      el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0) rotate(${el.dataset.rot || 0}deg)`;
    }
  };
  if (marks.length) {
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; place(); });
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    place();
  }

  /* ---------- back to top ---------- */
  const topBtn = document.createElement('button');
  topBtn.type = 'button';
  topBtn.className = 'to-top';
  topBtn.setAttribute('aria-label', 'Back to top');
  topBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>';
  topBtn.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
    document.querySelector('header a')?.focus({ preventScroll: true });
  });
  document.body.appendChild(topBtn);
  const toggleTop = () => topBtn.classList.toggle('show', scrollY > innerHeight * 0.8);
  addEventListener('scroll', toggleTop, { passive: true });
  toggleTop();

  /* ---------- diagrams: lines draw once, the first time they're on screen ---------- */
  document.querySelectorAll('.diagram').forEach((svg) => {
    svg.querySelectorAll('.draw').forEach((p) => p.style.setProperty('--len', Math.ceil(p.getTotalLength())));
    if (reduceMotion || !('IntersectionObserver' in window)) { svg.classList.add('drawn'); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { svg.classList.add('drawn'); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(svg);
  });
})();
