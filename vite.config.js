import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NEWS_PRODUCTS, byNewest, newsFrom, withNotices } from './site/news-voice.js';
import { articleFile, articleHtml } from './site/news-pages.js';
import { cardHtml, fillCards } from './site/news-cards.js';

// Plain (non-module) scripts and data the pages load by path. Vite leaves them out of dist/, so copy them in:
// Studio publishes dist/ as the beta site (GitHub Pages serves the repo root, where they already are).
const articleNames = () => readdirSync('.').filter((f) => /^news-.+\.html$/.test(f));
const PLAIN_FILES = () => [
  'site/analytics.js', 'site/hawkes-release.js', 'site/brand.css', 'site/brand.js',
  'releases.json', 'data/news.json',
  // Logo and product photographs article pages name by path (Vite only keeps images a page's own markup references, under hashed names).
  'assets/brand/logo.png',
  ...readdirSync('assets/products').filter((f) => f.endsWith('-rx.jpg')).map((f) => `assets/products/${f}`),
  // Article pages written by writeNews (static HTML; not Vite inputs — they keep ./site/brand.css paths).
  ...articleNames(),
];
const copyPlainFiles = () => ({
  name: 'copy-plain-files',
  apply: 'build',
  closeBundle() {
    for (const file of PLAIN_FILES()) {
      const out = resolve('dist', file);
      mkdirSync(dirname(out), { recursive: true });
      copyFileSync(resolve(file), out);
    }
  },
});

// Fails the build when a page in dist/ links a local file that isn't there (a script, image, page or releases.json),
// so Studio's beta build never publishes a page with a 404 in it.
const checkDistLinks = () => ({
  name: 'check-dist-links',
  apply: 'build',
  enforce: 'post',
  closeBundle() {
    const missing = [];
    const pages = readdirSync('dist').filter((f) => f.endsWith('.html'));
    for (const page of pages) {
      const html = readFileSync(resolve('dist', page), 'utf8');
      for (const [, ref] of html.matchAll(/(?:src|href)="([^"#?]+)/g)) {
        if (/^(?:[a-z]+:|\/\/)/i.test(ref)) continue;
        if (!existsSync(resolve('dist', ref))) missing.push(`${page} -> ${ref}`);
      }
    }
    for (const file of PLAIN_FILES()) if (!existsSync(resolve('dist', file))) missing.push(`(plain file) ${file}`);
    if (missing.length) throw new Error(`dist/ links files that are not in it:\n${missing.join('\n')}`);
  },
});

/** Drop prior generated article pages so a release that left the build's list does not linger. */
function clearArticles() {
  for (const f of articleNames()) unlinkSync(resolve(f));
}

/** Write one news-*.html per item and return the list of filenames. */
function writeArticles(items) {
  clearArticles();
  const files = [];
  for (const item of items) {
    const name = articleFile(item);
    writeFileSync(resolve(name), articleHtml(item));
    files.push(name);
  }
  return files;
}

/** Put the cards into the pages as static HTML (Newsroom: all, with summaries; Home: the newest three; each product page: its latest). */
function writeCards(items) {
  const sorted = [...items].sort(byNewest);
  const put = (file, cards) => {
    let html;
    try { html = readFileSync(resolve(file), 'utf8'); } catch { return; }
    const next = fillCards(html, cards);
    if (next != null && next !== html) writeFileSync(resolve(file), next);
  };
  put('newsroom.html', sorted.map((i) => cardHtml(i, { summary: true, indent: '            ' })).join('\n'));
  put('index.html', sorted.slice(0, 3).map((i) => cardHtml(i, { indent: '            ' })).join('\n'));
  for (const p of NEWS_PRODUCTS) {
    const latest = sorted.find((i) => i.slug === p.slug);
    if (latest) put(`product-${p.slug}.html`, cardHtml(latest, { indent: '            ' }));
  }
}

/** Articles and cards for the items of this build. */
function publish(items) {
  writeArticles(items);
  writeCards(items);
}

// Writes data/news.json and one article page per release: read from each product's releases.json the way
// site/formulations.js does. A product with no release or an unreachable domain is skipped silently; if nothing can be
// read at all (offline build) the committed file stays as it is and its articles are regenerated from it. `live` lists
// the domains that answered: the Newsroom asks only those on load, so a dead domain never logs a console error there.
const writeNews = () => ({
  name: 'write-news',
  apply: 'build',
  enforce: 'pre',
  async buildStart() {
    const items = [];
    const live = [];
    await Promise.all(
      NEWS_PRODUCTS.map(async (p) => {
        try {
          const res = await fetch(p.releases, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) return;
          const found = newsFrom(p, await res.json());
          if (found.length) { items.push(...found); live.push(p.slug); }
        } catch { /* unreachable: skipped */ }
      }),
    );
    if (items.length) {
      live.sort();
      const all = withNotices(items);
      writeFileSync(resolve('data/news.json'), JSON.stringify({ live, items: all }, null, 2) + '\n');
      publish(all);
      return;
    }
    // Offline: keep the committed news.json, but rewrite articles so their markup stays current.
    try {
      const committed = JSON.parse(readFileSync(resolve('data/news.json'), 'utf8'));
      if (Array.isArray(committed?.items) && committed.items.length) {
        const all = withNotices(committed.items);
        writeFileSync(resolve('data/news.json'), JSON.stringify({ ...committed, items: all }, null, 2) + '\n');
        publish(all);
      }
    } catch { /* no committed file */ }
  },
});

export default defineConfig({
  base: './',
  plugins: [writeNews(), copyPlainFiles(), checkDistLinks()],
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: [
        'index.html',
        'company.html',
        'products.html',
        'product-ph-origins.html',
        'research.html',
        'product-sick-of-it.html',
        'product-imagine-live-tv.html',
        'product-the-place-department.html',
        'product-yooba-land.html',
        'product-i-can-be.html',
        'product-dose-of-destruction.html',
        'product-hawkes-gen.html',
        'leadership.html',
        'contact.html',
        'newsroom.html',
        'timeline.html',
        'investors.html',
        'compliance.html',
        'privacy.html',
        'terms.html',
        'whatsnew.html',
        'styleguide.html',
        '404.html',
      ],
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
  },
});
