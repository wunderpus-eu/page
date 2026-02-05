/**
 * ui.js – Main UI: spell picker, filters, card list, layout refresh, edit overlay.
 *
 * Sets up DOMContentLoaded with all controls, event handlers, and layout wiring.
 * Card list holds SpellCard instances or glossary refs; layoutCards renders them.
 */
import {
    loadSpells,
    getSpells,
    SpellCard,
    SOURCE_MAP,
    emptySpellTemplate,
    cloneSpellData,
    createGlossaryCardRef,
    isGlossaryRef,
} from "./spell-card.js";
import { layoutCards } from "./card-layout.js";

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
    const filterSourceChips = document.getElementById("filter-source-chips");
    const filterClassChips = document.getElementById("filter-class-chips");
    const filterLevelChips = document.getElementById("filter-level-chips");
    const filterSchoolChips = document.getElementById("filter-school-chips");
    const filterClearBtn = document.getElementById("filter-clear-btn");

    const sortSelect = document.getElementById("sort-select");
    const backgroundToggle = document.getElementById("background-toggle");
    const sideBySideToggle = document.getElementById("side-by-side-toggle");
    const clearAllBtn = document.getElementById("clear-all-btn");
    const printBtn = document.getElementById("print-btn");
    const editOverlay = document.getElementById("edit-card-overlay");
    const editCardPreview = document.getElementById("edit-card-preview");
    const editCardForm = document.getElementById("edit-card-form");
    const editCardCancel = document.getElementById("edit-card-cancel");
    const editCardSave = document.getElementById("edit-card-save");

    let spellClassMap = {};
    let pageWidthPx = 0;
    let scale = 1;
    /** @type {(import("./spell-card.js").SpellCard | { type: "glossary"; id: string })[]} */
    let cardList = [];
    let editingCard = null;
    let editPreviewCard = null;
    let selectedListIndex = -1;
    let currentSpellResults = [];

    /** Selected filter values (source, class, level, school). Empty = no filter. */
    const filterValues = { source: [], class: [], level: [], school: [] };

    /** Spell classes for a spell (from spell.classes or spellClassMap). */
    function getSpellClasses(spell, index) {
        if (spell.classes && spell.classes.length > 0) return spell.classes;
        return spellClassMap[index] || [];
    }

    /** Spells matching current class, level, source, school filters. */
    function getFilteredSpells() {
        const spells = getSpells();
        const selectedClasses = filterValues.class;
        const selectedLevels = filterValues.level.map((l) =>
            l === "Cantrip" ? 0 : parseInt(l, 10)
        );
        const selectedSources = filterValues.source;
        const selectedSchools = filterValues.school;

        return spells.filter((spell, index) => {
            const spellClasses = getSpellClasses(spell, index);
            const classMatch =
                selectedClasses.length === 0 ||
                selectedClasses.some((c) => spellClasses.includes(c));
            const levelMatch =
                selectedLevels.length === 0 ||
                selectedLevels.includes(spell.level);
            const sourceMatch =
                selectedSources.length === 0 ||
                selectedSources.some((src) => {
                    if (src === "PHB")
                        return (
                            spell.source === "PHB" || spell.source === "XPHB"
                        );
                    return spell.source === src;
                });
            const schoolMatch =
                selectedSchools.length === 0 ||
                selectedSchools.includes(spell.school);
            return classMatch && levelMatch && sourceMatch && schoolMatch;
        });
    }

    /** Active filter chips for display (source, class, level, school). */
    function getActiveFilterChips() {
        const chips = [];
        const sources = filterValues.source;
        const classes = filterValues.class;
        const levels = filterValues.level;
        const schools = filterValues.school;
        sources.forEach((s) =>
            chips.push({ key: "source", value: s, label: SOURCE_MAP[s] || s })
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

    /** Renders active filter chips with remove buttons. */
    function renderChips() {
        const chips = getActiveFilterChips();
        spellListChips.innerHTML = "";
        chips.forEach(({ key, value, label }) => {
            const tag = document.createElement("sl-tag");
            tag.removable = true;
            tag.textContent = label;
            tag.addEventListener("sl-remove", (event) => {
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
        const list = query
            ? filtered.filter((s) => fuzzyMatch(query, s.name))
            : filtered;
        currentSpellResults = list.slice();

        spellListCount.textContent = `${list.length} spell${
            list.length !== 1 ? "s" : ""
        }`;
        spellListAddAll.disabled = list.length === 0;

        spellList.innerHTML = "";
        const maxShow = 400;
        list.slice(0, maxShow).forEach((spell, idx) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "spell-list-item";
            const sourceText = SOURCE_MAP[spell.source] || spell.source;
            const label = document.createElement("span");
            label.className = "spell-list-item-label";
            label.textContent = `${spell.name} (${sourceText})`;
            row.appendChild(label);
            const count = countUnmodifiedInDeck(spell);
            if (count > 0) {
                const badge = document.createElement("span");
                badge.className = "spell-list-count-badge";
                badge.textContent = String(count);
                badge.title = "Remove one from deck";
                badge.addEventListener("click", (e) => {
                    e.stopPropagation();
                    removeOneUnmodifiedCard(spell);
                });
                row.appendChild(badge);
            }
            row.dataset.index = String(idx);
            row.addEventListener("click", async (e) => {
                if (e.target.classList.contains("spell-list-count-badge"))
                    return;
                e.stopPropagation();
                await addCard(cloneSpellData(spell));
                renderSpellList();
                spellSearchInput.focus();
            });
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
        selectedListIndex = list.length > 0 ? 0 : -1;
        updateListSelection();
    }

    /** Updates selected-row styling based on selectedListIndex. */
    function updateListSelection() {
        const items = spellList.querySelectorAll(".spell-list-item");
        items.forEach((el, i) => {
            el.classList.toggle("selected", i === selectedListIndex);
        });
    }

    /** Adds a SpellCard to cardList, renders it, and refreshes layout.
     * @param {object} spellData - Spell data for the card
     * @param {object} [originalSpell] - When adding from list, the list spell; stores name/source for reset
     */
    async function addCard(spellData, originalSpell) {
        const card = new SpellCard(spellData);
        if (originalSpell) {
            card.originalName = originalSpell.name;
            card.originalSource = originalSpell.source;
        }
        await card.render();
        cardList.push(card);
        await refreshLayout();
    }

    /**
     * Count of unmodified cards in the deck matching this list spell (same name + source).
     * Only counts SpellCards whose spell data has not been edited (no _modified flag).
     */
    function countUnmodifiedInDeck(listSpell) {
        return cardList.filter(
            (c) =>
                c instanceof SpellCard &&
                c.spell.name === listSpell.name &&
                c.spell.source === listSpell.source &&
                !c.spell._modified
        ).length;
    }

    /**
     * Removes one unmodified card matching the list spell from the deck.
     * Only removes SpellCards that match name + source and are not modified.
     */
    async function removeOneUnmodifiedCard(listSpell) {
        const idx = cardList.findIndex(
            (c) =>
                c instanceof SpellCard &&
                c.spell.name === listSpell.name &&
                c.spell.source === listSpell.source &&
                !c.spell._modified
        );
        if (idx === -1) return;
        cardList.splice(idx, 1);
        renderSpellList();
        await refreshLayout();
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

    /** Sorts spell cards by alphabetical, level, or school; glossary cards first. */
    function sortCardList(list, sortBy) {
        const glossary = list.filter((c) => isGlossaryRef(c));
        const rest = list.filter((c) => !isGlossaryRef(c));
        const name = (c) => c.spell?.name ?? "";
        const level = (c) => c.spell?.level ?? 0;
        const school = (c) => c.spell?.school ?? "";
        if (sortBy === "alphabetical") {
            rest.sort((a, b) => name(a).localeCompare(name(b)));
        } else if (sortBy === "level") {
            rest.sort(
                (a, b) => level(a) - level(b) || name(a).localeCompare(name(b))
            );
        } else if (sortBy === "school") {
            rest.sort(
                (a, b) =>
                    school(a).localeCompare(school(b)) ||
                    name(a).localeCompare(name(b))
            );
        }
        return [...glossary, ...rest];
    }

    /** Re-renders cards, applies grayscale, sorts, and calls layoutCards. */
    async function refreshLayout() {
        document.body.classList.toggle("grayscale", colorToggle.checked);
        for (const c of cardList) {
            if (c instanceof SpellCard) await c.render();
        }
        const sorted = sortCardList(cardList, sortSelect.value);
        const options = {
            defaultCardBack: backgroundToggle.checked,
            sideBySide: sideBySideToggle.checked && !backgroundToggle.checked,
        };
        await layoutCards(sorted, pageSizeSelect.value, printableArea, options);
        updateWrapperSizeAndPosition();
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
        await newCard.render();
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
                const ta = document.createElement("sl-textarea");
                ta.id = `edit-${name}`;
                ta.name = name;
                ta.value = value ?? "";
                ta.rows = options.rows || 3;
                wrap.appendChild(ta);
                ta.addEventListener("sl-input", () => updateEditPreview());
            } else if (type === "number") {
                const inp = document.createElement("sl-input");
                inp.type = "number";
                inp.id = `edit-${name}`;
                inp.name = name;
                inp.value = String(value ?? "");
                wrap.appendChild(inp);
                inp.addEventListener("sl-input", () => updateEditPreview());
            } else if (type === "select") {
                const sel = document.createElement("sl-select");
                sel.id = `edit-${name}`;
                sel.name = name;
                (options.choices || []).forEach((opt) => {
                    const o = document.createElement("sl-option");
                    o.value = opt.value;
                    o.textContent = opt.label;
                    sel.appendChild(o);
                });
                sel.value = value ?? "";
                wrap.appendChild(sel);
                sel.addEventListener("sl-change", () => updateEditPreview());
            } else if (type === "checkbox") {
                const cb = document.createElement("sl-checkbox");
                cb.id = `edit-${name}`;
                cb.name = name;
                cb.checked = !!value;
                wrap.appendChild(cb);
                cb.addEventListener("sl-change", () => updateEditPreview());
            } else {
                const inp = document.createElement("sl-input");
                inp.id = `edit-${name}`;
                inp.name = name;
                inp.value = value ?? "";
                wrap.appendChild(inp);
                inp.addEventListener("sl-input", () => updateEditPreview());
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
        const timeNumberInp = document.createElement("sl-input");
        timeNumberInp.type = "number";
        timeNumberInp.min = "1";
        timeNumberInp.id = "edit-time_number";
        timeNumberInp.name = "time_number";
        timeNumberInp.value = String(Math.max(1, spell.time?.number ?? 1));
        timeNumberWrap.appendChild(timeNumberInp);
        timeNumberInp.addEventListener("sl-input", () => updateEditPreview());
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
        const timeConditionInp = document.createElement("sl-textarea");
        timeConditionInp.id = "edit-time_condition";
        timeConditionInp.name = "time_condition";
        timeConditionInp.value = spell.time?.condition ?? "";
        timeConditionInp.rows = 2;
        timeConditionWrap.appendChild(timeConditionInp);
        timeConditionInp.addEventListener("sl-input", () =>
            updateEditPreview()
        );
        editCardForm.appendChild(timeConditionWrap);
        const showHideTimeCondition = () => {
            const unit = timeUnitSel?.value ?? "action";
            const show = unit === "reaction";
            timeConditionWrap.style.display = show ? "" : "none";
            if (!show) timeConditionInp.value = "";
        };
        timeUnitSel?.addEventListener("sl-change", () => {
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
        const rangeDistInp = document.createElement("sl-input");
        rangeDistInp.type = "number";
        rangeDistInp.min = "1";
        rangeDistInp.id = "edit-range_distance";
        rangeDistInp.name = "range_distance";
        rangeDistInp.value = String(Math.max(1, spell.range?.distance ?? 1));
        rangeDistanceWrap.appendChild(rangeDistInp);
        rangeDistInp.addEventListener("sl-input", () => updateEditPreview());
        editCardForm.appendChild(rangeDistanceWrap);
        const rangeUnitWrap = document.createElement("div");
        rangeUnitWrap.className = "form-field form-field-range-unit";
        rangeUnitWrap.id = "edit-range-unit-wrap";
        const rangeUnitLab = document.createElement("label");
        rangeUnitLab.textContent = "Unit";
        rangeUnitLab.htmlFor = "edit-range_unit";
        rangeUnitWrap.appendChild(rangeUnitLab);
        const rangeUnitSel = document.createElement("sl-select");
        rangeUnitSel.id = "edit-range_unit";
        rangeUnitSel.name = "range_unit";
        RANGE_UNITS.forEach((opt) => {
            const o = document.createElement("sl-option");
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
        rangeOriginSel?.addEventListener("sl-change", () => {
            showHideRangeDistance();
            updateEditPreview();
        });
        rangeUnitSel?.addEventListener("sl-change", () => {
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
        const areaDistInp = document.createElement("sl-input");
        areaDistInp.type = "number";
        areaDistInp.min = "1";
        areaDistInp.id = "edit-area_distance";
        areaDistInp.name = "area_distance";
        areaDistInp.value = String(Math.max(1, spell.range?.areaDistance ?? 5));
        areaPrimaryWrap.appendChild(areaDistInp);
        areaDistInp.addEventListener("sl-input", () => updateEditPreview());
        const areaUnitWrap = document.createElement("div");
        areaUnitWrap.className = "form-field form-field-area-unit";
        const areaUnitLab = document.createElement("label");
        areaUnitLab.id = "edit-area-unit-label";
        areaUnitLab.textContent = "Unit";
        areaUnitLab.htmlFor = "edit-area_unit";
        areaUnitWrap.appendChild(areaUnitLab);
        const areaUnitSel = document.createElement("sl-select");
        areaUnitSel.id = "edit-area_unit";
        areaUnitSel.name = "area_unit";
        [
            { value: "feet", label: "Feet" },
            { value: "miles", label: "Miles" },
        ].forEach((opt) => {
            const o = document.createElement("sl-option");
            o.value = opt.value;
            o.textContent = opt.label;
            areaUnitSel.appendChild(o);
        });
        areaUnitSel.value = spell.range?.areaUnit ?? "feet";
        areaUnitWrap.appendChild(areaUnitSel);
        areaUnitSel.addEventListener("sl-change", () => updateEditPreview());
        areaDimsWrap.appendChild(areaPrimaryWrap);
        areaDimsWrap.appendChild(areaUnitWrap);
        const areaHeightWrap = document.createElement("div");
        areaHeightWrap.className = "form-field form-field-area-height";
        areaHeightWrap.id = "edit-area-height-wrap";
        const areaHeightLab = document.createElement("label");
        areaHeightLab.textContent = "Height";
        areaHeightLab.htmlFor = "edit-area_height";
        areaHeightWrap.appendChild(areaHeightLab);
        const areaHeightInp = document.createElement("sl-input");
        areaHeightInp.type = "number";
        areaHeightInp.min = "1";
        areaHeightInp.id = "edit-area_height";
        areaHeightInp.name = "area_height";
        areaHeightInp.value = String(Math.max(1, spell.range?.areaHeight ?? 5));
        areaHeightWrap.appendChild(areaHeightInp);
        areaHeightInp.addEventListener("sl-input", () => updateEditPreview());
        const areaHeightUnitWrap = document.createElement("div");
        areaHeightUnitWrap.className = "form-field form-field-area-height-unit";
        const areaHeightUnitLab = document.createElement("label");
        areaHeightUnitLab.textContent = "Height unit";
        areaHeightUnitLab.htmlFor = "edit-area_height_unit";
        areaHeightUnitWrap.appendChild(areaHeightUnitLab);
        const areaHeightUnitSel = document.createElement("sl-select");
        areaHeightUnitSel.id = "edit-area_height_unit";
        areaHeightUnitSel.name = "area_height_unit";
        [
            { value: "feet", label: "Feet" },
            { value: "miles", label: "Miles" },
        ].forEach((opt) => {
            const o = document.createElement("sl-option");
            o.value = opt.value;
            o.textContent = opt.label;
            areaHeightUnitSel.appendChild(o);
        });
        areaHeightUnitSel.value = spell.range?.areaHeightUnit ?? "feet";
        areaHeightUnitWrap.appendChild(areaHeightUnitSel);
        areaHeightUnitSel.addEventListener("sl-change", () =>
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
        rangeAreaSel?.addEventListener("sl-change", () => {
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
        const durationAmountInp = document.createElement("sl-input");
        durationAmountInp.type = "number";
        durationAmountInp.min = "1";
        durationAmountInp.id = "edit-duration_amount";
        durationAmountInp.name = "duration_amount";
        durationAmountInp.value = String(
            Math.max(1, spell.duration?.amount ?? 1)
        );
        durationAmountWrap.appendChild(durationAmountInp);
        durationAmountInp.addEventListener("sl-input", () =>
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
        const durationUnitSel = document.createElement("sl-select");
        durationUnitSel.id = "edit-duration_unit";
        durationUnitSel.name = "duration_unit";
        DURATION_UNITS.forEach((opt) => {
            const o = document.createElement("sl-option");
            o.value = opt.value;
            o.textContent = opt.label;
            durationUnitSel.appendChild(o);
        });
        durationUnitSel.value = spell.duration?.unit ?? "minute";
        durationUnitWrap.appendChild(durationUnitSel);
        durationUnitSel.addEventListener("sl-change", () =>
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
            const tag = document.createElement("sl-tag");
            tag.className = "duration-end-tag";
            tag.dataset.value = value;
            tag.textContent = label;
            tag.variant = durationEnds.includes(value) ? "primary" : "neutral";
            tag.style.cursor = "pointer";
            tag.addEventListener("click", () => {
                const container = document.getElementById(
                    "edit-duration-ends-wrap"
                );
                const tags = container.querySelectorAll(".duration-end-tag");
                const ends = Array.from(tags)
                    .filter((t) => t.variant === "primary")
                    .map((t) => t.dataset.value);
                const idx = ends.indexOf(value);
                if (idx >= 0) ends.splice(idx, 1);
                else ends.push(value);
                tags.forEach((t) => {
                    t.variant = ends.includes(t.dataset.value)
                        ? "primary"
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
        durationTypeSel?.addEventListener("sl-change", () => {
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
        const componentsHasCostCb = document.createElement("sl-checkbox");
        componentsHasCostCb.id = "edit-components_has_cost";
        componentsHasCostCb.name = "components_has_cost";
        componentsHasCostCb.checked = !!spell.components?.hasCost;
        componentsMaterialWrap.appendChild(componentsHasCostLab);
        componentsMaterialWrap.appendChild(componentsHasCostCb);
        componentsHasCostCb.addEventListener("sl-change", () => {
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
        const componentsConsumedCb = document.createElement("sl-checkbox");
        componentsConsumedCb.id = "edit-components_is_consumed";
        componentsConsumedCb.name = "components_is_consumed";
        componentsConsumedCb.checked = !!spell.components?.isConsumed;
        componentsConsumedWrap.appendChild(componentsConsumedLab);
        componentsConsumedWrap.appendChild(componentsConsumedCb);
        componentsConsumedCb.addEventListener("sl-change", () =>
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
        const componentsDescInp = document.createElement("sl-input");
        componentsDescInp.id = "edit-components_description";
        componentsDescInp.name = "components_description";
        componentsDescInp.value = spell.components?.description ?? "";
        componentsDescWrap.appendChild(componentsDescInp);
        componentsDescInp.addEventListener("sl-input", () =>
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
        componentsMCb?.addEventListener("sl-change", () => {
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
            const tag = document.createElement("sl-tag");
            tag.className = "edit-class-tag";
            tag.dataset.value = className;
            tag.textContent = className;
            tag.variant = spellClasses.includes(className)
                ? "primary"
                : "neutral";
            tag.style.cursor = "pointer";
            tag.addEventListener("click", () => {
                const wrap = document.getElementById("edit-classes-wrap");
                const tags = wrap.querySelectorAll(".edit-class-tag");
                const selected = Array.from(tags)
                    .filter((t) => t.variant === "primary")
                    .map((t) => t.dataset.value);
                const idx = selected.indexOf(className);
                if (idx >= 0) selected.splice(idx, 1);
                else selected.push(className);
                tags.forEach((t) => {
                    t.variant = selected.includes(t.dataset.value)
                        ? "primary"
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
                      .filter((t) => t.variant === "primary")
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
                  .filter((t) => t.variant === "primary")
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
        await editingCard.render();
        closeEditOverlay();
        await refreshLayout();
    }

    /** Reloads spells for current ruleset, repopulates filters, refreshes layout. */
    async function reloadData() {
        const use2024 = filterRuleset.checked;
        const loaded = await loadSpells(use2024);
        spellClassMap = loaded.spellClassMap;
        populateFilterChips();
        renderSpellList();
        renderChips();
        await refreshLayout();
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
            chip.variant = selected.has(val) ? "primary" : "neutral";
        });
    }

    /** Creates a clickable filter chip that toggles selection. */
    function createFilterChip(key, value, label) {
        const tag = document.createElement("sl-tag");
        tag.className = "filter-chip";
        tag.dataset.value = value;
        tag.textContent = label;
        tag.variant = filterValues[key].includes(value) ? "primary" : "neutral";
        tag.style.cursor = "pointer";
        tag.addEventListener("click", () => {
            const arr = filterValues[key];
            const idx = arr.indexOf(value);
            if (idx >= 0) arr.splice(idx, 1);
            else arr.push(value);
            renderSpellList();
            renderChips();
            updateFilterChipSelection(key);
        });
        return tag;
    }

    /** Populates filter chip lists from current spells; preserves valid selections. */
    function populateFilterChips() {
        const prevSources = [...filterValues.source];
        const prevClasses = [...filterValues.class];
        const prevLevels = [...filterValues.level];
        const prevSchools = [...filterValues.school];

        const spells = getSpells();
        const allClasses = new Set();
        const allLevels = new Set();
        const allSources = new Set();
        const allSchools = new Set();

        spells.forEach((spell, index) => {
            getSpellClasses(spell, index).forEach((c) => allClasses.add(c));
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
            labelFn = (v) => v
        ) => {
            container.innerHTML = "";
            [...options].sort(sortFn).forEach((val) => {
                container.appendChild(createFilterChip(key, val, labelFn(val)));
            });
        };

        const levelSort = (a, b) => {
            if (a === "Cantrip") return -1;
            if (b === "Cantrip") return 1;
            return parseInt(a, 10) - parseInt(b, 10);
        };

        fillChips(filterClassChips, allClasses, "class");
        fillChips(filterLevelChips, allLevels, "level", levelSort);
        fillChips(
            filterSourceChips,
            allSources,
            "source",
            undefined,
            (s) => SOURCE_MAP[s] || s
        );
        fillChips(filterSchoolChips, allSchools, "school");
    }

    /** Adjusts main container size for header height. */
    function handleZoom() {
        const headerHeight = header.getBoundingClientRect().height;
        mainContainer.style.marginTop = `${headerHeight}px`;
        mainContainer.style.height = `calc(100vh - ${headerHeight}px)`;
    }

    /** Updates printable-area wrapper dimensions for zoom/scale. */
    function updateWrapperSizeAndPosition() {
        const containerHeight = mainContainer.clientHeight;
        const wrapperWidth = pageWidthPx * scale;
        const wrapperHeight = printableArea.scrollHeight * scale;
        printableAreaWrapper.style.width = `${wrapperWidth}px`;
        printableAreaWrapper.style.height = `${
            wrapperHeight + containerHeight / 2
        }px`;
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
    spellSearchInput.addEventListener("sl-focus", () => {
        /* Defer open so the initial click isn’t treated as “outside” and close the panel */
        requestAnimationFrame(() => {
            spellCombobox.open = true;
        });
    });
    /* When list is open, clicking the input again must not close it (only outside click should close) */
    spellSearchInput.addEventListener("click", (e) => {
        if (spellCombobox.open) e.stopPropagation();
    });
    spellSearchInput.addEventListener("sl-input", () => {
        renderSpellList();
        if (!spellCombobox.open) spellCombobox.open = true;
    });
    spellSearchInput.addEventListener("keydown", (e) => {
        if (e.key === " ") {
            e.stopPropagation();
        }
        const items = spellList.querySelectorAll(".spell-list-item");
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedListIndex = Math.min(
                selectedListIndex + 1,
                items.length - 1
            );
            updateListSelection();
            items[selectedListIndex]?.scrollIntoView({ block: "nearest" });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedListIndex = Math.max(selectedListIndex - 1, 0);
            updateListSelection();
            items[selectedListIndex]?.scrollIntoView({ block: "nearest" });
        } else if (
            e.key === "Enter" &&
            selectedListIndex >= 0 &&
            items[selectedListIndex]
        ) {
            e.preventDefault();
            e.stopPropagation();
            items[selectedListIndex].click();
        }
    });

    spellCombobox.addEventListener("sl-show", () => {
        renderSpellList();
        renderChips();
        /* Don’t call focus() here – it can cause a focus cycle that closes the panel on first open */
    });

    spellListAddAll.addEventListener("click", async (e) => {
        e.stopPropagation();
        const toAdd = currentSpellResults;
        for (const spell of toAdd) await addCard(cloneSpellData(spell), spell);
        spellSearchInput.focus();
    });

    addEmptyBtn.addEventListener("click", () => addCard(emptySpellTemplate()));
    addGlossaryBtn.addEventListener("click", () => {
        cardList.push(createGlossaryCardRef());
        refreshLayout();
    });

    // --- Filters and display options ---
    filterRuleset.addEventListener("sl-change", reloadData);
    filterClearBtn.addEventListener("click", () => {
        filterValues.source = [];
        filterValues.class = [];
        filterValues.level = [];
        filterValues.school = [];
        renderSpellList();
        renderChips();
        ["source", "class", "level", "school"].forEach(
            updateFilterChipSelection
        );
    });

    pageSizeSelect.addEventListener("sl-change", () => {
        updatePageWidth();
        refreshLayout();
    });
    sortSelect.addEventListener("sl-change", refreshLayout);
    colorToggle.addEventListener("sl-change", refreshLayout);
    backgroundToggle.addEventListener("sl-change", () => {
        sideBySideToggle.disabled = backgroundToggle.checked;
        refreshLayout();
    });
    sideBySideToggle.addEventListener("sl-change", refreshLayout);
    clearAllBtn.addEventListener("click", async () => {
        cardList = [];
        renderSpellList();
        await refreshLayout();
    });
    printBtn.addEventListener("click", () => window.print());

    // --- Card actions: prepared checkbox, delete, duplicate, edit ---
    printableArea.addEventListener("sl-change", async (event) => {
        if (!event.target.classList.contains("prepared-checkbox")) return;
        const cardEl = event.target.closest(".spell-card");
        if (!cardEl?.dataset.cardId) return;
        const card = cardList.find(
            (c) => c instanceof SpellCard && c.id === cardEl.dataset.cardId
        );
        if (!card) return;
        await card.setAlwaysPrepared(event.target.checked);
        await refreshLayout();
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
        if (!card || card.originalName == null || card.originalSource == null)
            return;
        const spells = getSpells();
        const original = spells.find(
            (s) =>
                s.name === card.originalName && s.source === card.originalSource
        );
        if (!original) return;
        card.setSpellData(cloneSpellData(original));
        await card.render();
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
