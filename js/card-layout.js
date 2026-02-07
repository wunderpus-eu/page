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

    const containerWidth = cardsPerRow * (cardWidth + 1) - 1;
    const containerHeight = rowsPerPage * (cardHeight + 1) - 1;

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
        const newPage = createPage(pageSize, containerWidth, containerHeight);
        printableArea.appendChild(newPage);
        existingPages.push(newPage);
    }

    for (const page of existingPages) {
        const cardContainer = page.querySelector(".card-container");
        cardContainer.style.width = `${containerWidth}mm`;
        cardContainer.style.height = `${containerHeight}mm`;
        cardContainer.style.overflow = "hidden";
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
