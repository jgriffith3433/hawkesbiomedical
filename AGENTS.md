# Hawkes Biomedical — agent notes

Fictional corporate site for the brand. Static HTML, Vite for preview only. No game, no play link, no Babylon.

## Hard constraints

- **CNAME** is `hawkesbiomedical.com` (repo root and `public/`, so a Vite build keeps it).
- Public cast only: **Pierce Hawkes** (Chairman), **Director Hale**, **Voss**, **Lang**. Do not invent first names.
- Headquarters is **Hawkes Tower, 58th floor**. Capital desk is **Zurich**.
- The public pitch is **category ownership**, not a cure. Pierce sells dominance. Hale watches the quarter. Voss keeps the charter. Lang keeps the date.
- Do not put the basement, B3, the vat, the creature, or gameplay on these pages.
- Products are the public line: **PH Origins** (pH balance, phorigins.com), **Sick of It** (single-use fever shots, sickofitgame.com), **Imagine Live TV** (live medical education, imaginelivetv.com), **The Place Department** (HIPAA-compliant document storage, theplacedepartment.com), **Yooba Land** (hyporexia support, yoobalandgame.com), **I Can Be** (AI-assisted full-body assessment, icanbe.ai), and **Dose Of Destruction** (cytotoxic dose, doseofdestruction.com). The next product is another row on `products.html`. Do not call them games.
- The public site is a light page, spare on purpose. Daylight low-poly photographs. Do not put the night city or a black page background back.
- Footer keeps the line that the company is a work of fiction, followed by the small "Powered by HAWKES GEN" mark linking to https://hawkesgen.com (every page, `.legal .powered`).
- Do not add a form that collects patient information. Contact is `mailto:` only.

## Layout

```
index.html company.html products.html leadership.html contact.html 404.html
site/brand.css site/brand.js
assets/brand/     Tower and board photography
public/           favicon, CNAME, robots (copied into dist/)
CNAME favicon.svg
```

`npm run dev` serves port **5174**. `npm run build` writes `dist/`.

## Playtest

`site/playtest.js` (loaded on `index.html` only) implements the Hawkes playtest contract with
`site/hawkes-playtest.js` (a copy of `hawkesstudio/clients/web/hawkes-playtest.js`). Scenarios: `smoke` and
`products`. A run stays on the home page and opens the other pages in a full-screen frame over it, by clicking the
nav and footer links. It measures each product thumbnail's lightness (warns on a dark one) and the footer fiction
line's contrast on every page (a bug under 4.5:1) and that the "Powered by HAWKES GEN" link is there and goes to https://hawkesgen.com (not clicked: it leaves the site). It also checks the link-preview tags (Open Graph, Twitter card)
on Home, Products, Company, Leadership and Contact against each page's own `<title>` and meta description (`SHARE_URLS` lists the pages that
have them and their `og:url`). Product thumbnails are square crops: draw new ones at 900x900.

When you change the board, the floor, or these constraints, update this file and `README.md`.

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
`whatsnew.html`. A product whose live site has no releases.json yet shows "Formulation pending" (no link). The notes for this site stay in the fictional pharma framing: never games.
