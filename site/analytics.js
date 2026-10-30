/* Hawkes Analytics on the corporate site (AGENTS.md "Analytics"; the contract is hawkesgen/docs/analytics.md).
   Every page loads Gen's SDK from https://hawkesgen.ai/sdk/analytics@1.js (deferred) and then this file, right
   after it. The SDK sends page views, referrers, UTM tags, the device and the place by itself. This file adds:
   - the build: the site has no build step (Pages serves the repo), so it is the current release in releases.json
     (version, its commit, its date), set on window.HAWKES_BUILD before the first batch goes out;
   - the product on every click to a product site: the SDK's own `outbound` event carries ctx.product ("PH Origins");
   - read depth on the main pages: `progress` (step 25, 50, 75, 100 of 100) as the page is read, with the last heading
     reached (`section`);
   - debug mode in a playtest bot's tab, so the playtest can read what went out (hawkesAnalytics.debugLog).
   No feedback prompt on this site. Nothing here ever throws into the page. */
(function () {
  'use strict';

  // A product site's host (without www.) -> the product's name, as products.html lists it.
  var PRODUCTS = {
    'phorigins.com': 'PH Origins',
    'sickofitgame.com': 'Sick of It',
    'imaginelivetv.com': 'Imagine Live TV',
    'theplacedepartment.com': 'The Place Department',
    'yoobalandgame.com': 'Yooba Land',
    'icanbe.ai': 'I Can Be',
    'doseofdestruction.com': 'Dose Of Destruction',
    'hawkesgen.ai': 'Hawkes Gen',
  };
  // Pages measured for read depth (body data-page).
  var READ_PAGES = { home: 1, company: 1, products: 1, leadership: 1, contact: 1, newsroom: 1, investors: 1, compliance: 1 };
  var MARKS = [25, 50, 75, 100];
  var BUILD_RE = /^[0-9a-f]{4,40}$/i;
  // releases.json sits at the site root, one folder up from this file (404.html is served at any path).
  var RELEASES = new URL('../releases.json', (document.currentScript && document.currentScript.src) || location.href).href;

  var A = function () {
    return window.hawkesAnalytics;
  };
  var safe = function (fn) {
    return function () {
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        /* analytics never breaks the page */
      }
    };
  };

  /* ---------------- debug in a playtest bot's tab (before the deferred SDK runs) ---------------- */
  safe(function () {
    var q = new URLSearchParams(location.search);
    var bot = navigator.webdriver || q.get('playtest') || q.has('hawkesPlaytest') || sessionStorage.getItem('hawkes.playtest');
    var sdk = document.querySelector('script[data-product][src*="analytics"]');
    if (bot && sdk) sdk.setAttribute('data-debug', '1');
  })();

  /* ---------------- the build: the current release ---------------- */
  safe(function () {
    fetch(RELEASES, { cache: 'no-cache' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(
        safe(function (data) {
          var top = data && data.releases && data.releases[0];
          if (!top || !top.version || window.HAWKES_BUILD) return;
          var build = { version: String(top.version) };
          if (BUILD_RE.test(top.build || '')) build.commit = top.build;
          if (top.date) build.date = top.date;
          window.HAWKES_BUILD = build;
        })
      )
      .catch(function () {});
  })();

  /* ---------------- outbound: name the product ---------------- */
  var productOf = function (href) {
    try {
      var u = new URL(href, location.href);
      if (!/^https?:$/.test(u.protocol) || u.host === location.host) return null;
      return PRODUCTS[u.hostname.replace(/^www\./, '')] || null;
    } catch (e) {
      return null;
    }
  };
  // The SDK records `outbound` in its capture listener on document; this one on window runs just before it, so the
  // product rides on that same event (ctx is copied onto each event), and is cleared again right after.
  window.addEventListener(
    'click',
    safe(function (e) {
      var a = A();
      var link = e.target && e.target.closest && e.target.closest('a[href]');
      var product = link && productOf(link.href);
      if (!a || !product) return;
      a.setContext({ product: product });
      setTimeout(
        safe(function () {
          a.setContext({ product: null });
        }),
        0
      );
    }),
    { capture: true }
  );

  /* ---------------- read depth ---------------- */
  function readDepth() {
    var a = A();
    var page = document.body && document.body.dataset.page;
    if (!a || !READ_PAGES[page]) return;
    var sent = 0;
    var heads = [].slice.call(document.querySelectorAll('main h1, main h2'));
    var measure = safe(function () {
      var doc = document.documentElement;
      var total = Math.max(doc.scrollHeight, document.body.scrollHeight);
      var seen = window.scrollY + window.innerHeight;
      var pct = total > 0 ? Math.min(100, (seen / total) * 100) : 100;
      // The page bottom is within a few pixels: that is the whole page.
      if (total - seen < 4) pct = 100;
      var section = '';
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top < window.innerHeight) section = heads[i].textContent.replace(/\s+/g, ' ').trim();
      }
      for (var m = 0; m < MARKS.length; m++) {
        var mark = MARKS[m];
        if (mark <= sent || pct < mark) continue;
        sent = mark;
        a.track('progress', { step: mark, of: 100, label: 'read ' + mark + '%', section: section.slice(0, 80) || undefined });
      }
    });
    var queued = false;
    var onScroll = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        measure();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    if (document.readyState === 'complete') measure();
    else window.addEventListener('load', measure);
  }

  // The SDK is deferred: it has run by DOMContentLoaded.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safe(readDepth));
  else safe(readDepth)();
})();
