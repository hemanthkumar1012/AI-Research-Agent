/* ── Utility functions ────────────────────────────────── */
/** Escape HTML entities */
export function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}
/** Format a float as a percentage string */
export function pct(x) {
    return Math.round((x || 0) * 100) + "%";
}
/** Shorthand for getElementById */
export function $(id) {
    return document.getElementById(id);
}
/** Type-safe query selector */
export function $q(sel, root = document) {
    return root.querySelector(sel);
}
/** Format number with locale separators */
export function fmt(n) {
    return n.toLocaleString();
}
/** Generate a unique ID */
export function uid() {
    return Math.random().toString(36).slice(2, 10);
}
/** Debounce a function */
export function debounce(fn, ms) {
    let timer;
    return ((...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    });
}
/** Clamp a number between min and max */
export function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
}
/** Format a date string relative to now */
export function timeAgo(date) {
    const d = new Date(date);
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)
        return "just now";
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)
        return `${days}d ago`;
    return d.toLocaleDateString();
}
//# sourceMappingURL=utils.js.map