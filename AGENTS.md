# Hawkes Biomedical — agent notes

**Lanes, local dev and deploys:** `LANES.md` (branches dev -> beta -> main; `dev.bat`, `deploy-beta.bat`, `deploy-prod.bat`, `status.bat`, `links.bat`, `sync.bat`; beta and live links).

Fictional corporate site for the brand. Static HTML, Vite for preview only. No game, no play link, no Babylon.

## Hard constraints

- **CNAME** is `hawkesbiomedical.com` (repo root and `public/`, so a Vite build keeps it).
- Public cast only: **Pierce Hawkes** (Chairman), **Director Hale**, **Voss**, **Lang**. Do not invent first names.
- Headquarters is **Hawkes Tower, 58th floor**. Capital desk is **Zurich**.
- The public pitch is **category ownership**, not a cure. Pierce sells dominance. Hale watches the quarter. Voss keeps the charter. Lang keeps the date.
- Do not put the basement, B3, the vat, the creature, or gameplay on these pages.
- Products are the public line: **PH Origins** (pH balance, phorigins.com), **Sick of It** (single-use fever shots, sickofitgame.com), **Imagine Live TV** (live medical education, imaginelivetv.com), **The Place Department** (HIPAA-compliant document storage, theplacedepartment.com), **Yooba Land** (hyporexia support, yoobalandgame.com), **I Can Be** (AI-assisted full-body assessment, icanbe.ai), **Dose Of Destruction** (cytotoxic dose, doseofdestruction.com), and **Hawkes Gen** (laboratory services: on-demand synthesis, hawkesgen.ai; the real generative-AI service, so its card has no release line). The next product is another row on `products.html`. Do not call them games.
- The public site is a light page, spare on purpose. Daylight low-poly photographs, clinical where they show the work: `assets/medical/` (lab hero, the product line, the cleanroom) and the product thumbnails `assets/products/*-rx.jpg` (packaging and equipment, no lettering) were made in Hawkes Gen on 2026-11-01. Do not put the night city or a black page background back.
- Footer keeps the line that the company is a work of fiction, followed by the small "Powered by HAWKES GEN" mark linking to https://hawkesgen.ai (every page, `.legal .powered`).
- Do not add a form that collects patient information. Contact is `mailto:` only.

## Register

Deadpan pharma megacorp, never winking: plain regulatory language (indications and usage, formulation and lot per product).
Home is a story in four chapters (I. problem, II. mission, III. work, IV. people; `.story`, each with a headline and a visual from existing daylight images, fading in on scroll via `[data-reveal]`, off under reduced motion). The hero states the mission in one sentence (`.mission`). Home carries "We do not pitch a cure. We own the category." (`.position`) beside the slogan, then "The Hawkes line" (what the name on the label means: four pillars, one standard, category leadership, continuity, one house) and the eight-product strip (`.line-grid`, linking to each row on Products). Company sets out the Hawkes standard (indication, category, formulation, continuity); Compliance and Investors repeat it in their own voice. Newsroom holds dated statements
(Hale, Voss, Lang, Pierce as Chairman); Investors holds mission, "Our position" and the fictional figures (71% category share,
17 years in market since 2009, 8 products). Tenure on Leadership: Pierce 2009, Hale 2014, Voss 2011, Lang 2016. Header nav:
Company, Products, Leadership, Newsroom, Contact, plus the Investors button; the footer lists every page incl. Compliance,
Privacy, Terms. Logos carry alt text. The fiction line is the first sentence of the footer, small and formal (`.legal`).
New pages are generated from the same head/header/footer: copy one and keep the SDK tag, `site/analytics.js` and the
`SHARE_URLS` entry in `site/playtest.js`.

## Layout

```
index.html company.html products.html research.html leadership.html newsroom.html timeline.html investors.html contact.html
compliance.html privacy.html terms.html whatsnew.html 404.html
styleguide.html (the design tokens, shown; in every footer)
data/timeline.json (eras, product origins and per-product moments)
site/brand.css site/brand.js  (tokens in :root at the top of brand.css: colour, type scale --fs-*, spacing --space-*, --card-pad, --btn-h, motion --dur-1/2/3 and --ease-out/--ease-in-out)
site/analytics.js  Hawkes Analytics additions (after the SDK tag in every page head)
assets/brand/     Tower and board photography
public/           favicon, CNAME, robots (copied into dist/)
CNAME favicon.svg
```

`npm run dev` serves port **5174**. `npm run build` writes `dist/`.

## Newsroom press releases

`site/news-voice.js` holds each product's voice (Dose Of Destruction a trial, Imagine Live TV a broadcast) and turns a release (version, date, lot) into a two-sentence in-world press release, never the player-facing notes. The build (`writeNews` in `vite.config.js`) reads each product's releases.json and writes `data/news.json` (the newest three per product, plus `live`: the domains that answered; offline builds keep the committed file) and one `news-<id>.html` article per item (`site/news-pages.js`: title, date, image, category, og/twitter share tags). `site/newsroom.js` renders them as cards (newest first) that open those articles, above the hand-written statements, then fetches once the `live` products' releases.json and adds any release not yet shown. Only `live` domains are asked at runtime so a dead or 404 domain never logs a console error (m_f502288ff742). Home (`site/latest-news.js`) shows the three newest below the hero; each product page shows that product's latest. Add a product's voice in `news-voice.js`. Scenarios `newsroom` and `articles`.

## Product pages

Each product has `product-<slug>.html` (overview, how it works, one inline SVG diagram `.diagram-svg`, and an "On the timeline" strip of two or three moments linking to `timeline.html?product=<slug>`; classes at the end of `site/brand.css`), linked from its row on `products.html` ("Product file"). They state no figure or clinical result; any claim added later needs a source or a TODO for J. Copy one for the next product. Scenario `productpages`. `timeline.html` chips filter one product's thread (other eras fade; deep-link `?product=<slug>`).

`research.html` (footer link, not in the header nav; `data-page="products"`) shows how a product is made (one `.diagram-svg`), the indication table (`.spec`) and the figures (`.facts[data-sourced]`). Every figure there must carry an `a.source` link to the page that already states it (Investors, Products): never add a figure with no source here. The `productpages` scenario checks it.

## Playtest

`site/playtest.js` (loaded on `index.html` only) implements the Hawkes playtest contract with
`site/hawkes-playtest.js` (a copy of `hawkesstudio/clients/web/hawkes-playtest.js`). Scenarios: `smoke`,
`products`, `story` (the narrative home), `timeline` (eras, origins, rail), `timelinefilter` (product chips filter a thread with others faded, `?product=` deep links, each product page's On the timeline strip, 44px chips at 390), `access` (Home pictures, at the bot's width and again in a 390x844 frame: the WebP chosen (800w on a phone), the JPEG fallback fetched and decoded, width/height matching the image shape, lazy below the fold and eager with fetchpriority high on the hero, under 150 KB, layout shift read with a PerformanceObserver; one `image` event per picture; a visible focus ring on every control), `phone` (390x844: menu by tap and Escape with focus, product strip, hero above the fold, 44px tap targets, no sideways scroll), `polish` (hero eyebrow/headline/button on the first screen at 1280x720 and 390x844, 12-16px under h2.sub, each Products domain a link apart from its label, Leadership and Contact on the Privacy container, light portrait borders), `herofield` (home hero molecular canvas in brand colours: above the fold at 1280x720 and 390x844, 4.5:1 contrast, pauses off-screen and when the tab is hidden, still under reduced motion, fixed 320x200 box), `design` (same header/footer/type/buttons on every page, tokens listed, no overflow at 390 and 1440px), `motion` (motion tokens on the style guide; card/button/link hover focus and press; phone menu slide; focus rings and 44px taps; reduced motion), `redaction` (black-bar lore on Leadership, Newsroom, Research and Investors; reveal with glitch and DECLASSIFIED stamp; session persistence; contrast and nav clear at 390 and 1440), `articles` (Newsroom cards open article pages with title, date, image and share tags; Home shows the three newest; each product page shows its latest; at 390x844 no sideways scroll and the home hero stays above the fold) and `analytics`. The home hero carries a fixed-size canvas field (`.hero-field`, `site/hero-field.js`) beside the headline: slow molecular / cell drift in gold and ink, no GPU art. A run stays on the home page and opens the other pages in a full-screen frame over it, by clicking the
nav and footer links. It measures each product thumbnail's lightness (warns on a dark one) and the footer fiction
line's contrast on every page (a bug under 4.5:1) and that the "Powered by HAWKES GEN" link is there and goes to https://hawkesgen.ai (not clicked: it leaves the site). It also checks the link-preview tags (Open Graph, Twitter card)
on Home, Products, Company, Leadership, Newsroom, Investors, Compliance, Privacy, Terms and Contact against each page's own `<title>` and meta description (`SHARE_URLS` lists the pages that
have them and their `og:url`). Product thumbnails are square crops (640x640 on disk now; images are kept under ~100 KB and every `<img>` has `alt` plus `width`/`height`).
The `analytics` scenario reads what Hawkes Analytics sends (the SDK's `debugLog`): Products' `page_view`, read depth to
the footer, and a real click on phorigins.com (its new tab held back) whose `outbound` event carries ctx.product
"PH Origins", each with the env (`beta` on the Studio beta site, sites.hawkesgen.ai/o/j-studio-4f12/hawkes-biomedical/). It sets `sessionStorage['hawkes.playtest']` so the
pages opened in the frame run the SDK in debug mode too.

When you change the board, the floor, or these constraints, update this file and `README.md`.

## Analytics

Hawkes Analytics is the only analytics here (Hawkes Gen's SDK, contract in `hawkesgen/docs/analytics.md`). Never add
another tracker. Every page's head ends with the SDK tag (`https://hawkesgen.ai/sdk/analytics@1.js`,
`data-product="hawkesbiomedical"`, deferred) followed by `site/analytics.js` (not deferred: it must run before the SDK).
A new page gets both lines.

- **Automatic (the SDK):** page views, sessions, referrers, UTM, device, place, load times, errors, `outbound` clicks.
- **The build:** there is no build step (Pages serves the repo), so `site/analytics.js` sets `window.HAWKES_BUILD`
  from the current release in `releases.json` (version, its `build` commit, its date). Beta reports the last release's
  build; its env (`beta`) tells it apart.
- **Outbound, by product:** a click to a product site (the host map `PRODUCTS` in `site/analytics.js`; add the next
  product there too) puts `ctx.product` (its name as on `products.html`) on the SDK's own `outbound` event.
- **Read depth:** `progress` with `step` 25/50/75/100 (`of` 100) and the last heading reached (`section`) on Home,
  Company, Products, Leadership, Newsroom, Investors, Compliance and Contact.
- **No feedback prompt** (`ask`) on this site.
- **The footer** says, after the fiction line, "We keep anonymous site statistics. No cookies. No personal data."
  (`.legal .stats`). Any privacy wording stays in the company's voice: never games, B3, the vat or the creature.

## Generative AI: Hawkes Gen

Images, textures, video, 3D, music, voice, sound and Claude all go through **Hawkes Gen**
(`C:\Projects\hawkesgen`, dashboard http://127.0.0.1:8790; start it with `hawkesgen\auto-start.bat`). It holds
the API and AWS keys and runs the shared GPU fleet. This project never holds those keys.

- **Agents:** the `hawkesgen` MCP server is in this folder's `.mcp.json`. Use `hawkesgen_presets` (project
  `hawkesbiomedical`) for the art direction, then `hawkesgen_run`.
- **Command line:** `C:\Projects\hawkesgen\hawkesgen.cmd run - --project hawkesbiomedical --preset <name> --param prompt="..." --out <folder>`
- **Art direction:** `hawkesgen/presets/hawkesbiomedical.json` (style line and named presets). Edit it there.
- **Code:** copy `hawkesgen/clients/js/hawkesgen.mjs` into `tools/` and use `new HawkesGen({ project: 'hawkesbiomedical' })`.
- The brand rules above apply to generated images too: daylight low-poly, light page, never B3, the vat, the creature or the night city.
- GPU tools cost money while a server runs. Ask J before starting servers or running big batches.

## Versions and What's new

Every go live is a release, made by Hawkes Studio (`hawkesstudio/src/releases.ts`): a semver version bumped at
go live (minor when players get something new, patch for fixes) plus the build (the commit), shown as
"1.4.0 (build ...)" and tagged `v<version>` in git. Studio adds the release to `releases.json` at the repo root (newest first) with the
player-facing notes J approved in the go-live plan. `whatsnew.html` ("Notices") and the footer's "Site revision" read it through `hawkes-release.js` (a copy of
`hawkesstudio/clients/web/hawkes-release.js`: `[data-hawkes-version]`, `[data-hawkes-releases]`). Don't bump versions
by hand; a typo in old notes can be fixed in the file on beta.

`products.html` shows each product's current version as its "Formulation x.y.z · revised <date>" (`site/formulations.js`
reads `https://<product domain>/releases.json`; GitHub Pages allows the cross-site read). The line links to that product's
`whatsnew.html`. A product whose live site has no releases.json yet shows "Formulation pending" (no link). Every row fetches; nothing to update by hand. Until a product's first go live writes its releases.json (The Place Department and Yooba Land today), that fetch 404s in the console: expected, not a bug. The notes for this site stay in the fictional pharma framing: never games.

## Design system

One set of tokens in `:root` at the top of `site/brand.css`, listed on `styleguide.html`. Use a `var(--fs-*)`, `var(--space-*)`, `var(--card-pad)`, colour or motion token (`--dur-*`, `--ease-*`, `--shadow-lift` / `--shadow-press`) in a rule, never a new literal size; add a token (and its row on the style guide) if a new value is truly needed. Header and footer markup is identical on every page (the only per-page difference is `aria-current`, set by `brand.js`); a new page copies them and gets the `styleguide.html` footer link. Buttons: `.btn`, `.btn.btn-outline`, `.text-link`, and the header's `.nav-cta`. Cards: `.desk`, `.beat`, `.board-card`, `.address`, `.office` share `--card-pad` and the lift/press motion. Micro-interactions use the motion tokens and drop out under `prefers-reduced-motion`. Inline lore bars: `<span class="redacted" data-redact="id">…</span>` (wired in `brand.js`; `--redact-bar` / `--redact-stamp`; never on nav or headings; candidate wording in `docs/lore-candidates.md`; scenario `redaction`).
