/* ── Source Credibility Scoring ────────────────────────── */
/* Visual credibility breakdown per source with badges       */
/* Factors: domain authority, HTTPS, citation count, age     */

import { esc } from "./utils.js";

interface CredibilityScore {
  url: string;
  domain: string;
  score: number;
  factors: { label: string; value: number; max: number }[];
  tier: "high" | "medium" | "low";
}

const TRUSTED_DOMAINS = [
  "nature.com", "science.org", "ieee.org", "acm.org", "arxiv.org",
  "nih.gov", "who.int", "cdc.gov", "edu", "gov",
  "reuters.com", "apnews.com", "bbc.com", "nytimes.com"
];

function scoreDomain(url: string): CredibilityScore {
  let domain = "";
  try { domain = new URL(url).hostname.replace("www.", ""); } catch { domain = url; }

  const factors: { label: string; value: number; max: number }[] = [];

  // HTTPS check
  const isHttps = url.startsWith("https://");
  factors.push({ label: "HTTPS", value: isHttps ? 20 : 0, max: 20 });

  // Domain trust
  const isTrusted = TRUSTED_DOMAINS.some(d => domain.endsWith(d));
  factors.push({ label: "Domain Trust", value: isTrusted ? 30 : 10, max: 30 });

  // TLD quality
  const tld = domain.split(".").pop() || "";
  const tldScore = ["gov", "edu", "org"].includes(tld) ? 20 : ["com", "net"].includes(tld) ? 10 : 5;
  factors.push({ label: "TLD Quality", value: tldScore, max: 20 });

  // Domain length (shorter = more established usually)
  const lenScore = domain.length < 15 ? 15 : domain.length < 25 ? 10 : 5;
  factors.push({ label: "Establishment", value: lenScore, max: 15 });

  // Subdomain depth
  const parts = domain.split(".");
  const depthScore = parts.length <= 2 ? 15 : parts.length <= 3 ? 10 : 5;
  factors.push({ label: "Direct Source", value: depthScore, max: 15 });

  const total = factors.reduce((s, f) => s + f.value, 0);
  const tier = total >= 70 ? "high" : total >= 40 ? "medium" : "low";

  return { url, domain, score: total, factors, tier };
}

export function renderCredibilityPanel(sources: { url: string; title: string; credibility: number }[], container: HTMLElement): void {
  if (!sources.length) {
    container.innerHTML = `<div class="empty-state"><span class="es-icon">🔍</span><h3>No Sources</h3><p>Run a research query first</p></div>`;
    return;
  }

  const scored = sources.map(s => ({ ...s, cred: scoreDomain(s.url) }));
  scored.sort((a, b) => b.cred.score - a.cred.score);

  const avgScore = Math.round(scored.reduce((s, x) => s + x.cred.score, 0) / scored.length);
  const highCount = scored.filter(s => s.cred.tier === "high").length;
  const lowCount = scored.filter(s => s.cred.tier === "low").length;

  let html = `<div class="cred-panel">`;
  html += `<div class="cred-overview">`;
  html += `<div class="cred-avg"><span class="cred-avg-num">${avgScore}</span><span class="cred-avg-label">Avg Score</span></div>`;
  html += `<div class="cred-counts">`;
  html += `<span class="cred-badge cred-high">${highCount} High</span>`;
  html += `<span class="cred-badge cred-med">${scored.length - highCount - lowCount} Med</span>`;
  html += `<span class="cred-badge cred-low">${lowCount} Low</span>`;
  html += `</div></div>`;

  for (const s of scored) {
    const tierCls = s.cred.tier;
    html += `<div class="cred-card cred-tier-${tierCls}">`;
    html += `<div class="cred-card-head">`;
    html += `<span class="cred-score-circle cred-${tierCls}">${s.cred.score}</span>`;
    html += `<div class="cred-card-info">`;
    html += `<div class="cred-domain">${esc(s.cred.domain)}</div>`;
    html += `<div class="cred-title">${esc(s.title)}</div>`;
    html += `</div></div>`;

    html += `<div class="cred-factors">`;
    for (const f of s.cred.factors) {
      const pct = (f.value / f.max) * 100;
      html += `<div class="cred-factor">`;
      html += `<span class="cred-factor-label">${f.label}</span>`;
      html += `<div class="cred-factor-bar"><div class="cred-factor-fill" style="width:${pct}%"></div></div>`;
      html += `<span class="cred-factor-val">${f.value}/${f.max}</span>`;
      html += `</div>`;
    }
    html += `</div></div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}
