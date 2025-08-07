document.addEventListener("DOMContentLoaded", () => {
    const generatePdfButton = document.getElementById("generate-pdf");
    const printableArea = document.getElementById("printable-area");
    const spellNamesInput = document.getElementById("spell-names-input");
    const pageSizeToggle = document.getElementById("page-size-toggle");

    let spells = [];

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

    // Function to create a spell card
    function make_spell_card(spell) {
        const card = document.createElement("div");
        card.className = "spell-card";

        const front = document.createElement("div");
        front.className = "spell-card-front";
        front.innerHTML = `<h3>${spell.name}</h3>`;
        card.appendChild(front);

        // For now, we are not creating a back for the card.
        // This can be added later.

        return card;
    }

    // Main function to generate cards
    function generateSpellCards(spellNames, pageSize) {
        printableArea.innerHTML = "";

        let currentPage = createPage(pageSize);
        printableArea.appendChild(currentPage);

        const cardWidth = 63 + 2; // card width + margin in mm
        const cardHeight = 88 + 2; // card height + margin in mm

        const pageDimensions = {
            a4: { width: 210, height: 297 },
            letter: { width: 215.9, height: 279.4 }, // 8.5in x 11in in mm
        };

        const { width: pageWidth, height: pageHeight } =
            pageDimensions[pageSize];

        const cardsPerRow = Math.floor(pageWidth / cardWidth);
        const rowsPerPage = Math.floor(pageHeight / cardHeight);
        const maxCardsPerPage = cardsPerRow * rowsPerPage;
        let cardCount = 0;

        const spellsToRender = spellNames
            .map((name) => spells.find((s) => s.name === name))
            .filter(Boolean);

        spellsToRender.forEach((spell) => {
            if (cardCount >= maxCardsPerPage) {
                currentPage = createPage(pageSize);
                printableArea.appendChild(currentPage);
                cardCount = 0;
            }
            const spellCard = make_spell_card(spell);
            currentPage.appendChild(spellCard);
            cardCount++;
        });
    }

    function createPage(pageSize) {
        const page = document.createElement("div");
        page.className = "page";
        if (pageSize === "letter") {
            page.classList.add("page-letter");
        }
        return page;
    }

    // Toggle between A4 and Letter page sizes
    pageSizeToggle.addEventListener("click", () => {
        const currentSize = pageSizeToggle.dataset.size || "letter";
        const newSize = currentSize === "letter" ? "a4" : "letter";
        pageSizeToggle.dataset.size = newSize;
        pageSizeToggle.textContent =
            newSize.charAt(0).toUpperCase() + newSize.slice(1);
    });

    // Generate spell cards when the button is clicked
    generatePdfButton.addEventListener("click", () => {
        const spellNamesText = spellNamesInput.value;
        if (!spellNamesText) {
            alert("Please enter at least one spell name.");
            return;
        }
        const spellNames = spellNamesText
            .split(";")
            .map((name) => name.trim())
            .filter(Boolean);

        const pageSize = pageSizeToggle.dataset.size || "letter";

        generateSpellCards(spellNames, pageSize);

        const element = document.getElementById("printable-area");
        const opt = {
            margin: 0,
            filename: "spell-cards.pdf",
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: "mm", format: pageSize, orientation: "portrait" },
        };

        // New Promise-based usage:
        // TODO: Enable again when I say so.
        // html2pdf().set(opt).from(element).save();
    });

    // Load spells when the page loads
    loadSpells();
});
