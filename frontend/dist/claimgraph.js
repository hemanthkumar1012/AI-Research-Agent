/* ── Claim Dependency Graph ────────────────────────────── */
/* Interactive SVG graph showing how claims depend on each    */
/* other and which sources back each claim                    */
import { esc } from "./utils.js";
export function renderClaimGraph(claims, allSources, container) {
    if (!claims.length) {
        container.innerHTML = `<div class="empty-state"><span class="es-icon">🔗</span><h3>No Claims</h3><p>Run a research query to see claim dependencies</p></div>`;
        return;
    }
    const W = container.clientWidth || 700;
    const H = 500;
    const R = 24;
    // Build nodes
    const nodes = claims.map((c, i) => ({
        id: i,
        text: c.text.length > 60 ? c.text.slice(0, 57) + "…" : c.text,
        sources: c.sources.map(s => allSources.findIndex(src => src.url === s || src.title === s)).filter(x => x >= 0),
        x: W / 2 + (Math.random() - 0.5) * W * 0.6,
        y: H / 2 + (Math.random() - 0.5) * H * 0.6,
        vx: 0,
        vy: 0
    }));
    // Build edges: claims sharing sources are connected
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const shared = nodes[i].sources.filter(s => nodes[j].sources.includes(s));
            if (shared.length > 0) {
                edges.push({ from: i, to: j, type: "supports" });
            }
        }
    }
    // Force simulation
    for (let iter = 0; iter < 60; iter++) {
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                let dx = nodes[j].x - nodes[i].x;
                let dy = nodes[j].y - nodes[i].y;
                const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                const force = 8000 / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                nodes[i].vx -= fx;
                nodes[i].vy -= fy;
                nodes[j].vx += fx;
                nodes[j].vy += fy;
            }
        }
        // Edge attraction
        for (const e of edges) {
            const a = nodes[e.from];
            const b = nodes[e.to];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const force = (dist - 120) * 0.02;
            const fx = (dx / (dist || 1)) * force;
            const fy = (dy / (dist || 1)) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
        }
        // Center gravity
        for (const n of nodes) {
            n.vx += (W / 2 - n.x) * 0.005;
            n.vy += (H / 2 - n.y) * 0.005;
            n.x += n.vx * 0.3;
            n.y += n.vy * 0.3;
            n.vx *= 0.85;
            n.vy *= 0.85;
            n.x = Math.max(R + 10, Math.min(W - R - 10, n.x));
            n.y = Math.max(R + 10, Math.min(H - R - 10, n.y));
        }
    }
    // Render SVG
    const colors = ["var(--accent)", "var(--green)", "var(--amber)", "#e879f9", "#38bdf8", "#fb923c"];
    let svg = `<svg class="claim-graph-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs><filter id="cg-glow"><feGaussianBlur stdDeviation="3" result="blur"/>`;
    svg += `<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    // Edges
    for (const e of edges) {
        const a = nodes[e.from];
        const b = nodes[e.to];
        svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6"/>`;
    }
    // Nodes
    for (const n of nodes) {
        const col = colors[n.id % colors.length];
        const srcCount = n.sources.length;
        const r = R + srcCount * 3;
        svg += `<g class="cg-node" data-id="${n.id}">`;
        svg += `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${col}" opacity="0.15" stroke="${col}" stroke-width="2" filter="url(#cg-glow)"/>`;
        svg += `<circle cx="${n.x}" cy="${n.y}" r="${r - 4}" fill="var(--surface)" opacity="0.9"/>`;
        svg += `<text x="${n.x}" y="${n.y - 4}" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">C${n.id + 1}</text>`;
        svg += `<text x="${n.x}" y="${n.y + 8}" text-anchor="middle" fill="var(--text3)" font-size="7">${srcCount} src</text>`;
        // Tooltip
        svg += `<title>${esc(n.text)} (${srcCount} sources)</title>`;
        svg += `</g>`;
    }
    svg += `</svg>`;
    // Legend
    let html = `<div class="claim-graph">`;
    html += svg;
    html += `<div class="cg-legend">`;
    html += `<span class="cg-legend-item">● Node = Claim</span>`;
    html += `<span class="cg-legend-item">--- Shared sources</span>`;
    html += `<span class="cg-legend-item">Size = Source count</span>`;
    html += `</div>`;
    // Claim list
    html += `<div class="cg-claims">`;
    for (const n of nodes) {
        const col = colors[n.id % colors.length];
        html += `<div class="cg-claim-item">`;
        html += `<span class="cg-claim-id" style="background:${col}">C${n.id + 1}</span>`;
        html += `<span class="cg-claim-text">${esc(n.text)}</span>`;
        html += `</div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
}
//# sourceMappingURL=claimgraph.js.map