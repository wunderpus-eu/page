#!/usr/bin/env node
/**
 * Builds scripts/icon-manifest.json with every (icon, fg, bg) used by spell cards
 * and the card editor (filter chips). Run after adding new icons or colors.
 * Then run: node scripts/generate-icons.js
 *
 * Usage: node scripts/build-icon-manifest.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, "icon-manifest.json");

// Spell card colors from css/card.css (6-char hex, no #)
const FONT = "333333";
const FONT_LIGHT = "7f7f7f"; // --font-color-light, used for component text
const SCHOOLS = [
    "55a868", // Abjuration
    "dd8452", // Conjuration
    "64b5cd", // Divination
    "da8bc3", // Enchantment
    "c44e52", // Evocation
    "4c72b0", // Illusion
    "8172b3", // Necromancy
    "ccb974", // Transmutation
];
const ABSENT_CLASS_FG = "cccccc";

const FOREGROUNDS = [FONT, ...SCHOOLS]; // 9
const BG_WHITE = "ffffff";

// (fg, bg) pairs on a card: (font, white) and (school, white) only (earmark is a corner triangle, no lightened bg)
const CARD_FG_BG = [
    { fg: FONT, bg: BG_WHITE },
    ...SCHOOLS.map((fg) => ({ fg, bg: BG_WHITE })),
];
// Absent class icon: (#cccccc, white)
const ABSENT_CLASS_BG = [BG_WHITE];

const CLASS_NAMES = [
    "artificer", "bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard",
];

// Area icons used in render_range (icon-${area}); only those that exist in assets
// Order: line, cone, cube, cylinder, sphere, hemisphere, emanation, circle, square, wall
const AREA_ICONS = ["line", "cone", "cube", "cylinder", "sphere", "hemisphere", "emanation", "circle", "square", "wall"];

const INLINE_ICONS = [
    "icon-gold", "icon-silver", "icon-copper",
    "icon-acid", "icon-cold", "icon-fire", "icon-lightning", "icon-necrotic", "icon-poison",
    "icon-psychic", "icon-radiant", "icon-slashing", "icon-bludgeoning", "icon-piercing",
    "icon-thunder", "icon-force", "icon-emanation", "icon-line", "icon-cone", "icon-cube",
    "icon-cylinder", "icon-sphere",
    "icon-b", "icon-r", "icon-a",
];

function push(icons, list) {
    list.forEach((e) => icons.push(e));
}

function main() {
    const icons = [];

    // --- Class filter chips (card-editor): unselected + selected
    for (const c of CLASS_NAMES) {
        icons.push({ icon: `icon-${c}`, fg: "transparent", bg: "374151" });
        icons.push({ icon: `icon-${c}`, fg: "transparent", bg: "612692" });
    }

    // --- Border and component chips (v, s, m, m-req, m-cons): transparent backgrounds, only need fg variants
    // Background doesn't matter since SVG has no background fill, but use white for consistency
    for (const fg of FOREGROUNDS) {
        icons.push({ icon: "border-front", fg, bg: BG_WHITE });
        icons.push({ icon: "chip-v", fg, bg: BG_WHITE });
        icons.push({ icon: "chip-s", fg, bg: BG_WHITE });
        icons.push({ icon: "chip-m", fg, bg: BG_WHITE });
        icons.push({ icon: "chip-m-req", fg, bg: BG_WHITE });
        icons.push({ icon: "chip-m-cons", fg, bg: BG_WHITE });
    }
    
    // --- Chips with opaque backgrounds (c, r, plus): need fg and bg variants
    const CHIPS_WITH_BG = ["chip-c", "chip-r", "chip-plus"];
    for (const icon of CHIPS_WITH_BG) {
        for (const { fg, bg } of CARD_FG_BG) {
            icons.push({ icon, fg, bg });
        }
    }

    // --- Class icons on spell card: present (fg,bg) + absent (#ccc, bg)
    for (const c of CLASS_NAMES) {
        const icon = `icon-${c}`;
        for (const { fg, bg } of CARD_FG_BG) {
            icons.push({ icon, fg, bg });
        }
        for (const bg of ABSENT_CLASS_BG) {
            icons.push({ icon, fg: ABSENT_CLASS_FG, bg });
        }
    }

    // --- Range icons: white foreground only (now transparent backgrounds, so bg doesn't matter)
    icons.push({ icon: "icon-range", fg: "ffffff", bg: BG_WHITE });
    icons.push({ icon: "icon-range-los-inv", fg: "ffffff", bg: BG_WHITE });
    icons.push({ icon: "icon-targets", fg: "ffffff", bg: BG_WHITE });
    // --- Duration/permanent: white foreground only (no background in SVG, so bg doesn't matter)
    icons.push({ icon: "icon-duration", fg: "ffffff", bg: BG_WHITE });
    icons.push({ icon: "icon-permanent", fg: "ffffff", bg: BG_WHITE });
    icons.push({ icon: "icon-permanent-triggered", fg: "ffffff", bg: BG_WHITE });
    // --- Area icons: white foreground only (no background in SVG, so bg doesn't matter)
    // Area icons are stroke-only with transparent backgrounds. Background color has no effect.
    // Generate one variant per area icon (white fg, white bg) - the bg value doesn't matter since SVG has no background.
    for (const area of AREA_ICONS) {
        icons.push({ icon: `icon-${area}`, fg: "ffffff", bg: BG_WHITE });
    }

    // --- Inline and glossary: fg on white (var(--font-color), var(--font-color-light), or school when in description?)
    // Description/upcast text uses --font-color (333). Component text uses --font-color-light (7f7f7f).
    // Glossary uses iconColor = 333. Include both font and font-light for inline icons.
    const FG_ON_WHITE = [
        ...FOREGROUNDS.map((fg) => ({ fg, bg: BG_WHITE })),
        { fg: FONT_LIGHT, bg: BG_WHITE },
    ];
    for (const icon of INLINE_ICONS) {
        for (const { fg, bg } of FG_ON_WHITE) {
            icons.push({ icon, fg, bg });
        }
    }

    // --- Edit form area dropdown: area icons with (font-color, white)
    // Order: line, cone, cube, cylinder, sphere, hemisphere, emanation, circle, square, wall
    const EDIT_AREA_ICONS = ["icon-line", "icon-cone", "icon-cube", "icon-cylinder", "icon-sphere", "icon-hemisphere", "icon-emanation", "icon-circle", "icon-square", "icon-wall"];
    for (const icon of EDIT_AREA_ICONS) {
        icons.push({ icon, fg: FONT, bg: BG_WHITE });
    }

    // --- Glossary card: icons not in INLINE_ICONS but used with (font-color, white) in createGlossaryCard
    const GLOSSARY_ICONS = ["icon-range", "icon-range-los", "icon-targets", "icon-duration", "icon-permanent", "icon-permanent-triggered"];
    for (const icon of GLOSSARY_ICONS) {
        icons.push({ icon, fg: FONT, bg: BG_WHITE });
    }

    const manifest = {
        comment: "List of (icon, fg, bg) to pre-generate. Card uses white bg only (earmark = corner triangle). Re-run build-icon-manifest.js when adding icon usages; then run generate-icons.js.",
        icons,
    };

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`Wrote ${icons.length} entries to ${MANIFEST_PATH}`);
}

main();
