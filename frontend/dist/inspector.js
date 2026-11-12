/* ── Source Inspector — expandable source detail panel ── */
import { esc } from "./utils.js";
export function renderInspector(data, container) {
    const { sources, claims } = data;
    // Source stats
    const sourceStats = sources.map((s) => {
        const citing = claims.filter((c) => c.cites.includes(s.id));
        const supported = citing.filter((c) => c.label === "supported").length;
        const partial = citing.filter((c) => c.label === "partial").length;
        const unsupported = citing.filter((c) => c.label === "unsupported").length;
        return { ...s, citing: citing.length, supported, partial, unsupported };
    });
    // Sort by citation count descending
    sourceStats.sort((a, b) => b.citing - a.citing);
    // Overview bar
    const totalClaims = claims.length;
    const supCount = claims.filter((c) => c.label === "supported").length;
    const parCount = claims.filter((c) => c.label === "partial").length;
    const unsCount = claims.filter((c) => c.label === "unsupported").length;
    const unchCount = totalClaims - supCount - parCount - unsCount;
    const barSegments = [
        { pct: supCount / totalClaims * 100, cls: "bar-sup", label: `${supCount} supported` },
        { pct: parCount / totalClaims * 100, cls: "bar-par", label: `${parCount} partial` },
        { pct: unsCount / totalClaims * 100, cls: "bar-uns", label: `${unsCount} unsupported` },
        { pct: unchCount / totalClaims * 100, cls: "bar-unc", label: `${unchCount} unchecked` },
    ];
    container.innerHTML = `
    <div class="insp">
      <div class="insp-header">
        <h3>🔍 Source Inspector</h3>
        <span class="insp-count">${sources.length} sources · ${totalClaims} claims</span>
      </div>

      <div class="insp-bar">
        ${barSegments.filter((s) => s.pct > 0).map((s) => `<div class="${s.cls}" style="width:${s.pct}%" title="${s.label}"></div>`).join("")}
      </div>
      <div class="insp-bar-legend">
        ${barSegments.filter((s) => s.pct > 0).map((s) => `<span class="${s.cls}-label">${s.label}</span>`).join("")}
      </div>

      <div class="insp-sources">
        ${sourceStats.map((s) => `
          <details class="insp-source" data-cred="${s.credibility}">
            <summary>
              <span class="insp-src-dot cred-${esc(s.credibility)}"></span>
              <span class="insp-src-id">[${s.id}]</span>
              <span class="insp-src-title">${esc(s.title)}</span>
              <span class="insp-src-badges">
                <span class="tag ${esc(s.credibility)}">${esc(s.credibility)}</span>
                <span class="tag">${s.citing} citation${s.citing !== 1 ? "s" : ""}</span>
                ${s.date ? `<span class="tag">${esc(s.date)}</span>` : ""}
              </span>
            </summary>
            <div class="insp-src-detail">
              <a href="${esc(s.url)}" target="_blank" rel="noopener" class="insp-src-url">${esc(s.url)}</a>
              <div class="insp-src-metrics">
                <span class="ok">✓ ${s.supported}</span>
                <span class="warn">◐ ${s.partial}</span>
                <span class="bad">✗ ${s.unsupported}</span>
              </div>
              <div class="insp-src-claims">
                ${claims.filter((c) => c.cites.includes(s.id)).map((c) => `
                  <div class="insp-claim">
                    <span class="insp-claim-label label-${esc(c.label)}">${esc(c.label)}</span>
                    <span>${esc(c.text)}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          </details>
        `).join("")}
      </div>
    </div>
  `;
}
//# sourceMappingURL=inspector.js.map