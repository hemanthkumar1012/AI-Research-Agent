/* ── Focus Mode (Distraction-Free Reading) ─────────────── */
/* Hides chrome, centers report, adds reading progress bar  */

import { $ } from "./utils.js";

let focusActive = false;
let focusOverlay: HTMLDivElement | null = null;

export function toggleFocus(): boolean {
  focusActive = !focusActive;
  if (focusActive) enterFocus();
  else exitFocus();
  return focusActive;
}

export function isFocusActive(): boolean { return focusActive; }

function enterFocus(): void {
  focusOverlay = document.createElement("div");
  focusOverlay.className = "focus-overlay";

  // Close button
  const close = document.createElement("button");
  close.className = "focus-close";
  close.innerHTML = "✕ Exit Focus";
  close.addEventListener("click", () => toggleFocus());
  focusOverlay.appendChild(close);

  // Reading progress
  const progress = document.createElement("div");
  progress.className = "focus-progress";
  const bar = document.createElement("div");
  bar.className = "focus-progress-bar";
  progress.appendChild(bar);
  focusOverlay.appendChild(progress);

  // Content wrapper
  const wrap = document.createElement("div");
  wrap.className = "focus-content";

  // Clone report
  const report = $("report");
  wrap.innerHTML = report.innerHTML;
  focusOverlay.appendChild(wrap);

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

  document.body.appendChild(focusOverlay);
  document.body.classList.add("focus-active");

  // Animate in
  requestAnimationFrame(() => focusOverlay?.classList.add("focus-visible"));
}

function exitFocus(): void {
  if (focusOverlay) {
    focusOverlay.classList.remove("focus-visible");
    setTimeout(() => {
      focusOverlay?.remove();
      focusOverlay = null;
    }, 300);
  }
  document.body.classList.remove("focus-active");
}
