/**
 * battle-master-docs.js – Load docs body and wire install-link copy button.
 */
(function () {
    var INSTALL_URL = "https://wunderpus.eu/battle-master/manifest.json";
    var COPY_LABEL =
        '<wa-icon slot="start" name="link"></wa-icon> Copy Install Link';
    var COPIED_LABEL =
        '<wa-icon slot="start" name="check"></wa-icon> Copied!';

    var root = document.getElementById("bm-docs-root");
    if (!root) return;

    function setupCopyButton() {
        var btn = root.querySelector("#bm-copy-install");
        if (!btn) return;

        btn.addEventListener("click", function () {
            if (!navigator.clipboard) return;

            navigator.clipboard.writeText(INSTALL_URL).then(
                function () {
                    btn.innerHTML = COPIED_LABEL;
                    window.setTimeout(function () {
                        btn.innerHTML = COPY_LABEL;
                    }, 2000);
                },
                function () {}
            );
        });
    }

    fetch("battle-master/docs/page-content.html")
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Failed to load docs content");
            }
            return response.text();
        })
        .then(function (html) {
            root.innerHTML = html;
            setupCopyButton();
        })
        .catch(function () {
            root.innerHTML =
                '<p class="bm-docs-error">Could not load Battle Master documentation. Please try again later.</p>';
        });
})();
