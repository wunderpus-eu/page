const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const { spawn } = require("child_process");

const app = express();
const port = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

app.post("/export-pdf", async (req, res) => {
    try {
        const { html, css, pageSize } = req.body;
        const printCss = await fs.readFile(
            path.join(__dirname, "print.css"),
            "utf8"
        );

        const pageStyle = `
            @page {
                size: ${pageSize} landscape;
                margin: 0;
            }
        `;

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
                        ${pageStyle}
                        ${css}
                        ${printCss}
                    </style>
                </head>
                <body>${html}</body>
            </html>`;

        const weasyprint = spawn("weasyprint", [
            "-",
            "spell-cards-generated.pdf",
            "-e",
            "utf8",
        ]);

        weasyprint.stdin.write(htmlContent);
        weasyprint.stdin.end();

        weasyprint.stderr.on("data", (data) => {
            console.error(`WeasyPrint stderr: ${data}`);
        });

        weasyprint.on("close", (code) => {
            if (code === 0) {
                res.json({
                    success: true,
                    message: "PDF generated successfully.",
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: `WeasyPrint process exited with code ${code}`,
                });
            }
        });
    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({
            success: false,
            message: "Error generating PDF",
            error: error.message,
        });
    }
});

app.get("/get-pdf", (req, res) => {
    const filePath = path.join(__dirname, "spell-cards-generated.pdf");
    res.sendFile(filePath);
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
