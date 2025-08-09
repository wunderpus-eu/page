document.addEventListener("DOMContentLoaded", () => {
    const generatePdfButton = document.getElementById("generate-pdf");
    const printableArea = document.getElementById("printable-area");
    const spellNamesInput = document.getElementById("spell-names-input");
    const pageSizeToggle = document.getElementById("page-size-toggle");
    const colorToggle = document.getElementById("color-toggle");
    const header = document.querySelector("header");
    const headerContent = document.getElementById("header-content");

    let spells = [];
    const iconCache = {};
    const baseDevicePixelRatio = window.devicePixelRatio;

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

    function render_spell_level(spell) {
        const outerCircle = document.createElement("div");
        outerCircle.className = "spell-level-outer-circle";

        const innerCircle = document.createElement("div");
        innerCircle.className = "spell-level-inner-circle";

        const spellLevel = spell.level;
        if (spellLevel === 0) {
            const cantripCircle = document.createElement("div");
            cantripCircle.className = "cantrip-circle";
            innerCircle.appendChild(cantripCircle);
        } else {
            const spellLevelText = document.createElement("span");
            spellLevelText.className = "spell-level-text";
            spellLevelText.textContent = spellLevel;
            innerCircle.appendChild(spellLevelText);
        }

        if (spell.school && schoolColorMap[spell.school]) {
            const color = schoolColorMap[spell.school];
            outerCircle.style.borderColor = color;
            innerCircle.style.borderColor = color;
            innerCircle.style.backgroundColor = color;
        }

        outerCircle.appendChild(innerCircle);
        return outerCircle;
    }

    function render_spell_name(spell) {
        const spellNameElement = document.createElement("h3");
        spellNameElement.classList.add("left-aligned");

        // First, render the spell name in the available space to determine line breaks
        const words = spell.name.split(" ");
        words.forEach((word) => {
            const span = document.createElement("span");
            span.textContent = word + " ";
            spellNameElement.appendChild(span);
        });

        return spellNameElement;
    }

    function adjust_spell_name(spellNameElement) {
        // Run this after the spell name (and all its parents) have been added to the
        // DOM.

        // Record the line positions
        const lines = [];
        let currentLine = [];
        let lastOffsetTop = -1;

        spellNameElement.childNodes.forEach((span) => {
            const offsetTop = span.offsetTop;
            if (offsetTop > lastOffsetTop && lastOffsetTop !== -1) {
                lines.push(currentLine);
                currentLine = [];
            }
            currentLine.push(span);
            lastOffsetTop = offsetTop;
        });
        lines.push(currentLine);
        let line_offsets_left = lines.map((line) => line[0].offsetLeft);

        // Clear the h3, change the size, re-append the lines, and measure their
        spellNameElement.innerHTML = "";
        spellNameElement.classList.remove("left-aligned");
        spellNameElement.classList.add("centered");
        const card = spellNameElement.closest(".spell-card");
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineContainer = document.createElement("span");
            lineContainer.style.display = "block"; // Each line is a block
            for (const word of line) {
                const span = document.createElement("span");
                span.textContent = word.textContent;
                lineContainer.appendChild(span);
            }
            spellNameElement.appendChild(lineContainer);
            const offset = Math.max(
                line_offsets_left[i],
                lineContainer.firstChild.offsetLeft
            );
            lineContainer.style.marginLeft = `${
                offset - lineContainer.offsetLeft
            }px`;
            lineContainer.style.textAlign = "left";
        }
    }

    function render_casting_time(spell) {
        const castingTimeContainer = document.createElement("div");
        castingTimeContainer.className = "spell-casting-time";

        if (spell.time) {
            const time = spell.time[0];
            const number = time.number;
            const unit = time.unit;
            let castingTimeText = "";

            if (["action", "bonus action", "reaction"].includes(unit)) {
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

    async function render_range(spell) {
        const rangeContainer = document.createElement("div");
        rangeContainer.className = "spell-range";

        // Set background color
        rangeContainer.style.backgroundColor = schoolColorMap[spell.school];

        // Temporarily attach to DOM to compute style
        document.body.appendChild(rangeContainer);
        const computedColor = getComputedStyle(rangeContainer).backgroundColor;
        document.body.removeChild(rangeContainer);

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
                miles: "mi",
            };
            rangeText = `${rangeDistNumber} ${rangeDistAbbrev[rangeDistType]}`;
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
                areaIcon.className = "spell-range-icon";
                rangeContainer.appendChild(areaIcon);
            }
        }

        return rangeContainer;
    }

    async function render_duration(spell) {
        const durationContainer = document.createElement("div");
        durationContainer.className = "spell-duration";

        // Set background color
        durationContainer.style.backgroundColor = schoolColorMap[spell.school];

        // Temporarily attach to DOM to compute style
        document.body.appendChild(durationContainer);
        const computedColor =
            getComputedStyle(durationContainer).backgroundColor;
        document.body.removeChild(durationContainer);

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

    async function render_range_and_duration(spell) {
        const rangeAndDurationContainer = document.createElement("div");
        rangeAndDurationContainer.className = "spell-range-and-duration";

        if (spell.range) {
            const range = await render_range(spell);
            rangeAndDurationContainer.appendChild(range);
        }
        if (spell.duration) {
            const duration = await render_duration(spell);
            if (duration) {
                rangeAndDurationContainer.appendChild(duration);
            }
        }

        return rangeAndDurationContainer;
    }

    async function render_component_icons(spell) {
        const componentIconsContainer = document.createElement("div");
        componentIconsContainer.className = "spell-component-icons";

        // Temporarily set background color and attach to DOM to compute style
        componentIconsContainer.style.backgroundColor =
            schoolColorMap[spell.school];
        document.body.appendChild(componentIconsContainer);
        const computedColor = getComputedStyle(
            componentIconsContainer
        ).backgroundColor;
        document.body.removeChild(componentIconsContainer);
        componentIconsContainer.style.backgroundColor = null;

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

    async function render_front_border(spell) {
        const frontBorderContainer = document.createElement("div");
        frontBorderContainer.className = "spell-card-front-border";

        // Temporarily attach to DOM to compute style
        frontBorderContainer.style.backgroundColor =
            schoolColorMap[spell.school];
        document.body.appendChild(frontBorderContainer);
        const computedColor =
            getComputedStyle(frontBorderContainer).backgroundColor;
        document.body.removeChild(frontBorderContainer);
        frontBorderContainer.style.backgroundColor = null;

        const frontBorder = document.createElement("img");
        frontBorder.src = await load_icon(
            "border-front",
            computedColor,
            "white"
        );
        frontBorderContainer.appendChild(frontBorder);

        return frontBorderContainer;
    }

    // Function to create a spell card
    async function make_spell_card(spell) {
        const card = document.createElement("div");
        card.className = "spell-card";

        const front = document.createElement("div");
        front.className = "spell-card-front";

        const frontBorder = await render_front_border(spell);
        front.appendChild(frontBorder);

        const cardHeader = document.createElement("div");
        cardHeader.className = "card-header";
        front.appendChild(cardHeader);

        const spellLevel = render_spell_level(spell);
        cardHeader.appendChild(spellLevel);

        const spellName = render_spell_name(spell);
        cardHeader.appendChild(spellName);

        const castingTime = render_casting_time(spell);
        cardHeader.appendChild(castingTime);

        const rangeAndDuration = await render_range_and_duration(spell);
        cardHeader.appendChild(rangeAndDuration);

        const componentIcons = await render_component_icons(spell);
        cardHeader.appendChild(componentIcons);

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

        let currentPage = createPage(pageSize, containerWidth, containerHeight);
        printableArea.appendChild(currentPage);
        let cardCount = 0;

        const spellsToRender = spellNames
            .map((name) => spells.find((s) => s.name === name))
            .filter(Boolean);

        for (const spell of spellsToRender) {
            if (cardCount >= maxCardsPerPage) {
                currentPage = createPage(
                    pageSize,
                    containerWidth,
                    containerHeight
                );
                printableArea.appendChild(currentPage);
                cardCount = 0;
            }
            const spellCard = await make_spell_card(spell);
            const cardContainer = currentPage.querySelector(".card-container");
            cardContainer.appendChild(spellCard);
            const spellNameElement = spellCard.querySelector("h3");
            adjust_spell_name(spellNameElement);
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
    generatePdfButton.addEventListener("click", async () => {
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

        const element = document.getElementById("printable-area");
        const opt = {
            margin: 0,
            filename: "spell-cards.pdf",
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: "mm", format: pageSize, orientation: "landscape" },
        };

        // TODO: Enable again when I say so.
        // html2pdf().set(opt).from(element).save();
    });

    // Load spells when the page loads
    loadSpells();
    // Initial call to set the header scale
    handleZoom();
});

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
