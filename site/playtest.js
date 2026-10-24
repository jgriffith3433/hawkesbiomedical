/* Hawkes playtest hooks (contract v1, spec: hawkesstudio/docs/playtest.md).
   Nothing here runs until the runner calls window.hawkesPlaytest.start() or the URL has
   ?playtest=<id>. A run never has to survive a page load: it is driven from the home page,
   and the other pages open in a full-screen frame laid over it, reached by clicking the same
   nav and footer links a visitor does. The frame is removed when the run ends. */
import { installPlaytest } from './hawkes-playtest.js';

const PAGES = [
  // Footer links, in the order the footer lists them. 404 has no link: it is loaded directly (setup).
  { name: 'Company', href: './company.html' },
  { name: 'Leadership', href: './leadership.html' },
  { name: 'Newsroom', href: './newsroom.html' },
  { name: 'Investors', href: './investors.html' },
  { name: 'Compliance', href: './compliance.html' },
  { name: 'Privacy', href: './privacy.html' },
  { name: 'Terms', href: './terms.html' },
  { name: 'Contact', href: './contact.html' },
  { name: "What's new", href: './whatsnew.html' },
  { name: 'Home', href: './index.html' },
];
// Pages that carry the link-preview (Open Graph and Twitter card) tags, and the og:url each must give.
const SHARE_URLS = {
  Home: 'https://hawkesbiomedical.com/',
  Products: 'https://hawkesbiomedical.com/products.html',
  Company: 'https://hawkesbiomedical.com/company.html',
  Leadership: 'https://hawkesbiomedical.com/leadership.html',
  Contact: 'https://hawkesbiomedical.com/contact.html',
  Newsroom: 'https://hawkesbiomedical.com/newsroom.html',
  Investors: 'https://hawkesbiomedical.com/investors.html',
  Compliance: 'https://hawkesbiomedical.com/compliance.html',
  Privacy: 'https://hawkesbiomedical.com/privacy.html',
  Terms: 'https://hawkesbiomedical.com/terms.html',
};
const MIN_CONTRAST = 4.5;
// Rough gate for "a daylight image": mean perceived lightness (0..1) and the share of near-black pixels.
const MIN_LIGHTNESS = 0.4;
const MAX_DARK_SHARE = 0.25;

/* ---------------- colour ---------------- */

const parseRgb = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r, g, b, a };
};
const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The colour actually behind an element: the first ancestor with a solid background. */
function backgroundOf(el) {
  const view = el.ownerDocument.defaultView;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const c = parseRgb(view.getComputedStyle(n).backgroundColor);
    if (c && c.a > 0.5) return c;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

/** Mean perceived lightness (gamma-encoded luma, 0..1) and share of near-black pixels of a loaded image, from a small canvas copy. */
function imageLight(img) {
  const w = 96;
  const h = Math.max(1, Math.round((w * (img.naturalHeight || 1)) / (img.naturalWidth || 1)));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    sum += l;
    if (l < 0.15) dark++;
  }
  const n = data.length / 4;
  return { mean: sum / n, darkShare: dark / n };
}

const fixed2 = (n) => Math.round(n * 100) / 100;
const fileOf = (src) => decodeURI(new URL(src, location.href).pathname).split('/').pop();

/* ---------------- the frame ---------------- */

let frame = null;
function openFrame() {
  if (frame) return frame;
  frame = document.createElement('iframe');
  frame.title = 'Playtest';
  frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;background:#f3f0ea';
  document.body.appendChild(frame);
  return frame;
}
function closeFrame() {
  if (frame) frame.remove();
  frame = null;
}

/** Loads a URL in the frame (or follows a link clicked inside it) and waits for the page. */
function frameLoad(go, timeout = 20000) {
  return new Promise((resolve) => {
    const f = openFrame();
    const timer = setTimeout(() => {
      f.removeEventListener('load', done);
      resolve(null);
    }, timeout);
    function done() {
      clearTimeout(timer);
      f.removeEventListener('load', done);
      resolve(f.contentDocument);
    }
    f.addEventListener('load', done);
    go(f);
  });
}

/** Clicks a link on the page in the frame, like a visitor. */
async function clickLink(t, doc, selector, what) {
  const link = doc && doc.querySelector(selector);
  if (!link) throw new Error(`no ${what} link (${selector})`);
  link.scrollIntoView({ block: 'center' });
  await t.wait(400);
  const next = await frameLoad(() => link.click());
  if (!next) throw new Error(`${what} didn't open`);
  t.event('click', what);
  return next;
}

const smoothTo = (el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' });
const imagesLoaded = (doc) => [...doc.images].every((img) => img.complete);

/* ---------------- checks ---------------- */

/** Scrolls to the footer line, checks it says the company is fiction and that it reads (contrast). */
async function checkFooter(t, doc, page, worst) {
  const legal = doc.querySelector('footer .legal');
  if (!legal) {
    t.problem('bug', `${page}: no footer line`);
    return worst;
  }
  smoothTo(legal);
  await t.wait(1200);
  const text = legal.textContent.replace(/\s+/g, ' ').trim();
  if (!/work of fiction/i.test(text)) t.problem('bug', `${page}: the footer line doesn't say the company is fiction ("${text}")`);
  const style = doc.defaultView.getComputedStyle(legal);
  const fg = parseRgb(style.color);
  const bg = backgroundOf(legal);
  const ratio = fixed2(contrast(fg, bg));
  t.event('footer', `${page}: "Hawkes Biomedical is a work of fiction." ${style.color} on rgb(${bg.r}, ${bg.g}, ${bg.b}), contrast ${ratio}:1, ${style.fontSize}`);
  t.add('footersChecked');
  if (ratio < MIN_CONTRAST) t.problem('bug', `${page}: footer line contrast ${ratio}:1 is under ${MIN_CONTRAST}:1 (hard to read)`);
  t.note(`${page} footer: ${ratio}:1`);
  checkPoweredBy(t, doc, page);
  await t.wait(1500);
  return Math.min(worst, ratio);
}

/** The footer's "Powered by HAWKES GEN" mark: shown, and linking to hawkesgen.com. Not clicked: it leaves the site. */
function checkPoweredBy(t, doc, page) {
  const link = [...doc.querySelectorAll('footer a')].find((a) => /powered by\s+hawkes gen/i.test(a.textContent));
  if (!link) {
    t.problem('bug', `${page}: no "Powered by HAWKES GEN" link in the footer`);
    return;
  }
  const text = link.innerText.replace(/\s+/g, ' ').trim();
  const href = link.getAttribute('href');
  const box = link.getBoundingClientRect();
  const shown = box.width > 0 && box.height > 0 && doc.defaultView.getComputedStyle(link).visibility !== 'hidden';
  t.event('powered-by', `${page}: "${text}" -> ${href}${shown ? '' : ' (not visible)'}`);
  t.add('poweredByChecked');
  if (!/^https:\/\/hawkesgen\.com\/?$/.test(href || '')) t.problem('bug', `${page}: "Powered by HAWKES GEN" links to ${href}, not https://hawkesgen.com`);
  if (!shown) t.problem('bug', `${page}: "Powered by HAWKES GEN" isn't visible`);
  if (text !== 'POWERED BY HAWKES GEN') t.problem('warning', `${page}: the mark reads "${text}"`);
}

/** The link-preview tags: og:title and og:description match the page's own title and description. */
function checkShareTags(t, doc, page) {
  const meta = (attr, key) => doc.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null;
  const og = (key) => meta('property', `og:${key}`);
  const title = doc.title.trim();
  const description = meta('name', 'description');
  const tags = {
    'og:title': og('title'),
    'og:description': og('description'),
    'og:type': og('type'),
    'og:url': og('url'),
    'og:site_name': og('site_name'),
    'twitter:card': meta('name', 'twitter:card'),
  };
  t.event('share-tags', `${page}: ${Object.entries(tags).map(([k, v]) => `${k}="${v ?? '(missing)'}"`).join(', ')}`);
  for (const [k, v] of Object.entries(tags)) if (!v) t.problem('bug', `${page}: no ${k} tag (link previews)`);
  if (tags['og:title'] && tags['og:title'] !== title) t.problem('bug', `${page}: og:title "${tags['og:title']}" isn't the page title "${title}"`);
  if (tags['og:description'] && tags['og:description'] !== description) t.problem('bug', `${page}: og:description isn't the page's meta description`);
  if (tags['og:type'] && tags['og:type'] !== 'website') t.problem('bug', `${page}: og:type is "${tags['og:type']}", not "website"`);
  if (tags['og:url'] && tags['og:url'] !== SHARE_URLS[page]) t.problem('bug', `${page}: og:url is "${tags['og:url']}", not ${SHARE_URLS[page]}`);
  if (tags['og:site_name'] && tags['og:site_name'] !== 'Hawkes Biomedical') t.problem('bug', `${page}: og:site_name is "${tags['og:site_name']}"`);
  if (tags['twitter:card'] && tags['twitter:card'] !== 'summary') t.problem('bug', `${page}: twitter:card is "${tags['twitter:card']}", not "summary"`);
  const text = Object.values(tags).join(' ');
  if (/\b(B3|vat|creature|game|gameplay|play)\b/i.test(text)) t.problem('bug', `${page}: a link-preview tag breaks the brand rules ("${text}")`);
  t.add('shareTagsChecked');
}

/** Every product row: its thumbnail loads and reads as a daylight image, and its formulation line stays on one line. Holds on PH Origins. */
async function checkProducts(t, doc) {
  await t.until(() => imagesLoaded(doc), 15000, 'the product images');
  await t.until(
    () => [...doc.querySelectorAll('.products .product p.formulation')].every((p) => !p.hidden),
    6000,
    'the product formulations'
  ).catch(() => {});
  const rows = [...doc.querySelectorAll('.products .product')];
  t.metric('products', rows.length);
  if (!rows.length) throw new Error('Products lists no products');
  for (const row of rows) {
    const name = (row.querySelector('h2')?.textContent || row.id).trim();
    const img = row.querySelector('.product-shot img');
    smoothTo(row);
    await t.wait(1300);
    if (!img || !img.naturalWidth) {
      t.problem('bug', `Products: ${name} thumbnail didn't load`);
      continue;
    }
    const { mean, darkShare } = imageLight(img);
    t.event('thumbnail', `${name}: ${fileOf(img.src)}, mean lightness ${fixed2(mean)}, near-black ${Math.round(darkShare * 100)}%`);
    t.add('thumbnailsChecked');
    if (mean < MIN_LIGHTNESS || darkShare > MAX_DARK_SHARE) {
      t.problem('warning', `Products: ${name} thumbnail (${fileOf(img.src)}) is dark (mean lightness ${fixed2(mean)}, near-black ${Math.round(darkShare * 100)}%); the brand wants daylight images`);
    }
    const form = row.querySelector('p.formulation');
    if (form && !form.hidden) {
      const target = form.querySelector('a') || form;
      const rects = target.getClientRects();
      const text = form.textContent.replace(/\s+/g, ' ').trim();
      const style = doc.defaultView.getComputedStyle(form);
      t.event('formulation', `${name}: "${text}" (${rects.length} line${rects.length === 1 ? '' : 's'}, white-space: ${style.whiteSpace})`);
      t.add('formulationsChecked');
      if (rects.length > 1) {
        t.problem('bug', `Products: ${name} formulation wraps across ${rects.length} lines ("${text}")`);
      }
    }
  }

  // Back to PH Origins, and hold there for the review.
  const ph = doc.querySelector('#ph-origins');
  const phImg = ph?.querySelector('.product-shot img');
  if (!ph || !phImg) throw new Error('Products has no PH Origins row');
  t.scene('Products: PH Origins');
  smoothTo(ph);
  await t.wait(1200);
  const { mean, darkShare } = imageLight(phImg);
  const file = fileOf(phImg.src);
  t.metric('phOriginsLight', fixed2(mean));
  t.event('ph-origins', `${file}, "${phImg.closest('a')?.getAttribute('aria-label') || ''}", mean lightness ${fixed2(mean)}, near-black ${Math.round(darkShare * 100)}%`);
  if (/phorigins-product\.jpg$/.test(file)) t.problem('bug', 'Products: PH Origins still shows the night-skyline photo (phorigins-product.jpg)');
  t.note(`PH Origins: ${file}`);
  await t.wait(4000);
}

/* ---------------- analytics ---------------- */

// Words the corporate site never shows (AGENTS.md "Hard constraints") and developer changelog terms banned from notices.
const OFF_BRAND = /\b(B3|vat|creature|basement|games?|gameplay|play(?:er|ers)?)\b/i;
const CHANGELOG_WORDS = /\b(changelog|commit|deploy|fix(?:ed|es)?|polish|bug|repo|git|merge|pull request|site updates|improvements and corrections|release notes|footer|header)\b/i;

/** Checks What's new notices: corporate/laboratory framing, left-aligned dates under headings, and body list typography. */
async function checkNotices(t, doc) {
  await t.until(() => doc.querySelectorAll('[data-hawkes-releases] .hawkes-release').length > 0, 8000, "What's new: notices");
  const container = doc.querySelector('[data-hawkes-releases]');
  smoothTo(container);
  await t.wait(2000);
  const entries = [...doc.querySelectorAll('[data-hawkes-releases] .hawkes-release')];
  t.metric('noticesChecked', entries.length);
  for (const sec of entries) {
    const h3 = sec.querySelector('h3');
    const ver = (sec.querySelector('.hawkes-release-version')?.textContent || '').trim();
    const title = (sec.querySelector('.hawkes-release-title')?.textContent || '').trim();
    const dateEl = sec.querySelector('.hawkes-release-date');
    const ul = sec.querySelector('ul');
    const notes = [...sec.querySelectorAll('ul li')].map((li) => li.textContent.trim());
    const fullText = [title, ...notes].join(' ');
    if (OFF_BRAND.test(fullText) || CHANGELOG_WORDS.test(fullText)) {
      t.problem('bug', `What's new (${ver}): notice uses developer changelog or off-brand wording ("${fullText}")`);
    }
    if (h3 && dateEl) {
      const h3Rect = h3.getBoundingClientRect();
      const dateRect = dateEl.getBoundingClientRect();
      const deltaLeft = Math.abs(dateRect.left - h3Rect.left);
      const dateLines = dateEl.getClientRects().length;
      const ulFont = ul ? doc.defaultView.getComputedStyle(ul).fontSize : '';
      t.event(
        'notice',
        `${ver} "${title}" (${dateEl.textContent.trim()}, left delta ${fixed2(deltaLeft)}px, ${dateLines} line, list ${ulFont}): ${notes.join(' | ')}`
      );
      if (deltaLeft > 4 || dateLines > 1) {
        t.problem('bug', `What's new (${ver}): release date isn't cleanly left-aligned under the heading (left delta ${fixed2(deltaLeft)}px, lines ${dateLines})`);
      }
    }
  }
}

/** The page's Hawkes Analytics, once the deferred SDK has run (null if it never loads). */
async function analyticsOf(t, win, page) {
  const ok = await t.until(() => win.hawkesAnalytics && typeof win.hawkesAnalytics.config === 'function', 10000, `${page}: the analytics SDK`).then(
    () => true,
    () => false
  );
  if (!ok) {
    t.problem('bug', `${page}: Hawkes Analytics didn't load (https://gen.hawkesgen.com/sdk/analytics@1.js)`);
    return null;
  }
  const a = win.hawkesAnalytics;
  if (!a.config().debug) a.init({ debug: true }); // the playtest reads what goes out from debugLog
  return a;
}

const described = (e) =>
  `${e.name}${e.props ? ' ' + JSON.stringify(e.props) : ''}${e.ctx && Object.keys(e.ctx).length ? ' ctx ' + JSON.stringify(e.ctx) : ''}`;

/** Waits for an event in the page's debug log, then for its batch to go out. Logs it on the timeline. */
async function sentEvent(t, a, page, what, match) {
  let e = null;
  try {
    await t.until(() => (e = a.debugLog.find(match)), 10000, `${page}: ${what}`);
  } catch {
    t.problem('bug', `${page}: no ${what} event`);
    return null;
  }
  a.flush();
  await t.until(() => e.sent, 10000, `${page}: ${what} sent`).catch(() => {});
  const c = a.config();
  t.event('analytics', `${page}: ${described(e)} -> ${e.sent ? 'sent' : 'NOT sent'} (env ${c.env}, product ${c.product}, build ${JSON.stringify(c.build || null)})`);
  t.add('analyticsSent');
  if (!e.sent) t.problem('bug', `${page}: the ${what} event never went out`);
  return e;
}

async function analytics(options, t) {
  // Pages opened in the frame are this tab's too: the SDK reads this and runs in debug mode there (site/analytics.js).
  sessionStorage.setItem('hawkes.playtest', '1');
  t.scene('Home');
  const home = await analyticsOf(t, window, 'Home');
  if (home) {
    const c = home.config();
    t.event('analytics', `Home: SDK ${home.version}, product ${c.product}, env ${c.env}, build ${JSON.stringify(c.build || null)}, flags ${JSON.stringify(c.flags)}`);
    t.metric('analyticsEnv', c.env);
    if (c.product !== 'hawkesbiomedical') t.problem('bug', `Home: analytics product is "${c.product}", not hawkesbiomedical`);
    if (/\.hawkesgen\.com$/.test(location.hostname) && !/^\/c\//.test(location.pathname) && c.env !== 'beta') t.problem('bug', `Home: env is "${c.env}" on the beta site`);
  }
  t.progress(0.1);

  // Products, through the nav.
  let doc = await frameLoad((f) => (f.src = './index.html'));
  if (!doc) throw new Error("the home page didn't open in the frame");
  doc = await clickLink(t, doc, '.nav-links a[data-nav="products"]', 'Products (nav)');
  t.scene('Products');
  const win = doc.defaultView;
  const a = await analyticsOf(t, win, 'Products');
  if (!a) return;
  await sentEvent(t, a, 'Products', 'page_view', (e) => e.name === 'page_view');
  t.progress(0.3);

  // Read the line, row by row, to the footer: read depth goes out as progress.
  for (const row of doc.querySelectorAll('.products .product')) {
    smoothTo(row);
    await t.wait(900);
  }
  const legal = doc.querySelector('footer .legal');
  legal.scrollIntoView({ behavior: 'smooth', block: 'end' });
  await t.wait(1500);
  await sentEvent(t, a, 'Products', 'read depth 100%', (e) => e.name === 'progress' && e.props && e.props.step === 100);
  t.metric('readDepthMarks', a.debugLog.filter((e) => e.name === 'progress').map((e) => e.props.step).join(','));
  t.progress(0.6);

  // The new footer line: anonymous statistics, in the company's voice, after the fiction line.
  const stats = legal.querySelector('.stats');
  const line = legal.textContent.replace(/\s+/g, ' ').trim();
  t.event('footer', `Products: "${line}"`);
  if (!stats) t.problem('bug', 'Products: no site statistics line in the footer');
  if (!/work of fiction/i.test(line)) t.problem('bug', "Products: the footer line doesn't say the company is fiction");
  if (OFF_BRAND.test(line)) t.problem('bug', `Products: the footer line breaks the brand rules ("${line}")`);

  // Click through to a product, as a visitor does. The click is real; the new tab is held back so the run stays here.
  t.scene('Products: PH Origins');
  const link = doc.querySelector('#ph-origins a.text-link');
  if (!link) throw new Error('Products has no PH Origins link');
  smoothTo(link);
  await t.wait(1200);
  doc.addEventListener('click', (e) => e.preventDefault(), { once: true });
  link.click();
  t.event('click', `PH Origins (${link.getAttribute('href')})`);
  const out = await sentEvent(t, a, 'Products', 'outbound click to PH Origins', (e) => e.name === 'outbound' && e.ctx && e.ctx.product === 'PH Origins');
  if (out && !/^phorigins\.com\/?$/.test(out.props?.url || '')) t.problem('bug', `Products: the outbound event's url is "${out.props?.url}"`);
  t.progress(0.9);
  await t.wait(2500);
  closeFrame();
  t.progress(1);
}

/* ---------------- scenarios ---------------- */

async function products(options, t, everyPage) {
  t.scene('Home');
  checkShareTags(t, document, 'Home');
  const position = document.querySelector('.hero-copy .position')?.textContent.replace(/\s+/g, ' ').trim();
  t.event('category-line', `Home: "${position || '(missing)'}"`);
  if (position !== 'We do not pitch a cure. We own the category.') t.problem('bug', 'Home: the category-ownership line is missing');
  for (const img of document.querySelectorAll('header img, footer img')) if (!img.getAttribute('alt')) t.problem('bug', 'Home: a logo image has no alt text');
  let worst = Infinity;
  // The home page's own footer first, without leaving it.
  worst = await checkFooter(t, document, 'Home', worst);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await t.wait(600);
  t.progress(0.1);

  // Products, through the nav, as a visitor gets there.
  let doc = await frameLoad((f) => (f.src = './index.html'));
  if (!doc) throw new Error("the home page didn't open in the frame");
  doc = await clickLink(t, doc, '.nav-links a[data-nav="products"]', 'Products (nav)');
  t.scene('Products');
  t.add('pagesOpened');
  checkShareTags(t, doc, 'Products');
  await checkProducts(t, doc);
  t.progress(0.5);
  worst = await checkFooter(t, doc, 'Products', worst);
  t.progress(0.6);

  if (everyPage) {
    for (let i = 0; i < PAGES.length; i++) {
      const p = PAGES[i];
      doc = await clickLink(t, doc, `footer nav a[href="${p.href}"]`, `${p.name} (footer)`);
      t.scene(p.name);
      t.add('pagesOpened');
      if (SHARE_URLS[p.name]) checkShareTags(t, doc, p.name);
      if (OFF_BRAND.test(doc.body.innerText)) t.problem('bug', `${p.name}: visible text breaks the brand rules`);
      if (p.name === "What's new") await checkNotices(t, doc);
      worst = await checkFooter(t, doc, p.name, worst);
      t.progress(0.6 + (0.35 * (i + 1)) / (PAGES.length + 1));
    }
    // No link goes to the not-found page; load it directly (setup).
    doc = await frameLoad((f) => (f.src = './404.html'));
    if (!doc) throw new Error("404.html didn't open");
    t.scene('Not found (404.html, loaded directly)');
    t.add('pagesOpened');
    worst = await checkFooter(t, doc, '404', worst);
  }
  t.metric('footerContrastMin', fixed2(worst));
  closeFrame();
  t.progress(1);
}

installPlaytest({
  product: 'hawkesbiomedical',
  scenarios: [
    { id: 'smoke', title: 'Home link-preview tags and footer, Products through the nav and its link-preview tags, every thumbnail, the Products footer (fiction line, Powered by HAWKES GEN)', seconds: 25, tags: ['smoke'] },
    {
      id: 'products',
      title: 'Products: every thumbnail is a daylight image, hold on PH Origins; the fiction line reads and Powered by HAWKES GEN links to hawkesgen.com on every page; every page with link-preview tags has them right',
      seconds: 45,
      tags: ['full'],
      description: 'Checks the link-preview (Open Graph, Twitter card) tags on Home and Products, clicks Products in the nav, scrolls each product row and measures its thumbnail, holds on PH Origins, then opens every page from the footer, checks the link-preview tags on Company, Leadership and Contact, measures the footer line contrast and checks the Powered by HAWKES GEN link to https://hawkesgen.com (404 loaded directly).',
    },
    {
      id: 'analytics',
      title: 'Hawkes Analytics: page_view on Products, read depth to the footer, an outbound click to PH Origins naming the product, each sent with its env; the footer statistics line keeps the brand',
      seconds: 40,
      tags: ['analytics'],
      description: 'Reads the SDK config on Home (product, env, build), clicks Products in the nav, waits for its page_view to go out, scrolls every product row to the footer (progress 25/50/75/100), checks the footer line (fiction, anonymous statistics, no off-brand words), then clicks the phorigins.com link (the new tab is held back) and waits for the outbound event with ctx.product "PH Origins" to go out.',
    },
  ],
  isReady: () => document.readyState === 'complete',
  async start(id, options, t) {
    try {
      if (id === 'analytics') await analytics(options, t);
      else await products(options, t, id === 'products');
    } finally {
      closeFrame();
    }
  },
  stop() {
    closeFrame();
  },
});
