/**
 * card.js – Spell card rendering and spell data.
 *
 * Exports:
 * - SpellCard: class that renders a spell as a printable card front (and optionally back)
 * - Spell data helpers: getSpells, loadSpells, emptySpellTemplate, cloneSpellData
 * - Card utilities: createGlossaryCard, createGlossaryCardRef, isGlossaryRef, getNextCardId
 * - Styling: getSpellSchoolColor, schoolColorMap, load_icon
 */
import { colord } from "colord";

/** D&D class names in display order. */
export const ALL_CLASSES = [
    "Artificer",
    "Bard",
    "Cleric",
    "Druid",
    "Paladin",
    "Ranger",
    "Sorcerer",
    "Warlock",
    "Wizard",
];

/** Maps source IDs to display labels (e.g. XPHB → PHB'24). */
export const SOURCE_MAP = {
    XPHB: "PHB'24",
    PHB: "PHB'14",
};

/** Full display names for filter menu (abbreviation → full name). Spell list chips keep abbreviation. */
export const SOURCE_DISPLAY_NAMES = {
    PHB: "Player's Handbook",
    XPHB: "Player's Handbook",
    AAG: "Astral Adventurer's Guide",
    AI: "Acquisitions Incorporated",
    "AitFR-AVT": "Adventures in the Forgotten Realms: A Verdant Tomb",
    BMT: "Bigby Presents: Glory of the Giants",
    EFA: "Eberron: Forge of the Artificer",
    EGW: "Explorer's Guide to Wildemount",
    FRHoF: "Forgotten Realms: Heroes of Faerûn",
    FTD: "Fizban's Treasury of Dragons",
    GGR: "Guildmasters' Guide to Ravnica",
    IDRotF: "Icewind Dale: Rime of the Frostmaiden",
    LLK: "Lost Laboratory of Kwalish",
    SatO: "Sigil and the Outlands",
    SCC: "Strixhaven: A Curriculum of Chaos",
    TCE: "Tasha's Cauldron of Everything",
    XGE: "Xanathar's Guide to Everything",
};

/** Source abbreviations for 2024-only books. When 2014 ruleset is selected, spells from these sources are excluded. */
export const SOURCES_2024 = ["XPHB"];

let spells = [];
const iconCache = {};
let nextCardId = 0;
let nextSpellId = 0;

/** Returns a unique ID for new cards (e.g. card-1, card-2). */
export function getNextCardId() {
    nextCardId += 1;
    return `card-${nextCardId}`;
}

/** Returns a unique ID for spells (used when loading spells.json or appending uploaded spells). */
export function getNextSpellId() {
    nextSpellId += 1;
    return `spell-${nextSpellId}`;
}

/** Minimal valid spell object for empty/custom cards */
export function emptySpellTemplate() {
    return {
        name: "",
        subtitle: "",
        source: "Homebrew",
        page: 0,
        isSRD: false,
        level: 0,
        school: "Abjuration",
        time: { number: 1, unit: "action" },
        range: {
            origin: "point",
            distance: 30,
            unit: "feet",
            requiresSight: false,
            area: "",
            areaDistance: 0,
            areaUnit: "",
            areaHeight: 0,
            areaHeightUnit: "",
            targets: 0,
            targetsScale: false,
        },
        components: {
            v: true,
            s: false,
            m: false,
            hasCost: false,
            isConsumed: false,
            description: "",
        },
        duration: {
            type: "timed",
            amount: 1,
            unit: "minute",
            ends: [],
        },
        description: "",
        classes: [],
        isConcentration: false,
        isRitual: false,
        upcast: "",
    };
}

/** Deep clone spell data for use in a card (so edits don't mutate shared data) */
export function cloneSpellData(spell) {
    return JSON.parse(JSON.stringify(spell));
}

/** Returns the current spell list (from loadSpells). */
export function getSpells() {
    return spells;
}

/** Maps spell school names to CSS color variables. */
export const schoolColorMap = {
    Abjuration: "var(--abjuration-color)",
    Conjuration: "var(--conjuration-color)",
    Divination: "var(--divination-color)",
    Enchantment: "var(--enchantment-color)",
    Evocation: "var(--evocation-color)",
    Illusion: "var(--illusion-color)",
    Necromancy: "var(--necromancy-color)",
    Transmutation: "var(--transmutation-color)",
};

/** Resolves a CSS variable (e.g. var(--font-color)) to its computed value. */
function resolveCssVariable(cssVar) {
    const tempDiv = document.createElement("div");
    tempDiv.style.color = cssVar;
    document.body.appendChild(tempDiv);
    const computedColor = getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);
    return computedColor;
}

/** Returns the computed color for a spell's school (from schoolColorMap). */
export function getSpellSchoolColor(spell) {
    const colorVar = schoolColorMap[spell.school];
    if (!colorVar) {
        return "black"; // Default color
    }
    return resolveCssVariable(colorVar);
}

/** Close tooltips and popovers in the subtree so WA components don't throw on disconnect (e.g. when clearing innerHTML). */
function closePopoversAndTooltipsIn(element) {
    if (!element || !element.querySelectorAll) return;
    element.querySelectorAll("wa-tooltip").forEach((el) => {
        if ("open" in el) el.open = false;
    });
    element.querySelectorAll("wa-popup").forEach((el) => {
        if ("open" in el) el.open = false;
    });
    element.querySelectorAll("[popover]").forEach((el) => {
        if (typeof el.hidePopover === "function") el.hidePopover();
    });
}

/** Remove WA popup/tooltip nodes so their disconnect doesn't run during innerHTML clear (WaPopup can throw in disconnectedCallback). */
function removePopoversAndTooltipsIn(element) {
    if (!element || !element.querySelectorAll) return;
    element.querySelectorAll("wa-tooltip").forEach((el) => el.remove());
    element.querySelectorAll("wa-popup").forEach((el) => el.remove());
}

/** Builds the decorative border frame for a spell card front. */
async function render_front_border(spell, foregroundColor, backgroundColor) {
    const frontBorderContainer = document.createElement("div");
    frontBorderContainer.className = "spell-card-front-border";

    const frontBorder = document.createElement("img");
    frontBorder.src = await load_icon(
        "border-front",
        foregroundColor,
        backgroundColor
    );
    frontBorderContainer.appendChild(frontBorder);

    return frontBorderContainer;
}

/**
 * Normalize color for generated icon filename (must match scripts/generate-icons.js).
 * @param {string} c
 * @returns {string}
 */
function iconColorSlug(c) {
    const s = String(c).trim().replace(/^#/, "").toLowerCase();
    return s || "transparent";
}

/**
 * Normalize any CSS color to the form used in the icon manifest: 6-char hex (no #), or "transparent".
 * Matches scripts/icon-manifest.json and generated filenames (no literals like "white").
 * @param {string} c
 * @returns {string}
 */
function normalizeColorForIcon(c) {
    if (c == null || c === "") return "transparent";
    const s = String(c).trim().toLowerCase();
    if (s === "transparent") return "transparent";
    if (s === "white" || s === "#ffffff" || s === "ffffff") return "ffffff";
    const parsed = colord(c);
    if (parsed.isValid()) return parsed.toHex();
    return s.replace(/^#/, "") || "transparent";
}

/**
 * Loads a pre-generated SVG from assets/generated/{icon}_{fg}_{bg}.svg (see scripts/icon-manifest.json and scripts/generate-icons.js).
 * If the file is missing, throws so you can add the combo to the manifest and run the generator.
 * Colors are normalized to 6-char hex (or "transparent") so computed values like rgb(r,g,b) match the manifest.
 * @param {string} iconName - Filename without .svg (e.g. "icon-fire")
 * @param {string} [foregroundColor] - Color for #333333
 * @param {string} [backgroundColor] - Color for #ffffff
 * @returns {Promise<string>} Data URL of the SVG
 */
export async function load_icon(
    iconName,
    foregroundColor = "#333333",
    backgroundColor = "white"
) {
    const fg = normalizeColorForIcon(foregroundColor);
    const bg = normalizeColorForIcon(backgroundColor);
    const cacheKey = `${iconName}-${fg}-${bg}`;
    if (iconCache[cacheKey]) {
        return iconCache[cacheKey];
    }

    const generatedSlug = `${iconName}_${iconColorSlug(fg)}_${iconColorSlug(bg)}.svg`;
    const url = `assets/generated/${generatedSlug}`;
    const genResponse = await fetch(url);
    if (!genResponse.ok) {
        throw new Error(
            `Missing icon: ${url} — add { "icon": "${iconName}", "fg": "...", "bg": "..." } to scripts/icon-manifest.json and run node scripts/generate-icons.js`
        );
    }
    const svgText = await genResponse.text();
    const dataUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;
    iconCache[cacheKey] = dataUrl;
    return dataUrl;
}

/**
 * Loads all spells from data/spells.json once. Ruleset (2014 vs 2024) is applied in the UI by excluding XPHB when 2014 is selected.
 * @returns {Promise<{ spells: object[]; spellClassMap: Record<string, string[]> }>}
 */
export async function loadSpells() {
    try {
        const response = await fetch("data/spells.json");
        const allSpells = await response.json();

        spells = allSpells;
        spells.sort(
            (a, b) =>
                a.name.localeCompare(b.name) ||
                (a.source || "").localeCompare(b.source || "")
        );

        // Always assign a unique id to every spell (overwrites any from file)
        spells.forEach((spell) => {
            spell.id = getNextSpellId();
        });

        // Build spellClassMap keyed by spell.id for class lookups (works with filtered lists in UI)
        const spellClassMap = {};
        spells.forEach((spell) => {
            if (spell.classes && spell.classes.length > 0) {
                spellClassMap[spell.id] = spell.classes;
            }
        });

        return { spells, spellClassMap };
    } catch (error) {
        console.error("Error loading spell data:", error);
        return { spells: [], spellClassMap: {} };
    }
}

/**
 * Appends spells from uploaded JSON to the list. Always assigns unique ids and marks as _uploaded.
 * @param {object[]|object} rawSpells - Array of spell objects, or single spell (same shape as spells.json)
 */
export function appendSpells(rawSpells) {
    const arr = Array.isArray(rawSpells) ? rawSpells : [rawSpells];
    arr.forEach((spell) => {
        spell.id = getNextSpellId(); // always generate, ignore any id in file
        spell._uploaded = true;
    });
    spells.push(...arr);
    spells.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Returns a spell in export format (same as spells.json): no id, _modified, or _uploaded.
 * @param {object} spell - Spell data (e.g. from a card)
 * @returns {object} Clone suitable for JSON export
 */
export function spellToExportFormat(spell) {
    const s = cloneSpellData(spell);
    delete s.id;
    delete s._modified;
    delete s._uploaded;
    return s;
}

/** Renders the spell level circle (cantrip circle or numeric level). */
function render_spell_level(spell, computedColor) {
    const outerCircle = document.createElement("div");
    outerCircle.className = "spell-level-outer-circle";
    outerCircle.style.setProperty("--border-color", computedColor);
    outerCircle.style.backgroundColor = computedColor;

    const spellLevel = spell.level;
    if (spellLevel === 0) {
        const cantripCircle = document.createElement("div");
        cantripCircle.className = "cantrip-circle";
        outerCircle.appendChild(cantripCircle);
    } else {
        const spellLevelText = document.createElement("span");
        spellLevelText.className = "spell-level-text";
        spellLevelText.textContent = spellLevel;
        outerCircle.appendChild(spellLevelText);
    }

    return outerCircle;
}

/** Renders the spell name heading and optional subtitle. Shows the spell name as stored in the data (WYSIWYG). */
function render_spell_name(spell) {
    const spellNameContainer = document.createElement("div");
    spellNameContainer.className = "spell-name-container";

    const spellNameElement = document.createElement("h3");
    spellNameElement.className = "spell-name";
    spellNameElement.textContent = spell.name;

    spellNameContainer.appendChild(spellNameElement);

    if (spell.subtitle && String(spell.subtitle).trim()) {
        const subtitleElement = document.createElement("div");
        subtitleElement.className = "spell-name-subtitle";
        subtitleElement.textContent = spell.subtitle.trim();
        spellNameContainer.appendChild(subtitleElement);
    }

    return spellNameContainer;
}

/** Renders the casting time chip (e.g. A for action, 1 min). */
function render_casting_time(spell, foregroundColor, backgroundColor) {
    const castingTimeWrapper = document.createElement("div");
    castingTimeWrapper.className = "casting-time-container";

    const castingTimeContainer = document.createElement("div");
    castingTimeContainer.className = "spell-casting-time";
    castingTimeContainer.style.backgroundColor = foregroundColor;
    castingTimeContainer.style.setProperty("--border-color", backgroundColor);
    castingTimeWrapper.appendChild(castingTimeContainer);

    if (spell.time) {
        const time = spell.time;
        const number = time.number;
        const unit = time.unit;
        let castingTimeText = "";

        if (["action", "bonus", "reaction"].includes(unit)) {
            castingTimeText = unit[0].toUpperCase();
            castingTimeContainer.style.fontSize = "10pt";
            castingTimeContainer.classList.add("is-circular");
        } else {
            let unitText = unit;
            if (unit === "minute") {
                unitText = "min";
            } else if (unit === "hour") {
                unitText = "h";
            }
            castingTimeText = `${number} ${unitText}`;
            castingTimeContainer.style.fontSize = "8pt";
        }
        castingTimeContainer.textContent = castingTimeText;
    }

    return castingTimeWrapper;
}

async function render_range(spell, foregroundColor, backgroundColor) {
    const rangeContainer = document.createElement("div");
    rangeContainer.className = "spell-range";

    rangeContainer.style.backgroundColor = foregroundColor;

    const range = spell.range;
    const origin = range.origin;
    const distance = range.distance;
    const unit = range.unit;
    const area = range.area;
    const areaDistance = range.areaDistance;
    const areaUnit = range.areaUnit;

    const validAreaTypes = [
        "line",
        "cone",
        "cube",
        "cylinder",
        "sphere",
        "hemisphere",
        "emanation",
        "circle",
        "square",
        "wall",
    ];
    const hasArea = validAreaTypes.includes(area) && areaDistance > 0;
    const unitAbbrev = { feet: "ft", miles: "mi" };

    const iconName = range.requiresSight ? "icon-range-los-inv" : "icon-range";
    // Range icons have transparent backgrounds, so bg param doesn't matter - use white
    const iconUrl = await load_icon(iconName, "white", "white");
    if (iconUrl) {
        const icon = document.createElement("img");
        icon.src = iconUrl;
        icon.className = "spell-range-icon";
        rangeContainer.appendChild(icon);
    }

    // Case 1: Self with area - just show area size and type
    if (origin === "self" && hasArea) {
        const areaText = `${areaDistance} ${unitAbbrev[areaUnit] || areaUnit}`;
        rangeContainer.appendChild(document.createTextNode(areaText));

        // Area icons have no background in SVG, so bg param doesn't matter - use white
        const areaIconURL = await load_icon(
            `icon-${area}`,
            "white",
            "white"
        );
        if (areaIconURL) {
            const areaIcon = document.createElement("img");
            areaIcon.src = areaIconURL;
            areaIcon.className = "spell-range-icon area";
            rangeContainer.appendChild(areaIcon);
        }
    }
    // Case 2: Point with distance and area - show range, then area size and icon
    else if (origin === "point" && distance > 0 && hasArea) {
        const rangeText = `${distance} ${unitAbbrev[unit] || unit}`;
        const areaText = `, ${areaDistance} ${
            unitAbbrev[areaUnit] || areaUnit
        }`;
        rangeContainer.appendChild(
            document.createTextNode(rangeText + areaText)
        );

        // Area icons have no background in SVG, so bg param doesn't matter - use white
        const areaIconURL = await load_icon(
            `icon-${area}`,
            "white",
            "white"
        );
        if (areaIconURL) {
            const areaIcon = document.createElement("img");
            areaIcon.src = areaIconURL;
            areaIcon.className = "spell-range-icon area";
            rangeContainer.appendChild(areaIcon);
        }
    }
    // Case 3: Other cases - show origin/distance as before, optionally with area size and icon
    else {
        let rangeText = "";
        if (origin === "self") {
            rangeText = "Self";
        } else if (origin === "touch") {
            rangeText = "Touch";
        } else if (origin === "special") {
            rangeText = "Special";
        } else if (origin === "point" && unit && unit !== "unlimited") {
            rangeText = `${distance} ${unitAbbrev[unit] || unit}`;
        } else if (unit === "unlimited") {
            rangeText = "Unlimited";
        } else if (distance > 0) {
            rangeText = `${distance} ${unitAbbrev[unit] || unit}`;
        } else {
            rangeText = "Self";
        }
        rangeContainer.appendChild(document.createTextNode(rangeText));

        // If there's an area type, always show ", <area size> <unit>" then the area icon
        if (validAreaTypes.includes(area)) {
            const areaSize = areaDistance > 0 ? areaDistance : 0;
            const areaUnitStr = areaUnit || "feet";
            const areaText = `, ${areaSize} ${
                unitAbbrev[areaUnitStr] || areaUnitStr
            }`;
            rangeContainer.appendChild(document.createTextNode(areaText));
            const areaIconURL = await load_icon(
                `icon-${area}`,
                "white",
                foregroundColor
            );
            if (areaIconURL) {
                const areaIcon = document.createElement("img");
                areaIcon.src = areaIconURL;
                areaIcon.className = "spell-range-icon area";
                rangeContainer.appendChild(areaIcon);
            }
        }
    }

    return rangeContainer;
}

/** Renders the duration section (timed amount or permanent). */
async function render_duration(spell, foregroundColor, backgroundColor) {
    const durationContainer = document.createElement("div");
    durationContainer.className = "spell-duration";

    durationContainer.style.backgroundColor = foregroundColor;

    const duration = spell.duration;
    const durationType = duration.type;
    const durationAmount = duration.amount;
    const durationUnit = duration.unit;
    const ends = duration.ends || [];

    if (["instant", "special"].includes(durationType)) {
        return null;
    }

    const iconName =
        durationType === "timed" ? "icon-duration" : "icon-permanent";
    // Duration/permanent icons have no background in SVG, so bg param doesn't matter - use white
    const iconUrl = await load_icon(iconName, "white", "white");
    if (iconUrl) {
        const icon = document.createElement("img");
        icon.src = iconUrl;
        icon.className = "spell-duration-icon";
        durationContainer.appendChild(icon);
    }

    if (durationType === "timed") {
        const durationUnitAbbrev = {
            minute: "min",
            hour: "h",
            day: "d",
            round: "Round",
        };
        let durationText = `${durationAmount} ${
            durationUnitAbbrev[durationUnit] || durationUnit
        }`;
        const durationSpan = document.createElement("span");
        durationSpan.textContent = durationText;
        durationContainer.appendChild(durationSpan);
    } else {
        if (ends.includes("trigger")) {
            const durationSpan = document.createElement("span");
            durationSpan.textContent = "or Triggered";
            durationContainer.appendChild(durationSpan);
        }
    }

    return durationContainer;
}

/** Renders range and duration in a single row. */
async function render_range_and_duration(
    spell,
    foregroundColor,
    backgroundColor
) {
    const rangeAndDurationContainer = document.createElement("div");
    rangeAndDurationContainer.className = "spell-range-and-duration";

    if (spell.range) {
        const range = await render_range(
            spell,
            foregroundColor,
            backgroundColor
        );
        rangeAndDurationContainer.appendChild(range);
    }
    if (spell.duration) {
        const duration = await render_duration(
            spell,
            foregroundColor,
            backgroundColor
        );
        if (duration) {
            rangeAndDurationContainer.appendChild(duration);
        }
    }

    return rangeAndDurationContainer;
}

/** Renders V/S/M component icons. */
async function render_component_icons(spell, foregroundColor, backgroundColor) {
    const componentIconsContainer = document.createElement("div");
    componentIconsContainer.className = "spell-component-icons";

    const components = spell.components;
    if (components.v) {
        const verbalIcon = document.createElement("img");
        verbalIcon.src = await load_icon(
            "chip-v",
            foregroundColor,
            backgroundColor
        );
        componentIconsContainer.appendChild(verbalIcon);
    }
    if (components.s) {
        const somaticIcon = document.createElement("img");
        somaticIcon.src = await load_icon(
            "chip-s",
            foregroundColor,
            backgroundColor
        );
        componentIconsContainer.appendChild(somaticIcon);
    }
    if (components.m) {
        const materialIcon = document.createElement("img");
        let icon_name = "chip-m";
        if (components.hasCost) {
            icon_name = "chip-m-req";
        }
        if (components.isConsumed) {
            icon_name = "chip-m-cons";
        }
        materialIcon.src = await load_icon(
            icon_name,
            foregroundColor,
            backgroundColor
        );
        componentIconsContainer.appendChild(materialIcon);
    }

    return componentIconsContainer;
}

/**
 * Parses spell text with **bold**, *italic*, `placeholder` and inline icons.
 * Placeholders map to icons (e.g. `fire damage` → fire icon, `100 gp` → gold).
 */
async function process_text_for_rendering(
    text,
    foregroundColorVar = "var(--font-color)"
) {
    const container = document.createDocumentFragment();
    if (!text) return container;

    const foregroundColor = resolveCssVariable(foregroundColorVar);

    // Icons for placeholders wrapped in backticks
    const placeholderIcons = {
        gp: "icon-gold",
        sp: "icon-silver",
        cp: "icon-copper",
        "acid damage": "icon-acid",
        "cold damage": "icon-cold",
        "fire damage": "icon-fire",
        "lightning damage": "icon-lightning",
        "necrotic damage": "icon-necrotic",
        "poison damage": "icon-poison",
        "psychic damage": "icon-psychic",
        "radiant damage": "icon-radiant",
        "slashing damage": "icon-slashing",
        "bludgeoning damage": "icon-bludgeoning",
        "piercing damage": "icon-piercing",
        "thunder damage": "icon-thunder",
        "force damage": "icon-force",
        emanation: "icon-emanation",
        line: "icon-line",
        cone: "icon-cone",
        cube: "icon-cube",
        cylinder: "icon-cylinder",
        sphere: "icon-sphere",
        hemisphere: "icon-hemisphere",
    };

    // Regex to match: **bold**, *italic*, `placeholder`, and newlines
    const regex = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\n)/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            container.appendChild(
                document.createTextNode(text.substring(lastIndex, match.index))
            );
        }

        const matchedText = match[0];

        if (match[1]) {
            // Bold text **...**
            const boldText = matchedText.slice(2, -2);
            const strong = document.createElement("strong");
            strong.textContent = boldText;
            container.appendChild(strong);
        } else if (match[2]) {
            // Italic text *...*
            const italicText = matchedText.slice(1, -1);
            const em = document.createElement("em");
            em.textContent = italicText;
            container.appendChild(em);
        } else if (match[3]) {
            // Placeholder `...`
            const placeholder = matchedText.slice(1, -1).toLowerCase();

            // Check if it's an icon placeholder (damage, area, currency gp/sp/cp, etc.)
            if (placeholderIcons[placeholder]) {
                const icon = document.createElement("img");
                icon.src = await load_icon(
                    placeholderIcons[placeholder],
                    foregroundColor
                );
                icon.className = "inline-icon";
                const iconWrapper = document.createElement("span");
                iconWrapper.className = "inline-icon-wrapper";
                iconWrapper.appendChild(icon);
                const altSpan = document.createElement("span");
                altSpan.className = "inline-icon-alt";
                altSpan.textContent = matchedText.slice(1, -1);
                iconWrapper.appendChild(altSpan);
                container.appendChild(iconWrapper);
            }
            // Check for action economy placeholders and replace with icons
            else if (
                placeholder === "bonus action" ||
                placeholder === "action" ||
                placeholder === "actions" ||
                placeholder === "reaction" ||
                placeholder === "reactions"
            ) {
                // Determine the action type icon
                let iconName = null;
                if (placeholder === "bonus action") {
                    iconName = "icon-b"; // Bonus action
                } else if (
                    placeholder === "reaction" ||
                    placeholder === "reactions"
                ) {
                    iconName = "icon-r"; // Reaction
                } else {
                    iconName = "icon-a"; // Action
                }

                const icon = document.createElement("img");
                icon.src = await load_icon(iconName, foregroundColor);
                icon.className = "inline-icon";
                const iconWrapper = document.createElement("span");
                iconWrapper.className = "inline-icon-wrapper";
                iconWrapper.appendChild(icon);
                const altSpan = document.createElement("span");
                altSpan.className = "inline-icon-alt";
                altSpan.textContent = matchedText.slice(1, -1);
                iconWrapper.appendChild(altSpan);
                container.appendChild(iconWrapper);
            }
            // Default: render as plain text (without backticks)
            else {
                container.appendChild(
                    document.createTextNode(matchedText.slice(1, -1))
                );
            }
        } else if (match[4]) {
            // Newline - convert to space or line break as needed
            container.appendChild(document.createTextNode(" "));
        }

        lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        container.appendChild(
            document.createTextNode(text.substring(lastIndex))
        );
    }

    return container;
}

/** Renders material component description text. */
async function render_component_text(spell) {
    const componentTextContainer = document.createElement("div");
    componentTextContainer.className = "spell-component-text";

    const components = spell.components;
    if (components?.description) {
        const materialText = components.description;
        const materialTextElement = document.createElement("span");
        materialTextElement.appendChild(
            await process_text_for_rendering(
                materialText,
                "var(--font-color-light)"
            )
        );
        componentTextContainer.appendChild(materialTextElement);
    }

    return componentTextContainer;
}

/** Renders concentration and ritual chips. */
async function render_concentration_and_ritual(
    spell,
    foregroundColor,
    backgroundColor
) {
    const concentrationAndRitualContainer = document.createElement("div");
    concentrationAndRitualContainer.className =
        "spell-concentration-and-ritual";

    if (spell.isConcentration) {
        const concentrationIcon = document.createElement("img");
        concentrationIcon.src = await load_icon(
            "chip-c",
            foregroundColor,
            backgroundColor
        );
        concentrationAndRitualContainer.appendChild(concentrationIcon);
    }
    if (spell.isRitual) {
        const ritualIcon = document.createElement("img");
        ritualIcon.src = await load_icon(
            "chip-r",
            foregroundColor,
            backgroundColor
        );
        concentrationAndRitualContainer.appendChild(ritualIcon);
    }

    return concentrationAndRitualContainer;
}

/** Renders class icons row (greyed out for classes the spell doesn't have). */
async function render_class_icons(spell, foregroundColor, backgroundColor) {
    const classIconsContainer = document.createElement("div");
    classIconsContainer.className = "spell-class-icons";

    const spellClasses = spell.classes || [];

    for (const className of ALL_CLASSES) {
        const classIcon = document.createElement("img");
        const isPresent = spellClasses.includes(className);
        const color = isPresent ? foregroundColor : "#cccccc";
        classIcon.src = await load_icon(
            `icon-${className.toLowerCase()}`,
            color,
            backgroundColor
        );
        classIconsContainer.appendChild(classIcon);
    }

    return classIconsContainer;
}

/** Renders the spell source. Shows the actual source (PHB/XPHB) mapped to display name (PHB'14/PHB'24). */
function render_spell_source(spell, foregroundColor) {
    const wrapper = document.createElement("div");
    wrapper.className = "spell-source-text";
    wrapper.style.color = foregroundColor;
    wrapper.textContent = SOURCE_MAP[spell.source] || spell.source;
    return wrapper;
}

/** Renders the spell school label with per-character styling. */
function render_spell_school(spell, foregroundColor, backgroundColor) {
    const spellSchoolContainer = document.createElement("div");
    spellSchoolContainer.className = "spell-school-container";

    const spellSchool = document.createElement("div");
    spellSchool.className = "spell-school";
    spellSchool.style.color = foregroundColor;
    spellSchool.style.backgroundColor = backgroundColor;

    const schoolName = spell.school;
    for (const char of schoolName) {
        const span = document.createElement("span");
        span.textContent = char;
        spellSchool.appendChild(span);
    }
    spellSchoolContainer.appendChild(spellSchool);
    return spellSchoolContainer;
}

/** Renders casting time condition text if present. Text is stored WYSIWYG. */
async function render_condition_text(spell) {
    const conditionText = spell.time.condition;
    if (conditionText) {
        const conditionTextElement = document.createElement("span");
        conditionTextElement.className = "spell-condition-text";
        conditionTextElement.appendChild(
            await process_text_for_rendering(conditionText)
        );
        return conditionTextElement;
    }

    return null;
}

/**
 * Parses text into blocks: markdown tables, lists, named entries, and paragraphs.
 * Used by both main description and higher-level (upcast) text.
 */
async function render_blocks(text) {
    const container = document.createDocumentFragment();
    if (!text) return container;

    const blocks = text.split(/\n\n+/);

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;

        if (trimmedBlock.startsWith("|") && trimmedBlock.includes("| --- |")) {
            const table = await render_markdown_table(trimmedBlock);
            container.appendChild(table);
        } else if (trimmedBlock.startsWith("- ") || trimmedBlock.startsWith("* ")) {
            const list = await render_markdown_list(trimmedBlock);
            container.appendChild(list);
        } else if (trimmedBlock.match(/^\d+\. /)) {
            const list = await render_markdown_ordered_list(trimmedBlock);
            container.appendChild(list);
        } else if (trimmedBlock.match(/^\*\*[^*]+\*\*\n/)) {
            const lines = trimmedBlock.split("\n");
            const nameMatch = lines[0].match(/^\*\*([^*]+)\*\*$/);
            if (nameMatch) {
                const entryName = nameMatch[1];
                const entryContent = lines.slice(1).join("\n");
                const p = document.createElement("p");
                const nameSpan = document.createElement("span");
                nameSpan.className = "spell-entry-name";
                nameSpan.textContent = entryName + " ";
                p.appendChild(nameSpan);
                p.appendChild(await process_text_for_rendering(entryContent));
                container.appendChild(p);
            }
        } else {
            const p = document.createElement("p");
            p.appendChild(await process_text_for_rendering(trimmedBlock));
            container.appendChild(p);
        }
    }

    return container;
}

/** Renders the "at higher levels" upcast section. */
async function render_higher_level_text(
    spell,
    foregroundColor,
    backgroundColor
) {
    const upcast = spell.upcast;
    if (!upcast) {
        return null;
    }

    const higherLevelTextContainer = document.createElement("div");
    higherLevelTextContainer.className = "spell-higher-level-text";

    const line = document.createElement("div");
    line.className = "higher-level-line";
    line.style.backgroundColor = foregroundColor;
    higherLevelTextContainer.appendChild(line);

    const circle = document.createElement("img");
    circle.src = await load_icon("chip-plus", foregroundColor, backgroundColor);
    circle.className = "higher-level-circle";
    higherLevelTextContainer.appendChild(circle);

    const plus = document.createElement("span");
    plus.className = "higher-level-plus";
    plus.textContent = "+";
    circle.appendChild(plus);

    higherLevelTextContainer.appendChild(await render_blocks(upcast));

    return higherLevelTextContainer;
}

/** Parses description text into paragraphs, lists, tables, and named entries. */
async function render_description(description) {
    return render_blocks(description);
}

/** Parses markdown table syntax (| col1 | col2 |\n| --- | --- |) into a table element. */
async function render_markdown_table(tableText) {
    const table = document.createElement("table");
    table.className = "spell-table";

    const lines = tableText.trim().split("\n");

    // Header row
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headerCells = lines[0].split("|").filter((c) => c.trim());
    for (const cell of headerCells) {
        const th = document.createElement("th");
        th.appendChild(await process_text_for_rendering(cell.trim()));
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows (skip header and separator)
    const tbody = document.createElement("tbody");
    for (let i = 2; i < lines.length; i++) {
        const row = document.createElement("tr");
        const cells = lines[i].split("|").filter((c) => c.trim() !== "");
        for (const cell of cells) {
            const td = document.createElement("td");
            td.appendChild(await process_text_for_rendering(cell.trim()));
            row.appendChild(td);
        }
        tbody.appendChild(row);
    }
    table.appendChild(tbody);

    return table;
}

/** Parses markdown unordered list syntax (- item or * item) into a ul element. */
async function render_markdown_list(listText) {
    const ul = document.createElement("ul");
    ul.className = "spell-description-list";

    const items = listText.split(/\n(?=[-*] )/);
    for (const item of items) {
        const li = document.createElement("li");
        const content = item.replace(/^[-*] /, "").trim();
        li.appendChild(await process_text_for_rendering(content));
        ul.appendChild(li);
    }

    return ul;
}

/** Parses markdown ordered list syntax (1. item) into an ol element. */
async function render_markdown_ordered_list(listText) {
    const ol = document.createElement("ol");
    ol.className = "spell-description-list";

    const items = listText.split(/\n(?=\d+\. )/);
    for (const item of items) {
        const li = document.createElement("li");
        const content = item.replace(/^\d+\. /, "").trim();
        li.appendChild(await process_text_for_rendering(content));
        ol.appendChild(li);
    }

    return ol;
}

/**
 * If the description overflows, creates a back card and moves content there.
 * Runs only when a card is rendered (card must be in DOM for measurement).
 * Card dimensions are constant; no need to re-run when page size or layout options change.
 *
 * @param {SpellCard} spellCard
 * @param {HTMLElement} measureContainer - Parent for measuring (e.g. off-screen div)
 * @param {number} [fontLevel] - 0=normal, 1=6pt, 2=5.5pt
 */
async function handleOverflow(spellCard, measureContainer, fontLevel = 0) {
    const card = spellCard.frontElement;
    const spell = spellCard.spell;
    const cardBody = card.querySelector(".card-body");
    const descriptionText = card.querySelector(".description-text");

    if (!cardBody || !descriptionText) {
        return null;
    }

    const componentText = card.querySelector(".spell-component-text");

    function isOverflowing(element) {
        return element.scrollHeight > element.clientHeight;
    }

    if (isOverflowing(descriptionText)) {
        if (fontLevel === 0) {
            cardBody.style.fontSize = "6pt";
            cardBody.style.lineHeight = "6pt";
            if (componentText) {
                componentText.style.fontSize = "6pt";
                componentText.style.lineHeight = "6pt";
            }

            if (isOverflowing(descriptionText)) {
                cardBody.style.fontSize = "";
                cardBody.style.lineHeight = "";
                if (componentText) {
                    componentText.style.fontSize = "";
                    componentText.style.lineHeight = "";
                }
            } else {
                return null;
            }
        }

        const backCardContainer = document.createElement("div");
        backCardContainer.className = "spell-card";
        backCardContainer.dataset.cardId = spellCard.id;
        backCardContainer.dataset.spellName = spell.name;
        backCardContainer.style.backgroundColor = spellCard.backgroundColor;

        const back = document.createElement("div");
        back.className = "spell-card-back";

        const backCardBody = document.createElement("div");
        backCardBody.className = "card-body back";
        backCardBody.style.setProperty("--back-border-color", getSpellSchoolColor(spell));
        back.appendChild(backCardBody);

        const backDescriptionText = document.createElement("div");
        backDescriptionText.className = "description-text";
        backCardBody.appendChild(backDescriptionText);

        backCardContainer.appendChild(back);

        if (measureContainer) {
            measureContainer.appendChild(backCardContainer);
        }

        if (fontLevel > 0) {
            const fontSize = fontLevel === 1 ? "6pt" : "5.5pt";
            const frontCardBody = card.querySelector(".card-body");
            frontCardBody.style.fontSize = fontSize;
            frontCardBody.style.lineHeight = fontSize;
            if (componentText) {
                componentText.style.fontSize = fontSize;
                componentText.style.lineHeight = fontSize;
            }
            backCardBody.style.fontSize = fontSize;
            backCardBody.style.lineHeight = fontSize;
        }

        const descriptionElements = Array.from(descriptionText.children);

        while (
            isOverflowing(descriptionText) &&
            descriptionElements.length > 0
        ) {
            const elementToMove = descriptionElements.pop();
            backDescriptionText.prepend(elementToMove);
        }

        if (isOverflowing(backCardBody) && fontLevel < 2) {
            const backElements = Array.from(backDescriptionText.children);
            for (const elementToMove of backElements) {
                descriptionText.appendChild(elementToMove);
            }

            if (measureContainer) {
                measureContainer.removeChild(backCardContainer);
            }

            return await handleOverflow(
                spellCard,
                measureContainer,
                fontLevel + 1
            );
        }

        const lastParagraph = descriptionText.querySelector("p:last-of-type");
        if (lastParagraph) {
            lastParagraph.appendChild(document.createTextNode(" →"));
        }

        if (measureContainer) {
            measureContainer.removeChild(backCardContainer);
        }

        spellCard.backElement = backCardContainer;
        return;
    }

    return null;
}

/**
 * Renders a single spell as a printable card.
 * Holds spell data, front DOM element, and optionally a back element (for overflow).
 */
export class SpellCard {
    /**
     * @param {object} spell - Spell data object (from getSpells or cloneSpellData)
     */
    constructor(spell) {
        this.id = getNextCardId();
        this.spell = spell;
        this.frontElement = null;
        this.backElement = null;
        this.isAlwaysPrepared = false;
        this.foregroundColor = null;
        this.backgroundColor = null;
        /** When set (list spell id), card can be reset to that spell. */
        this.originalId = null;
    }

    /** Updates spell data and re-renders (used by edit overlay). */
    setSpellData(spell) {
        this.spell = spell;
    }

    /** Returns a new SpellCard with cloned spell data and a fresh id. */
    duplicate() {
        const newCard = new SpellCard(cloneSpellData(this.spell));
        newCard.originalId = this.originalId;
        return newCard;
    }

    /** Sets foregroundColor (school or grayscale) and backgroundColor (always white; earmark uses a corner triangle). */
    _updateColors() {
        if (document.body.classList.contains("grayscale")) {
            this.foregroundColor = resolveCssVariable("var(--font-color)");
        } else {
            this.foregroundColor = getSpellSchoolColor(this.spell);
        }
        this.backgroundColor = "white";
    }

    /** Sets always-prepared (earmark) state and updates the card's class and earmark triangle color. No re-render. */
    setAlwaysPrepared(isPrepared) {
        this.isAlwaysPrepared = isPrepared;
        if (this.frontElement) {
            this._updateColors();
            this.frontElement.style.setProperty("--earmark-color", this.foregroundColor);
            this.frontElement.classList.toggle("always-prepared", isPrepared);
            const earmarkBtn = this.frontElement.querySelector(".earmark-btn");
            if (earmarkBtn) {
                earmarkBtn.dataset.earmarked = String(isPrepared);
                earmarkBtn.setAttribute(
                    "variant",
                    isPrepared ? "brand" : "neutral"
                );
            }
        }
    }

    /**
     * Builds or rebuilds the card front DOM. Clears backElement.
     * When options.measureContainer is provided, runs overflow measurement so backElement is set if needed.
     * Call with measureContainer when the card will be laid out (add, edit save, duplicate, grayscale re-render).
     * @param {{ measureContainer?: HTMLElement }} [options]
     */
    async render(options = {}) {
        this._updateColors();
        const spell = this.spell;

        let card = this.frontElement;
        if (card) {
            closePopoversAndTooltipsIn(card);
            await new Promise((r) => requestAnimationFrame(r));
            removePopoversAndTooltipsIn(card);
            await new Promise((r) => requestAnimationFrame(r));
            card.innerHTML = ""; // Clear existing content for redraw
        } else {
            card = document.createElement("div");
            this.frontElement = card;
        }

        card.className = "spell-card";
        card.classList.toggle("always-prepared", this.isAlwaysPrepared);
        card.dataset.cardId = this.id;
        card.dataset.spellName = spell.name;
        card.style.backgroundColor = this.backgroundColor;
        card.style.setProperty("--earmark-color", this.foregroundColor);

        const front = document.createElement("div");
        front.className = "spell-card-front";

        const foregroundColor = this.foregroundColor;
        const backgroundColor = this.backgroundColor;

        const frontBorder = await render_front_border(
            spell,
            foregroundColor,
            backgroundColor
        );
        front.appendChild(frontBorder);

        const cardHeader = document.createElement("div");
        cardHeader.className = "card-header";
        front.appendChild(cardHeader);

        const row1 = document.createElement("div");
        row1.className = "header-row";
        const spellLevel = render_spell_level(spell, foregroundColor);
        const spellName = render_spell_name(spell);
        row1.appendChild(spellLevel);
        row1.appendChild(spellName);
        cardHeader.appendChild(row1);

        const row2 = document.createElement("div");
        row2.className = "header-row";
        row2.style.marginTop = "-5.5pt";
        row2.style.marginBottom = "2pt";
        row2.style.alignItems = "center";
        const castingTime = render_casting_time(
            spell,
            foregroundColor,
            backgroundColor
        );
        const rangeAndDuration = await render_range_and_duration(
            spell,
            foregroundColor,
            backgroundColor
        );
        row2.appendChild(castingTime);
        row2.appendChild(rangeAndDuration);
        cardHeader.appendChild(row2);

        const row3 = document.createElement("div");
        row3.className = "header-row";
        const componentIcons = await render_component_icons(
            spell,
            foregroundColor,
            backgroundColor
        );
        const componentText = await render_component_text(spell);
        row3.appendChild(componentIcons);
        row3.appendChild(componentText);
        cardHeader.appendChild(row3);

        const cardBody = document.createElement("div");
        cardBody.className = "card-body";
        front.appendChild(cardBody);

        const conditionText = await render_condition_text(spell);
        if (conditionText) {
            cardBody.appendChild(conditionText);
        }

        const descriptionText = document.createElement("div");
        descriptionText.className = "description-text";
        const spellDescription = await render_description(spell.description);
        descriptionText.appendChild(spellDescription);
        cardBody.appendChild(descriptionText);

        const higherLevelText = await render_higher_level_text(
            spell,
            foregroundColor,
            backgroundColor
        );
        if (higherLevelText) {
            cardBody.appendChild(higherLevelText);
        }

        const concentrationAndRitual = await render_concentration_and_ritual(
            spell,
            foregroundColor,
            backgroundColor
        );
        front.appendChild(concentrationAndRitual);

        const classIcons = await render_class_icons(
            spell,
            foregroundColor,
            backgroundColor
        );
        front.appendChild(classIcons);

        const spellSchool = render_spell_school(
            spell,
            foregroundColor,
            backgroundColor
        );
        front.appendChild(spellSchool);

        const spellSource = render_spell_source(spell, foregroundColor);
        front.appendChild(spellSource);

        const cardActions = document.createElement("div");
        cardActions.className = "card-actions no-print";
        cardActions.dataset.cardId = this.id;

        const cardId = this.id;
        const self = this;
        function makeIconButton(iconName, tooltip, eventName, options = {}) {
            const id = `card-action-${cardId}-${eventName}`;
            const tooltipEl = document.createElement("wa-tooltip");
            tooltipEl.setAttribute("for", id);
            tooltipEl.textContent = tooltip;
            const btn = document.createElement("wa-button");
            btn.id = id;
            btn.setAttribute("appearance", "filled");
            btn.setAttribute("variant", "neutral");
            btn.setAttribute("size", "small");
            btn.setAttribute("pill", "");
            btn.setAttribute("aria-label", tooltip);
            const icon = document.createElement("wa-icon");
            icon.setAttribute("name", iconName);
            icon.setAttribute("aria-hidden", "true");
            btn.appendChild(icon);
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                card.dispatchEvent(
                    new CustomEvent(eventName, {
                        bubbles: true,
                        detail: { cardId },
                    })
                );
            });
            if (options.toggleAccent) {
                btn.classList.add("earmark-btn");
                btn.dataset.earmarked = String(self.isAlwaysPrepared);
                if (self.isAlwaysPrepared) {
                    btn.setAttribute("variant", "brand");
                }
            }
            return { btn, tooltipEl };
        }

        const buttons = [
            makeIconButton("trash", "Delete", "card-delete"),
            makeIconButton("copy", "Duplicate", "card-duplicate"),
            makeIconButton("file", "Earmark", "card-earmark", {
                toggleAccent: true,
            }),
            makeIconButton("pen-to-square", "Edit", "card-edit"),
        ];
        if (this.spell._modified && this.originalId != null) {
            buttons.push(
                makeIconButton("download", "Download spell JSON", "card-download")
            );
            buttons.push(
                makeIconButton("arrow-rotate-left", "Reset to original", "card-reset")
            );
        }
        if (
            this.spell.name === "Knock" &&
            !this.spell._modified
        ) {
            buttons.push(
                makeIconButton("wand-magic-sparkles", "Cast", "card-cast")
            );
        }

        for (const { btn, tooltipEl } of buttons) {
            const wrap = document.createElement("div");
            wrap.className = "card-action-item";
            wrap.appendChild(tooltipEl);
            wrap.appendChild(btn);
            cardActions.appendChild(wrap);
        }
        front.appendChild(cardActions);

        card.appendChild(front);

        this.backElement = null;

        if (options.measureContainer) {
            const container = options.measureContainer;
            container.appendChild(this.frontElement);
            await handleOverflow(this, container);
            if (this.frontElement.parentNode === container) {
                container.removeChild(this.frontElement);
            }
            if (this.backElement && this.backElement.parentNode === container) {
                container.removeChild(this.backElement);
            }
        }
    }
}

/**
 * Creates the glossary reference card (front + back with icon legend).
 * Used by layout when rendering glossary refs.
 * @returns {Promise<[HTMLElement, HTMLElement]>} [frontCard, backCard]
 */
export async function createGlossaryCard() {
    const glossaryData = [
        {
            category: "Casting Time",
            items: [
                { icon: "icon-a", text: "Action" },
                { icon: "icon-b", text: "Bonus Action" },
                { icon: "icon-r", text: "Reaction" },
            ],
        },
        {
            category: "Target & Range",
            items: [
                { icon: "icon-range", text: "Generic Target" },
                { icon: "icon-range-los", text: "Target You Can See" },
                { icon: "icon-line", text: "Line" },
                { icon: "icon-cone", text: "Cone" },
                { icon: "icon-cube", text: "Cube" },
                { icon: "icon-cylinder", text: "Cylinder" },
                { icon: "icon-sphere", text: "Sphere" },
                { icon: "icon-hemisphere", text: "Hemisphere" },
                { icon: "icon-emanation", text: "Emanation" },
                { icon: "icon-circle", text: "Circle" },
                { icon: "icon-square", text: "Square" },
                { icon: "icon-wall", text: "Wall" },
            ],
        },
        {
            category: "Duration",
            items: [
                { icon: "icon-duration", text: "Timed" },
                { icon: "icon-permanent", text: "Until Dispelled" },
            ],
        },
        {
            category: "Tags",
            items: [
                { icon: "chip-c", text: "Concentration" },
                { icon: "chip-r", text: "Ritual" },
                { icon: "chip-plus", text: "At Higher Levels" },
            ],
        },
        {
            category: "Components",
            items: [
                { icon: "chip-v", text: "Verbal" },
                { icon: "chip-s", text: "Somatic" },
                { icon: "chip-m", text: "Material" },
                { icon: "chip-m-req", text: "Material with Cost" },
                { icon: "chip-m-cons", text: "Material Consumed" },
                { icon: "icon-gold", text: "Gold Pieces" },
                { icon: "icon-silver", text: "Silver Pieces" },
                { icon: "icon-copper", text: "Copper Pieces" },
            ],
        },
        {
            category: "Damage Types",
            items: [
                { icon: "icon-acid", text: "Acid" },
                { icon: "icon-bludgeoning", text: "Bludgeoning" },
                { icon: "icon-cold", text: "Cold" },
                { icon: "icon-fire", text: "Fire" },
                { icon: "icon-force", text: "Force" },
                { icon: "icon-lightning", text: "Lightning" },
                { icon: "icon-necrotic", text: "Necrotic" },
                { icon: "icon-piercing", text: "Piercing" },
                { icon: "icon-poison", text: "Poison" },
                { icon: "icon-psychic", text: "Psychic" },
                { icon: "icon-radiant", text: "Radiant" },
                { icon: "icon-slashing", text: "Slashing" },
                { icon: "icon-thunder", text: "Thunder" },
            ],
        },
        {
            category: "Classes",
            items: ALL_CLASSES.map((c) => ({
                icon: `icon-${c.toLowerCase()}`,
                text: c,
            })),
        },
    ];

    const frontCard = document.createElement("div");
    frontCard.className = "spell-card glossary-card";
    const front = document.createElement("div");
    front.className = "spell-card-front";
    frontCard.appendChild(front);

    const backCard = document.createElement("div");
    backCard.className = "spell-card glossary-card";
    const back = document.createElement("div");
    back.className = "spell-card-back";
    backCard.appendChild(back);

    const frontColumns = [
        document.createElement("div"),
        document.createElement("div"),
    ];
    frontColumns[0].className = "glossary-column";
    frontColumns[1].className = "glossary-column";
    front.appendChild(frontColumns[0]);
    front.appendChild(frontColumns[1]);

    const backColumns = [
        document.createElement("div"),
        document.createElement("div"),
    ];
    backColumns[0].className = "glossary-column";
    backColumns[1].className = "glossary-column";
    back.appendChild(backColumns[0]);
    back.appendChild(backColumns[1]);

    const iconColor = resolveCssVariable("var(--font-color)");

    const columnLayout = {
        0: [glossaryData[0], glossaryData[1]], // Casting Time, Target & Range
        1: [glossaryData[2], glossaryData[3], glossaryData[4]], // Duration, Tags, Components
        2: [glossaryData[5]], // Damage Types
        3: [glossaryData[6]], // Classes
    };

    const allColumns = [...frontColumns, ...backColumns];

    // Collect all items with their icon loading promises for parallel loading
    const allItems = [];
    for (const section of glossaryData) {
        for (const item of section.items) {
            allItems.push({
                item,
                iconPromise: load_icon(item.icon, iconColor, "white"),
            });
        }
    }
    
    // Load all icons in parallel (all HTTP requests happen simultaneously)
    const iconUrls = await Promise.all(allItems.map((entry) => entry.iconPromise));
    
    // Build DOM structure with pre-loaded icons
    let itemIndex = 0;
    for (let i = 0; i < allColumns.length; i++) {
        const column = allColumns[i];
        const sections = columnLayout[i];

        if (sections) {
            for (const section of sections) {
                const sectionDiv = document.createElement("div");
                sectionDiv.className = "glossary-section";

                const title = document.createElement("h4");
                title.textContent = section.category;
                sectionDiv.appendChild(title);

                for (const item of section.items) {
                    const itemDiv = document.createElement("div");
                    itemDiv.className = "glossary-item";

                    const icon = document.createElement("img");
                    icon.src = iconUrls[itemIndex];
                    itemDiv.appendChild(icon);

                    const text = document.createElement("span");
                    text.textContent = item.text;
                    itemDiv.appendChild(text);
                    sectionDiv.appendChild(itemDiv);
                    itemIndex++;
                }
                column.appendChild(sectionDiv);
            }
        }
    }

    return [frontCard, backCard];
}

/**
 * Creates SpellCard instances from spell data. Caller must render and layout.
 * @param {object[]} spellDataList - Array of spell objects
 * @returns {SpellCard[]}
 */
export function createCardsFromSpellDataList(spellDataList) {
    return spellDataList.map((spell) => new SpellCard(spell));
}

/**
 * Creates a glossary card reference for the card list.
 * Layout will call createGlossaryCard and attach a delete button.
 * @returns {{ type: "glossary"; id: string }}
 */
export function createGlossaryCardRef() {
    return { type: "glossary", id: getNextCardId() };
}

/**
 * True if the item is a glossary card ref (layout will render with createGlossaryCard).
 * @param {unknown} item
 * @returns {item is { type: "glossary"; id: string }}
 */
export function isGlossaryRef(item) {
    return (
        item && typeof item === "object" && item.type === "glossary" && item.id
    );
}
