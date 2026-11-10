/* ── Reading Progress & Estimated Time ─────────────────── */
/* Floating progress indicator with reading time estimate     */

import { $ } from "./utils.js";

let progressEl: HTMLDivElement | null = null;
let timerEl: HTMLSpanElement | null = null;
let percentEl: HTMLSpanElement | null = null;
let barEl: HTMLDivElement | null = null;
let active = false;
let totalWords = 0;

const WPM = 230;

export function initReadingProgress(): void {
  // Create floating indicator
  progressEl = document.createElement("div");
  progressEl.className = "reading-progress-float hidden";
  progressEl.innerHTML = `
    <div class="rpf-bar-wrap"><div class="rpf-bar"></div></div>
    <span class="rpf-percent">0%</span>
    <span class="rpf-divider">·</span>
    <span class="rpf-time">0 min left</span>
  `;
  document.body.appendChild(progressEl);

  barEl = progressEl.querySelector(".rpf-bar");
  percentEl = progressEl.querySelector(".rpf-percent");
  timerEl = progressEl.querySelector(".rpf-time");

  // Listen to scroll
  const main = document.querySelector(".main");
  if (main) {
    main.addEventListener("scroll", () => updateProgress(main as HTMLElement));
  }
}

export function setReadingContent(wordCount: number): void {
  totalWords = wordCount;
  active = wordCount > 50;
  if (progressEl) progressEl.classList.toggle("hidden", !active);
}

function updateProgress(scrollContainer: HTMLElement): void {
  if (!active || !barEl || !percentEl || !timerEl) return;

  const report = $("report");
  if (!report || report.classList.contains("empty")) {
    if (progressEl) progressEl.classList.add("hidden");
    return;
  }

  // Calculate how far the report is scrolled
  const rect = report.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const reportTop = rect.top - containerRect.top;
  const reportHeight = rect.height;
  const viewHeight = containerRect.height;

  // Progress: how much of the report has scrolled past top
  let progress = 0;
  if (reportTop >= 0) {
    progress = 0;
  } else if (reportTop + reportHeight <= viewHeight) {
    progress = 1;
  } else {
    progress = Math.abs(reportTop) / (reportHeight - viewHeight);
  }
  progress = Math.max(0, Math.min(1, progress));

  const pctVal = Math.round(progress * 100);
  const wordsLeft = Math.round(totalWords * (1 - progress));
  const minsLeft = Math.ceil(wordsLeft / WPM);

  barEl.style.width = `${pctVal}%`;
  percentEl.textContent = `${pctVal}%`;
  timerEl.textContent = progress >= 1
    ? "Done ✓"
    : `${minsLeft} min left`;

  if (progressEl) {
    progressEl.classList.toggle("hidden", !active);
    progressEl.classList.toggle("rpf-done", progress >= 1);
  }
}
