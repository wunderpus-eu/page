/**
 * nav.js – Site nav: active link, mobile menu (hamburger).
 */
(function () {
    var nav = document.querySelector(".header-nav");
    if (!nav) return;

    // Mark the link for the current page as active
    var path = window.location.pathname;
    var file = path.slice(path.lastIndexOf("/") + 1) || "index.html";
    var activeLink = nav.querySelector('a[href="' + file + '"]');
    if (activeLink) activeLink.classList.add("active");

    // Mobile menu: hamburger / close icon toggle
    var toggle = document.querySelector(".header-nav-toggle");
    var menu = document.getElementById("header-nav-menu");
    var icon = toggle && toggle.querySelector(".header-nav-toggle-icon");
    if (!toggle || !menu) return;

    function setMenuClosed() {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        nav.classList.remove("is-open");
        if (icon) {
            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");
        }
    }

    function setMenuOpen() {
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close menu");
        nav.classList.add("is-open");
        if (icon) {
            icon.classList.remove("fa-bars");
            icon.classList.add("fa-xmark");
        }
    }

    toggle.addEventListener("click", function () {
        var expanded = toggle.getAttribute("aria-expanded") === "true";
        if (expanded) {
            setMenuClosed();
        } else {
            setMenuOpen();
        }
    });

    menu.addEventListener("click", function (e) {
        if (e.target.tagName === "A") setMenuClosed();
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && nav.classList.contains("is-open")) {
            setMenuClosed();
            toggle.focus();
        }
    });

    document.addEventListener("click", function (e) {
        if (nav.classList.contains("is-open") && !nav.contains(e.target)) {
            setMenuClosed();
        }
    });
})();
