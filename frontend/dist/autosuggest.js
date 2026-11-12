/* ── Auto-Suggest for Search Input ──────────────────────── */
/* Shows suggestion dropdown based on history + templates   */
import { $, esc, debounce } from "./utils.js";
const TEMPLATES = [
    "What are the latest developments in {topic}?",
    "Compare {A} vs {B}: comprehensive analysis",
    "Explain how {topic} works with real-world examples",
    "What are the pros and cons of {topic}?",
    "Current state of {field} research in 2025",
    "Historical timeline of {topic}",
    "Best practices for {topic}",
    "Impact of {topic} on {industry}",
];
let dropdown = null;
let selectedIdx = -1;
export function initAutoSuggest() {
    const input = $("q");
    if (!input)
        return;
    // Create dropdown
    dropdown = document.createElement("div");
    dropdown.className = "suggest-dropdown hidden";
    input.parentElement?.appendChild(dropdown);
    const update = debounce(() => showSuggestions(input.value.trim()), 200);
    input.addEventListener("input", update);
    input.addEventListener("focus", () => {
        if (input.value.trim())
            update();
    });
    // Close on outside click
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-input-wrap")) {
            hideSuggestions();
        }
    });
    // Keyboard nav
    input.addEventListener("keydown", (e) => {
        if (!dropdown || dropdown.classList.contains("hidden"))
            return;
        const items = dropdown.querySelectorAll(".suggest-item");
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
            highlightItem(items);
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIdx = Math.max(selectedIdx - 1, -1);
            highlightItem(items);
        }
        else if (e.key === "Enter" && selectedIdx >= 0) {
            e.preventDefault();
            const sel = items[selectedIdx];
            if (sel) {
                input.value = sel.dataset.value || "";
                hideSuggestions();
            }
        }
        else if (e.key === "Escape") {
            hideSuggestions();
        }
    });
}
function showSuggestions(query) {
    if (!dropdown)
        return;
    selectedIdx = -1;
    const suggestions = [];
    // History-based suggestions
    const histItems = document.querySelectorAll(".hist");
    histItems.forEach((h) => {
        const title = h.querySelector(".hist-title")?.textContent || "";
        if (title.toLowerCase().includes(query.toLowerCase())) {
            suggestions.push({ text: title, kind: "history" });
        }
    });
    // Template suggestions
    if (query.length >= 2) {
        for (const tmpl of TEMPLATES) {
            const filled = tmpl.replace(/\{[^}]+\}/g, query);
            if (!suggestions.some((s) => s.text === filled)) {
                suggestions.push({ text: filled, kind: "template" });
            }
        }
    }
    if (!suggestions.length || !query) {
        hideSuggestions();
        return;
    }
    const shown = suggestions.slice(0, 6);
    dropdown.innerHTML = shown
        .map((s, i) => `<div class="suggest-item" data-value="${esc(s.text)}">
          <span class="suggest-icon">${s.kind === "history" ? "🕐" : "💡"}</span>
          <span class="suggest-text">${highlightMatch(s.text, query)}</span>
          <span class="suggest-kind">${s.kind}</span>
        </div>`)
        .join("");
    dropdown.classList.remove("hidden");
    // Click to select
    dropdown.querySelectorAll(".suggest-item").forEach((item) => {
        item.addEventListener("click", () => {
            $("q").value = item.dataset.value || "";
            hideSuggestions();
            $("q").focus();
        });
    });
}
function hideSuggestions() {
    dropdown?.classList.add("hidden");
    selectedIdx = -1;
}
function highlightItem(items) {
    items.forEach((it, i) => it.classList.toggle("suggest-sel", i === selectedIdx));
}
function highlightMatch(text, query) {
    if (!query)
        return esc(text);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0)
        return esc(text);
    return (esc(text.slice(0, idx)) +
        `<mark>${esc(text.slice(idx, idx + query.length))}</mark>` +
        esc(text.slice(idx + query.length)));
}
//# sourceMappingURL=autosuggest.js.map