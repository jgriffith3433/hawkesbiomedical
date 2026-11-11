/**
 * Slow molecular / cell field for the home hero.
 * Fixed-size canvas, brand colours, pauses off-screen and when the tab is hidden.
 * prefers-reduced-motion: one still frame, no rAF.
 */
const W = 320;
const H = 200;
const GOLD = [111, 91, 62];
const INK = [36, 35, 31];
const MUTED = [85, 81, 75];

function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function seedNodes(count) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const cell = i % 5 === 0;
    // Bias to the right half so copy on the left stays on paper.
    const x = 110 + ((i * 97 + 41) % (W - 120));
    const y = (i * 53 + 19) % H;
    nodes.push({
      x,
      y,
      r: cell ? 12 + (i % 3) * 3 : 2 + (i % 4) * 0.4,
      vx: ((i % 7) - 3) * 0.0035,
      vy: ((i % 5) - 2) * 0.003,
      cell,
      phase: (i * 0.7) % (Math.PI * 2),
    });
  }
  return nodes;
}

function draw(ctx, nodes, t) {
  ctx.clearRect(0, 0, W, H);

  // Bonds between near neighbours (right-side field only).
  ctx.lineWidth = 1;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (a.cell) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (b.cell) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 3200 || d2 < 90) continue;
      const alpha = 0.1 * (1 - Math.sqrt(d2) / 56);
      ctx.strokeStyle = rgba(GOLD, alpha);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  for (const n of nodes) {
    if (n.cell) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.00035 + n.phase);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(GOLD, 0.12 + pulse * 0.04);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = rgba(MUTED, 0.05 + pulse * 0.03);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(INK, 0.14);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = rgba(GOLD, 0.22);
      ctx.fill();
    }
  }

  // Paper wash over the field so gold/ink copy stays ≥ 4.5:1 everywhere the box sits.
  const wash = ctx.createLinearGradient(0, 0, W, 0);
  wash.addColorStop(0, 'rgba(243,240,234,0.98)');
  wash.addColorStop(0.38, 'rgba(243,240,234,0.92)');
  wash.addColorStop(0.65, 'rgba(243,240,234,0.72)');
  wash.addColorStop(1, 'rgba(243,240,234,0.62)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
}

function step(nodes, dt) {
  for (const n of nodes) {
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    n.phase += 0.0004 * dt;
    if (n.x < 100) { n.x = 100; n.vx = Math.abs(n.vx); }
    if (n.x > W + 16) n.x = 100;
    if (n.y < -16) n.y = H + 16;
    if (n.y > H + 16) n.y = -16;
  }
}

function mount(root, opts = {}) {
  if (!root) return null;
  const canvas = root.querySelector('canvas');
  if (!canvas) return null;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const nodes = seedNodes(26);
  const mq = opts.matchMedia
    || ((q) => window.matchMedia(q));
  let reduced = mq('(prefers-reduced-motion: reduce)').matches;
  let onScreen = true;
  let tabVisible = document.visibilityState !== 'hidden';
  let running = false;
  let raf = 0;
  let last = 0;
  let clock = 0;

  const paint = (t) => {
    clock = t;
    draw(ctx, nodes, t);
  };

  const tick = (now) => {
    if (!running) return;
    const dt = Math.min(48, now - (last || now));
    last = now;
    step(nodes, dt);
    paint(now);
    raf = requestAnimationFrame(tick);
  };

  const sync = () => {
    const want = !reduced && onScreen && tabVisible;
    root.dataset.motion = reduced ? 'still' : want ? 'live' : 'paused';
    if (want && !running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(tick);
    } else if (!want && running) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  paint(0);
  if (reduced) {
    root.dataset.motion = 'still';
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        sync();
      },
      { threshold: 0.05 }
    );
    io.observe(root);
    document.addEventListener('visibilitychange', () => {
      tabVisible = document.visibilityState !== 'hidden';
      sync();
    });
    sync();
  }

  const api = {
    status() {
      return {
        running,
        reducedMotion: reduced,
        onScreen,
        tabVisible,
        width: W,
        height: H,
        motion: root.dataset.motion || 'still',
        clock,
      };
    },
    /** Playtest: stop the loop and keep a still frame (same end state as prefers-reduced-motion). */
    forceStill() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      reduced = true;
      root.dataset.motion = 'still';
      paint(clock || 0);
      return api.status();
    },
  };
  window.hawkesHeroField = api;
  return api;
}

const host = document.querySelector('[data-hero-field]');
if (host) mount(host);
