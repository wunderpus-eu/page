# Icon generation

All icons used on spell cards and in the card editor come from pre-generated SVGs in `assets/generated/`. There is no runtime fallback: if a file is missing, `load_icon()` throws so you can update the manifest and regenerate.

## Generate icons

From the project root (e.g. in WSL if Node is there):

```bash
node scripts/build-icon-manifest.js   # optional: rebuild full manifest from usage
node scripts/generate-icons.js
```

- **build-icon-manifest.js** — Writes `scripts/icon-manifest.json` with every `(icon, fg, bg)` used by spell cards (border, range, area, duration, components, class row, inline/glossary) and the class filter chips. Run when you add new `load_icon()` usages or colors.
- **generate-icons.js** — Reads the manifest, loads each `assets/{icon}.svg`, replaces `#333333` / `#ffffff` with fg/bg, and writes `assets/generated/{icon}_{fg}_{bg}.svg`. Colors in the manifest are 6-char hex (no `#`) or `"transparent"` for filter chips; filenames use the same (e.g. `icon-acid_333333_ffffff.svg`).

## Adding new icons or colors

1. Add the `(icon, fg, bg)` entry to `scripts/icon-manifest.json` (or run `build-icon-manifest.js` if you’ve only added usages in code).
2. Run `node scripts/generate-icons.js`.

If you see a “Missing icon” error in the app, the message tells you which combo to add and to run the generator.
