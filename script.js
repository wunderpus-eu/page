document.addEventListener("DOMContentLoaded", () => {
    const generateCardsButton = document.getElementById("generate-cards");
    const exportPdfButton = document.getElementById("export-pdf");
    const printableArea = document.getElementById("printable-area");
    const spellNamesInput = document.getElementById("spell-names-input");
    const pageSizeToggle = document.getElementById("page-size-toggle");
    const colorToggle = document.getElementById("color-toggle");
    const header = document.querySelector("header");
    const headerContent = document.getElementById("header-content");

    let spells = [];
    const iconCache = {};
    const baseDevicePixelRatio = window.devicePixelRatio;

    const schoolColorMap = {
        A: "var(--abjuration-color)",
        C: "var(--conjuration-color)",
        D: "var(--divination-color)",
        E: "var(--enchantment-color)",
        V: "var(--evocation-color)",
        I: "var(--illusion-color)",
        N: "var(--necromancy-color)",
        T: "var(--transmutation-color)",
    };

    function compute_color(spell) {
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
        frontBorder.src = await load_icon(
            "border-front",
            computedColor,
            "white"
        );
        frontBorderContainer.appendChild(frontBorder);

        return frontBorderContainer;
    }

    function get_color_from_css_variable(cssVar) {
        const tempDiv = document.createElement("div");
        tempDiv.style.color = cssVar;
        document.body.appendChild(tempDiv);
        const computedColor = getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);
        return computedColor;
    }

    // Counter-zoom logic
    function handleZoom() {
        const currentZoom = window.devicePixelRatio / baseDevicePixelRatio;
        if (headerContent && header) {
            headerContent.style.transform = `translateX(-50%) scale(${
                1 / currentZoom
            })`;
            headerContent.style.width = `${100 * currentZoom}vw`;
            document.body.style.paddingTop = `${
                headerContent.getBoundingClientRect().height
            }px`;
        }
    }

    window.addEventListener("resize", handleZoom);

    async function load_icon(
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

    // Fetch spell data
    async function loadSpells() {
        try {
            const response = await fetch("spells-xphb.json");
            const data = await response.json();
            spells = data.spell;
            console.log("Spells loaded:", spells);
        } catch (error) {
            console.error("Error loading spells:", error);
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

    function render_casting_time(spell) {
        const castingTimeContainer = document.createElement("div");
        castingTimeContainer.className = "spell-casting-time";

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

        if (spell.school && schoolColorMap[spell.school]) {
            const color = schoolColorMap[spell.school];
            castingTimeContainer.style.backgroundColor = color;
        }

        return castingTimeContainer;
    }

    async function render_range(spell, computedColor) {
        const rangeContainer = document.createElement("div");
        rangeContainer.className = "spell-range";

        // Set background color
        rangeContainer.style.backgroundColor = computedColor;

        // Get relevant range information
        const rangeType = spell.range.type;
        const rangeDistType = spell.range.distance.type;
        const rangeDistNumber = spell.range.distance.amount || "";
        const tags = spell.miscTags || [];

        // Add main icon
        const iconName = tags.includes("SGT")
            ? "icon-range-los-inv"
            : "icon-range";
        const iconUrl = await load_icon(iconName, "white", computedColor);
        if (iconUrl) {
            const icon = document.createElement("img");
            icon.src = iconUrl;
            icon.className = "spell-range-icon";
            rangeContainer.appendChild(icon);
        }

        // Add range text
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

        // Add area icon
        if (
            [
                "line",
                "cone",
                "cube",
                "cylinder",
                "sphere",
                "emanation",
            ].includes(rangeType)
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

        // Set background color
        durationContainer.style.backgroundColor = computedColor;

        // Get relevant duration information
        const durationType = spell.duration[0].type;
        const durationTimeType = spell.duration[0].duration?.type || "";
        const durationTimeNumber = spell.duration[0].duration?.amount || "";

        if (["instant", "special"].includes(durationType)) {
            return null;
        }

        // Add main icon
        const iconName =
            durationType === "timed" ? "icon-duration" : "icon-permanent";
        const iconUrl = await load_icon(iconName, "white", computedColor);
        if (iconUrl) {
            const icon = document.createElement("img");
            icon.src = iconUrl;
            icon.className = "spell-duration-icon";
            durationContainer.appendChild(icon);
        }

        // Add duration text
        if (durationType === "timed") {
            const durationUnitAbbrev = {
                minute: "min",
                hour: "h",
                day: "d",
                round: "Round",
            };
            let durationText = `${durationTimeNumber} ${durationUnitAbbrev[durationTimeType]}`;
            const durationTextNode = document.createTextNode(durationText);
            durationContainer.appendChild(durationTextNode);
        } else {
            const ends = spell.duration[0].ends;
            if (ends.includes("trigger")) {
                const durationText = "Until triggered";
                const durationTextNode = document.createTextNode(durationText);
                durationContainer.appendChild(durationTextNode);
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
            materialIcon.src = await load_icon(
                icon_name,
                computedColor,
                "white"
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

        const foregroundColor = get_color_from_css_variable(foregroundColorVar);

        // Note: For now, these are hardcoded. In the future, we might want to
        // load these from a configuration file.
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

        const wordRegexPart = `(?<!course of )\\b(${wordKeys.join("|")})\\b`;

        const iconTagRegexPart =
            tagKeys.length > 0
                ? `|(${tagKeys.map(escapeRegExp).join("|")})`
                : "";

        const diceRegexPart = `|({@(?:${diceTags.join("|")})\\s[^}]+})`;
        const chanceRegexPart = `|({@${chanceTag}\\s[^}]+})`;
        const actionRegexPart = `|({@${actionTag}\\s[^}]+}(?:\\s*action)?)`;
        const genericTagRegexPart = `|({@[^}]+})`;

        const regex = new RegExp(
            `${wordRegexPart}${iconTagRegexPart}${diceRegexPart}${chanceRegexPart}${actionRegexPart}${genericTagRegexPart}`,
            "gi"
        );

        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                container.appendChild(
                    document.createTextNode(
                        text.substring(lastIndex, match.index)
                    )
                );
            }

            const matchedText = match[0];

            if (match[1]) {
                // Word match (abbreviations or damage words)
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
                // Icon tag match
                const icon = document.createElement("img");
                icon.src = await load_icon(icons[matchedText], foregroundColor);
                icon.className = "inline-icon";
                const iconWrapper = document.createElement("span");
                iconWrapper.className = "inline-icon-wrapper";
                iconWrapper.appendChild(icon);
                container.appendChild(iconWrapper);
            } else if (match[3]) {
                // Dice tag match
                const innerContent = matchedText.substring(
                    2,
                    matchedText.length - 1
                );
                const firstSpaceIndex = innerContent.indexOf(" ");
                const formula = innerContent
                    .substring(firstSpaceIndex + 1)
                    .split("|")[0]
                    .trim();
                const span = document.createElement("span");
                span.className = "dice-formula";
                span.textContent = formula;
                container.appendChild(span);
            } else if (match[4]) {
                // Chance tag match
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
                // Action tag match
                const actionTagMatch = matchedText.match(/{@action\s([^|}]+)/);
                const actionText = actionTagMatch
                    ? actionTagMatch[1].trim()
                    : "";

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
                // Generic tag match
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
                    textToRender = firstPart
                        .substring(firstSpaceIndex + 1)
                        .trim();
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

        // Add any remaining text
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
            const container = document.createElement("div");
            container.className = "spell-list-hang";
            for (const item of listData.items) {
                const p = document.createElement("p");

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

    // Function to create a spell card
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

        const spellLevel = render_spell_level(spell, computedColor);
        cardHeader.appendChild(spellLevel);

        const spellName = render_spell_name(spell);
        cardHeader.appendChild(spellName);

        const castingTime = render_casting_time(spell);
        cardHeader.appendChild(castingTime);

        const rangeAndDuration = await render_range_and_duration(
            spell,
            computedColor
        );
        cardHeader.appendChild(rangeAndDuration);

        const componentIcons = await render_component_icons(
            spell,
            computedColor
        );
        cardHeader.appendChild(componentIcons);

        const componentText = await render_component_text(spell);
        cardHeader.appendChild(componentText);

        const concentrationAndRitual = await render_concentration_and_ritual(
            spell,
            computedColor
        );
        front.appendChild(concentrationAndRitual);

        const spellSchool = render_spell_school(spell, computedColor);
        front.appendChild(spellSchool);

        const spellDescriptionContainer = document.createElement("div");
        spellDescriptionContainer.className = "spell-description-container";
        front.appendChild(spellDescriptionContainer);

        const conditionText = await render_condition_text(spell);
        if (conditionText) {
            spellDescriptionContainer.appendChild(conditionText);
        }

        const spellDescription = await render_entries(spell.entries);
        spellDescriptionContainer.appendChild(spellDescription);

        const higherLevelText = await render_higher_level_text(
            spell,
            computedColor
        );
        if (higherLevelText) {
            spellDescriptionContainer.appendChild(higherLevelText);
        }

        card.appendChild(front);

        // For now, we are not creating a back for the card.
        // This can be added later.

        return card;
    }

    // Main function to generate cards
    async function generateSpellCards(spellNames, pageSize) {
        printableArea.innerHTML = "";

        // Create a temporary card to measure its dimensions
        const tempCard = await make_spell_card(spells[0]);
        printableArea.appendChild(tempCard);
        const pxPerMm = getPxPerMm();
        const cardWidth = tempCard.offsetWidth / pxPerMm;
        const cardHeight = tempCard.offsetHeight / pxPerMm;
        printableArea.removeChild(tempCard);

        const pagePadding = 10 * 2; // 10mm padding on each side

        const pageDimensions = {
            a4: { width: 297, height: 210 },
            letter: { width: 279.4, height: 215.9 }, // 11in x 8.5in in mm
        };

        const { width: pageWidth, height: pageHeight } =
            pageDimensions[pageSize];

        const cardsPerRow = Math.floor(
            (pageWidth - pagePadding) / (cardWidth + 1)
        );
        const rowsPerPage = Math.floor(
            (pageHeight - pagePadding) / (cardHeight + 1)
        );
        const maxCardsPerPage = cardsPerRow * rowsPerPage;

        // 1mm gap between cards
        const containerWidth = cardsPerRow * (cardWidth + 1) - 1;
        const containerHeight = rowsPerPage * (cardHeight + 1) - 1;

        const spellsToRender = spellNames
            .map((name) => spells.find((s) => s.name === name))
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
            const spellNameElement = spellCard.querySelector("h3");
            tempContainer.appendChild(spellCard);
            // adjust_spell_name(spellNameElement);
            const backCard = await handle_overflow(
                spellCard,
                spell,
                false,
                tempContainer
            );
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
        // Add remaining singles
        layout.push(...singleCards);

        printableArea.innerHTML = "";
        let currentPage = createPage(pageSize, containerWidth, containerHeight);
        printableArea.appendChild(currentPage);
        let cardCount = 0;

        for (const card of layout) {
            if (cardCount >= maxCardsPerPage) {
                currentPage = createPage(
                    pageSize,
                    containerWidth,
                    containerHeight
                );
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
    }

    function createPage(pageSize, containerWidth, containerHeight) {
        const page = document.createElement("div");
        page.className = "page";
        if (pageSize === "letter") {
            page.classList.add("page-letter");
        }

        const cardContainer = document.createElement("div");
        cardContainer.className = "card-container";
        cardContainer.style.width = `${containerWidth}mm`;
        cardContainer.style.height = `${containerHeight}mm`;

        page.appendChild(cardContainer);
        return page;
    }

    // Toggle between A4 and Letter page sizes
    pageSizeToggle.addEventListener("click", async () => {
        const currentSize = pageSizeToggle.dataset.size || "letter";
        const newSize = currentSize === "letter" ? "a4" : "letter";
        pageSizeToggle.dataset.size = newSize;
        pageSizeToggle.textContent =
            newSize.charAt(0).toUpperCase() + newSize.slice(1);
        const spellNamesText = spellNamesInput.value;
        if (!spellNamesText) {
            return;
        }
        const spellNames = spellNamesText
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);
        const pageSize = pageSizeToggle.dataset.size || "letter";
        await generateSpellCards(spellNames, pageSize);
    });

    // Toggle between Color and Grayscale
    colorToggle.addEventListener("click", async () => {
        document.body.classList.toggle("grayscale");
        const isGrayscale = document.body.classList.contains("grayscale");
        colorToggle.textContent = isGrayscale ? "Grayscale" : "Color";
        const spellNamesText = spellNamesInput.value;
        if (!spellNamesText) {
            return;
        }
        const spellNames = spellNamesText
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);
        const pageSize = pageSizeToggle.dataset.size || "letter";
        await generateSpellCards(spellNames, pageSize);
    });

    // Generate spell cards when the button is clicked
    generateCardsButton.addEventListener("click", async () => {
        const spellNamesText = spellNamesInput.value;
        if (!spellNamesText) {
            alert("Please enter at least one spell name.");
            return;
        }
        const spellNames = spellNamesText
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);

        const pageSize = pageSizeToggle.dataset.size || "letter";

        await generateSpellCards(spellNames, pageSize);
        updateIconSizes();
    });

    exportPdfButton.addEventListener("click", async () => {
        const printableArea = document.getElementById("printable-area");
        const html = printableArea.innerHTML;
        const cssResponse = await fetch("style.css");
        const css = await cssResponse.text();
        const pageSize = pageSizeToggle.dataset.size || "letter";

        try {
            const response = await fetch("/export-pdf", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    html: html,
                    css: css,
                    pageSize: pageSize,
                }),
            });
            if (response.ok) {
                window.open("/get-pdf", "_blank");
            } else {
                console.error("Failed to export PDF");
            }
        } catch (error) {
            console.error("Error during PDF export:", error);
            alert(`Error generating PDF: An unexpected error occurred.`);
        }
    });

    // Load spells when the page loads
    loadSpells();
    // Initial call to set the header scale
    handleZoom();

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

    async function handle_overflow(card, spell, fontReduced, tempContainer) {
        const spellDescriptionContainer = card.querySelector(
            ".spell-description-container"
        );
        const componentText = card.querySelector(".spell-component-text");
        const higherLevelText = spellDescriptionContainer.querySelector(
            ".spell-higher-level-text"
        );
        const conditionText = spellDescriptionContainer.querySelector(
            ".spell-condition-text"
        );

        // Temporarily remove the higher-level text so its auto-margin doesn't affect scrollHeight
        if (higherLevelText) {
            higherLevelText.remove();
        }

        function is_overflowing(element) {
            return element.scrollHeight > element.clientHeight;
        }

        if (is_overflowing(spellDescriptionContainer)) {
            // First, try to fix the overflow by reducing the font size
            if (!fontReduced) {
                spellDescriptionContainer.style.fontSize = "6pt";
                spellDescriptionContainer.style.lineHeight = "6pt";
                componentText.style.fontSize = "6pt";
                componentText.style.lineHeight = "6pt";
                if (conditionText) {
                    conditionText.style.fontSize = "6pt";
                    conditionText.style.lineHeight = "6pt";
                }
                if (higherLevelText) {
                    higherLevelText.style.fontSize = "6pt";
                    higherLevelText.style.lineHeight = "6pt";
                }

                if (is_overflowing(spellDescriptionContainer)) {
                    // If it still overflows, revert the font size and create a back
                    spellDescriptionContainer.style.fontSize = "";
                    spellDescriptionContainer.style.lineHeight = "";
                    componentText.style.fontSize = "";
                    componentText.style.lineHeight = "";
                    if (conditionText) {
                        conditionText.style.fontSize = "";
                        conditionText.style.lineHeight = "";
                    }
                    if (higherLevelText) {
                        higherLevelText.style.fontSize = "";
                        higherLevelText.style.lineHeight = "";
                    }
                } else {
                    if (higherLevelText) {
                        spellDescriptionContainer.appendChild(higherLevelText);
                    }
                    return null;
                }
            }

            const computedColor = compute_color(spell);

            const backCardContainer = document.createElement("div");
            backCardContainer.className = "spell-card";

            const back = document.createElement("div");
            back.className = "spell-card-back";

            const backDescriptionContainer = document.createElement("div");
            backDescriptionContainer.className =
                "spell-description-container back";
            backDescriptionContainer.style.borderColor = computedColor;
            back.appendChild(backDescriptionContainer);

            backCardContainer.appendChild(back);

            if (tempContainer) {
                tempContainer.appendChild(backCardContainer);
            }

            if (fontReduced) {
                const frontDescriptionContainer = card.querySelector(
                    ".spell-description-container"
                );
                frontDescriptionContainer.style.fontSize = "6pt";
                frontDescriptionContainer.style.lineHeight = "6pt";
                componentText.style.fontSize = "6pt";
                componentText.style.lineHeight = "6pt";
                backDescriptionContainer.style.fontSize = "6pt";
                backDescriptionContainer.style.lineHeight = "6pt";
                if (conditionText) {
                    conditionText.style.fontSize = "6pt";
                    conditionText.style.lineHeight = "6pt";
                }
                if (higherLevelText) {
                    higherLevelText.style.fontSize = "6pt";
                    higherLevelText.style.lineHeight = "6pt";
                }
            }

            const descriptionElements = Array.from(
                spellDescriptionContainer.children
            ).filter(
                (el) =>
                    !el.classList.contains("spell-condition-text") &&
                    !el.classList.contains("spell-higher-level-text")
            );

            if (higherLevelText) {
                spellDescriptionContainer.appendChild(higherLevelText);
            }

            while (
                is_overflowing(spellDescriptionContainer) &&
                descriptionElements.length > 0
            ) {
                const elementToMove = descriptionElements.pop();
                backDescriptionContainer.prepend(elementToMove);
            }

            if (is_overflowing(backDescriptionContainer) && !fontReduced) {
                // Back is overflowing, and we haven't reduced font size yet.
                // We need to restart the process with smaller fonts.

                // 1. Restore the front card's description container by moving elements back from the back card.
                const backElements = Array.from(
                    backDescriptionContainer.children
                );
                for (const elementToMove of backElements) {
                    spellDescriptionContainer.appendChild(elementToMove);
                }

                // 2. Remove the now-empty back card from the temp container.
                if (tempContainer) {
                    tempContainer.removeChild(backCardContainer);
                }

                // 3. Remove higher level text before recursive call, as the function expects it to be removed.
                if (higherLevelText) {
                    higherLevelText.remove();
                }

                // 4. Recursively call handle_overflow.
                // It will now apply smaller fonts and re-distribute from a full front card.
                return await handle_overflow(card, spell, true, tempContainer);
            }

            const lastParagraph =
                spellDescriptionContainer.querySelector("p:last-of-type");
            if (lastParagraph) {
                lastParagraph.textContent += " →";
            }

            if (tempContainer) {
                tempContainer.removeChild(backCardContainer);
            }

            return backCardContainer;
        }

        // Add the higher-level text back if it was removed
        if (higherLevelText) {
            spellDescriptionContainer.appendChild(higherLevelText);
        }

        return null;
    }

    function updateIconSizes() {
        const iconWrappers = document.querySelectorAll(".inline-icon-wrapper");
        iconWrappers.forEach((wrapper) => {
            const parentFontSize = parseFloat(
                window.getComputedStyle(wrapper.parentElement).fontSize
            );
            const iconSize = parentFontSize * 0.9;
            wrapper.style.height = `${iconSize}px`;
            wrapper.style.width = `${iconSize}px`;
        });
    }
});
