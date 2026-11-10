# Lore candidates for Jaycee to confirm

Hawkes Biomedical is a work of fiction. The Timeline page (`data/timeline.json`, `timeline.html`) uses only eras the site already states: 2009 incorporation, 2011 Voss, 2014 Hale, 2016 Lang and the 2026 figures (company.html, leadership.html, investors.html).

The site does not date when each product joined the line. The page places each product's origin in an era so the history reads in order. Confirm or correct:

| Product | Era placed in | Basis |
|---|---|---|
| PH Origins | 2009 | The first category; the first product named on Products |
| Sick of It | 2011 | Charter era (invented) |
| The Place Department | 2011 | Records storage fits the charter office (invented) |
| Imagine Live TV | 2014 | Hale's reporting quarter (invented) |
| Yooba Land | 2014 | Same year as Imagine Live TV (invented) |
| I Can Be | 2016 | Zurich calendar era (invented) |
| Dose Of Destruction | 2016 | Same era (invented) |
| Hawkes Gen | 2026 | Eighth product, the newest |

The one-line origins in `data/timeline.json` (`products.*.origin`) are also new wording. Nothing states a clinical result or a figure, and nothing goes beyond the fiction notice in the footer.

Each product's "On the timeline" strip (`products.*.moments`) adds two or three beats beyond the single origin era: later company eras the product is treated as still belonging to (Zurich desk, the Hawkes line), and for Hawkes Gen a soft 2009 beat ("the house that would later open laboratory services"). Confirm or cut those middle beats.

## Redacted passages (site UI)

Twelve short passages sit behind `.redacted` bars on Leadership, Newsroom, Research and Investors. They are candidate links between products for Jaycee to confirm or cut; they never name B3, the vat, the creature or gameplay. Revealed text stays for the visit (`sessionStorage['hawkes.redacted']`).

| Id | Page | Revealed text (candidate) |
|---|---|---|
| `pierce-desk` | Leadership · Pierce | the shared formulation desk that later opened Hawkes Gen for the line |
| `hale-quarter` | Leadership · Hale | category share counted after Imagine Live TV trained the prescribing desks |
| `voss-register` | Leadership · Voss | Place Department vaults holding the signed lot pages behind each resolution |
| `lang-calendar` | Leadership · Lang | I Can Be and Dose Of Destruction on the same Zurich release window |
| `pierce-line` | Newsroom · The Hawkes line | eight formulations drawn from the same Hawkes Gen bench |
| `hale-q3` | Newsroom · Q3 | Gen synthesis lots underwriting continuity across all eight |
| `voss-charter` | Newsroom · Charter note | records continuity filed through The Place Department |
| `research-method` | Research · Overview | formulations are synthesised on demand through Hawkes Gen before dating |
| `research-continuity` | Research · Continuity | lot pages stored under The Place Department before Lang dates the release |
| `research-figures` | Research · Figures | Imagine Live TV desks counted in the prescribing base behind the 71% |
| `investors-line` | Investors · The Hawkes line | Sick of It fever kits and Yooba Land appetite support under one distribution charter |
| `investors-desk` | Investors · Capital desk | Lang schedules Gen bench time against each product's revision date |
