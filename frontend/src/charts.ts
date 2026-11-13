/* ── Verity charts: dependency-free SVG ────────────────────────────── */
import { h } from "./u.js";

const NS = "http://www.w3.org/2000/svg";
function sv(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Area/line chart with x labels, hover dots and tooltip. */
export function chArea(values: number[], labels: string[], opts?: { height?: number }): HTMLElement {
  const W = 720, H = opts?.height ?? 220, PL = 34, PB = 24, PT = 12, PR = 8;
  const max = Math.max(1, ...values);
  const stepX = (W - PL - PR) / Math.max(1, values.length - 1);
  const X = (i: number) => PL + i * stepX;
  const Y = (v: number) => PT + (H - PT - PB) * (1 - v / max);

  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "v-chart" }) as SVGSVGElement;
  // grid + y labels
  const ticks = 4;
  const seen = new Set<number>();
  for (let t = 0; t <= ticks; t++) {
    const v = Math.round((max / ticks) * t), y = Y(v);
    svg.append(sv("line", { x1: PL, y1: Y((max / ticks) * t), x2: W - PR, y2: Y((max / ticks) * t), class: "grid" }));
    if (seen.has(v)) continue;
    seen.add(v);
    const lab = sv("text", { x: PL - 7, y: y + 3.5, class: "ylab", "text-anchor": "end" });
    lab.textContent = String(v);
    svg.append(lab);
  }
  if (values.length) {
    const pts = values.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
    const areaD = `M${X(0)},${Y(values[0])} ` + values.map((v, i) => `L${X(i)},${Y(v)}`).join(" ") +
      ` L${X(values.length - 1)},${H - PB} L${X(0)},${H - PB} Z`;
    const grad = sv("linearGradient", { id: "vag", x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(sv("stop", { offset: "0%", "stop-color": "var(--green-500)", "stop-opacity": .22 }));
    grad.append(sv("stop", { offset: "100%", "stop-color": "var(--green-500)", "stop-opacity": 0 }));
    const defs = sv("defs", {}); defs.append(grad); svg.append(defs);
    svg.append(sv("path", { d: areaD, fill: "url(#vag)", stroke: "none" }));
    svg.append(sv("polyline", { points: pts, class: "line" }));
    values.forEach((v, i) => {
      if (v > 0 || values.length < 40) svg.append(sv("circle", { cx: X(i), cy: Y(v), r: 2.6, class: "dot" }));
    });
  }
  // x labels (thin out)
  const every = Math.max(1, Math.ceil(labels.length / 9));
  labels.forEach((l, i) => {
    if (i % every !== 0 && i !== labels.length - 1) return;
    const t = sv("text", { x: X(i), y: H - 7, class: "xlab", "text-anchor": "middle" });
    t.textContent = l; svg.append(t);
  });

  const wrap = h("div.v-chartwrap");
  const tip = h("div.v-tip");
  wrap.append(svg as unknown as HTMLElement, tip);
  svg.addEventListener("mousemove", (e) => {
    const r = (svg as unknown as HTMLElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(values.length - 1, Math.round((px - PL) / stepX)));
    tip.textContent = `${labels[i]} — ${values[i]}`;
    tip.style.opacity = "1";
    tip.style.left = Math.min(Math.max((X(i) / W) * r.width, 40), r.width - 50) + "px";
    tip.style.top = (Y(values[i]) / H) * r.height - 30 + "px";
  });
  svg.addEventListener("mouseleave", () => { tip.style.opacity = "0"; });
  return wrap;
}

/** Donut with center label. */
export function chDonut(parts: { label: string; value: number; color: string }[], center: string, sub: string): HTMLElement {
  const total = Math.max(1, parts.reduce((a, p) => a + p.value, 0));
  const R = 52, C = 2 * Math.PI * R;
  const svg = sv("svg", { viewBox: "0 0 140 140", class: "v-donut" });
  let off = C * 0.25;
  svg.append(sv("circle", { cx: 70, cy: 70, r: R, fill: "none", stroke: "var(--line)", "stroke-width": 14 }));
  for (const p of parts) {
    if (!p.value) continue;
    const len = (p.value / total) * C;
    svg.append(sv("circle", {
      cx: 70, cy: 70, r: R, fill: "none", stroke: p.color, "stroke-width": 14,
      "stroke-dasharray": `${len} ${C - len}`, "stroke-dashoffset": off, "stroke-linecap": "butt",
    }));
    off -= len;
  }
  const c1 = sv("text", { x: 70, y: 66, class: "dn-c", "text-anchor": "middle" }); c1.textContent = center;
  const c2 = sv("text", { x: 70, y: 84, class: "dn-s", "text-anchor": "middle" }); c2.textContent = sub;
  svg.append(c1, c2);
  const legend = h("div.v-legend");
  for (const p of parts) legend.append(h("span.v-legend-it", null,
    h("i", { style: `background:${p.color}` }), `${p.label} (${p.value})`));
  return h("div.v-donutwrap", null, svg as unknown as HTMLElement, legend);
}

/** Horizontal bars (label, value, max). */
export function chBars(rows: { label: string; value: number; hint?: string }[], unit = ""): HTMLElement {
  const max = Math.max(1, ...rows.map(r => r.value));
  const box = h("div.v-bars");
  for (const r of rows) {
    box.append(h("div.v-bar-row", null,
      h("span.v-bar-label", { title: r.label }, r.label),
      h("div.v-bar-track", null, h("div.v-bar-fill", { style: `width:${(r.value / max) * 100}%` })),
      h("span.v-bar-val", null, `${r.value}${unit}${r.hint ? " · " + r.hint : ""}`)));
  }
  return box;
}
