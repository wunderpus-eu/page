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
    const filterSource = document.getElementById("filter-source");
    const filterClass = document.getElementById("filter-class");
    const filterLevel = document.getElementById("filter-level");
    const filterSchool = document.getElementById("filter-school");
    const filterClearBtn = document.getElementById("filter-clear-btn");

    const sortSelect = document.getElementById("sort-select");
    const backgroundToggle = document.getElementById("background-toggle");
    const sideBySideToggle = document.getElementById("side-by-side-toggle");
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

    /** Spell classes for a spell (from spell.classes or spellClassMap). */
    function getSpellClasses(spell, index) {
        if (spell.classes && spell.classes.length > 0) return spell.classes;
        return spellClassMap[index] || [];
    }

    /** Spells matching current class, level, source, school filters. */
    function getFilteredSpells() {
        const spells = getSpells();
        const selectedClasses = filterClass.value || [];
        const selectedLevels = (filterLevel.value || []).map((l) =>
            l === "Cantrip" ? 0 : parseInt(l, 10)
        );
        const selectedSources = filterSource.value || [];
        const selectedSchools = filterSchool.value || [];

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
        const sources = filterSource.value || [];
        const classes = filterClass.value || [];
        const levels = filterLevel.value || [];
        const schools = filterSchool.value || [];
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
        if (key === "source")
            filterSource.value = (filterSource.value || []).filter(
                (v) => v !== value
            );
        if (key === "class")
            filterClass.value = (filterClass.value || []).filter(
                (v) => v !== value
            );
        if (key === "level")
            filterLevel.value = (filterLevel.value || []).filter(
                (v) => v !== value
            );
        if (key === "school")
            filterSchool.value = (filterSchool.value || []).filter(
                (v) => v !== value
            );
        renderSpellList();
        renderChips();
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

    /** Shows a transient checkmark on a spell list row after add. */
    function showCheckmark(rowEl) {
        const check = document.createElement("sl-icon");
        check.name = "check2";
        check.className = "spell-list-check";
        rowEl.appendChild(check);
        setTimeout(() => check.remove(), 600);
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
            row.textContent = `${spell.name} (${sourceText})`;
            row.dataset.index = String(idx);
            row.addEventListener("click", async (e) => {
                e.stopPropagation();
                await addCard(cloneSpellData(spell));
                showCheckmark(row);
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

    /** Adds a SpellCard to cardList, renders it, and refreshes layout. */
    async function addCard(spellData) {
        const card = new SpellCard(spellData);
        await card.render();
        cardList.push(card);
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
        addField("Level", "level", spell.level, "number");
        addField("School", "school", spell.school, "select", {
            choices: SCHOOLS.map((s) => ({ value: s, label: s })),
        });
        addField("Source", "source", spell.source);
        addField(
            "Casting time (number)",
            "time_number",
            spell.time?.number,
            "number"
        );
        addField(
            "Casting time (unit)",
            "time_unit",
            spell.time?.unit,
            "select",
            {
                choices: [
                    { value: "action", label: "Action" },
                    { value: "bonus", label: "Bonus" },
                    { value: "reaction", label: "Reaction" },
                    { value: "minute", label: "Minute(s)" },
                    { value: "hour", label: "Hour(s)" },
                ],
            }
        );
        addField("Range origin", "range_origin", spell.range?.origin);
        addField(
            "Range distance",
            "range_distance",
            spell.range?.distance,
            "number"
        );
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
        addField("Duration type", "duration_type", spell.duration?.type);
        addField(
            "Duration amount",
            "duration_amount",
            spell.duration?.amount,
            "number"
        );
        addField("Description", "description", spell.description, "textarea", {
            rows: 6,
        });
        addField(
            "Concentration",
            "isConcentration",
            spell.isConcentration,
            "checkbox"
        );
        addField("Ritual", "isRitual", spell.isRitual, "checkbox");
        addField("At higher levels", "upcast", spell.upcast || "", "textarea", {
            rows: 2,
        });
        const classesWrap = document.createElement("div");
        classesWrap.className = "form-field";
        const classesLab = document.createElement("label");
        classesLab.textContent = "Classes (comma-separated)";
        classesWrap.appendChild(classesLab);
        const classesInp = document.createElement("sl-input");
        classesInp.id = "edit-classes";
        classesInp.name = "classes";
        classesInp.value = (spell.classes || []).join(", ");
        classesWrap.appendChild(classesInp);
        classesInp.addEventListener("sl-input", () => updateEditPreview());
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
        spell.time.number = parseInt(
            editCardForm.querySelector("#edit-time_number")?.value ?? "1",
            10
        );
        spell.time.unit =
            editCardForm.querySelector("#edit-time_unit")?.value ?? "action";
        spell.range = spell.range || {};
        spell.range.origin =
            editCardForm.querySelector("#edit-range_origin")?.value ??
            spell.range.origin;
        spell.range.distance = parseInt(
            editCardForm.querySelector("#edit-range_distance")?.value ?? "0",
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
        spell.duration = spell.duration || {
            type: "timed",
            amount: 0,
            unit: "",
            ends: [],
        };
        spell.duration.type =
            editCardForm.querySelector("#edit-duration_type")?.value ??
            spell.duration.type;
        spell.duration.amount = parseInt(
            editCardForm.querySelector("#edit-duration_amount")?.value ?? "0",
            10
        );
        spell.description =
            editCardForm.querySelector("#edit-description")?.value ?? "";
        spell.isConcentration =
            editCardForm.querySelector("#edit-isConcentration")?.checked ??
            false;
        spell.isRitual =
            editCardForm.querySelector("#edit-isRitual")?.checked ?? false;
        spell.upcast = editCardForm.querySelector("#edit-upcast")?.value ?? "";
        const classesStr =
            editCardForm.querySelector("#edit-classes")?.value ?? "";
        spell.classes = classesStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
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
        populateFilterSelects();
        renderSpellList();
        renderChips();
        await refreshLayout();
    }

    /** Populates filter dropdowns from current spells; preserves valid selections. */
    function populateFilterSelects() {
        const prevSources = filterSource.value ? [...filterSource.value] : [];
        const prevClasses = filterClass.value ? [...filterClass.value] : [];
        const prevLevels = filterLevel.value ? [...filterLevel.value] : [];
        const prevSchools = filterSchool.value ? [...filterSchool.value] : [];

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

        const fillSelect = (
            el,
            options,
            sortFn = (a, b) => a.localeCompare(b)
        ) => {
            el.innerHTML = "";
            [...options].sort(sortFn).forEach((val) => {
                const opt = document.createElement("sl-option");
                opt.value = val;
                opt.textContent = val;
                el.appendChild(opt);
            });
        };

        fillSelect(filterClass, allClasses);
        fillSelect(filterLevel, allLevels, (a, b) => {
            if (a === "Cantrip") return -1;
            if (b === "Cantrip") return 1;
            return parseInt(a, 10) - parseInt(b, 10);
        });
        fillSelect(filterSource, allSources);
        fillSelect(filterSchool, allSchools);

        const sanitizeValues = (values, allowed) =>
            (values || []).filter((val) => allowed.has(val));

        filterSource.value = sanitizeValues(prevSources, allSources);
        filterClass.value = sanitizeValues(prevClasses, allClasses);
        filterLevel.value = sanitizeValues(prevLevels, allLevels);
        filterSchool.value = sanitizeValues(prevSchools, allSchools);
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
        for (const spell of toAdd) await addCard(cloneSpellData(spell));
        spellSearchInput.focus();
    });

    addEmptyBtn.addEventListener("click", () => addCard(emptySpellTemplate()));
    addGlossaryBtn.addEventListener("click", () => {
        cardList.push(createGlossaryCardRef());
        refreshLayout();
    });

    // --- Filters and display options ---
    filterRuleset.addEventListener("sl-change", reloadData);
    filterSource.addEventListener("sl-change", () => {
        renderSpellList();
        renderChips();
    });
    filterClass.addEventListener("sl-change", () => {
        renderSpellList();
        renderChips();
    });
    filterLevel.addEventListener("sl-change", () => {
        renderSpellList();
        renderChips();
    });
    filterSchool.addEventListener("sl-change", () => {
        renderSpellList();
        renderChips();
    });
    filterClearBtn.addEventListener("click", () => {
        filterSource.value = [];
        filterClass.value = [];
        filterLevel.value = [];
        filterSchool.value = [];
        renderSpellList();
        renderChips();
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
