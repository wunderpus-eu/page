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
// Lightened (L=90) versions for "prepared" card background
const LIGHTENED = [
    "d4edd9", "fae9e0", "e0f4fa", "faf0f7", "f9e3e4", "dde8f4", "eae8f4", "faf6e8",
];
const ABSENT_CLASS_FG = "cccccc";

const FOREGROUNDS = [FONT, ...SCHOOLS]; // 9
const BG_WHITE = "ffffff";
const BG_LIGHTENED = LIGHTENED; // 8

// (fg, bg) pairs that actually occur on a card: (font, white), (school, white), (school, lightened[i])
const CARD_FG_BG = [
    { fg: FONT, bg: BG_WHITE },
    ...SCHOOLS.map((fg, i) => ({ fg, bg: BG_WHITE })),
    ...SCHOOLS.map((fg, i) => ({ fg, bg: BG_LIGHTENED[i] })),
];
// Absent class icon: (#cccccc, any bg)
const ABSENT_CLASS_BG = [BG_WHITE, ...BG_LIGHTENED];

// (white, fg) for range/area/duration icons
const WHITE_ON_FG = FOREGROUNDS.map((fg) => ({ fg: "ffffff", bg: fg }));

const CLASS_NAMES = [
    "artificer", "bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard",
];

// Area icons used in render_range (icon-${area}); only those that exist in assets
const AREA_ICONS = ["cone", "cube", "cylinder", "emanation", "line", "sphere", "square", "circle", "wall"];

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

    // --- Spell card: border, chips, class row
    const CARD_SECTION_ICONS = [
        "border-front",
        "chip-v", "chip-s", "chip-m", "chip-m-req", "chip-m-cons",
        "chip-c", "chip-r", "chip-plus",
    ];
    for (const icon of CARD_SECTION_ICONS) {
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

    // --- Range / area / duration: white on fg
    for (const { fg, bg } of WHITE_ON_FG) {
        icons.push({ icon: "icon-range", fg, bg });
        icons.push({ icon: "icon-range-los-inv", fg, bg });
        icons.push({ icon: "icon-duration", fg, bg });
        icons.push({ icon: "icon-permanent", fg, bg });
    }
    for (const area of AREA_ICONS) {
        for (const { fg, bg } of WHITE_ON_FG) {
            icons.push({ icon: `icon-${area}`, fg, bg });
        }
    }

    // --- Inline and glossary: fg on white (var(--font-color) or school when in description?)
    // Inline uses resolveCssVariable("var(--font-color)") so we need (333, white) and optionally school colors.
    // Description text is rendered with --font-color, so only 333. Glossary uses iconColor = 333.
    const FG_ON_WHITE = FOREGROUNDS.map((fg) => ({ fg, bg: BG_WHITE }));
    for (const icon of INLINE_ICONS) {
        for (const { fg, bg } of FG_ON_WHITE) {
            icons.push({ icon, fg, bg });
        }
    }

    // --- Glossary card: icons not in INLINE_ICONS but used with (font-color, white) in createGlossaryCard
    const GLOSSARY_ICONS = ["icon-range", "icon-range-los", "icon-duration", "icon-permanent"];
    for (const icon of GLOSSARY_ICONS) {
        icons.push({ icon, fg: FONT, bg: BG_WHITE });
    }

    const manifest = {
        comment: "List of (icon, fg, bg) to pre-generate. Covers class filter chips and all spell-card icons (border, range, area, duration, components, class row, inline/glossary). fg/bg: 6-char hex (no #), or 'transparent' for filter chips. Re-run build-icon-manifest.js when adding icon usages; then run generate-icons.js.",
        icons,
    };

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`Wrote ${icons.length} entries to ${MANIFEST_PATH}`);
}

main();
