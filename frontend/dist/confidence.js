/* ── AI Confidence Meter ───────────────────────────────── */
/* Animated radial gauge showing overall research confidence */
import { pct } from "./utils.js";
export function renderConfidence(d, container) {
    const prec = d.score.citation_precision;
    const srcCount = d.sources.length;
    const claimCount = d.claims.length;
    const highCred = d.sources.filter((s) => s.credibility === "high").length;
    // Composite confidence: precision (40%), source diversity (20%), claim coverage (20%), high-cred ratio (20%)
    const srcDiv = Math.min(srcCount / 15, 1);
    const coverage = claimCount > 0 ? (d.score.supported + d.score.partial) / claimCount : 0;
    const credRatio = srcCount > 0 ? highCred / srcCount : 0;
    const confidence = prec * 0.4 + srcDiv * 0.2 + coverage * 0.2 + credRatio * 0.2;
    const level = confidence >= 0.8 ? "high" : confidence >= 0.5 ? "medium" : "low";
    const levelLabel = confidence >= 0.8 ? "High Confidence" : confidence >= 0.5 ? "Moderate" : "Low Confidence";
    const levelColor = confidence >= 0.8 ? "var(--green)" : confidence >= 0.5 ? "var(--amber)" : "var(--red)";
    const circumference = 2 * Math.PI * 70;
    const dashOffset = circumference * (1 - confidence);
    container.innerHTML = `
    <div class="confidence">
      <div class="conf-gauge">
        <svg viewBox="0 0 160 160" class="conf-svg">
          <circle cx="80" cy="80" r="70" fill="none" stroke="var(--border)" stroke-width="8"/>
          <circle cx="80" cy="80" r="70" fill="none" stroke="${levelColor}" stroke-width="8"
            stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
            transform="rotate(-90 80 80)" class="conf-ring"/>
          <text x="80" y="72" text-anchor="middle" fill="var(--text)" font-size="28" font-weight="700">
            ${Math.round(confidence * 100)}
          </text>
          <text x="80" y="92" text-anchor="middle" fill="${levelColor}" font-size="11" font-weight="500">
            ${levelLabel}
          </text>
        </svg>
      </div>

      <div class="conf-factors">
        <div class="conf-header">Confidence Breakdown</div>
        ${renderFactor("Citation Precision", prec, 0.4)}
        ${renderFactor("Source Diversity", srcDiv, 0.2)}
        ${renderFactor("Claim Coverage", coverage, 0.2)}
        ${renderFactor("High-Cred Ratio", credRatio, 0.2)}
      </div>
    </div>
  `;
    // Animate ring on load
    const ring = container.querySelector(".conf-ring");
    if (ring) {
        ring.style.strokeDashoffset = String(circumference);
        requestAnimationFrame(() => {
            ring.style.transition = "stroke-dashoffset 1.2s ease-out";
            ring.style.strokeDashoffset = String(dashOffset);
        });
    }
}
function renderFactor(label, value, weight) {
    const color = value >= 0.8 ? "var(--green)" : value >= 0.5 ? "var(--amber)" : "var(--red)";
    return `
    <div class="conf-factor">
      <div class="conf-factor-head">
        <span class="conf-factor-label">${label}</span>
        <span class="conf-factor-val" style="color:${color}">${pct(value)}</span>
        <span class="conf-factor-weight">×${weight}</span>
      </div>
      <div class="conf-factor-bar">
        <div class="conf-factor-fill" style="width:${value * 100}%;background:${color}"></div>
      </div>
    </div>
  `;
}
//# sourceMappingURL=confidence.js.map