# Wunderpus

Free, game-ready D&D 5e assets: an improved character sheet and a spell card generator.

## What’s here

- **Character sheet** – Fillable PDF character sheet (A4 & Letter) with extra trackers and layout improvements for 2014 and 2024 rules.
- **Spell cards** – Web app to search and filter spells, add cards (including custom/empty), edit content, and print or save as PDF.

## Run locally

Use a static file server so the spell card app can load `data/spells.json` and modules correctly (opening HTML as files can hit CORS).

1. **Install dependencies** (only needed for the dev server)
   ```bash
   npm install
   ```

2. **Optional: update data & icons (one-time or when sources/icons change)**

   Run from the project root:

   - **Download/refresh raw spell JSON files**
     ```bash
     ./scripts/download-spell-data.sh
     ```
   - **Preprocess spell data into `data/spells.json`**
     ```bash
     node scripts/preprocess-spells.js
     ```
   - **(Optional) Rebuild icon manifest from code usage**
     ```bash
     node scripts/build-icon-manifest.js
     ```
   - **Generate colored icons into `assets/generated/`**
     ```bash
     node scripts/generate-icons.js
     ```

3. **Start the server**
   ```bash
   npm start
   ```
   Serves the site at **http://localhost:3000**.

- **http://localhost:3000** → redirects to character sheet  
- **http://localhost:3000/character-sheet.html** → character sheet  
- **http://localhost:3000/spell-cards.html** → spell card generator  

## Deploy

The site is static (HTML, CSS, JS, `assets/`, `data/`, `sheets/`). Deploy the project root to any static host (e.g. GitHub Pages, Netlify, Vercel). No Node server or build step required.

### Page branch & GitHub Pages deployment

This repo also supports a **“page” branch** used for publishing to a separate GitHub Pages repository:

- `main` – full source tree (scripts, raw spell data, app code, assets, sheets).
- `page` – mirrors `main` **except** it excludes:
  - development scripts in `scripts/`
  - raw spell data in `data/` (only the bundled `data/spells.json` needed at runtime is kept)

The `page` branch is pushed to a **second remote** that hosts the public site, e.g.:

- `origin` → main development repo (`spell-cards.git`)
- `pages` → GitHub Pages repo (e.g. `wunderpus-eu.git`), where `page` is pushed as the `main` / `gh-pages` branch

A typical workflow:

1. Work and merge into `main` on `origin`.
2. Checkout/update `page` from `main`.
3. Ensure `scripts/` and raw `data/*.json` (other than `data/spells.json`) are removed on `page`.
4. Push `page` to the Pages remote:
   ```bash
   git push pages page:main   # or page:gh-pages, depending on that repo’s default
   ```

## Spell card app (quick reference)

- Search and filter by class, level, source, school, components, casting time.
- Add spells via the dropdown; add all matching filters, or add an empty card for a custom spell.
- Edit any card in the overlay (form + live preview); supports markdown in text fields.
- Card actions: delete, duplicate, edit.
- A4 / Letter; optional glossary card; color or grayscale; print or “Save as PDF” in the browser.

## Project layout

- `index.html` – Redirects to character sheet.
- `character-sheet.html` – Character sheet page.
- `spell-cards.html` – Spell card generator (main app entry).
- `css/` – Site layout and nav/footer (`style.css`), character sheet page (`character-sheet.css`), spell card editor (`card-editor.css`), spell card layout (`card.css`) and print (`card-print.css`).
- `js/` – Spell card app: card rendering and data (`card.js`), card editor UI (`card-editor.js`), layout (`card-layout.js`), spell model (`spell.js`); nav bar (`nav.js`). `preprocess-spells.js` uses `js/spell.js`.
- `assets/` – Icons, wordmark, favicon.
- `data/` – Spell data; `sources.json` and `spells*.json`; `spells.json` is the bundled list used by the app.
- `sheets/` – Character sheet PDFs and images.

## Development scripts

Several helper scripts keep generated assets and spell data up to date. Run them from the project root.

### Full asset & data workflow

When you need to fully refresh icons and spell data:

1. **(Optional) Download/refresh raw spell JSON files**

   ```bash
   ./scripts/download-spell-data.sh
   ```

2. **Preprocess spell data into a single bundle**

   ```bash
   node scripts/preprocess-spells.js
   ```

   This regenerates `data/spells.json` from the raw `data/spells-*.json` files.

3. **(Optional) Rebuild the icon manifest from usage in code**

   ```bash
   node scripts/build-icon-manifest.js
   ```

4. **Generate all colored icons**

   ```bash
   node scripts/generate-icons.js
   ```

---

### Icon generation

All icons used on spell cards and in the card editor come from **pre-generated SVGs** in `assets/generated/`. There is **no runtime fallback**: if a file is missing, `load_icon()` will throw a “Missing icon” error so you can update the manifest and regenerate.

Icons are generated via:

```bash
node scripts/build-icon-manifest.js   # optional: rebuild full manifest from usage
node scripts/generate-icons.js
```

- `scripts/build-icon-manifest.js`  
  Scans the code for `load_icon()` usages and writes `scripts/icon-manifest.json` with every `(icon, fg, bg)` combination used by spell cards (border, range, area, duration, components, class row, inline/glossary) and the class filter chips.  
  Run this when you add new icons or colors in the JS/HTML.

- `scripts/generate-icons.js`  
  Reads `scripts/icon-manifest.json`, loads each `assets/{icon}.svg`, replaces `#333333` / `#ffffff` with the manifest’s fg/bg colors, and writes:

  - `assets/generated/{icon}_{fg}_{bg}.svg`

  Colors in the manifest are:

  - 6‑char hex strings **without** `#` (e.g. `"333333"`, `"ffffff"`)
  - or `"transparent"` for cases like filter chips

  Filenames use the same format, e.g. `icon-acid_333333_ffffff.svg`.

#### Adding new icons or colors

1. Add a `(icon, fg, bg)` entry to `scripts/icon-manifest.json`  
   – or run `node scripts/build-icon-manifest.js` if you’ve only added new `load_icon()` usages in code.

2. Regenerate icons:

   ```bash
   node scripts/generate-icons.js
   ```

If you see a “Missing icon” error in the app, the message tells you which `(icon, fg, bg)` combo is missing and reminds you to update the manifest and run the generator.

---

### Spell data preprocessing

Raw spell data lives in multiple JSON files under `data/` (e.g. `spells-phb.json`, `spells-xphb.json`, etc.). The app consumes a single bundled file:

- `data/spells.json` – combined, preprocessed spell list used by the spell card generator.

To regenerate it:

```bash
./scripts/download-spell-data.sh        # optional: refresh raw JSON files
node scripts/preprocess-spells.js
```

The preprocessing script:

- Normalizes and merges spell entries from the various `data/spells-*.json` files.
- Applies rules for 2014/2024 sources, SRD names, upcast/higher-level text, targeting metadata, etc.
- Writes the final `data/spells.json` consumed by `js/card.js` / `js/card-editor.js`.
