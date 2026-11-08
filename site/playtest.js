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
  Investors: 'https://hawkesbiomedical.com/investors.html',
  Compliance: 'https://hawkesbiomedical.com/compliance.html',
  Privacy: 'https://hawkesbiomedical.com/privacy.html',
  Terms: 'https://hawkesbiomedical.com/terms.html',
  'Style guide': 'https://hawkesbiomedical.com/styleguide.html',
  Research: 'https://hawkesbiomedical.com/research.html',
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
  // Responsive images: a WebP variant is chosen from the srcset (a phone gets the 800w), every one keeps a JPEG fallback and lazy below the fold.
  const pics = [...document.querySelectorAll('picture')];
  for (const pic of pics) {
    const img = pic.querySelector('img');
    const name = fileOf(img.src);
    const src = pic.querySelector('source[type="image/webp"]');
    if (!src || !/\.jpg$/i.test(img.getAttribute('src') || '')) t.problem('bug', `Home: ${name} has no WebP source with a JPEG fallback`);
    const cur = img.currentSrc || img.src;
    const below = img.getBoundingClientRect().top > innerHeight;
    if (!/\.webp/.test(cur)) t.problem('bug', `Home: ${name} loaded ${fileOf(cur)}, not a WebP`);
    else if (innerWidth <= 700 && !/-800\.webp/.test(cur)) t.problem('bug', `Home: ${name} loaded ${fileOf(cur)} on a ${innerWidth}px screen, wanted the 800w`);
    if (below && img.getAttribute('loading') !== 'lazy') t.problem('bug', `Home: ${name} is below the fold and not lazy`);
  }
  t.event('picture', `${pics.length} pictures: ${pics.map((p) => fileOf((p.querySelector('img').currentSrc || ''))).join(', ')} at ${innerWidth}px`);
  t.metric('images', imgs.length);
  t.event('alt', `${imgs.length} images, ${imgs.filter((i) => i.getAttribute('alt')?.trim()).length} with alt text`);
  const heavy = performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'img' && r.encodedBodySize > 150 * 1024);
  for (const r of heavy) t.problem('bug', `Home: image ${fileOf(r.name)} is ${Math.round(r.encodedBodySize / 1024)} KB`);
  let cls = 0;
  try {
    for (const e of performance.getEntriesByType('layout-shift')) if (!e.hadRecentInput) cls += e.value;
  } catch {}
  t.metric('layoutShift', fixed2(cls));
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
  t.progress(1);
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

/** The shared design system: every page has the same header, footer, type scale and button styles; the style guide lists the tokens; no page overflows at 390px or 1440px. */
const DESIGN_PAGES = [
  ['Home', './index.html'], ['PH Origins', './product-ph-origins.html'], ['Research', './research.html'], ['Company', './company.html'], ['Products', './products.html'], ['Leadership', './leadership.html'],
  ['Newsroom', './newsroom.html'], ['Investors', './investors.html'], ['Contact', './contact.html'], ['Compliance', './compliance.html'],
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
  for (const sec of ['colour', 'type', 'spacing', 'buttons', 'cards']) if (!doc.getElementById(sec)) t.problem('bug', `Style guide: no "${sec}" section`);
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
    checkStructure(t, doc, '404');
    for (const k of ['og:title', 'og:description']) if (!doc.head.querySelector(`meta[property="${k}"]`)?.content) t.problem('bug', `404: no ${k} tag`);
    for (const k of ['twitter:title', 'twitter:description']) if (!doc.head.querySelector(`meta[name="${k}"]`)?.content) t.problem('bug', `404: no ${k} tag`);
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

  // Menu: tap to open (focus goes in), Escape to close (focus returns), tap again, tap to close.
  t.scene('Menu');
  const toggle = doc.getElementById('navToggle');
  const links = doc.getElementById('nav-links');
  const expanded = () => toggle.getAttribute('aria-expanded');
  const key = (k) => doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
  if (win.getComputedStyle(toggle).display === 'none') t.problem('bug', `The menu toggle is not shown at ${W}px`);
  const open = async (how) => {
    toggle.click();
    await t.wait(150);
    const visible = links.getClientRects().length > 0;
    const inside = links.contains(doc.activeElement);
    t.event('menu-open', `${how}: aria-expanded ${expanded()}, visible ${visible}, focus in menu ${inside}`);
    if (expanded() !== 'true' || !visible) t.problem('bug', 'Menu: a tap on the toggle does not open it');
    if (!inside) t.problem('bug', 'Menu: focus does not move into the menu on open');
  };
  const closed = (how) => {
    const visible = links.getClientRects().length > 0;
    const back = doc.activeElement === toggle;
    t.event('menu-close', `${how}: aria-expanded ${expanded()}, visible ${visible}, focus on toggle ${back}`);
    if (expanded() !== 'false' || visible) t.problem('bug', `Menu: ${how} does not close it`);
    if (!back) t.problem('bug', `Menu: focus does not return to the toggle after ${how}`);
  };
  await open('tap');
  key('Escape');
  await t.wait(150);
  closed('Escape');
  await open('tap again');
  toggle.click();
  await t.wait(150);
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
  t.add('stripChecked');

  // Tap targets, on Home and the pages a visitor reaches next.
  const small = (d, name) => {
    const bad = [];
    for (const el of d.querySelectorAll('a[href], button')) {
      if (el.classList.contains('skip')) continue;
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
  await t.wait(150);
  small(doc, 'Home with the menu open');
  toggle.click();
  for (const [name, href] of [['Products', './products.html'], ['Company', './company.html'], ['Contact', './contact.html'], ['Investors', './investors.html']]) {
    doc = await frameLoad((fr) => (fr.src = href));
    if (!doc) { t.problem('bug', `${name}: didn't open`); continue; }
    await t.wait(400);
    small(doc, name);
    const d = doc.documentElement;
    const over = Math.max(d.scrollWidth, doc.body.scrollWidth) - d.clientWidth;
    if (over > 1) t.problem('bug', `${name} at ${W}px: the page scrolls sideways by ${over}px`);
    t.add('pagesMeasured');
  }
  doc = await frameLoad((fr) => (fr.src = './index.html'));
  if (doc) {
    await t.wait(300);
    const d = doc.documentElement;
    const over = Math.max(d.scrollWidth, doc.body.scrollWidth) - d.clientWidth;
    t.event('overflow', `Home at ${W}px: scrollWidth ${d.scrollWidth}, width ${d.clientWidth}`);
    if (over > 1) t.problem('bug', `Home at ${W}px: the page scrolls sideways by ${over}px`);
  }
  closeFrame();
  t.progress(1);
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
      id: 'productpages',
      title: 'Product pages: each of the eight products has an overview, a how-it-works section and one diagram; no unsourced figure; same header, footer and styles as Products; Research page with a diagram and sourced figures',
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
      id: 'phone',
      title: 'Phone 390x844: the menu opens and closes by tap and Escape with focus in and back, the eight-product strip has no clipped card, the hero headline and button are on the first screen, every link and button is 44px tall, no sideways scroll',
      seconds: 30,
      tags: ['full'],
      description: 'Opens Home in a 390x844 frame, checks the hero headline and button sit inside the screen, taps the menu toggle open (aria-expanded, focus into the menu), closes it with Escape (focus back on the toggle), opens and taps it closed, scrolls to the product strip and checks eight unclipped cards, measures every link and button height on Home (menu open too), Products, Company, Contact and Investors, and checks for sideways overflow.',
    },
    {
      id: 'access',
      title: 'Performance and access on Home: every image has alt text and a size, no image over 150 KB, no layout shift, every control shows a focus ring',
      seconds: 15,
      tags: ['full'],
      description: 'Checks each image on Home for alt text and width/height, flags heavy images and layout shift, then moves focus to every link and button and checks that a visible outline appears.',
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
      if (id === 'access') await access(options, t);
      else if (id === 'analytics') await analytics(options, t);
      else if (id === 'design') await design(options, t);
      else if (id === 'phone') await phone(options, t);
      else if (id === 'people') await people(options, t);
      else if (id === 'productpages') await productPages(options, t);
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
