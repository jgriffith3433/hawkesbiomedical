# Hawkes Biomedical — agent notes

Fictional corporate site for the brand. Static HTML, Vite for preview only. No game, no play link, no Babylon.

## Hard constraints

- **CNAME** is `hawkesbiomedical.com` (repo root and `public/`, so a Vite build keeps it).
- Public cast only: **Pierce Hawkes** (Chairman), **Director Hale**, **Voss**, **Lang**. Do not invent first names.
- Headquarters is **Hawkes Tower, 58th floor**. Capital desk is **Zurich**.
- The public pitch is **category ownership**, not a cure. Pierce sells dominance. Hale watches the quarter. Voss keeps the charter. Lang keeps the date.
- Do not put the basement, B3, the vat, the creature, or gameplay on these pages.
- Footer keeps the line that the company is a work of fiction.
- Do not add a form that collects patient information. Contact is `mailto:` only.

## Layout

```
index.html company.html leadership.html category.html contact.html 404.html
site/brand.css site/brand.js
assets/brand/     Tower and board photography
public/           favicon, CNAME, robots (copied into dist/)
CNAME favicon.svg
```

`npm run dev` serves port **5174**. `npm run build` writes `dist/`.

When you change the board, the floor, or these constraints, update this file and `README.md`.
