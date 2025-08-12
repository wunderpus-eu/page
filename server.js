const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs").promises;

const app = express();
const port = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

app.post("/export-pdf", async (req, res) => {
    let tempHtmlPath;
    try {
        const { html, css, pageSize } = req.body;
        const printCss = await fs.readFile(
            path.join(__dirname, "print.css"),
            "utf8"
        );

        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();

        const pageDimensions = {
            a4: { width: "297mm", height: "210mm" },
            letter: { width: "11in", height: "8.5in" },
        };

        const dimensions = pageDimensions[pageSize] || pageDimensions.letter;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <link
                        href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;900&display=swap"
                        rel="stylesheet"
                    />
                    <style>
                        ${css}
                        ${printCss}
                    </style>
                </head>
                <body>${html}</body>
            </html>`;

        tempHtmlPath = path.join(__dirname, "temp-spell-page.html");
        await fs.writeFile(tempHtmlPath, htmlContent);

        await page.goto(`file://${tempHtmlPath}`, {
            waitUntil: "networkidle0",
        });

        // Wait for all fonts to be loaded
        await page.evaluateHandle("document.fonts.ready");

        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 2,
        });

        await page.pdf({
            path: "spell-cards-generated.pdf",
            width: dimensions.width,
            height: dimensions.height,
            printBackground: true,
            margin: {
                top: "0mm",
                right: "0mm",
                bottom: "0mm",
                left: "0mm",
            },
        });

        await browser.close();

        res.json({ success: true, message: "PDF generated successfully." });
    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({
            success: false,
            message: "Error generating PDF",
            error: error.message,
        });
    } finally {
        if (tempHtmlPath) {
            try {
                await fs.unlink(tempHtmlPath);
            } catch (cleanupError) {
                console.error("Error cleaning up temp file:", cleanupError);
            }
        }
    }
});

app.get("/get-pdf", (req, res) => {
    const filePath = path.join(__dirname, "spell-cards-generated.pdf");
    res.sendFile(filePath);
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
