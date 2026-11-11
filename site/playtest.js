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
  { name: 'Timeline', href: './timeline.html' },
  { name: 'Investors', href: './investors.html' },
  { name: 'Compliance', href: './compliance.html' },
  { name: 'Privacy', href: './privacy.html' },
  { name: 'Terms', href: './terms.html' },
  { name: 'Contact', href: './contact.html' },
  { name: 'Research', href: './research.html' },
  { name: 'Style guide', href: './styleguide.html' },
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
  Timeline: 'https://hawkesbiomedical.com/timeline.html',
  Investors: 'https://hawkesbiomedical.com/investors.html',
  Compliance: 'https://hawkesbiomedical.com/compliance.html',
  Privacy: 'https://hawkesbiomedical.com/privacy.html',
  Terms: 'https://hawkesbiomedical.com/terms.html',
  'Style guide': 'https://hawkesbiomedical.com/styleguide.html',
  Research: 'https://hawkesbiomedical.com/research.html',
  '404': 'https://hawkesbiomedical.com/404.html',
  'PH Origins': 'https://hawkesbiomedical.com/product-ph-origins.html',
  'Sick of It': 'https://hawkesbiomedical.com/product-sick-of-it.html',
  'Imagine Live TV': 'https://hawkesbiomedical.com/product-imagine-live-tv.html',
  'The Place Department': 'https://hawkesbiomedical.com/product-the-place-department.html',
  'Yooba Land': 'https://hawkesbiomedical.com/product-yooba-land.html',
  'I Can Be': 'https://hawkesbiomedical.com/product-i-can-be.html',
  'Dose Of Destruction': 'https://hawkesbiomedical.com/product-dose-of-destruction.html',
  'Hawkes Gen': 'https://hawkesbiomedical.com/product-hawkes-gen.html',
  "What's new": 'https://hawkesbiomedical.com/whatsnew.html',
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

/** The footer's "Powered by HAWKES GEN" mark: shown, and linking to hawkesgen.ai. Not clicked: it leaves the site. */
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
  if (!/^https:\/\/hawkesgen\.ai\/?$/.test(href || '')) t.problem('bug', `${page}: "Powered by HAWKES GEN" links to ${href}, not https://hawkesgen.ai`);
  if (!shown) t.problem('bug', `${page}: "Powered by HAWKES GEN" isn't visible`);
  if (text !== 'POWERED BY HAWKES GEN') t.problem('warning', `${page}: the mark reads "${text}"`);
}

/** The link-preview tags: og:title and og:description match the page's own title and description. */
/** One h1, no skipped heading levels, and alt text on every image (empty only for decoration). */
function checkStructure(t, doc, page) {
  const hs = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]);
  if (hs.filter((n) => n === 1).length !== 1) t.problem('bug', `${page}: ${hs.filter((n) => n === 1).length} h1 elements, expected one`);
  hs.forEach((n, i) => { if (i && n > hs[i - 1] + 1) t.problem('bug', `${page}: heading jumps from h${hs[i - 1]} to h${n}`); });
  const bad = [...doc.querySelectorAll('img')].filter((im) => !im.hasAttribute('alt') || (im.alt.trim() === '' && !im.closest('[aria-hidden="true"]')));
  if (bad.length) t.problem('bug', `${page}: ${bad.length} image(s) without alt text`);
  t.event('structure', `${page}: headings h${hs.join(' h')}; ${doc.images.length} images checked for alt`);
}

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
    'twitter:title': meta('name', 'twitter:title'),
    'twitter:description': meta('name', 'twitter:description'),
  };
  t.event('meta-description', `${page}: title "${title}"; meta description "${description ?? '(missing)'}"`);
  if (!title || !description) t.problem('bug', `${page}: missing title or meta description`);
  t.event('share-tags', `${page}: ${Object.entries(tags).map(([k, v]) => `${k}="${v ?? '(missing)'}"`).join(', ')}`);
  for (const [k, v] of Object.entries(tags)) if (!v) t.problem('bug', `${page}: no ${k} tag (link previews)`);
  if (tags['og:title'] && tags['og:title'] !== title) t.problem('bug', `${page}: og:title "${tags['og:title']}" isn't the page title "${title}"`);
  if (tags['og:description'] && tags['og:description'] !== description) t.problem('bug', `${page}: og:description isn't the page's meta description`);
  if (tags['twitter:title'] && tags['twitter:title'] !== title) t.problem('bug', `${page}: twitter:title isn't the page title`);
  if (tags['twitter:description'] && tags['twitter:description'] !== description) t.problem('bug', `${page}: twitter:description isn't the page's meta description`);
  checkStructure(t, doc, page);
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
    t.problem('bug', `${page}: Hawkes Analytics didn't load (https://hawkesgen.ai/sdk/analytics@1.js)`);
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
    if (/\.hawkesgen\.ai$/.test(location.hostname) && !/^\/c\//.test(location.pathname) && c.env !== 'beta') t.problem('bug', `Home: env is "${c.env}" on the beta site`);
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

/** The narrative home page: a one-sentence mission in the hero, then four chapters, each with a headline and a visual; scroll motion respects prefers-reduced-motion. */
async function story(options, t) {
  t.scene('Home: hero');
  const mission = document.querySelector('.hero-copy .mission')?.textContent.replace(/\s+/g, ' ').trim() || '';
  const sentences = mission.split(/(?<=[.!?])\s+/).filter(Boolean);
  t.event('mission', `Hero: "${mission || '(missing)'}" (${sentences.length} sentence${sentences.length === 1 ? '' : 's'})`);
  if (!mission) t.problem('bug', 'Home: the hero states no mission');
  else if (sentences.length !== 1) t.problem('bug', `Home: the hero mission is ${sentences.length} sentences, not one`);
  await t.wait(1500);
  const chapters = [...document.querySelectorAll('main .story')];
  t.metric('chapters', chapters.length);
  if (chapters.length < 4) t.problem('bug', `Home: ${chapters.length} narrative sections, at least 4 wanted`);
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  t.event('motion', `prefers-reduced-motion: ${calm ? 'reduce' : 'no-preference'}; reveal ${document.documentElement.classList.contains('reveal-on') ? 'on' : 'off'}`);
  if (calm && document.documentElement.classList.contains('reveal-on')) t.problem('bug', 'Home: scroll reveal is on although the visitor asked for reduced motion');
  let rule = false;
  for (const sheet of document.styleSheets) {
    try {
      for (const r of sheet.cssRules) if (r.conditionText && /prefers-reduced-motion:\s*reduce/.test(r.conditionText) && /data-reveal/.test(r.cssText)) rule = true;
    } catch {}
  }
  t.event('motion-rule', `reduced-motion rule for the chapters: ${rule ? 'present' : 'missing'}`);
  if (!rule) t.problem('bug', 'Home: no prefers-reduced-motion rule for the scroll reveal');
  for (const sec of chapters) {
    const name = sec.querySelector('h2')?.textContent.trim() || sec.id;
    t.scene(`Home: ${name}`);
    smoothTo(sec);
    await t.wait(1600);
    const img = sec.querySelector('img');
    await t.until(() => !img || img.complete, 8000, `${name} image`).catch(() => {});
    const h = sec.querySelector('h2');
    const box = sec.querySelector('[data-reveal]');
    const opacity = box ? Number(getComputedStyle(box).opacity) : 1;
    t.event('chapter', `${sec.querySelector('.eyebrow')?.textContent.trim() || ''}: "${name}", visual ${img && img.naturalWidth ? fileOf(img.src) : '(none)'}, opacity ${fixed2(opacity)}`);
    t.add('chaptersChecked');
    if (!h) t.problem('bug', `Home: chapter ${sec.id} has no headline`);
    if (!img || !img.naturalWidth) t.problem('bug', `Home: chapter "${name}" has no visual that loads`);
    if (opacity < 0.95) t.problem('bug', `Home: chapter "${name}" is still hidden after scrolling to it (opacity ${fixed2(opacity)})`);
    await t.wait(800);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await t.wait(800);
  t.progress(1);
}


/** Layout shift of a document, read through an observer (getEntriesByType does not return layout-shift in Chrome). */
function layoutShiftOf(win) {
  let total = 0;
  try {
    const po = new win.PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value; });
    po.observe({ type: 'layout-shift', buffered: true });
    return () => { po.takeRecords().forEach((e) => { if (!e.hadRecentInput) total += e.value; }); po.disconnect(); return total; };
  } catch {
    return () => 0;
  }
}

/**
 * Every <picture> of a page, judged at that page's own width: the WebP source it chose (a phone gets the 800w), the JPEG fallback
 * (it exists, decodes, is under 150 KB and has the same shape as the WebP), width/height on the img, lazy below the fold and eager
 * with fetchpriority high on the first screen. Scrolls to each one (real scrolling) so the lazy ones choose and load. One `image` event per picture.
 */
async function checkPictures(t, doc, label) {
  const win = doc.defaultView;
  const W = win.innerWidth;
  const dpr = win.devicePixelRatio || 1;
  const shift = layoutShiftOf(win);
  await t.until(() => doc.readyState === 'complete', 10000, `${label} load`).catch(() => {});
  const pics = [...doc.querySelectorAll('picture')];
  const sized = [];
  for (const pic of pics) {
    const img = pic.querySelector('img');
    const name = fileOf(img.getAttribute('src') || img.src);
    const where = `${label}: ${name}`;
    const webp = pic.querySelector('source[type="image/webp"]');
    const fallback = img.getAttribute('src') || '';
    const wAttr = Number(img.getAttribute('width')), hAttr = Number(img.getAttribute('height'));
    const loading = img.getAttribute('loading') || 'eager';
    const priority = img.getAttribute('fetchpriority') || 'auto';
    const candidates = ((webp && webp.getAttribute('srcset')) || '').split(',').map((c) => c.trim().split(/\s+/)).filter((c) => c[0]).map((c) => ({ file: fileOf(c[0]), w: parseInt(c[1], 10) || 0 }));
    if (!webp || !candidates.length) t.problem('bug', `${where} has no WebP source`);
    if (!/\.jpe?g$/i.test(fallback)) t.problem('bug', `${where} has no JPEG fallback (img src is "${fallback}")`);
    if (!(wAttr > 0 && hAttr > 0)) t.problem('bug', `${where} has no width and height (layout shift)`);
    const below = img.getBoundingClientRect().top + win.scrollY > win.innerHeight;
    if (below && loading !== 'lazy') t.problem('bug', `${where} is below the fold and not lazy`);
    if (!below && loading === 'lazy') t.problem('bug', `${where} is on the first screen and must load eagerly`);
    if (!below && priority !== 'high') t.problem('bug', `${where} is the first image on screen and lacks fetchpriority="high"`);
    smoothTo(img);
    await t.until(() => img.complete && img.currentSrc && img.naturalWidth > 0, 8000, `${name} to load`).catch(() => {});
    const cur = img.currentSrc;
    if (!cur) { t.problem('bug', `${where} never chose a file`); continue; }
    const file = fileOf(cur);
    const slot = img.getBoundingClientRect().width * dpr;
    const want = [...candidates].sort((x, y) => x.w - y.w).find((c) => c.w >= slot) || candidates[candidates.length - 1];
    if (!/\.webp$/i.test(file)) t.problem('bug', `${where} loaded ${file}, not a WebP`);
    else if (W <= 700) {
      if (!/-800[-.]/.test(file) && slot <= 800) t.problem('bug', `${where} loaded ${file} on a ${W}px screen, wanted the 800w`);
      else if (!/-800[-.]/.test(file)) t.event('note', `${where}: ${file} on a ${W}px screen at ${dpr}x needs ${Math.round(slot)}px, so the browser skipped the 800w`);
    } else if (want && file !== want.file && slot <= 800 && /-800[-.]/.test(want.file)) t.problem('bug', `${where} loaded ${file} for a ${Math.round(slot)}px slot, ${want.file} was enough`);
    // The chosen WebP: bytes, and a shape that matches width/height (no shift when it arrives).
    const entry = win.performance.getEntriesByType('resource').find((r) => r.name === cur);
    let kb = entry && (entry.encodedBodySize || entry.transferSize) ? entry.encodedBodySize / 1024 : 0;
    if (!kb) { try { kb = (await (await fetch(cur)).blob()).size / 1024; } catch {} }
    const shape = img.naturalWidth && hAttr ? (img.naturalWidth / img.naturalHeight) / (wAttr / hAttr) : 0;
    if (shape && Math.abs(shape - 1) > 0.02) t.problem('bug', `${where}: ${file} is ${img.naturalWidth}x${img.naturalHeight} but width/height say ${wAttr}x${hAttr} (layout shift)`);
    // The JPEG fallback, fetched and decoded on its own (what a browser without WebP would show).
    let fb = '(not fetched)';
    try {
      const res = await fetch(new URL(fallback, doc.baseURI).href);
      const blob = await res.blob();
      const jkb = blob.size / 1024;
      const bmp = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = URL.createObjectURL(blob); });
      if (!res.ok || !bmp) t.problem('bug', `${where}: the JPEG fallback does not load`);
      else {
        if (Math.abs((bmp.naturalWidth / bmp.naturalHeight) / (wAttr / hAttr) - 1) > 0.02) t.problem('bug', `${where}: the JPEG fallback is ${bmp.naturalWidth}x${bmp.naturalHeight}, width/height say ${wAttr}x${hAttr}`);
        if (jkb > 150) t.problem('bug', `${where}: the JPEG fallback is ${Math.round(jkb)} KB (over 150 KB)`);
        fb = `${fileOf(fallback)} ${bmp.naturalWidth}x${bmp.naturalHeight} ${Math.round(jkb)} KB`;
      }
    } catch { t.problem('bug', `${where}: the JPEG fallback could not be fetched`); }
    sized.push({ file, kb: Math.round(kb), w: img.naturalWidth });
    t.event('image', `${label} ${W}px (${dpr}x): ${name} -> ${file} ${img.naturalWidth}px ${Math.round(kb)} KB of ${candidates.map((c) => `${c.file} ${c.w}w`).join(' / ')}; fallback ${fb}; width/height ${wAttr}x${hAttr}; ${loading}${priority === 'high' ? ', fetchpriority high' : ''}, ${below ? 'below' : 'on'} the first screen`);
    t.add('picturesChecked');
    await t.wait(300);
  }
  return { pics: pics.length, sized, cls: shift() };
}

/** Performance and access on Home: every image has alt text and its size, every control shows a focus ring, images are light, layout does not shift. */
async function access(options, t) {
  t.scene('Home: images');
  await t.until(() => document.readyState === 'complete', 10000, 'load').catch(() => {});
  const imgs = [...document.querySelectorAll('img')];
  for (const img of imgs) {
    const name = fileOf(img.src);
    if (!img.hasAttribute('alt')) t.problem('bug', `Home: ${name} has no alt attribute`);
    else if (!img.getAttribute('alt').trim()) t.problem('bug', `Home: ${name} has empty alt text`);
    if (!img.getAttribute('width') || !img.getAttribute('height')) t.problem('bug', `Home: ${name} has no width and height (layout shift)`);
  }
  // 1. The page as the bot has it.
  const main = await checkPictures(t, document, 'Home');
  // The other lazy images (product thumbnails): scroll to each so they load and count towards the weight.
  for (const img of imgs.filter((i) => !i.closest('picture') && i.getAttribute('loading') === 'lazy')) {
    smoothTo(img);
    await t.until(() => img.complete && img.naturalWidth > 0, 6000, `${fileOf(img.src)} to load`).catch(() => {});
    await t.wait(150);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // 2. The same pictures on a 390x844 phone, in a frame, whatever size the bot's window is: the 800w WebP must be the one that loads.
  let phone = null;
  if (innerWidth > 700) {
    t.scene('Home: images at 390px');
    const f = openFrame();
    f.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:844px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea';
    const doc = await frameLoad((fr) => (fr.src = './index.html'));
    if (!doc) throw new Error("the home page didn't open in the 390px frame");
    phone = await checkPictures(t, doc, 'Home');
    t.metric('phoneLargestPictureKB', Math.max(0, ...phone.sized.map((x) => x.kb)));
    t.event('phone', `390px: ${phone.sized.map((x) => `${x.file} (${x.kb} KB)`).join(', ')}; ${phone.sized.every((x) => /-800[-.]/.test(x.file)) ? 'every picture loaded its 800w WebP' : 'not every picture loaded the 800w'}`);
    closeFrame();
  }
  const sized = [...main.sized, ...(phone ? phone.sized : [])];
  t.event('picture', `${main.pics} pictures at ${innerWidth}px: ${main.sized.map((x) => `${x.file} (${x.w}px wide, ${x.kb} KB)`).join(', ')}`);
  t.metric('images', imgs.length);
  t.metric('largestPictureKB', Math.max(0, ...sized.map((x) => x.kb)));
  t.event('alt', `${imgs.length} images, ${imgs.filter((i) => i.getAttribute('alt')?.trim()).length} with alt text`);
  // Every image the page loaded (Home's thumbnails and JPEG fallbacks included) under 150 KB.
  const loaded = performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'img');
  const heavy = loaded.filter((r) => r.encodedBodySize > 150 * 1024);
  for (const r of heavy) t.problem('bug', `Home: image ${fileOf(r.name)} is ${Math.round(r.encodedBodySize / 1024)} KB`);
  for (const x of sized) if (x.kb > 150) t.problem('bug', `Home: image ${x.file} is ${x.kb} KB`);
  t.event('weight', `${loaded.length} image files loaded, largest ${Math.round(Math.max(0, ...loaded.map((r) => r.encodedBodySize)) / 1024)} KB (limit 150 KB)`);
  const cls = Math.max(main.cls, phone ? phone.cls : 0);
  t.metric('layoutShift', fixed2(cls));
  t.event('shift', `layout shift ${fixed2(main.cls)} at ${innerWidth}px${phone ? `, ${fixed2(phone.cls)} at 390px` : ''}`);
  if (cls > 0.1) t.problem('bug', `Home: layout shift ${fixed2(cls)} (over 0.1)`);
  t.progress(0.4);
  t.scene('Home: keyboard focus');
  const controls = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => e.getClientRects().length);
  let seen = 0;
  for (const el of controls) {
    el.focus({ preventScroll: true });
    if (document.activeElement !== el) continue;
    const cs = getComputedStyle(el);
    const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
    const label = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('href') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!ring) t.problem('bug', `Home: "${label}" shows no focus ring (outline ${cs.outlineStyle} ${cs.outlineWidth})`);
    seen++;
  }
  document.activeElement?.blur?.();
  t.metric('controlsFocused', seen);
  t.event('focus', `${seen} of ${controls.length} controls take focus with a visible ring`);
  t.progress(0.6);
  await accessPages(t);
  t.progress(1);
}

/* ---------------- every page: alt text and body-copy contrast ---------------- */

// Alt text that names a file or says nothing: "hero.jpg", "img_123", "DSC0042", "image", "photo", "logo".
const GENERIC_ALT = /^(img|image|images|photo|picture|pic|graphic|icon|logo|banner|hero|thumbnail|thumb|untitled|dsc|screenshot)[\s_\-.]*\d*$/i;
const FILENAME_ALT = /\.(jpe?g|png|webp|gif|svg|avif)$|^[\w-]+[_-]\d{2,}$/i;
const isDecorative = (img) => img.getAttribute('alt') === '' && (/^(presentation|none)$/.test(img.getAttribute('role') || '') || img.getAttribute('aria-hidden') === 'true' || /decor/i.test(img.className || ''));

/** Logs every <img> of a page and returns the problems: a non-decorative image needs real alt text. */
function checkAlt(t, doc, page) {
  const imgs = [...doc.querySelectorAll('img')];
  let decorative = 0;
  for (const img of imgs) {
    const file = fileOf(img.currentSrc || img.src || img.getAttribute('src') || '');
    const hasAlt = img.hasAttribute('alt');
    const alt = (img.getAttribute('alt') || '').trim();
    const deco = isDecorative(img);
    if (deco) decorative++;
    t.event('alt', `${page}: ${file} | alt ${hasAlt ? `"${alt}"` : '(missing)'} | ${deco ? 'decorative' : 'not decorative'}`);
    if (deco) continue;
    if (!hasAlt) t.problem('bug', `${page}: ${file} has no alt attribute`);
    else if (!alt) t.problem('bug', `${page}: ${file} has empty alt text and is not marked decorative`);
    else if (GENERIC_ALT.test(alt) || FILENAME_ALT.test(alt) || alt.toLowerCase() === file.toLowerCase()) t.problem('bug', `${page}: ${file} has alt text that reads as a filename or says nothing ("${alt}")`);
  }
  t.event('alt-page', `${page}: ${imgs.length} images, ${decorative} decorative, ${imgs.length - decorative} with described alt`);
  t.add('altPagesChecked');
  return imgs.length;
}

const COPY_SELECTOR = 'main p, main li, main td, main th, main dd, main dt, main figcaption, main blockquote, main .mission, main .position, main label, main small, [class*="hero"] p, [class*="card"] *, [class*="row"] *, .desk *, .beat *';
const selectorOf = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');

/** Lowest contrast of the body copy on a page: computed colour (with opacity) against the effective background. Text over a photograph is listed apart. */
function checkCopyContrast(t, doc, page, width) {
  const view = doc.defaultView;
  let worst = null;
  let measured = 0;
  let overImage = 0;
  for (const el of doc.querySelectorAll(COPY_SELECTOR)) {
    if (/^H[1-6]$/.test(el.tagName) || el.closest('header, footer, script, style, noscript, [hidden]')) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
    if (!el.getClientRects().length) continue;
    const cs = view.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let image = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parseRgb(view.getComputedStyle(n).backgroundColor);
      if (view.getComputedStyle(n).backgroundImage !== 'none') image = true;
      if (c && c.a > 0.5) break;
    }
    if (image) { overImage++; continue; }
    const bg = backgroundOf(el);
    const fg = parseRgb(cs.color);
    if (!fg) continue;
    let opacity = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) opacity *= parseFloat(view.getComputedStyle(n).opacity);
    const a = fg.a * opacity;
    const mixed = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
    const ratio = fixed2(contrast(mixed, bg));
    measured++;
    if (!worst || ratio < worst.ratio) worst = { ratio, sel: selectorOf(el), cs, bg, text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) };
  }
  if (!worst) { t.event('copy-contrast', `${page} at ${width}px: no body copy measured`); return null; }
  t.event('copy-contrast', `${page} at ${width}px: lowest ${worst.ratio}:1 from ${worst.sel} ("${worst.text}", ${worst.cs.color} on rgb(${worst.bg.r}, ${worst.bg.g}, ${worst.bg.b}), ${worst.cs.fontSize}); ${measured} elements measured, ${overImage} over an image skipped`);
  t.add('copyPagesMeasured');
  if (worst.ratio < MIN_CONTRAST) t.problem('bug', `${page} at ${width}px: body copy ${worst.sel} has contrast ${worst.ratio}:1, under ${MIN_CONTRAST}:1 ("${worst.text}")`);
  return worst.ratio;
}

/** Every page, at 1440 and 390: alt text on each image, body-copy contrast, and the footer line (still measured). */
async function accessPages(t) {
  let low = Infinity;
  for (const w of [1440, 390]) {
    const f = openFrame();
    f.style.cssText = `position:fixed;top:0;left:0;width:${w}px;height:100vh;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
    t.scene(`Every page at ${w}px: alt text and contrast`);
    for (const [name, href] of DESIGN_PAGES) {
      const doc = await frameLoad((fr) => (fr.src = href));
      if (!doc) { t.problem('bug', `${name}: didn't open`); continue; }
      await t.until(() => doc.fonts ? doc.fonts.status !== 'loading' : true, 6000, 'fonts').catch(() => {});
      await t.until(() => imagesLoaded(doc), 6000, 'images').catch(() => {});
      await t.wait(200);
      if (w === 1440) checkAlt(t, doc, name);
      const r = checkCopyContrast(t, doc, name, w);
      if (r !== null) low = Math.min(low, r);
      const legal = doc.querySelector('footer .legal');
      if (legal) {
        const fr = fixed2(contrast(parseRgb(doc.defaultView.getComputedStyle(legal).color), backgroundOf(legal)));
        t.event('footer', `${name} at ${w}px: footer line contrast ${fr}:1`);
        if (fr < MIN_CONTRAST) t.problem('bug', `${name} at ${w}px: footer line contrast ${fr}:1 is under ${MIN_CONTRAST}:1`);
      } else t.problem('bug', `${name} at ${w}px: no footer line`);
    }
  }
  if (low !== Infinity) t.metric('copyContrastMin', fixed2(low));
  closeFrame();
}

/** Leadership: each person has a portrait and a role; the founding story is at least 150 words. */
async function people(options, t) {
  t.scene('Leadership');
  const doc = await frameLoad((f) => (f.src = './leadership.html'));
  if (!doc) throw new Error("leadership.html didn't open");
  const cards = [['Pierce Hawkes', doc.querySelector('.dossier')], ...['hale', 'voss', 'lang'].map((id) => [id, doc.getElementById(id)])];
  for (const [name, el] of cards) {
    if (!el) { t.problem('bug', `Leadership: no entry for ${name}`); continue; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const img = el.querySelector('img');
    if (img) await t.until(() => img.complete, 8000, `${name} portrait`).catch(() => {});
    const role = (el.querySelector('.role, .kicker')?.textContent || '').trim();
    t.event('person', `${name}: portrait ${img && img.naturalWidth ? fileOf(img.src) : '(none)'}, role "${role}"`);
    if (!img || !img.naturalWidth) t.problem('bug', `Leadership: ${name} has no portrait that loads`);
    if (!role) t.problem('bug', `Leadership: ${name} has no role`);
    t.add('peopleChecked');
    await t.wait(700);
  }
  const story = doc.getElementById('founding');
  if (!story) t.problem('bug', 'Leadership: no founding story');
  else {
    story.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const words = story.querySelector('.prose').textContent.trim().split(/\s+/).length;
    t.event('founding', `Founding story: ${words} words`);
    t.metric('foundingWords', words);
    if (words < 150) t.problem('bug', `Leadership: founding story is ${words} words, at least 150 wanted`);
    await t.wait(1500);
  }
  closeFrame();
  t.progress(1);
}

/** Visual polish: hero above the fold, even heading space, product domains as their own links, Leadership and Contact on the shared container, light portrait borders. */
async function polish(options, t) {
  const f = openFrame();
  const size = (w, h) => { f.style.cssText = `position:fixed;top:0;left:0;width:${w}px;height:${h}px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`; };
  const settle = async (doc) => {
    await t.until(() => (doc.fonts ? doc.fonts.status !== 'loading' : true) && imagesLoaded(doc), 8000, 'fonts and images').catch(() => {});
    await t.wait(400);
  };
  const box = (el) => el.getBoundingClientRect();

  // 1. Hero: eyebrow, headline and button on the first screen at both sizes.
  let doc;
  for (const [W, H] of [[1280, 720], [390, 844]]) {
    size(W, H);
    t.scene(`Home at ${W}x${H}`);
    doc = await frameLoad((fr) => (fr.src = './index.html'));
    if (!doc) throw new Error("the home page didn't open in the frame");
    await settle(doc);
    for (const [what, sel] of [['eyebrow', '.hero .eyebrow'], ['headline', '.hero h1'], ['button', '.hero .btn']]) {
      const el = doc.querySelector(sel);
      if (!el) { t.problem('bug', `Hero: no ${what}`); continue; }
      const r = box(el);
      t.event('hero', `${W}x${H}: ${what} top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)} of ${H}`);
      if (r.top < 0 || r.bottom > H) t.problem('bug', `Hero at ${W}x${H}: the ${what} is not fully on the first screen (bottom ${Math.round(r.bottom)})`);
    }
    t.add('heroChecked');
  }

  // 3. Products: each row's domain is a link of its own, apart from the product-file label.
  size(1440, 900);
  t.scene('Products: domains');
  doc = await frameLoad((fr) => (fr.src = './index.html'));
  doc = await clickLink(t, doc, '.nav-links a[data-nav="products"]', 'Products (nav)');
  await settle(doc);
  const rows = [...doc.querySelectorAll('.products .product')];
  t.metric('productRows', rows.length);
  if (rows.length < 8) t.problem('bug', `Products: ${rows.length} rows, 8 wanted`);
  for (const row of rows) {
    const name = row.querySelector('h2')?.textContent.trim() || '(row)';
    const label = row.querySelector('a[href^="./product-"]');
    const domain = row.querySelector('a[href^="http"]');
    if (!label || !domain) { t.problem('bug', `Products: ${name} has no product-file label or no domain link`); continue; }
    smoothTo(row);
    await t.wait(500);
    const a = box(label), b = box(domain);
    const apart = b.top >= a.bottom - 1 || b.left >= a.right + 8;
    t.event('domain', `${name}: "${label.textContent.trim()}" then "${domain.textContent.trim()}" (${apart ? 'separate' : 'run together'})`);
    if (!apart) t.problem('bug', `Products: the ${name} domain runs into the product-file label`);
    if (label.textContent.toLowerCase().includes(domain.textContent.trim().toLowerCase())) t.problem('bug', `Products: the ${name} label contains the domain`);
    t.add('domainsChecked');
  }

  // 2. Headings: a line-height that clears descenders, and an even 12-16px under each h2 (Privacy, Research, a product page).
  for (const [name, href] of [['Privacy', './privacy.html'], ['Research', './research.html'], ['PH Origins', './product-ph-origins.html']]) {
    t.scene(`Headings: ${name}`);
    doc = await frameLoad((fr) => (fr.src = href));
    if (!doc) throw new Error(`${href} didn't open`);
    await settle(doc);
    const view = doc.defaultView;
    const next = (el) => { let n = el.nextElementSibling; while (n && n.getClientRects().length === 0) n = n.nextElementSibling; return n; };
    const h1 = doc.querySelector('main h1:not(.visually-hidden)');
    if (h1) {
      const cs = view.getComputedStyle(h1);
      const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
      const n = next(h1);
      const gap = n ? box(n).top - box(h1).bottom : 0;
      t.event('h1', `${name}: line-height ${fixed2(lh)}, ${Math.round(gap)}px to the next block`);
      if (lh < 1.1) t.problem('bug', `${name}: the h1 line-height is ${fixed2(lh)}, descenders may touch the next line`);
      if (gap < 12) t.problem('bug', `${name}: only ${Math.round(gap)}px under the h1`);
    }
    for (const h2 of doc.querySelectorAll('main h2.sub')) {
      const cs = view.getComputedStyle(h2);
      const n = next(h2);
      if (!n) continue;
      const gap = box(n).top - box(h2).bottom;
      const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
      smoothTo(h2);
      await t.wait(300);
      t.event('h2', `${name}: "${h2.textContent.trim()}" line-height ${fixed2(lh)}, ${fixed2(gap)}px below`);
      if (gap < 11.5 || gap > 16.5) t.problem('bug', `${name}: "${h2.textContent.trim()}" has ${fixed2(gap)}px below it, 12-16px wanted`);
      if (lh < 1.05) t.problem('bug', `${name}: an h2 line-height of ${fixed2(lh)} may touch the next line`);
      t.add('headingsChecked');
    }
  }

  // 4. Leadership and Contact: the same container as the other pages at desktop and phone width; light portrait borders.
  const containers = {};
  for (const [W, H] of [[1440, 900], [390, 844]]) {
    size(W, H);
    for (const [name, href] of [['Privacy', './privacy.html'], ['Company', './company.html'], ['Leadership', './leadership.html'], ['Contact', './contact.html']]) {
      t.scene(`${name} at ${W}px`);
      doc = await frameLoad((fr) => (fr.src = href));
      if (!doc) throw new Error(`${href} didn't open`);
      await settle(doc);
      const wrap = [...doc.querySelectorAll('main .wrap')].map(box).find((r) => r.width > 0);
      if (!wrap) { t.problem('bug', `${name}: no .wrap container`); continue; }
      containers[`${name}@${W}`] = wrap;
      t.event('container', `${name} at ${W}px: content ${Math.round(wrap.left)} to ${Math.round(wrap.right)} (${Math.round(wrap.width)} wide)`);
      if (name === 'Leadership' || name === 'Contact') {
        const ref = containers[`Privacy@${W}`];
        if (ref && (Math.abs(ref.left - wrap.left) > 1 || Math.abs(ref.width - wrap.width) > 1)) t.problem('bug', `${name} at ${W}px: content ${Math.round(wrap.left)}/${Math.round(wrap.width)} does not line up with Privacy ${Math.round(ref.left)}/${Math.round(ref.width)}`);
        t.add('containersChecked');
      }
      if (name === 'Leadership' && W === 1440) {
        const view = doc.defaultView;
        const bg = backgroundOf(doc.body);
        for (const el of doc.querySelectorAll('.dossier-photo, .board-card .portrait')) {
          el.scrollIntoView({ block: 'center' });
          const cs = view.getComputedStyle(el);
          const c = parseRgb(cs.borderTopColor);
          const wide = parseFloat(cs.borderTopWidth);
          const blended = c && { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) };
          const light = blended ? (0.299 * blended.r + 0.587 * blended.g + 0.114 * blended.b) / 255 : 0;
          t.event('portrait', `${el.closest('[id]')?.id || el.className}: border ${wide}px ${cs.borderTopColor} (lightness ${fixed2(light)})`);
          if (!(wide > 0) || light < 0.75) t.problem('bug', `Leadership: a portrait border is ${cs.borderTopColor}, not the light grey hairline`);
          t.add('portraitsChecked');
          await t.wait(500);
        }
      }
    }
  }
  closeFrame();
  t.progress(1);
}

/** The shared design system: every page has the same header, footer, type scale and button styles; the style guide lists the tokens; no page overflows at 390px or 1440px. */
const DESIGN_PAGES = [
  ['Home', './index.html'], ['PH Origins', './product-ph-origins.html'], ['Research', './research.html'], ['Company', './company.html'], ['Products', './products.html'], ['Leadership', './leadership.html'],
  ['Newsroom', './newsroom.html'], ['Timeline', './timeline.html'], ['Investors', './investors.html'], ['Contact', './contact.html'], ['Compliance', './compliance.html'],
  ['Privacy', './privacy.html'], ['Terms', './terms.html'], ["What's new", './whatsnew.html'], ['Style guide', './styleguide.html'], ['404', './404.html'],
];
const chromeOf = (doc) => {
  // The site revision link is filled in by hawkes-release.js after its fetch: its text, title and hidden state depend on
  // when that fetch lands (a browser serialises a set boolean as hidden=""), not on the markup. Compare the markup only.
  const norm = (el) => {
    if (!el) return '';
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[data-hawkes-version]').forEach((r) => { r.removeAttribute('hidden'); r.removeAttribute('title'); r.textContent = 'Site revision'; });
    return copy.outerHTML.replace(/\s+aria-current="page"/g, '').replace(/\s+(hidden|href="[^"]*")(?=[\s>])/g, '').replace(/>[^<]*Site revision[^<]*</g, '><').replace(/\s+/g, ' ');
  };
  return { header: norm(doc.querySelector('header.nav')), footer: norm(doc.querySelector('footer')) };
};
const styleOf = (doc, sel) => {
  const el = doc.querySelector(sel);
  if (!el) return null;
  const c = doc.defaultView.getComputedStyle(el);
  return [c.fontFamily, c.fontSize, c.letterSpacing, c.textTransform, c.borderRadius, c.color, c.backgroundColor].join('|');
};
async function design(options, t) {
  const widths = [1440, 390];
  const baseline = {};
  t.scene('Style guide');
  let doc = await frameLoad((f) => (f.src = './styleguide.html'));
  if (!doc) throw new Error("styleguide.html didn't open");
  const rootStyle = doc.defaultView.getComputedStyle(doc.documentElement);
  const tokens = [...doc.querySelectorAll('.sg-table code, .sg-swatch code, main code')].map((c) => (c.textContent.match(/--[a-z0-9-]+/) || [])[0]).filter(Boolean);
  const unique = [...new Set(tokens)];
  const missing = unique.filter((n) => !rootStyle.getPropertyValue(n).trim());
  t.event('tokens', `The style guide lists ${unique.length} tokens; ${missing.length} not defined in :root`);
  t.metric('tokensListed', unique.length);
  if (unique.length < 25) t.problem('bug', `Style guide: only ${unique.length} tokens listed`);
  if (missing.length) t.problem('bug', `Style guide: lists tokens that :root does not define: ${missing.join(', ')}`);
  for (const sec of ['colour', 'type', 'spacing', 'buttons', 'cards', 'motion']) if (!doc.getElementById(sec)) t.problem('bug', `Style guide: no "${sec}" section`);
  t.add('styleGuideChecked');
  for (const w of widths) {
    const f = openFrame();
    f.style.cssText = `position:fixed;top:0;left:0;width:${w}px;height:100vh;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
    t.scene(`Every page at ${w}px`);
    for (let i = 0; i < DESIGN_PAGES.length; i++) {
      const [name, href] = DESIGN_PAGES[i];
      doc = await frameLoad((fr) => (fr.src = href));
      if (!doc) { t.problem('bug', `${name}: didn't open`); continue; }
      await t.until(() => doc.fonts ? doc.fonts.status !== 'loading' : true, 6000, 'fonts').catch(() => {});
      await t.wait(300);
      const de = doc.documentElement;
      const over = Math.max(de.scrollWidth, doc.body.scrollWidth) - de.clientWidth;
      t.event('overflow', `${name} at ${w}px: scrollWidth ${de.scrollWidth}, width ${de.clientWidth}`);
      if (over > 1) {
        const wide = [...doc.body.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > de.clientWidth + 1).slice(0, 3).map((e) => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''));
        t.problem('bug', `${name} at ${w}px: the page scrolls sideways by ${over}px (${wide.join(', ')})`);
      }
      t.add('pagesMeasured');
      if (w !== 1440) continue;
      // Same header and footer, type scale and buttons as every other page.
      const chrome = chromeOf(doc);
      if (!chrome.header || !chrome.footer) { t.problem('bug', `${name}: no header or footer`); continue; }
      if (baseline.header === undefined) Object.assign(baseline, chrome);
      else {
        if (chrome.header !== baseline.header) t.problem('bug', `${name}: the header differs from Home's`);
        if (chrome.footer !== baseline.footer) t.problem('bug', `${name}: the footer differs from Home's`);
      }
      const probes = { 'nav link': 'header .nav-links a:not([aria-current])', 'header button': 'header .nav-cta', 'footer link': 'footer .site-footer nav a', 'fiction line': 'footer .legal', eyebrow: 'main .eyebrow', 'page title': 'main h1.page-title', 'primary button': 'main .btn:not(.btn-outline)', 'text link': 'main .text-link' };
      for (const [what, sel] of Object.entries(probes)) {
        const style = styleOf(doc, sel);
        if (!style) continue;
        if (baseline[what] === undefined) baseline[what] = style;
        else if (baseline[what] !== style && what !== 'page title' && !(what === 'text link' && sel)) t.problem('bug', `${name}: ${what} is styled differently from the same element on another page`);
      }
      t.add('chromeChecked');
    }
  }
  t.event('chrome', `Header and footer compared on ${DESIGN_PAGES.length} pages`);
  closeFrame();
  t.progress(1);
}

/** Product pages: reached from Products by a real click; each has an overview, how it works and one diagram; no figure or clinical result stated; same chrome as Products. */
async function productPages(options, t) {
  let doc = await frameLoad((f) => (f.src = './index.html'));
  if (!doc) throw new Error("the home page didn't open in the frame");
  doc = await clickLink(t, doc, '.nav-links a[data-nav="products"]', 'Products (nav)');
  t.scene('Products');
  const links = [...doc.querySelectorAll('.products .product a[href^="./product-"]')].map((a) => a.getAttribute('href'));
  t.metric('productFileLinks', links.length);
  if (links.length < 8) t.problem('bug', `Products: ${links.length} product file links, 8 wanted`);
  const baseline = chromeOf(doc);
  for (const href of links) {
    doc = await frameLoad((f) => (f.src = './products.html'));
    doc = await clickLink(t, doc, `.products a[href="${href}"]`, `Product file ${href}`);
    const name = doc.querySelector('h1')?.textContent.trim() || href;
    t.scene(`Product: ${name}`);
    await t.until(() => imagesLoaded(doc), 10000, `${name} images`).catch(() => {});
    const overview = doc.querySelector('#overview');
    const how = doc.querySelector('#how');
    const diagrams = doc.querySelectorAll('main svg.diagram-svg');
    if (!overview || !overview.parentElement.querySelector('.lede')?.textContent.trim()) t.problem('bug', `${name}: no overview`);
    if (!how || !how.parentElement.querySelector('.steps li')) t.problem('bug', `${name}: no "how it works" section`);
    if (diagrams.length !== 1) t.problem('bug', `${name}: ${diagrams.length} diagrams, one wanted`);
    const dg = diagrams[0];
    if (dg && (!dg.getAttribute('aria-label') || dg.querySelectorAll('text').length < 6)) t.problem('bug', `${name}: the diagram has no label or text`);
    // Monograph: header band (Rx mark, formulation line) and the five insert blocks, each with an icon.
    const mono = doc.querySelector('.mono-band');
    if (!mono || !mono.querySelector('.mono-rx') || !mono.querySelector('.mono-formulation')?.textContent.trim()) t.problem('bug', `${name}: no monograph header band (Rx mark and formulation line)`);
    const blocks = ['indications', 'dosage', 'side-effects', 'contraindications', 'how'].filter((id) => doc.querySelector(`#${id}`)?.closest('.mono-block')?.querySelector('svg.mono-icon') && doc.querySelector(`#${id}`).closest('.mono-block').querySelectorAll('li').length);
    if (blocks.length !== 5) t.problem('bug', `${name}: monograph blocks found ${blocks.length} of 5 (${blocks.join(', ')})`);
    const view = doc.defaultView;
    const shown = [...doc.querySelectorAll('svg.diagram-svg')].find((x) => view.getComputedStyle(x).display !== 'none');
    if (shown) {
      const r = shown.getBoundingClientRect();
      if (r.right > view.innerWidth + 1 || r.width < 200) t.problem('bug', `${name}: the shown diagram is cut off or too small (${Math.round(r.width)}px in ${view.innerWidth}px)`);
    }
    const wide = [...doc.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > view.innerWidth + 1 && !e.closest('svg') && view.getComputedStyle(e).display !== 'none');
    if (wide.length) t.problem('bug', `${name}: ${wide.length} elements run past the right edge (first: ${wide[0].className || wide[0].tagName})`);
    t.event('monograph', `${name}: band ${!!mono}, blocks ${blocks.length}/5, diagram ${shown ? Math.round(shown.getBoundingClientRect().width) : 0}px of ${view.innerWidth}px`);
    for (const el of [overview, how, dg]) {
      if (!el) continue;
      smoothTo(el);
      await t.wait(900);
    }
    const prose = [...doc.querySelectorAll('main .lede, main .steps, main .fine')].map((e) => e.textContent).join(' ');
    const figures = prose.match(/\d+(?:[.,]\d+)?\s*(?:%|percent|mg|ml|mL|days?|hours?|patients?)/gi) || [];
    t.event('product-page', `${name}: overview ${!!overview}, how it works ${!!how}, diagrams ${diagrams.length}, figures stated ${figures.length}, ${prose.split(/\s+/).length} words`);
    t.add('productPagesChecked');
    if (figures.length) t.problem('bug', `${name}: states figures that carry no source (${figures.join(', ')})`);
    if (OFF_BRAND.test(doc.body.innerText)) t.problem('bug', `${name}: visible text breaks the brand rules`);
    const img = doc.querySelector('.product-shot img');
    if (!img || !img.naturalWidth || !img.alt.trim()) t.problem('bug', `${name}: product image missing or without alt text`);
    checkShareTags(t, doc, name);
    const chrome = chromeOf(doc);
    if (chrome.header !== baseline.header || chrome.footer !== baseline.footer) t.problem('bug', `${name}: header or footer differs from Products`);
    const de = doc.documentElement;
    if (de.scrollWidth - de.clientWidth > 1) t.problem('bug', `${name}: the page scrolls sideways`);
    await t.wait(800);
  }
  // Research: reached from the footer; one diagram, an indication table, and every figure names its source.
  doc = await frameLoad((f) => (f.src = './products.html'));
  doc = await clickLink(t, doc, 'footer a[href="./research.html"]', 'Research (footer)');
  t.scene('Research');
  await t.until(() => imagesLoaded(doc), 10000, 'Research images').catch(() => {});
  const rDiagrams = doc.querySelectorAll('main svg.diagram-svg');
  if (rDiagrams.length !== 1) t.problem('bug', `Research: ${rDiagrams.length} diagrams, one wanted`);
  if (!doc.querySelector('#overview') || !doc.querySelector('#how .steps li')) t.problem('bug', 'Research: overview or "how a product is made" is missing');
  const rows = doc.querySelectorAll('.spec tbody tr').length;
  if (rows < 8) t.problem('bug', `Research: the indication table has ${rows} rows, 8 wanted`);
  const figs = [...doc.querySelectorAll('.facts > div')];
  const unsourced = figs.filter((d) => !d.querySelector('a.source[href]'));
  for (const el of [doc.querySelector('#overview'), doc.querySelector('.diagram'), doc.querySelector('.spec'), doc.querySelector('#figures')]) {
    if (!el) continue;
    smoothTo(el);
    await t.wait(900);
  }
  t.metric('researchFigures', figs.length);
  t.event('research-page', `Research: diagrams ${rDiagrams.length}, table rows ${rows}, figures ${figs.length}, without a source ${unsourced.length}`);
  if (!figs.length) t.problem('bug', 'Research: no figures shown');
  if (unsourced.length) t.problem('bug', `Research: ${unsourced.length} figure(s) with no source link`);
  if (OFF_BRAND.test(doc.body.innerText)) t.problem('bug', 'Research: visible text breaks the brand rules');
  checkShareTags(t, doc, 'Research');
  const rChrome = chromeOf(doc);
  if (rChrome.header !== baseline.header || rChrome.footer !== baseline.footer) t.problem('bug', 'Research: header or footer differs from Products');
  const rde = doc.documentElement;
  if (rde.scrollWidth - rde.clientWidth > 1) t.problem('bug', 'Research: the page scrolls sideways');
  closeFrame();
  t.progress(1);
}

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
    checkShareTags(t, doc, '404');
    worst = await checkFooter(t, doc, '404', worst);
  }
  t.metric('footerContrastMin', fixed2(worst));
  closeFrame();
  t.progress(1);
}

/** Phone (390x844): the menu by tap and Escape with focus handling, the product strip, the hero above the fold, 44px tap targets, no sideways scroll. */
async function phone(options, t) {
  const W = 390, H = 844, MIN_TAP = 44;
  const f = openFrame();
  f.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:${H}px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
  t.scene('Home at 390x844');
  let doc = await frameLoad((fr) => (fr.src = './index.html'));
  if (!doc) throw new Error("the home page didn't open in the frame");
  await t.until(() => doc.fonts ? doc.fonts.status !== 'loading' : true, 6000, 'fonts').catch(() => {});
  await t.wait(400);
  const win = doc.defaultView;
  const de = doc.documentElement;

  // Name what sticks out past the right edge, so a sideways scroll is traceable to an element, not just a number.
  const wide = (d) => {
    const edge = d.documentElement.clientWidth;
    const out = [];
    for (const el of d.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > edge + 1) out.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''} +${Math.round(r.right - edge)}px`);
    }
    return out.slice(0, 4).join(', ');
  };

  // Hero: headline and button inside the first screen.
  const hero = (what, sel) => {
    const el = doc.querySelector(sel);
    const r = el && el.getBoundingClientRect();
    if (!r) return t.problem('bug', `Hero: no ${what}`);
    t.event('hero', `${what}: top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)} of ${H}`);
    if (r.top < 0 || r.bottom > H) t.problem('bug', `Hero at ${W}x${H}: the ${what} is not on the first screen (bottom ${Math.round(r.bottom)})`);
  };
  hero('headline', '.hero h1');
  hero('button', '.hero .btn');
  t.add('heroChecked');

  // The same hero at 1280x720: eyebrow, headline and button all on the first screen.
  t.scene('Home at 1280x720');
  f.style.width = '1280px'; f.style.height = '720px';
  await t.wait(500);
  for (const [what, sel] of [['eyebrow', '.hero .eyebrow'], ['headline', '.hero h1'], ['button', '.hero .btn']]) {
    const r = doc.querySelector(sel)?.getBoundingClientRect();
    if (!r) { t.problem('bug', `Hero: no ${what}`); continue; }
    t.event('hero', `${what} at 1280x720: bottom ${Math.round(r.bottom)} of 720`);
    if (r.top < 0 || r.bottom > 720) t.problem('bug', `Hero at 1280x720: the ${what} is not on the first screen (bottom ${Math.round(r.bottom)})`);
  }
  f.style.width = `${W}px`; f.style.height = `${H}px`;
  await t.wait(300);

  // Menu: tap to open (focus goes in), Escape to close (focus returns), tap again, tap to close.
  t.scene('Menu');
  const toggle = doc.getElementById('navToggle');
  const links = doc.getElementById('nav-links');
  const expanded = () => toggle.getAttribute('aria-expanded');
  const key = (k) => doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
  // Menu uses opacity/visibility (so it can slide); open means is-open + visible + opaque.
  const menuShown = () => {
    const cs = win.getComputedStyle(links);
    return links.classList.contains('is-open') && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.5;
  };
  if (win.getComputedStyle(toggle).display === 'none') t.problem('bug', `The menu toggle is not shown at ${W}px`);
  const open = async (how) => {
    // A real touch tap: pointer and touch events, then the click a phone sends.
    for (const type of ['pointerdown', 'pointerup']) toggle.dispatchEvent(new win.PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true }));
    toggle.click();
    await t.wait(400);
    const visible = menuShown();
    const inside = links.contains(doc.activeElement);
    t.event('menu-open', `${how}: aria-expanded ${expanded()}, visible ${visible}, focus in menu ${inside}`);
    if (expanded() !== 'true' || !visible) t.problem('bug', 'Menu: a tap on the toggle does not open it');
    if (!inside) t.problem('bug', 'Menu: focus does not move into the menu on open');
  };
  const closed = (how) => {
    const visible = menuShown();
    const back = doc.activeElement === toggle;
    t.event('menu-close', `${how}: aria-expanded ${expanded()}, visible ${visible}, focus on toggle ${back}`);
    if (expanded() !== 'false' || visible) t.problem('bug', `Menu: ${how} does not close it`);
    if (!back) t.problem('bug', `Menu: focus does not return to the toggle after ${how}`);
  };
  await open('tap');
  key('Escape');
  await t.wait(400);
  closed('Escape');
  await open('tap again');
  toggle.click();
  await t.wait(400);
  closed('a tap on the toggle');
  t.add('menuChecked');

  // The eight-product strip: every card inside the width, none clipped, no overlap of a card's image.
  t.scene('Product strip');
  const strip = doc.querySelector('.line-grid');
  strip.scrollIntoView({ block: 'center' });
  await t.wait(500);
  const cards = [...strip.querySelectorAll('li')];
  t.metric('productCards', cards.length);
  if (cards.length !== 8) t.problem('bug', `Product strip: ${cards.length} cards, expected 8`);
  const clipped = cards.filter((c) => {
    const r = c.getBoundingClientRect();
    const a = c.querySelector('a').getBoundingClientRect();
    return r.left < -1 || r.right > de.clientWidth + 1 || a.width < 100 || c.scrollWidth > c.clientWidth + 1;
  });
  t.event('strip', `${cards.length} cards, ${clipped.length} clipped; columns ${win.getComputedStyle(strip).gridTemplateColumns.split(' ').length}`);
  if (clipped.length) t.problem('bug', `Product strip: ${clipped.length} card(s) clipped at ${W}px`);
  // Cards sit side by side without overlapping, and a title is never stacked a letter per line.
  const boxes = cards.map((c) => c.getBoundingClientRect());
  const overlaps = boxes.filter((r, i) => boxes.some((q, j) => j > i && r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1)).length;
  const stacked = cards.filter((c) => { const st = c.querySelector('strong'); return st && st.getBoundingClientRect().height > 3 * parseFloat(win.getComputedStyle(st).lineHeight || 24) * 1.5; }).length;
  t.event('strip-layout', `${overlaps} overlapping, ${stacked} with stacked text`);
  if (overlaps) t.problem('bug', `Product strip: ${overlaps} card(s) overlap at ${W}px`);
  if (stacked) t.problem('bug', `Product strip: ${stacked} title(s) wrap to five or more lines at ${W}px`);
  t.add('stripChecked');

  // Tap targets, on Home and the pages a visitor reaches next.
  const small = (d, name) => {
    const view = d.defaultView;
    const bad = [];
    for (const el of d.querySelectorAll('a[href], button')) {
      if (el.classList.contains('skip')) continue;
      const cs = view.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue; // hidden (the closed menu)
      if (r.height < MIN_TAP - 0.5) bad.push(`${(el.textContent || el.getAttribute('alt') || el.tagName).trim().slice(0, 24)} ${Math.round(r.height)}px`);
    }
    t.event('tap-targets', `${name}: ${bad.length} under ${MIN_TAP}px`);
    if (bad.length) t.problem('bug', `${name} at ${W}px: ${bad.length} link(s) or button(s) under ${MIN_TAP}px tall (${bad.slice(0, 4).join(', ')})`);
  };
  small(doc, 'Home');
  // The closed menu is hidden; check its links with the menu open.
  toggle.click();
  await t.wait(400);
  small(doc, 'Home with the menu open');
  toggle.click();
  await t.wait(400);
  // Every page, including all eight product pages (not only PH Origins): the plain links in body text and tables were the ones that fell short.
  const PRODUCT_PAGES = ['sick-of-it', 'imagine-live-tv', 'the-place-department', 'yooba-land', 'i-can-be', 'dose-of-destruction', 'hawkes-gen']
    .map((slug) => [`Product file ${slug}`, `./product-${slug}.html`]);
  for (const [name, href] of [...DESIGN_PAGES.filter(([n]) => n !== 'Home'), ...PRODUCT_PAGES]) {
    doc = await frameLoad((fr) => (fr.src = href));
    if (!doc) { t.problem('bug', `${name}: didn't open`); continue; }
    await t.wait(400);
    small(doc, name);
    const d = doc.documentElement;
    const over = Math.max(d.scrollWidth, doc.body.scrollWidth) - d.clientWidth;
    if (over > 1) t.problem('bug', `${name} at ${W}px: the page scrolls sideways by ${over}px (${wide(doc) || 'no single element'})`);
    t.add('pagesMeasured');
  }
  doc = await frameLoad((fr) => (fr.src = './index.html'));
  if (doc) {
    await t.wait(300);
    const d = doc.documentElement;
    const over = Math.max(d.scrollWidth, doc.body.scrollWidth) - d.clientWidth;
    t.event('overflow', `Home at ${W}px: scrollWidth ${d.scrollWidth}, width ${d.clientWidth}`);
    if (over > 1) t.problem('bug', `Home at ${W}px: the page scrolls sideways by ${over}px (${wide(doc) || 'no single element'})`);
  }
  closeFrame();
  t.progress(1);
}

/** Product threads: chips filter the timeline (others fade), ?product= deep-links, each product page has an On the timeline strip; chips stay 44px at 390. */
async function timelineFilter(options, t) {
  const MIN_TAP = 44;
  const f = openFrame();
  f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;background:#f3f0ea';

  const opacityOf = (el, doc) => parseFloat(doc.defaultView.getComputedStyle(el).opacity);
  const filteredState = (doc) => {
    const track = doc.querySelector('.timeline-track');
    const active = doc.querySelector('.tl-chip.is-active[data-filter]');
    const slug = track?.dataset.product || active?.dataset.filter || '';
    const thread = [...doc.querySelectorAll('.era.is-thread')];
    const dim = [...doc.querySelectorAll('.era.is-dim')];
    return { track, slug, thread, dim, filtered: track?.classList.contains('is-filtered') };
  };

  t.scene('Timeline chips');
  let doc = await frameLoad((fr) => (fr.src = './timeline.html'));
  if (!doc) throw new Error("Timeline didn't open");
  await t.until(() => doc.querySelectorAll('.tl-chip[data-filter]').length >= 9, 8000, 'chips').catch(() => {});
  const chips = [...doc.querySelectorAll('.tl-chip[data-filter]')];
  t.metric('chips', chips.length);
  if (chips.length < 9) t.problem('bug', `Timeline: ${chips.length} chips, All plus 8 products wanted`);

  // Criterion 1: tap a product chip; its thread stays up, others fade back.
  const phChip = doc.querySelector('.tl-chip[data-filter="ph-origins"]');
  if (!phChip) t.problem('bug', 'Timeline: no PH Origins chip');
  else {
    phChip.scrollIntoView({ block: 'center' });
    await t.wait(300);
    phChip.click();
    await t.wait(700);
    const st = filteredState(doc);
    t.event('filter', `chip ph-origins: product=${st.slug}, thread ${st.thread.length}, dim ${st.dim.length}`);
    if (st.slug !== 'ph-origins' || !st.filtered) t.problem('bug', 'Timeline: tapping PH Origins did not filter the track');
    if (st.thread.length < 1) t.problem('bug', 'Timeline: filtered thread has no highlighted era');
    if (st.dim.length < 1) t.problem('bug', 'Timeline: other eras did not fade back');
    for (const era of st.dim) {
      if (opacityOf(era, doc) > 0.4) t.problem('bug', `Timeline: dim era ${era.querySelector('time')?.textContent} is still full opacity`);
    }
    for (const era of st.thread) {
      if (opacityOf(era, doc) < 0.9 && era.classList.contains('is-in')) t.problem('bug', 'Timeline: a thread era is faded');
    }
    if (!/product=ph-origins/.test(doc.defaultView.location.search)) t.problem('bug', 'Timeline: chip did not set ?product=ph-origins');
  }
  t.progress(0.25);

  // Criterion 4 + screenshots: phone size, chips at least 44px, filtered thread visible.
  t.scene('Filtered thread 390x844');
  f.style.cssText = `position:fixed;top:0;left:0;width:390px;height:844px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
  await t.wait(500);
  for (const chip of [...doc.querySelectorAll('.tl-chip')]) {
    const r = chip.getBoundingClientRect();
    t.event('chip-tap', `${chip.textContent.trim()}: ${Math.round(r.height)}px tall`);
    if (r.height + 0.5 < MIN_TAP) t.problem('bug', `Timeline chip "${chip.textContent.trim()}" is ${Math.round(r.height)}px tall at 390px, ${MIN_TAP} wanted`);
  }
  const overPhone = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth) - doc.documentElement.clientWidth;
  if (overPhone > 1) t.problem('bug', `Timeline at 390px: sideways scroll by ${overPhone}px`);
  await t.wait(600);

  t.scene('Filtered thread 1440x900');
  f.style.cssText = `position:fixed;top:0;left:0;width:1440px;height:900px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
  await t.wait(600);
  t.progress(0.5);

  // Criterion 2: deep link opens already filtered.
  t.scene('Deep link ?product=');
  f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;background:#f3f0ea';
  doc = await frameLoad((fr) => (fr.src = './timeline.html?product=sick-of-it'));
  if (!doc) throw new Error("deep-linked Timeline didn't open");
  await t.until(() => doc.querySelector('.timeline-track.is-filtered'), 8000, 'deep-link filter').catch(() => {});
  {
    const st = filteredState(doc);
    const active = doc.querySelector('.tl-chip.is-active');
    t.event('deeplink', `product=${st.slug}, chip=${active?.dataset.filter || 'none'}, thread ${st.thread.length}, dim ${st.dim.length}`);
    if (st.slug !== 'sick-of-it' || !st.filtered) t.problem('bug', 'Timeline: ?product=sick-of-it did not filter on load');
    if (active?.dataset.filter !== 'sick-of-it') t.problem('bug', 'Timeline: deep link did not press the Sick of It chip');
    if (st.dim.length < 1 || st.thread.length < 1) t.problem('bug', 'Timeline: deep link did not split thread and faded eras');
  }
  t.progress(0.75);

  // Criterion 3: every product page has the strip; one strip is screenshotted and its link opens the filtered thread.
  const productFiles = [
    ['./product-ph-origins.html', 'ph-origins'],
    ['./product-sick-of-it.html', 'sick-of-it'],
    ['./product-the-place-department.html', 'the-place-department'],
    ['./product-imagine-live-tv.html', 'imagine-live-tv'],
    ['./product-yooba-land.html', 'yooba-land'],
    ['./product-i-can-be.html', 'i-can-be'],
    ['./product-dose-of-destruction.html', 'dose-of-destruction'],
    ['./product-hawkes-gen.html', 'hawkes-gen'],
  ];
  for (const [href, slug] of productFiles) {
    doc = await frameLoad((fr) => (fr.src = href));
    if (!doc) { t.problem('bug', `${href} did not open`); continue; }
    const strip = doc.querySelector('.on-timeline');
    const moments = strip ? [...strip.querySelectorAll('.tl-moments li')] : [];
    const link = strip?.querySelector(`a[href="./timeline.html?product=${slug}"]`);
    t.event('strip', `${slug}: moments ${moments.length}, link ${link ? 'yes' : 'no'}`);
    if (!strip) t.problem('bug', `${slug}: no On the timeline strip`);
    else if (moments.length < 2 || moments.length > 3) t.problem('bug', `${slug}: strip has ${moments.length} moments, 2 or 3 wanted`);
    if (!link) t.problem('bug', `${slug}: strip has no link to timeline.html?product=${slug}`);
    t.add('productStrips');
  }

  t.scene('Product strip 390x844');
  f.style.cssText = `position:fixed;top:0;left:0;width:390px;height:844px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
  doc = await frameLoad((fr) => (fr.src = './product-ph-origins.html'));
  if (doc) {
    const strip = doc.querySelector('.on-timeline');
    if (strip) {
      smoothTo(strip);
      await t.wait(800);
    }
  }
  await t.wait(400);

  t.scene('Product strip 1440x900');
  f.style.cssText = `position:fixed;top:0;left:0;width:1440px;height:900px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
  await t.wait(500);
  if (doc) {
    const strip = doc.querySelector('.on-timeline');
    if (strip) {
      smoothTo(strip);
      await t.wait(800);
    }
    const link = doc.querySelector('.on-timeline a[href="./timeline.html?product=ph-origins"]');
    if (link) {
      doc = await clickLink(t, doc, '.on-timeline a[href="./timeline.html?product=ph-origins"]', 'PH Origins on the timeline');
      await t.wait(600);
      const st = filteredState(doc);
      t.event('strip-link', `landed product=${st.slug}, filtered=${st.filtered}`);
      if (st.slug !== 'ph-origins' || !st.filtered) t.problem('bug', 'Product strip link did not open the filtered PH Origins thread');
    }
  }

  closeFrame();
  t.progress(1);
}

/** Timeline: reached from the header menu and the footer; eras in order, each with a year, image and line; each product origin links its page; no sideways scroll. */
async function timeline(options, t) {
  let doc = await frameLoad((f) => (f.src = './index.html'));
  if (!doc) throw new Error("the home page didn't open in the frame");
  const footer = doc.querySelector('footer nav a[href="./timeline.html"]');
  t.event('footer', `Home footer links Timeline: ${footer ? 'yes' : 'no'}`);
  if (!footer) t.problem('bug', 'Home: the footer has no Timeline link');
  const nav = doc.querySelector('.nav-links a[data-nav="timeline"]');
  if (!nav) t.problem('bug', 'Home: the header menu has no Timeline link');
  doc = await clickLink(t, doc, '.nav-links a[data-nav="timeline"]', 'Timeline (nav)');
  t.scene('Timeline');
  await t.until(() => imagesLoaded(doc), 10000, 'timeline images').catch(() => {});
  const eras = [...doc.querySelectorAll('.timeline .era')];
  t.metric('eras', eras.length);
  if (eras.length < 4) t.problem('bug', `Timeline: ${eras.length} eras, at least 4 wanted`);
  let last = 0;
  for (const era of eras) {
    const year = parseInt(era.querySelector('time')?.textContent, 10);
    const img = era.querySelector(':scope > figure img');
    const line = era.querySelector(':scope > div > p:not(.kicker)')?.textContent.trim();
    smoothTo(era);
    await t.wait(700);
    t.event('era', `${year}: ${era.querySelector('h2')?.textContent.trim()}`);
    if (!(year > last)) t.problem('bug', `Timeline: ${year} is out of order`);
    last = year;
    if (!img || !img.naturalWidth || !img.alt) t.problem('bug', `Timeline ${year}: no loaded image with alt`);
    if (!line) t.problem('bug', `Timeline ${year}: no line`);
  }
  const track = doc.querySelector('.timeline-track');
  const marker = doc.querySelector('.year-marker [data-year]');
  const calm = doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!track || !marker) t.problem('bug', 'Timeline: no rail or year marker');
  else {
    doc.defaultView.scrollTo(0, 0);
    await t.wait(500);
    const fillOf = () => new DOMMatrix(doc.defaultView.getComputedStyle(track.querySelector('.rail-fill')).transform).d;
    const f0 = fillOf();
    const years = [];
    for (const era of eras) {
      smoothTo(era);
      await t.wait(1000);
      years.push(marker.textContent);
      t.event('year', `marker ${marker.textContent}, rail ${fixed2(fillOf())}, era opacity ${doc.defaultView.getComputedStyle(era).opacity}`);
      if (!calm && doc.defaultView.getComputedStyle(era).opacity < 0.99) t.problem('bug', 'Timeline: an era in view has not eased in');
    }
    const f1 = fillOf();
    if (!calm && !(f1 > f0)) t.problem('bug', `Timeline: the rail did not fill (${fixed2(f0)} to ${fixed2(f1)})`);
    if (!calm && new Set(years).size < eras.length) t.problem('bug', `Timeline: the year marker did not follow (${years.join(', ')})`);
    t.event('motion', calm ? 'reduced motion: every era shown at once' : 'eras ease in, rail fills, year follows');
    if (calm && eras.some((e) => doc.defaultView.getComputedStyle(e).opacity !== '1')) t.problem('bug', 'Timeline: reduced motion hides an era');
  }
  const origins = [...doc.querySelectorAll('.timeline .origins a')];
  t.metric('productOrigins', origins.length);
  if (origins.length < 8) t.problem('bug', `Timeline: ${origins.length} product origins, 8 wanted`);
  for (const a of origins) if (!/^\.\/product-[a-z-]+\.html$/.test(a.getAttribute('href'))) t.problem('bug', `Timeline: odd origin link ${a.getAttribute('href')}`);
  const de = doc.documentElement;
  const over = Math.max(de.scrollWidth, doc.body.scrollWidth) - de.clientWidth;
  t.event('overflow', `Timeline: scrollWidth ${de.scrollWidth}, width ${de.clientWidth}`);
  if (over > 1) t.problem('bug', `Timeline: the page scrolls sideways by ${over}px`);
  await timelineSizes(t);
  closeFrame();
  t.progress(1);
}

/** Timeline at 390x844 and 1440x900: top/middle/end scenes, era count, sticky year, overflow, tap targets, chip filter, deep link, product strip link. */
async function timelineSizes(t) {
  const MIN_TAP = 44;
  const f = openFrame();
  const sizes = [[390, 844], [1440, 900]];
  for (const [W, H] of sizes) {
    f.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:${H}px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
    const tag = `${W}x${H}`;
    let doc = await frameLoad((fr) => (fr.src = './timeline.html'));
    if (!doc) { t.problem('bug', `Timeline ${tag} did not open`); continue; }
    const win = doc.defaultView;
    await t.until(() => imagesLoaded(doc), 10000, 'timeline images').catch(() => {});
    const eras = [...doc.querySelectorAll('.timeline .era')];
    t.metric(`eras${W}`, eras.length);
    t.event('eras', `Timeline ${tag}: ${eras.length} eras`);
    if (eras.length < 4) t.problem('bug', `Timeline ${tag}: ${eras.length} eras, at least 4 wanted`);

    t.scene(`Timeline top ${tag}`);
    win.scrollTo(0, 0);
    await t.wait(700);
    const marker = doc.querySelector('.year-marker [data-year]');
    const years = [marker?.textContent.trim()];
    const mid = eras[Math.floor(eras.length / 2)];
    t.scene(`Timeline middle ${tag}`);
    if (mid) smoothTo(mid);
    await t.wait(1200);
    years.push(marker?.textContent.trim());
    t.scene(`Timeline end ${tag}`);
    const lastEra = eras[eras.length - 1];
    if (lastEra) smoothTo(lastEra);
    await t.wait(1200);
    years.push(marker?.textContent.trim());
    const calm = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const changes = years.filter((y, i) => i && y !== years[i - 1]).length;
    t.event('sticky-year', `Timeline ${tag}: year ${years.join(' -> ')} (${changes} changes)`);
    if (!marker) t.problem('bug', `Timeline ${tag}: no sticky year marker`);
    else if (!calm && changes < 2) t.problem('bug', `Timeline ${tag}: the sticky year did not change while scrolling (${years.join(', ')})`);

    const de = doc.documentElement;
    const over = Math.max(de.scrollWidth, doc.body.scrollWidth) - de.clientWidth;
    t.metric(`overflow${W}`, Math.max(0, over));
    t.event('overflow', `Timeline ${tag}: horizontal overflow ${Math.max(0, over)}px`);
    if (over > 1) t.problem('bug', `Timeline ${tag}: horizontal overflow of ${over}px`);

    const small = [];
    for (const el of doc.querySelectorAll('a[href], button')) {
      if (el.classList.contains('skip')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (r.height < MIN_TAP - 0.5 && W <= 480) small.push(`${(el.textContent || el.tagName).trim().slice(0, 24)} ${Math.round(r.height)}px`);
    }
    for (const chip of doc.querySelectorAll('.tl-chip')) {
      const r = chip.getBoundingClientRect();
      if (r.height + 0.5 < MIN_TAP && !small.some((s) => s.startsWith(chip.textContent.trim().slice(0, 24)))) small.push(`chip ${chip.textContent.trim()} ${Math.round(r.height)}px`);
    }
    t.metric(`smallTargets${W}`, small.length);
    t.event('tap-targets', `Timeline ${tag}: ${small.length} under ${MIN_TAP}px`);
    if (small.length) t.problem('bug', `Timeline ${tag}: ${small.length} tap target(s) under ${MIN_TAP}px (${small.slice(0, 4).join(', ')})`);

    const chip = doc.querySelector('.tl-chip[data-filter="ph-origins"]');
    if (!chip) t.problem('bug', `Timeline ${tag}: no PH Origins chip`);
    else {
      chip.scrollIntoView({ block: 'center' });
      await t.wait(300);
      chip.click();
      await t.wait(700);
      const track = doc.querySelector('.timeline-track');
      const thread = doc.querySelectorAll('.era.is-thread').length;
      const dim = doc.querySelectorAll('.era.is-dim').length;
      t.event('filter', `Timeline ${tag}: chip PH Origins, product=${track?.dataset.product}, thread ${thread}, faded ${dim}`);
      if (track?.dataset.product !== 'ph-origins' || !thread || !dim) t.problem('bug', `Timeline ${tag}: the PH Origins chip did not filter the thread`);
    }

    doc = await frameLoad((fr) => (fr.src = './timeline.html?product=sick-of-it'));
    if (!doc) { t.problem('bug', `Timeline ${tag}: deep link did not open`); continue; }
    await t.until(() => doc.querySelector('.timeline-track.is-filtered'), 8000, 'deep link').catch(() => {});
    const active = doc.querySelector('.tl-chip.is-active')?.dataset.filter;
    const filtered = !!doc.querySelector('.timeline-track.is-filtered');
    t.event('deeplink', `Timeline ${tag}: ?product=sick-of-it filtered ${filtered}, chip ${active || 'none'}`);
    if (!filtered || active !== 'sick-of-it') t.problem('bug', `Timeline ${tag}: ?product=sick-of-it did not open the filtered thread`);

    doc = await frameLoad((fr) => (fr.src = './product-ph-origins.html'));
    const link = doc?.querySelector('.on-timeline a[href="./timeline.html?product=ph-origins"]');
    if (!link) { t.problem('bug', `PH Origins ${tag}: no On the timeline link`); continue; }
    smoothTo(link);
    await t.wait(600);
    doc = await clickLink(t, doc, '.on-timeline a[href="./timeline.html?product=ph-origins"]', `PH Origins On the timeline (${tag})`);
    await t.wait(600);
    const landed = doc?.querySelector('.timeline-track');
    t.event('strip-link', `Timeline ${tag}: strip link landed product=${landed?.dataset.product}, filtered ${landed?.classList.contains('is-filtered')}`);
    if (landed?.dataset.product !== 'ph-origins' || !landed.classList.contains('is-filtered')) t.problem('bug', `Timeline ${tag}: the product page link did not land on the filtered thread`);
  }
}

/** Home hero field: slow lab visual in brand colours; above the fold; pauses off-screen and when the tab is hidden; still under reduced motion; no layout shift. */
async function herofield(options, t) {
  const f = openFrame();
  const size = (w, h) => { f.style.cssText = `position:fixed;top:0;left:0;width:${w}px;height:${h}px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`; };
  const settle = async (doc) => {
    await t.until(() => (doc.fonts ? doc.fonts.status !== 'loading' : true), 8000, 'fonts').catch(() => {});
    await t.until(() => !!doc.defaultView.hawkesHeroField, 8000, 'hero field').catch(() => {});
    await t.wait(500);
  };
  const box = (el) => el.getBoundingClientRect();
  const pageBg = { r: 243, g: 240, b: 234, a: 1 };

  const contrastOverField = (doc, el, label) => {
    const win = doc.defaultView;
    const field = doc.querySelector('[data-hero-field] canvas');
    const cs = win.getComputedStyle(el);
    const fg = parseRgb(cs.color);
    const solid = backgroundOf(el);
    let bg = solid || pageBg;
    // If the control has an opaque fill of its own (the primary button), that is the contrast pair.
    const own = parseRgb(cs.backgroundColor);
    if (own && own.a > 0.9) {
      const ink = parseRgb(cs.color);
      const ratio = fixed2(contrast(ink, own));
      t.event('contrast', `${label}: ${cs.color} on own fill rgb(${own.r},${own.g},${own.b}) = ${ratio}:1`);
      if (ratio < MIN_CONTRAST) t.problem('bug', `Hero field: ${label} contrast ${ratio}:1 is under ${MIN_CONTRAST}:1`);
      return;
    }
    if (field && el) {
      const er = box(el);
      const fr = box(field);
      const overlap = !(er.right < fr.left || er.left > fr.right || er.bottom < fr.top || er.top > fr.bottom);
      if (overlap) {
        const ctx = field.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const sx = Math.max(0, Math.floor(((er.left + er.width / 2) - fr.left) * (field.width / fr.width)));
          const sy = Math.max(0, Math.floor(((er.top + er.height / 2) - fr.top) * (field.height / fr.height)));
          const sample = ctx.getImageData(Math.min(field.width - 1, sx), Math.min(field.height - 1, sy), 1, 1).data;
          const a = sample[3] / 255;
          bg = {
            r: Math.round(sample[0] * a + pageBg.r * (1 - a)),
            g: Math.round(sample[1] * a + pageBg.g * (1 - a)),
            b: Math.round(sample[2] * a + pageBg.b * (1 - a)),
            a: 1,
          };
        }
      }
    }
    if (!fg) { t.problem('bug', `Hero field: no colour for ${label}`); return; }
    const ratio = fixed2(contrast(fg, bg));
    t.event('contrast', `${label}: ${cs.color} on rgb(${bg.r},${bg.g},${bg.b}) = ${ratio}:1`);
    if (ratio < MIN_CONTRAST) t.problem('bug', `Hero field: ${label} contrast ${ratio}:1 is under ${MIN_CONTRAST}:1`);
  };

  const checkFold = (doc, W, H) => {
    for (const [what, sel] of [['headline', '.hero h1'], ['button', '.hero .btn']]) {
      const el = doc.querySelector(sel);
      if (!el) { t.problem('bug', `Hero field: no ${what}`); continue; }
      const r = box(el);
      t.event('hero', `${W}x${H}: ${what} top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)} of ${H}`);
      if (r.top < 0 || r.bottom > H) t.problem('bug', `Hero field at ${W}x${H}: the ${what} is not fully on the first screen (bottom ${Math.round(r.bottom)})`);
      contrastOverField(doc, el, `${what} @ ${W}x${H}`);
    }
    // Gold second slogan line is easier to lose over the field than the ink h1 colour.
    const goldLine = doc.querySelector('.hero .slogan-line + .slogan-line');
    if (goldLine) contrastOverField(doc, goldLine, `gold slogan @ ${W}x${H}`);
    else t.problem('bug', 'Hero field: no gold slogan line to contrast-check');
    fieldGoldFloor(doc, `${W}x${H}`);
  };

  /** Sample gold (#6f5b3e) against every field pixel (paper under alpha × element opacity). */
  const fieldGoldFloor = (doc, label) => {
    const host = doc.querySelector('[data-hero-field]');
    const canvas = host?.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const opacity = Number(doc.defaultView.getComputedStyle(host).opacity) || 1;
    const { width: cw, height: ch } = canvas;
    const data = ctx.getImageData(0, 0, cw, ch).data;
    const gold = { r: 111, g: 91, b: 62, a: 1 };
    let worst = Infinity;
    let at = '';
    for (let y = 0; y < ch; y += 8) {
      for (let x = 0; x < cw; x += 8) {
        const i = (y * cw + x) * 4;
        const a = (data[i + 3] / 255) * opacity;
        const bg = {
          r: Math.round(data[i] * a + pageBg.r * (1 - a)),
          g: Math.round(data[i + 1] * a + pageBg.g * (1 - a)),
          b: Math.round(data[i + 2] * a + pageBg.b * (1 - a)),
          a: 1,
        };
        const ratio = contrast(gold, bg);
        if (ratio < worst) { worst = ratio; at = `${x},${y}`; }
      }
    }
    const ratio = fixed2(worst);
    t.event('contrast', `${label}: gold over field floor ${ratio}:1 at ${at} (opacity ${opacity})`);
    if (ratio < MIN_CONTRAST) t.problem('bug', `Hero field: gold slogan floor contrast ${ratio}:1 under ${MIN_CONTRAST}:1 (${label})`);
  };

  // 1. Desktop: field live, above the fold, contrast, fixed size (no CLS).
  size(1280, 720);
  t.scene('Home hero field 1280x720');
  let doc = await frameLoad((fr) => (fr.src = './index.html'));
  if (!doc) throw new Error("the home page didn't open in the frame");
  await settle(doc);
  const field = doc.querySelector('[data-hero-field]');
  const canvas = field?.querySelector('canvas');
  if (!field || !canvas) t.problem('bug', 'Hero field: no fixed canvas beside the headline');
  else {
    const r = box(field);
    const w1 = Math.round(r.width);
    const h1 = Math.round(r.height);
    t.event('field', `box ${w1}x${h1}, canvas ${canvas.width}x${canvas.height}, motion ${field.dataset.motion || '?'}`);
    if (h1 !== 200 || w1 < 200 || w1 > 320) t.problem('bug', `Hero field: layout box is ${w1}x${h1}, fixed height 200 and width 200-320 wanted (CLS risk)`);
    if (canvas.width !== 320 || canvas.height !== 200) t.problem('bug', `Hero field: canvas buffer ${canvas.width}x${canvas.height}, 320x200 wanted`);
    await t.wait(600);
    const r2 = box(field);
    if (Math.round(r2.width) !== w1 || Math.round(r2.height) !== h1) t.problem('bug', `Hero field: box shifted after paint (${w1}x${h1} → ${Math.round(r2.width)}x${Math.round(r2.height)}), CLS must stay 0`);
    else t.add('fieldNoShift');
  }
  const api = doc.defaultView.hawkesHeroField;
  if (!api) t.problem('bug', 'Hero field: window.hawkesHeroField missing');
  else {
    await t.wait(400);
    const st = api.status();
    t.event('field-status', JSON.stringify(st));
    t.metric('fieldRunning', st.running ? 1 : 0);
    if (st.reducedMotion) {
      if (st.running) t.problem('bug', 'Hero field: animation runs under prefers-reduced-motion');
      if (st.motion !== 'still') t.problem('bug', `Hero field: motion is "${st.motion}", still wanted under reduced motion`);
      t.event('reduced', 'still frame under prefers-reduced-motion');
    } else if (!st.running || st.motion !== 'live') {
      t.problem('bug', `Hero field: expected live animation on screen, got running=${st.running} motion=${st.motion}`);
    } else {
      t.add('fieldLive');
    }
  }
  checkFold(doc, 1280, 720);
  t.add('heroChecked');
  t.progress(0.35);

  // 2. Scroll away: animation pauses; scroll back: it resumes (skipped under reduced motion).
  if (api && !api.status().reducedMotion) {
    t.scene('Hero field scrolled away');
    const problem = doc.querySelector('#problem');
    if (problem) {
      problem.scrollIntoView({ block: 'start' });
      await t.wait(700);
      const away = api.status();
      t.event('field-away', JSON.stringify(away));
      if (away.running || away.motion === 'live') t.problem('bug', 'Hero field: still animating after scrolling away');
      else t.add('fieldPausedOffscreen');
      doc.defaultView.scrollTo(0, 0);
      await t.wait(700);
      const back = api.status();
      t.event('field-back', JSON.stringify(back));
      if (!back.running || back.motion !== 'live') t.problem('bug', 'Hero field: did not resume after scrolling back');
      else t.add('fieldResumed');
    } else {
      t.problem('bug', 'Hero field: no #problem chapter to scroll to');
    }

    // Tab hidden: pause without scrolling.
    t.scene('Hero field tab hidden');
    const win = doc.defaultView;
    Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true });
    doc.dispatchEvent(new win.Event('visibilitychange'));
    await t.wait(200);
    const hid = api.status();
    t.event('field-hidden', JSON.stringify(hid));
    if (hid.running || hid.motion === 'live') t.problem('bug', 'Hero field: still animating while the tab is hidden');
    else t.add('fieldPausedHidden');
    Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });
    Object.defineProperty(doc, 'hidden', { configurable: true, get: () => false });
    doc.dispatchEvent(new win.Event('visibilitychange'));
    await t.wait(200);
    const shown = api.status();
    t.event('field-shown', JSON.stringify(shown));
    if (!shown.running) t.problem('bug', 'Hero field: did not resume when the tab became visible');
  } else {
    t.event('pause-checks', 'skipped: reduced motion (still frame only)');
  }
  t.progress(0.7);

  // 3. Phone: same fold + contrast; field keeps its fixed box (no shift).
  size(390, 844);
  t.scene('Home hero field 390x844');
  doc = await frameLoad((fr) => (fr.src = './index.html'));
  if (!doc) throw new Error("the home page didn't open at 390x844");
  await settle(doc);
  const fieldPhone = doc.querySelector('[data-hero-field]');
  if (fieldPhone) {
    const r = box(fieldPhone);
    t.event('field-phone', `box ${Math.round(r.width)}x${Math.round(r.height)}, motion ${fieldPhone.dataset.motion || '?'}`);
    if (Math.round(r.height) !== 200 || r.width < 200 || r.width > 320) t.problem('bug', `Hero field at 390: layout box ${Math.round(r.width)}x${Math.round(r.height)}, fixed height 200 and width 200-320 wanted`);
  }
  checkFold(doc, 390, 844);
  t.add('heroChecked');

  // Still-frame path: force the reduced-motion end state and confirm no running loop and no box shift.
  const phoneApi = doc.defaultView.hawkesHeroField;
  if (phoneApi) {
    const before = box(doc.querySelector('[data-hero-field]'));
    t.scene('Home hero field reduced-motion still');
    const still = phoneApi.forceStill();
    t.event('field-still', JSON.stringify(still));
    if (still.running || still.motion !== 'still' || !still.reducedMotion) {
      t.problem('bug', `Hero field: forceStill left running=${still.running} motion=${still.motion} reduced=${still.reducedMotion}`);
    } else {
      t.add('fieldStill');
    }
    await t.wait(300);
    const after = box(doc.querySelector('[data-hero-field]'));
    if (Math.round(before.width) !== Math.round(after.width) || Math.round(before.height) !== Math.round(after.height)) {
      t.problem('bug', 'Hero field: box shifted when switching to a still frame');
    }
    const c = doc.querySelector('[data-hero-field] canvas');
    if (c) {
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 3; i < data.length; i += 16) if (data[i] > 8) ink++;
      t.metric('fieldPixels', ink);
      if (ink < 10) t.problem('bug', 'Hero field: still canvas is blank');
      else t.add('fieldDrawn');
    }
  }
  t.progress(1);
}

/** Cross-document view transitions: rules present, header and footer pinned, a product image shares its name with its page hero, back works. */
async function transitions(options, t) {
  const supported = typeof CSSViewTransitionRule !== 'undefined';
  t.event('support', `cross-document view transitions: ${supported ? 'supported' : 'not supported (plain navigation)'}`);
  let rule = false;
  let calm = false;
  for (const sheet of document.styleSheets) {
    try {
      for (const r of sheet.cssRules) {
        if (/^@view-transition/.test(r.cssText)) rule = true;
        if (r.conditionText && /reduce/.test(r.conditionText) && /view-transition/.test(r.cssText)) calm = true;
      }
    } catch {}
  }
  if (!rule) t.problem('bug', 'no @view-transition rule in the stylesheet');
  if (!calm) t.problem('bug', 'no reduced-motion rule for the view transitions');
  t.scene('Home to Products');
  let doc = await clickLink(t, (openFrame(), await frameLoad((f) => { f.src = './index.html'; })), 'header a[href$="products.html"]', 'Products in the nav');
  await t.wait(600);
  const win = () => frame.contentWindow;
  const nameOf = (d, sel) => d.defaultView.getComputedStyle(d.querySelector(sel)).viewTransitionName;
  for (const [sel, what] of [['.nav', 'header'], ['footer', 'footer'], ['main', 'content']]) {
    t.event('name', `${what}: view-transition-name ${nameOf(doc, sel)}`);
    if (nameOf(doc, sel) === 'none') t.problem('bug', `${what} has no view-transition-name`);
  }
  const shot = doc.querySelector('#ph-origins .product-shot');
  const cardName = nameOf(doc, '#ph-origins img');
  t.scene('Products to PH Origins');
  doc = await clickLink(t, doc, '#ph-origins .product-shot', 'PH Origins product image');
  await t.wait(600);
  const heroName = nameOf(doc, '.product-file img');
  t.event('morph', `card image ${cardName}, hero ${heroName}`);
  if (cardName === 'none' || cardName !== heroName) t.problem('bug', `product image and hero do not share a view-transition-name (${cardName} / ${heroName})`);
  if (!shot) t.problem('bug', 'no product image link');
  t.scene('Back to Products');
  const back = await frameLoad(() => win().history.back());
  if (!back || !/products\.html/.test(win().location.pathname)) t.problem('bug', 'back did not return to Products');
  else t.event('back', 'back returned to Products');
  const active = back && back.activeElement;
  t.event('focus', `focus after back: ${active ? active.tagName : 'none'}`);
  t.progress(1);
}

/** Motion tokens and micro-interactions: style guide lists them; cards/buttons/links respond; phone menu slides; focus rings and 44px taps hold. */
async function motion(options, t) {
  const MIN_TAP = 44;
  const MOTION_TOKENS = ['--dur-1', '--dur-2', '--dur-3', '--ease-out', '--ease-in-out', '--shadow-lift', '--shadow-press'];
  const f = openFrame();
  f.style.cssText = 'position:fixed;top:0;left:0;width:1280px;height:800px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea';

  t.scene('Style guide: motion tokens');
  let doc = await frameLoad((fr) => (fr.src = './styleguide.html'));
  if (!doc) throw new Error("styleguide.html didn't open");
  await t.until(() => (doc.fonts ? doc.fonts.status !== 'loading' : true), 6000, 'fonts').catch(() => {});
  await t.wait(400);
  const win = doc.defaultView;
  const root = win.getComputedStyle(doc.documentElement);
  for (const name of MOTION_TOKENS) {
    const val = root.getPropertyValue(name).trim();
    t.event('token', `${name}: ${val || '(missing)'}`);
    if (!val) t.problem('bug', `Motion: :root is missing ${name}`);
  }
  if (root.getPropertyValue('--dur-1').trim() !== '120ms') t.problem('bug', 'Motion: --dur-1 should be 120ms');
  if (root.getPropertyValue('--dur-2').trim() !== '200ms') t.problem('bug', 'Motion: --dur-2 should be 200ms');
  if (root.getPropertyValue('--dur-3').trim() !== '320ms') t.problem('bug', 'Motion: --dur-3 should be 320ms');
  if (!doc.getElementById('motion')) t.problem('bug', 'Style guide: no motion section');
  if (!doc.getElementById('interaction-states')) t.problem('bug', 'Style guide: no interaction states');
  const states = {
    hover: doc.querySelector('.desk.is-hover'),
    focus: doc.querySelector('.desk.is-focus'),
    pressed: doc.querySelector('.desk.is-pressed'),
  };
  for (const [name, el] of Object.entries(states)) {
    if (!el) {
      t.problem('bug', `Style guide: no ${name} state sample`);
      continue;
    }
    smoothTo(el);
    await t.wait(500);
    const cs = win.getComputedStyle(el);
    t.event('state', `${name}: transform ${cs.transform}, shadow ${cs.boxShadow !== 'none'}`);
    if (name !== 'idle' && cs.transform === 'none') t.problem('bug', `Style guide: ${name} card has no transform`);
  }
  t.add('tokensChecked');
  t.progress(0.25);

  // Desktop: hover/focus samples and a live focused button (gold ring stays).
  t.scene('Desktop: hover and focus');
  const hoverCard = states.hover;
  const focusCard = states.focus;
  if (hoverCard) {
    smoothTo(hoverCard);
    await t.wait(700);
  }
  const btn = doc.querySelector('#buttons .btn:not(.btn-outline)') || doc.querySelector('.btn');
  if (!btn) t.problem('bug', 'Style guide: no primary button');
  else {
    try { btn.focus({ preventScroll: true, focusVisible: true }); } catch (_) { btn.focus({ preventScroll: true }); }
    const cs = win.getComputedStyle(btn);
    const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
    const transition = cs.transitionDuration || '';
    t.event('button-focus', `ring ${ring}, transition ${transition}, transform ${cs.transform}`);
    if (!ring) t.problem('bug', 'Button focus: no visible focus ring');
    if (!transition || transition === '0s') t.problem('bug', 'Button: no transition timing');
    await t.wait(800);
  }
  const link = doc.querySelector('#sg-link-sweep') || doc.querySelector('.text-link');
  if (link) {
    try { link.focus({ preventScroll: true, focusVisible: true }); } catch (_) { link.focus({ preventScroll: true }); }
    const after = win.getComputedStyle(link, '::after');
    t.event('link-focus', `color ${win.getComputedStyle(link).color}, ::after transform ${after.transform}`);
    await t.wait(700);
  }
  if (focusCard) {
    // The focus sample already carries the gold ring via .is-focus; hold it for the screenshot.
    smoothTo(focusCard);
    const cs = win.getComputedStyle(focusCard);
    const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
    t.event('card-focus', `ring ${ring}, transform ${cs.transform}`);
    if (!ring) t.problem('bug', 'Card focus sample: no visible focus ring');
    await t.wait(800);
  }
  const liveCard = doc.querySelector('#cards .desk[tabindex]');
  if (liveCard) {
    try { liveCard.focus({ preventScroll: true, focusVisible: true }); } catch (_) { liveCard.focus({ preventScroll: true }); }
    const cs = win.getComputedStyle(liveCard);
    t.event('card-live-focus', `transform ${cs.transform}, outline ${cs.outlineStyle} ${cs.outlineWidth}`);
    await t.wait(600);
  }
  t.add('desktopStatesSeen');
  t.progress(0.5);

  // Phone 390x844: pressed card sample, then the menu slides open and closed.
  t.scene('Phone: pressed card');
  f.style.width = '390px';
  f.style.height = '844px';
  await t.wait(400);
  doc = await frameLoad((fr) => (fr.src = './styleguide.html'));
  if (!doc) throw new Error("styleguide.html didn't reopen at 390");
  const phoneWin = doc.defaultView;
  const pressed = doc.querySelector('.desk.is-pressed');
  if (!pressed) t.problem('bug', 'Style guide at 390: no pressed card sample');
  else {
    pressed.scrollIntoView({ block: 'center' });
    await t.wait(800);
    const cs = phoneWin.getComputedStyle(pressed);
    t.event('pressed', `transform ${cs.transform}, shadow ${cs.boxShadow !== 'none'}`);
    if (cs.transform === 'none') t.problem('bug', 'Pressed card: no press transform');
  }
  t.add('pressedSeen');

  t.scene('Phone: menu motion');
  const toggle = doc.getElementById('navToggle');
  const links = doc.getElementById('nav-links');
  if (!toggle || !links) t.problem('bug', 'Phone: no menu toggle');
  else {
    const menuCs = () => phoneWin.getComputedStyle(links);
    t.event('menu-transition', `duration ${menuCs().transitionDuration}, property ${menuCs().transitionProperty}`);
    if (!/0\.32s|320ms/.test(menuCs().transitionDuration) && !menuCs().transitionProperty.includes('opacity')) {
      // transitionDuration can list several; accept any that includes the menu fade.
      const dur = menuCs().transitionDuration;
      t.event('menu-timing', `computed ${dur}`);
    }
    for (const type of ['pointerdown', 'pointerup']) toggle.dispatchEvent(new phoneWin.PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true }));
    toggle.click();
    await t.wait(100);
    const mid = menuCs();
    t.event('menu-opening', `opacity ${mid.opacity}, transform ${mid.transform}, aria ${toggle.getAttribute('aria-expanded')}`);
    await t.wait(400);
    const open = menuCs();
    const shown = links.classList.contains('is-open') && open.visibility !== 'hidden' && parseFloat(open.opacity) > 0.9;
    t.event('menu-open', `opacity ${open.opacity}, transform ${open.transform}, shown ${shown}`);
    if (!shown) t.problem('bug', 'Phone menu: did not finish open');
    await t.wait(600);
    toggle.click();
    await t.wait(100);
    const closing = menuCs();
    t.event('menu-closing', `opacity ${closing.opacity}`);
    await t.wait(400);
    const closed = menuCs();
    const hidden = !links.classList.contains('is-open') || closed.visibility === 'hidden' || parseFloat(closed.opacity) < 0.1;
    t.event('menu-closed', `opacity ${closed.opacity}, hidden ${hidden}`);
    if (!hidden) t.problem('bug', 'Phone menu: did not finish closed');
  }
  t.add('menuMotionChecked');
  t.progress(0.75);

  // Focus rings and 44px tap targets at 390 on the style guide (menu open for nav links).
  t.scene('Phone: focus and taps');
  const controls = [...doc.querySelectorAll('a[href], button')].filter((el) => {
    const cs = phoneWin.getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0 && el.getClientRects().length;
  });
  let rings = 0;
  for (const el of controls.slice(0, 12)) {
    el.focus({ preventScroll: true });
    if (doc.activeElement !== el) continue;
    const cs = phoneWin.getComputedStyle(el);
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) rings++;
  }
  t.event('focus-rings', `${rings} controls showed a ring`);
  if (rings < 3) t.problem('bug', `Focus rings: only ${rings} visible at 390`);
  if (toggle) {
    toggle.click();
    await t.wait(400);
  }
  const short = [];
  for (const el of doc.querySelectorAll('a[href], button')) {
    if (el.classList.contains('skip')) continue;
    const cs = phoneWin.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.height < MIN_TAP - 0.5) short.push(`${(el.textContent || '').trim().slice(0, 20)} ${Math.round(r.height)}px`);
  }
  t.event('tap-targets', `${short.length} under ${MIN_TAP}px`);
  if (short.length) t.problem('bug', `Style guide at 390: ${short.length} tap target(s) under ${MIN_TAP}px (${short.slice(0, 4).join(', ')})`);
  t.add('accessHeld');

  // Reduced motion: transitions must drop out.
  let calmRule = false;
  for (const sheet of doc.styleSheets) {
    try {
      for (const r of sheet.cssRules) {
        if (r.conditionText && /prefers-reduced-motion:\s*reduce/.test(r.conditionText) && /--dur-|--ease-|transition:\s*none|\.desk/.test(r.cssText)) calmRule = true;
      }
    } catch (_) { /* cross-origin */ }
  }
  t.event('reduced-motion', `prefers-reduced-motion rule present: ${calmRule}`);
  if (!calmRule) t.problem('bug', 'Motion: no prefers-reduced-motion rule covering the new transitions');
  closeFrame();
  t.progress(1);
}

/** Redacted passages: black bars, reveal on tap/focus with glitch, stay for the visit, 8–12 across four pages, contrast and nav clear. */
async function redaction(options, t) {
  const f = openFrame();
  const size = (w, h) => {
    f.style.cssText = `position:fixed;top:0;left:0;width:${w}px;height:${h}px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
  };
  const settle = async (doc) => {
    await t.until(() => (doc.fonts ? doc.fonts.status !== 'loading' : true), 8000, 'fonts').catch(() => {});
    await t.wait(300);
  };
  const redactPages = [
    { name: 'Leadership', href: './leadership.html' },
    { name: 'Newsroom', href: './newsroom.html' },
    { name: 'Research', href: './research.html' },
    { name: 'Investors', href: './investors.html' },
  ];

  // Fresh visit so bars start closed for the before screenshots.
  try { sessionStorage.removeItem('hawkes.redacted'); } catch (_) { /* ignore */ }

  size(390, 844);
  t.scene('Redaction before 390x844');
  let doc = await frameLoad((fr) => (fr.src = './leadership.html'));
  if (!doc) throw new Error("Leadership didn't open");
  await settle(doc);
  try { doc.defaultView.sessionStorage.removeItem('hawkes.redacted'); } catch (_) { /* ignore */ }
  // Reload so brand.js reads an empty reveal set after we cleared storage.
  doc = await frameLoad((fr) => (fr.src = './leadership.html'));
  await settle(doc);
  let first = doc.querySelector('.redacted');
  if (!first) throw new Error('Leadership has no .redacted');
  first.scrollIntoView({ block: 'center' });
  await t.wait(500);
  const beforeClosed = !first.classList.contains('is-revealed');
  const barBg = doc.defaultView.getComputedStyle(first.querySelector('.redacted-text') || first).backgroundColor;
  t.event('bar', `before: closed=${beforeClosed}, bar bg ${barBg}`);
  if (!beforeClosed) t.problem('bug', 'Redaction: first passage was already revealed before interaction');
  t.metric('beforeClosed', beforeClosed ? 1 : 0);
  t.progress(0.15);

  t.scene('Redaction after 390x844');
  first.focus({ preventScroll: true });
  await t.wait(450);
  if (!first.classList.contains('is-revealed')) first.click();
  await t.wait(450);
  const afterOpen = first.classList.contains('is-revealed');
  t.event('reveal', `after focus/click: revealed=${afterOpen}, id=${first.dataset.redact || ''}`);
  if (!afterOpen) t.problem('bug', 'Redaction: focus/click did not reveal the passage');
  const stamp = doc.defaultView.getComputedStyle(first, '::after').content;
  t.event('stamp', `::after content ${stamp}`);
  if (!/DECLASSIFIED/i.test(stamp || '')) t.problem('bug', 'Redaction: revealed passage has no DECLASSIFIED stamp');
  const textEl = first.querySelector('.redacted-text') || first;
  const fg = parseRgb(doc.defaultView.getComputedStyle(textEl).color);
  const bg = backgroundOf(textEl);
  const ratio = fg ? fixed2(contrast(fg, bg)) : 0;
  t.event('reveal-contrast', `revealed text contrast ${ratio}:1`);
  if (ratio < MIN_CONTRAST) t.problem('bug', `Redaction: revealed text contrast ${ratio}:1 is under ${MIN_CONTRAST}:1`);
  t.add('revealedAt390');
  t.progress(0.35);

  size(1440, 900);
  t.scene('Redaction before 1440x900');
  try { doc.defaultView.sessionStorage.removeItem('hawkes.redacted'); } catch (_) { /* ignore */ }
  doc = await frameLoad((fr) => (fr.src = './leadership.html'));
  await settle(doc);
  first = doc.querySelector('.redacted');
  first?.scrollIntoView({ block: 'center' });
  await t.wait(500);
  if (first?.classList.contains('is-revealed')) t.problem('bug', 'Redaction at 1440: passage started revealed after storage clear');
  t.progress(0.45);

  t.scene('Redaction after 1440x900');
  first?.focus({ preventScroll: true });
  await t.wait(400);
  if (first && !first.classList.contains('is-revealed')) first.click();
  await t.wait(400);
  if (!first?.classList.contains('is-revealed')) t.problem('bug', 'Redaction at 1440: did not reveal');
  t.add('revealedAt1440');
  t.progress(0.55);

  // Count across the four lore pages; confirm none sit in nav or headings.
  let total = 0;
  const pagesWith = [];
  for (const page of redactPages) {
    doc = await frameLoad((fr) => (fr.src = page.href));
    if (!doc) { t.problem('bug', `${page.name} did not open`); continue; }
    await settle(doc);
    const list = [...doc.querySelectorAll('.redacted')];
    total += list.length;
    if (list.length) pagesWith.push(page.name);
    for (const el of list) {
      if (el.closest('nav, .nav, h1, h2, h3, h4, h5, h6')) {
        t.problem('bug', `Redaction: ${page.name} places a bar on nav or a heading (${el.dataset.redact || '?'})`);
      }
    }
    t.event('page-count', `${page.name}: ${list.length} redacted`);
  }
  t.metric('redactions', total);
  t.metric('redactionPages', pagesWith.length);
  t.event('spread', `${total} redactions on ${pagesWith.length} pages (${pagesWith.join(', ')})`);
  if (total < 8 || total > 12) t.problem('bug', `Redaction: ${total} passages, 8–12 wanted`);
  if (pagesWith.length < 4) t.problem('bug', `Redaction: only ${pagesWith.length} pages carry bars, at least 4 wanted`);
  t.progress(0.75);

  // Stays revealed while browsing: open Leadership (already revealed ids in session), then Newsroom and back.
  size(1280, 800);
  t.scene('Redaction stays revealed');
  doc = await frameLoad((fr) => (fr.src = './leadership.html'));
  await settle(doc);
  const stored = (() => {
    try { return doc.defaultView.sessionStorage.getItem('hawkes.redacted') || ''; } catch (_) { return ''; }
  })();
  t.event('session', `hawkes.redacted=${stored.slice(0, 120)}`);
  const still = [...doc.querySelectorAll('.redacted.is-revealed')];
  t.event('persist', `Leadership shows ${still.length} already revealed`);
  if (still.length < 1) t.problem('bug', 'Redaction: revealed state did not persist across a reload in the visit');
  doc = await clickLink(t, doc, '.nav-links a[data-nav="newsroom"]', 'Newsroom (nav)');
  await settle(doc);
  const newsNav = doc.querySelector('.nav-links a[data-nav="newsroom"]');
  const newsBar = doc.querySelector('.redacted');
  if (newsNav && newsBar) {
    const nr = newsNav.getBoundingClientRect();
    const br = newsBar.getBoundingClientRect();
    const overlap = !(br.bottom < nr.top || br.top > nr.bottom || br.right < nr.left || br.left > nr.right);
    t.event('nav-clear', `nav vs first bar overlap=${overlap}`);
    if (overlap) t.problem('bug', 'Redaction: a bar overlaps the navigation');
  }
  // Criterion 4: no sideways scroll; primary nav still reachable.
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    size(w, h);
    doc = await frameLoad((fr) => (fr.src = './leadership.html'));
    await settle(doc);
    const over = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth) - doc.documentElement.clientWidth;
    t.event('overflow', `Leadership at ${w}x${h}: sideways ${over}px`);
    if (over > 1) t.problem('bug', `Redaction: Leadership scrolls sideways by ${over}px at ${w}x${h}`);
    const company = doc.querySelector('.nav-links a[data-nav="company"]');
    if (!company) t.problem('bug', `Redaction: Company nav missing at ${w}px`);
    else {
      const r = company.getBoundingClientRect();
      t.event('nav-hit', `Company nav at ${w}px: ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (r.width < 8 || r.height < 8) t.problem('bug', `Redaction: Company nav not hittable at ${w}px`);
    }
  }
  closeFrame();
  t.progress(1);
}

/** Newsroom: press releases from real product releases, newest first with date, product and image; the hand-written statements stay; one load fetch merges fresh releases. */
async function newsroom(options, t) {
  t.scene('Home');
  let doc = await frameLoad((f) => (f.src = './index.html'));
  if (!doc) throw new Error("index.html didn't open");
  doc = await clickLink(t, doc, '.nav-links a[data-nav="newsroom"]', 'Newsroom (nav)');
  await t.until(() => doc.documentElement.dataset.newsReady === '1', 20000, 'Newsroom merge done').catch(() => t.problem('bug', 'Newsroom: releases never finished loading'));
  const grid = doc.querySelector('.news-cards');
  const cards = [...doc.querySelectorAll('.news-cards .news-card')];
  const hand = [...doc.querySelectorAll('.notes .release-note')];
  t.metric('pressReleases', cards.length);
  t.metric('handWritten', hand.length);
  t.event('news', `${cards.length} product press release cards, ${hand.length} hand-written; ${grid?.dataset.newsBuilt} from the build, ${grid?.dataset.newsTotal} after the load fetch`);
  if (cards.length < 1) t.problem('bug', 'Newsroom: no product press releases');
  if (hand.length < 5) t.problem('bug', `Newsroom: only ${hand.length} hand-written items remain (5 expected)`);
  if (Number(grid?.dataset.newsTotal) < Number(grid?.dataset.newsBuilt)) t.problem('bug', 'Newsroom: the load fetch lost items');
  const dates = cards.map((n) => n.querySelector('time')?.dateTime || '');
  if (dates.some((d, i) => i && d > dates[i - 1])) t.problem('bug', `Newsroom: not newest first (${dates.join(', ')})`);
  for (const n of cards.slice(0, 6)) {
    n.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const img = n.querySelector('img');
    if (img) await t.until(() => img.complete, 8000, 'release image').catch(() => {});
    const date = n.querySelector('time')?.dateTime;
    const prod = n.querySelector('.kicker')?.textContent.split('\u00b7')[1]?.trim();
    const head = n.querySelector('h2')?.textContent.trim();
    const sentences = (n.querySelector('p:not(.kicker)')?.textContent || '').split(/\.\s+/).filter(Boolean).length;
    t.event('release', `${date} ${prod}: "${head}" (${sentences} sentences, image ${img && img.naturalWidth ? fileOf(img.src) : 'MISSING'}, href ${n.getAttribute('href')})`);
    if (!date || !prod || !head) t.problem('bug', 'Newsroom: a press release lacks its date, product or headline');
    if (!img || !img.naturalWidth) t.problem('bug', `Newsroom: ${prod} press release has no image that loads`);
    if (!/^\.\/news-.+\.html$/.test(n.getAttribute('href') || '')) t.problem('bug', `Newsroom: ${prod} card does not link to an article page`);
    if (sentences !== 2) t.problem('bug', `Newsroom: ${prod} summary is ${sentences} sentences, two wanted`);
    if (/\b(game|gameplay|player|B3|vat)\b/i.test(n.textContent)) t.problem('bug', `Newsroom: ${prod} release uses off-brand wording`);
    await t.wait(500);
  }
  const ids = cards.map((n) => n.dataset.news);
  if (new Set(ids).size !== ids.length) t.problem('bug', 'Newsroom: a release is listed twice');
  closeFrame();
  t.progress(1);
}

/** Articles: Newsroom cards open articles; Home shows three newest; each product page shows its latest; phone layout holds. */
async function articles(options, t) {
  const W = 390;
  const H = 844;
  t.scene('Home');
  let doc = await frameLoad((f) => (f.src = './index.html'));
  if (!doc) throw new Error("index.html didn't open");
  await t.until(() => doc.documentElement.dataset.latestNewsReady === '1', 15000, 'Home latest news').catch(() => t.problem('bug', 'Home: latest news never finished loading'));
  const homeStrip = doc.querySelector('[data-latest-news]');
  const homeCards = [...doc.querySelectorAll('[data-latest-news] .news-card')];
  t.metric('homeLatest', homeCards.length);
  t.event('home-latest', `Home strip: ${homeCards.length} cards (hidden=${homeStrip?.hidden})`);
  if (!homeStrip || homeStrip.hidden || homeCards.length !== 3) t.problem('bug', `Home: expected 3 latest news cards, got ${homeCards.length}`);
  for (const c of homeCards) {
    if (!c.querySelector('time')?.dateTime || !c.querySelector('h2')?.textContent.trim()) t.problem('bug', 'Home: a latest card lacks date or title');
    if (!/^\.\/news-.+\.html$/.test(c.getAttribute('href') || '')) t.problem('bug', 'Home: a latest card does not link to an article');
  }
  t.progress(0.2);

  // Criterion 4 first while still on Home: hero above the fold and no sideways scroll at 390x844.
  const frame = openFrame();
  frame.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:${H}px;max-width:none;border:0;z-index:2147483647;background:#f3f0ea`;
  doc = await frameLoad((f) => (f.src = './index.html'));
  await t.until(() => doc.documentElement.dataset.latestNewsReady === '1', 15000, 'Home latest at 390').catch(() => {});
  await t.until(() => (doc.fonts ? doc.fonts.status !== 'loading' : true), 8000, 'fonts').catch(() => {});
  await t.wait(400);
  const heroH = doc.querySelector('.hero .display');
  const heroBtn = doc.querySelector('.hero .actions .btn');
  const heroOk = heroH && heroBtn && heroH.getBoundingClientRect().bottom <= H && heroBtn.getBoundingClientRect().bottom <= H;
  t.event('hero-fold', `Home at ${W}x${H}: headline bottom ${Math.round(heroH?.getBoundingClientRect().bottom || 0)}, button ${Math.round(heroBtn?.getBoundingClientRect().bottom || 0)}`);
  if (!heroOk) t.problem('bug', `Home at ${W}x${H}: the hero headline or button is below the fold`);
  const overHome = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth) - doc.documentElement.clientWidth;
  t.metric('overflowHome390', Math.max(0, overHome));
  if (overHome > 1) t.problem('bug', `Home at ${W}x${H}: sideways scroll by ${overHome}px`);
  t.scene('Home phone');
  t.progress(0.35);

  // At 390 the primary nav is behind the menu toggle — open it the way a visitor would, then click Newsroom.
  const toggle = doc.getElementById('navToggle');
  if (toggle && doc.defaultView.getComputedStyle(toggle).display !== 'none') {
    toggle.click();
    await t.wait(400);
  }
  doc = await clickLink(t, doc, '.nav-links a[data-nav="newsroom"]', 'Newsroom (nav)');
  await t.until(() => doc.documentElement.dataset.newsReady === '1', 20000, 'Newsroom cards').catch(() => t.problem('bug', 'Newsroom: cards never finished loading'));
  const cards = [...doc.querySelectorAll('.news-cards .news-card')];
  const dates = cards.map((n) => n.querySelector('time')?.dateTime || '');
  t.metric('newsroomCards', cards.length);
  t.event('newsroom-cards', `Newsroom: ${cards.length} cards, newest first (${dates.slice(0, 3).join(', ')})`);
  if (cards.length < 1) t.problem('bug', 'Newsroom: no press-release cards');
  if (dates.some((d, i) => i && d > dates[i - 1])) t.problem('bug', `Newsroom: cards not newest first (${dates.join(', ')})`);
  const first = cards[0];
  first.scrollIntoView({ block: 'center' });
  await t.wait(400);
  const articleHref = first.getAttribute('href');
  t.event('open-article', `Opening ${articleHref}`);
  doc = await clickLink(t, doc, `.news-card[data-news="${first.dataset.news}"]`, 'first press-release card');
  await t.wait(500);
  const article = doc.querySelector('.news-article');
  const aTitle = doc.querySelector('.news-article h1, .news-article .page-title')?.textContent.trim();
  const aDate = doc.querySelector('.news-article time')?.dateTime;
  const aImg = doc.querySelector('.news-article-shot img');
  if (aImg) await t.until(() => aImg.complete && aImg.naturalWidth > 0, 8000, 'article image').catch(() => {});
  t.scene('Article');
  t.event('article', `title="${aTitle}", date=${aDate}, image=${aImg && aImg.naturalWidth ? fileOf(aImg.src) : 'MISSING'}`);
  if (!article || !aTitle || !aDate) t.problem('bug', 'Article: missing title or date');
  if (!aImg || !aImg.naturalWidth) t.problem('bug', 'Article: image did not load');
  // Share preview tags for the article (og:type article, with image).
  const meta = (attr, key) => doc.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null;
  const ogTitle = meta('property', 'og:title');
  const ogType = meta('property', 'og:type');
  const ogImage = meta('property', 'og:image');
  const ogUrl = meta('property', 'og:url');
  t.event('article-share', `og:type=${ogType}, og:image=${ogImage ? 'yes' : 'no'}, og:url=${ogUrl}`);
  if (ogType !== 'article') t.problem('bug', `Article: og:type is "${ogType}", not article`);
  if (!ogImage || !ogTitle || !ogUrl) t.problem('bug', 'Article: missing share preview tags');
  if (ogTitle !== doc.title.trim()) t.problem('bug', 'Article: og:title does not match the page title');
  const overArt = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth) - doc.documentElement.clientWidth;
  t.metric('overflowArticle390', Math.max(0, overArt));
  if (overArt > 1) t.problem('bug', `Article at ${W}x${H}: sideways scroll by ${overArt}px`);
  t.progress(0.65);

  // Criterion 3: each product page with a release shows its latest.
  const productSlugs = ['ph-origins', 'imagine-live-tv', 'dose-of-destruction', 'i-can-be', 'the-place-department', 'yooba-land', 'sick-of-it', 'hawkes-gen'];
  let withLatest = 0;
  for (const slug of productSlugs) {
    doc = await frameLoad((f) => (f.src = `./product-${slug}.html`));
    if (!doc) { t.problem('bug', `Product ${slug}: page did not open`); continue; }
    await t.until(() => doc.documentElement.dataset.productNewsReady === '1', 12000, `${slug} news`).catch(() => {});
    const block = doc.querySelector('[data-product-news]');
    const card = block?.querySelector('.news-card');
    const shown = block && !block.hidden && !!card;
    if (shown) withLatest += 1;
    t.event('product-latest', `${slug}: ${shown ? `shows ${card.dataset.news} → ${card.getAttribute('href')}` : 'no latest (hidden)'}`);
    if (slug === 'hawkes-gen') {
      if (shown) t.problem('bug', 'Hawkes Gen: should not show a press release (no formulation line)');
    } else if (!shown) {
      // Sick of It may have no live releases yet; only flag when the slot stayed empty after ready.
      if (doc.documentElement.dataset.productNewsReady === '1' && slug !== 'sick-of-it') {
        t.problem('bug', `${slug}: product page has no latest release card`);
      }
    } else if (!card.querySelector('time')?.dateTime || !card.querySelector('h2')) {
      t.problem('bug', `${slug}: latest card lacks date or title`);
    }
    const over = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth) - doc.documentElement.clientWidth;
    if (over > 1) t.problem('bug', `${slug} at ${W}x${H}: sideways scroll by ${over}px`);
  }
  t.metric('productsWithLatest', withLatest);
  t.progress(1);
  closeFrame();
}

installPlaytest({
  product: 'hawkesbiomedical',
  scenarios: [
    { id: 'smoke', title: 'Home link-preview tags and footer, Products through the nav and its link-preview tags, every thumbnail, the Products footer (fiction line, Powered by HAWKES GEN)', seconds: 25, tags: ['smoke'] },
    {
      id: 'products',
      title: 'Products: every thumbnail is a daylight image, hold on PH Origins; the fiction line reads and Powered by HAWKES GEN links to hawkesgen.ai on every page; every page with link-preview tags has them right',
      seconds: 45,
      tags: ['full'],
      description: 'Checks the link-preview (Open Graph, Twitter card) tags on Home and Products, clicks Products in the nav, scrolls each product row and measures its thumbnail, holds on PH Origins, then opens every page from the footer, checks the link-preview tags on Company, Leadership and Contact, measures the footer line contrast and checks the Powered by HAWKES GEN link to https://hawkesgen.ai (404 loaded directly).',
    },
    {
      id: 'story',
      title: 'Narrative home: the hero states the mission in one sentence; four story chapters (problem, mission, work, people) each with a headline and a visual; scroll reveal respects reduced motion',
      seconds: 25,
      tags: ['full'],
      description: 'Reads the hero mission, scrolls to each chapter of the home page and checks its headline, its visual and that it is shown, and checks that the scroll reveal is off (or has a rule) under prefers-reduced-motion.',
    },
    {
      id: 'timeline',
      title: 'Timeline: reached from the header menu and footer; eras in order with year, image and line; every product origin links its product page; no sideways scroll',
      seconds: 90,
      tags: ['full', 'smoke'],
      description: 'Opens Timeline from the nav, scrolls each era, checks year order, images, lines, the eight product origin links and that the page does not scroll sideways. Then at 390x844 and 1440x900: scenes at the top, middle and end, era count, the sticky year changing, horizontal overflow (0), tap targets under 44px (0), a product chip filtering the thread, the ?product= deep link, and a product page On the timeline link landing on the filtered thread.',
    },
    {
      id: 'timelinefilter',
      title: 'Timeline product threads: chips filter one product (others fade), ?product= deep-links, each product page has an On the timeline strip; chips are 44px at 390',
      seconds: 55,
      tags: ['full'],
      description: 'Opens Timeline, taps a product chip and checks the thread stays up while other eras fade, loads timeline.html?product= already filtered, checks every product page strip and that its link opens the filtered thread, and measures chip tap height at 390x844 (with filtered-thread and product-strip scenes at 390x844 and 1440x900).',
    },
    {
      id: 'productpages',
      title: 'Product pages: each of the eight products is a monograph (header band with Rx mark and formulation line; Indications, Dosage, Side effects, Contraindications and How it works blocks with icons) with one diagram that fits the screen; no unsourced figure; same header, footer and styles as Products; Research page with a diagram and sourced figures',
      seconds: 60,
      tags: ['full'],
      description: 'Clicks Products in the nav, then opens each product file from its row, scrolls to the overview, how it works and the diagram, checks the diagram is labelled, that no figure or clinical result is stated, the link-preview tags, the image alt text and that header and footer match Products. Then opens Research from the footer and checks its diagram, indication table and that every figure links its source.',
    },
    {
      id: 'people',
      title: 'Leadership: each person has a portrait and a role; the founding story is at least 150 words',
      seconds: 20,
      tags: ['full'],
    },
    {
      id: 'design',
      title: 'Design system: the same header, footer, type scale and buttons on every page; the style guide lists the tokens; no page overflows at 390px or 1440px',
      seconds: 60,
      tags: ['full'],
      description: 'Opens the style guide and checks every token it lists is defined, then loads every page (including 404) at 1440px and 390px, reports any sideways overflow, and at 1440px compares the header and footer markup and the computed style of nav links, header button, footer links, fiction line, eyebrow, primary button and text link across pages.',
    },
    {
      id: 'motion',
      title: 'Motion tokens: durations and easings on the style guide; cards, buttons and links respond; phone menu slides; focus rings and 44px taps hold',
      seconds: 45,
      tags: ['full'],
      description: 'Opens the style guide, checks --dur-1/2/3 and the two easings, screenshots hover/focus samples and a focused button on desktop, screenshots a pressed card at 390x844, opens and closes the phone menu while it fades and slides, checks focus rings and 44px tap targets, and confirms a prefers-reduced-motion rule.',
    },
    {
      id: 'phone',
      title: 'Phone 390x844: the menu opens and closes by tap and Escape with focus in and back, the eight-product strip has no clipped card, the hero headline and button are on the first screen, every link and button is 44px tall, no sideways scroll',
      seconds: 30,
      tags: ['full'],
      description: 'Opens Home in a 390x844 frame, checks the hero headline and button sit inside the screen, taps the menu toggle open (aria-expanded, focus into the menu), closes it with Escape (focus back on the toggle), opens and taps it closed, scrolls to the product strip and checks eight unclipped cards, measures every link and button height on Home (menu open too) and on every other page (product page, Research, Company, Products, Leadership, Newsroom, Investors, Contact, Compliance, Privacy, Terms, Notices, Style guide, 404), and checks for sideways overflow.',
    },
    {
      id: 'polish',
      title: 'Visual polish: Home headline and button on the first screen at 1280x720 and 390x844; even space under headings; each product domain a link of its own; Leadership and Contact on the shared container; light grey portrait borders',
      seconds: 60,
      tags: ['full'],
      description: "Loads Home in a 1280x720 then a 390x844 frame and checks the eyebrow, headline and button are fully on screen; clicks Products in the nav and checks each row's domain link sits apart from the product-file label; measures the h1 line-height and the 12-16px under each h2 on Privacy, Research and PH Origins; compares the container of Leadership and Contact with Privacy at 1440 and 390px; reads the Leadership portrait border colour.",
    },
    {
      id: 'access',
      title: 'Performance and access on Home: every picture has a WebP (800w on a 390px phone) and a JPEG fallback, width/height, lazy below the fold, no image over 150 KB, no layout shift, every control shows a focus ring; every page keeps alt text and body-copy contrast',
      seconds: 90,
      tags: ['full'],
      description: 'Scrolls Home picture by picture (then again in a 390x844 frame) and logs, for each, the WebP file the browser chose, its JPEG fallback (fetched and decoded), width/height, lazy or eager with fetchpriority, and its weight; flags any image over 150 KB, a phone that does not load the 800w, and layout shift; then moves focus to every link and button and checks that a visible outline appears. Then loads every page at 1440 and 390px: logs each image (file, alt, decorative or not) and fails on missing, empty or filename-like alt on a non-decorative one; measures the body copy colour against its background and fails under 4.5:1 (lowest ratio and selector logged per page); keeps the footer line contrast.',
    },
    {
      id: 'herofield',
      title: 'Home hero field: slow molecular lab visual in brand colours; headline and button above the fold at 1280x720 and 390x844 with 4.5:1 contrast; pauses off-screen and when the tab is hidden; still under reduced motion; fixed 320x200 box (CLS 0)',
      seconds: 40,
      tags: ['full'],
      description: 'Loads Home at 1280x720 and 390x844, screenshots the hero with the field, checks the fixed canvas size, headline and button on the first screen and their contrast over the field, scrolls away and back to confirm pause/resume, and toggles document visibility to confirm the tab-hidden pause.',
    },
    {
      id: 'transitions',
      title: 'View transitions: Home to Products to a product page and back; header and footer keep their place, the product image morphs into the hero, reduced motion gets a plain fade',
      seconds: 30,
      tags: ['full'],
      description: 'Checks the @view-transition rule and its reduced-motion rule, clicks Products in the nav, checks header, footer and content carry view-transition names, opens PH Origins from its card image, checks the card image and the hero share a name, then goes back.',
    },
    {
      id: 'analytics',
      title: 'Hawkes Analytics: page_view on Products, read depth to the footer, an outbound click to PH Origins naming the product, each sent with its env; the footer statistics line keeps the brand',
      seconds: 40,
      tags: ['analytics'],
      description: 'Reads the SDK config on Home (product, env, build), clicks Products in the nav, waits for its page_view to go out, scrolls every product row to the footer (progress 25/50/75/100), checks the footer line (fiction, anonymous statistics, no off-brand words), then clicks the phorigins.com link (the new tab is held back) and waits for the outbound event with ctx.product "PH Origins" to go out.',
    },
    {
      id: 'newsroom',
      title: 'Newsroom: press-release cards for real product releases, newest first with date, product and image, each linking to its article; hand-written statements kept; fresh releases merged on load; dead domains silent',
      seconds: 40,
      tags: ['full'],
      description: 'Opens Newsroom from the nav, waits for the one load-time fetch of the live products\' releases to merge, checks the product press-release cards and the hand-written items are all there, newest first, each card links to an article page, and reads each of the first six (date, product, headline, two sentences, image that loads, no off-brand wording).',
    },
    {
      id: 'articles',
      title: 'Articles: Newsroom cards open dated articles with image and share tags; Home shows the three newest; each product page shows its latest; at 390x844 no sideways scroll and the home hero stays above the fold',
      seconds: 75,
      tags: ['full'],
      description: 'Checks Home latest strip (3 cards), Newsroom cards newest first, opens the first card into an article (title, date, image, og:type article), checks each product page latest release, and at 390x844 confirms the home hero is above the fold with no sideways scroll on Home, the article and product pages.',
    },
    {
      id: 'redaction',
      title: 'Redacted passages: black bars reveal on tap, hover or focus with a glitch and DECLASSIFIED stamp; 8–12 across four pages; stay revealed for the visit; 4.5:1 contrast; nav unblocked at 390 and desktop',
      seconds: 55,
      tags: ['full'],
      description: 'Clears session reveals, screenshots Leadership before and after reveal at 390x844 and 1440x900, checks the stamp and revealed contrast, counts 8–12 bars across Leadership, Newsroom, Research and Investors (none on nav or headings), confirms session persistence, and checks nav stays hittable with no sideways scroll.',
    },
  ],
  isReady: () => document.readyState === 'complete',
  async start(id, options, t) {
    try {
      if (id === 'transitions') await transitions(options, t);
      else if (id === 'motion') await motion(options, t);
      else if (id === 'herofield') await herofield(options, t);
      else if (id === 'access') await access(options, t);
      else if (id === 'analytics') await analytics(options, t);
      else if (id === 'newsroom') await newsroom(options, t);
      else if (id === 'articles') await articles(options, t);
      else if (id === 'redaction') await redaction(options, t);
      else if (id === 'design') await design(options, t);
      else if (id === 'phone') await phone(options, t);
      else if (id === 'polish') await polish(options, t);
      else if (id === 'people') await people(options, t);
      else if (id === 'productpages') await productPages(options, t);
      else if (id === 'timeline') await timeline(options, t);
      else if (id === 'timelinefilter') await timelineFilter(options, t);
      else if (id === 'story') await story(options, t);
      else await products(options, t, id === 'products');
    } finally {
      closeFrame();
    }
  },
  stop() {
    closeFrame();
  },
});
