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
