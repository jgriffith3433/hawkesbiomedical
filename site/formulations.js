// The product line: each product's current formulation (its version) and the date it was last revised, read from the
// releases.json on the product's own site (written there by Hawkes Studio at each release). A product whose site has
// none yet shows nothing.
const date = (d) => {
  const t = Date.parse(`${d}T12:00:00Z`);
  return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

for (const el of document.querySelectorAll('[data-releases-from]')) {
  fetch(el.dataset.releasesFrom, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const top = data?.releases?.[0];
      if (!top?.version) return;
      el.textContent = `Formulation ${top.version}${top.date ? ` \u00b7 revised ${date(top.date)}` : ''}`;
      el.hidden = false;
    })
    .catch(() => {});
}
