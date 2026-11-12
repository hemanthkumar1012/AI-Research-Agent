/* ── Accessibility Enhancements ─────────────────────────── */
/* ARIA labels, focus traps, reduced motion, screen reader  */
export function initAccessibility() {
    addAriaLabels();
    addSkipLink();
    setupReducedMotion();
    addLiveRegion();
    setupFocusVisible();
}
function addAriaLabels() {
    const pairs = [
        ["q", "role", "searchbox"],
        ["q", "aria-label", "Research question input"],
        ["f", "role", "search"],
        ["history", "role", "navigation"],
        ["history", "aria-label", "Research history"],
        ["report", "role", "article"],
        ["report", "aria-label", "Research report"],
        ["log", "role", "log"],
        ["log", "aria-label", "Research trace log"],
        ["chat", "role", "log"],
        ["chat", "aria-label", "Follow-up conversation"],
    ];
    for (const [id, attr, val] of pairs) {
        const el = document.getElementById(id);
        if (el)
            el.setAttribute(attr, val);
    }
    // Tab buttons
    document.querySelectorAll(".tab").forEach((t) => {
        t.setAttribute("role", "tab");
        t.setAttribute("aria-selected", t.classList.contains("on") ? "true" : "false");
    });
    document.querySelector(".tabs")?.setAttribute("role", "tablist");
}
function addSkipLink() {
    const link = document.createElement("a");
    link.href = "#q";
    link.className = "skip-link";
    link.textContent = "Skip to search";
    document.body.insertBefore(link, document.body.firstChild);
}
function setupReducedMotion() {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = (matches) => {
        document.body.classList.toggle("reduced-motion", matches);
    };
    apply(mq.matches);
    mq.addEventListener("change", (e) => apply(e.matches));
}
function addLiveRegion() {
    // Screen reader announcements for dynamic content
    const region = document.createElement("div");
    region.id = "sr-announce";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    document.body.appendChild(region);
}
export function announce(message) {
    const region = document.getElementById("sr-announce");
    if (region) {
        region.textContent = "";
        requestAnimationFrame(() => { region.textContent = message; });
    }
}
function setupFocusVisible() {
    // Show focus rings only for keyboard navigation
    let usingKeyboard = false;
    document.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            usingKeyboard = true;
            document.body.classList.add("keyboard-nav");
        }
    });
    document.addEventListener("mousedown", () => {
        usingKeyboard = false;
        document.body.classList.remove("keyboard-nav");
    });
}
//# sourceMappingURL=accessibility.js.map