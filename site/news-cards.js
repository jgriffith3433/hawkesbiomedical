// Press-release cards as static HTML. The build (vite.config.js, writeNews) writes them into newsroom.html, Home's
// "Latest from the newsroom" and each product page between <!-- news:cards --> markers, so the page paints with its
// cards already in place and nothing below them moves when a script runs (layout shift). The markup is the same the
// scripts build for a release newer than the build (newsroom.js, latest-news.js).

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function cardHtml(item, { summary = false, indent = '            ' } = {}) {
  const href = item.article || `./news-${item.id}.html`;
  return [
    `${indent}<a class="news-card" href="${esc(href)}" data-news="${esc(item.id)}">`,
    `${indent}  <img src="${esc(item.image)}" alt="${esc(item.product)}: product photograph." width="640" height="640" loading="lazy" />`,
    `${indent}  <p class="kicker"><time datetime="${esc(item.date)}">${esc(item.date)}</time> &middot; ${esc(item.category || item.product)}</p>`,
    `${indent}  <h2>${esc(item.headline)}</h2>`,
    ...(summary ? [`${indent}  <p>${esc(item.summary)}</p>`] : []),
    `${indent}</a>`,
  ].join('\n');
}

export const START = '<!-- news:cards -->';
export const END = '<!-- /news:cards -->';

/** Replace what sits between the markers of `html` with `cards` (one string, already indented). Returns null if there are no markers. */
export function fillCards(html, cards) {
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a < 0 || b < a) return null;
  return `${html.slice(0, a + START.length)}\n${cards}\n${html.slice(b)}`;
}
