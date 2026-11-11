// Newsroom: press-release cards from product releases (each opens its article page), above the hand-written
// statements. data/news.json is written at build (vite.config.js). On load the page asks once, and only, the
// product sites that answered at build time for their releases.json and adds any release newer than the build's.
// No polling. A product that has no release, or whose domain does not answer, is skipped without a trace.
import { NEWS_PRODUCTS, byNewest, newsFrom } from './news-voice.js';

const grid = document.querySelector('.news-cards');
// The build writes the cards into the page (site/news-cards.js): start from those so nothing is drawn twice or moved.
const shown = new Set([...(grid?.querySelectorAll('.news-card[data-news]') || [])].map((c) => c.dataset.news));

function put(item) {
  if (!grid || shown.has(item.id)) return;
  shown.add(item.id);
  const a = document.createElement('a');
  a.className = 'news-card';
  a.href = item.article || `./news-${item.id}.html`;
  a.dataset.news = item.id;
  const img = document.createElement('img');
  img.src = item.image;
  img.alt = `${item.product}: product photograph.`;
  img.width = 640;
  img.height = 640;
  img.loading = 'lazy';
  const kick = document.createElement('p');
  kick.className = 'kicker';
  const time = document.createElement('time');
  time.dateTime = item.date;
  time.textContent = item.date;
  kick.append(time, ` · ${item.category || item.product}`);
  const h = document.createElement('h2');
  h.textContent = item.headline;
  const p = document.createElement('p');
  p.textContent = item.summary;
  a.append(img, kick, h, p);
  // Newest first among the cards.
  const before = [...grid.querySelectorAll('.news-card')].find((n) => (n.querySelector('time')?.dateTime || '') < item.date);
  grid.insertBefore(a, before || null);
}

async function run() {
  let news;
  try {
    const r = await fetch('./data/news.json');
    news = r.ok ? await r.json() : null;
  } catch { news = null; }
  for (const item of [...(news?.items || [])].sort(byNewest)) put(item);
  grid?.setAttribute('data-news-built', String(shown.size));
  // One fetch per live product, once. Only domains that answered at build time are asked, so none logs an error.
  const live = NEWS_PRODUCTS.filter((p) => news?.live?.includes(p.slug));
  await Promise.all(live.map(async (p) => {
    try {
      const r = await fetch(p.releases, { cache: 'no-cache' });
      if (!r.ok) return;
      for (const item of newsFrom(p, await r.json())) put(item);
    } catch { /* unreachable: skipped */ }
  }));
  grid?.setAttribute('data-news-total', String(shown.size));
  document.documentElement.dataset.newsReady = '1';
}
run();
