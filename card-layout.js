/**
 * card-layout.js – Page layout for printable spell cards.
 *
 * Places card fronts (and backs) into pages with correct dimensions.
 * When sideBySide: adds spacers so front+back stay together (no dangling backs).
 * When defaultCardBack: cards without a back get a cross-hatch default back.
 */
import {
    SpellCard,
    emptySpellTemplate,
    getSpells,
    isGlossaryRef,
    createGlossaryCard,
    getSpellSchoolColor,
} from "./spell-card.js";

/**
 * Renders cards into printable pages inside printableArea.
 * Measures cards, builds front+back sequence, applies spacer logic when sideBySide,
 * and fills pages with card containers.
 *
 * @param {(import("./spell-card.js").SpellCard | { type: "glossary"; id: string })[]} cards
 * @param {"a4" | "letter"} pageSize
 * @param {HTMLElement} printableArea - Container to append pages to (cleared first)
 * @param {{ defaultCardBack?: boolean; sideBySide?: boolean }} [options]
 *   - defaultCardBack: add cross-hatch back for cards without one
 *   - sideBySide: add spacers so front+back stay on same row (ignored if defaultCardBack)
 */
export async function layoutCards(
    cards,
    pageSize,
    printableArea,
    options = {}
) {
    const { defaultCardBack = false, sideBySide = false } = options;

    printableArea.innerHTML = "";

    if (cards.length === 0) {
        return;
    }

    const firstSpellCard = cards.find((c) => c instanceof SpellCard);
    let measureCard = firstSpellCard || null;
    const allSpells = getSpells();
    if (!measureCard && allSpells.length > 0) {
        measureCard = new SpellCard(allSpells[0]);
        await measureCard.render();
    }
    if (!measureCard) {
        measureCard = new SpellCard(emptySpellTemplate());
        await measureCard.render();
    }
    printableArea.appendChild(measureCard.frontElement);
    const pxPerMm = getPxPerMm();
    const cardWidth = measureCard.frontElement.offsetWidth / pxPerMm;
    const cardHeight = measureCard.frontElement.offsetHeight / pxPerMm;
    printableArea.removeChild(measureCard.frontElement);
    if (!firstSpellCard) {
        measureCard = null;
    }

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

    // Off-screen container for measuring overflow (handleOverflow needs DOM in tree)
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    tempContainer.style.top = "-9999px";
    printableArea.appendChild(tempContainer);

    const allRenderedCards = [];
    for (const item of cards) {
        if (item instanceof SpellCard) {
            const spellCard = item;
            tempContainer.appendChild(spellCard.frontElement);
            await handleOverflow(spellCard, tempContainer); // May add backElement for overflow text
            tempContainer.removeChild(spellCard.frontElement);

            if (spellCard.backElement) {
                tempContainer.appendChild(spellCard.backElement);
            }

            allRenderedCards.push(spellCard.frontElement);
            if (spellCard.backElement) {
                allRenderedCards.push(spellCard.backElement);
            } else if (defaultCardBack) {
                allRenderedCards.push(
                    createDefaultCardBackElement(cardWidth, cardHeight)
                );
            }
        } else if (isGlossaryRef(item)) {
            const [frontCard, backCard] = await createGlossaryCard();
            frontCard.dataset.cardId = item.id;
            const cardActions = document.createElement("div");
            cardActions.className = "card-actions no-print";
            cardActions.dataset.cardId = item.id;
            const deleteBtn = document.createElement("sl-icon-button");
            deleteBtn.name = "trash";
            deleteBtn.title = "Remove glossary card";
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
            allRenderedCards.push(frontCard);
            allRenderedCards.push(backCard);
        }
    }

    printableArea.removeChild(tempContainer);

    printableArea.innerHTML = "";
    let currentPage = createPage(pageSize, containerWidth, containerHeight);
    printableArea.appendChild(currentPage);
    let cardCount = 0;

    const finalLayout = allRenderedCards;

    // Side-by-side spacer: when a card has a back and its front would be last in row,
    // add one spacer so front+back move to next row together (no dangling back).
    // Skipped when defaultCardBack (every card has back, no special spacing needed).
    let sequence = finalLayout;
    if (sideBySide && !defaultCardBack && finalLayout.length > 0) {
        let layoutIndex = 0;
        let finalLayoutIdx = 0;
        sequence = [];
        for (const item of cards) {
            const hasBack =
                (item instanceof SpellCard &&
                    (item.backElement || defaultCardBack)) ||
                isGlossaryRef(item);
            const frontWouldBeLastInRow =
                layoutIndex % cardsPerRow === cardsPerRow - 1;
            if (hasBack && frontWouldBeLastInRow) {
                const spacer = document.createElement("div");
                spacer.className = "spell-card-spacer";
                spacer.style.width = `${cardWidth}mm`;
                spacer.style.height = `${cardHeight}mm`;
                spacer.style.flexShrink = "0";
                sequence.push(spacer);
                layoutIndex++;
            }
            sequence.push(finalLayout[finalLayoutIdx++]);
            if (hasBack) sequence.push(finalLayout[finalLayoutIdx++]);
            layoutIndex += hasBack ? 2 : 1;
        }
    }

    let cardContainer = currentPage.querySelector(".card-container");

    for (const card of sequence) {
        if (cardCount >= maxCardsPerPage) {
            currentPage = createPage(pageSize, containerWidth, containerHeight);
            printableArea.appendChild(currentPage);
            cardCount = 0;
            cardContainer = currentPage.querySelector(".card-container");
        }
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

/** Cross-hatch default back for cards that don't have their own back. */
function createDefaultCardBackElement(cardWidthMm, cardHeightMm) {
    const outer = document.createElement("div");
    outer.className = "spell-card";
    outer.style.width = `${cardWidthMm}mm`;
    outer.style.height = `${cardHeightMm}mm`;
    const inner = document.createElement("div");
    inner.className = "spell-card-default-back";
    outer.appendChild(inner);
    return outer;
}

/** Creates a page div with card-container for the given dimensions. */
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

/** Returns the browser's px-per-mm for layout calculations. */
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

/**
 * If the description overflows, creates a back card and moves content there.
 * Tries shrinking font first; if still overflow, splits content front→back.
 * May recurse with smaller font if back also overflows.
 * @param {import("./spell-card.js").SpellCard} spellCard
 * @param {HTMLElement} tempContainer - Off-screen parent for measuring
 * @param {number} [fontLevel] - 0=normal, 1=6pt, 2=5.5pt
 */
async function handleOverflow(spellCard, tempContainer, fontLevel = 0) {
    const card = spellCard.frontElement;
    const spell = spellCard.spell;
    const cardBody = card.querySelector(".card-body");
    const descriptionText = card.querySelector(".description-text");

    if (!cardBody || !descriptionText) {
        return null;
    }

    const componentText = card.querySelector(".spell-component-text");

    function isOverflowing(element) {
        return element.scrollHeight > element.clientHeight;
    }

    if (isOverflowing(descriptionText)) {
        if (fontLevel === 0) {
            cardBody.style.fontSize = "6pt";
            cardBody.style.lineHeight = "6pt";
            componentText.style.fontSize = "6pt";
            componentText.style.lineHeight = "6pt";

            if (isOverflowing(descriptionText)) {
                cardBody.style.fontSize = "";
                cardBody.style.lineHeight = "";
                componentText.style.fontSize = "";
                componentText.style.lineHeight = "";
            } else {
                return null;
            }
        }

        const backCardContainer = document.createElement("div");
        backCardContainer.className = "spell-card";
        backCardContainer.dataset.cardId = spellCard.id;
        backCardContainer.dataset.spellName = spell.name;
        backCardContainer.style.backgroundColor = spellCard.backgroundColor;

        const back = document.createElement("div");
        back.className = "spell-card-back";

        const backCardBody = document.createElement("div");
        backCardBody.className = "card-body back";
        backCardBody.style.borderColor = getSpellSchoolColor(spell);
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
            isOverflowing(descriptionText) &&
            descriptionElements.length > 0
        ) {
            const elementToMove = descriptionElements.pop();
            backDescriptionText.prepend(elementToMove);
        }

        if (isOverflowing(backCardBody) && fontLevel < 2) {
            const backElements = Array.from(backDescriptionText.children);
            for (const elementToMove of backElements) {
                descriptionText.appendChild(elementToMove);
            }

            if (tempContainer) {
                tempContainer.removeChild(backCardContainer);
            }

            return await handleOverflow(
                spellCard,
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

        spellCard.backElement = backCardContainer;
        return;
    }

    return null;
}
