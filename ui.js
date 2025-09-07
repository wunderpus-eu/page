import {
    loadSpells,
    generateSpellCards,
    spellCardInstances,
    layoutCards,
    SOURCE_MAP,
} from "./card-generator.js";

document.addEventListener("DOMContentLoaded", async () => {
    const exportPdfButton = document.getElementById("export-pdf-button");
    const printableArea = document.getElementById("printable-area");
    const spellSelect = document.getElementById("spell-select");
    const pageSizeSelect = document.getElementById("page-size-select");
    const colorToggle = document.getElementById("color-toggle");
    const glossaryToggle = document.getElementById("glossary-toggle");
    const header = document.querySelector("header");
    const headerContent = document.getElementById("header-content");
    const classFilter = document.getElementById("class-filter");
    const levelFilter = document.getElementById("level-filter");
    const sourceFilter = document.getElementById("source-filter");
    const rulesToggle = document.getElementById("rules-toggle");
    const addFilteredButton = document.getElementById("add-filtered-button");
    const filteredCount = document.getElementById("filtered-count");
    const mainContainer = document.getElementById("main-container");
    const printableAreaWrapper = document.getElementById(
        "printable-area-wrapper"
    );

    const baseDevicePixelRatio = window.devicePixelRatio;

    let spells = [];
    let spellClassMap = {};
    let pageWidthPx = 0;
    let currentCards = [];

    async function reloadData() {
        const use2024Rules = rulesToggle.checked;
        const loadedData = await loadSpells(use2024Rules);
        spells = loadedData.spells;
        spellClassMap = loadedData.spellClassMap;

        // Clear existing selections and options
        spellSelect.value = [];
        classFilter.value = [];
        levelFilter.value = [];
        sourceFilter.value = [];

        spellSelect.innerHTML = "";
        classFilter.innerHTML = "";
        levelFilter.innerHTML = "";
        sourceFilter.innerHTML = "";

        printableArea.innerHTML = "";
        currentCards = [];
        spellCardInstances.clear();

        populateSpellSelect();
        populateFilters();
        updateFilteredCount();
        updateWrapperSizeAndPosition();
    }

    function handleZoom() {
        const headerHeight = header.getBoundingClientRect().height;
        mainContainer.style.marginTop = `${headerHeight}px`;
        mainContainer.style.height = `calc(100vh - ${headerHeight}px)`;
    }

    window.addEventListener("resize", handleZoom);

    let scale = 1;
    mainContainer.addEventListener("wheel", function (event) {
        if (event.ctrlKey) {
            event.preventDefault();

            const scaleAmount = 0.1;
            let newScale;

            if (event.deltaY < 0) {
                newScale = scale + scaleAmount;
            } else {
                newScale = scale - scaleAmount;
            }

            newScale = Math.max(0.5, Math.min(newScale, 3));

            if (newScale !== scale) {
                const oldScrollLeft = mainContainer.scrollLeft;
                const oldScrollTop = mainContainer.scrollTop;

                const containerWidth = mainContainer.clientWidth;
                const containerHeight = mainContainer.clientHeight;

                const scaleRatio = newScale / scale;

                printableArea.style.transform = `scale(${newScale})`;
                scale = newScale;

                updateWrapperSizeAndPosition();

                const viewportCenterX = oldScrollLeft + containerWidth / 2;
                const viewportCenterY = oldScrollTop + containerHeight / 2;

                const newCenterX = viewportCenterX * scaleRatio;
                const newCenterY = viewportCenterY * scaleRatio;

                mainContainer.scrollLeft = newCenterX - containerWidth / 2;
                mainContainer.scrollTop = newCenterY - containerHeight / 2;
            }
        }
    });

    function updateWrapperSizeAndPosition() {
        const containerHeight = mainContainer.clientHeight;
        const wrapperWidth = pageWidthPx * scale;
        const wrapperHeight = printableArea.scrollHeight * scale;

        printableAreaWrapper.style.width = `${wrapperWidth}px`;
        printableAreaWrapper.style.height = `${
            wrapperHeight + containerHeight / 2
        }px`;
    }

    function updatePageWidth() {
        const tempDiv = document.createElement("div");
        tempDiv.style.position = "absolute";
        tempDiv.style.visibility = "hidden";
        tempDiv.style.width = "279.4mm"; // Default to letter size
        document.body.appendChild(tempDiv);
        // Check if A4 is selected
        const pageSize = pageSizeSelect.value;
        if (pageSize === "a4") {
            tempDiv.style.width = "297mm";
        }
        pageWidthPx = tempDiv.offsetWidth;
        printableArea.style.width = `${pageWidthPx}px`;
        document.body.removeChild(tempDiv);
    }

    async function initialize() {
        await reloadData();
        handleZoom();
        updatePageWidth();
    }

    function populateSpellSelect() {
        spells.forEach((spell, index) => {
            const option = document.createElement("sl-option");
            option.value = index;
            option.textContent = spell.name;

            const sourceText = SOURCE_MAP[spell.source] || spell.source;

            const sourceSpan = document.createElement("span");
            sourceSpan.slot = "suffix";
            sourceSpan.className = "spell-source-suffix";
            sourceSpan.textContent = sourceText;

            option.appendChild(sourceSpan);
            spellSelect.appendChild(option);
        });
    }

    function populateFilters() {
        const allClasses = new Set();
        const allLevels = new Set();
        const allSources = new Set();

        spells.forEach((spell, index) => {
            if (spellClassMap[index]) {
                spellClassMap[index].forEach((className) =>
                    allClasses.add(className)
                );
            }
            allLevels.add(
                spell.level === 0 ? "Cantrip" : spell.level.toString()
            );
            if (spell.source === "XPHB" || spell.source === "PHB") {
                allSources.add("PHB");
            } else {
                allSources.add(spell.source);
            }
        });

        const sortedClasses = [...allClasses].sort();
        const sortedLevels = [...allLevels].sort((a, b) => {
            if (a === "Cantrip") return -1;
            if (b === "Cantrip") return 1;
            return parseInt(a) - parseInt(b);
        });
        const sortedSources = [...allSources].sort();

        sortedClasses.forEach((className) => {
            const option = document.createElement("sl-option");
            option.value = className;
            option.textContent = className;

            const icon = document.createElement("sl-icon");
            icon.slot = "prefix";
            icon.src = `assets/icon-${className.toLowerCase()}.svg`;
            icon.classList.add("class-filter-icon");
            option.appendChild(icon);

            classFilter.appendChild(option);
        });

        sortedLevels.forEach((level) => {
            const option = document.createElement("sl-option");
            option.value = level;
            option.textContent = level;
            levelFilter.appendChild(option);
        });

        sortedSources.forEach((source) => {
            const option = document.createElement("sl-option");
            option.value = source;
            option.textContent = source;
            sourceFilter.appendChild(option);
        });

        sourceFilter.value = ["PHB"];
    }

    function updateFilteredCount() {
        const selectedClasses = classFilter.value;
        const selectedLevels = levelFilter.value.map((l) =>
            l === "Cantrip" ? 0 : parseInt(l)
        );
        const selectedSources = sourceFilter.value;

        if (
            selectedClasses.length === 0 &&
            selectedLevels.length === 0 &&
            selectedSources.length === 0
        ) {
            filteredCount.textContent = "";
            return;
        }

        let count = 0;
        spells.forEach((spell, index) => {
            const spellClasses = spellClassMap[index] || [];
            const spellLevel = spell.level;

            const classMatch =
                selectedClasses.length === 0
                    ? true
                    : selectedClasses.some((c) => spellClasses.includes(c));
            const levelMatch =
                selectedLevels.length === 0 ||
                selectedLevels.includes(spellLevel);
            const sourceMatch =
                selectedSources.length === 0 ||
                selectedSources.some((selected) => {
                    if (selected === "PHB") {
                        return (
                            spell.source === "PHB" || spell.source === "XPHB"
                        );
                    }
                    return spell.source === selected;
                });

            if (classMatch && levelMatch && sourceMatch) {
                count++;
            }
        });

        filteredCount.textContent = `${count} matching spells`;
    }

    function addFilteredSpells() {
        const selectedClasses = classFilter.value;
        const selectedLevels = levelFilter.value.map((l) =>
            l === "Cantrip" ? 0 : parseInt(l)
        );
        const selectedSources = sourceFilter.value;

        if (
            selectedClasses.length === 0 &&
            selectedLevels.length === 0 &&
            selectedSources.length === 0
        ) {
            return;
        }

        const spellsToAdd = [];
        spells.forEach((spell, index) => {
            const spellClasses = spellClassMap[index] || [];
            const spellLevel = spell.level;

            const classMatch =
                selectedClasses.length === 0
                    ? true
                    : selectedClasses.some((c) => spellClasses.includes(c));
            const levelMatch =
                selectedLevels.length === 0 ||
                selectedLevels.includes(spellLevel);
            const sourceMatch =
                selectedSources.length === 0 ||
                selectedSources.some((selected) => {
                    if (selected === "PHB") {
                        return (
                            spell.source === "PHB" || spell.source === "XPHB"
                        );
                    }
                    return spell.source === selected;
                });

            if (classMatch && levelMatch && sourceMatch) {
                spellsToAdd.push(index.toString());
            }
        });

        const currentSelection = new Set(spellSelect.value);
        spellsToAdd.forEach((spellIndex) => currentSelection.add(spellIndex));
        spellSelect.value = [...currentSelection];
        regenerateCards();
    }

    classFilter.addEventListener("sl-change", updateFilteredCount);
    levelFilter.addEventListener("sl-change", updateFilteredCount);
    sourceFilter.addEventListener("sl-change", updateFilteredCount);
    rulesToggle.addEventListener("sl-change", reloadData);
    addFilteredButton.addEventListener("click", addFilteredSpells);

    async function regenerateCards(selectedSpells = null) {
        if (selectedSpells === null) {
            selectedSpells = spellSelect.value;
        }

        document.body.classList.toggle("grayscale", colorToggle.checked);

        if (!selectedSpells || selectedSpells.length === 0) {
            printableArea.innerHTML = "";
            currentCards = [];
            return;
        }

        const pageSize = pageSizeSelect.value;
        const addGlossary = glossaryToggle.checked;

        currentCards = await generateSpellCards(selectedSpells);
        await layoutCards(currentCards, pageSize, addGlossary, printableArea);

        const allCheckboxes = document.querySelectorAll(".prepared-checkbox");
        allCheckboxes.forEach((checkbox) => {
            const cardElement = checkbox.closest(".spell-card");
            if (cardElement) {
                const spellName = cardElement.dataset.spellName;
                const spellCard = spellCardInstances.get(spellName);
                if (spellCard) {
                    checkbox.checked = spellCard.isAlwaysPrepared;
                }
            }
        });
        updateWrapperSizeAndPosition();
    }

    pageSizeSelect.addEventListener("sl-change", () => {
        updatePageWidth();
        regenerateCards();
    });

    spellSelect.addEventListener("sl-change", (event) => {
        const selectedSpells = event.target.value;
        regenerateCards(selectedSpells);
    });
    colorToggle.addEventListener("sl-change", () => regenerateCards());
    glossaryToggle.addEventListener("sl-change", () => regenerateCards());

    printableArea.addEventListener("sl-change", async (event) => {
        if (event.target.classList.contains("prepared-checkbox")) {
            const cardElement = event.target.closest(".spell-card");
            if (cardElement) {
                const spellName = cardElement.dataset.spellName;
                const spellCard = spellCardInstances.get(spellName);
                if (spellCard) {
                    await spellCard.setAlwaysPrepared(event.target.checked);
                    const pageSize = pageSizeSelect.value;
                    const addGlossary = glossaryToggle.checked;
                    await layoutCards(
                        currentCards,
                        pageSize,
                        addGlossary,
                        printableArea
                    );
                    updateWrapperSizeAndPosition();
                }
            }
        }
    });

    printableArea.addEventListener("mouseover", (event) => {
        const cardElement = event.target.closest(".spell-card");
        if (cardElement) {
            const spellName = cardElement.dataset.spellName;
            if (spellName) {
                const spellCard = spellCardInstances.get(spellName);
                if (spellCard && spellCard.frontElement) {
                    const checkboxContainer =
                        spellCard.frontElement.querySelector(
                            ".prepared-checkbox-container"
                        );
                    if (checkboxContainer) {
                        checkboxContainer.style.opacity = "1";
                    }
                }
            }
        }
    });

    printableArea.addEventListener("mouseout", (event) => {
        const cardElement = event.target.closest(".spell-card");
        if (cardElement) {
            const spellName = cardElement.dataset.spellName;
            if (spellName) {
                const spellCard = spellCardInstances.get(spellName);
                if (spellCard && spellCard.frontElement) {
                    const checkboxContainer =
                        spellCard.frontElement.querySelector(
                            ".prepared-checkbox-container"
                        );
                    if (checkboxContainer) {
                        checkboxContainer.style.opacity = "0";
                    }
                }
            }
        }
    });

    exportPdfButton.addEventListener("click", async () => {
        exportPdfButton.loading = true;
        const printableArea = document.getElementById("printable-area");
        const html = printableArea.innerHTML;
        const cssResponse = await fetch("content.css");
        const css = await cssResponse.text();
        const pageSize = pageSizeSelect.value;

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
        } finally {
            exportPdfButton.loading = false;
        }
    });

    initialize();
});
