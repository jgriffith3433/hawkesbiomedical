// Home "Latest from the newsroom" (three newest) and each product page's latest release.
// One fetch of data/news.json on open. No polling.
import { byNewest } from './news-voice.js';

function card(item) {
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
  a.append(img, kick, h);
  return a;
}

async function loadNews() {
  try {
    const r = await fetch('./data/news.json');
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function run() {
  const home = document.querySelector('[data-latest-news]');
  const product = document.querySelector('[data-product-news]');
  if (!home && !product) return;
  const news = await loadNews();
  const items = [...(news?.items || [])].sort(byNewest);

  if (home) {
    const slot = home.querySelector('.news-cards') || home;
    // The build already wrote the three newest into the page (site/news-cards.js); draw them only if it did not.
    if (!slot.querySelector('.news-card')) for (const item of items.slice(0, 3)) slot.append(card(item));
    home.hidden = !slot.querySelector('.news-card');
    home.dataset.newsCount = String(slot.querySelectorAll('.news-card').length);
    document.documentElement.dataset.latestNewsReady = '1';
  }

  if (product) {
    const slug = product.dataset.productNews;
    const latest = items.find((n) => n.slug === slug);
    const slot = product.querySelector('.product-news-slot') || product;
    const built = slot.querySelector('.news-card');
    if (built || latest) {
      if (!built) slot.append(card(latest));
      product.hidden = false;
      product.dataset.newsId = (built || slot.querySelector('.news-card')).dataset.news;
    } else {
      product.hidden = true;
    }
    document.documentElement.dataset.productNewsReady = '1';
  }
}
run();
