/* ── Report Comparison / Diff ──────────────────────────── */
/* Side-by-side diff of two research reports                 */
/* Highlights added, removed, and changed sections           */

import { esc } from "./utils.js";

interface DiffLine {
  type: "same" | "added" | "removed";
  text: string;
}

function computeDiff(a: string, b: string): DiffLine[] {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = linesA.length;
  const n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = linesA[i - 1] === linesB[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  let i = m, j = n;
  const ops: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      ops.push({ type: "same", text: linesA[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "added", text: linesB[j - 1] });
      j--;
    } else {
      ops.push({ type: "removed", text: linesA[i - 1] });
      i--;
    }
  }

  return ops.reverse();
}

export function renderDiff(reportA: string, reportB: string, container: HTMLElement): void {
  const diff = computeDiff(reportA, reportB);

  const added = diff.filter(d => d.type === "added").length;
  const removed = diff.filter(d => d.type === "removed").length;
  const same = diff.filter(d => d.type === "same").length;
  const total = diff.length || 1;

  let html = `<div class="diff-view">`;
  html += `<div class="diff-header">`;
  html += `<div class="diff-stat">`;
  html += `<span class="diff-stat-same">${same} unchanged</span>`;
  html += `<span class="diff-stat-add">+${added} added</span>`;
  html += `<span class="diff-stat-rm">-${removed} removed</span>`;
  html += `</div>`;
  html += `<div class="diff-bar">`;
  html += `<div class="diff-bar-same" style="width:${(same / total) * 100}%"></div>`;
  html += `<div class="diff-bar-add" style="width:${(added / total) * 100}%"></div>`;
  html += `<div class="diff-bar-rm" style="width:${(removed / total) * 100}%"></div>`;
  html += `</div></div>`;

  html += `<div class="diff-lines">`;
  let lineNum = 0;
  for (const line of diff) {
    lineNum++;
    const cls = line.type === "added" ? "diff-add" : line.type === "removed" ? "diff-rm" : "diff-ctx";
    const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
    html += `<div class="diff-line ${cls}">`;
    html += `<span class="diff-ln">${lineNum}</span>`;
    html += `<span class="diff-prefix">${prefix}</span>`;
    html += `<span class="diff-text">${esc(line.text)}</span>`;
    html += `</div>`;
  }
  html += `</div></div>`;

  container.innerHTML = html;
}

// Store previous reports for comparison
let reportHistory: string[] = [];

export function pushReport(markdown: string): void {
  reportHistory.push(markdown);
  if (reportHistory.length > 10) reportHistory.shift();
}

export function getReportHistory(): string[] {
  return [...reportHistory];
}

export function canDiff(): boolean {
  return reportHistory.length >= 2;
}
