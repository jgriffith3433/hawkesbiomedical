const page = document.body.dataset.page;
document.querySelectorAll('[data-nav]').forEach((link) => {
  if (link.getAttribute('data-nav') === page) {
    link.setAttribute('aria-current', 'page');
  }
});

const nav = document.querySelector('.nav');
const navLinks = document.getElementById('nav-links');
const navToggle = document.getElementById('navToggle');

const setMenu = (open) => {
  if (!navLinks || !navToggle) return;
  navLinks.classList.toggle('is-open', open);
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  navToggle.textContent = open ? 'Close' : 'Menu';
};

navToggle?.addEventListener('click', () => {
  setMenu(!navLinks.classList.contains('is-open'));
});

navLinks?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    window.setTimeout(() => setMenu(false), 0);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

const onScroll = () => {
  nav?.classList.toggle('is-scrolled', window.scrollY > 8);
};

onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const shotA = document.getElementById('shotA');
const shotB = document.getElementById('shotB');

if (shotA && shotB) {
  const BACKGROUNDS = [
    './assets/brand/tower-glass.jpg',
    './assets/brand/board-room.jpg',
    './assets/brand/board-table.jpg',
  ];
  const HOLD_MS = 9000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let showingA = true;

  BACKGROUNDS.forEach((src) => {
    const img = new Image();
    img.src = src;
  });

  const setShot = (el, src) => {
    el.style.backgroundImage = `url("${src}")`;
  };

  const show = (el, on) => {
    el.classList.toggle('is-live', on);
    if (on && !reduceMotion) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    }
  };

  setShot(shotA, BACKGROUNDS[0]);
  setShot(shotB, BACKGROUNDS[1]);
  show(shotA, true);

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const cycleOnce = () => {
    index = (index + 1) % BACKGROUNDS.length;
    const incoming = showingA ? shotB : shotA;
    const outgoing = showingA ? shotA : shotB;
    setShot(incoming, BACKGROUNDS[index]);
    show(incoming, true);
    show(outgoing, false);
    showingA = !showingA;
  };

  const runCycle = async () => {
    while (true) {
      await wait(HOLD_MS);
      cycleOnce();
    }
  };

  runCycle();
}
