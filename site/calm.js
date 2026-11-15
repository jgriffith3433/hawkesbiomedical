// Reduced motion, in one place. The site honours the visitor's prefers-reduced-motion setting (CSS media rules, brand.js,
// hero-field.js). A playtest page cannot switch that browser setting from inside, so the motion scenario sets
// sessionStorage['hawkes.calm'] = '1' for its second pass: this module then applies the very same reduced-motion rules
// (the stylesheet's own prefers-reduced-motion blocks are turned on, the no-preference ones off) and every script asks
// calmMotion() instead of matchMedia. Nobody sets the key but the playtest; a real visitor never sees a difference.

export const emulated = () => {
  try {
    return sessionStorage.getItem('hawkes.calm') === '1';
  } catch {
    return false;
  }
};

export const calmMotion = () => emulated() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function flip(rules) {
  for (const rule of rules) {
    if (rule.media && /prefers-reduced-motion/.test(rule.media.mediaText)) {
      const want = /prefers-reduced-motion:\s*reduce/.test(rule.media.mediaText) ? 'all' : 'not all';
      if (rule.media.mediaText !== want) rule.media.mediaText = want;
    } else if (rule.cssRules) {
      flip(rule.cssRules);
    }
  }
}

/** Playtest only: make the page's reduced-motion rules apply as if the browser setting were on. */
export function emulateCalm() {
  if (!emulated()) return;
  document.documentElement.dataset.calm = '1';
  for (const sheet of document.styleSheets) {
    try {
      flip(sheet.cssRules);
    } catch {
      /* a cross-origin sheet (web fonts): nothing of ours in it */
    }
  }
}

emulateCalm();
window.addEventListener('load', emulateCalm);
