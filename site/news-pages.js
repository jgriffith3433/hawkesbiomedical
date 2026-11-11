// Builds one static HTML article per press release (title, date, image, category, og/twitter share tags).
// Used by the Vite writeNews plugin so data/news.json and news-*.html stay in step. Paths stay at the
// site root (./site, ./assets) like every other page.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEAD = `    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./site/brand.css" />
    <!-- Hawkes Analytics: anonymous site statistics (AGENTS.md "Analytics"). site/analytics.js must follow the SDK tag. -->
    <script src="https://hawkesgen.ai/sdk/analytics@1.js" data-product="hawkesbiomedical" defer></script>
    <script src="./site/analytics.js"></script>`;

const NAV = `    <a class="skip" href="#content">Skip to content</a>

    <header class="nav">
      <div class="nav-inner">
        <a class="brand" href="./index.html">
          <img src="./assets/brand/logo.png" alt="Hawkes Biomedical logo" width="320" height="320" />
          <span class="brand-name">Hawkes<span>Biomedical</span></span>
        </a>
        <button class="nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="nav-links">
          Menu
        </button>
        <nav class="nav-links" id="nav-links" aria-label="Primary">
          <a href="./company.html" data-nav="company">Company</a>
          <a href="./products.html" data-nav="products">Products</a>
          <a href="./leadership.html" data-nav="leadership">Leadership</a>
          <a href="./newsroom.html" data-nav="newsroom">Newsroom</a>
          <a href="./timeline.html" data-nav="timeline">Timeline</a>
          <a href="./contact.html" data-nav="contact">Contact</a>
        </nav>
        <div class="nav-tools">
          <a class="nav-cta" href="./investors.html" data-nav="investors">Investors</a>
        </div>
      </div>
    </header>`;

const FOOT = `    <footer>
      <div class="wrap-wide site-footer">
        <div>
          <span class="footer-brand"><img src="./assets/brand/logo.png" alt="Hawkes Biomedical logo" width="320" height="320" />Hawkes Biomedical</span>
          <span>Hawkes Tower, 58th Floor</span>
          <span>Capital desk, Zurich</span>
        </div>
        <nav aria-label="Footer">
          <a href="./index.html">Home</a>
          <a href="./company.html">Company</a>
          <a href="./products.html">Products</a>
          <a href="./research.html">Research</a>
          <a href="./leadership.html">Leadership</a>
          <a href="./newsroom.html">Newsroom</a>
          <a href="./timeline.html">Timeline</a>
          <a href="./investors.html">Investors</a>
          <a href="./contact.html">Contact</a>
          <a href="./whatsnew.html">What&rsquo;s new</a>
          <a href="./compliance.html">Compliance</a>
          <a href="./privacy.html">Privacy</a>
          <a href="./terms.html">Terms</a>
          <a href="./styleguide.html">Style guide</a>
        </nav>
      </div>
      <p class="wrap-wide legal">Hawkes Biomedical is a work of fiction. <span class="stats">We keep anonymous site statistics. No cookies. No personal data.</span> <a class="revision" href="./whatsnew.html" data-hawkes-version data-prefix="Site revision " hidden>Site revision</a> <a class="powered" href="https://hawkesgen.ai">Powered by <strong>HAWKES GEN</strong></a></p>
    </footer>

    <script type="module" src="./site/brand.js"></script>
    <script src="./site/hawkes-release.js" data-releases="./releases.json" defer></script>`;

/** Absolute image URL for share previews from a site-relative ./assets/... path. */
const absImage = (image) => `https://hawkesbiomedical.com/${String(image || '').replace(/^\.\//, '')}`;

/** One article page HTML for a press-release item from data/news.json. */
export function articleHtml(item) {
  const title = `${item.headline} — Hawkes Biomedical`;
  const desc = item.summary;
  const url = `https://hawkesbiomedical.com/news-${item.id}.html`;
  const img = absImage(item.image);
  const cat = item.category || item.product;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f3f0ea" />
    <meta name="description" content="${esc(desc)}" />
    <link rel="icon" href="./favicon.png" type="image/png" />
    <title>${esc(title)}</title>
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Hawkes Biomedical" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(img)}" />
    <meta property="article:section" content="${esc(cat)}" />
    <meta property="article:published_time" content="${esc(item.date)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${esc(img)}" />
${HEAD}
  </head>
  <body data-page="newsroom" data-article="${esc(item.id)}">
${NAV}

    <main id="content">
      <article class="band page-start news-article">
        <div class="wrap">
          <p class="eyebrow"><a href="./newsroom.html">Newsroom</a> / Press release</p>
          <p class="kicker"><time datetime="${esc(item.date)}">${esc(item.date)}</time> &middot; ${esc(cat)}</p>
          <h1 class="page-title">${esc(item.headline)}</h1>
          <figure class="news-article-shot">
            <img src="${esc(item.image)}" alt="${esc(item.product)}: product photograph." width="640" height="640" />
          </figure>
          <div class="news-article-body">
            <p>${esc(item.summary)}</p>
            <p class="fine">Formulation ${esc(item.version)}. Product file: <a href="${esc(item.page)}">${esc(item.product)}</a>.</p>
          </div>
          <p class="actions"><a class="text-link" href="./newsroom.html">All newsroom items</a></p>
        </div>
      </article>
    </main>

${FOOT}
  </body>
</html>
`;
}

/** Filename for an article item (site root). */
export const articleFile = (item) => `news-${item.id}.html`;
