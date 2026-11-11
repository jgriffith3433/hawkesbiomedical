// Press releases from product releases. Shared by the build (vite.config.js writes data/news.json) and the Newsroom page
// (site/newsroom.js merges newer releases on load), so both give the same words. In the company's plain regulatory voice:
// every product has its own register (Dose Of Destruction a trial, Imagine Live TV a broadcast); never games, never the
// release's own notes (those are written for players). A release is reported by its formulation (version), lot (build) and date.
const kind = (v) => (/^\d+\.\d+\.0$/.test(v) ? 'minor' : 'patch');
const V = {
  'ph-origins': {
    name: 'PH Origins', domain: 'phorigins.com',
    head: (v) => (kind(v) === 'minor' ? `PH Origins issues buffer formulation ${v}` : `PH Origins adjusts buffer formulation to ${v}`),
    body: (v, lot) => `Hawkes Biomedical has issued formulation ${v} of PH Origins${lot}, its pH balance line. The revision is recorded in the product file and the category position is unchanged.`,
  },
  'sick-of-it': {
    name: 'Sick of It', domain: 'sickofitgame.com',
    head: (v) => `Sick of It single-use fever shot: formulation ${v} released`,
    body: (v, lot) => `Formulation ${v} of the Sick of It single-use fever shot has been released${lot}. Each unit remains a single dose with a single stated indication.`,
  },
  'imagine-live-tv': {
    name: 'Imagine Live TV', domain: 'imaginelivetv.com',
    head: (v) => (kind(v) === 'minor' ? `Imagine Live TV broadcasts formulation ${v}` : `Imagine Live TV corrects its broadcast schedule at ${v}`),
    body: (v, lot) => `Imagine Live TV went to air with formulation ${v}${lot}, its live medical education service. The revised broadcast is available to all current subscribers without interruption.`,
  },
  'the-place-department': {
    name: 'The Place Department', domain: 'theplacedepartment.com',
    head: (v) => `The Place Department files formulation ${v} to the register`,
    body: (v, lot) => `Formulation ${v} of The Place Department has been entered in the register${lot}. Stored documents remain under HIPAA-compliant custody throughout the revision.`,
  },
  'yooba-land': {
    name: 'Yooba Land', domain: 'yoobalandgame.com',
    head: (v) => `Yooba Land support programme updated to ${v}`,
    body: (v, lot) => `The hyporexia support programme Yooba Land has been updated to formulation ${v}${lot}. Participants continue on their current plan and need take no action.`,
  },
  'i-can-be': {
    name: 'I Can Be', domain: 'icanbe.ai',
    head: (v) => `I Can Be assessment protocol revised to ${v}`,
    body: (v, lot) => `Hawkes Biomedical has revised the I Can Be full-body assessment protocol to formulation ${v}${lot}. Existing assessments are not affected and remain on file.`,
  },
  'dose-of-destruction': {
    name: 'Dose Of Destruction', domain: 'doseofdestruction.com',
    head: (v) => (kind(v) === 'minor' ? `Dose Of Destruction opens new formulation trial ${v}` : `Dose Of Destruction trial amended: formulation ${v}`),
    body: (v, lot) => `A new formulation trial of the Dose Of Destruction cytotoxic dose, formulation ${v}${lot}, has been opened under the company's handling procedures. Trial conditions are recorded in the product file.`,
  },
};
export const NEWS_PRODUCTS = Object.entries(V).map(([slug, p]) => ({ slug, ...p, image: `./assets/products/${slug === 'ph-origins' ? 'phorigins' : slug.replace(/-/g, '')}-rx.jpg`, page: `./product-${slug}.html`, releases: `https://${p.domain}/releases.json` }));

/** One press release from one release record, or null when the record has no version or date. */
export function newsItem(product, r) {
  if (!r || !r.version || !/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) return null;
  const v = V[product.slug];
  const lot = r.build ? ` (lot ${r.build})` : '';
  return { id: `${product.slug}-${r.version}`, date: r.date, product: product.name, slug: product.slug, version: r.version, headline: v.head(r.version), summary: v.body(r.version, lot), image: product.image, page: product.page };
}

/** The newest `keep` releases of a releases.json document, as press releases. */
export const newsFrom = (product, data, keep = 3) => (Array.isArray(data?.releases) ? data.releases.slice(0, keep).map((r) => newsItem(product, r)).filter(Boolean) : []);

export const byNewest = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
