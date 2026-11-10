/* ── Analytics Dashboard ───────────────────────────────── */
/* Reading time, word stats, source breakdown, depth gauge  */

import type { ReportData, Source } from "./types.js";
import { pct, esc } from "./utils.js";

const WPM = 230; // average reading speed

export interface AnalyticsData {
  wordCount: number;
  readingMinutes: number;
  sentenceCount: number;
  avgSentenceLen: number;
  sourceBreakdown: { label: string; count: number; color: string }[];
  claimBreakdown: { label: string; count: number; color: string }[];
  depthScore: number; // 0-100
}

export function computeAnalytics(d: ReportData): AnalyticsData {
  const words = d.markdown.split(/\s+/).filter(Boolean);
  const sentences = d.markdown.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  const wordCount = words.length;

  const credMap: Record<string, number> = { high: 0, medium: 0, low: 0, user: 0 };
  for (const s of d.sources) credMap[s.credibility] = (credMap[s.credibility] || 0) + 1;

  const claimMap: Record<string, number> = { supported: 0, partial: 0, unsupported: 0, unchecked: 0 };
  for (const c of d.claims) claimMap[c.label] = (claimMap[c.label] || 0) + 1;

  // Depth score: combination of sources, claims, word count
  const srcScore = Math.min(d.sources.length / 20, 1) * 30;
  const claimScore = Math.min(d.claims.length / 30, 1) * 30;
  const wordScore = Math.min(wordCount / 3000, 1) * 25;
  const precScore = d.score.citation_precision * 15;

  return {
    wordCount,
    readingMinutes: Math.ceil(wordCount / WPM),
    sentenceCount: sentences.length,
    avgSentenceLen: sentences.length ? Math.round(wordCount / sentences.length) : 0,
    sourceBreakdown: [
      { label: "High", count: credMap.high, color: "var(--green)" },
      { label: "Medium", count: credMap.medium, color: "var(--amber)" },
      { label: "Low", count: credMap.low, color: "var(--red)" },
      { label: "User", count: credMap.user, color: "#6d9fff" },
    ].filter((x) => x.count > 0),
    claimBreakdown: [
      { label: "Supported", count: claimMap.supported, color: "var(--green)" },
      { label: "Partial", count: claimMap.partial, color: "var(--amber)" },
      { label: "Unsupported", count: claimMap.unsupported, color: "var(--red)" },
      { label: "Unchecked", count: claimMap.unchecked, color: "var(--text3)" },
    ].filter((x) => x.count > 0),
    depthScore: Math.round(srcScore + claimScore + wordScore + precScore),
  };
}

export function renderAnalytics(d: ReportData, container: HTMLElement): void {
  const a = computeAnalytics(d);

  const barHTML = (items: { label: string; count: number; color: string }[]) => {
    const total = items.reduce((s, x) => s + x.count, 0);
    if (!total) return '<div class="ana-bar-empty">No data</div>';
    return `<div class="ana-bar">${items
      .map(
        (x) =>
          `<div class="ana-bar-seg" style="width:${(x.count / total) * 100}%;background:${x.color}" title="${x.label}: ${x.count}"></div>`
      )
      .join("")}</div>
    <div class="ana-bar-legend">${items
      .map(
        (x) =>
          `<span style="color:${x.color}">● ${x.label} (${x.count})</span>`
      )
      .join(" ")}</div>`;
  };

  const gaugeAngle = (a.depthScore / 100) * 180;

  container.innerHTML = `
    <div class="analytics">
      <div class="ana-header">
        <h3>📊 Report Analytics</h3>
        <span class="ana-badge">${a.readingMinutes} min read</span>
      </div>

      <div class="ana-grid">
        <div class="ana-stat">
          <div class="ana-stat-val">${a.wordCount.toLocaleString()}</div>
          <div class="ana-stat-label">Words</div>
        </div>
        <div class="ana-stat">
          <div class="ana-stat-val">${a.sentenceCount}</div>
          <div class="ana-stat-label">Sentences</div>
        </div>
        <div class="ana-stat">
          <div class="ana-stat-val">${a.avgSentenceLen}</div>
          <div class="ana-stat-label">Avg words/sentence</div>
        </div>
        <div class="ana-stat">
          <div class="ana-stat-val">${d.sources.length}</div>
          <div class="ana-stat-label">Sources</div>
        </div>
        <div class="ana-stat">
          <div class="ana-stat-val">${d.claims.length}</div>
          <div class="ana-stat-label">Claims</div>
        </div>
        <div class="ana-stat">
          <div class="ana-stat-val">${pct(d.score.citation_precision)}</div>
          <div class="ana-stat-label">Precision</div>
        </div>
      </div>

      <div class="ana-section">
        <h4>Research Depth</h4>
        <div class="ana-gauge-wrap">
          <svg class="ana-gauge" viewBox="0 0 200 110">
            <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="var(--border)" stroke-width="12" stroke-linecap="round"/>
            <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="url(#gaugeGrad)" stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${(gaugeAngle / 180) * 283} 283" class="ana-gauge-fill"/>
            <defs><linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="var(--red)"/><stop offset="50%" stop-color="var(--amber)"/><stop offset="100%" stop-color="var(--green)"/>
            </linearGradient></defs>
            <text x="100" y="90" text-anchor="middle" fill="var(--text)" font-size="28" font-weight="700">${a.depthScore}</text>
            <text x="100" y="108" text-anchor="middle" fill="var(--text3)" font-size="11">/ 100</text>
          </svg>
        </div>
      </div>

      <div class="ana-section">
        <h4>Source Credibility</h4>
        ${barHTML(a.sourceBreakdown)}
      </div>

      <div class="ana-section">
        <h4>Claim Verification</h4>
        ${barHTML(a.claimBreakdown)}
      </div>
    </div>
  `;
}
