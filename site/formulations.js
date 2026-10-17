// The product line: each product's current formulation (its version) and the date it was last revised, read from the
// releases.json on the product's own site (written there by Hawkes Studio at each release). The line links to that
// product's What's new page. A product whose site has none yet shows "Formulation pending".
const date = (d) => {
  const t = Date.parse(`${d}T12:00:00Z`);
  return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

for (const el of document.querySelectorAll('[data-releases-from]')) {
  const pending = () => {
    el.textContent = 'Formulation pending';
    el.hidden = false;
  };
  // data-unreleased: the product's site has no releases.json yet (it would 404 and log a console error), so skip the
  // fetch. Remove the attribute from the row once the product has had its first go live.
  if (el.dataset.unreleased !== undefined) {
    pending();
    continue;
  }
  fetch(el.dataset.releasesFrom, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const top = data?.releases?.[0];
      if (!top?.version) return pending();
      const link = document.createElement('a');
      link.href = new URL('whatsnew.html', el.dataset.releasesFrom).href;
      link.target = '_blank';
      link.textContent = `Formulation ${top.version}${top.date ? ` \u00b7 revised ${date(top.date)}` : ''}`;
      el.replaceChildren(link);
      el.hidden = false;
    })
    .catch(pending);
}
