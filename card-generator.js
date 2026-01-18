import { colord } from "colord";

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

export const SOURCE_MAP = {
    XPHB: "PHB'24",
    PHB: "PHB'14",
};

let spells = [];
const iconCache = {};
const spellCardInstances = new Map();

export { spellCardInstances };

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

function resolveCssVariable(cssVar) {
    const tempDiv = document.createElement("div");
    tempDiv.style.color = cssVar;
    document.body.appendChild(tempDiv);
    const computedColor = getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);
    return computedColor;
}

export function getSpellSchoolColor(spell) {
    const colorVar = schoolColorMap[spell.school];
    if (!colorVar) {
        return "black"; // Default color
    }
    return resolveCssVariable(colorVar);
}

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

export async function loadSpells(use2024Rules = true) {
    try {
        const response = await fetch("data/spells.json");
        const allSpells = await response.json();

        if (use2024Rules) {
            // Filter out spells that have been reprinted (prefer XPHB versions)
            spells = allSpells.filter(
                (spell) => spell.source === "XPHB" || 
                    !allSpells.some(s => s.name === spell.name && s.source === "XPHB")
            );
        } else {
            // Filter out XPHB spells, prefer PHB versions
            spells = allSpells.filter(
                (spell) => spell.source !== "XPHB"
            );
        }

        spells.sort((a, b) => a.name.localeCompare(b.name));

        // Build spellClassMap from spell.classes for backwards compatibility
        const spellClassMap = {};
        spells.forEach((spell, index) => {
            if (spell.classes && spell.classes.length > 0) {
                spellClassMap[index] = spell.classes;
            }
        });

        return { spells, spellClassMap };
    } catch (error) {
        console.error("Error loading spell data:", error);
        return { spells: [], spellClassMap: {} };
    }
}

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

function render_spell_name(spell) {
    const spellNameContainer = document.createElement("div");
    spellNameContainer.className = "spell-name-container";

    const spellNameElement = document.createElement("h3");
    spellNameElement.className = "spell-name";
    spellNameElement.textContent = spell.name;
    spellNameContainer.appendChild(spellNameElement);

    return spellNameContainer;
}

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

    const validAreaTypes = ["line", "cone", "cube", "cylinder", "sphere", "emanation", "hemisphere", "wall", "circle", "square"];
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
        
        const areaIconURL = await load_icon(`icon-${area}`, "white", foregroundColor);
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
        const areaText = `, ${areaDistance} ${unitAbbrev[areaUnit] || areaUnit}`;
        rangeContainer.appendChild(document.createTextNode(rangeText + areaText));
        
        const areaIconURL = await load_icon(`icon-${area}`, "white", foregroundColor);
        if (areaIconURL) {
            const areaIcon = document.createElement("img");
            areaIcon.src = areaIconURL;
            areaIcon.className = "spell-range-icon area";
            rangeContainer.appendChild(areaIcon);
        }
    }
    // Case 3: Other cases - show origin/distance as before, optionally with area icon
    else {
        let rangeText = "";
        if (origin === "self") {
            rangeText = "Self";
        } else if (origin === "touch") {
            rangeText = "Touch";
        } else if (origin === "special") {
            rangeText = "Special";
        } else if (unit === "unlimited") {
            rangeText = "Unlimited";
        } else if (distance > 0) {
            rangeText = `${distance} ${unitAbbrev[unit] || unit}`;
        } else {
            rangeText = "Self";
        }
        rangeContainer.appendChild(document.createTextNode(rangeText));

        // Add area icon if there's an area type (even without parsed dimensions)
        if (validAreaTypes.includes(area)) {
            const areaIconURL = await load_icon(`icon-${area}`, "white", foregroundColor);
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
        let durationText = `${durationAmount} ${durationUnitAbbrev[durationUnit] || durationUnit}`;
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
        "emanation": "icon-emanation",
        "line": "icon-line",
        "cone": "icon-cone",
        "cube": "icon-cube",
        "cylinder": "icon-cylinder",
        "sphere": "icon-sphere",
        "hemisphere": "icon-hemisphere",
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
            const currencyMatch = placeholder.match(/^([\d,]+\+?)\s*(gp|sp|cp)$/i);
            if (currencyMatch) {
                const amount = currencyMatch[1];
                const currency = currencyMatch[2].toLowerCase();
                const iconName = currency === "gp" ? "icon-gold" : 
                                 currency === "sp" ? "icon-silver" : "icon-copper";
                container.appendChild(document.createTextNode(amount + " "));
                const icon = document.createElement("img");
                icon.src = await load_icon(iconName, foregroundColor);
                icon.className = "inline-icon";
                const iconWrapper = document.createElement("span");
                iconWrapper.className = "inline-icon-wrapper";
                iconWrapper.appendChild(icon);
                container.appendChild(iconWrapper);
            }
            // Check if it's an icon placeholder
            else if (placeholderIcons[placeholder]) {
                const icon = document.createElement("img");
                icon.src = await load_icon(placeholderIcons[placeholder], foregroundColor);
                icon.className = "inline-icon";
                const iconWrapper = document.createElement("span");
                iconWrapper.className = "inline-icon-wrapper";
                iconWrapper.appendChild(icon);
                container.appendChild(iconWrapper);
            }
            // Check for action economy placeholders and replace with icons
            else if (placeholder === "bonus action" || placeholder === "action" || placeholder === "actions" || placeholder === "reaction" || placeholder === "reactions") {
                // Determine the action type icon
                let iconName = null;
                if (placeholder === "bonus action") {
                    iconName = "icon-b"; // Bonus action
                } else if (placeholder === "reaction" || placeholder === "reactions") {
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
                container.appendChild(iconWrapper);
            }
            // Default: render as plain text (without backticks)
            else {
                container.appendChild(document.createTextNode(matchedText.slice(1, -1)));
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

function render_spell_source(spell, foregroundColor) {
    const sourceText = document.createElement("div");
    sourceText.className = "spell-source-text";
    sourceText.textContent = SOURCE_MAP[spell.source] || spell.source;
    sourceText.style.color = foregroundColor;
    return sourceText;
}

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

    higherLevelTextContainer.appendChild(
        await process_text_for_rendering(upcast)
    );

    return higherLevelTextContainer;
}

async function render_description(description) {
    const container = document.createDocumentFragment();

    if (!description) return container;

    // Split by double newlines to get paragraphs
    const blocks = description.split(/\n\n+/);

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;

        // Check if it's a markdown table
        if (trimmedBlock.startsWith("|") && trimmedBlock.includes("| --- |")) {
            const table = await render_markdown_table(trimmedBlock);
            container.appendChild(table);
        }
        // Check if it's a markdown list
        else if (trimmedBlock.startsWith("- ")) {
            const list = await render_markdown_list(trimmedBlock);
            container.appendChild(list);
        }
        // Check if it's a named entry (starts with **Name**)
        else if (trimmedBlock.match(/^\*\*[^*]+\*\*\n/)) {
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
        }
        // Regular paragraph
        else {
            const p = document.createElement("p");
            p.appendChild(await process_text_for_rendering(trimmedBlock));
            container.appendChild(p);
        }
    }

    return container;
}

async function render_markdown_table(tableText) {
    const table = document.createElement("table");
    table.className = "spell-table";

    const lines = tableText.trim().split("\n");
    
    // Header row
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headerCells = lines[0].split("|").filter(c => c.trim());
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
        const cells = lines[i].split("|").filter(c => c.trim() !== "");
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

async function render_markdown_list(listText) {
    const ul = document.createElement("ul");
    ul.className = "spell-list";

    const items = listText.split(/\n(?=- )/);
    for (const item of items) {
        const li = document.createElement("li");
        const content = item.replace(/^- /, "").trim();
        li.appendChild(await process_text_for_rendering(content));
        ul.appendChild(li);
    }

    return ul;
}


class SpellCard {
    constructor(spell) {
        this.spell = spell;
        this.frontElement = null;
        this.backElement = null;
        this.isAlwaysPrepared = false;
        this.foregroundColor = null;
        this.backgroundColor = null;
    }

    _updateColors() {
        this.foregroundColor = getSpellSchoolColor(this.spell);
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

        card.appendChild(front);

        this.backElement = null;
    }
}

async function make_glossary_card() {
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

export async function layoutCards(cards, pageSize, addGlossary, printableArea) {
    printableArea.innerHTML = "";

    if (cards.length === 0 && !addGlossary) {
        return;
    }

    const tempCard = new SpellCard(spells[0]);
    await tempCard.render();
    printableArea.appendChild(tempCard.frontElement);
    const pxPerMm = getPxPerMm();
    const cardWidth = tempCard.frontElement.offsetWidth / pxPerMm;
    const cardHeight = tempCard.frontElement.offsetHeight / pxPerMm;
    printableArea.removeChild(tempCard.frontElement);

    const pagePadding = 10 * 2;

    const pageDimensions = {
        a4: { width: 297, height: 210 },
        letter: { width: 279.4, height: 215.9 },
    };

    const { width: pageWidth, height: pageHeight } = pageDimensions[pageSize];

    const cardsPerRow = Math.floor((pageWidth - pagePadding) / (cardWidth + 1));
    const rowsPerPage = Math.floor(
        (pageHeight - pagePadding) / (cardHeight + 1)
    );
    const maxCardsPerPage = cardsPerRow * rowsPerPage;

    const containerWidth = cardsPerRow * (cardWidth + 1) - 1;
    const containerHeight = rowsPerPage * (cardHeight + 1) - 1;

    const allCards = [];
    if (addGlossary) {
        const glossaryCards = await make_glossary_card();
        allCards.push(...glossaryCards);
    }

    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    tempContainer.style.top = "-9999px";
    printableArea.appendChild(tempContainer);

    for (const spellCard of cards) {
        tempContainer.appendChild(spellCard.frontElement);
        await handle_overflow(spellCard, tempContainer);
        tempContainer.removeChild(spellCard.frontElement);

        if (spellCard.backElement) {
            tempContainer.appendChild(spellCard.backElement);
        }
    }
    printableArea.removeChild(tempContainer);

    const allRenderedCards = [];
    for (const spellCard of cards) {
        allRenderedCards.push(spellCard.frontElement);
        if (spellCard.backElement) {
            allRenderedCards.push(spellCard.backElement);
        }
    }

    printableArea.innerHTML = "";
    let currentPage = createPage(pageSize, containerWidth, containerHeight);
    printableArea.appendChild(currentPage);
    let cardCount = 0;

    const finalLayout = [...allCards, ...allRenderedCards];

    for (const card of finalLayout) {
        if (cardCount >= maxCardsPerPage) {
            currentPage = createPage(pageSize, containerWidth, containerHeight);
            printableArea.appendChild(currentPage);
            cardCount = 0;
        }
        const cardContainer = currentPage.querySelector(".card-container");
        if (card) {
            cardContainer.appendChild(card);
        } else {
            const placeholder = document.createElement("div");
            placeholder.style.width = `${cardWidth}mm`;
            placeholder.style.height = `${cardHeight}mm`;
            cardContainer.appendChild(placeholder);
        }
        cardCount++;
    }

    const allPages = printableArea.querySelectorAll(".page");
    const minElementsPerPage = 2 * cardsPerRow;

    allPages.forEach((page) => {
        const cardContainer = page.querySelector(".card-container");
        const numElements = cardContainer.children.length;

        if (numElements > 0 && numElements < minElementsPerPage) {
            const spacersNeeded = minElementsPerPage - numElements;
            for (let i = 0; i < spacersNeeded; i++) {
                const spacer = document.createElement("div");
                spacer.className = "spell-card-spacer";
                spacer.style.width = `${cardWidth}mm`;
                spacer.style.height = `${cardHeight}mm`;
                cardContainer.appendChild(spacer);
            }
        }
    });
}

export async function generateSpellCards(spellIndices) {
    const spellsToRender = spellIndices
        .map((index) => spells[parseInt(index, 10)])
        .filter(Boolean);

    spellsToRender.sort((a, b) => {
        if (a.level !== b.level) {
            return a.level - b.level;
        }
        return a.name.localeCompare(b.name);
    });

    const currentlySelectedSpellNames = new Set(
        spellsToRender.map((s) => s.name)
    );

    for (const spellName of spellCardInstances.keys()) {
        if (!currentlySelectedSpellNames.has(spellName)) {
            spellCardInstances.delete(spellName);
        }
    }

    const cards = [];
    for (const spell of spellsToRender) {
        let spellCard = spellCardInstances.get(spell.name);
        if (!spellCard) {
            spellCard = new SpellCard(spell);
            spellCardInstances.set(spell.name, spellCard);
        }
        await spellCard.render();
        cards.push(spellCard);
    }

    return cards;
}

function createPage(pageSize, containerWidth, containerHeight) {
    const page = document.createElement("div");
    page.className = "page";
    if (pageSize === "letter") {
        page.classList.add("page-letter");
    }

    const pageContent = document.createElement("div");
    pageContent.className = "page-content";
    page.appendChild(pageContent);

    const cardContainer = document.createElement("div");
    cardContainer.className = "card-container";
    cardContainer.style.width = `${containerWidth}mm`;
    cardContainer.style.height = `${containerHeight}mm`;

    // Add cutting marks overlay
    const cuttingMarks = createCuttingMarks(containerWidth, containerHeight);
    pageContent.appendChild(cuttingMarks);

    pageContent.appendChild(cardContainer);
    return page;
}

function createCuttingMarks(containerWidth, containerHeight) {
    const marksContainer = document.createElement("div");
    marksContainer.className = "cutting-marks";
    marksContainer.style.width = `${containerWidth}mm`;
    marksContainer.style.height = `${containerHeight}mm`;

    const cardWidth = 63; // mm
    const cardHeight = 88; // mm
    const markLength = 3; // mm
    const markThickness = 0.3; // mm
    const margin = 1; // mm

    const cols = Math.floor(containerWidth / cardWidth);
    const rows = Math.floor(containerHeight / cardHeight);

    // Create marks at each grid intersection
    for (let row = 0; row <= rows; row++) {
        for (let col = 0; col <= cols; col++) {
            const x = col * cardWidth;
            const y = row * cardHeight;

            // Vertical mark above the intersection (top edge marks)
            if (row === 0) {
                const vMarkTop = document.createElement("div");
                vMarkTop.className = "cut-mark cut-mark-v";
                vMarkTop.style.left = `${x - markThickness / 2}mm`;
                vMarkTop.style.top = `-${markLength + margin}mm`;
                vMarkTop.style.width = `${markThickness}mm`;
                vMarkTop.style.height = `${markLength}mm`;
                marksContainer.appendChild(vMarkTop);
            }

            // Vertical mark below the intersection (bottom edge marks)
            if (row === rows) {
                const vMarkBottom = document.createElement("div");
                vMarkBottom.className = "cut-mark cut-mark-v";
                vMarkBottom.style.left = `${x - markThickness / 2}mm`;
                vMarkBottom.style.top = `${y + margin}mm`;
                vMarkBottom.style.width = `${markThickness}mm`;
                vMarkBottom.style.height = `${markLength}mm`;
                marksContainer.appendChild(vMarkBottom);
            }

            // Horizontal mark to the left of the intersection (left edge marks)
            if (col === 0) {
                const hMarkLeft = document.createElement("div");
                hMarkLeft.className = "cut-mark cut-mark-h";
                hMarkLeft.style.left = `-${markLength + margin}mm`;
                hMarkLeft.style.top = `${y - markThickness / 2}mm`;
                hMarkLeft.style.width = `${markLength}mm`;
                hMarkLeft.style.height = `${markThickness}mm`;
                marksContainer.appendChild(hMarkLeft);
            }

            // Horizontal mark to the right of the intersection (right edge marks)
            if (col === cols) {
                const hMarkRight = document.createElement("div");
                hMarkRight.className = "cut-mark cut-mark-h";
                hMarkRight.style.left = `${x + margin}mm`;
                hMarkRight.style.top = `${y - markThickness / 2}mm`;
                hMarkRight.style.width = `${markLength}mm`;
                hMarkRight.style.height = `${markThickness}mm`;
                marksContainer.appendChild(hMarkRight);
            }
        }
    }

    return marksContainer;
}

function getPxPerMm() {
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.top = "-9999px";
    div.style.left = "-9999px";
    div.style.width = "1mm";
    document.body.appendChild(div);
    const pxPerMm = div.getBoundingClientRect().width;
    document.body.removeChild(div);
    return pxPerMm;
}

async function handle_overflow(spellCard, tempContainer, fontLevel = 0) {
    const card = spellCard.frontElement;
    const spell = spellCard.spell;
    const cardBody = card.querySelector(".card-body");
    const descriptionText = card.querySelector(".description-text");

    if (!cardBody || !descriptionText) {
        return null;
    }

    const componentText = card.querySelector(".spell-component-text");

    function is_overflowing(element) {
        return element.scrollHeight > element.clientHeight;
    }

    if (is_overflowing(descriptionText)) {
        if (fontLevel === 0) {
            cardBody.style.fontSize = "6pt";
            cardBody.style.lineHeight = "6pt";
            componentText.style.fontSize = "6pt";
            componentText.style.lineHeight = "6pt";

            if (is_overflowing(descriptionText)) {
                cardBody.style.fontSize = "";
                cardBody.style.lineHeight = "";
                componentText.style.fontSize = "";
                componentText.style.lineHeight = "";
            } else {
                return null;
            }
        }

        const backCardContainer = document.createElement("div");
        backCardContainer.className = "spell-card";
        backCardContainer.dataset.spellName = spell.name;
        backCardContainer.style.backgroundColor = spellCard.backgroundColor;

        const back = document.createElement("div");
        back.className = "spell-card-back";

        const backCardBody = document.createElement("div");
        backCardBody.className = "card-body back";
        backCardBody.style.borderColor = getSpellSchoolColor(spell);
        back.appendChild(backCardBody);

        const backDescriptionText = document.createElement("div");
        backDescriptionText.className = "description-text";
        backCardBody.appendChild(backDescriptionText);

        backCardContainer.appendChild(back);

        if (tempContainer) {
            tempContainer.appendChild(backCardContainer);
        }

        if (fontLevel > 0) {
            const fontSize = fontLevel === 1 ? "6pt" : "5.5pt";
            const frontCardBody = card.querySelector(".card-body");
            frontCardBody.style.fontSize = fontSize;
            frontCardBody.style.lineHeight = fontSize;
            componentText.style.fontSize = fontSize;
            componentText.style.lineHeight = fontSize;
            backCardBody.style.fontSize = fontSize;
            backCardBody.style.lineHeight = fontSize;
        }

        const descriptionElements = Array.from(descriptionText.children);

        while (
            is_overflowing(descriptionText) &&
            descriptionElements.length > 0
        ) {
            const elementToMove = descriptionElements.pop();
            backDescriptionText.prepend(elementToMove);
        }

        if (is_overflowing(backCardBody) && fontLevel < 2) {
            const backElements = Array.from(backDescriptionText.children);
            for (const elementToMove of backElements) {
                descriptionText.appendChild(elementToMove);
            }

            if (tempContainer) {
                tempContainer.removeChild(backCardContainer);
            }

            return await handle_overflow(
                spellCard,
                tempContainer,
                fontLevel + 1
            );
        }

        const lastParagraph = descriptionText.querySelector("p:last-of-type");
        if (lastParagraph) {
            lastParagraph.appendChild(document.createTextNode(" →"));
        }

        if (tempContainer) {
            tempContainer.removeChild(backCardContainer);
        }

        spellCard.backElement = backCardContainer;
        return;
    }

    return null;
}
