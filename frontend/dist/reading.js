/* ── Reading Progress & Estimated Time ─────────────────── */
/* Floating progress indicator with reading time estimate     */
import { $ } from "./utils.js";
let progressEl = null;
let timerEl = null;
let percentEl = null;
let barEl = null;
let readingActive = false;
let totalWords = 0;
const READING_WPM = 230;
export function initReadingProgress() {
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
        main.addEventListener("scroll", () => updateProgress(main));
    }
}
export function setReadingContent(wordCount) {
    totalWords = wordCount;
    readingActive = wordCount > 50;
    if (progressEl)
        progressEl.classList.toggle("hidden", !readingActive);
}
function updateProgress(scrollContainer) {
    if (!readingActive || !barEl || !percentEl || !timerEl)
        return;
    const report = $("report");
    if (!report || report.classList.contains("empty")) {
        if (progressEl)
            progressEl.classList.add("hidden");
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
    }
    else if (reportTop + reportHeight <= viewHeight) {
        progress = 1;
    }
    else {
        progress = Math.abs(reportTop) / (reportHeight - viewHeight);
    }
    progress = Math.max(0, Math.min(1, progress));
    const pctVal = Math.round(progress * 100);
    const wordsLeft = Math.round(totalWords * (1 - progress));
    const minsLeft = Math.ceil(wordsLeft / READING_WPM);
    barEl.style.width = `${pctVal}%`;
    percentEl.textContent = `${pctVal}%`;
    timerEl.textContent = progress >= 1
        ? "Done ✓"
        : `${minsLeft} min left`;
    if (progressEl) {
        progressEl.classList.toggle("hidden", !readingActive);
        progressEl.classList.toggle("rpf-done", progress >= 1);
    }
}
//# sourceMappingURL=reading.js.map