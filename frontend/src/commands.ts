/* ── Command Palette (Ctrl+K) + Toast notifications ──── */

import { esc } from "./utils.js";

// ── Toast system ──────────────────────────────────────
type ToastKind = "info" | "success" | "warn" | "error";

const TOAST_ICONS: Record<ToastKind, string> = {
  info: "💡", success: "✅", warn: "⚠️", error: "❌",
};

let toastContainer: HTMLElement | null = null;

function ensureToastContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function toast(message: string, kind: ToastKind = "info", duration = 4000): void {
  // Quiet UI: only surface problems. Routine actions speak for themselves.
  if (kind !== "error") return;
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

// ── Command palette ───────────────────────────────────
export interface Command {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  category?: string;
}

let cmdOverlay: HTMLElement | null = null;
let registered: Command[] = [];
let isOpen = false;

export function registerCommands(cmds: Command[]): void {
  registered = [...registered, ...cmds];
}

export function openPalette(): void {
  if (isOpen) { closePalette(); return; }
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

  const input = cmdOverlay.querySelector<HTMLInputElement>(".cmd-input")!;
  const list = cmdOverlay.querySelector<HTMLElement>(".cmd-list")!;
  let selected = 0;

  function render(filter: string): void {
    const q = filter.toLowerCase();
    const filtered = registered.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.category || "").toLowerCase().includes(q)
    );
    list.innerHTML = filtered.length
      ? filtered
          .map(
            (c, i) =>
              `<div class="cmd-item${i === selected ? " cmd-sel" : ""}" data-idx="${i}">` +
              `<span class="cmd-icon">${c.icon}</span>` +
              `<div class="cmd-text"><span class="cmd-label">${esc(c.label)}</span>` +
              (c.category ? `<span class="cmd-cat">${esc(c.category)}</span>` : "") +
              `</div>` +
              (c.shortcut ? `<kbd class="cmd-key">${esc(c.shortcut)}</kbd>` : "") +
              `</div>`
          )
          .join("")
      : '<div class="cmd-empty">No matching commands</div>';

    // Click handlers
    list.querySelectorAll<HTMLElement>(".cmd-item").forEach((el) => {
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
    if (e.key === "ArrowDown") { e.preventDefault(); selected = Math.min(selected + 1, items.length - 1); render(input.value); }
    if (e.key === "ArrowUp") { e.preventDefault(); selected = Math.max(selected - 1, 0); render(input.value); }
    if (e.key === "Enter") {
      e.preventDefault();
      const sel = items[selected] as HTMLElement;
      sel?.click();
    }
    if (e.key === "Escape") closePalette();
  });

  cmdOverlay.addEventListener("click", (e) => {
    if (e.target === cmdOverlay) closePalette();
  });

  setTimeout(() => input.focus(), 50);
}

export function closePalette(): void {
  isOpen = false;
  cmdOverlay?.remove();
  cmdOverlay = null;
}

export function initCommandPalette(): void {
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      openPalette();
    }
  });
}
