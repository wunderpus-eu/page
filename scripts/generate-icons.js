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

/** Remove existing generated icons and recreate folder so we regenerate from scratch. */
function clearGeneratedDir() {
    if (fs.existsSync(GENERATED)) {
        fs.rmSync(GENERATED, { recursive: true });
    }
    ensureDir(GENERATED);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const list = manifest.icons || [];

clearGeneratedDir();

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
    const hasBackground = svg.includes("#ffffff");
    const hasForeground = svg.includes("#333333");

    // Use a placeholder so we don't double-replace when fg or bg equals #333333 or #ffffff.
    // E.g. "white on green": replace #333333→white first would create more #ffffff, then #ffffff→green would turn everything green.
    const PLACEHOLDER_FG = "__ICON_FG_PLACEHOLDER__";
    if (hasForeground) {
        svg = svg.replace(/#333333/g, PLACEHOLDER_FG);
    }
    if (hasBackground) {
        svg = svg.replace(/#ffffff/g, bgVal);
    }
    if (hasForeground) {
        svg = svg.replaceAll(PLACEHOLDER_FG, fgVal);
    }

    // If icon only has foreground (no background) and we need a background,
    // add a background rectangle
    if (!hasBackground && bgVal !== "transparent" && bgVal !== "#ffffff") {
        // Extract viewBox from SVG
        const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
        if (viewBoxMatch) {
            const viewBox = viewBoxMatch[1];
            const [x, y, width, height] = viewBox.split(/\s+/).map(parseFloat);
            
            // Find the first <g> or <svg> opening tag to insert background after
            // We'll insert it right after the opening <svg> tag or first <defs>
            const defsEndMatch = svg.match(/<\/defs>/);
            const firstGMatch = svg.match(/<g[^>]*>/);
            const insertAfter = defsEndMatch 
                ? defsEndMatch.index + defsEndMatch[0].length
                : firstGMatch 
                    ? firstGMatch.index 
                    : svg.indexOf(">", svg.indexOf("<svg")) + 1;
            
            // Create background rectangle
            const bgRect = `\n<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${bgVal}"/>`;
            svg = svg.slice(0, insertAfter) + bgRect + svg.slice(insertAfter);
        }
    }

    const outName = slug(icon, fg, bg);
    const outPath = path.join(GENERATED, outName);
    fs.writeFileSync(outPath, svg, "utf8");
    done++;
}

console.log(`Generated ${done} icons in assets/generated/${failed ? ` (${failed} skipped)` : ""}`);
