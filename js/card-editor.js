/**
 * card-editor.js – Spell card editor UI: spell picker, filters, card list, layout refresh, edit overlay.
 *
 * Sets up DOMContentLoaded with all controls, event handlers, and layout wiring.
 * Card list holds SpellCard instances or glossary refs; layoutCards renders them.
 */
import {
    loadSpells,
    getSpells,
    SpellCard,
    SOURCE_MAP,
    SOURCE_DISPLAY_NAMES,
    SOURCES_2024,
    emptySpellTemplate,
    cloneSpellData,
    spellToExportFormat,
    appendSpells,
    createGlossaryCardRef,
    isGlossaryRef,
    load_icon,
    schoolColorMap,
} from "./card.js";
import { layoutCards } from "./card-layout.js";

/** In the spell list chips we show abbreviation (e.g. "PHB"). */
function getFilterSourceLabel(source) {
    if (source === "PHB" || source === "XPHB") return "PHB";
    return source;
}

/** Spell schools for the edit form dropdown. */
const SCHOOLS = [
    "Abjuration",
    "Conjuration",
    "Divination",
    "Enchantment",
    "Evocation",
    "Illusion",
    "Necromancy",
    "Transmutation",
];

/** Range origin options for the edit form. */
const RANGE_ORIGINS = [
    { value: "touch", label: "Touch" },
    { value: "point", label: "Point" },
    { value: "self", label: "Self" },
    { value: "special", label: "Special" },
];

/** Range distance unit options (when origin is point). */
const RANGE_UNITS = [
    { value: "feet", label: "Feet" },
    { value: "miles", label: "Miles" },
    { value: "unlimited", label: "Unlimited" },
];

/** Area of effect types; empty string = None. */
const AREA_TYPES = [
    { value: "", label: "None" },
    { value: "line", label: "Line" },
    { value: "cone", label: "Cone" },
    { value: "cube", label: "Cube" },
    { value: "cylinder", label: "Cylinder" },
    { value: "sphere", label: "Sphere" },
    { value: "emanation", label: "Emanation" },
    { value: "hemisphere", label: "Hemisphere" },
    { value: "wall", label: "Wall" },
    { value: "circle", label: "Circle" },
    { value: "square", label: "Square" },
];

/** Primary dimension label by area type (e.g. Radius, Length, Side length). */
const AREA_DIMENSION_LABELS = {
    line: "Length",
    cone: "Length",
    cube: "Side length",
    cylinder: "Radius",
    sphere: "Radius",
    emanation: "Radius",
    hemisphere: "Radius",
    wall: "Length",
    circle: "Radius",
    square: "Side length",
};

/** Duration type options for the edit form. */
const DURATION_TYPES = [
    { value: "instant", label: "Instant" },
    { value: "timed", label: "Timed" },
    { value: "permanent", label: "Permanent" },
    { value: "special", label: "Special" },
];

/** Duration unit options (when type is timed). */
const DURATION_UNITS = [
    { value: "minute", label: "Minute(s)" },
    { value: "hour", label: "Hour(s)" },
    { value: "day", label: "Day(s)" },
    { value: "round", label: "Round(s)" },
];

/** Ending condition options for permanent duration. */
const DURATION_END_OPTIONS = [
    { value: "dispel", label: "Dispel" },
    { value: "trigger", label: "Trigger" },
];

/** Spell class options for the edit form (clickable tokens). */
const SPELL_CLASSES = [
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

/** True if all chars in query appear in str in order (subsequence match). */
function fuzzyMatch(query, str) {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    const s = str.toLowerCase();
    let i = 0;
    for (let j = 0; j < s.length && i < q.length; j++) {
        if (s[j] === q[i]) i++;
    }
    return i === q.length;
}

document.addEventListener("DOMContentLoaded", async () => {
    // --- DOM references ---
    const printableArea = document.getElementById("printable-area");
    const pageSizeSelect = document.getElementById("page-size-select");
    const colorToggle = document.getElementById("color-toggle");
    const header = document.querySelector("header");
    const mainContainer = document.getElementById("main-container");
    const printableAreaWrapper = document.getElementById(
        "printable-area-wrapper"
    );

    const spellCombobox = document.getElementById("spell-combobox");
    const spellSearchInput = document.getElementById("spell-search-input");
    const spellListCount = document.getElementById("spell-list-count");
    const spellListAddAll = document.getElementById("spell-list-add-all");
    const spellListChips = document.getElementById("spell-list-chips");
    const spellList = document.getElementById("spell-list");
    const addEmptyBtn = document.getElementById("add-empty-btn");
    const addGlossaryBtn = document.getElementById("add-glossary-btn");

    const filterDropdown = document.getElementById("filter-dropdown");
    const filterRuleset = document.getElementById("filter-ruleset");
    const excludeReprintedToggle = document.getElementById(
        "filter-exclude-reprinted"
    );
    const filterSourceChips = document.getElementById("filter-source-chips");
    const filterClassChips = document.getElementById("filter-class-chips");
    const filterLevelChips = document.getElementById("filter-level-chips");
    const filterSchoolChips = document.getElementById("filter-school-chips");
    const filterClearBtn = document.getElementById("filter-clear-btn");

    const sortSelect = document.getElementById("sort-select");
    const backgroundToggle = document.getElementById("background-toggle");
    const inlineIconsToggle = document.getElementById("inline-icons-toggle");
    const sideBySideToggle = document.getElementById("side-by-side-toggle");
    const clearAllBtnWrapper = document.getElementById("clear-all-btn-wrapper");
    const downloadCustomOption = document.getElementById("download-custom-option");
    const downloadOptionsDropdown = document.getElementById("download-options-dropdown");
    const settingsDropdown = document.getElementById("settings-dropdown");
    const settingsTriggerWrapper = document.getElementById("settings-trigger-wrapper");
    const uploadSpellsInput = document.getElementById("upload-spells-input");
    const uploadSpellsBtn = document.getElementById("upload-spells-btn");
    const printBtn = document.getElementById("print-btn");
    const editOverlay = document.getElementById("edit-card-overlay");
    const editCardPreview = document.getElementById("edit-card-preview");
    const editCardForm = document.getElementById("edit-card-form");
    const editCardCancel = document.getElementById("edit-card-cancel");
    const editCardSave = document.getElementById("edit-card-save");
    const srdBanner = document.getElementById("srd-banner");
    const srdBannerText = document.getElementById("srd-banner-text");
    const srdBannerInfo = document.getElementById("srd-banner-info");
    const clearAllConfirmDialog = document.getElementById("clear-all-confirm-dialog");
    const clearAllConfirmCancel = document.getElementById("clear-all-confirm-cancel");
    const clearAllConfirmProceed = document.getElementById("clear-all-confirm-proceed");
    const srdExcludedDialog = document.getElementById("srd-excluded-dialog");
    const srdExcludedExplanation = document.getElementById(
        "srd-excluded-explanation"
    );
    const srdExcludedList = document.getElementById("srd-excluded-list");
    const srdExcludedCopy = document.getElementById("srd-excluded-copy");
    const printingInstructionsDialog = document.getElementById("printing-instructions-dialog");
    const showPrintingInstructionsOption = document.getElementById("show-printing-instructions-option");
    const toastEl = document.getElementById("toast");

    /** Off-screen container for card overflow measurement (must be in DOM). Used when calling card.render({ measureContainer }). */
    const measureContainer = document.createElement("div");
    measureContainer.style.cssText =
        "position:absolute;left:-9999px;top:-9999px;";
    document.body.appendChild(measureContainer);

    /** When true, spell list shows only SRD spells (or SRD-name variants). Disabled by "knock" easter egg. Resets on page reload. */
    let onlySRD = true;

    let spellClassMap = {};
    let pageWidthPx = 0;
    let scale = 1;
    /** @type {(import("./card.js").SpellCard | { type: "glossary"; id: string })[]} */
    let cardList = [];
    let editingCard = null;
    let editPreviewCard = null;
    let selectedListIndex = -1;
    let currentSpellResults = [];

    /** Selected filter values (source, class, level, school). Empty = no filter. */
    const filterValues = { source: [], class: [], level: [], school: [] };

    /** Spell classes for a spell (from spell.classes or spellClassMap). */
    function getSpellClasses(spell) {
        if (spell.classes && spell.classes.length > 0) return spell.classes;
        return spellClassMap[spell.id] || [];
    }

    /** List display name: when onlySRD, use SRD name if set; when vault open, always use real name. */
    function getSpellListDisplayName(spell) {
        if (!onlySRD) return spell.name;
        return typeof spell.isSRD === "string" ? spell.isSRD : spell.name;
    }

    /** Spells in scope for the current ruleset (2014 = exclude all 2024-only sources, 2024 = all). */
    function getSpellsForCurrentRuleset() {
        const list = getSpells();
        if (filterRuleset.checked) return list;
        return list.filter((spell) => !SOURCES_2024.includes(spell.source));
    }

    /**
     * For each spell name, the "preferred" source (newest reprint) for current ruleset.
     * 2024: XPHB if present, else first source for that name. Non-2024: prefer non-PHB over PHB.
     */
    function getPreferredSourceBySpellName() {
        const spellList = getSpellsForCurrentRuleset();
        const use2024 = filterRuleset.checked;
        const byName = new Map();
        spellList.forEach((spell) => {
            const name = spell.name;
            const existing = byName.get(name);
            if (!existing) {
                byName.set(name, spell.source);
                return;
            }
            if (use2024) {
                if (spell.source === "XPHB") byName.set(name, "XPHB");
            } else {
                if (existing === "PHB" && spell.source !== "PHB")
                    byName.set(name, spell.source);
            }
        });
        return byName;
    }

    /** Selected source values (spell.source). PHB chip = PHB + XPHB when 2024 ruleset, only PHB when 2014. */
    function getSelectedActualSources() {
        const spellList = getSpellsForCurrentRuleset();
        const chipSources = filterValues.source;
        if (chipSources.length === 0)
            return new Set(spellList.map((s) => s.source));
        const set = new Set();
        const use2024 = filterRuleset.checked;
        chipSources.forEach((src) => {
            if (src === "PHB") {
                set.add("PHB");
                if (use2024) set.add("XPHB");
            } else set.add(src);
        });
        return set;
    }

    /** Spells matching filters (class, level, source, school, exclude reprinted). Does not apply SRD filter. */
    function getFilteredSpellsWithoutSrd() {
        const spells = getSpellsForCurrentRuleset();
        const selectedClasses = filterValues.class;
        const selectedLevels = filterValues.level.map((l) =>
            l === "Cantrip" ? 0 : parseInt(l, 10)
        );
        const selectedSources = filterValues.source;
        const selectedSchools = filterValues.school;

        let result = spells.filter((spell) => {
            const spellClasses = getSpellClasses(spell);
            const classMatch =
                selectedClasses.length === 0 ||
                selectedClasses.some((c) => spellClasses.includes(c));
            const levelMatch =
                selectedLevels.length === 0 ||
                selectedLevels.includes(spell.level);
            const sourceMatch =
                selectedSources.length === 0 ||
                selectedSources.some((src) => {
                    if (src === "PHB") {
                        if (filterRuleset.checked)
                            return (
                                spell.source === "PHB" ||
                                spell.source === "XPHB"
                            );
                        return spell.source === "PHB";
                    }
                    return spell.source === src;
                });
            const schoolMatch =
                selectedSchools.length === 0 ||
                selectedSchools.includes(spell.school);
            return classMatch && levelMatch && sourceMatch && schoolMatch;
        });

        if (excludeReprintedToggle.checked) {
            const preferredByName = getPreferredSourceBySpellName();
            const selectedActual = getSelectedActualSources();
            result = result.filter((spell) => {
                const preferred = preferredByName.get(spell.name);
                if (!preferred) return true;
                if (spell.source === preferred) return true;
                if (!selectedActual.has(preferred)) return true;
                return false;
            });
        }

        return result;
    }

    /** Spells matching current filters; when onlySRD is true, only SRD spells (or uploaded). */
    function getFilteredSpells() {
        let result = getFilteredSpellsWithoutSrd();
        if (onlySRD) {
            result = result.filter(
                (spell) =>
                    spell._uploaded ||
                    spell.isSRD === true ||
                    typeof spell.isSRD === "string"
            );
        }
        return result;
    }

    /** Spells that would match filters but are excluded because they are not SRD (only when onlySRD; only from data, not uploaded). */
    function getSrdExcludedSpells() {
        if (!onlySRD) return [];
        return getFilteredSpellsWithoutSrd().filter(
            (spell) =>
                !spell._uploaded &&
                spell.isSRD !== true &&
                typeof spell.isSRD !== "string"
        );
    }

    /** Spells in the current filtered list that are shown under their SRD name (isSRD is a string). */
    function getSpellsWithSrdName() {
        if (!onlySRD) return [];
        return getFilteredSpells().filter(
            (spell) => typeof spell.isSRD === "string"
        );
    }

    /** Active filter chips for display (source, class, level, school). */
    function getActiveFilterChips() {
        const chips = [];
        const sources = filterValues.source;
        const classes = filterValues.class;
        const levels = filterValues.level;
        const schools = filterValues.school;
        sources.forEach((s) =>
            chips.push({
                key: "source",
                value: s,
                label: getFilterSourceLabel(s),
            })
        );
        classes.forEach((c) =>
            chips.push({ key: "class", value: c, label: c })
        );
        levels.forEach((l) => chips.push({ key: "level", value: l, label: l }));
        schools.forEach((s) =>
            chips.push({ key: "school", value: s, label: s })
        );
        return chips;
    }

    /** Removes a filter and re-renders spell list and chips. */
    function clearFilter(key, value) {
        filterValues[key] = filterValues[key].filter((v) => v !== value);
        renderSpellList();
        renderChips();
        updateFilterChipSelection(key);
    }

    /** Renders active filter chips with remove buttons (wa-tag with-remove, built-in styling). */
    function renderChips() {
        const chips = getActiveFilterChips();
        spellListChips.innerHTML = "";
        chips.forEach(({ key, value, label }) => {
            const tag = document.createElement("wa-tag");
            tag.setAttribute("with-remove", "");
            tag.setAttribute("size", "small");
            tag.setAttribute("variant", "neutral");
            tag.setAttribute("appearance", "filled");
            tag.textContent = label;
            tag.addEventListener("wa-remove", (event) => {
                event.preventDefault();
                clearFilter(key, value);
            });
            spellListChips.appendChild(tag);
        });
    }

    /** Renders filtered/searched spell list; caches result for "Add all". */
    function renderSpellList() {
        const filtered = getFilteredSpells();
        const query = (spellSearchInput.value || "").trim();
        let list = query
            ? filtered.filter((s) =>
                  fuzzyMatch(query, getSpellListDisplayName(s))
              )
            : filtered;
        // Sort by display name so SRD-name variants appear in correct alphabetical position
        list = [...list].sort((a, b) =>
            getSpellListDisplayName(a).localeCompare(
                getSpellListDisplayName(b),
                undefined,
                { sensitivity: "base" }
            )
        );
        currentSpellResults = list.slice();

        spellListCount.textContent = `${list.length} spell${
            list.length !== 1 ? "s" : ""
        }`;
        spellListAddAll.disabled = list.length === 0;

        // SRD banner: show when onlySRD and (excluded non-SRD or some spells show SRD name)
        const excludedBySrd = getSrdExcludedSpells();
        const showingSrdNameCount = onlySRD
            ? list.filter((s) => typeof s.isSRD === "string").length
            : 0;
        const showSrdBanner =
            onlySRD && (excludedBySrd.length > 0 || showingSrdNameCount > 0);
        if (srdBanner) {
            if (showSrdBanner) {
                srdBanner.classList.remove("hidden");
                srdBanner.setAttribute("aria-hidden", "false");
                const parts = [];
                if (excludedBySrd.length > 0)
                    parts.push(
                        `${excludedBySrd.length} non-SRD spell${
                            excludedBySrd.length !== 1 ? "s" : ""
                        } excluded`
                    );
                if (showingSrdNameCount > 0)
                    parts.push(
                        `${showingSrdNameCount} shown under SRD name${
                            showingSrdNameCount !== 1 ? "s" : ""
                        }`
                    );
                srdBannerText.textContent = parts.join("; ");
            } else {
                srdBanner.classList.add("hidden");
                srdBanner.setAttribute("aria-hidden", "true");
            }
        }

        spellList.innerHTML = "";
        const maxShow = 400;
        list.slice(0, maxShow).forEach((spell, idx) => {
            const row = document.createElement("wa-dropdown-item");
            row.className = "spell-list-item";
            row.setAttribute("value", String(idx));
            const sourceText = SOURCE_MAP[spell.source] || spell.source;
            const displayName = getSpellListDisplayName(spell);
            const label = document.createElement("span");
            label.className = "spell-list-item-label";
            const nameSpan = document.createElement("span");
            nameSpan.className = "spell-list-item-name";
            nameSpan.textContent = `${displayName}${spell._uploaded ? " *" : ""}`;
            const sourceSpan = document.createElement("span");
            sourceSpan.className = "spell-list-item-source";
            sourceSpan.textContent = ` ${sourceText}`;
            label.appendChild(nameSpan);
            label.appendChild(sourceSpan);
            row.appendChild(label);
            const count = countUnmodifiedInDeck(spell);
            if (count > 0) {
                const countBtn = document.createElement("wa-button");
                countBtn.setAttribute("variant", "neutral");
                countBtn.setAttribute("size", "small");
                countBtn.setAttribute("appearance", "filled");
                countBtn.setAttribute("pill", "");
                countBtn.className = "spell-list-count-btn";
                countBtn.setAttribute("slot", "details");
                countBtn.title = "Remove one from deck";
                countBtn.textContent = String(count);
                countBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    row._countClicked = true;
                    removeOneUnmodifiedCard(spell);
                });
                row.appendChild(countBtn);
            }
            spellList.appendChild(row);
        });
        if (list.length > maxShow) {
            const more = document.createElement("div");
            more.className = "spell-list-more";
            more.textContent = `... and ${
                list.length - maxShow
            } more. Narrow search.`;
            spellList.appendChild(more);
        }
        const previouslySelectedSpell =
            selectedListIndex >= 0 && list[selectedListIndex]
                ? list[selectedListIndex]
                : null;
        const previouslySelectedId = previouslySelectedSpell?.id;
        const newIndex =
            previouslySelectedId != null
                ? list.findIndex((s) => s.id === previouslySelectedId)
                : -1;
        selectedListIndex =
            newIndex >= 0 ? newIndex : list.length > 0 ? 0 : -1;
        updateListSelection();
        const isEmpty = list.length === 0;
        spellList.classList.toggle("hidden", isEmpty);
        const dividerAbove = spellList.previousElementSibling;
        if (dividerAbove?.tagName === "WA-DIVIDER") {
            dividerAbove.classList.toggle("hidden", isEmpty);
        }
    }

    /** Updates selected row: sync .selected class. Call focusSelectedItem() after this when focus should move to the list (e.g. after arrow key). */
    function updateListSelection() {
        const items = spellList.querySelectorAll("wa-dropdown-item.spell-list-item");
        items.forEach((el, i) => {
            el.classList.toggle("selected", i === selectedListIndex);
        });
    }

    function focusSelectedItem() {
        const items = spellList.querySelectorAll("wa-dropdown-item.spell-list-item");
        const toFocus = items[selectedListIndex];
        if (toFocus) toFocus.focus();
    }

    /** Adds a SpellCard to cardList, renders it, and optionally refreshes layout.
     * @param {object} spellData - Spell data for the card
     * @param {object} [originalSpell] - When adding from list, the list spell (stores id for reset)
     * @param {{ skipLayout?: boolean }} [opts] - If skipLayout: true, do not call refreshLayout (caller will refresh once)
     */
    async function addCard(spellData, originalSpell, opts = {}) {
        const card = new SpellCard(spellData);
        if (originalSpell) card.originalId = originalSpell.id;
        await card.render({ measureContainer });
        cardList.push(card);
        if (!opts.skipLayout) await refreshLayout();
    }

    /**
     * Count of unmodified cards in the deck matching this list spell (by spell id).
     */
    function countUnmodifiedInDeck(listSpell) {
        return cardList.filter(
            (c) =>
                c instanceof SpellCard &&
                !c.spell._modified &&
                c.spell.id === listSpell.id
        ).length;
    }

    /**
     * Removes one unmodified card matching the list spell from the deck (by spell id).
     */
    async function removeOneUnmodifiedCard(listSpell) {
        const idx = cardList.findIndex(
            (c) =>
                c instanceof SpellCard &&
                !c.spell._modified &&
                c.spell.id === listSpell.id
        );
        if (idx === -1) return;
        cardList.splice(idx, 1);
        await refreshLayout();
        requestAnimationFrame(() => renderSpellList());
    }

    /** Finds a SpellCard or glossary ref by id. */
    function getCardById(cardId) {
        return (
            cardList.find(
                (c) =>
                    (c instanceof SpellCard && c.id === cardId) ||
                    (isGlossaryRef(c) && c.id === cardId)
            ) || null
        );
    }

    /** Sorts spell cards by alphabetical, level, or school; glossary and blank cards first. */
    function sortCardList(list, sortBy) {
        const glossary = list.filter((c) => isGlossaryRef(c));
        const rest = list.filter((c) => !isGlossaryRef(c));
        const blank = rest.filter((c) => c.originalId == null);
        const withId = rest.filter((c) => c.originalId != null);
        const name = (c) => c.spell?.name ?? "";
        const level = (c) => c.spell?.level ?? 0;
        const school = (c) => c.spell?.school ?? "";
        if (sortBy === "alphabetical") {
            withId.sort((a, b) => name(a).localeCompare(name(b)));
        } else if (sortBy === "level") {
            withId.sort(
                (a, b) => level(a) - level(b) || name(a).localeCompare(name(b))
            );
        } else if (sortBy === "school") {
            withId.sort(
                (a, b) =>
                    school(a).localeCompare(school(b)) ||
                    level(a) - level(b) ||
                    name(a).localeCompare(name(b))
            );
        }
        return [...glossary, ...blank, ...withId];
    }

    /** Updates Download custom option, Print button, and Remove all visibility. */
    function updateDownloadCustomButton() {
        const hasModified = cardList.some(
            (c) => c instanceof SpellCard && c.spell._modified
        );
        if (downloadCustomOption) downloadCustomOption.disabled = !hasModified;
        if (printBtn) printBtn.disabled = cardList.length === 0;
        if (clearAllBtnWrapper) clearAllBtnWrapper.classList.toggle("hidden", cardList.length === 0);
    }

    /** Re-renders cards, applies grayscale (when “use spell school colors” is off), sorts, and calls layoutCards. */
    let refreshLayoutPromise = Promise.resolve();
    let refreshLayoutLastGrayscale = undefined;
    async function refreshLayout() {
        const run = (async () => {
            updatePageWidth();
            await new Promise((r) => requestAnimationFrame(r));
            document.body.classList.toggle("grayscale", !colorToggle.checked);
            document.body.classList.toggle(
                "use-inline-text",
                !inlineIconsToggle.checked
            );
            // Side-by-side only disabled when Show card back is on (re-apply so it stays correct after add/remove)
            sideBySideToggle.disabled = backgroundToggle.checked;
            // Re-render cards only when grayscale changed (colors are baked in at render time; inline icons use CSS/alt)
            const grayscale = !colorToggle.checked;
            if (refreshLayoutLastGrayscale !== grayscale) {
                refreshLayoutLastGrayscale = grayscale;
                for (const c of cardList) {
                    if (c instanceof SpellCard)
                        await c.render({ measureContainer });
                }
            }
            const sorted = sortCardList(cardList, sortSelect.value);
            const options = {
                defaultCardBack: backgroundToggle.checked,
                sideBySide: sideBySideToggle.checked && !backgroundToggle.checked,
            };
            await layoutCards(sorted, pageSizeSelect.value, printableArea, options);
            updateWrapperSizeAndPosition();
            updateDownloadCustomButton();
        })();
        refreshLayoutPromise = refreshLayoutPromise
            .then(() => run)
            .then(() => {}, () => {});
        return run;
    }

    /** Removes a card from cardList and refreshes layout. */
    async function removeCard(cardId) {
        const idx = cardList.findIndex(
            (c) =>
                (c instanceof SpellCard && c.id === cardId) ||
                (isGlossaryRef(c) && c.id === cardId)
        );
        if (idx === -1) return;
        cardList.splice(idx, 1);
        await refreshLayout();
    }

    /** Duplicates a SpellCard and inserts it after the original. */
    async function duplicateCard(cardId) {
        const idx = cardList.findIndex(
            (c) => c instanceof SpellCard && c.id === cardId
        );
        if (idx === -1) return;
        const card = cardList[idx];
        if (!(card instanceof SpellCard)) return;
        const newCard = card.duplicate();
        await newCard.render({ measureContainer });
        cardList.splice(idx + 1, 0, newCard);
        await refreshLayout();
    }

    /** Opens the edit overlay with a preview and form for the card's spell. */
    function openEditOverlay(card) {
        editingCard = card;
        if (!editPreviewCard)
            editPreviewCard = new SpellCard(cloneSpellData(card.spell));
        editPreviewCard.setSpellData(cloneSpellData(card.spell));
        editPreviewCard.render().then(() => {
            editCardPreview.innerHTML = "";
            if (editPreviewCard.frontElement) {
                const clone = editPreviewCard.frontElement.cloneNode(true);
                const actions = clone.querySelector(".card-actions");
                if (actions) actions.remove();
                editCardPreview.appendChild(clone);
            }
        });
        buildEditForm(card.spell);
        editOverlay.classList.remove("hidden");
        editOverlay.setAttribute("aria-hidden", "false");
    }

    /** Closes the edit overlay. */
    function closeEditOverlay() {
        editingCard = null;
        editOverlay.classList.add("hidden");
        editOverlay.setAttribute("aria-hidden", "true");
    }

    function buildEditForm(spell) {
        editCardForm.innerHTML = "";
        const addField = (label, name, value, type = "text", options = {}) => {
            const wrap = document.createElement("div");
            wrap.className = "form-field";
            const lab = document.createElement("label");
            lab.textContent = label;
            lab.htmlFor = `edit-${name}`;
            wrap.appendChild(lab);
            if (type === "textarea") {
                const ta = document.createElement("wa-textarea");
                ta.id = `edit-${name}`;
                ta.name = name;
                ta.value = value ?? "";
                ta.rows = options.rows || 3;
                wrap.appendChild(ta);
                ta.addEventListener("wa-input", () => updateEditPreview());
            } else if (type === "number") {
                const inp = document.createElement("wa-input");
                inp.type = "number";
                inp.id = `edit-${name}`;
                inp.name = name;
                inp.value = String(value ?? "");
                wrap.appendChild(inp);
                inp.addEventListener("wa-input", () => updateEditPreview());
            } else if (type === "select") {
                const sel = document.createElement("wa-select");
                sel.id = `edit-${name}`;
                sel.name = name;
                (options.choices || []).forEach((opt) => {
                    const o = document.createElement("wa-option");
                    o.value = opt.value;
                    o.textContent = opt.label;
                    sel.appendChild(o);
                });
                sel.value = value ?? "";
                wrap.appendChild(sel);
                sel.addEventListener("wa-change", () => updateEditPreview());
            } else if (type === "checkbox") {
                const cb = document.createElement("wa-checkbox");
                cb.id = `edit-${name}`;
                cb.name = name;
                cb.checked = !!value;
                wrap.appendChild(cb);
                cb.addEventListener("wa-change", () => updateEditPreview());
            } else {
                const inp = document.createElement("wa-input");
                inp.id = `edit-${name}`;
                inp.name = name;
                inp.value = value ?? "";
                wrap.appendChild(inp);
                inp.addEventListener("wa-input", () => updateEditPreview());
            }
            editCardForm.appendChild(wrap);
        };

        addField("Name", "name", spell.name);
        addField(
            "Level",
            "level",
            spell.level === 0 ? "0" : String(spell.level),
            "select",
            {
                choices: [
                    { value: "0", label: "Cantrip" },
                    ...Array.from({ length: 9 }, (_, i) => ({
                        value: String(i + 1),
                        label: String(i + 1),
                    })),
                ],
            }
        );
        addField("School", "school", spell.school, "select", {
            choices: SCHOOLS.map((s) => ({ value: s, label: s })),
        });
        addField("Source", "source", spell.source);
        addField(
            "Casting time (unit)",
            "time_unit",
            spell.time?.unit ?? "action",
            "select",
            {
                choices: [
                    { value: "action", label: "Action" },
                    { value: "bonus", label: "Bonus action" },
                    { value: "reaction", label: "Reaction" },
                    { value: "minute", label: "Minute(s)" },
                    { value: "hour", label: "Hour(s)" },
                ],
            }
        );
        const timeNumberWrap = document.createElement("div");
        timeNumberWrap.className = "form-field form-field-time-number";
        timeNumberWrap.id = "edit-time-number-wrap";
        const timeNumberLab = document.createElement("label");
        timeNumberLab.textContent = "Amount";
        timeNumberLab.htmlFor = "edit-time_number";
        timeNumberWrap.appendChild(timeNumberLab);
        const timeNumberInp = document.createElement("wa-input");
        timeNumberInp.type = "number";
        timeNumberInp.min = "1";
        timeNumberInp.id = "edit-time_number";
        timeNumberInp.name = "time_number";
        timeNumberInp.value = String(Math.max(1, spell.time?.number ?? 1));
        timeNumberWrap.appendChild(timeNumberInp);
        timeNumberInp.addEventListener("wa-input", () => updateEditPreview());
        editCardForm.appendChild(timeNumberWrap);
        const timeUnitSel = editCardForm.querySelector("#edit-time_unit");
        const showHideTimeNumber = () => {
            const unit = timeUnitSel?.value ?? "action";
            const showNumber = unit === "minute" || unit === "hour";
            timeNumberWrap.style.display = showNumber ? "" : "none";
            if (!showNumber) timeNumberInp.value = "1";
        };
        const timeConditionWrap = document.createElement("div");
        timeConditionWrap.className = "form-field form-field-time-condition";
        timeConditionWrap.id = "edit-time-condition-wrap";
        const timeConditionLab = document.createElement("label");
        timeConditionLab.textContent = "Reaction condition";
        timeConditionLab.htmlFor = "edit-time_condition";
        timeConditionWrap.appendChild(timeConditionLab);
        const timeConditionInp = document.createElement("wa-textarea");
        timeConditionInp.id = "edit-time_condition";
        timeConditionInp.name = "time_condition";
        timeConditionInp.value = spell.time?.condition ?? "";
        timeConditionInp.rows = 2;
        timeConditionWrap.appendChild(timeConditionInp);
        timeConditionInp.addEventListener("wa-input", () =>
            updateEditPreview()
        );
        editCardForm.appendChild(timeConditionWrap);
        const showHideTimeCondition = () => {
            const unit = timeUnitSel?.value ?? "action";
            const show = unit === "reaction";
            timeConditionWrap.style.display = show ? "" : "none";
            if (!show) timeConditionInp.value = "";
        };
        timeUnitSel?.addEventListener("wa-change", () => {
            showHideTimeNumber();
            showHideTimeCondition();
            updateEditPreview();
        });
        showHideTimeNumber();
        showHideTimeCondition();
        addField(
            "Concentration",
            "isConcentration",
            spell.isConcentration,
            "checkbox"
        );
        addField("Ritual", "isRitual", spell.isRitual, "checkbox");
        addField(
            "Range (origin)",
            "range_origin",
            spell.range?.origin ?? "point",
            "select",
            { choices: RANGE_ORIGINS }
        );
        const rangeDistanceWrap = document.createElement("div");
        rangeDistanceWrap.className = "form-field form-field-range-distance";
        rangeDistanceWrap.id = "edit-range-distance-wrap";
        const rangeDistLab = document.createElement("label");
        rangeDistLab.textContent = "Distance";
        rangeDistLab.htmlFor = "edit-range_distance";
        rangeDistanceWrap.appendChild(rangeDistLab);
        const rangeDistInp = document.createElement("wa-input");
        rangeDistInp.type = "number";
        rangeDistInp.min = "1";
        rangeDistInp.id = "edit-range_distance";
        rangeDistInp.name = "range_distance";
        rangeDistInp.value = String(Math.max(1, spell.range?.distance ?? 1));
        rangeDistanceWrap.appendChild(rangeDistInp);
        rangeDistInp.addEventListener("wa-input", () => updateEditPreview());
        editCardForm.appendChild(rangeDistanceWrap);
        const rangeUnitWrap = document.createElement("div");
        rangeUnitWrap.className = "form-field form-field-range-unit";
        rangeUnitWrap.id = "edit-range-unit-wrap";
        const rangeUnitLab = document.createElement("label");
        rangeUnitLab.textContent = "Unit";
        rangeUnitLab.htmlFor = "edit-range_unit";
        rangeUnitWrap.appendChild(rangeUnitLab);
        const rangeUnitSel = document.createElement("wa-select");
        rangeUnitSel.id = "edit-range_unit";
        rangeUnitSel.name = "range_unit";
        RANGE_UNITS.forEach((opt) => {
            const o = document.createElement("wa-option");
            o.value = opt.value;
            o.textContent = opt.label;
            rangeUnitSel.appendChild(o);
        });
        rangeUnitSel.value = spell.range?.unit ?? "feet";
        rangeUnitWrap.appendChild(rangeUnitSel);
        editCardForm.appendChild(rangeUnitWrap);
        const rangeOriginSel = editCardForm.querySelector("#edit-range_origin");
        const showHideRangeDistance = () => {
            const origin = rangeOriginSel?.value ?? "point";
            const unit = rangeUnitSel?.value ?? "feet";
            const showOriginPoint = origin === "point";
            const showDistance = showOriginPoint && unit !== "unlimited";
            rangeDistanceWrap.style.display = showDistance ? "" : "none";
            rangeUnitWrap.style.display = showOriginPoint ? "" : "none";
            if (!showOriginPoint) {
                rangeDistInp.value = "0";
                rangeUnitSel.value = "feet";
            } else if (unit === "unlimited") {
                rangeDistInp.value = "0";
            }
        };
        rangeOriginSel?.addEventListener("wa-change", () => {
            showHideRangeDistance();
            updateEditPreview();
        });
        rangeUnitSel?.addEventListener("wa-change", () => {
            showHideRangeDistance();
            updateEditPreview();
        });
        showHideRangeDistance();

        addField("Area", "range_area", spell.range?.area ?? "", "select", {
            choices: AREA_TYPES,
        });
        const areaDimsWrap = document.createElement("div");
        areaDimsWrap.className = "form-field form-field-area-dims";
        areaDimsWrap.id = "edit-area-dims-wrap";
        const areaPrimaryWrap = document.createElement("div");
        areaPrimaryWrap.className = "form-field form-field-area-primary";
        const areaPrimaryLab = document.createElement("label");
        areaPrimaryLab.id = "edit-area-primary-label";
        areaPrimaryLab.htmlFor = "edit-area_distance";
        areaPrimaryLab.textContent = "Size";
        areaPrimaryWrap.appendChild(areaPrimaryLab);
        const areaDistInp = document.createElement("wa-input");
        areaDistInp.type = "number";
        areaDistInp.min = "1";
        areaDistInp.id = "edit-area_distance";
        areaDistInp.name = "area_distance";
        areaDistInp.value = String(Math.max(1, spell.range?.areaDistance ?? 5));
        areaPrimaryWrap.appendChild(areaDistInp);
        areaDistInp.addEventListener("wa-input", () => updateEditPreview());
        const areaUnitWrap = document.createElement("div");
        areaUnitWrap.className = "form-field form-field-area-unit";
        const areaUnitLab = document.createElement("label");
        areaUnitLab.id = "edit-area-unit-label";
        areaUnitLab.textContent = "Unit";
        areaUnitLab.htmlFor = "edit-area_unit";
        areaUnitWrap.appendChild(areaUnitLab);
        const areaUnitSel = document.createElement("wa-select");
        areaUnitSel.id = "edit-area_unit";
        areaUnitSel.name = "area_unit";
        [
            { value: "feet", label: "Feet" },
            { value: "miles", label: "Miles" },
        ].forEach((opt) => {
            const o = document.createElement("wa-option");
            o.value = opt.value;
            o.textContent = opt.label;
            areaUnitSel.appendChild(o);
        });
        areaUnitSel.value = spell.range?.areaUnit ?? "feet";
        areaUnitWrap.appendChild(areaUnitSel);
        areaUnitSel.addEventListener("wa-change", () => updateEditPreview());
        areaDimsWrap.appendChild(areaPrimaryWrap);
        areaDimsWrap.appendChild(areaUnitWrap);
        const areaHeightWrap = document.createElement("div");
        areaHeightWrap.className = "form-field form-field-area-height";
        areaHeightWrap.id = "edit-area-height-wrap";
        const areaHeightLab = document.createElement("label");
        areaHeightLab.textContent = "Height";
        areaHeightLab.htmlFor = "edit-area_height";
        areaHeightWrap.appendChild(areaHeightLab);
        const areaHeightInp = document.createElement("wa-input");
        areaHeightInp.type = "number";
        areaHeightInp.min = "1";
        areaHeightInp.id = "edit-area_height";
        areaHeightInp.name = "area_height";
        areaHeightInp.value = String(Math.max(1, spell.range?.areaHeight ?? 5));
        areaHeightWrap.appendChild(areaHeightInp);
        areaHeightInp.addEventListener("wa-input", () => updateEditPreview());
        const areaHeightUnitWrap = document.createElement("div");
        areaHeightUnitWrap.className = "form-field form-field-area-height-unit";
        const areaHeightUnitLab = document.createElement("label");
        areaHeightUnitLab.textContent = "Height unit";
        areaHeightUnitLab.htmlFor = "edit-area_height_unit";
        areaHeightUnitWrap.appendChild(areaHeightUnitLab);
        const areaHeightUnitSel = document.createElement("wa-select");
        areaHeightUnitSel.id = "edit-area_height_unit";
        areaHeightUnitSel.name = "area_height_unit";
        [
            { value: "feet", label: "Feet" },
            { value: "miles", label: "Miles" },
        ].forEach((opt) => {
            const o = document.createElement("wa-option");
            o.value = opt.value;
            o.textContent = opt.label;
            areaHeightUnitSel.appendChild(o);
        });
        areaHeightUnitSel.value = spell.range?.areaHeightUnit ?? "feet";
        areaHeightUnitWrap.appendChild(areaHeightUnitSel);
        areaHeightUnitSel.addEventListener("wa-change", () =>
            updateEditPreview()
        );
        areaHeightWrap.appendChild(areaHeightUnitWrap);
        areaDimsWrap.appendChild(areaHeightWrap);
        editCardForm.appendChild(areaDimsWrap);
        const rangeAreaSel = editCardForm.querySelector("#edit-range_area");
        const showHideAreaDims = () => {
            const area = rangeAreaSel?.value ?? "";
            const show = area !== "";
            areaDimsWrap.style.display = show ? "" : "none";
            if (show) {
                const primaryLabel = document.getElementById(
                    "edit-area-primary-label"
                );
                if (primaryLabel)
                    primaryLabel.textContent =
                        AREA_DIMENSION_LABELS[area] ?? "Size";
                const areaUnitLabel = document.getElementById(
                    "edit-area-unit-label"
                );
                if (areaUnitLabel)
                    areaUnitLabel.textContent =
                        area === "cylinder" ? "Radius unit" : "Unit";
                areaHeightWrap.style.display =
                    area === "cylinder" ? "" : "none";
                if (area === "cylinder") {
                    if (
                        areaHeightInp.value === "0" ||
                        areaHeightInp.value === ""
                    ) {
                        areaHeightInp.value = "5";
                        areaHeightUnitSel.value = "feet";
                    }
                } else {
                    areaHeightInp.value = "5";
                    areaHeightUnitSel.value = "feet";
                }
            } else {
                areaDistInp.value = "0";
                areaUnitSel.value = "feet";
                areaHeightInp.value = "0";
                areaHeightUnitSel.value = "feet";
            }
            if (
                show &&
                area &&
                (areaDistInp.value === "0" || areaDistInp.value === "")
            ) {
                areaDistInp.value = "5";
            }
        };
        rangeAreaSel?.addEventListener("wa-change", () => {
            showHideAreaDims();
            updateEditPreview();
        });
        showHideAreaDims();

        addField(
            "Requires sight",
            "range_requires_sight",
            spell.range?.requiresSight ?? false,
            "checkbox"
        );
        addField(
            "Number of targets",
            "range_targets",
            spell.range?.targets ?? 0,
            "number"
        );

        addField(
            "Duration (type)",
            "duration_type",
            spell.duration?.type ?? "timed",
            "select",
            { choices: DURATION_TYPES }
        );
        const durationAmountWrap = document.createElement("div");
        durationAmountWrap.className = "form-field form-field-duration-amount";
        durationAmountWrap.id = "edit-duration-amount-wrap";
        const durationAmountLab = document.createElement("label");
        durationAmountLab.textContent = "Amount";
        durationAmountLab.htmlFor = "edit-duration_amount";
        durationAmountWrap.appendChild(durationAmountLab);
        const durationAmountInp = document.createElement("wa-input");
        durationAmountInp.type = "number";
        durationAmountInp.min = "1";
        durationAmountInp.id = "edit-duration_amount";
        durationAmountInp.name = "duration_amount";
        durationAmountInp.value = String(
            Math.max(1, spell.duration?.amount ?? 1)
        );
        durationAmountWrap.appendChild(durationAmountInp);
        durationAmountInp.addEventListener("wa-input", () =>
            updateEditPreview()
        );
        editCardForm.appendChild(durationAmountWrap);
        const durationUnitWrap = document.createElement("div");
        durationUnitWrap.className = "form-field form-field-duration-unit";
        durationUnitWrap.id = "edit-duration-unit-wrap";
        const durationUnitLab = document.createElement("label");
        durationUnitLab.textContent = "Unit";
        durationUnitLab.htmlFor = "edit-duration_unit";
        durationUnitWrap.appendChild(durationUnitLab);
        const durationUnitSel = document.createElement("wa-select");
        durationUnitSel.id = "edit-duration_unit";
        durationUnitSel.name = "duration_unit";
        DURATION_UNITS.forEach((opt) => {
            const o = document.createElement("wa-option");
            o.value = opt.value;
            o.textContent = opt.label;
            durationUnitSel.appendChild(o);
        });
        durationUnitSel.value = spell.duration?.unit ?? "minute";
        durationUnitWrap.appendChild(durationUnitSel);
        durationUnitSel.addEventListener("wa-change", () =>
            updateEditPreview()
        );
        editCardForm.appendChild(durationUnitWrap);
        const durationEndsWrap = document.createElement("div");
        durationEndsWrap.className = "form-field form-field-duration-ends";
        durationEndsWrap.id = "edit-duration-ends-wrap";
        const durationEndsLab = document.createElement("label");
        durationEndsLab.textContent = "Ending conditions";
        durationEndsWrap.appendChild(durationEndsLab);
        const durationEndsList = document.createElement("div");
        durationEndsList.className = "duration-ends-tokens";
        const durationEnds = spell.duration?.ends ?? [];
        DURATION_END_OPTIONS.forEach(({ value, label }) => {
            const tag = document.createElement("wa-tag");
            tag.className = "duration-end-tag";
            tag.setAttribute("size", "small");
            tag.setAttribute("appearance", "filled");
            tag.dataset.value = value;
            tag.textContent = label;
            tag.variant = durationEnds.includes(value) ? "brand" : "neutral";
            tag.addEventListener("click", () => {
                const container = document.getElementById(
                    "edit-duration-ends-wrap"
                );
                const tags = container.querySelectorAll(".duration-end-tag");
                const ends = Array.from(tags)
                    .filter((t) => t.variant === "brand")
                    .map((t) => t.dataset.value);
                const idx = ends.indexOf(value);
                if (idx >= 0) ends.splice(idx, 1);
                else ends.push(value);
                tags.forEach((t) => {
                    t.variant = ends.includes(t.dataset.value)
                        ? "brand"
                        : "neutral";
                });
                updateEditPreview();
            });
            durationEndsList.appendChild(tag);
        });
        durationEndsWrap.appendChild(durationEndsList);
        editCardForm.appendChild(durationEndsWrap);
        const durationTypeSel = editCardForm.querySelector(
            "#edit-duration_type"
        );
        const showHideDurationExtras = () => {
            const type = durationTypeSel?.value ?? "timed";
            const showAmount = type === "timed";
            const showEnds = type === "permanent";
            durationAmountWrap.style.display = showAmount ? "" : "none";
            durationUnitWrap.style.display = showAmount ? "" : "none";
            durationEndsWrap.style.display = showEnds ? "" : "none";
            if (!showAmount) {
                durationAmountInp.value = "1";
                durationUnitSel.value = "minute";
            }
        };
        durationTypeSel?.addEventListener("wa-change", () => {
            showHideDurationExtras();
            updateEditPreview();
        });
        showHideDurationExtras();

        addField(
            "Components V",
            "components_v",
            spell.components?.v,
            "checkbox"
        );
        addField(
            "Components S",
            "components_s",
            spell.components?.s,
            "checkbox"
        );
        addField(
            "Components M",
            "components_m",
            spell.components?.m,
            "checkbox"
        );
        const componentsMaterialWrap = document.createElement("div");
        componentsMaterialWrap.className =
            "form-field form-field-components-material";
        componentsMaterialWrap.id = "edit-components-material-wrap";
        const componentsHasCostLab = document.createElement("label");
        componentsHasCostLab.htmlFor = "edit-components_has_cost";
        componentsHasCostLab.textContent = "Material has cost";
        const componentsHasCostCb = document.createElement("wa-checkbox");
        componentsHasCostCb.id = "edit-components_has_cost";
        componentsHasCostCb.name = "components_has_cost";
        componentsHasCostCb.checked = !!spell.components?.hasCost;
        componentsMaterialWrap.appendChild(componentsHasCostLab);
        componentsMaterialWrap.appendChild(componentsHasCostCb);
        componentsHasCostCb.addEventListener("wa-change", () => {
            showHideComponentsConsumed();
            updateEditPreview();
        });
        editCardForm.appendChild(componentsMaterialWrap);
        const componentsConsumedWrap = document.createElement("div");
        componentsConsumedWrap.className =
            "form-field form-field-components-consumed";
        componentsConsumedWrap.id = "edit-components-consumed-wrap";
        const componentsConsumedLab = document.createElement("label");
        componentsConsumedLab.htmlFor = "edit-components_is_consumed";
        componentsConsumedLab.textContent = "Consumed";
        const componentsConsumedCb = document.createElement("wa-checkbox");
        componentsConsumedCb.id = "edit-components_is_consumed";
        componentsConsumedCb.name = "components_is_consumed";
        componentsConsumedCb.checked = !!spell.components?.isConsumed;
        componentsConsumedWrap.appendChild(componentsConsumedLab);
        componentsConsumedWrap.appendChild(componentsConsumedCb);
        componentsConsumedCb.addEventListener("wa-change", () =>
            updateEditPreview()
        );
        editCardForm.appendChild(componentsConsumedWrap);
        const componentsDescWrap = document.createElement("div");
        componentsDescWrap.className =
            "form-field form-field-components-description";
        componentsDescWrap.id = "edit-components-description-wrap";
        const componentsDescLab = document.createElement("label");
        componentsDescLab.textContent = "Component description";
        componentsDescLab.htmlFor = "edit-components_description";
        componentsDescWrap.appendChild(componentsDescLab);
        const componentsDescInp = document.createElement("wa-input");
        componentsDescInp.id = "edit-components_description";
        componentsDescInp.name = "components_description";
        componentsDescInp.value = spell.components?.description ?? "";
        componentsDescWrap.appendChild(componentsDescInp);
        componentsDescInp.addEventListener("wa-input", () =>
            updateEditPreview()
        );
        editCardForm.appendChild(componentsDescWrap);
        const componentsMCb = editCardForm.querySelector("#edit-components_m");
        const showHideComponentsMaterial = () => {
            const material = componentsMCb?.checked ?? false;
            componentsMaterialWrap.style.display = material ? "" : "none";
            componentsConsumedWrap.style.display = material ? "" : "none";
            componentsDescWrap.style.display = material ? "" : "none";
            if (!material) {
                componentsHasCostCb.checked = false;
                componentsConsumedCb.checked = false;
                componentsDescInp.value = "";
            }
            showHideComponentsConsumed();
        };
        const showHideComponentsConsumed = () => {
            const hasCost = componentsHasCostCb?.checked ?? false;
            componentsConsumedWrap.style.display =
                componentsMCb?.checked && hasCost ? "" : "none";
            if (!hasCost) componentsConsumedCb.checked = false;
        };
        componentsMCb?.addEventListener("wa-change", () => {
            showHideComponentsMaterial();
            updateEditPreview();
        });
        showHideComponentsMaterial();

        addField("Description", "description", spell.description, "textarea", {
            rows: 6,
        });
        addField("At higher levels", "upcast", spell.upcast || "", "textarea", {
            rows: 2,
        });
        const classesWrap = document.createElement("div");
        classesWrap.className = "form-field form-field-classes";
        classesWrap.id = "edit-classes-wrap";
        const classesLab = document.createElement("label");
        classesLab.textContent = "Classes";
        classesWrap.appendChild(classesLab);
        const classesTokens = document.createElement("div");
        classesTokens.className = "edit-classes-tokens";
        const spellClasses = spell.classes || [];
        SPELL_CLASSES.forEach((className) => {
            const tag = document.createElement("wa-tag");
            tag.className = "edit-class-tag";
            tag.setAttribute("size", "small");
            tag.setAttribute("appearance", "filled");
            tag.dataset.value = className;
            tag.textContent = className;
            tag.variant = spellClasses.includes(className)
                ? "brand"
                : "neutral";
            tag.addEventListener("click", () => {
                const wrap = document.getElementById("edit-classes-wrap");
                const tags = wrap.querySelectorAll(".edit-class-tag");
                const selected = Array.from(tags)
                    .filter((t) => t.variant === "brand")
                    .map((t) => t.dataset.value);
                const idx = selected.indexOf(className);
                if (idx >= 0) selected.splice(idx, 1);
                else selected.push(className);
                tags.forEach((t) => {
                    t.variant = selected.includes(t.dataset.value)
                        ? "brand"
                        : "neutral";
                });
                updateEditPreview();
            });
            classesTokens.appendChild(tag);
        });
        classesWrap.appendChild(classesTokens);
        editCardForm.appendChild(classesWrap);
    }

    /** Reads form values and returns a spell object. */
    function getEditFormData() {
        const spell = editingCard
            ? cloneSpellData(editingCard.spell)
            : emptySpellTemplate();
        spell.name =
            editCardForm.querySelector("#edit-name")?.value ?? spell.name;
        spell.level = parseInt(
            editCardForm.querySelector("#edit-level")?.value ?? "0",
            10
        );
        spell.school =
            editCardForm.querySelector("#edit-school")?.value ?? spell.school;
        spell.source =
            editCardForm.querySelector("#edit-source")?.value ?? spell.source;
        spell.time = spell.time || { number: 1, unit: "action" };
        spell.time.number = Math.max(
            1,
            parseInt(
                editCardForm.querySelector("#edit-time_number")?.value ?? "1",
                10
            )
        );
        spell.time.unit =
            editCardForm.querySelector("#edit-time_unit")?.value ?? "action";
        spell.time.condition =
            spell.time.unit === "reaction"
                ? (
                      editCardForm.querySelector("#edit-time_condition")
                          ?.value ?? ""
                  ).trim()
                : "";
        spell.range = spell.range || {};
        spell.range.origin =
            editCardForm.querySelector("#edit-range_origin")?.value ??
            spell.range.origin;
        const rangeOrigin = spell.range.origin;
        if (rangeOrigin === "point") {
            spell.range.unit =
                editCardForm.querySelector("#edit-range_unit")?.value ?? "feet";
            spell.range.distance =
                spell.range.unit === "unlimited"
                    ? 0
                    : Math.max(
                          1,
                          parseInt(
                              editCardForm.querySelector("#edit-range_distance")
                                  ?.value ?? "1",
                              10
                          )
                      );
        } else {
            spell.range.distance = 0;
            spell.range.unit = "";
        }
        spell.range.area =
            editCardForm.querySelector("#edit-range_area")?.value ?? "";
        if (spell.range.area) {
            spell.range.areaDistance = Math.max(
                1,
                parseInt(
                    editCardForm.querySelector("#edit-area_distance")?.value ??
                        "1",
                    10
                )
            );
            spell.range.areaUnit =
                editCardForm.querySelector("#edit-area_unit")?.value ?? "feet";
            spell.range.areaHeight = Math.max(
                1,
                parseInt(
                    editCardForm.querySelector("#edit-area_height")?.value ??
                        "1",
                    10
                )
            );
            spell.range.areaHeightUnit =
                editCardForm.querySelector("#edit-area_height_unit")?.value ??
                "feet";
        } else {
            spell.range.areaDistance = 0;
            spell.range.areaUnit = "";
            spell.range.areaHeight = 0;
            spell.range.areaHeightUnit = "";
        }
        spell.range.requiresSight =
            editCardForm.querySelector("#edit-range_requires_sight")?.checked ??
            false;
        spell.range.targets = parseInt(
            editCardForm.querySelector("#edit-range_targets")?.value ?? "0",
            10
        );
        spell.components = spell.components || {
            v: false,
            s: false,
            m: false,
            hasCost: false,
            isConsumed: false,
            description: "",
        };
        spell.components.v =
            editCardForm.querySelector("#edit-components_v")?.checked ?? false;
        spell.components.s =
            editCardForm.querySelector("#edit-components_s")?.checked ?? false;
        spell.components.m =
            editCardForm.querySelector("#edit-components_m")?.checked ?? false;
        spell.components.hasCost =
            editCardForm.querySelector("#edit-components_has_cost")?.checked ??
            false;
        spell.components.isConsumed =
            editCardForm.querySelector("#edit-components_is_consumed")
                ?.checked ?? false;
        spell.components.description =
            editCardForm.querySelector("#edit-components_description")?.value ??
            "";
        spell.duration = spell.duration || {
            type: "timed",
            amount: 1,
            unit: "minute",
            ends: [],
        };
        spell.duration.type =
            editCardForm.querySelector("#edit-duration_type")?.value ??
            spell.duration.type;
        const durationType = spell.duration.type;
        if (durationType === "timed") {
            spell.duration.amount = Math.max(
                1,
                parseInt(
                    editCardForm.querySelector("#edit-duration_amount")
                        ?.value ?? "1",
                    10
                )
            );
            spell.duration.unit =
                editCardForm.querySelector("#edit-duration_unit")?.value ??
                "minute";
        } else {
            spell.duration.amount = 0;
            spell.duration.unit = "";
        }
        if (durationType === "permanent") {
            const endsWrap = editCardForm.querySelector(
                "#edit-duration-ends-wrap"
            );
            spell.duration.ends = endsWrap
                ? Array.from(endsWrap.querySelectorAll(".duration-end-tag"))
                      .filter((t) => t.variant === "brand")
                      .map((t) => t.dataset.value)
                : [];
        } else {
            spell.duration.ends = [];
        }
        spell.description =
            editCardForm.querySelector("#edit-description")?.value ?? "";
        spell.isConcentration =
            editCardForm.querySelector("#edit-isConcentration")?.checked ??
            false;
        spell.isRitual =
            editCardForm.querySelector("#edit-isRitual")?.checked ?? false;
        spell.upcast = editCardForm.querySelector("#edit-upcast")?.value ?? "";
        const classesWrap = editCardForm.querySelector("#edit-classes-wrap");
        spell.classes = classesWrap
            ? Array.from(classesWrap.querySelectorAll(".edit-class-tag"))
                  .filter((t) => t.variant === "brand")
                  .map((t) => t.dataset.value)
            : [];
        spell._modified = true;
        return spell;
    }

    let editPreviewTimeout = null;
    /** Debounced update of the edit overlay preview from form data. */
    function updateEditPreview() {
        if (!editPreviewCard) return;
        clearTimeout(editPreviewTimeout);
        editPreviewTimeout = setTimeout(async () => {
            const data = getEditFormData();
            editPreviewCard.setSpellData(data);
            await editPreviewCard.render();
            editCardPreview.innerHTML = "";
            if (editPreviewCard.frontElement) {
                const clone = editPreviewCard.frontElement.cloneNode(true);
                const actions = clone.querySelector(".card-actions");
                if (actions) actions.remove();
                editCardPreview.appendChild(clone);
            }
        }, 200);
    }

    /** Applies form data to editing card, closes overlay, refreshes layout. */
    async function saveEditCard() {
        if (!editingCard) return;
        const data = getEditFormData();
        editingCard.setSpellData(data);
        await editingCard.render({ measureContainer });
        closeEditOverlay();
        await refreshLayout();
    }

    /** Loads all spells from file, repopulates filters, refreshes layout. */
    async function reloadData() {
        const loaded = await loadSpells();
        spellClassMap = loaded.spellClassMap;
        await populateFilterChips();
        renderSpellList();
        renderChips();
        await refreshLayout();
    }

    /** Refreshes filter options and spell list from current data (e.g. after ruleset change). No reload from file. */
    async function refreshFiltersAndList() {
        await populateFilterChips();
        renderSpellList();
        renderChips();
        refreshLayout();
    }

    /** Updates the selected visual state of chips for a filter key. */
    function updateFilterChipSelection(key) {
        const container =
            key === "source"
                ? filterSourceChips
                : key === "class"
                ? filterClassChips
                : key === "level"
                ? filterLevelChips
                : filterSchoolChips;
        const selected = new Set(filterValues[key]);
        container.querySelectorAll(".filter-chip").forEach((chip) => {
            const val = chip.dataset.value;
            const isSelected = selected.has(val);
            chip.setAttribute("variant", isSelected ? "brand" : "neutral");
            if (key === "class" && chip.dataset.iconUrl) {
                const img = chip.querySelector(".filter-class-icon img");
                if (img && chip.dataset.iconUrlSelected)
                    img.src = isSelected ? chip.dataset.iconUrlSelected : chip.dataset.iconUrl;
            }
        });
    }

    /** Creates a clickable filter chip (wa-button) that toggles selection. Small, filled, neutral → brand when selected. */
    function createFilterChip(key, value, label, options = {}) {
        const btn = document.createElement("wa-button");
        btn.className = "filter-chip filter-chip--" + key;
        btn.dataset.value = value;
        btn.setAttribute("size", "small");
        btn.setAttribute("appearance", "filled");
        const isSelected = filterValues[key].includes(value);
        btn.setAttribute("variant", isSelected ? "brand" : "neutral");
        if (key === "class" && options.iconUrl) {
            btn.dataset.iconUrl = options.iconUrl;
            if (options.iconUrlSelected) btn.dataset.iconUrlSelected = options.iconUrlSelected;
            const iconSpan = document.createElement("span");
            iconSpan.className = "filter-class-icon";
            iconSpan.setAttribute("slot", "start");
            const img = document.createElement("img");
            img.src = isSelected && options.iconUrlSelected
                ? options.iconUrlSelected
                : options.iconUrl;
            img.alt = "";
            iconSpan.appendChild(img);
            btn.appendChild(iconSpan);
            btn.appendChild(document.createTextNode(" " + label));
        } else {
            btn.textContent = label;
        }
        if (key === "school" && schoolColorMap[value]) {
            btn.style.setProperty("--chip-school-color", schoolColorMap[value]);
        }
        btn.addEventListener("click", () => {
            const arr = filterValues[key];
            const idx = arr.indexOf(value);
            if (idx >= 0) arr.splice(idx, 1);
            else arr.push(value);
            renderSpellList();
            renderChips();
            updateFilterChipSelection(key);
            updateClearFilterButtonVisibility();
        });
        return btn;
    }

    /** Show or hide the clear-filters button based on whether any chip filter is set. */
    function updateClearFilterButtonVisibility() {
        const anySet =
            filterValues.source.length > 0 ||
            filterValues.class.length > 0 ||
            filterValues.level.length > 0 ||
            filterValues.school.length > 0;
        filterClearBtn.classList.toggle("hidden", !anySet);
    }

    /** Populates filter chip lists from current spells; preserves valid selections. */
    async function populateFilterChips() {
        const prevSources = [...filterValues.source];
        const prevClasses = [...filterValues.class];
        const prevLevels = [...filterValues.level];
        const prevSchools = [...filterValues.school];

        const spells = getSpellsForCurrentRuleset();
        const allClasses = new Set();
        const allLevels = new Set();
        const allSources = new Set();
        const allSchools = new Set();

        spells.forEach((spell) => {
            getSpellClasses(spell).forEach((c) => allClasses.add(c));
            allLevels.add(spell.level === 0 ? "Cantrip" : String(spell.level));
            if (spell.source === "XPHB" || spell.source === "PHB")
                allSources.add("PHB");
            else allSources.add(spell.source);
            if (spell.school) allSchools.add(spell.school);
        });

        const sanitizeValues = (values, allowed) =>
            (values || []).filter((val) => allowed.has(val));
        filterValues.source = sanitizeValues(prevSources, allSources);
        filterValues.class = sanitizeValues(prevClasses, allClasses);
        filterValues.level = sanitizeValues(prevLevels, allLevels);
        filterValues.school = sanitizeValues(prevSchools, allSchools);

        const fillChips = (
            container,
            options,
            key,
            sortFn,
            labelFn = (v) => v,
            extraOpts = (v) => ({})
        ) => {
            container.innerHTML = "";
            [...options].sort(sortFn).forEach((val) => {
                container.appendChild(
                    createFilterChip(key, val, labelFn(val), extraOpts(val))
                );
            });
        };

        const levelSort = (a, b) => {
            if (a === "Cantrip") return -1;
            if (b === "Cantrip") return 1;
            return parseInt(a, 10) - parseInt(b, 10);
        };

        /** Full source name for filter menu (ruleset-dependent for PHB). */
        const getFilterSourceLabelFull = (source) => {
            if (source === "PHB")
                return filterRuleset.checked
                    ? SOURCE_DISPLAY_NAMES.XPHB
                    : SOURCE_DISPLAY_NAMES.PHB;
            return SOURCE_DISPLAY_NAMES[source] || SOURCE_MAP[source] || source;
        };

        fillChips(
            filterSourceChips,
            allSources,
            "source",
            undefined,
            getFilterSourceLabelFull
        );
        const classList = [...allClasses].sort();
        const classIconUrls = {};
        const chipTextColor = "#374151";
        const brandOnNormal = getComputedStyle(document.documentElement).getPropertyValue("--wa-color-brand-30").trim() || "#612692";
        await Promise.all(
            classList.map(async (c) => {
                const iconName = "icon-" + c.toLowerCase();
                classIconUrls[c] = {
                    default: await load_icon(iconName, "transparent", chipTextColor),
                    selected: await load_icon(iconName, "transparent", brandOnNormal),
                };
            })
        );
        filterClassChips.innerHTML = "";
        classList.forEach((c) => {
            filterClassChips.appendChild(
                createFilterChip("class", c, c, {
                    iconUrl: classIconUrls[c].default,
                    iconUrlSelected: classIconUrls[c].selected,
                })
            );
        });
        fillChips(filterLevelChips, allLevels, "level", levelSort);
        fillChips(filterSchoolChips, allSchools, "school");
        updateClearFilterButtonVisibility();
    }

    /** Adjusts main container size for header height (only when header is fixed). */
    function handleZoom() {
        const isSpellCards = header.classList.contains("header--spell-cards");
        if (isSpellCards) {
            mainContainer.style.marginTop = "";
            mainContainer.style.height = "";
        } else {
            const headerHeight = header.getBoundingClientRect().height;
            mainContainer.style.marginTop = `${headerHeight}px`;
            mainContainer.style.height = `calc(100vh - ${headerHeight}px)`;
        }
    }

    /** Updates printable-area wrapper dimensions for zoom/scale. */
    function updateWrapperSizeAndPosition() {
        const wrapperWidth = pageWidthPx * scale;
        const wrapperHeight = printableArea.scrollHeight * scale;
        printableAreaWrapper.style.width = `${wrapperWidth}px`;
        printableAreaWrapper.style.height = `${wrapperHeight}px`;
    }

    /** Builds full non-SRD dialog text for copy (different name first, then excluded). */
    function getSrdExcludedListText() {
        const excluded = getSrdExcludedSpells();
        const withSrdName = getSpellsWithSrdName();
        const lines = [];

        if (withSrdName.length > 0) {
            lines.push("Different name outside the SRD");
            lines.push("");
            const bySource = new Map();
            withSrdName.forEach((spell) => {
                const src = spell.source;
                if (!bySource.has(src)) bySource.set(src, []);
                bySource.get(src).push(spell);
            });
            const sourceOrder = [...bySource.keys()].sort((a, b) => {
                const labelA = SOURCE_MAP[a] || a;
                const labelB = SOURCE_MAP[b] || b;
                return labelA.localeCompare(labelB);
            });
            sourceOrder.forEach((src) => {
                const label = SOURCE_MAP[src] || src;
                lines.push(label);
                bySource
                    .get(src)
                    .sort((a, b) => (a.isSRD || "").localeCompare(b.isSRD || ""))
                    .forEach((spell) => {
                        lines.push(`  ${spell.isSRD}`);
                    });
                lines.push("");
            });
        }

        if (excluded.length > 0) {
            lines.push("Matching non-SRD spells");
            lines.push("");
            const bySource = new Map();
            excluded.forEach((spell) => {
                const src = spell.source;
                if (!bySource.has(src)) bySource.set(src, []);
                bySource.get(src).push(spell.name);
            });
            const sourceOrder = [...bySource.keys()].sort((a, b) => {
                const labelA = SOURCE_MAP[a] || a;
                const labelB = SOURCE_MAP[b] || b;
                return labelA.localeCompare(labelB);
            });
            sourceOrder.forEach((src) => {
                const label = SOURCE_MAP[src] || src;
                lines.push(label);
                bySource
                    .get(src)
                    .sort((a, b) => a.localeCompare(b))
                    .forEach((name) => {
                        lines.push(`  ${name}`);
                    });
                lines.push("");
            });
        }

        return lines.join("\n").trim();
    }

    /** Opens the non-SRD excluded dialog and populates it. */
    function openSrdExcludedDialog() {
        const excluded = getSrdExcludedSpells();
        const withSrdName = getSpellsWithSrdName();
        srdExcludedExplanation.textContent =
            "The following spells match your filters but are not part of the SRD, or have a different name outside the SRD. If you own the corresponding source book, you can add/edit them manually.";
        srdExcludedList.innerHTML = "";

        if (withSrdName.length > 0) {
            const sectionTitle = document.createElement("div");
            sectionTitle.className = "srd-section-title";
            sectionTitle.textContent = "Different name outside the SRD";
            srdExcludedList.appendChild(sectionTitle);
            const bySource = new Map();
            withSrdName.forEach((spell) => {
                const src = spell.source;
                if (!bySource.has(src)) bySource.set(src, []);
                bySource.get(src).push(spell);
            });
            const sourceOrder = [...bySource.keys()].sort((a, b) => {
                const labelA = SOURCE_MAP[a] || a;
                const labelB = SOURCE_MAP[b] || b;
                return labelA.localeCompare(labelB);
            });
            sourceOrder.forEach((src) => {
                const group = document.createElement("div");
                group.className = "srd-source-group";
                const label = document.createElement("div");
                label.className = "srd-source-name";
                label.textContent = SOURCE_MAP[src] || src;
                group.appendChild(label);
                bySource
                    .get(src)
                    .sort((a, b) => (a.isSRD || "").localeCompare(b.isSRD || ""))
                    .forEach((spell) => {
                        const div = document.createElement("div");
                        div.className = "srd-spell-name";
                        div.textContent = spell.isSRD;
                        group.appendChild(div);
                    });
                srdExcludedList.appendChild(group);
            });
        }

        if (excluded.length > 0) {
            const sectionTitle = document.createElement("div");
            sectionTitle.className = "srd-section-title";
            sectionTitle.textContent = "Matching non-SRD spells";
            srdExcludedList.appendChild(sectionTitle);
            const bySource = new Map();
            excluded.forEach((spell) => {
                const src = spell.source;
                if (!bySource.has(src)) bySource.set(src, []);
                bySource.get(src).push(spell);
            });
            const sourceOrder = [...bySource.keys()].sort((a, b) => {
                const labelA = SOURCE_MAP[a] || a;
                const labelB = SOURCE_MAP[b] || b;
                return labelA.localeCompare(labelB);
            });
            sourceOrder.forEach((src) => {
                const group = document.createElement("div");
                group.className = "srd-source-group";
                const label = document.createElement("div");
                label.className = "srd-source-name";
                label.textContent = SOURCE_MAP[src] || src;
                group.appendChild(label);
                bySource
                    .get(src)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .forEach((spell) => {
                        const div = document.createElement("div");
                        div.className = "srd-spell-name";
                        div.textContent = spell.name;
                        group.appendChild(div);
                    });
                srdExcludedList.appendChild(group);
            });
        }

        if (excluded.length === 0 && withSrdName.length === 0) {
            const p = document.createElement("p");
            p.textContent = "None.";
            srdExcludedList.appendChild(p);
        }

        if (srdExcludedDialog) srdExcludedDialog.open = true;
    }

    /** Shows the "vault opens" toast and disables SRD-only filtering. If already open, shows a different toast. */
    function disableOnlySrdAndToast() {
        if (!onlySRD) {
            if (toastEl) {
                toastEl.textContent = "The vault is already open.";
                toastEl.classList.remove("hidden");
                toastEl.style.fontStyle = "italic";
                setTimeout(() => {
                    toastEl.classList.add("hidden");
                }, 3000);
            }
            return;
        }
        onlySRD = false;
        document.body.classList.add("vault-open");
        if (toastEl) {
            toastEl.textContent =
                "With a widely-audible knock, the vault to all spells opens.";
            toastEl.classList.remove("hidden");
            toastEl.style.fontStyle = "italic";
            setTimeout(() => {
                toastEl.classList.add("hidden");
            }, 5000);
        }
        renderSpellList();
        renderChips();
    }

    /** Opens a new window with only the card pages and triggers print (Save as PDF). */
    function openPrintWindow() {
        const pages = printableArea.querySelectorAll(".page");
        if (!pages.length) return;
        const pageSize = pageSizeSelect.value;
        const isLetter = pageSize === "letter";
        const baseUrl = new URL(".", window.location.href).href;
        const contentHref = baseUrl + "css/card.css";
        const printHref = baseUrl + "css/card-print.css";

        const pageSizeCss = isLetter ? "279.4mm 215.9mm" : "297mm 210mm";
        const inlinePrintStyle = `
            @page { size: ${pageSizeCss}; margin: 0; }
            body { margin: 0; padding: 0; background: white; }
        `;

        const contentHtml = printableArea.innerHTML;
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Spell Cards</title>
<link rel="stylesheet" href="${contentHref}">
<link rel="stylesheet" href="${printHref}">
<style>${inlinePrintStyle}</style>
</head>
<body>
<div id="printable-area">${contentHtml}</div>
<script>
window.onload = function() {
  window.print();
};
window.onafterprint = function() {
  window.close();
};
<\/script>
</body>
</html>`;

        const w = window.open("", "_blank");
        if (!w) {
            if (toastEl) {
                toastEl.textContent =
                    "Pop-up blocked. Allow pop-ups for this site to print.";
                toastEl.classList.remove("hidden");
                setTimeout(() => toastEl.classList.add("hidden"), 4000);
            }
            return;
        }
        w.document.write(html);
        w.document.close();
    }

    /** Measures page width in px for current page size and sets printable area width. */
    function updatePageWidth() {
        const tempDiv = document.createElement("div");
        tempDiv.style.position = "absolute";
        tempDiv.style.visibility = "hidden";
        tempDiv.style.width = "279.4mm";
        document.body.appendChild(tempDiv);
        if (pageSizeSelect.value === "a4") tempDiv.style.width = "297mm";
        pageWidthPx = tempDiv.offsetWidth;
        printableArea.style.width = `${pageWidthPx}px`;
        document.body.removeChild(tempDiv);
    }

    // --- Spell picker: search, list, keyboard nav ---
    spellSearchInput.addEventListener("wa-focus", () => {
        /* Defer open so the initial click isn’t treated as “outside” and close the panel */
        requestAnimationFrame(() => {
            spellCombobox.open = true;
        });
    });
    /* When list is open, clicking the input again must not close it (only outside click should close) */
    spellSearchInput.addEventListener("click", (e) => {
        if (spellCombobox.open) e.stopPropagation();
    });
    function onSearchInput() {
        renderSpellList();
        if (!spellCombobox.open) spellCombobox.open = true;
    }
    spellSearchInput.addEventListener("wa-input", onSearchInput);
    spellSearchInput.addEventListener("input", onSearchInput);

    /* Keydown on dropdown (capture) so we get events when focus is on input or list item. */
    spellCombobox.addEventListener(
        "keydown",
        (e) => {
            const open = spellCombobox.open;
            const items = spellList.querySelectorAll(
                "wa-dropdown-item.spell-list-item"
            );
            if (!open) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    spellCombobox.open = true;
                }
                return;
            }
            if (e.key === " ") {
                e.preventDefault();
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                selectedListIndex = Math.min(
                    selectedListIndex + 1,
                    items.length - 1
                );
                updateListSelection();
                items[selectedListIndex]?.scrollIntoView({ block: "nearest" });
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                selectedListIndex = Math.max(selectedListIndex - 1, 0);
                updateListSelection();
                items[selectedListIndex]?.scrollIntoView({ block: "nearest" });
                return;
            }
            if (e.key === "Enter") {
                if (e.shiftKey) {
                    e.preventDefault();
                    spellListAddAll.click();
                    return;
                }
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const selectedSpell =
                        selectedListIndex >= 0 &&
                        currentSpellResults[selectedListIndex]
                            ? currentSpellResults[selectedListIndex]
                            : null;
                    if (
                        selectedSpell &&
                        countUnmodifiedInDeck(selectedSpell) > 0
                    ) {
                        removeOneUnmodifiedCard(selectedSpell);
                    }
                    return;
                }
                if (
                    selectedListIndex >= 0 &&
                    items[selectedListIndex] &&
                    currentSpellResults[selectedListIndex]
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                    const spell = currentSpellResults[selectedListIndex];
                    addCard(cloneSpellData(spell), spell).then(() => {
                        requestAnimationFrame(() => {
                            renderSpellList();
                            spellSearchInput.focus();
                        });
                    });
                }
            }
        },
        true
    );

    spellCombobox.addEventListener("wa-show", () => {
        renderSpellList();
        renderChips();
        /* Don’t call focus() here – it can cause a focus cycle that closes the panel on first open */
        spellList.querySelector("wa-dropdown-item.spell-list-item")?.scrollIntoView({ block: "nearest" });
    });

    spellCombobox.addEventListener("wa-select", async (e) => {
        e.preventDefault();
        const item = e.detail?.item;
        if (!item || item._countClicked) return;
        const idx = parseInt(item.value, 10);
        if (Number.isNaN(idx) || idx < 0 || !currentSpellResults[idx]) return;
        const spell = currentSpellResults[idx];
        await addCard(cloneSpellData(spell), spell);
        requestAnimationFrame(() => renderSpellList());
        spellSearchInput.focus();
    });

    spellListAddAll.addEventListener("click", async (e) => {
        e.stopPropagation();
        const toAdd = currentSpellResults;
        for (const spell of toAdd) {
            await addCard(cloneSpellData(spell), spell, { skipLayout: true });
        }
        await refreshLayout();
        requestAnimationFrame(() => renderSpellList());
        spellSearchInput.focus();
    });

    addEmptyBtn.addEventListener("click", () => addCard(emptySpellTemplate()));
    addGlossaryBtn.addEventListener("click", () => {
        cardList.push(createGlossaryCardRef());
        refreshLayout();
    });

    // --- Filters and display options ---
    // --- SRD banner and non-SRD excluded dialog ---
    if (srdBannerInfo) {
        srdBannerInfo.addEventListener("click", (e) => {
            e.stopPropagation();
            openSrdExcludedDialog();
        });
    }
    if (srdExcludedCopy) {
        srdExcludedCopy.addEventListener("click", () => {
            const text = getSrdExcludedListText();
            if (!text) return;
            const icon = srdExcludedCopy.querySelector("wa-icon");
            const originalLabel = srdExcludedCopy.getAttribute("aria-label") || "Copy to clipboard";
            navigator.clipboard.writeText(text).then(() => {
                if (icon) icon.setAttribute("name", "check");
                srdExcludedCopy.setAttribute("aria-label", "Copied");
                srdExcludedCopy.setAttribute("title", "Copied");
                setTimeout(() => {
                    if (icon) icon.setAttribute("name", "copy");
                    srdExcludedCopy.setAttribute("aria-label", originalLabel);
                    srdExcludedCopy.setAttribute("title", "Copy to clipboard");
                }, 1500);
            }).catch(() => {});
        });
    }
    // --- Easter egg: "knock" or 7 taps on header disables SRD-only filtering ---
    const KNOCK_KEY_SEQUENCE = "knock";
    let knockKeyIndex = 0;
    document.addEventListener("keydown", (e) => {
        const active = document.activeElement;
        const isInput =
            active &&
            (active.tagName === "INPUT" ||
                active.tagName === "TEXTAREA" ||
                active.isContentEditable);
        if (isInput) return;
        const key = e.key.toLowerCase();
        const expected = KNOCK_KEY_SEQUENCE[knockKeyIndex];
        if (key === expected) {
            knockKeyIndex += 1;
            if (knockKeyIndex === KNOCK_KEY_SEQUENCE.length) {
                knockKeyIndex = 0;
                disableOnlySrdAndToast();
            }
        } else {
            knockKeyIndex = 0;
        }
    });

    const headerEl = document.querySelector("header");
    let headerTapTimes = [];
    const TAP_WINDOW_MS = 2000;
    if (headerEl) {
        headerEl.addEventListener("click", () => {
            const now = Date.now();
            headerTapTimes = headerTapTimes.filter(
                (t) => now - t < TAP_WINDOW_MS
            );
            headerTapTimes.push(now);
            if (headerTapTimes.length >= 7) {
                headerTapTimes = [];
                disableOnlySrdAndToast();
            }
        });
    }

    /*
     * Filter menu keyboard: focus trap + Enter on switch.
     * wa-dropdown is built for wa-dropdown-item lists; we use custom panel content (chips, switches, buttons),
     * so we manage Tab/Shift+Tab ourselves. Tab from trigger moves into panel; Tab/Shift+Tab cycle within panel only.
     */
    const filterTrigger = filterDropdown.querySelector("[slot='trigger']");
    const FOCUSABLE_IN_PANEL =
        'button:not([disabled]):not(.hidden), [href], input:not([disabled]):not([type="hidden"]):not(.visually-hidden-file-input), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), wa-button:not([disabled]):not(.hidden), wa-switch';

    function getPanelFocusables() {
        const panel = document.getElementById("filter-menu-content");
        if (!panel) return [];
        return Array.from(panel.querySelectorAll(FOCUSABLE_IN_PANEL));
    }

    document.addEventListener("keydown", (e) => {
        if (!filterDropdown.open) return;
        const panel = document.getElementById("filter-menu-content");
        if (!panel) return;

        if (e.key === "Enter") {
            const active = document.activeElement;
            const switchEl = active.closest?.("wa-switch") ?? (active.tagName === "WA-SWITCH" ? active : null);
            if (switchEl && panel.contains(active)) {
                e.preventDefault();
                switchEl.click();
            }
            return;
        }

        if (e.key !== "Tab") return;
        const active = document.activeElement;
        const focusables = getPanelFocusables();
        const first = focusables[0] ?? null;
        const focusOnTrigger = active === filterTrigger || filterTrigger.contains(active);
        const focusInPanel = panel.contains(active);
        const activeIndex = focusInPanel
            ? focusables.findIndex((el) => el === active || el.contains(active))
            : -1;

        if (focusOnTrigger && !e.shiftKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            first?.focus();
            return;
        }
        if (focusOnTrigger && e.shiftKey) return;
        if (focusInPanel && e.shiftKey) {
            if (activeIndex <= 0) {
                e.preventDefault();
                e.stopImmediatePropagation();
                filterTrigger?.focus();
            } else if (activeIndex === -1 && focusables.length > 0) {
                e.preventDefault();
                e.stopImmediatePropagation();
                focusables[focusables.length - 1].focus();
            } else {
                e.preventDefault();
                e.stopImmediatePropagation();
                focusables[activeIndex - 1].focus();
            }
            return;
        }
        if (focusInPanel && !e.shiftKey) {
            if (activeIndex === -1) {
                e.preventDefault();
                e.stopImmediatePropagation();
                first?.focus();
            } else if (activeIndex >= focusables.length - 1) {
                return;
            } else {
                e.preventDefault();
                e.stopImmediatePropagation();
                focusables[activeIndex + 1].focus();
            }
        }
    }, true);


    filterRuleset.addEventListener("wa-change", refreshFiltersAndList);
    excludeReprintedToggle.addEventListener("wa-change", () => {
        renderSpellList();
    });
    filterClearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        filterValues.source = [];
        filterValues.class = [];
        filterValues.level = [];
        filterValues.school = [];
        renderSpellList();
        renderChips();
        ["source", "class", "level", "school"].forEach(
            updateFilterChipSelection
        );
        updateClearFilterButtonVisibility();
        // Keep focus in menu (clear btn may now be hidden; move to first so next Tab works).
        setTimeout(() => {
            const panel = document.getElementById("filter-menu-content");
            if (!panel || !filterDropdown.open) return;
            const first = panel.querySelector(FOCUSABLE_IN_PANEL);
            first?.focus();
        }, 0);
    });

    function onPageSizeChange() {
        updatePageWidth();
        refreshLayout();
    }
    pageSizeSelect.addEventListener("wa-change", onPageSizeChange);
    pageSizeSelect.addEventListener("change", onPageSizeChange);
    pageSizeSelect.addEventListener("input", onPageSizeChange);
    sortSelect.addEventListener("wa-change", refreshLayout);
    sortSelect.addEventListener("change", refreshLayout);
    sortSelect.addEventListener("input", refreshLayout);
    colorToggle.addEventListener("wa-change", refreshLayout);
    colorToggle.addEventListener("change", refreshLayout);
    colorToggle.addEventListener("input", refreshLayout);
    function applyCardBackState() {
        sideBySideToggle.disabled = backgroundToggle.checked;
        refreshLayout();
    }
    backgroundToggle.addEventListener("wa-change", applyCardBackState);
    backgroundToggle.addEventListener("change", applyCardBackState);
    backgroundToggle.addEventListener("input", applyCardBackState);
    function applyInlineIconsState() {
        document.body.classList.toggle(
            "use-inline-text",
            !inlineIconsToggle.checked
        );
    }
    inlineIconsToggle.addEventListener("wa-change", applyInlineIconsState);
    inlineIconsToggle.addEventListener("change", applyInlineIconsState);
    inlineIconsToggle.addEventListener("input", applyInlineIconsState);
    sideBySideToggle.addEventListener("wa-change", refreshLayout);
    sideBySideToggle.addEventListener("change", refreshLayout);
    sideBySideToggle.addEventListener("input", refreshLayout);
    if (clearAllBtnWrapper) {
        clearAllBtnWrapper.addEventListener("click", async (e) => {
            if (!e.target.closest(".clear-all-btn")) return;
            const hasModified = cardList.some(
                (c) => c instanceof SpellCard && c.spell._modified
            );
            if (hasModified && clearAllConfirmDialog) {
                clearAllConfirmDialog.open = true;
                return;
            }
            cardList = [];
            renderSpellList();
            await refreshLayout();
        });
    }

    if (clearAllConfirmProceed) {
        clearAllConfirmProceed.addEventListener("click", async () => {
            if (clearAllConfirmDialog) clearAllConfirmDialog.open = false;
            cardList = [];
            renderSpellList();
            await refreshLayout();
        });
    }

    if (settingsTriggerWrapper && settingsDropdown) {
        settingsTriggerWrapper.addEventListener(
            "click",
            (e) => {
                if (!e.target.closest(".settings-btn")) return;
                e.preventDefault();
                e.stopPropagation();
                settingsDropdown.open = true;
            },
            true
        );
    }

    function downloadCustomSpellJson() {
        const modified = cardList.filter(
            (c) => c instanceof SpellCard && c.spell._modified
        );
        if (modified.length === 0) return;
        const data = modified.map((c) => spellToExportFormat(c.spell));
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "custom-spells.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    function downloadSrdSpellJson() {
        const spells = getSpells();
        const srd = spells.filter(
            (s) =>
                s.isSRD === true || typeof s.isSRD === "string"
        );
        const data = srd.map((s) => {
            const obj = spellToExportFormat(s);
            if (typeof s.isSRD === "string") {
                obj.name = s.isSRD;
            }
            obj.isSRD = true;
            return obj;
        });
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "srd-spells.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    if (downloadCustomOption) {
        downloadCustomOption.addEventListener("click", () => {
            if (downloadCustomOption.disabled) return;
            downloadCustomSpellJson();
        });
    }
    const downloadSrdOption = document.getElementById("download-srd-option");
    if (downloadSrdOption) {
        downloadSrdOption.addEventListener("click", () => {
            downloadSrdSpellJson();
        });
    }
    if (showPrintingInstructionsOption && printingInstructionsDialog) {
        showPrintingInstructionsOption.addEventListener("click", () => {
            printingInstructionsDialog.open = true;
        });
    }

    uploadSpellsBtn.addEventListener("click", () => uploadSpellsInput.click());
    uploadSpellsInput.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const arr = Array.isArray(data) ? data : [data];
            if (arr.length === 0) return;
            appendSpells(arr);
            renderSpellList();
            await populateFilterChips();
        } catch (err) {
            console.error("Upload spells error:", err);
        }
    });

    printBtn.addEventListener("click", () => openPrintWindow());

    // --- Card actions: prepared checkbox, delete, duplicate, edit ---
    printableArea.addEventListener("wa-change", async (event) => {
        if (!event.target.classList.contains("prepared-checkbox")) return;
        const cardEl = event.target.closest(".spell-card");
        if (!cardEl?.dataset.cardId) return;
        const card = cardList.find(
            (c) => c instanceof SpellCard && c.id === cardEl.dataset.cardId
        );
        if (!card) return;
        card.setAlwaysPrepared(event.target.checked);
    });

    printableArea.addEventListener("mouseover", (event) => {
        const cardEl = event.target.closest(".spell-card");
        const card =
            cardEl &&
            cardList.find(
                (c) => c instanceof SpellCard && c.id === cardEl.dataset.cardId
            );
        if (card?.frontElement) {
            const cb = card.frontElement.querySelector(
                ".prepared-checkbox-container"
            );
            if (cb) cb.style.opacity = "1";
        }
    });

    printableArea.addEventListener("mouseout", (event) => {
        const cardEl = event.target.closest(".spell-card");
        const card =
            cardEl &&
            cardList.find(
                (c) => c instanceof SpellCard && c.id === cardEl.dataset.cardId
            );
        if (card?.frontElement) {
            const cb = card.frontElement.querySelector(
                ".prepared-checkbox-container"
            );
            if (cb) cb.style.opacity = "0";
        }
    });

    printableArea.addEventListener("card-delete", (event) => {
        event.stopPropagation();
        removeCard(event.detail.cardId);
    });
    printableArea.addEventListener("card-duplicate", (event) => {
        event.stopPropagation();
        duplicateCard(event.detail.cardId);
    });
    printableArea.addEventListener("card-edit", (event) => {
        event.stopPropagation();
        const card = cardList.find(
            (c) => c instanceof SpellCard && c.id === event.detail.cardId
        );
        if (card) openEditOverlay(card);
    });
    printableArea.addEventListener("card-reset", async (event) => {
        event.stopPropagation();
        const card = cardList.find(
            (c) => c instanceof SpellCard && c.id === event.detail.cardId
        );
        if (!card) return;
        if (card.originalId == null) return;
        const spells = getSpells();
        const original = spells.find((s) => s.id === card.originalId);
        if (!original) return;
        card.setSpellData(cloneSpellData(original));
        await card.render({ measureContainer });
        renderSpellList();
        await refreshLayout();
    });

    editCardCancel.addEventListener("click", closeEditOverlay);
    editCardSave.addEventListener("click", saveEditCard);
    editOverlay.addEventListener("click", (e) => {
        if (e.target === editOverlay) closeEditOverlay();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !editOverlay.classList.contains("hidden"))
            closeEditOverlay();
    });

    window.addEventListener("resize", handleZoom);

    // --- Zoom: Ctrl+wheel to scale printable area ---
    mainContainer.addEventListener("wheel", function (event) {
        if (!event.ctrlKey) return;
        event.preventDefault();
        const scaleAmount = 0.1;
        let newScale =
            event.deltaY < 0 ? scale + scaleAmount : scale - scaleAmount;
        newScale = Math.max(0.5, Math.min(newScale, 3));
        if (newScale === scale) return;
        const ratio = newScale / scale;
        printableArea.style.transform = `scale(${newScale})`;
        scale = newScale;
        updateWrapperSizeAndPosition();
        mainContainer.scrollLeft *= ratio;
        mainContainer.scrollTop *= ratio;
    });

    (async function init() {
        try {
            sideBySideToggle.disabled = backgroundToggle.checked;
            updateDownloadCustomButton();
            await reloadData();
            handleZoom();
            updatePageWidth();
        } catch (err) {
            console.error("Spell cards init error:", err);
            document.body.insertAdjacentHTML(
                "beforeend",
                '<div style="position:fixed;bottom:0;left:0;right:0;background:#c00;color:#fff;padding:12px;z-index:9999;">' +
                    (err?.message || String(err)) +
                    "</div>"
            );
        }
    })();
});
