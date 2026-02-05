/**
 * spell-card.js – Spell card rendering and spell data.
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
        name: "Custom Spell",
        subtitle: "",
        source: "Homebrew",
        page: 0,
        isSRD: false,
        level: 0,
        school: "Evocation",
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
            targets: 1,
        },
        components: {
            v: true,
            s: true,
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
 * Loads an SVG from assets/, swaps #333333/#ffffff with given colors, caches and returns a data URL.
 * @param {string} iconName - Filename without .svg (e.g. "icon-fire")
 * @param {string} [foregroundColor] - Color for #333333
 * @param {string} [backgroundColor] - Color for #ffffff
 * @returns {Promise<string|null>}
 */
export async function load_icon(
    iconName,
    foregroundColor = "#333333",
    backgroundColor = "white"
) {
    const cacheKey = `${iconName}-${foregroundColor}-${backgroundColor}`;
    if (iconCache[cacheKey]) {
        return iconCache[cacheKey];
    }

    try {
        const response = await fetch(`assets/${iconName}.svg`);
        let svgText = await response.text();
        svgText = svgText.replace(/#333333/g, foregroundColor);
        svgText = svgText.replace(/#ffffff/g, backgroundColor);
        const dataUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;
        iconCache[cacheKey] = dataUrl;
        return dataUrl;
    } catch (error) {
        console.error(`Error loading icon: ${iconName}`, error);
        return null;
    }
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
    outerCircle.style.borderColor = computedColor;
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

/** Renders the spell name heading. */
function render_spell_name(spell) {
    const spellNameContainer = document.createElement("div");
    spellNameContainer.className = "spell-name-container";

    const spellNameElement = document.createElement("h3");
    spellNameElement.className = "spell-name";
    spellNameElement.textContent = spell.name;
    spellNameContainer.appendChild(spellNameElement);

    return spellNameContainer;
}

/** Renders the casting time chip (e.g. A for action, 1 min). */
function render_casting_time(spell, foregroundColor, backgroundColor) {
    const castingTimeWrapper = document.createElement("div");
    castingTimeWrapper.className = "casting-time-container";

    const castingTimeContainer = document.createElement("div");
    castingTimeContainer.className = "spell-casting-time";
    castingTimeContainer.style.backgroundColor = foregroundColor;
    castingTimeContainer.style.borderColor = backgroundColor;
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
        "emanation",
        "hemisphere",
        "wall",
        "circle",
        "square",
    ];
    const hasArea = validAreaTypes.includes(area) && areaDistance > 0;
    const unitAbbrev = { feet: "ft", miles: "mi" };

    const iconName = range.requiresSight ? "icon-range-los-inv" : "icon-range";
    const iconUrl = await load_icon(iconName, "white", foregroundColor);
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
    // Case 2: Point with distance and area - show range, then area size and icon
    else if (origin === "point" && distance > 0 && hasArea) {
        const rangeText = `${distance} ${unitAbbrev[unit] || unit}`;
        const areaText = `, ${areaDistance} ${
            unitAbbrev[areaUnit] || areaUnit
        }`;
        rangeContainer.appendChild(
            document.createTextNode(rangeText + areaText)
        );

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
    const iconUrl = await load_icon(iconName, "white", foregroundColor);
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

            // Check if it's a currency placeholder (e.g., "100 gp")
            const currencyMatch = placeholder.match(
                /^([\d,]+\+?)\s*(gp|sp|cp)$/i
            );
            if (currencyMatch) {
                const amount = currencyMatch[1];
                const currency = currencyMatch[2].toLowerCase();
                const iconName =
                    currency === "gp"
                        ? "icon-gold"
                        : currency === "sp"
                        ? "icon-silver"
                        : "icon-copper";
                container.appendChild(document.createTextNode(amount + " "));
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
            // Check if it's an icon placeholder
            else if (placeholderIcons[placeholder]) {
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
    if (components.m && components.description) {
        const materialText = components.description;
        const materialTextElement = document.createElement("span");
        materialTextElement.appendChild(
            await process_text_for_rendering(
                materialText[0].toUpperCase() + materialText.slice(1) + ".",
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

/** Renders the spell source label (e.g. PHB'24). */
function render_spell_source(spell, foregroundColor) {
    const sourceText = document.createElement("div");
    sourceText.className = "spell-source-text";
    sourceText.textContent = SOURCE_MAP[spell.source] || spell.source;
    sourceText.style.color = foregroundColor;
    return sourceText;
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

/** Renders casting time condition text if present. */
async function render_condition_text(spell) {
    let conditionText = spell.time.condition;
    if (conditionText) {
        conditionText = conditionText.replace(/which you take/g, "").trim();
        conditionText =
            conditionText[0].toUpperCase() + conditionText.slice(1) + ".";
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
        } else if (trimmedBlock.startsWith("- ")) {
            const list = await render_markdown_list(trimmedBlock);
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
    line.style.borderColor = foregroundColor;
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

/** Parses markdown list syntax (- item) into a ul element. */
async function render_markdown_list(listText) {
    const ul = document.createElement("ul");
    ul.className = "spell-description-list";

    const items = listText.split(/\n(?=- )/);
    for (const item of items) {
        const li = document.createElement("li");
        const content = item.replace(/^- /, "").trim();
        li.appendChild(await process_text_for_rendering(content));
        ul.appendChild(li);
    }

    return ul;
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

    /** Sets foregroundColor (school or grayscale) and backgroundColor (prepared highlight). */
    _updateColors() {
        if (document.body.classList.contains("grayscale")) {
            this.foregroundColor = resolveCssVariable("var(--font-color)");
        } else {
            this.foregroundColor = getSpellSchoolColor(this.spell);
        }
        if (this.isAlwaysPrepared) {
            const hslColor = colord(this.foregroundColor).toHsl();
            hslColor.l = 90;
            this.backgroundColor = colord(hslColor).toRgbString();
        } else {
            this.backgroundColor = "white";
        }
    }

    async setAlwaysPrepared(isPrepared) {
        this.isAlwaysPrepared = isPrepared;
        await this.render();
    }

    /** Builds or rebuilds the card front DOM. Clears backElement; layout may add a back later. */
    async render() {
        this._updateColors();
        const spell = this.spell;

        let card = this.frontElement;
        if (card) {
            card.innerHTML = ""; // Clear existing content for redraw
        } else {
            card = document.createElement("div");
            this.frontElement = card;
        }

        card.className = "spell-card";
        card.dataset.cardId = this.id;
        card.dataset.spellName = spell.name;
        card.style.backgroundColor = this.backgroundColor;

        const front = document.createElement("div");
        front.className = "spell-card-front";

        const tooltip = document.createElement("sl-tooltip");
        tooltip.content = "Always prepared";

        const preparedCheckboxContainer = document.createElement("div");
        preparedCheckboxContainer.className = "prepared-checkbox-container";
        const preparedCheckbox = document.createElement("sl-checkbox");
        preparedCheckbox.className = "prepared-checkbox";
        preparedCheckbox.checked = this.isAlwaysPrepared;

        tooltip.appendChild(preparedCheckbox);
        preparedCheckboxContainer.appendChild(tooltip);
        front.appendChild(preparedCheckboxContainer);

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
        row2.style.marginTop = "-7pt";
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

        const deleteBtn = document.createElement("sl-icon-button");
        deleteBtn.name = "trash";
        deleteBtn.title = "Delete card";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            card.dispatchEvent(
                new CustomEvent("card-delete", {
                    bubbles: true,
                    detail: { cardId: this.id },
                })
            );
        });

        const duplicateBtn = document.createElement("sl-icon-button");
        duplicateBtn.name = "files";
        duplicateBtn.title = "Duplicate card";
        duplicateBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            card.dispatchEvent(
                new CustomEvent("card-duplicate", {
                    bubbles: true,
                    detail: { cardId: this.id },
                })
            );
        });

        const editBtn = document.createElement("sl-icon-button");
        editBtn.name = "pencil-square";
        editBtn.title = "Edit card";
        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            card.dispatchEvent(
                new CustomEvent("card-edit", {
                    bubbles: true,
                    detail: { cardId: this.id },
                })
            );
        });

        cardActions.appendChild(deleteBtn);
        cardActions.appendChild(duplicateBtn);
        if (this.spell._modified && this.originalId != null) {
            const resetBtn = document.createElement("sl-icon-button");
            resetBtn.name = "arrow-counterclockwise";
            resetBtn.title = "Reset to original";
            resetBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                card.dispatchEvent(
                    new CustomEvent("card-reset", {
                        bubbles: true,
                        detail: { cardId: this.id },
                    })
                );
            });
            cardActions.appendChild(resetBtn);
        }
        cardActions.appendChild(editBtn);
        front.appendChild(cardActions);

        card.appendChild(front);

        this.backElement = null;
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
                { icon: "icon-emanation", text: "Emanation" },
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
        0: [glossaryData[0], glossaryData[1], glossaryData[2]],
        1: [glossaryData[3], glossaryData[4]],
        2: [glossaryData[5]],
        3: [glossaryData[6]],
    };

    const allColumns = [...frontColumns, ...backColumns];

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
                    icon.src = await load_icon(item.icon, iconColor, "white");
                    itemDiv.appendChild(icon);

                    const text = document.createElement("span");
                    text.textContent = item.text;
                    itemDiv.appendChild(text);
                    sectionDiv.appendChild(itemDiv);
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
