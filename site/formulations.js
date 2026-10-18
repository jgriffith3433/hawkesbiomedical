// The product line: each product's current formulation (its version), its lot (build) and the date it was last revised, read from the
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
  // A product that hasn't gone live since releases began has no releases.json yet: the fetch 404s (one expected console
  // line) and the row shows "Formulation pending" until its first go live writes the file. No flag to keep up to date.
  fetch(el.dataset.releasesFrom, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const top = data?.releases?.[0];
      if (!top?.version) return pending();
      const link = document.createElement('a');
      link.href = new URL('whatsnew.html', el.dataset.releasesFrom).href;
      link.target = '_blank';
      // The build is the lot: the Unity build number (Game/v<n>) or the short commit of a web product.
      link.textContent = `Formulation ${top.version}${top.build ? ` \u00b7 lot ${top.build}` : ''}${top.date ? ` \u00b7 revised ${date(top.date)}` : ''}`;
      el.replaceChildren(link);
      el.hidden = false;
    })
    .catch(pending);
}
