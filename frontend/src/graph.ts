/* ── Interactive Citation Graph (SVG bipartite) ──────── */

import type { ReportData, Source, Claim } from "./types.js";
import { esc } from "./utils.js";

const CRED_COLORS: Record<string, string> = {
  user: "#6d9fff",
  high: "#34d399",
  medium: "#fbbf24",
  low: "#f87171",
};
const LABEL_COLORS: Record<string, string> = {
  supported: "#34d399",
  partial: "#fbbf24",
  unsupported: "#f87171",
  unchecked: "#64748b",
};

export function drawGraph(data: ReportData, container: HTMLElement): void {
  const S = data.sources;
  const C = data.claims;
  const W = 860;

  const rowS = Math.max(34, Math.min(56, 520 / Math.max(S.length, 1)));
  const rowC = 30;
  const H = Math.max(S.length * rowS, C.length * rowC) + 40;

  const sx = 20, sw = 300, cx = W - 400, cw = 380;
  const sy = (i: number) => 20 + i * ((H - 40) / Math.max(S.length, 1)) + 8;
  const cy = (i: number) => 20 + i * ((H - 40) / Math.max(C.length, 1)) + 4;
  const idx = new Map<number, number>(S.map((s, i) => [s.id, i]));

  let edges = "";
  let nodes = "";

  // Draw edges
  C.forEach((c, j) =>
    c.cites.forEach((id) => {
      const si = idx.get(id);
      if (si === undefined) return;
      const y1 = sy(si) + 13, y2 = cy(j) + 11;
      edges += `<path class="e" data-s="${id}" data-c="${c.id}" ` +
        `d="M${sx + sw} ${y1} C ${sx + sw + 120} ${y1}, ${cx - 120} ${y2}, ${cx} ${y2}" ` +
        `stroke="${LABEL_COLORS[c.label] || "#64748b"}"/>`;
    })
  );

  // Draw source nodes
  S.forEach((s, i) => {
    const t = esc(s.title.length > 38 ? s.title.slice(0, 36) + "…" : s.title);
    const col = CRED_COLORS[s.credibility] || "#555";
    nodes += `<g class="n" data-s="${s.id}">` +
      `<rect x="${sx}" y="${sy(i)}" width="${sw}" height="26" rx="7" fill="#151c2e" stroke="${col}"/>` +
      `<circle cx="${sx + 14}" cy="${sy(i) + 13}" r="4.5" fill="${col}"/>` +
      `<text x="${sx + 26}" y="${sy(i) + 17.5}" font-size="12.5" fill="#e8ecf4">[${s.id}] ${t}</text></g>`;
  });

  // Draw claim nodes
  C.forEach((c, j) => {
    const t = esc(c.text.length > 52 ? c.text.slice(0, 50) + "…" : c.text);
    nodes += `<g class="n" data-c="${c.id}">` +
      `<rect x="${cx}" y="${cy(j)}" width="${cw}" height="22" rx="6" fill="#151c2e" stroke="${LABEL_COLORS[c.label]}"/>` +
      `<text x="${cx + 10}" y="${cy(j) + 15}" font-size="11.5" fill="#c8d0e0">${t}</text></g>`;
  });

  container.innerHTML =
    `<div class="graph-legend">Sources (left, coloured by credibility) → claims (right, coloured by verdict). Click a node for details.</div>` +
    `<svg viewBox="0 0 ${W} ${H}" font-family="Inter,system-ui,sans-serif">${edges}${nodes}</svg>` +
    `<div id="gdetail"></div>`;

  // Interaction
  container.querySelectorAll<SVGGElement>(".n").forEach((g) => {
    g.addEventListener("click", () => {
      container.querySelectorAll(".n").forEach((x) => x.classList.remove("sel"));
      g.classList.add("sel");

      const sid = g.dataset.s;
      const cid = g.dataset.c;

      container.querySelectorAll<SVGPathElement>(".e").forEach((p) => {
        p.classList.toggle(
          "hl",
          (!!sid && p.dataset.s === sid) || (!!cid && p.dataset.c === cid)
        );
      });

      const detail = document.getElementById("gdetail")!;

      if (cid) {
        const c = C.find((x) => String(x.id) === cid)!;
        detail.innerHTML =
          `<div class="detail"><span class="tag" style="color:${LABEL_COLORS[c.label]}">${c.label}</span> ` +
          `${esc(c.text)}<div class="usage" style="margin-top:6px">${esc(c.reason || "")} · cites ${c.cites.map((x) => "[" + x + "]").join("")}</div>` +
          (c.facts || [])
            .map(
              (f) =>
                `<div class="fact"><span style="color:${f.supported ? "#34d399" : "#f87171"}">${f.supported ? "✔" : "✖"}</span>` +
                `<div>${esc(f.fact)}${f.quote ? `<span class="quote">"${esc(f.quote)}"${f.source ? " — [" + f.source + "]" : ""}</span>` : ""}</div></div>`
            )
            .join("") +
          "</div>";
      } else if (sid) {
        const s = S.find((x) => String(x.id) === sid)!;
        const used = C.filter((c) => c.cites.includes(+sid));
        detail.innerHTML =
          `<div class="detail"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> ` +
          `<span class="tag ${esc(s.credibility)}">${esc(s.credibility)}</span>` +
          (s.date ? ` <span class="tag">${esc(s.date)}</span>` : "") +
          `<div class="usage" style="margin-top:6px">Cited by ${used.length} claim(s): ${used.filter((c) => c.label === "supported").length} supported</div></div>`;
      }
    });
  });
}
