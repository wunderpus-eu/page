/**
 * card-layout.js – Page layout for printable spell cards.
 *
 * When layout runs: remove all cards from the DOM, compute page count,
 * add/remove/resize pages, then place cards one by one from the ordered
 * card list. Caller must (re-)render all cards before calling layout once.
 */
import {
    SpellCard,
    isGlossaryRef,
    createGlossaryCard,
} from "./card.js";

/** Fixed card size in mm (matches .spell-card in card.css). */
const CARD_WIDTH_MM = 63;
const CARD_HEIGHT_MM = 88;

/** Cut marks: gap between card grid and marks, then mark length (mm). */
const CUT_MARK_GAP_MM = 2;
const CUT_MARK_LENGTH_MM = 3;
const CUT_MARK_THICKNESS_MM = 0.25;
const CUT_MARK_GUTTER_MM = CUT_MARK_GAP_MM + CUT_MARK_LENGTH_MM;

/**
 * Places cards into printable pages. Cards must already be rendered (except glossary nodes, created on demand).
 *
 * @param {(import("./card.js").SpellCard | { type: "glossary"; id: string })[]} cards - Sorted list (caller sorts; blanks/glossary first)
 * @param {"a4" | "letter"} pageSize
 * @param {HTMLElement} printableArea
 * @param {{ defaultCardBack?: boolean; sideBySide?: boolean }} [options]
 */
export async function layoutCards(
    cards,
    pageSize,
    printableArea,
    options = {}
) {
    const { defaultCardBack = false, sideBySide = false } = options;

    closePopoversIn(printableArea);
    await nextFrame();

    if (cards.length === 0) {
        printableArea.innerHTML = "";
        return;
    }

    const cardWidth = CARD_WIDTH_MM;
    const cardHeight = CARD_HEIGHT_MM;

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

    const containerWidth = cardsPerRow * cardWidth;
    const containerHeight = rowsPerPage * cardHeight;

    const existingPages = Array.from(printableArea.querySelectorAll(".page"));

    // 1. Remove all cards from the DOM
    for (const page of existingPages) {
        const cardContainer = page.querySelector(".card-container");
        if (cardContainer) {
            while (cardContainer.firstChild) {
                cardContainer.removeChild(cardContainer.firstChild);
            }
        }
    }

    for (const item of cards) {
        if (item instanceof SpellCard) {
            if (item.frontElement?.parentNode)
                item.frontElement.parentNode.removeChild(item.frontElement);
            if (item.backElement?.parentNode)
                item.backElement.parentNode.removeChild(item.backElement);
        }
    }

    const useSideBySide = sideBySide && !defaultCardBack;

    // 2. Count total slots from the card list (no separate sequence)
    let slot = 0;
    for (const item of cards) {
        const hasBack = item instanceof SpellCard
            ? (!!item.backElement || (defaultCardBack && !item.backElement))
            : true;
        const hasRealBack = item instanceof SpellCard ? !!item.backElement : true;
        if (useSideBySide && hasRealBack && slot % cardsPerRow === cardsPerRow - 1)
            slot++;
        slot += hasBack ? 2 : 1;
    }
    const totalSlots = slot;

    const pagesNeeded = Math.ceil(totalSlots / maxCardsPerPage);

    // 3. Add/remove/resize pages
    while (existingPages.length > pagesNeeded) {
        existingPages.pop().remove();
    }
    while (existingPages.length < pagesNeeded) {
        const newPage = createPage(
            pageSize,
            containerWidth,
            containerHeight,
            cardsPerRow,
            rowsPerPage
        );
        printableArea.appendChild(newPage);
        existingPages.push(newPage);
    }

    const wrapperWidth = containerWidth + 2 * CUT_MARK_GUTTER_MM;
    const wrapperHeight = containerHeight + 2 * CUT_MARK_GUTTER_MM;

    for (const page of existingPages) {
        ensurePageStructure(
            page,
            pageSize,
            containerWidth,
            containerHeight,
            cardsPerRow,
            rowsPerPage
        );
        const pageContent = page.querySelector(".page-content");
        const cardContainer = page.querySelector(".card-container");
        if (pageContent) {
            pageContent.style.width = `${wrapperWidth}mm`;
            pageContent.style.height = `${wrapperHeight}mm`;
        }
        cardContainer.style.width = `${containerWidth}mm`;
        cardContainer.style.height = `${containerHeight}mm`;
        cardContainer.style.overflow = "hidden";
        cardContainer.style.left = `${CUT_MARK_GUTTER_MM}mm`;
        cardContainer.style.top = `${CUT_MARK_GUTTER_MM}mm`;
        page.classList.toggle("page-letter", pageSize === "letter");
    }

    const pages = existingPages;

    // 4. Place cards one by one from the ordered list
    let slotIndex = 0;
    for (const item of cards) {
        let frontNode;
        let backNode = null;
        let hasRealBack = false;

        if (item instanceof SpellCard) {
            frontNode = item.frontElement;
            if (item.backElement) {
                backNode = item.backElement;
                hasRealBack = true;
            } else if (defaultCardBack) {
                backNode = createDefaultCardBackElement(cardWidth, cardHeight, item.id);
            }
        } else if (isGlossaryRef(item)) {
            const [frontCard, backCard] = await createGlossaryCard();
            frontCard.dataset.cardId = item.id;
            const cardActions = document.createElement("div");
            cardActions.className = "card-actions no-print";
            cardActions.dataset.cardId = item.id;
            const deleteBtn = document.createElement("wa-button");
            deleteBtn.setAttribute("variant", "default");
            deleteBtn.setAttribute("size", "small");
            deleteBtn.title = "Remove glossary card";
            const delIcon = document.createElement("wa-icon");
            delIcon.setAttribute("name", "trash");
            deleteBtn.appendChild(delIcon);
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                frontCard.dispatchEvent(
                    new CustomEvent("card-delete", {
                        bubbles: true,
                        detail: { cardId: item.id },
                    })
                );
            });
            cardActions.appendChild(deleteBtn);
            frontCard
                .querySelector(".spell-card-front")
                .appendChild(cardActions);
            frontNode = frontCard;
            backNode = backCard;
            hasRealBack = true;
        }

        if (useSideBySide && hasRealBack && backNode && slotIndex % cardsPerRow === cardsPerRow - 1) {
            const pageIndex = Math.floor(slotIndex / maxCardsPerPage);
            const cardContainer = pages[pageIndex].querySelector(".card-container");
            const spacer = document.createElement("div");
            spacer.className = "spell-card-spacer";
            spacer.style.width = `${cardWidth}mm`;
            spacer.style.height = `${cardHeight}mm`;
            cardContainer.appendChild(spacer);
            slotIndex++;
        }

        const pageIndex = Math.floor(slotIndex / maxCardsPerPage);
        const cardContainer = pages[pageIndex].querySelector(".card-container");
        cardContainer.appendChild(frontNode);
        slotIndex++;

        if (backNode) {
            const backPageIndex = Math.floor(slotIndex / maxCardsPerPage);
            const backContainer = pages[backPageIndex].querySelector(".card-container");
            backContainer.appendChild(backNode);
            slotIndex++;
        }
    }
}

/** Cross-hatch default back for cards that don't have their own back. */
function createDefaultCardBackElement(cardWidthMm, cardHeightMm, cardId) {
    const outer = document.createElement("div");
    outer.className = "spell-card";
    outer.style.width = `${cardWidthMm}mm`;
    outer.style.height = `${cardHeightMm}mm`;
    if (cardId) outer.dataset.cardId = cardId;
    const inner = document.createElement("div");
    inner.className = "spell-card-default-back";
    outer.appendChild(inner);
    return outer;
}

function createPage(
    pageSize,
    containerWidth,
    containerHeight,
    cardsPerRow,
    rowsPerPage
) {
    const page = document.createElement("div");
    page.className = "page";
    if (pageSize === "letter") {
        page.classList.add("page-letter");
    }

    const wrapperWidth = containerWidth + 2 * CUT_MARK_GUTTER_MM;
    const wrapperHeight = containerHeight + 2 * CUT_MARK_GUTTER_MM;

    const pageContent = document.createElement("div");
    pageContent.className = "page-content";
    pageContent.style.width = `${wrapperWidth}mm`;
    pageContent.style.height = `${wrapperHeight}mm`;

    const cutMarks = createCutMarks(
        wrapperWidth,
        wrapperHeight,
        cardsPerRow,
        rowsPerPage
    );
    pageContent.appendChild(cutMarks);

    const cardContainer = document.createElement("div");
    cardContainer.className = "card-container";
    cardContainer.style.width = `${containerWidth}mm`;
    cardContainer.style.height = `${containerHeight}mm`;
    cardContainer.style.left = `${CUT_MARK_GUTTER_MM}mm`;
    cardContainer.style.top = `${CUT_MARK_GUTTER_MM}mm`;
    pageContent.appendChild(cardContainer);

    page.appendChild(pageContent);
    return page;
}

/**
 * Ensure existing page has .page-content wrapper and cut marks (migrate old DOM).
 */
function ensurePageStructure(
    page,
    pageSize,
    containerWidth,
    containerHeight,
    cardsPerRow,
    rowsPerPage
) {
    let pageContent = page.querySelector(".page-content");
    const cardContainer = page.querySelector(".card-container");
    if (!pageContent && cardContainer) {
        pageContent = document.createElement("div");
        pageContent.className = "page-content";
        const wrapperWidth = containerWidth + 2 * CUT_MARK_GUTTER_MM;
        const wrapperHeight = containerHeight + 2 * CUT_MARK_GUTTER_MM;
        pageContent.style.width = `${wrapperWidth}mm`;
        pageContent.style.height = `${wrapperHeight}mm`;
        const cutMarks = createCutMarks(
            wrapperWidth,
            wrapperHeight,
            cardsPerRow,
            rowsPerPage
        );
        pageContent.appendChild(cutMarks);
        cardContainer.parentNode.insertBefore(pageContent, cardContainer);
        pageContent.appendChild(cardContainer);
    }
    const wrapperWidth = containerWidth + 2 * CUT_MARK_GUTTER_MM;
    const wrapperHeight = containerHeight + 2 * CUT_MARK_GUTTER_MM;
    const existingMarks = page.querySelector(".cut-marks");
    if (pageContent) {
        if (existingMarks) {
            existingMarks.replaceWith(
                createCutMarks(
                    wrapperWidth,
                    wrapperHeight,
                    cardsPerRow,
                    rowsPerPage
                )
            );
        } else {
            pageContent.insertBefore(
                createCutMarks(
                    wrapperWidth,
                    wrapperHeight,
                    cardsPerRow,
                    rowsPerPage
                ),
                cardContainer
            );
        }
    }
}

/**
 * Create the cut-marks overlay: vertical lines above/below grid, horizontal lines left/right.
 * Positions use fixed card dimensions only (63×88mm), not the layout's inter-card gaps.
 */
function createCutMarks(wrapperWidth, wrapperHeight, cardsPerRow, rowsPerPage) {
    const wrap = document.createElement("div");
    wrap.className = "cut-marks";
    wrap.setAttribute("aria-hidden", "true");

    const cardWidth = CARD_WIDTH_MM;
    const cardHeight = CARD_HEIGHT_MM;
    const gridWidth = cardsPerRow * cardWidth;
    const gridHeight = rowsPerPage * cardHeight;
    const left = CUT_MARK_GUTTER_MM;
    const top = CUT_MARK_GUTTER_MM;
    const t = CUT_MARK_THICKNESS_MM;
    const len = CUT_MARK_LENGTH_MM;

    const xAt = (i) => left + i * cardWidth;
    const yAt = (j) => top + j * cardHeight;

    // Vertical marks above the grid (pointing down from top edge)
    for (let i = 0; i <= cardsPerRow; i++) {
        const el = document.createElement("div");
        el.className = "cut-mark cut-mark--vertical";
        el.style.cssText = `left:${xAt(i)}mm;top:0;width:${t}mm;height:${len}mm;`;
        wrap.appendChild(el);
    }
    // Vertical marks below the grid
    for (let i = 0; i <= cardsPerRow; i++) {
        const el = document.createElement("div");
        el.className = "cut-mark cut-mark--vertical";
        el.style.cssText = `left:${xAt(i)}mm;top:${wrapperHeight - len}mm;width:${t}mm;height:${len}mm;`;
        wrap.appendChild(el);
    }
    // Horizontal marks to the left of the grid
    for (let j = 0; j <= rowsPerPage; j++) {
        const el = document.createElement("div");
        el.className = "cut-mark cut-mark--horizontal";
        el.style.cssText = `left:0;top:${yAt(j)}mm;width:${len}mm;height:${t}mm;`;
        wrap.appendChild(el);
    }
    // Horizontal marks to the right of the grid
    for (let j = 0; j <= rowsPerPage; j++) {
        const el = document.createElement("div");
        el.className = "cut-mark cut-mark--horizontal";
        el.style.cssText = `left:${wrapperWidth - len}mm;top:${yAt(j)}mm;width:${len}mm;height:${t}mm;`;
        wrap.appendChild(el);
    }

    return wrap;
}

function closePopoversIn(element) {
    const close = (root) => {
        if (!root) return;
        root.querySelectorAll("wa-tooltip").forEach((el) => {
            if ("open" in el) el.open = false;
        });
        root.querySelectorAll("wa-popup").forEach((el) => {
            if ("open" in el) el.open = false;
        });
        root.querySelectorAll("[popover]").forEach((el) => {
            if (typeof el.hidePopover === "function") el.hidePopover();
        });
        root.querySelectorAll("*").forEach((el) => {
            if (el.shadowRoot) close(el.shadowRoot);
        });
    };
    close(element);
}

function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}
