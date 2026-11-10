/* Redacted passages: black bars until tap/click/hover/focus; stay revealed for the visit (sessionStorage). */
const REDACT_KEY = 'hawkes.redacted';
const loadRevealed = () => {
  try {
    const raw = sessionStorage.getItem(REDACT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
};
const saveRevealed = (set) => {
  try {
    sessionStorage.setItem(REDACT_KEY, JSON.stringify([...set]));
  } catch {
    /* private mode: stay revealed in-memory for this document only */
  }
};
const revealedIds = loadRevealed();
const calmMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let stampCtx = null;
const playStamp = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    stampCtx = stampCtx || new AC();
    if (stampCtx.state === 'suspended') stampCtx.resume();
    const t0 = stampCtx.currentTime;
    const osc = stampCtx.createOscillator();
    const gain = stampCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.08);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.06, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.connect(gain);
    gain.connect(stampCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  } catch {
    /* audio optional */
  }
};

const upgradeRedacted = (el) => {
  if (el.dataset.redactReady) return;
  el.dataset.redactReady = '1';
  // Never wrap navigation or headings; skip if an author misplaced the class.
  if (el.closest('nav, .nav, h1, h2, h3, h4, h5, h6')) return;
  const id = el.dataset.redact || el.textContent.trim().slice(0, 48);
  el.dataset.redact = id;
  let text = el.querySelector('.redacted-text');
  if (!text) {
    text = document.createElement('span');
    text.className = 'redacted-text';
    while (el.firstChild) text.appendChild(el.firstChild);
    el.appendChild(text);
  }
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  let opening = false;
  const markOpen = () => {
    revealedIds.add(id);
    saveRevealed(revealedIds);
    text.removeAttribute('aria-hidden');
    el.setAttribute('aria-expanded', 'true');
    el.removeAttribute('aria-label');
  };
  const applyRevealed = (animate) => {
    if (el.classList.contains('is-revealed') || opening) return;
    markOpen();
    playStamp();
    if (animate && !calmMotion()) {
      opening = true;
      el.classList.add('is-revealing');
      window.setTimeout(() => {
        el.classList.remove('is-revealing');
        el.classList.add('is-revealed');
        opening = false;
      }, 320);
    } else {
      el.classList.add('is-revealed');
    }
  };
  if (revealedIds.has(id)) {
    markOpen();
    el.classList.add('is-revealed');
  } else {
    text.setAttribute('aria-hidden', 'true');
    el.setAttribute('aria-expanded', 'false');
    el.setAttribute('aria-label', 'Redacted passage. Activate to reveal.');
  }
  const reveal = () => applyRevealed(true);
  el.addEventListener('click', (event) => {
    event.preventDefault();
    reveal();
  });
  el.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') reveal();
  });
  el.addEventListener('focus', reveal);
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      reveal();
    }
  });
};

document.querySelectorAll('.redacted').forEach(upgradeRedacted);

const page = document.body.dataset.page;
document.querySelectorAll('[data-nav]').forEach((link) => {
  if (link.getAttribute('data-nav') === page) {
    link.setAttribute('aria-current', 'page');
  }
});

const nav = document.querySelector('.nav');
const navLinks = document.getElementById('nav-links');
const navToggle = document.getElementById('navToggle');

const setMenu = (open, refocus = false) => {
  if (!navLinks || !navToggle) return;
  const wasOpen = navLinks.classList.contains('is-open');
  navLinks.classList.toggle('is-open', open);
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  navToggle.textContent = open ? 'Close' : 'Menu';
  // Focus moves into the menu on open, and back to the toggle when it closes.
  if (open && !wasOpen) navLinks.querySelector('a')?.focus();
  else if (!open && wasOpen && refocus) navToggle.focus();
};

navToggle?.addEventListener('click', () => {
  setMenu(!navLinks.classList.contains('is-open'), true);
});

navLinks?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    window.setTimeout(() => setMenu(false), 0);
  });
});

document.querySelectorAll('.product a[target="_blank"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const opened = window.open(link.href, '_blank');
    opened?.focus();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false, true);
});

const onScroll = () => {
  nav?.classList.toggle('is-scrolled', window.scrollY > 8);
};

onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Scroll-led chapters (home): fade in as they enter view. Skipped entirely under prefers-reduced-motion.
const chapters = document.querySelectorAll('[data-reveal]');
if (chapters.length) {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || !('IntersectionObserver' in window)) {
    chapters.forEach((el) => el.classList.add('is-in'));
  } else {
    document.documentElement.classList.add('reveal-on');
    const seen = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          seen.unobserve(e.target);
        }
      }),
      { threshold: 0.15 }
    );
    chapters.forEach((el) => seen.observe(el));
  }
}

// Timeline: eras ease in, the rail fills to the era in view and the sticky year follows. IntersectionObserver only, no scroll polling.
const track = document.querySelector('.timeline-track');
const filters = document.querySelector('.tl-filters');
if (track) {
  const eras = [...track.querySelectorAll('.era')];
  const fill = track.querySelector('.rail-fill');
  const yearEl = track.querySelector('[data-year]');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setActive = (era) => {
    const top = era.parentElement.offsetTop + era.offsetTop + 6;
    fill.style.transform = `scaleY(${Math.min(1, top / track.offsetHeight)})`;
    yearEl.textContent = era.querySelector('time').textContent;
    eras.forEach((e) => e.classList.toggle('is-current', e === era));
    track.dataset.year = yearEl.textContent;
  };
  if (calm || !('IntersectionObserver' in window)) {
    eras.forEach((e) => e.classList.add('is-in'));
    fill.style.transform = 'none';
  } else {
    track.classList.add('tl-on');
    const show = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); show.unobserve(e.target); }
    }), { threshold: 0.15 });
    eras.forEach((e) => show.observe(e));
    const mark = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) setActive(e.target);
    }), { rootMargin: '-40% 0px -55% 0px' });
    eras.forEach((e) => mark.observe(e));
    setActive(eras[0]);
  }

  // Product chips: fade other eras (keep them in place) and deep-link as ?product=<slug>.
  const chips = filters ? [...filters.querySelectorAll('[data-filter]')] : [];
  const known = new Set(chips.map((c) => c.dataset.filter).filter(Boolean));
  const applyFilter = (slug, { scroll = false, replace = true } = {}) => {
    const active = known.has(slug) ? slug : '';
    const chip = chips.find((c) => c.dataset.filter === active) || chips.find((c) => c.dataset.filter === '');
    const years = new Set((chip?.dataset.thread || '').split(/\s+/).filter(Boolean));
    track.dataset.product = active;
    track.classList.toggle('is-filtered', !!active);
    chips.forEach((btn) => {
      const on = btn.dataset.filter === active;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    eras.forEach((era) => {
      const year = era.querySelector('time')?.textContent.trim() || '';
      const onThread = !active || years.has(year);
      era.classList.toggle('is-dim', !!active && !onThread);
      era.classList.toggle('is-thread', !!active && onThread);
    });
    track.querySelectorAll('.origins a[data-product]').forEach((a) => {
      a.classList.toggle('is-dim', !!active && a.dataset.product !== active);
    });
    if (replace) {
      const url = new URL(window.location.href);
      if (active) url.searchParams.set('product', active);
      else url.searchParams.delete('product');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (scroll && active) {
      const first = eras.find((e) => e.classList.contains('is-thread'));
      first?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    }
  };
  chips.forEach((btn) => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter || '', { scroll: true }));
  });
  applyFilter(new URLSearchParams(window.location.search).get('product') || '', { replace: false });
}
