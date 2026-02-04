# Spell Card Generator

A lightweight, serverless web app for generating D&D spell cards. Search and filter spells, add cards (including duplicates and custom spells), edit card content, and print or save as PDF using the browser’s print dialog.

## Features

- Search and filter spells by class, level, source, school, components, and casting time
- Add spells with a fuzzy-search dropdown (click to add; same spell can be added multiple times)
- Add all spells matching current filters, or add an empty card for a fully custom spell
- Edit any card in an overlay (form + live preview); supports markdown in text fields
- Card actions: delete, duplicate, edit
- A4 / Letter page size; optional glossary card; color or grayscale
- Print or “Save as PDF” via the browser (no server-side PDF generation)

## How to Use

### Running locally

You need a static file server so that `data/spells.json` and assets load correctly (opening `index.html` as a file can hit CORS with `fetch`).

1. **Optional: download/update spell data**
   ```bash
   ./download-spell-data.sh
   ```

2. **Start a local server**
   ```bash
   npm start
   ```
   This runs `npx serve . -p 3000`. You can use any static server (e.g. `python -m http.server 3000`).

3. **Open the app**
   Go to `http://localhost:3000`.

### Deploying (serverless)

The app is static: HTML, CSS, JS, and `data/`. Deploy the project directory to any static host (e.g. GitHub Pages, Netlify, Vercel, S3 + CloudFront). No Node server or build step required.

### Generating cards and PDF

1. Use “Add spell” (with search/filters) or “Add all matching” / “Empty card” to build your set.
2. Use delete/duplicate/edit on each card as needed.
3. Choose page size and options (glossary, grayscale).
4. Click **Print / Save as PDF** and in the dialog choose “Save as PDF” (or a printer) to get your layout with cut marks.
