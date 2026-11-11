// Newsroom: press releases from product releases, merged with the hand-written statements already on the page.
// data/news.json is written at build (vite.config.js). On load the page asks once, and only, the product sites that
// answered at build time for their releases.json and adds any release newer than the build's: fresh between builds.
// No polling. A product that has no release, or whose domain does not answer, is skipped without a trace.
import { NEWS_PRODUCTS, byNewest, newsFrom } from './news-voice.js';

const list = document.querySelector('.notes');
const shown = new Set();
const dateText = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

function put(item) {
  if (!list || shown.has(item.id)) return;
  shown.add(item.id);
  const a = document.createElement('article');
  a.className = 'release-note release-product';
  a.dataset.news = item.id;
  const fig = document.createElement('a');
  fig.className = 'release-thumb';
  fig.href = item.page;
  const img = document.createElement('img');
  img.src = item.image;
  img.alt = `${item.product}: product photograph.`;
  img.width = 640;
  img.height = 640;
  img.loading = 'lazy';
  fig.append(img);
  const body = document.createElement('div');
  const kick = document.createElement('p');
  kick.className = 'kicker';
  const time = document.createElement('time');
  time.dateTime = item.date;
  time.textContent = item.date;
  kick.append(time, ` · ${item.product}, formulation ${item.version}`);
  const h = document.createElement('h2');
  h.textContent = item.headline;
  const p = document.createElement('p');
  p.textContent = item.summary;
  body.append(kick, h, p);
  a.append(fig, body);
  // Newest first among everything on the page, hand-written statements included.
  const before = [...list.querySelectorAll('.release-note')].find((n) => (n.querySelector('time')?.dateTime || '') < item.date);
  list.insertBefore(a, before || null);
}

async function run() {
  let news;
  try {
    const r = await fetch('./data/news.json');
    news = r.ok ? await r.json() : null;
  } catch { news = null; }
  for (const item of [...(news?.items || [])].sort(byNewest).reverse()) put(item);
  list?.setAttribute('data-news-built', String(shown.size));
  // One fetch per live product, once. Only domains that answered at build time are asked, so none logs an error.
  const live = NEWS_PRODUCTS.filter((p) => news?.live?.includes(p.slug));
  await Promise.all(live.map(async (p) => {
    try {
      const r = await fetch(p.releases, { cache: 'no-cache' });
      if (!r.ok) return;
      for (const item of newsFrom(p, await r.json())) put(item);
    } catch { /* unreachable: skipped */ }
  }));
  list?.setAttribute('data-news-total', String(shown.size));
  document.documentElement.dataset.newsReady = '1';
}
run();
