/* ── Focus Mode (Distraction-Free Reading) ─────────────── */
/* Hides chrome, centers report, adds reading progress bar  */

import { $ } from "./utils.js";

let active = false;
let overlay: HTMLDivElement | null = null;

export function toggleFocus(): boolean {
  active = !active;
  if (active) enterFocus();
  else exitFocus();
  return active;
}

export function isFocusActive(): boolean { return active; }

function enterFocus(): void {
  overlay = document.createElement("div");
  overlay.className = "focus-overlay";

  // Close button
  const close = document.createElement("button");
  close.className = "focus-close";
  close.innerHTML = "✕ Exit Focus";
  close.addEventListener("click", () => toggleFocus());
  overlay.appendChild(close);

  // Reading progress
  const progress = document.createElement("div");
  progress.className = "focus-progress";
  const bar = document.createElement("div");
  bar.className = "focus-progress-bar";
  progress.appendChild(bar);
  overlay.appendChild(progress);

  // Content wrapper
  const wrap = document.createElement("div");
  wrap.className = "focus-content";

  // Clone report
  const report = $("report");
  wrap.innerHTML = report.innerHTML;
  overlay.appendChild(wrap);

  // Scroll tracking
  wrap.addEventListener("scroll", () => {
    const pct = wrap.scrollTop / (wrap.scrollHeight - wrap.clientHeight);
    bar.style.width = `${Math.min(100, pct * 100)}%`;
  });

  // Keyboard: Escape to close
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { toggleFocus(); document.removeEventListener("keydown", onKey); }
  };
  document.addEventListener("keydown", onKey);

  document.body.appendChild(overlay);
  document.body.classList.add("focus-active");

  // Animate in
  requestAnimationFrame(() => overlay?.classList.add("focus-visible"));
}

function exitFocus(): void {
  if (overlay) {
    overlay.classList.remove("focus-visible");
    setTimeout(() => {
      overlay?.remove();
      overlay = null;
    }, 300);
  }
  document.body.classList.remove("focus-active");
}
