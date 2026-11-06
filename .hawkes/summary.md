Beta's failed build was not a code failure: the run stopped because the studio was out of credits (playtest.run needed 9, 1 left). I ran `npm ci && npm run build` on this branch (which starts from beta) and it builds cleanly. All 8 product pages are present with overview, how it works and one diagram. Pages carry no figures or clinical claims, so there are no TODOs to flag. The `productpages` scenario (already in site/playtest.js) checks the criteria; named in .hawkes/scenario.txt.
Nothing changed in code. Re-run beta's playtest once credits are added.
GPU: none needed, no estimate.
