/* ── Research Timeline — real-time process visualization ─ */

import { esc } from "./utils.js";

interface TimelineEntry {
  time: number;
  stage: string;
  icon: string;
  label: string;
  detail?: string;
  duration?: number;
}

export class ResearchTimeline {
  private entries: TimelineEntry[] = [];
  private container: HTMLElement;
  private startTime: number;
  private el: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.startTime = Date.now();
  }

  add(stage: string, icon: string, label: string, detail?: string): void {
    const now = Date.now();
    // Set duration on previous entry
    if (this.entries.length > 0) {
      const prev = this.entries[this.entries.length - 1];
      prev.duration = now - prev.time;
    }
    this.entries.push({ time: now, stage, icon, label, detail });
    this.render();
  }

  finish(): void {
    if (this.entries.length > 0) {
      const last = this.entries[this.entries.length - 1];
      last.duration = Date.now() - last.time;
    }
    this.render();
  }

  reset(): void {
    this.entries = [];
    this.startTime = Date.now();
    if (this.el) this.el.remove();
    this.el = null;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private render(): void {
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.className = "timeline";
      this.container.appendChild(this.el);
    }

    const totalMs = Date.now() - this.startTime;

    this.el.innerHTML = `
      <div class="timeline-header">
        <span class="timeline-title">⏱ Research Timeline</span>
        <span class="timeline-total">${this.formatDuration(totalMs)} elapsed</span>
      </div>
      <div class="timeline-track">
        ${this.entries.map((e, i) => {
          const widthPct = e.duration
            ? Math.max(2, (e.duration / totalMs) * 100)
            : 10;
          return `
            <div class="timeline-segment stage-${esc(e.stage)}" style="flex:${widthPct}" title="${esc(e.label)}${e.duration ? " (" + this.formatDuration(e.duration) + ")" : ""}">
              <div class="timeline-seg-fill${!e.duration ? " timeline-seg-active" : ""}"></div>
            </div>
          `;
        }).join("")}
      </div>
      <div class="timeline-entries">
        ${this.entries.map((e, i) => `
          <div class="timeline-entry${i === this.entries.length - 1 && !e.duration ? " timeline-current" : ""}">
            <div class="timeline-dot stage-dot-${esc(e.stage)}"></div>
            <div class="timeline-entry-content">
              <span class="timeline-icon">${e.icon}</span>
              <span class="timeline-label">${esc(e.label)}</span>
              ${e.duration ? `<span class="timeline-dur">${this.formatDuration(e.duration)}</span>` : '<span class="timeline-dur timeline-running">running…</span>'}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }
}
