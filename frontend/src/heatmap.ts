/* ── Source Credibility Heatmap ─────────────────────────── */
/* Treemap-style visualization of source trust & citation   */

import type { ReportData, Source, Claim } from "./types.js";
import { esc } from "./utils.js";

interface HeatCell {
  source: Source;
  claimCount: number;
  supportedPct: number;
}

const CRED_COLORS: Record<string, { bg: string; border: string }> = {
  high:   { bg: "rgba(0,206,201,0.15)", border: "var(--green)" },
  medium: { bg: "rgba(253,203,110,0.15)", border: "var(--amber)" },
  low:    { bg: "rgba(255,118,117,0.12)", border: "var(--red)" },
  user:   { bg: "rgba(109,159,255,0.12)", border: "#6d9fff" },
};

export function renderHeatmap(d: ReportData, container: HTMLElement): void {
  // Build claim count per source
  const map = new Map<number, { total: number; supported: number }>();
  for (const c of d.claims) {
    for (const sid of c.cites) {
      const entry = map.get(sid) || { total: 0, supported: 0 };
      entry.total++;
      if (c.label === "supported") entry.supported++;
      map.set(sid, entry);
    }
  }

  const cells: HeatCell[] = d.sources.map((s) => {
    const m = map.get(s.id) || { total: 0, supported: 0 };
    return {
      source: s,
      claimCount: m.total,
      supportedPct: m.total ? m.supported / m.total : 0,
    };
  }).sort((a, b) => b.claimCount - a.claimCount);

  const maxClaims = Math.max(1, ...cells.map((c) => c.claimCount));

  container.innerHTML = `
    <div class="heatmap">
      <div class="heatmap-header">
        <h3>🗺 Source Credibility Heatmap</h3>
        <span class="heatmap-hint">Size = citations · Color = credibility · Opacity = support rate</span>
      </div>
      <div class="heatmap-grid">
        ${cells.map((c) => {
          const colors = CRED_COLORS[c.source.credibility] || CRED_COLORS.medium;
          const size = 0.5 + (c.claimCount / maxClaims) * 0.5;
          const opacity = 0.4 + c.supportedPct * 0.6;
          return `<div class="heatmap-cell" style="
            flex: ${Math.max(1, Math.round(size * 3))};
            background: ${colors.bg};
            border-color: ${colors.border};
            opacity: ${opacity};
          " title="${esc(c.source.title)} — ${c.claimCount} citations, ${Math.round(c.supportedPct * 100)}% supported">
            <div class="heatmap-cell-id">[${c.source.id}]</div>
            <div class="heatmap-cell-title">${esc(c.source.title.slice(0, 30))}${c.source.title.length > 30 ? "…" : ""}</div>
            <div class="heatmap-cell-stats">
              <span class="heatmap-cred ${c.source.credibility}">${c.source.credibility}</span>
              <span>${c.claimCount} cites</span>
            </div>
          </div>`;
        }).join("")}
      </div>
      <div class="heatmap-legend">
        <span>🟢 High</span>
        <span>🟡 Medium</span>
        <span>🔴 Low</span>
        <span>🔵 User-provided</span>
        <span style="margin-left:auto">Larger = more citations</span>
      </div>
    </div>
  `;
}
