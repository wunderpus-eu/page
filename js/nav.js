/**
 * nav.js – Site nav: link config, rendering, active state, mobile menu.
 */
(function () {
    var NAV_LINKS = [
        { href: "character-sheet.html", label: "Character sheet" },
        { href: "spell-cards.html", label: "Spell cards" },
        { href: "battle-master.html", label: "Battle Master" },
        {
            href: "https://ko-fi.com/wunderpus",
            label: "Support me",
            external: true,
        },
    ];

    function createNavButton(link) {
        var btn = document.createElement("wa-button");
        btn.className = "on-hero";
        btn.setAttribute("appearance", "plain");
        btn.setAttribute("variant", "neutral");
        btn.setAttribute("size", "small");
        btn.setAttribute("href", link.href);
        btn.textContent = link.label;
        if (link.external) {
            btn.setAttribute("target", "_blank");
            btn.setAttribute("rel", "noopener noreferrer");
        }
        return btn;
    }

    var nav = document.querySelector(".header-nav");
    if (!nav) return;

    nav.querySelectorAll("[data-nav-menu]").forEach(function (menu) {
        NAV_LINKS.forEach(function (link) {
            menu.appendChild(createNavButton(link));
        });
    });

    var path = window.location.pathname;
    var file = path.slice(path.lastIndexOf("/") + 1) || "index.html";
    var activeLinks = nav.querySelectorAll('wa-button[href="' + file + '"]');
    activeLinks.forEach(function (el) {
        el.classList.add("active");
        el.setAttribute("variant", "brand");
    });

    var toggle = document.getElementById("header-nav-toggle");
    var popover = nav.querySelector(".header-nav-popover");
    var icon = toggle && toggle.querySelector(".header-nav-toggle-icon");
    if (!toggle || !popover || !icon) return;

    popover.addEventListener("wa-after-show", function () {
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close menu");
        icon.setAttribute("name", "xmark");
    });

    popover.addEventListener("wa-after-hide", function () {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        icon.setAttribute("name", "bars");
    });
})();
