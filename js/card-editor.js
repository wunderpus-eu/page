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

/** Swallow WaPopup promise rejections on disconnect (library calls hidePopover on null when nodes are removed). */
window.addEventListener("unhandledrejection", (e) => {
    if (e.reason?.message?.includes("hidePopover")) {
        e.preventDefault();
        e.stopPropagation();
    }
});

/** Normalizes reaction condition text to WYSIWYG form (strip prefixes, capitalize, add period). */
function normalizeConditionText(text) {
    if (!text || typeof text !== "string") return "";
    let t = text.trim();
    if (!t) return "";
    t = t.replace(
        /^(which you take |that you take |taken )/gi,
        ""
    ).trim();
    if (!t) return "";
    t = t[0].toUpperCase() + t.slice(1);
    if (t && !/[.!?]$/.test(t)) t += ".";
    return t;
}

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

/** Range options for the edit form (combines origin + distance type, ordered by increasing range). */
const RANGE_OPTIONS = [
    { value: "self", label: "Self" },
    { value: "touch", label: "Touch" },
    { value: "feet", label: "Feet" },
    { value: "miles", label: "Miles" },
    { value: "special", label: "Special" },
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

/** Duration options for the edit form (ordered from shortest to longest). */
const DURATION_OPTIONS = [
    { value: "instant", label: "Instant" },
    { value: "round", label: "Round(s)" },
    { value: "minute", label: "Minute(s)" },
    { value: "hour", label: "Hour(s)" },
    { value: "day", label: "Day(s)" },
    { value: "special", label: "Special" },
    { value: "permanent", label: "Permanent" },
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
    const editCardDialog = document.getElementById("edit-card-dialog");
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
    const deleteCardConfirmDialog = document.getElementById("delete-card-confirm-dialog");
    const deleteCardConfirmProceed = document.getElementById("delete-card-confirm-proceed");
    const resetCardConfirmDialog = document.getElementById("reset-card-confirm-dialog");
    const resetCardConfirmProceed = document.getElementById("reset-card-confirm-proceed");
    const srdExcludedDialog = document.getElementById("srd-excluded-dialog");
    const srdExcludedExplanation = document.getElementById(
        "srd-excluded-explanation"
    );
    const srdExcludedList = document.getElementById("srd-excluded-list");
    const srdExcludedCopy = document.getElementById("srd-excluded-copy");
    const printingInstructionsDialog = document.getElementById("printing-instructions-dialog");
    const showPrintingInstructionsOption = document.getElementById("show-printing-instructions-option");
    const richTextInfoDialog = document.getElementById("rich-text-info-dialog");
    const richTextInfoShortDialog = document.getElementById("rich-text-info-short-dialog");
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

    /**
     * Applies SRD transformation to spell data if in SRD mode and spell has SRD name.
     * Transforms spell.name to SRD name and ensures isSRD is boolean (not string).
     * @param {object} spellData - Spell data to transform (will be cloned)
     * @returns {object} Transformed spell data (cloned)
     */
    function applySrdTransformation(spellData) {
        const data = cloneSpellData(spellData);
        if (onlySRD && typeof data.isSRD === "string") {
            // Use SRD name for the card (WYSIWYG: what you see is what you get)
            data.name = data.isSRD;
            // Ensure isSRD is boolean (not string) in card data
            data.isSRD = true;
        }
        return data;
    }

    /** Adds a SpellCard to cardList, renders it, and optionally refreshes layout.
     * @param {object} spellData - Spell data for the card
     * @param {object} [originalSpell] - When adding from list, the list spell (stores id for reset)
     * @param {{ skipLayout?: boolean }} [opts] - If skipLayout: true, do not call refreshLayout (caller will refresh once)
     */
    async function addCard(spellData, originalSpell, opts = {}) {
        const dataToUse = applySrdTransformation(spellData);
        const card = new SpellCard(dataToUse);
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

    /** Duplicates a SpellCard or glossary ref and inserts it after the original. */
    async function duplicateCard(cardId) {
        const idx = cardList.findIndex(
            (c) =>
                (c instanceof SpellCard || isGlossaryRef(c)) && c.id === cardId
        );
        if (idx === -1) return;
        const item = cardList[idx];
        if (isGlossaryRef(item)) {
            cardList.splice(idx + 1, 0, createGlossaryCardRef());
        } else if (item instanceof SpellCard) {
            const newCard = item.duplicate();
            await newCard.render({ measureContainer });
            cardList.splice(idx + 1, 0, newCard);
        }
        await refreshLayout();
    }

    /** Updates the source dropdown with current available sources. */
    /**
     * Updates the source dropdown with available spell sources.
     * Called when dialog opens and when spells are uploaded (sources may change).
     */
    function updateSourceDropdown() {
        const sourceSel = editCardForm.querySelector("#edit-source");
        if (!sourceSel) return;
        
        // Clear existing options except the first one if it exists
        sourceSel.innerHTML = "";
        
        const knownSources = Object.keys(SOURCE_DISPLAY_NAMES).sort((a, b) =>
            (SOURCE_DISPLAY_NAMES[a] || a).localeCompare(SOURCE_DISPLAY_NAMES[b] || b)
        );
        const sourceChoices = [
            { value: "Homebrew", label: "Homebrew" },
            ...knownSources.map((abbr) => ({
                value: abbr,
                label: `${SOURCE_DISPLAY_NAMES[abbr]} (${abbr})`,
            })),
            { value: "__other__", label: "Other (specify)" },
        ];
        
        sourceChoices.forEach((opt) => {
            const o = document.createElement("wa-option");
            o.value = opt.value;
            o.textContent = opt.label;
            sourceSel.appendChild(o);
        });
    }

    /**
     * Populates all edit form fields with spell data.
     * @param {object} spell - Spell data object
     * @param {object} classIconUrls - Map of class names to icon URLs (default/selected)
     * @param {object} areaIconUrls - Map of area types to icon URLs
     */
    function populateEditForm(spell, classIconUrls = {}, areaIconUrls = {}) {
        // Name
        const nameInp = editCardForm.querySelector("#edit-name");
        if (nameInp) nameInp.value = spell.name ?? "";

        // Subtitle
        const subtitleInp = editCardForm.querySelector("#edit-subtitle");
        if (subtitleInp) subtitleInp.value = spell.subtitle ?? "";

        // Level
        const levelSel = editCardForm.querySelector("#edit-level");
        if (levelSel) {
            const levelVal = spell.level === 0 ? "0" : String(spell.level);
            levelSel.value = levelVal;
            levelSel.dataset.initialValue = levelVal;
        }

        // School
        const schoolSel = editCardForm.querySelector("#edit-school");
        if (schoolSel) {
            schoolSel.value = spell.school ?? "";
            schoolSel.dataset.initialValue = spell.school ?? "";
        }

        // Source
        const sourceSel = editCardForm.querySelector("#edit-source");
        const sourceOtherWrap = editCardForm.querySelector("#edit-source-other-wrap");
        const sourceOtherInp = editCardForm.querySelector("#edit-source_other");
        if (sourceSel) {
            const currentSource = spell.source ?? "Homebrew";
            const knownSources = Object.keys(SOURCE_DISPLAY_NAMES);
            const isKnown = currentSource === "Homebrew" || knownSources.includes(currentSource);
            const sourceVal = isKnown ? currentSource : "__other__";
            sourceSel.value = sourceVal;
            sourceSel.dataset.initialValue = sourceVal;
            
            if (sourceOtherInp) {
                sourceOtherInp.value = isKnown ? "" : (currentSource || "");
            }
            if (sourceOtherWrap) {
                sourceOtherWrap.style.display = sourceVal === "__other__" ? "block" : "none";
            }
        }

        // Casting Time
        const timeNumberInp = editCardForm.querySelector("#edit-time_number");
        const timeUnitSel = editCardForm.querySelector("#edit-time_unit");
        const timeConditionWrap = editCardForm.querySelector("#edit-time-condition-wrap");
        const timeConditionInp = editCardForm.querySelector("#edit-time_condition");
        if (timeNumberInp) {
            timeNumberInp.value = String(Math.max(1, spell.time?.number ?? 1));
        }
        if (timeUnitSel) {
            const timeUnitVal = spell.time?.unit ?? "action";
            timeUnitSel.value = timeUnitVal;
            timeUnitSel.dataset.initialValue = timeUnitVal;
        }
        if (timeConditionInp) {
            timeConditionInp.value = spell.time?.condition ?? "";
        }
        if (timeConditionWrap) {
            const unit = spell.time?.unit ?? "action";
            timeConditionWrap.style.display = unit === "reaction" ? "block" : "none";
        }

        // Concentration & Ritual
        const concentrationSwitch = editCardForm.querySelector("#edit-isConcentration");
        const ritualSwitch = editCardForm.querySelector("#edit-isRitual");
        if (concentrationSwitch) concentrationSwitch.checked = !!spell.isConcentration;
        if (ritualSwitch) ritualSwitch.checked = !!spell.isRitual;

        // Range
        const rangeTypeVal = (() => {
            const o = spell.range?.origin ?? "point";
            const u = spell.range?.unit ?? "feet";
            if (o === "touch" || o === "self" || o === "special") return o;
            if (o === "point") return u === "unlimited" ? "unlimited" : u;
            return "feet";
        })();
        const rangeTypeSel = editCardForm.querySelector("#edit-range_type");
        const rangeDistInp = editCardForm.querySelector("#edit-range_distance");
        if (rangeTypeSel) {
            rangeTypeSel.value = rangeTypeVal;
            rangeTypeSel.dataset.initialValue = rangeTypeVal;
        }
        if (rangeDistInp) {
            rangeDistInp.value = String(Math.max(1, spell.range?.distance ?? 30));
        }

        // Area
        const areaSel = editCardForm.querySelector("#edit-range_area");
        const areaVal = spell.range?.area ?? "";
        if (areaSel) {
            areaSel.value = areaVal;
            areaSel.dataset.initialValue = areaVal;
        }

        // Area Dimensions
        const areaDimsWrap = editCardForm.querySelector("#edit-area-dims-wrap");
        const areaDistInp = editCardForm.querySelector("#edit-area_distance");
        const areaUnitSel = editCardForm.querySelector("#edit-area_unit");
        const areaHeightInp = editCardForm.querySelector("#edit-area_height");
        const areaHeightUnitText = editCardForm.querySelector("#edit-area-height-unit-text");
        const areaHeightLab = editCardForm.querySelector("#edit-area-height-label");
        const areaHeightRow = editCardForm.querySelector("#edit-area-height-row");
        const areaPrimaryLab = editCardForm.querySelector("#edit-area-primary-label");
        
        if (areaDistInp) {
            areaDistInp.value = String(Math.max(1, spell.range?.areaDistance ?? 30));
        }
        if (areaUnitSel) {
            const areaUnitVal = spell.range?.areaUnit || "feet";
            areaUnitSel.value = areaUnitVal;
            areaUnitSel.dataset.initialValue = areaUnitVal;
        }
        if (areaHeightInp) {
            areaHeightInp.value = String(Math.max(1, spell.range?.areaHeight ?? 30));
        }
        if (areaHeightUnitText) {
            const areaUnitVal = spell.range?.areaUnit || "feet";
            areaHeightUnitText.textContent = areaUnitVal === "miles" ? "Miles" : "Feet";
        }
        if (areaDimsWrap && areaPrimaryLab) {
            const show = areaVal !== "";
            areaDimsWrap.style.display = show ? "" : "none";
            if (show) {
                areaPrimaryLab.textContent = AREA_DIMENSION_LABELS[areaVal] ?? "Size";
            }
            if (areaHeightLab && areaHeightRow) {
                const showHeight = show && areaVal === "cylinder";
                areaHeightLab.style.display = showHeight ? "" : "none";
                areaHeightRow.style.display = showHeight ? "" : "none";
            }
        }

        // Targets
        const targetsInp = editCardForm.querySelector("#edit-range_targets");
        const targetsScaleSwitch = editCardForm.querySelector("#edit-range_targets_scale");
        const requiresSightSwitch = editCardForm.querySelector("#edit-range_requires_sight");
        if (targetsInp) {
            const targetsVal = Math.max(0, spell.range?.targets ?? 0);
            targetsInp.value = String(targetsVal);
            targetsInp.dataset.initialValue = String(targetsVal);
        }
        if (targetsScaleSwitch) targetsScaleSwitch.checked = spell.range?.targetsScale ?? false;
        if (requiresSightSwitch) requiresSightSwitch.checked = spell.range?.requiresSight ?? false;

        // Duration
        const durationTypeVal = (() => {
            const t = spell.duration?.type ?? "timed";
            const u = spell.duration?.unit ?? "minute";
            if (t === "instant" || t === "special" || t === "permanent") return t;
            if (t === "timed" && u) return u;
            return "minute";
        })();
        const durationTypeSel = editCardForm.querySelector("#edit-duration_type");
        const durationAmountInp = editCardForm.querySelector("#edit-duration_amount");
        const durationEndsOnTriggerWrap = editCardForm.querySelector("#edit-duration-ends-on-trigger-wrap");
        const durationEndsOnTriggerSwitch = editCardForm.querySelector("#edit-duration_ends_on_trigger");
        const durationRow = editCardForm.querySelector(".form-field-duration .range-row");
        
        if (durationTypeSel) {
            durationTypeSel.value = durationTypeVal;
            durationTypeSel.dataset.initialValue = durationTypeVal;
        }
        if (durationAmountInp) {
            durationAmountInp.value = String(Math.max(1, spell.duration?.amount ?? 1));
        }
        if (durationEndsOnTriggerWrap) {
            durationEndsOnTriggerWrap.style.display = durationTypeVal === "permanent" ? "" : "none";
        }
        if (durationEndsOnTriggerSwitch) {
            const endsOnTrigger =
                spell.duration?.endsOnTrigger === true ||
                (Array.isArray(spell.duration?.ends) && spell.duration.ends.includes("trigger"));
            durationEndsOnTriggerSwitch.checked = !!endsOnTrigger;
        }
        if (durationRow) {
            const showNum = durationTypeVal === "round" || durationTypeVal === "minute" || durationTypeVal === "hour" || durationTypeVal === "day";
            durationRow.classList.toggle("range-row--with-number", showNum);
        }

        // Components
        const componentsDescInp = editCardForm.querySelector("#edit-components_description");
        const componentsVSwitch = editCardForm.querySelector("#edit-components_v");
        const componentsSSwitch = editCardForm.querySelector("#edit-components_s");
        const componentsMSwitch = editCardForm.querySelector("#edit-components_m");
        const componentsHasCostSwitch = editCardForm.querySelector("#edit-components_has_cost");
        const componentsConsumedSwitch = editCardForm.querySelector("#edit-components_is_consumed");
        
        if (componentsDescInp) componentsDescInp.value = spell.components?.description ?? "";
        if (componentsVSwitch) componentsVSwitch.checked = !!spell.components?.v;
        if (componentsSSwitch) componentsSSwitch.checked = !!spell.components?.s;
        if (componentsMSwitch) componentsMSwitch.checked = !!spell.components?.m;
        if (componentsHasCostSwitch) componentsHasCostSwitch.checked = !!spell.components?.hasCost;
        if (componentsConsumedSwitch) componentsConsumedSwitch.checked = !!spell.components?.isConsumed;

        // Description & Upcast
        const descriptionInp = editCardForm.querySelector("#edit-description");
        const upcastInp = editCardForm.querySelector("#edit-upcast");
        if (descriptionInp) descriptionInp.value = spell.description ?? "";
        if (upcastInp) upcastInp.value = spell.upcast || "";

        // Classes
        const classesWrap = editCardForm.querySelector("#edit-classes-wrap");
        const classesTokens = classesWrap?.querySelector(".edit-classes-tokens");
        if (classesTokens) {
            classesTokens.innerHTML = "";
            const spellClasses = spell.classes || [];
            SPELL_CLASSES.forEach((className) => {
                const btn = document.createElement("wa-button");
                btn.className = "filter-chip filter-chip--class edit-class-tag";
                btn.dataset.value = className;
                btn.setAttribute("size", "small");
                btn.setAttribute("appearance", "filled");
                const isSelected = spellClasses.includes(className);
                btn.setAttribute("variant", isSelected ? "brand" : "neutral");
                btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
                const iconOpts = classIconUrls[className];
                if (iconOpts?.default) {
                    btn.dataset.iconUrl = iconOpts.default;
                    if (iconOpts.selected) btn.dataset.iconUrlSelected = iconOpts.selected;
                    const iconSpan = document.createElement("span");
                    iconSpan.className = "filter-class-icon";
                    iconSpan.setAttribute("slot", "start");
                    const img = document.createElement("img");
                    img.src = isSelected && iconOpts.selected ? iconOpts.selected : iconOpts.default;
                    img.alt = "";
                    iconSpan.appendChild(img);
                    btn.appendChild(iconSpan);
                    btn.appendChild(document.createTextNode(" " + className));
                } else {
                    btn.textContent = className;
                }
                classesTokens.appendChild(btn);
            });
            setupClassTagHandlers();
        }

        // Update area icons in dropdown
        const areaOptions = editCardForm.querySelectorAll("#edit-range_area wa-option");
        areaOptions.forEach((opt) => {
            const areaValue = opt.value;
            if (areaValue && areaIconUrls[areaValue]) {
                // Remove existing icon if any
                const existingIcon = opt.querySelector("span[slot='start']");
                if (existingIcon) existingIcon.remove();
                
                const iconSpan = document.createElement("span");
                iconSpan.setAttribute("slot", "start");
                const img = document.createElement("img");
                img.src = areaIconUrls[areaValue];
                img.alt = "";
                img.className = "edit-area-option-icon";
                iconSpan.appendChild(img);
                opt.insertBefore(iconSpan, opt.firstChild);
            }
        });

        // Sync visibility states
        syncFormVisibility();
    }

    /**
     * Syncs form field visibility based on current form values.
     * Shows/hides conditional fields like casting time number input, range distance input, etc.
     */
    function syncFormVisibility() {
        // Casting time number visibility
        const timeUnitSel = editCardForm.querySelector("#edit-time_unit");
        const castingTimeRow = editCardForm.querySelector(".casting-time-row");
        if (timeUnitSel && castingTimeRow) {
            const unit = String(timeUnitSel.value ?? "action");
            const showNumber = unit === "minute" || unit === "hour";
            castingTimeRow.classList.toggle("casting-time-row--with-number", showNumber);
        }

        // Range number visibility
        const rangeTypeSel = editCardForm.querySelector("#edit-range_type");
        const rangeRow = editCardForm.querySelector(".form-field-range .range-row");
        if (rangeTypeSel && rangeRow) {
            const type = rangeTypeSel.value ?? "touch";
            const showNumber = type === "feet" || type === "miles";
            rangeRow.classList.toggle("range-row--with-number", showNumber);
        }
    }

    /**
     * Sets up event handlers for the edit form (one-time setup).
     * Handlers persist across dialog open/close cycles.
     * All form changes trigger preview updates.
     */
    function setupEditFormHandlers() {
        if (editFormHandlersSetup) return;
        editFormHandlersSetup = true;
        
        // Rich text info buttons
        const richTextButtons = editCardForm.querySelectorAll("[id^='rich-text-info-btn-']");
        richTextButtons.forEach((btn) => {
            const isShort = btn.id.includes("time-condition") || btn.id.includes("components");
            const dialog = isShort ? richTextInfoShortDialog : richTextInfoDialog;
            btn.addEventListener("click", () => {
                if (dialog) dialog.open = true;
            });
        });

        // Source dropdown change handler
        const sourceSel = editCardForm.querySelector("#edit-source");
        const sourceOtherWrap = editCardForm.querySelector("#edit-source-other-wrap");
        const sourceOtherInp = editCardForm.querySelector("#edit-source_other");
        if (sourceSel && sourceOtherWrap && sourceOtherInp) {
            const showHideSourceOther = () => {
                const val = String(sourceSel.value ?? "Homebrew");
                const isOther = val === "__other__";
                sourceOtherWrap.style.display = isOther ? "block" : "none";
                if (!isOther) sourceOtherInp.value = "";
                else requestAnimationFrame(() => {
                    sourceOtherInp.focus?.();
                });
            };
            sourceSel.addEventListener("wa-change", () => {
                setTimeout(showHideSourceOther, 0);
                updateEditPreview();
            });
            sourceSel.addEventListener("change", () => {
                showHideSourceOther();
                updateEditPreview();
            });
            sourceOtherInp.addEventListener("wa-input", () => updateEditPreview());
            sourceOtherInp.addEventListener("input", () => updateEditPreview());
            sourceOtherInp.addEventListener("change", () => updateEditPreview());
        }

        // Casting time handlers
        const timeUnitSel = editCardForm.querySelector("#edit-time_unit");
        const timeNumberInp = editCardForm.querySelector("#edit-time_number");
        const timeConditionWrap = editCardForm.querySelector("#edit-time-condition-wrap");
        const timeConditionInp = editCardForm.querySelector("#edit-time_condition");
        const castingTimeRow = editCardForm.querySelector(".casting-time-row");
        
        if (timeUnitSel) {
            const showHideTimeNumber = () => {
                const unit = String(timeUnitSel.value ?? "action");
                const showNumber = unit === "minute" || unit === "hour";
                if (castingTimeRow) {
                    castingTimeRow.classList.toggle("casting-time-row--with-number", showNumber);
                }
                if (!showNumber && timeNumberInp) timeNumberInp.value = "1";
            };
            const showHideTimeCondition = () => {
                const unit = String(timeUnitSel.value ?? "action");
                const show = unit === "reaction";
                if (timeConditionWrap) {
                    timeConditionWrap.style.display = show ? "block" : "none";
                }
                if (!show && timeConditionInp) timeConditionInp.value = "";
            };
            const onTimeUnitChange = () => {
                setTimeout(() => {
                    showHideTimeNumber();
                    showHideTimeCondition();
                }, 0);
                updateEditPreview();
            };
            timeUnitSel.addEventListener("wa-change", onTimeUnitChange);
            timeUnitSel.addEventListener("change", () => {
                showHideTimeNumber();
                showHideTimeCondition();
                updateEditPreview();
            });
        }
        if (timeNumberInp) {
            timeNumberInp.addEventListener("input", () => updateEditPreview());
            timeNumberInp.addEventListener("change", () => updateEditPreview());
        }
        if (timeConditionInp) {
            timeConditionInp.addEventListener("wa-input", () => updateEditPreview());
            timeConditionInp.addEventListener("input", () => updateEditPreview());
        }

        // Range handlers
        const rangeTypeSel = editCardForm.querySelector("#edit-range_type");
        const rangeDistInp = editCardForm.querySelector("#edit-range_distance");
        const rangeRow = editCardForm.querySelector(".form-field-range .range-row");
        
        if (rangeTypeSel) {
            const showHideRangeNumber = () => {
                const type = rangeTypeSel.value ?? "touch";
                const showNumber = type === "feet" || type === "miles";
                if (rangeRow) {
                    rangeRow.classList.toggle("range-row--with-number", showNumber);
                }
            };
            rangeTypeSel.addEventListener("wa-change", () => {
                showHideRangeNumber();
                updateEditPreview();
            });
            rangeTypeSel.addEventListener("change", () => {
                showHideRangeNumber();
                updateEditPreview();
            });
        }
        if (rangeDistInp) {
            rangeDistInp.addEventListener("input", () => updateEditPreview());
            rangeDistInp.addEventListener("change", () => updateEditPreview());
        }

        // Area handlers
        const areaSel = editCardForm.querySelector("#edit-range_area");
        const areaDimsWrap = editCardForm.querySelector("#edit-area-dims-wrap");
        const areaDistInp = editCardForm.querySelector("#edit-area_distance");
        const areaUnitSel = editCardForm.querySelector("#edit-area_unit");
        const areaHeightInp = editCardForm.querySelector("#edit-area_height");
        const areaHeightUnitTextEl = editCardForm.querySelector("#edit-area-height-unit-text");
        const areaHeightLab = editCardForm.querySelector("#edit-area-height-label");
        const areaHeightRow = editCardForm.querySelector("#edit-area-height-row");
        const areaPrimaryLab = editCardForm.querySelector("#edit-area-primary-label");
        
        const syncHeightUnitText = () => {
            if (areaHeightUnitTextEl && areaUnitSel) {
                const u = areaUnitSel.value ?? "feet";
                areaHeightUnitTextEl.textContent = u === "miles" ? "Miles" : "Feet";
            }
        };
        if (areaSel && areaDimsWrap) {
            const showHideAreaDims = () => {
                const area = areaSel.value ?? "";
                const show = area !== "";
                areaDimsWrap.style.display = show ? "" : "none";
                const showHeight = show && area === "cylinder";
                if (areaHeightLab) areaHeightLab.style.display = showHeight ? "" : "none";
                if (areaHeightRow) areaHeightRow.style.display = showHeight ? "" : "none";
                if (show && areaPrimaryLab) {
                    areaPrimaryLab.textContent = AREA_DIMENSION_LABELS[area] ?? "Size";
                }
            };
            areaSel.addEventListener("wa-change", () => {
                showHideAreaDims();
                updateEditPreview();
            });
            areaSel.addEventListener("change", () => {
                showHideAreaDims();
                updateEditPreview();
            });
        }
        if (areaDistInp) {
            areaDistInp.addEventListener("input", () => updateEditPreview());
            areaDistInp.addEventListener("change", () => updateEditPreview());
        }
        if (areaUnitSel) {
            areaUnitSel.addEventListener("wa-change", () => {
                syncHeightUnitText();
                updateEditPreview();
            });
            areaUnitSel.addEventListener("change", () => {
                syncHeightUnitText();
                updateEditPreview();
            });
        }
        if (areaHeightInp) {
            areaHeightInp.addEventListener("input", () => updateEditPreview());
            areaHeightInp.addEventListener("change", () => updateEditPreview());
        }

        // Targets handlers
        const targetsInp = editCardForm.querySelector("#edit-range_targets");
        const targetsScaleSwitch = editCardForm.querySelector("#edit-range_targets_scale");
        const requiresSightSwitch = editCardForm.querySelector("#edit-range_requires_sight");
        
        if (targetsInp) {
            targetsInp.addEventListener("input", () => updateEditPreview());
            targetsInp.addEventListener("change", () => updateEditPreview());
        }
        if (targetsScaleSwitch) {
            targetsScaleSwitch.addEventListener("wa-change", () => updateEditPreview());
            targetsScaleSwitch.addEventListener("change", () => updateEditPreview());
        }
        if (requiresSightSwitch) {
            requiresSightSwitch.addEventListener("wa-change", () => updateEditPreview());
            requiresSightSwitch.addEventListener("change", () => updateEditPreview());
        }

        // Duration handlers
        const durationTypeSel = editCardForm.querySelector("#edit-duration_type");
        const durationAmountInp = editCardForm.querySelector("#edit-duration_amount");
        const durationRow = editCardForm.querySelector(".form-field-duration .range-row");
        const durationEndsOnTriggerWrap = editCardForm.querySelector("#edit-duration-ends-on-trigger-wrap");
        const durationEndsOnTriggerSwitch = editCardForm.querySelector("#edit-duration_ends_on_trigger");
        
        if (durationTypeSel) {
            const showHideDurationNumber = () => {
                const type = durationTypeSel.value ?? "instant";
                const showNumber = type === "round" || type === "minute" || type === "hour" || type === "day";
                if (durationRow) {
                    durationRow.classList.toggle("range-row--with-number", showNumber);
                }
            };
            const showHideDurationEndsOnTrigger = () => {
                const type = durationTypeSel.value ?? "instant";
                if (durationEndsOnTriggerWrap) {
                    durationEndsOnTriggerWrap.style.display = type === "permanent" ? "" : "none";
                }
            };
            const onDurationTypeChange = () => {
                showHideDurationNumber();
                showHideDurationEndsOnTrigger();
                updateEditPreview();
            };
            durationTypeSel.addEventListener("wa-change", onDurationTypeChange);
            durationTypeSel.addEventListener("change", () => {
                showHideDurationNumber();
                showHideDurationEndsOnTrigger();
                updateEditPreview();
            });
        }
        if (durationAmountInp) {
            durationAmountInp.addEventListener("input", () => updateEditPreview());
            durationAmountInp.addEventListener("change", () => updateEditPreview());
        }
        if (durationEndsOnTriggerSwitch) {
            durationEndsOnTriggerSwitch.addEventListener("change", () => updateEditPreview());
        }

        // Components handlers
        const componentsDescInp = editCardForm.querySelector("#edit-components_description");
        const componentsVSwitch = editCardForm.querySelector("#edit-components_v");
        const componentsSSwitch = editCardForm.querySelector("#edit-components_s");
        const componentsMSwitch = editCardForm.querySelector("#edit-components_m");
        const componentsHasCostSwitch = editCardForm.querySelector("#edit-components_has_cost");
        const componentsConsumedSwitch = editCardForm.querySelector("#edit-components_is_consumed");
        
        if (componentsDescInp) {
            componentsDescInp.addEventListener("wa-input", () => updateEditPreview());
            componentsDescInp.addEventListener("input", () => updateEditPreview());
        }
        if (componentsVSwitch) {
            componentsVSwitch.addEventListener("wa-change", () => updateEditPreview());
            componentsVSwitch.addEventListener("change", () => updateEditPreview());
        }
        if (componentsSSwitch) {
            componentsSSwitch.addEventListener("wa-change", () => updateEditPreview());
            componentsSSwitch.addEventListener("change", () => updateEditPreview());
        }
        if (componentsMSwitch) {
            const updateComponentsMaterialDisabled = () => {
                const material = componentsMSwitch.checked ?? false;
                const hasCost = componentsHasCostSwitch?.checked ?? false;
                if (componentsHasCostSwitch) componentsHasCostSwitch.disabled = !material;
                if (componentsConsumedSwitch) componentsConsumedSwitch.disabled = !material || !hasCost;
                if (!material) {
                    if (componentsHasCostSwitch) componentsHasCostSwitch.checked = false;
                    if (componentsConsumedSwitch) componentsConsumedSwitch.checked = false;
                }
                if (!hasCost && componentsConsumedSwitch) componentsConsumedSwitch.checked = false;
            };
            componentsMSwitch.addEventListener("wa-change", () => {
                requestAnimationFrame(() => {
                    updateComponentsMaterialDisabled();
                    updateEditPreview();
                });
            });
            componentsMSwitch.addEventListener("change", () => {
                updateComponentsMaterialDisabled();
                updateEditPreview();
            });
            componentsMSwitch.addEventListener("input", () => {
                updateComponentsMaterialDisabled();
                updateEditPreview();
            });
            // Initial call
            requestAnimationFrame(() => updateComponentsMaterialDisabled());
        }
        if (componentsHasCostSwitch) {
            const updateComponentsMaterialDisabled = () => {
                const material = componentsMSwitch?.checked ?? false;
                const hasCost = componentsHasCostSwitch.checked ?? false;
                if (componentsConsumedSwitch) componentsConsumedSwitch.disabled = !material || !hasCost;
                if (!hasCost && componentsConsumedSwitch) componentsConsumedSwitch.checked = false;
            };
            componentsHasCostSwitch.addEventListener("wa-change", () => {
                updateComponentsMaterialDisabled();
                updateEditPreview();
            });
            componentsHasCostSwitch.addEventListener("change", () => {
                updateComponentsMaterialDisabled();
                updateEditPreview();
            });
        }
        if (componentsConsumedSwitch) {
            componentsConsumedSwitch.addEventListener("wa-change", () => updateEditPreview());
            componentsConsumedSwitch.addEventListener("change", () => updateEditPreview());
        }

        // Description & Upcast handlers
        const descriptionInp = editCardForm.querySelector("#edit-description");
        const upcastInp = editCardForm.querySelector("#edit-upcast");
        if (descriptionInp) {
            descriptionInp.addEventListener("wa-input", () => updateEditPreview());
            descriptionInp.addEventListener("input", () => updateEditPreview());
        }
        if (upcastInp) {
            upcastInp.addEventListener("wa-input", () => updateEditPreview());
            upcastInp.addEventListener("input", () => updateEditPreview());
        }

        // Level, School, Concentration, Ritual handlers
        const levelSel = editCardForm.querySelector("#edit-level");
        const schoolSel = editCardForm.querySelector("#edit-school");
        const concentrationSwitch = editCardForm.querySelector("#edit-isConcentration");
        const ritualSwitch = editCardForm.querySelector("#edit-isRitual");
        
        if (levelSel) {
            levelSel.addEventListener("wa-change", () => updateEditPreview());
            levelSel.addEventListener("change", () => updateEditPreview());
        }
        if (schoolSel) {
            schoolSel.addEventListener("wa-change", () => updateEditPreview());
            schoolSel.addEventListener("change", () => updateEditPreview());
        }
        if (concentrationSwitch) {
            concentrationSwitch.addEventListener("wa-change", () => updateEditPreview());
            concentrationSwitch.addEventListener("change", () => updateEditPreview());
        }
        if (ritualSwitch) {
            ritualSwitch.addEventListener("wa-change", () => updateEditPreview());
            ritualSwitch.addEventListener("change", () => updateEditPreview());
        }

        // Name handler
        const nameInp = editCardForm.querySelector("#edit-name");
        if (nameInp) {
            nameInp.addEventListener("wa-input", () => updateEditPreview());
            nameInp.addEventListener("input", () => updateEditPreview());
        }

        // Subtitle handler
        const subtitleInp = editCardForm.querySelector("#edit-subtitle");
        if (subtitleInp) {
            subtitleInp.addEventListener("wa-input", () => updateEditPreview());
            subtitleInp.addEventListener("input", () => updateEditPreview());
        }

        // Classes handlers are set up dynamically when classes are populated
    }
    
    /**
     * Sets up event handlers for dynamically created class tag buttons.
     * Clones and replaces tags to ensure clean event listener attachment.
     */
    function setupClassTagHandlers() {
        const classTags = editCardForm.querySelectorAll(".edit-class-tag");
        classTags.forEach((tag) => {
            // Remove existing listeners if any
            const newTag = tag.cloneNode(true);
            tag.parentNode.replaceChild(newTag, tag);
            
            newTag.addEventListener("click", () => {
                const wrap = editCardForm.querySelector("#edit-classes-wrap");
                const tags = wrap.querySelectorAll(".edit-class-tag");
                const selected = Array.from(tags)
                    .filter((t) => t.getAttribute("variant") === "brand")
                    .map((t) => t.dataset.value);
                const className = newTag.dataset.value;
                const idx = selected.indexOf(className);
                if (idx >= 0) selected.splice(idx, 1);
                else selected.push(className);
                tags.forEach((t) => {
                    const sel = selected.includes(t.dataset.value);
                    t.setAttribute("variant", sel ? "brand" : "neutral");
                    t.setAttribute("aria-pressed", sel ? "true" : "false");
                    if (t.dataset.iconUrl) {
                        const img = t.querySelector(".filter-class-icon img");
                        if (img && t.dataset.iconUrlSelected) {
                            img.src = selected.includes(t.dataset.value) ? t.dataset.iconUrlSelected : t.dataset.iconUrl;
                        }
                    }
                });
                updateEditPreview();
            });
        });
    }

    /** Opens the edit overlay with a preview and form for the card's spell. */
    async function openEditOverlay(card) {
        editingCard = card;
        if (!editPreviewCard)
            editPreviewCard = new SpellCard(cloneSpellData(card.spell));
        editPreviewCard.setSpellData(cloneSpellData(card.spell));
        // Render preview card with measureContainer to handle overflow (creates back if needed)
        await editPreviewCard.render({ measureContainer });
        updateEditPreviewDisplay();
        
        // Update source dropdown with current sources
        updateSourceDropdown();
        
        // Load icons
        const chipTextColor = "#374151";
        const brandOnNormal = getComputedStyle(document.documentElement).getPropertyValue("--wa-color-brand-30").trim() || "#612692";
        const iconFg = "333333";
        const iconBg = "ffffff";
        const classIconUrls = {};
        const areaIconUrls = {};
        await Promise.all([
            ...SPELL_CLASSES.map(async (c) => {
                const iconName = "icon-" + c.toLowerCase();
                classIconUrls[c] = {
                    default: await load_icon(iconName, "transparent", chipTextColor),
                    selected: await load_icon(iconName, "transparent", brandOnNormal),
                };
            }),
            ...AREA_TYPES.filter((a) => a.value).map(async (a) => {
                const url = await load_icon(`icon-${a.value}`, iconFg, iconBg);
                if (url) areaIconUrls[a.value] = url;
            }),
        ]);
        
        // Populate form with spell data
        populateEditForm(card.spell, classIconUrls, areaIconUrls);
        
        // Setup event handlers (only once, handlers persist)
        if (!editFormHandlersSetup) {
            setupEditFormHandlers();
        }
        
        editCardDialog.open = true;
        
        // Sync form visibility after dialog opens (handles conditional field visibility)
        const syncVisibility = () => syncFormVisibility();
        requestAnimationFrame(() => {
            requestAnimationFrame(syncVisibility);
        });
        setTimeout(syncVisibility, 50);
        editCardDialog?.addEventListener("wa-after-show", syncVisibility, { once: true });
    }

    /** Closes the edit overlay. */
    function closeEditOverlay() {
        editingCard = null;
        if (editCardDialog) editCardDialog.open = false;
    }

    // ============================================================================
    // Edit Card Overlay Functions
    // ============================================================================
    
    /** Tracks whether edit form event handlers have been set up (one-time setup). */
    let editFormHandlersSetup = false;
    
    /**
     * Reads all form field values and returns a spell data object.
     * @param {SpellCard|null} card - Optional card to use as base (falls back to editingCard or empty template)
     * @returns {object} Spell data object with all form values
     */
    function getEditFormData(card = null) {
        if (!editCardForm) {
            throw new Error("editCardForm is not available");
        }
        // Use provided card, or fall back to editingCard, or use empty template
        const sourceCard = card || editingCard;
        const spell = sourceCard
            ? cloneSpellData(sourceCard.spell)
            : emptySpellTemplate();
        
        // Read form values - Web Awesome wa-select components expose .value property directly
        spell.name =
            editCardForm.querySelector("#edit-name")?.value ?? spell.name;
        spell.subtitle =
            editCardForm.querySelector("#edit-subtitle")?.value ?? spell.subtitle ?? "";
        const levelSelect = editCardForm.querySelector("#edit-level");
        const levelValStr = levelSelect?.value ?? "0";
        const levelVal = parseInt(levelValStr, 10);
        spell.level = isNaN(levelVal) ? 0 : levelVal;
        
        const schoolSelect = editCardForm.querySelector("#edit-school");
        spell.school = schoolSelect?.value ?? spell.school;
        
        const sourceSelect = editCardForm.querySelector("#edit-source");
        const sourceVal = sourceSelect?.value ?? "Homebrew";
        spell.source = sourceVal === "__other__"
            ? (editCardForm.querySelector("#edit-source_other")?.value ?? "").trim() || "Homebrew"
            : sourceVal;
        spell.time = spell.time || { number: 1, unit: "action" };
        const timeNumberVal = parseInt(
            editCardForm.querySelector("#edit-time_number")?.value ?? "1",
            10
        );
        spell.time.number = Math.max(1, isNaN(timeNumberVal) ? 1 : timeNumberVal);
        const timeUnitSelect = editCardForm.querySelector("#edit-time_unit");
        spell.time.unit = timeUnitSelect?.value ?? "action";
        spell.time.condition =
            spell.time.unit === "reaction"
                ? normalizeConditionText(
                      editCardForm.querySelector("#edit-time_condition")
                          ?.value ?? ""
                  )
                : "";
        spell.range = spell.range || {};
        const rangeTypeSelect = editCardForm.querySelector("#edit-range_type");
        const rangeType = rangeTypeSelect?.value ?? "touch";
        if (rangeType === "touch" || rangeType === "self" || rangeType === "special") {
            spell.range.origin = rangeType;
            spell.range.unit = "";
            spell.range.distance = 0;
        } else if (rangeType === "unlimited") {
            spell.range.origin = "point";
            spell.range.unit = "unlimited";
            spell.range.distance = 0;
        } else {
            spell.range.origin = "point";
            spell.range.unit = rangeType;
            const rangeDistVal = parseInt(
                editCardForm.querySelector("#edit-range_distance")?.value ?? "1",
                10
            );
            spell.range.distance = Math.max(1, isNaN(rangeDistVal) ? 1 : rangeDistVal);
        }
        const areaSelect = editCardForm.querySelector("#edit-range_area");
        spell.range.area = areaSelect?.value ?? "";
        if (spell.range.area) {
            const areaDistVal = parseInt(
                editCardForm.querySelector("#edit-area_distance")?.value ?? "1",
                10
            );
            spell.range.areaDistance = Math.max(1, isNaN(areaDistVal) ? 1 : areaDistVal);
            const areaUnitSelect = editCardForm.querySelector("#edit-area_unit");
            spell.range.areaUnit = areaUnitSelect?.value ?? "feet";
            if (spell.range.area === "cylinder") {
                const areaHeightVal = parseInt(
                    editCardForm.querySelector("#edit-area_height")?.value ?? "1",
                    10
                );
                spell.range.areaHeight = Math.max(1, isNaN(areaHeightVal) ? 1 : areaHeightVal);
                spell.range.areaHeightUnit = areaUnitSelect?.value ?? "feet";
            } else {
                spell.range.areaHeight = 0;
                spell.range.areaHeightUnit = "";
            }
        } else {
            spell.range.areaDistance = 0;
            spell.range.areaUnit = "";
            spell.range.areaHeight = 0;
            spell.range.areaHeightUnit = "";
        }
        spell.range.requiresSight =
            editCardForm.querySelector("#edit-range_requires_sight")?.checked ??
            false;
        const targetsVal = parseInt(
            editCardForm.querySelector("#edit-range_targets")?.value ?? "0",
            10
        );
        spell.range.targets = isNaN(targetsVal) ? 0 : targetsVal;
        spell.range.targetsScale =
            editCardForm.querySelector("#edit-range_targets_scale")?.checked ??
            false;
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
        const durationTypeSelect = editCardForm.querySelector("#edit-duration_type");
        const durationTypeVal = durationTypeSelect?.value ?? "minute";
        const isTimed =
            durationTypeVal === "round" ||
            durationTypeVal === "minute" ||
            durationTypeVal === "hour" ||
            durationTypeVal === "day";
        if (isTimed) {
            spell.duration.type = "timed";
            const durationAmountVal = parseInt(
                editCardForm.querySelector("#edit-duration_amount")?.value ?? "1",
                10
            );
            spell.duration.amount = Math.max(1, isNaN(durationAmountVal) ? 1 : durationAmountVal);
            spell.duration.unit = durationTypeVal;
        } else {
            spell.duration.type = durationTypeVal;
            spell.duration.amount = 0;
            spell.duration.unit = "";
        }
        const durationType = spell.duration.type;
        if (durationType === "permanent") {
            const endsOnTriggerSwitch = editCardForm.querySelector(
                "#edit-duration_ends_on_trigger"
            );
            spell.duration.endsOnTrigger = endsOnTriggerSwitch?.checked ?? false;
        } else {
            spell.duration.endsOnTrigger = false;
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
                  .filter((t) => t.getAttribute("variant") === "brand")
                  .map((t) => t.dataset.value)
            : [];
        spell._modified = true;
        return spell;
    }

    /** Debounce timeout for preview updates to avoid excessive re-renders. */
    let editPreviewTimeout = null;
    
    /**
     * Updates the preview display by cloning and appending front and back card elements.
     * Removes card action buttons from preview clones.
     */
    function updateEditPreviewDisplay() {
        if (!editPreviewCard) return;
        editCardPreview.innerHTML = "";
        if (editPreviewCard.frontElement) {
            const clone = editPreviewCard.frontElement.cloneNode(true);
            const actions = clone.querySelector(".card-actions");
            if (actions) actions.remove();
            editCardPreview.appendChild(clone);
        }
        if (editPreviewCard.backElement) {
            const clone = editPreviewCard.backElement.cloneNode(true);
            const actions = clone.querySelector(".card-actions");
            if (actions) actions.remove();
            editCardPreview.appendChild(clone);
        }
    }
    
    /**
     * Debounced update of the edit overlay preview from form data.
     * Reads form values, updates preview card, and re-renders with overflow handling.
     */
    function updateEditPreview() {
        if (!editPreviewCard) return;
        clearTimeout(editPreviewTimeout);
        const runUpdate = async () => {
            try {
                await new Promise((r) => requestAnimationFrame(r));
                const data = getEditFormData();
                editPreviewCard.setSpellData(data);
                await editPreviewCard.render({ measureContainer });
                updateEditPreviewDisplay();
            } catch (err) {
                console.error("Preview update error:", err);
            }
        };
        editPreviewTimeout = setTimeout(runUpdate, 0);
    }

    /** Applies form data to editing card, closes overlay, refreshes layout. */
    async function saveEditCard() {
        // Store card reference immediately to prevent race conditions with dialog close events
        const card = editingCard;
        if (!card || !editCardForm) return;
        let data;
        try {
            // Pass card reference to getEditFormData to avoid relying on global editingCard
            data = getEditFormData(card);
        } catch (err) {
            console.error("Edit form data error:", err);
            return;
        }
        try {
            card.setSpellData(data);
        } catch (err) {
            console.error("Set spell data error:", err);
            return;
        }
        // Close overlay after storing card reference
        closeEditOverlay();
        try {
            await card.render({ measureContainer });
            await refreshLayout();
        } catch (err) {
            console.error("Save card error:", err);
        }
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
        const useInlineTextClass =
            !inlineIconsToggle.checked ? " use-inline-text" : "";
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Spell Cards</title>
<link rel="stylesheet" href="${contentHref}">
<link rel="stylesheet" href="${printHref}">
<style>${inlinePrintStyle}</style>
</head>
<body class="${useInlineTextClass}">
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
                /* Only prevent Space when focus is on a list item (select); allow Space in search input */
                if (e.target.closest("wa-dropdown-item.spell-list-item")) {
                    e.preventDefault();
                }
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
        const isTextInputContext =
            active &&
            (active.tagName === "INPUT" ||
                active.tagName === "TEXTAREA" ||
                active.tagName === "SELECT" ||
                active.isContentEditable ||
                active.closest("wa-input") ||
                active.closest("wa-textarea") ||
                active.closest("wa-select") ||
                active.closest("[contenteditable]"));
        if (isTextInputContext) return;
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
        headerEl.addEventListener("click", (e) => {
            // Only count taps on the header banner/background, not on menu options or controls
            if (
                e.target.closest("wa-button") ||
                e.target.closest("wa-input") ||
                e.target.closest("wa-dropdown") ||
                e.target.closest("wa-popover")
            ) {
                return;
            }
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
        'button:not([disabled]):not(.hidden), [href], input:not([disabled]):not([type="hidden"]):not(.visually-hidden-file-input), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), wa-button:not([disabled]):not(.hidden), wa-switch, wa-radio';

    function getPanelFocusables() {
        const panel = document.getElementById("filter-menu-content");
        if (!panel) return [];
        return Array.from(panel.querySelectorAll(FOCUSABLE_IN_PANEL));
    }

    function getSettingsPanelFocusables() {
        const panel = document.getElementById("settings-menu-content");
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

    /*
     * Settings menu keyboard: same as filter menu — Tab into panel, Tab/Shift+Tab cycle inside, Shift+Tab from first goes back to trigger.
     */
    const settingsTrigger = settingsDropdown?.querySelector("[slot='trigger']");
    document.addEventListener("keydown", (e) => {
        if (!settingsDropdown?.open) return;
        const panel = document.getElementById("settings-menu-content");
        if (!panel || !settingsTrigger) return;

        if (e.key === "Enter") {
            const active = document.activeElement;
            if (panel.contains(active)) {
                const switchEl = active.closest?.("wa-switch") ?? (active.tagName === "WA-SWITCH" ? active : null);
                const radioEl = active.closest?.("wa-radio") ?? (active.tagName === "WA-RADIO" ? active : null);
                if (switchEl) {
                    e.preventDefault();
                    switchEl.click();
                } else if (radioEl) {
                    e.preventDefault();
                    radioEl.click();
                }
            }
            return;
        }

        if (e.key !== "Tab") return;
        const active = document.activeElement;
        const focusables = getSettingsPanelFocusables();
        const first = focusables[0] ?? null;
        const focusOnTrigger = active === settingsTrigger || settingsTrigger.contains(active);
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
                settingsTrigger.querySelector("wa-button")?.focus();
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

    if (deleteCardConfirmProceed) {
        deleteCardConfirmProceed.addEventListener("click", async () => {
            if (pendingDeleteCardId != null) {
                removeCard(pendingDeleteCardId);
                pendingDeleteCardId = null;
            }
            if (deleteCardConfirmDialog) deleteCardConfirmDialog.open = false;
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
        const data = modified.map((c) => {
            const spell = spellToExportFormat(c.spell);
            // Ensure isSRD is only true/false (not string)
            if (spell.isSRD) {
                spell.isSRD = true;
            }
            return spell;
        });
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
            // Update source dropdown if edit dialog is open
            if (editCardDialog?.open) {
                const currentSource = editCardForm.querySelector("#edit-source")?.value;
                updateSourceDropdown();
                // Restore the selected source if it still exists
                if (currentSource) {
                    const sourceSel = editCardForm.querySelector("#edit-source");
                    if (sourceSel && Array.from(sourceSel.querySelectorAll("wa-option")).some(opt => opt.value === currentSource)) {
                        sourceSel.value = currentSource;
                    }
                }
            }
        } catch (err) {
            console.error("Upload spells error:", err);
        }
    });

    printBtn.addEventListener("click", () => openPrintWindow());

    // --- Card actions: earmark, delete, duplicate, edit ---
    printableArea.addEventListener("card-earmark", async (event) => {
        const card = cardList.find(
            (c) => c instanceof SpellCard && c.id === event.detail.cardId
        );
        if (!card) return;
        card.setAlwaysPrepared(!card.isAlwaysPrepared);
    });

    printableArea.addEventListener("mouseover", (event) => {
        const cardEl = event.target.closest(".spell-card");
        if (cardEl?.dataset.cardId) {
            const cardId = cardEl.dataset.cardId;
            printableArea
                .querySelectorAll(`.spell-card[data-card-id="${cardId}"]`)
                .forEach((el) => el.classList.add("card-hover-pair"));
        }
    });

    printableArea.addEventListener("mouseout", (event) => {
        const cardEl = event.target.closest(".spell-card");
        if (cardEl?.dataset.cardId) {
            const cardId = cardEl.dataset.cardId;
            const related = event.relatedTarget;
            const stillOverPair = related && Array.from(
                printableArea.querySelectorAll(`.spell-card[data-card-id="${cardId}"]`)
            ).some((el) => el === related || el.contains(related));
            if (!stillOverPair) {
                printableArea
                    .querySelectorAll(`.spell-card[data-card-id="${cardId}"]`)
                    .forEach((el) => el.classList.remove("card-hover-pair"));
            }
        }
    });

    let pendingDeleteCardId = null;
    let pendingResetCardId = null;

    printableArea.addEventListener("card-delete", (event) => {
        event.stopPropagation();
        const cardId = event.detail.cardId;
        const card = cardList.find(
            (c) => c instanceof SpellCard && c.id === cardId
        );
        if (card?.spell?._modified && deleteCardConfirmDialog) {
            pendingDeleteCardId = cardId;
            deleteCardConfirmDialog.open = true;
            return;
        }
        removeCard(cardId);
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
    printableArea.addEventListener("card-cast", (event) => {
        event.stopPropagation();
        disableOnlySrdAndToast();
    });
    printableArea.addEventListener("card-download", (event) => {
        event.stopPropagation();
        const cardId = event.detail.cardId;
        const card = cardList.find(
            (c) => c instanceof SpellCard && c.id === cardId
        );
        if (!card || !card.spell._modified) return;
        
        // Slugify spell name for filename
        const slugify = (str) => {
            return str
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '') // Remove special characters
                .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
                .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
        };
        
        const spellData = spellToExportFormat(card.spell);
        // Ensure isSRD is only true/false (not string)
        if (spellData.isSRD) {
            spellData.isSRD = true;
        }
        const json = JSON.stringify(spellData, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slugify(card.spell.name)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    printableArea.addEventListener("card-reset", (event) => {
        event.stopPropagation();
        const cardId = event.detail.cardId;
        const card = cardList.find(
            (c) => c instanceof SpellCard && c.id === cardId
        );
        if (!card) return;
        if (card.originalId == null) return;
        pendingResetCardId = cardId;
        if (resetCardConfirmDialog) resetCardConfirmDialog.open = true;
    });

    if (resetCardConfirmProceed) {
        resetCardConfirmProceed.addEventListener("click", async () => {
            if (pendingResetCardId == null) return;
            const card = cardList.find(
                (c) => c instanceof SpellCard && c.id === pendingResetCardId
            );
            pendingResetCardId = null;
            if (resetCardConfirmDialog) resetCardConfirmDialog.open = false;
            if (!card) return;
            if (card.originalId == null) return;
            const spells = getSpells();
            const original = spells.find((s) => s.id === card.originalId);
            if (!original) return;
            
            // Reset to original spell data, applying SRD transformation if needed
            // (same transformation as when card was originally created)
            const resetData = applySrdTransformation(original);
            card.setSpellData(resetData);
            await card.render({ measureContainer });
            renderSpellList();
            await refreshLayout();
        });
    }

    editCardCancel.addEventListener("click", closeEditOverlay);
    editCardSave?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveEditCard();
    });
    // Prevent form submission
    editCardForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveEditCard();
    });
    // Only clear editingCard when the edit *dialog* hides, not when a child (e.g. wa-select)
    // fires wa-after-hide on its dropdown close
    editCardDialog?.addEventListener("wa-after-hide", (e) => {
        if (e.target === editCardDialog) {
            editingCard = null;
        }
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
