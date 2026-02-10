# Wunderpus

Free, game-ready D&D 5e assets: an improved character sheet and a spell card generator.

## What’s here

- **Character sheet** – Fillable PDF character sheet (A4 & Letter) with extra trackers and layout improvements for 2014 and 2024 rules.
- **Spell cards** – Web app to search and filter spells, add cards (including custom/empty), edit content, and print or save as PDF.

## Run locally

Use a static file server so the spell card app can load `data/spells.json` and modules correctly (opening HTML as files can hit CORS).

1. **Install dependencies** (only needed if you use the included dev server)
   ```bash
   npm install
   ```

2. **Start the server**
   ```bash
   npm start
   ```
   Serves the site at **http://localhost:3000**.

- **http://localhost:3000** → redirects to character sheet  
- **http://localhost:3000/character-sheet.html** → character sheet  
- **http://localhost:3000/spell-cards.html** → spell card generator  

## Deploy

The site is static (HTML, CSS, JS, `assets/`, `data/`, `sheets/`). Deploy the project root to any static host (e.g. GitHub Pages, Netlify, Vercel). No Node server or build step required.

### Source vs published branch

This branch is intended to be the **published static site**. It does not include the development scripts or raw source data used to rebuild spell bundles and generated icons.

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
