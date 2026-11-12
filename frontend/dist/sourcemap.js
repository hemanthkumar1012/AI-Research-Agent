/* ── Source Relationship Map (Force-Directed) ──────────── */
/* Interactive SVG graph showing source co-citation links     */
/* Sources that cite the same claims are connected            */
const SMAP_CRED_COLORS = {
    high: "var(--green)",
    medium: "var(--amber)",
    low: "var(--red)",
    user: "#6d9fff",
};
export function renderSourceMap(d, container) {
    if (d.sources.length < 2) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🗺</div>
      <div class="empty-title">Not Enough Sources</div>
      <div class="empty-sub">Need at least 2 sources for relationship map</div></div>`;
        return;
    }
    // Build co-citation edges
    const edgeMap = new Map();
    for (const claim of d.claims) {
        const cites = claim.cites;
        for (let i = 0; i < cites.length; i++) {
            for (let j = i + 1; j < cites.length; j++) {
                const key = `${Math.min(cites[i], cites[j])}-${Math.max(cites[i], cites[j])}`;
                edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
            }
        }
    }
    // Count claims per source
    const claimCounts = new Map();
    for (const c of d.claims) {
        for (const sid of c.cites) {
            claimCounts.set(sid, (claimCounts.get(sid) || 0) + 1);
        }
    }
    const W = 600, H = 400;
    const maxClaims = Math.max(1, ...d.sources.map((s) => claimCounts.get(s.id) || 0));
    // Create nodes
    const nodes = d.sources.map((s, i) => {
        const cc = claimCounts.get(s.id) || 0;
        const angle = (i / d.sources.length) * Math.PI * 2;
        const r = 120 + Math.random() * 40;
        return {
            id: s.id,
            title: s.title.slice(0, 25),
            credibility: s.credibility,
            claimCount: cc,
            x: W / 2 + Math.cos(angle) * r,
            y: H / 2 + Math.sin(angle) * r,
            vx: 0, vy: 0,
            radius: 6 + (cc / maxClaims) * 14,
        };
    });
    const edges = [];
    for (const [key, weight] of edgeMap) {
        const [a, b] = key.split("-").map(Number);
        edges.push({ a, b, weight });
    }
    // Simple force simulation (50 iterations)
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (let iter = 0; iter < 50; iter++) {
        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[j].x - nodes[i].x;
                const dy = nodes[j].y - nodes[i].y;
                const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                const force = 800 / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                nodes[i].vx -= fx;
                nodes[i].vy -= fy;
                nodes[j].vx += fx;
                nodes[j].vy += fy;
            }
        }
        // Attraction along edges
        for (const e of edges) {
            const na = nodeMap.get(e.a);
            const nb = nodeMap.get(e.b);
            if (!na || !nb)
                continue;
            const dx = nb.x - na.x;
            const dy = nb.y - na.y;
            const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const force = (dist - 80) * 0.005 * e.weight;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            na.vx += fx;
            na.vy += fy;
            nb.vx -= fx;
            nb.vy -= fy;
        }
        // Center gravity
        for (const n of nodes) {
            n.vx += (W / 2 - n.x) * 0.01;
            n.vy += (H / 2 - n.y) * 0.01;
            n.x += n.vx * 0.3;
            n.y += n.vy * 0.3;
            n.vx *= 0.8;
            n.vy *= 0.8;
            n.x = Math.max(30, Math.min(W - 30, n.x));
            n.y = Math.max(30, Math.min(H - 30, n.y));
        }
    }
    const maxEdgeW = Math.max(1, ...edges.map((e) => e.weight));
    container.innerHTML = `
    <div class="srcmap">
      <div class="srcmap-header">
        <h3>🗺 Source Relationship Map</h3>
        <span class="srcmap-hint">Lines = shared claims · Size = citation count</span>
      </div>
      <svg class="srcmap-svg" viewBox="0 0 ${W} ${H}">
        <defs>
          <filter id="srcglow"><feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        ${edges.map((e) => {
        const na = nodeMap.get(e.a);
        const nb = nodeMap.get(e.b);
        if (!na || !nb)
            return "";
        const opacity = 0.15 + (e.weight / maxEdgeW) * 0.45;
        return `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}"
            stroke="var(--accent)" stroke-width="${0.5 + e.weight * 0.8}" opacity="${opacity}"/>`;
    }).join("")}
        ${nodes.map((n) => `
          <g class="srcmap-node" data-id="${n.id}">
            <circle cx="${n.x}" cy="${n.y}" r="${n.radius}" fill="${SMAP_CRED_COLORS[n.credibility] || "var(--text3)"}"
              opacity="0.8" filter="url(#srcglow)" stroke="var(--bg)" stroke-width="1.5"/>
            <text x="${n.x}" y="${n.y + n.radius + 12}" text-anchor="middle" fill="var(--text3)"
              font-size="8" font-family="var(--sans)">[${n.id}]</text>
          </g>
        `).join("")}
      </svg>
      <div class="srcmap-legend">
        <span style="color:var(--green)">● High</span>
        <span style="color:var(--amber)">● Medium</span>
        <span style="color:var(--red)">● Low</span>
        <span style="color:#6d9fff">● User</span>
      </div>
    </div>
  `;
    // Hover tooltip
    container.querySelectorAll(".srcmap-node").forEach((g) => {
        g.addEventListener("mouseenter", () => {
            const circle = g.querySelector("circle");
            if (circle) {
                circle.setAttribute("opacity", "1");
                circle.setAttribute("r", String(parseFloat(circle.getAttribute("r") || "8") * 1.3));
            }
        });
        g.addEventListener("mouseleave", () => {
            const circle = g.querySelector("circle");
            if (circle) {
                const n = nodes.find((x) => x.id === Number(g.dataset.id));
                circle.setAttribute("opacity", "0.8");
                circle.setAttribute("r", String(n?.radius || 8));
            }
        });
    });
}
//# sourceMappingURL=sourcemap.js.map