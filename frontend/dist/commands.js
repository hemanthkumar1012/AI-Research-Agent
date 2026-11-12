/* ── Command Palette (Ctrl+K) + Toast notifications ──── */
import { esc } from "./utils.js";
const TOAST_ICONS = {
    info: "💡", success: "✅", warn: "⚠️", error: "❌",
};
let toastContainer = null;
function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.className = "toast-container";
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}
export function toast(message, kind = "info", duration = 4000) {
    const c = ensureToastContainer();
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[kind]}</span><span>${esc(message)}</span>`;
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.add("toast-in"));
    setTimeout(() => {
        el.classList.add("toast-out");
        el.addEventListener("animationend", () => el.remove());
    }, duration);
}
let cmdOverlay = null;
let registered = [];
let isOpen = false;
export function registerCommands(cmds) {
    registered = [...registered, ...cmds];
}
export function openPalette() {
    if (isOpen) {
        closePalette();
        return;
    }
    isOpen = true;
    cmdOverlay = document.createElement("div");
    cmdOverlay.className = "cmd-overlay";
    cmdOverlay.innerHTML = `
    <div class="cmd-palette">
      <div class="cmd-header">
        <input class="cmd-input" type="text" placeholder="Type a command…" autofocus>
        <kbd class="cmd-esc">ESC</kbd>
      </div>
      <div class="cmd-list"></div>
    </div>
  `;
    document.body.appendChild(cmdOverlay);
    const input = cmdOverlay.querySelector(".cmd-input");
    const list = cmdOverlay.querySelector(".cmd-list");
    let selected = 0;
    function render(filter) {
        const q = filter.toLowerCase();
        const filtered = registered.filter((c) => c.label.toLowerCase().includes(q) ||
            (c.category || "").toLowerCase().includes(q));
        list.innerHTML = filtered.length
            ? filtered
                .map((c, i) => `<div class="cmd-item${i === selected ? " cmd-sel" : ""}" data-idx="${i}">` +
                `<span class="cmd-icon">${c.icon}</span>` +
                `<div class="cmd-text"><span class="cmd-label">${esc(c.label)}</span>` +
                (c.category ? `<span class="cmd-cat">${esc(c.category)}</span>` : "") +
                `</div>` +
                (c.shortcut ? `<kbd class="cmd-key">${esc(c.shortcut)}</kbd>` : "") +
                `</div>`)
                .join("")
            : '<div class="cmd-empty">No matching commands</div>';
        // Click handlers
        list.querySelectorAll(".cmd-item").forEach((el) => {
            el.addEventListener("click", () => {
                const idx = parseInt(el.dataset.idx || "0");
                filtered[idx]?.action();
                closePalette();
            });
        });
    }
    render("");
    input.addEventListener("input", () => {
        selected = 0;
        render(input.value);
    });
    input.addEventListener("keydown", (e) => {
        const items = list.querySelectorAll(".cmd-item");
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selected = Math.min(selected + 1, items.length - 1);
            render(input.value);
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            selected = Math.max(selected - 1, 0);
            render(input.value);
        }
        if (e.key === "Enter") {
            e.preventDefault();
            const sel = items[selected];
            sel?.click();
        }
        if (e.key === "Escape")
            closePalette();
    });
    cmdOverlay.addEventListener("click", (e) => {
        if (e.target === cmdOverlay)
            closePalette();
    });
    setTimeout(() => input.focus(), 50);
}
export function closePalette() {
    isOpen = false;
    cmdOverlay?.remove();
    cmdOverlay = null;
}
export function initCommandPalette() {
    document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault();
            openPalette();
        }
    });
}
//# sourceMappingURL=commands.js.map