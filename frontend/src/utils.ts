/* ── Utility functions ────────────────────────────────── */

/** Escape HTML entities */
export function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c)
  );
}

/** Format a float as a percentage string */
export function pct(x: number | undefined | null): string {
  return Math.round((x || 0) * 100) + "%";
}

/** Shorthand for getElementById */
export function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

/** Type-safe query selector */
export function $q<T extends HTMLElement>(sel: string, root: ParentNode = document): T {
  return root.querySelector<T>(sel)!;
}

/** Format number with locale separators */
export function fmt(n: number): string {
  return n.toLocaleString();
}

/** Generate a unique ID */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/** Clamp a number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Format a date string relative to now */
export function timeAgo(date: string): string {
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}
