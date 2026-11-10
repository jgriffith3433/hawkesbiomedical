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
