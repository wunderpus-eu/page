# Spell Card Generator

This is a web application for generating spell cards for Dungeons & Dragons. It allows you to enter a list of spell names and then generates a printable PDF of the spell cards.

## Features

-   Generate spell cards from a comma-separated list of spell names.
-   Choose between A4 and Letter page sizes.
-   Toggle between color and grayscale output.
-   Export to a high-quality, pixel-perfect PDF using a headless browser.

## How to Use

### Prerequisites

-   [Node.js](https://nodejs.org/) (which includes npm) must be installed on your system.

### Running the Application

0.  **Download/update the raw spell data**
    ```bash
    ./download_spell_data.sh
    ```

1.  **Clone the repository**

    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2.  **Install the dependencies**

    This will install Express, Puppeteer, and all other required packages.

    ```bash
    npm install
    ```

3.  **Start the server**

    This will start a local server on port 3000.

    ```bash
    npm start
    ```

4.  **Open the application in your browser**

    Navigate to `http://localhost:3000` in your web browser.

### Generating Cards

1.  Enter a comma-separated list of spell names into the input field.
2.  Click the "Generate Cards" button to see a preview of the cards in the browser.
3.  Click the "Export to PDF" button to download a high-quality PDF of the spell cards.

## How It Works

This application uses a hybrid approach to PDF generation:

-   **For debugging and previewing:** The "Generate Cards" button uses client-side JavaScript to render the spell cards directly in the browser. This provides an instant preview of the cards.
-   **For final printing:** The "Export to PDF" button sends the HTML and CSS of the generated cards to a Node.js backend. The backend then uses Puppeteer (a headless Chrome browser) to generate a pixel-perfect PDF, which is then sent back to the user for download. This ensures that the final PDF looks exactly like what you see in the browser.
