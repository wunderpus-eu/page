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

let spells = [];
let spellSources = {};
let spellClassMap = {};
const iconCache = {};

export const schoolColorMap = {
    A: "var(--abjuration-color)",
    C: "var(--conjuration-color)",
    D: "var(--divination-color)",
    E: "var(--enchantment-color)",
    V: "var(--evocation-color)",
    I: "var(--illusion-color)",
    N: "var(--necromancy-color)",
    T: "var(--transmutation-color)",
};

export function compute_color(spell) {
    const colorVar = schoolColorMap[spell.school];
    if (!colorVar) {
        return "black"; // Default color
    }
    const tempDiv = document.createElement("div");
    tempDiv.style.backgroundColor = colorVar;
    document.body.appendChild(tempDiv);
    const computedColor = getComputedStyle(tempDiv).backgroundColor;
    document.body.removeChild(tempDiv);
    return computedColor;
}

async function render_front_border(spell, computedColor) {
    const frontBorderContainer = document.createElement("div");
    frontBorderContainer.className = "spell-card-front-border";

    const frontBorder = document.createElement("img");
    frontBorder.src = await load_icon("border-front", computedColor, "white");
    frontBorderContainer.appendChild(frontBorder);

    return frontBorderContainer;
}

export function get_color_from_css_variable(cssVar) {
    const tempDiv = document.createElement("div");
    tempDiv.style.color = cssVar;
    document.body.appendChild(tempDiv);
    const computedColor = getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);
    return computedColor;
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

export async function loadSpells() {
    try {
        const [spellsResponse, sourcesResponse] = await Promise.all([
            fetch("spells-xphb.json"),
            fetch("sources.json"),
        ]);
        const spellsData = await spellsResponse.json();
        const sourcesData = await sourcesResponse.json();
        spells = spellsData.spell;
        spellSources = sourcesData.XPHB;

        buildSpellClassMap();

        return { spells, spellClassMap };
    } catch (error) {
        console.error("Error loading spell data:", error);
        return { spells: [], spellClassMap: {} };
    }
}

function buildSpellClassMap() {
    spells.forEach((spell, index) => {
        const sourceInfo = spellSources[spell.name];
        if (sourceInfo && sourceInfo.class) {
            const validClasses = sourceInfo.class
                .filter((c) => c.source === "XPHB" || c.source === "TCE")
                .map((c) => c.name);
            if (validClasses.length > 0) {
                spellClassMap[index] = validClasses;
            }
        }
    });
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

function render_casting_time(spell, computedColor) {
    const castingTimeWrapper = document.createElement("div");
    castingTimeWrapper.className = "casting-time-container";

    const castingTimeContainer = document.createElement("div");
    castingTimeContainer.className = "spell-casting-time";
    castingTimeContainer.style.backgroundColor = computedColor;
    castingTimeWrapper.appendChild(castingTimeContainer);

    if (spell.time) {
        const time = spell.time[0];
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

async function render_range(spell, computedColor) {
    const rangeContainer = document.createElement("div");
    rangeContainer.className = "spell-range";

    rangeContainer.style.backgroundColor = computedColor;

    const rangeType = spell.range.type;
    const rangeDistType = spell.range.distance.type;
    const rangeDistNumber = spell.range.distance.amount || "";
    const tags = spell.miscTags || [];

    const iconName = tags.includes("SGT") ? "icon-range-los-inv" : "icon-range";
    const iconUrl = await load_icon(iconName, "white", computedColor);
    if (iconUrl) {
        const icon = document.createElement("img");
        icon.src = iconUrl;
        icon.className = "spell-range-icon";
        rangeContainer.appendChild(icon);
    }

    let rangeText = "";
    if (["self", "touch"].includes(rangeDistType)) {
        rangeText = rangeDistType[0].toUpperCase() + rangeDistType.slice(1);
    } else {
        const rangeDistAbbrev = {
            feet: "ft",
        };
        rangeText = `${rangeDistNumber} ${
            rangeDistAbbrev[rangeDistType] || rangeDistType
        }`;
    }
    const rangeTextNode = document.createTextNode(rangeText);
    rangeContainer.appendChild(rangeTextNode);

    if (
        ["line", "cone", "cube", "cylinder", "sphere", "emanation"].includes(
            rangeType
        )
    ) {
        const areaIconURL = await load_icon(
            `icon-${rangeType}`,
            "white",
            computedColor
        );
        if (areaIconURL) {
            const areaIcon = document.createElement("img");
            areaIcon.src = areaIconURL;
            areaIcon.className = "spell-range-icon area";
            rangeContainer.appendChild(areaIcon);
        }
    }

    return rangeContainer;
}

async function render_duration(spell, computedColor) {
    const durationContainer = document.createElement("div");
    durationContainer.className = "spell-duration";

    durationContainer.style.backgroundColor = computedColor;

    const durationType = spell.duration[0].type;
    const durationTimeType = spell.duration[0].duration?.type || "";
    const durationTimeNumber = spell.duration[0].duration?.amount || "";

    if (["instant", "special"].includes(durationType)) {
        return null;
    }

    const iconName =
        durationType === "timed" ? "icon-duration" : "icon-permanent";
    const iconUrl = await load_icon(iconName, "white", computedColor);
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
        let durationText = `${durationTimeNumber} ${durationUnitAbbrev[durationTimeType]}`;
        const durationSpan = document.createElement("span");
        durationSpan.textContent = durationText;
        durationContainer.appendChild(durationSpan);
    } else {
        const ends = spell.duration[0].ends;
        if (ends.includes("trigger")) {
            const durationSpan = document.createElement("span");
            durationSpan.textContent = "or Triggered";
            durationContainer.appendChild(durationSpan);
        }
    }

    return durationContainer;
}

async function render_range_and_duration(spell, computedColor) {
    const rangeAndDurationContainer = document.createElement("div");
    rangeAndDurationContainer.className = "spell-range-and-duration";

    if (spell.range) {
        const range = await render_range(spell, computedColor);
        rangeAndDurationContainer.appendChild(range);
    }
    if (spell.duration) {
        const duration = await render_duration(spell, computedColor);
        if (duration) {
            rangeAndDurationContainer.appendChild(duration);
        }
    }

    return rangeAndDurationContainer;
}

async function render_component_icons(spell, computedColor) {
    const componentIconsContainer = document.createElement("div");
    componentIconsContainer.className = "spell-component-icons";

    const components = spell.components;
    if (components.v) {
        const verbalIcon = document.createElement("img");
        verbalIcon.src = await load_icon("chip-v", computedColor, "white");
        componentIconsContainer.appendChild(verbalIcon);
    }
    if (components.s) {
        const somaticIcon = document.createElement("img");
        somaticIcon.src = await load_icon("chip-s", computedColor, "white");
        componentIconsContainer.appendChild(somaticIcon);
    }
    if (components.m) {
        const materialIcon = document.createElement("img");
        let icon_name = "chip-m";
        if (typeof components.m === "object") {
            icon_name = "chip-m-req";
            if (components.m.consume) {
                icon_name = "chip-m-cons";
            }
        }
        materialIcon.src = await load_icon(icon_name, computedColor, "white");
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

    const foregroundColor = get_color_from_css_variable(foregroundColorVar);

    const abbreviations = {
        feet: "ft",
        foot: "ft",
        minute: "min",
        minutes: "min",
        hour: "h",
        hours: "h",
    };

    const icons = {
        action: "icon-a",
        cp: "icon-copper",
        sp: "icon-silver",
        gp: "icon-gold",
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
        "{@variantrule Emanation [Area of Effect]|XPHB|Emanation}":
            "icon-emanation",
        "{@variantrule Line [Area of Effect]|XPHB|Line}": "icon-line",
        "{@variantrule Cone [Area of Effect]|XPHB|Cone}": "icon-cone",
        "{@variantrule Cube [Area of Effect]|XPHB|Cube}": "icon-cube",
        "{@variantrule Cylinder [Area of Effect]|XPHB|Cylinder}":
            "icon-cylinder",
        "{@variantrule Sphere [Area of Effect]|XPHB|Sphere}": "icon-sphere",
        "{@variantrule Action|XPHB}": "icon-a",
        "{@variantrule Bonus Action|XPHB}": "icon-b",
        "{@variantrule Reaction|XPHB}": "icon-r",
    };

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    const wordKeys = [...Object.keys(abbreviations)];
    const tagKeys = [];

    for (const key of Object.keys(icons)) {
        if (key.startsWith("{@")) {
            tagKeys.push(key);
        } else {
            wordKeys.push(key);
        }
    }

    const diceTags = ["damage", "dice", "scaledamage", "scaledice"];
    const chanceTag = "chance";
    const actionTag = "action";
    const filterTag = "filter";

    const wordRegexPart = `(?<!course of )\\b(${wordKeys.join("|")})\\b`;

    const iconTagRegexPart =
        tagKeys.length > 0 ? `|(${tagKeys.map(escapeRegExp).join("|")})` : "";

    const diceRegexPart = `|({@(?:${diceTags.join("|")})\\s[^}]+})`;
    const chanceRegexPart = `|({@${chanceTag}\\s[^}]+})`;
    const actionRegexPart = `|({@${actionTag}\\s[^}]+}(?:\\s*action)?)`;
    const filterRegexPart = `|({@${filterTag}\\s[^}]+})`;
    const genericTagRegexPart = `|({@[^}]+})`;

    const regex = new RegExp(
        `${wordRegexPart}${iconTagRegexPart}${diceRegexPart}${chanceRegexPart}${actionRegexPart}${filterRegexPart}${genericTagRegexPart}`,
        "gi"
    );

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            container.appendChild(
                document.createTextNode(text.substring(lastIndex, match.index))
            );
        }

        const matchedText = match[0];

        if (match[1]) {
            const matchedWordLower = matchedText.toLowerCase();
            if (abbreviations[matchedWordLower]) {
                container.appendChild(
                    document.createTextNode(abbreviations[matchedWordLower])
                );
            } else if (icons[matchedWordLower]) {
                const icon = document.createElement("img");
                icon.src = await load_icon(
                    icons[matchedWordLower],
                    foregroundColor
                );
                icon.className = "inline-icon";
                const iconWrapper = document.createElement("span");
                iconWrapper.className = "inline-icon-wrapper";
                iconWrapper.appendChild(icon);
                container.appendChild(iconWrapper);
            }
        } else if (match[2]) {
            const icon = document.createElement("img");
            icon.src = await load_icon(icons[matchedText], foregroundColor);
            icon.className = "inline-icon";
            const iconWrapper = document.createElement("span");
            iconWrapper.className = "inline-icon-wrapper";
            iconWrapper.appendChild(icon);
            container.appendChild(iconWrapper);
        } else if (match[3]) {
            const innerContent = matchedText.substring(
                2,
                matchedText.length - 1
            );
            const firstSpaceIndex = innerContent.indexOf(" ");
            const formula = innerContent
                .substring(firstSpaceIndex + 1)
                .split("|")
                .pop()
                .trim();
            const span = document.createElement("span");
            span.className = "dice-formula";
            span.textContent = formula;
            container.appendChild(span);
        } else if (match[4]) {
            const innerContent = matchedText.substring(
                2,
                matchedText.length - 1
            );
            const firstSpaceIndex = innerContent.indexOf(" ");
            const value = innerContent
                .substring(firstSpaceIndex + 1)
                .split("|")[0]
                .trim();
            container.appendChild(document.createTextNode(`${value}%`));
        } else if (match[5]) {
            const actionTagMatch = matchedText.match(/{@action\s([^|}]+)/);
            const actionText = actionTagMatch ? actionTagMatch[1].trim() : "";

            if (actionText) {
                container.appendChild(
                    document.createTextNode(actionText + " ")
                );
            }

            const icon = document.createElement("img");
            icon.src = await load_icon("icon-a", foregroundColor);
            icon.className = "inline-icon";
            const iconWrapper = document.createElement("span");
            iconWrapper.className = "inline-icon-wrapper";
            iconWrapper.appendChild(icon);
            container.appendChild(iconWrapper);
        } else if (match[6]) {
            const innerContent = matchedText.substring(
                2,
                matchedText.length - 1
            );
            const firstSpaceIndex = innerContent.indexOf(" ");
            const contentAfterTag = innerContent.substring(firstSpaceIndex + 1);
            const textToRender = contentAfterTag.split("|")[0].trim();
            container.appendChild(document.createTextNode(textToRender));
        } else if (match[7]) {
            const innerContent = matchedText.substring(
                2,
                matchedText.length - 1
            );
            const parts = innerContent.split("|");
            let textToRender;

            if (parts.length >= 3) {
                textToRender = parts[parts.length - 1].trim();
            } else if (parts.length === 2) {
                const firstPart = parts[0];
                const firstSpaceIndex = firstPart.indexOf(" ");
                textToRender = firstPart.substring(firstSpaceIndex + 1).trim();
            } else {
                const firstSpaceIndex = innerContent.indexOf(" ");
                textToRender =
                    firstSpaceIndex !== -1
                        ? innerContent.substring(firstSpaceIndex + 1).trim()
                        : "";
            }
            container.appendChild(document.createTextNode(textToRender));
        }

        lastIndex = regex.lastIndex;
    }

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
    if (components.m) {
        let materialText = "";
        if (typeof components.m === "string") {
            materialText = components.m;
        } else {
            materialText = components.m.text;
        }
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

async function render_concentration_and_ritual(spell, computedColor) {
    const concentrationAndRitualContainer = document.createElement("div");
    concentrationAndRitualContainer.className =
        "spell-concentration-and-ritual";

    if (spell.duration[0].concentration) {
        const concentrationIcon = document.createElement("img");
        concentrationIcon.src = await load_icon(
            "chip-c",
            computedColor,
            "white"
        );
        concentrationAndRitualContainer.appendChild(concentrationIcon);
    }
    if (spell.meta?.ritual) {
        const ritualIcon = document.createElement("img");
        ritualIcon.src = await load_icon("chip-r", computedColor, "white");
        concentrationAndRitualContainer.appendChild(ritualIcon);
    }

    return concentrationAndRitualContainer;
}

async function render_class_icons(spell, computedColor) {
    const classIconsContainer = document.createElement("div");
    classIconsContainer.className = "spell-class-icons";

    const sourceInfo = spellSources[spell.name];
    let uniqueClasses = [];
    if (sourceInfo && sourceInfo.class) {
        const validClasses = sourceInfo.class
            .filter((c) => c.source === "XPHB" || c.source === "TCE")
            .map((c) => c.name);

        uniqueClasses = [...new Set(validClasses)];
    }

    for (const className of ALL_CLASSES) {
        const classIcon = document.createElement("img");
        const isPresent = uniqueClasses.includes(className);
        const color = isPresent ? computedColor : "#d4d4d4";
        classIcon.src = await load_icon(
            `icon-${className.toLowerCase()}`,
            color,
            "white"
        );
        classIconsContainer.appendChild(classIcon);
    }

    return classIconsContainer;
}

function render_spell_source(spell, computedColor) {
    const sourceText = document.createElement("div");
    sourceText.className = "spell-source-text";
    sourceText.textContent = spell.source === "XPHB" ? "PHB'24" : spell.source;
    sourceText.style.color = computedColor;
    return sourceText;
}

function render_spell_school(spell, computedColor) {
    const spellSchoolContainer = document.createElement("div");
    spellSchoolContainer.className = "spell-school-container";

    const spellSchool = document.createElement("div");
    spellSchool.className = "spell-school";
    spellSchool.style.color = computedColor;

    const schoolNameMap = {
        A: "Abjuration",
        C: "Conjuration",
        D: "Divination",
        E: "Enchantment",
        V: "Evocation",
        I: "Illusion",
        N: "Necromancy",
        T: "Transmutation",
    };
    const schoolName = schoolNameMap[spell.school];
    for (const char of schoolName) {
        const span = document.createElement("span");
        span.textContent = char;
        spellSchool.appendChild(span);
    }
    spellSchoolContainer.appendChild(spellSchool);
    return spellSchoolContainer;
}

async function render_condition_text(spell) {
    let conditionText = spell.time[0].condition;
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

async function render_higher_level_text(spell, computedColor) {
    const higherLevel = spell.entriesHigherLevel;
    if (!higherLevel) {
        return null;
    }

    const higherLevelTextContainer = document.createElement("div");
    higherLevelTextContainer.className = "spell-higher-level-text";

    const line = document.createElement("div");
    line.className = "higher-level-line";
    line.style.borderColor = computedColor;
    higherLevelTextContainer.appendChild(line);

    const circle = document.createElement("img");
    circle.src = await load_icon("chip-plus", computedColor, "white");
    circle.className = "higher-level-circle";
    higherLevelTextContainer.appendChild(circle);

    const plus = document.createElement("span");
    plus.className = "higher-level-plus";
    plus.textContent = "+";
    circle.appendChild(plus);

    higherLevelTextContainer.appendChild(
        await process_text_for_rendering(higherLevel[0].entries[0])
    );

    return higherLevelTextContainer;
}

async function render_entries(entries, entryName = "") {
    const container = document.createDocumentFragment();

    for (const entry of entries) {
        if (typeof entry === "string") {
            const p = document.createElement("p");
            if (entryName) {
                const nameSpan = document.createElement("span");
                nameSpan.className = "spell-entry-name";
                nameSpan.textContent = entryName;
                p.appendChild(nameSpan);
                entryName = "";
            }
            p.appendChild(await process_text_for_rendering(entry));
            container.appendChild(p);
        } else if (entry.type === "table") {
            const table = await render_table(entry);
            container.appendChild(table);
        } else if (entry.type === "list") {
            const list = await render_list(entry);
            container.appendChild(list);
        } else if (entry.type === "entries") {
            const nestedEntries = await render_entries(
                entry.entries,
                entry.name || ""
            );
            container.appendChild(nestedEntries);
        }
    }

    return container;
}

async function render_table(tableData) {
    const table = document.createElement("table");
    table.className = "spell-table";

    if (tableData.caption) {
        const caption = document.createElement("caption");
        caption.textContent = tableData.caption;
        table.appendChild(caption);
    }

    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const colLabel of tableData.colLabels) {
        const th = document.createElement("th");
        th.textContent = colLabel;
        tr.appendChild(th);
    }
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const rowData of tableData.rows) {
        const tr = document.createElement("tr");
        for (const cellData of rowData) {
            const td = document.createElement("td");
            td.appendChild(await process_text_for_rendering(cellData));
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    return table;
}

async function render_list(listData) {
    if (listData.style === "list-hang-notitle") {
        const container = document.createDocumentFragment();
        for (const item of listData.items) {
            const p = document.createElement("p");
            p.className = "spell-list-hang-item";

            const term = document.createElement("span");
            term.className = "spell-list-hang-term";
            term.textContent = item.name;
            p.appendChild(term);

            const description = item.entries.join(" ");
            p.appendChild(await process_text_for_rendering(description));
            container.appendChild(p);
        }
        return container;
    } else {
        const ul = document.createElement("ul");
        ul.className = "spell-list";
        for (const item of listData.items) {
            const li = document.createElement("li");
            if (typeof item === "string") {
                li.appendChild(await process_text_for_rendering(item));
            } else {
                const nestedEntries = await render_entries(item.entries);
                li.appendChild(nestedEntries);
            }
            ul.appendChild(li);
        }
        return ul;
    }
}

async function make_spell_card(spell) {
    const card = document.createElement("div");
    card.className = "spell-card";

    const front = document.createElement("div");
    front.className = "spell-card-front";

    const computedColor = compute_color(spell);

    const frontBorder = await render_front_border(spell, computedColor);
    front.appendChild(frontBorder);

    const cardHeader = document.createElement("div");
    cardHeader.className = "card-header";
    front.appendChild(cardHeader);

    const row1 = document.createElement("div");
    row1.className = "header-row";
    const spellLevel = render_spell_level(spell, computedColor);
    const spellName = render_spell_name(spell);
    row1.appendChild(spellLevel);
    row1.appendChild(spellName);
    cardHeader.appendChild(row1);

    const row2 = document.createElement("div");
    row2.className = "header-row";
    row2.style.marginTop = "-7pt";
    row2.style.marginBottom = "2pt";
    row2.style.alignItems = "center";
    const castingTime = render_casting_time(spell, computedColor);
    const rangeAndDuration = await render_range_and_duration(
        spell,
        computedColor
    );
    row2.appendChild(castingTime);
    row2.appendChild(rangeAndDuration);
    cardHeader.appendChild(row2);

    const row3 = document.createElement("div");
    row3.className = "header-row";
    const componentIcons = await render_component_icons(spell, computedColor);
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
    const spellDescription = await render_entries(spell.entries);
    descriptionText.appendChild(spellDescription);
    cardBody.appendChild(descriptionText);

    const higherLevelText = await render_higher_level_text(
        spell,
        computedColor
    );
    if (higherLevelText) {
        cardBody.appendChild(higherLevelText);
    }

    const concentrationAndRitual = await render_concentration_and_ritual(
        spell,
        computedColor
    );
    front.appendChild(concentrationAndRitual);

    const classIcons = await render_class_icons(spell, computedColor);
    front.appendChild(classIcons);

    const spellSchool = render_spell_school(spell, computedColor);
    front.appendChild(spellSchool);

    const spellSource = render_spell_source(spell, computedColor);
    front.appendChild(spellSource);

    card.appendChild(front);

    return card;
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

    const iconColor = get_color_from_css_variable("var(--font-color)");

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

export async function generateSpellCards(
    spellIndices,
    pageSize,
    addGlossary,
    printableArea
) {
    printableArea.innerHTML = "";

    const tempCard = await make_spell_card(spells[0]);
    printableArea.appendChild(tempCard);
    const pxPerMm = getPxPerMm();
    const cardWidth = tempCard.offsetWidth / pxPerMm;
    const cardHeight = tempCard.offsetHeight / pxPerMm;
    printableArea.removeChild(tempCard);

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

    const spellsToRender = spellIndices
        .map((index) => spells[parseInt(index, 10)])
        .filter(Boolean);

    const singleCardGroups = [];
    const pairCardGroups = [];
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    tempContainer.style.top = "-9999px";
    printableArea.appendChild(tempContainer);

    for (const spell of spellsToRender) {
        const spellCard = await make_spell_card(spell);
        tempContainer.appendChild(spellCard);
        const backCard = await handle_overflow(spellCard, spell, tempContainer);
        tempContainer.removeChild(spellCard);
        if (backCard) {
            pairCardGroups.push([spellCard, backCard]);
        } else {
            singleCardGroups.push([spellCard]);
        }
    }
    printableArea.removeChild(tempContainer);

    const layout = [];
    let currentIndex = 0;

    for (const pair of pairCardGroups) {
        const column = currentIndex % cardsPerRow;
        if (column + 2 > cardsPerRow) {
            const gap = cardsPerRow - column;
            for (let i = 0; i < gap; i++) {
                layout.push(null);
            }
            currentIndex += gap;
        }
        layout.push(pair[0]);
        layout.push(pair[1]);
        currentIndex += 2;
    }

    const singleCards = singleCardGroups.flat();
    for (let i = 0; i < layout.length; i++) {
        if (layout[i] === null) {
            const card = singleCards.shift();
            if (card) {
                layout[i] = card;
            }
        }
    }
    layout.push(...singleCards);

    printableArea.innerHTML = "";
    let currentPage = createPage(pageSize, containerWidth, containerHeight);
    printableArea.appendChild(currentPage);
    let cardCount = 0;

    const finalLayout = [...allCards, ...layout];

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

    pageContent.appendChild(cardContainer);
    return page;
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

async function handle_overflow(card, spell, tempContainer, fontLevel = 0) {
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

        const computedColor = compute_color(spell);
        const backCardContainer = document.createElement("div");
        backCardContainer.className = "spell-card";

        const back = document.createElement("div");
        back.className = "spell-card-back";

        const backCardBody = document.createElement("div");
        backCardBody.className = "card-body back";
        backCardBody.style.borderColor = computedColor;
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
                card,
                spell,
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

        return backCardContainer;
    }

    return null;
}
