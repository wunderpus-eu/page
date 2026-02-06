#!/usr/bin/env node
/**
 * Pre-generates colored SVG icons from assets/*.svg into assets/generated/.
 * Reads scripts/icon-manifest.json for (icon, fg, bg) list. Base SVGs use
 * #333333 and #ffffff; we replace them with the manifest colors.
 * Re-run when you add a new icon or color combination (e.g. new load_icon usage).
 *
 * Usage: node scripts/generate-icons.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "assets");
const GENERATED = path.join(ASSETS, "generated");
const MANIFEST_PATH = path.join(__dirname, "icon-manifest.json");

function normalizeColor(c) {
    const s = String(c).trim().replace(/^#/, "").toLowerCase();
    return s || "transparent";
}

/** Value to use inside the SVG for #333333 / #ffffff replacement (hex). */
function replaceValue(c) {
    if (c === "transparent" || !c) return "transparent";
    const s = String(c).trim().toLowerCase();
    if (s === "white" || s === "ffffff") return "#ffffff";
    return s.startsWith("#") ? s : "#" + s.replace(/^#/, "");
}

function slug(icon, fg, bg) {
    return `${icon}_${normalizeColor(fg)}_${normalizeColor(bg)}.svg`;
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const list = manifest.icons || [];

ensureDir(GENERATED);

let done = 0;
let failed = 0;

for (const { icon, fg, bg } of list) {
    const inPath = path.join(ASSETS, `${icon}.svg`);
    const fgVal = replaceValue(fg);
    const bgVal = replaceValue(bg);

    if (!fs.existsSync(inPath)) {
        console.warn(`Skip ${icon}: base file not found at ${inPath}`);
        failed++;
        continue;
    }

    let svg = fs.readFileSync(inPath, "utf8");
    svg = svg.replace(/#333333/g, fgVal);
    svg = svg.replace(/#ffffff/g, bgVal);

    const outName = slug(icon, fg, bg);
    const outPath = path.join(GENERATED, outName);
    fs.writeFileSync(outPath, svg, "utf8");
    done++;
}

console.log(`Generated ${done} icons in assets/generated/${failed ? ` (${failed} skipped)` : ""}`);
