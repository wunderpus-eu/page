/**
 * nav.js – Site nav: active link, mobile menu (wa-popover).
 */
(function () {
    var nav = document.querySelector(".header-nav");
    if (!nav) return;

    // Mark the nav button(s) for the current page as active (inline menu + popover menu)
    var path = window.location.pathname;
    var file = path.slice(path.lastIndexOf("/") + 1) || "index.html";
    var activeLinks = nav.querySelectorAll('wa-button[href="' + file + '"]');
    activeLinks.forEach(function (el) {
        el.classList.add("active");
    });

    // Mobile: sync toggle icon and aria with popover open state
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
