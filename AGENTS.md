# Hawkes Biomedical — agent notes

Fictional corporate site for the brand. Static HTML, Vite for preview only. No game, no play link, no Babylon.

## Hard constraints

- **CNAME** is `hawkesbiomedical.com` (repo root and `public/`, so a Vite build keeps it).
- Public cast only: **Pierce Hawkes** (Chairman), **Director Hale**, **Voss**, **Lang**. Do not invent first names.
- Headquarters is **Hawkes Tower, 58th floor**. Capital desk is **Zurich**.
- The public pitch is **category ownership**, not a cure. Pierce sells dominance. Hale watches the quarter. Voss keeps the charter. Lang keeps the date.
- Do not put the basement, B3, the vat, the creature, or gameplay on these pages.
- Products are the public line: **PH Origins** (pH balance, phorigins.com), **Sick of It** (single-use fever shots, sickofitgame.com), **Imagine Live TV** (live medical education, imaginelivetv.com), **The Place Department** (HIPAA-compliant document storage, theplacedepartment.com), **Yooba Land** (hyporexia support, yoobalandgame.com), and **I Can Be** (AI-assisted full-body assessment, icanbe.ai). The next product is another row on `products.html`. Do not call them games.
- The public site is a light page, spare on purpose. Daylight low-poly photographs. Do not put the night city or a black page background back.
- Footer keeps the line that the company is a work of fiction.
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

When you change the board, the floor, or these constraints, update this file and `README.md`.
