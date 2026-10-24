# Hawkes Biomedical

Public site for **Hawkes Biomedical**, the company on the 58th floor of Hawkes Tower. Chairman **Pierce Hawkes**. The board on this site is **Director Hale**, **Voss**, and **Lang**.

This is a corporate brand site. It does not include the game.

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5174/](http://127.0.0.1:5174/).

```bash
npm run build      # static site in dist/
npm run preview    # serve the build on port 4174
```

`CNAME` is `hawkesbiomedical.com`.

## Pages

| Path | What |
|---|---|
| `index.html` | Home |
| `company.html` | The company |
| `products.html` | PH Origins, Sick of It, Imagine Live TV, The Place Department, Yooba Land, I Can Be, Dose Of Destruction, Hawkes Gen |
| `leadership.html` | Pierce Hawkes, Hale, Voss, Lang |
| `newsroom.html` | Dated statements: Hale, Lang, Voss, the Chairman |
| `investors.html` | Mission, our position, selected figures, Zurich capital desk |
| `compliance.html` | Compliance statement |
| `privacy.html`, `terms.html` | Short legal pages |
| `whatsnew.html` | Release log |
| `contact.html` | Tower office and the Zurich desk |

Shared styles and nav live in `site/brand.css` and `site/brand.js`. Photography is in `assets/brand/`.

Every page loads Hawkes Analytics (Hawkes Gen's SDK, product `hawkesbiomedical`) and `site/analytics.js`: anonymous site statistics, no cookies, no personal data, as the footer says. See `AGENTS.md` "Analytics".

Do not invent first names for Hale, Voss, or Lang. Do not put the basement, the vat, or the rest of the plot on these pages. The public line is category ownership, not a cure. Products are PH Origins, Sick of It, Imagine Live TV, The Place Department, Yooba Land, I Can Be, Dose Of Destruction, and Hawkes Gen (laboratory services), written as the line, with links out to their sites.
