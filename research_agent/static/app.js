"use strict";
(() => {

// ── types.js ──
/* ── Core domain types for AI Research Agent ────────── */

//# sourceMappingURL=types.js.map

// ── utils.js ──
/* ── Utility functions ────────────────────────────────── */
/** Escape HTML entities */
function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}
/** Format a float as a percentage string */
function pct(x) {
    return Math.round((x || 0) * 100) + "%";
}
/** Shorthand for getElementById */
function $(id) {
    return document.getElementById(id);
}
/** Type-safe query selector */
function $q(sel, root = document) {
    return root.querySelector(sel);
}
/** Format number with locale separators */
function fmt(n) {
    return n.toLocaleString();
}
/** Generate a unique ID */
function uid() {
    return Math.random().toString(36).slice(2, 10);
}
/** Debounce a function */
function debounce(fn, ms) {
    let timer;
    return ((...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    });
}
/** Clamp a number between min and max */
function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
}
/** Format a date string relative to now */
function timeAgo(date) {
    const d = new Date(date);
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)
        return "just now";
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)
        return `${days}d ago`;
    return d.toLocaleDateString();
}
//# sourceMappingURL=utils.js.map

// ── markdown.js ──
/* ── Markdown renderer with fallback ──────────────────── */

/** Minimal markdown → HTML (fallback when marked.js CDN fails) */
function miniMd(src) {
    const out = [];
    let inList = false;
    const inline = (t) => {
        const links = [];
        t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+|file:[^)\s]+)\)/g, (_, txt, url) => {
            links.push(`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(txt)}</a>`);
            return `\u0000${links.length - 1}\u0000`;
        });
        return esc(t)
            .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
            .replace(/\*(.+?)\*/g, "<i>$1</i>")
            .replace(/(^|\s)_(.+?)_(?=\s|$)/g, "$1<i>$2</i>")
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/\u0000(\d+)\u0000/g, (_, i) => links[+i]);
    };
    for (const line of (src || "").split("\n")) {
        const heading = line.match(/^(#{1,4})\s+(.*)/);
        const listItem = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
        if (!listItem && inList) {
            out.push("</ul>");
            inList = false;
        }
        if (heading) {
            out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
        }
        else if (listItem) {
            if (!inList) {
                out.push("<ul>");
                inList = true;
            }
            out.push(`<li>${inline(listItem[1])}</li>`);
        }
        else if (line.trim()) {
            out.push(`<p>${inline(line)}</p>`);
        }
    }
    if (inList)
        out.push("</ul>");
    return out.join("");
}
/** Render markdown to HTML, using marked.js if available */
function renderMarkdown(src) {
    const div = document.createElement("div");
    div.innerHTML =
        typeof marked !== "undefined" ? marked.parse(src || "") : miniMd(src);
    div.querySelectorAll("a").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener";
    });
    return div.innerHTML;
}
//# sourceMappingURL=markdown.js.map

// ── theme.js ──
/* ── Theme Engine — light/dark/midnight + system pref ── */
const THEMES = {
    dark: {
        bg: "#0a0a0f", bg2: "#12121a",
        surface: "rgba(255,255,255,0.04)", surfaceHover: "rgba(255,255,255,0.07)",
        border: "rgba(255,255,255,0.08)", borderHi: "rgba(255,255,255,0.15)",
        text: "#e8e8ed", text2: "#9898a8", text3: "#68687a",
        accent: "#6c5ce7", accent2: "#a29bfe", accentGlow: "rgba(108,92,231,0.25)",
        green: "#00cec9", amber: "#fdcb6e", red: "#ff6b6b",
        cardBg: "rgba(255,255,255,0.04)", headerBg: "rgba(10,10,15,0.7)",
    },
    light: {
        bg: "#f0f2f5", bg2: "#ffffff",
        surface: "rgba(0,0,0,0.03)", surfaceHover: "rgba(0,0,0,0.06)",
        border: "rgba(0,0,0,0.1)", borderHi: "rgba(0,0,0,0.18)",
        text: "#1a1a2e", text2: "#4a4a5c", text3: "#8888a0",
        accent: "#5b4cdb", accent2: "#7c6ef7", accentGlow: "rgba(91,76,219,0.2)",
        green: "#00a89e", amber: "#e6a817", red: "#e84d4d",
        cardBg: "rgba(255,255,255,0.85)", headerBg: "rgba(240,242,245,0.85)",
    },
    midnight: {
        bg: "#050510", bg2: "#0a0a1a",
        surface: "rgba(100,100,255,0.04)", surfaceHover: "rgba(100,100,255,0.08)",
        border: "rgba(100,100,255,0.1)", borderHi: "rgba(100,100,255,0.2)",
        text: "#d0d0f0", text2: "#8080b0", text3: "#505078",
        accent: "#8b5cf6", accent2: "#c4b5fd", accentGlow: "rgba(139,92,246,0.3)",
        green: "#22d3ee", amber: "#facc15", red: "#fb7185",
        cardBg: "rgba(100,100,255,0.04)", headerBg: "rgba(5,5,16,0.8)",
    },
};
class ThemeEngine {
    current;
    listeners = [];
    constructor() {
        this.current = localStorage.getItem("theme") || this.systemPref();
        this.apply(this.current);
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (!localStorage.getItem("theme"))
                this.apply(this.systemPref());
        });
    }
    systemPref() {
        return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    get theme() { return this.current; }
    cycle() {
        const order = ["dark", "light", "midnight"];
        const next = order[(order.indexOf(this.current) + 1) % order.length];
        this.set(next);
        return next;
    }
    set(name) {
        localStorage.setItem("theme", name);
        this.apply(name);
    }
    apply(name) {
        this.current = name;
        const vars = THEMES[name];
        const root = document.documentElement;
        root.style.setProperty("--bg", vars.bg);
        root.style.setProperty("--bg2", vars.bg2);
        root.style.setProperty("--surface", vars.surface);
        root.style.setProperty("--surface-hover", vars.surfaceHover);
        root.style.setProperty("--border", vars.border);
        root.style.setProperty("--border-hi", vars.borderHi);
        root.style.setProperty("--text", vars.text);
        root.style.setProperty("--text2", vars.text2);
        root.style.setProperty("--text3", vars.text3);
        root.style.setProperty("--accent", vars.accent);
        root.style.setProperty("--accent2", vars.accent2);
        root.style.setProperty("--accent-glow", vars.accentGlow);
        root.style.setProperty("--green", vars.green);
        root.style.setProperty("--amber", vars.amber);
        root.style.setProperty("--red", vars.red);
        root.style.setProperty("--card-bg", vars.cardBg);
        root.style.setProperty("--header-bg", vars.headerBg);
        document.body.dataset.theme = name;
        this.listeners.forEach((fn) => fn(name));
    }
    onChange(fn) { this.listeners.push(fn); }
}
//# sourceMappingURL=theme.js.map

// ── particles.js ──
/* ── Advanced Particle System ─────────────────────────── */
/* Modes: field (drift), constellation (network), vortex  */
class ParticleField {
    canvas;
    ctx;
    particles = [];
    raf = 0;
    mouse = { x: -1000, y: -1000 };
    count = 60;
    connectDist = 140;
    mode = "field";
    time = 0;
    hueBase = 220;
    constructor(container) {
        this.canvas = document.createElement("canvas");
        this.canvas.id = "particles";
        this.canvas.style.cssText =
            "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.35";
        container.prepend(this.canvas);
        this.ctx = this.canvas.getContext("2d");
        this.resize();
        this.spawn();
        window.addEventListener("resize", () => this.resize());
        document.addEventListener("mousemove", (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        this.animate();
    }
    setMode(m) {
        this.mode = m;
        if (m === "constellation") {
            this.count = 40;
            this.connectDist = 200;
        }
        else if (m === "vortex") {
            this.count = 80;
            this.connectDist = 100;
        }
        else {
            this.count = 60;
            this.connectDist = 140;
        }
        this.spawn();
    }
    setHue(h) { this.hueBase = h; }
    setDensity(n) {
        this.count = Math.max(10, Math.min(200, n));
        this.spawn();
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    spawn() {
        this.particles = [];
        for (let i = 0; i < this.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.5 + 0.1;
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: Math.cos(angle) * speed * 0.4,
                vy: Math.sin(angle) * speed * 0.4,
                r: Math.random() * 2.5 + 0.6,
                opacity: Math.random() * 0.5 + 0.15,
                hue: this.hueBase + Math.random() * 60 - 30,
                life: 0,
                maxLife: 600 + Math.random() * 400,
                angle,
                speed,
            });
        }
    }
    animate = () => {
        const { ctx, canvas, particles, mouse } = this;
        this.time++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
            p.life++;
            // Mode-specific movement
            if (this.mode === "vortex") {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const dx = p.x - cx;
                const dy = p.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) + 0.02;
                p.vx = Math.cos(angle) * dist * 0.003;
                p.vy = Math.sin(angle) * dist * 0.003;
                p.vx += (cx + Math.cos(angle) * dist - p.x) * 0.001;
                p.vy += (cy + Math.sin(angle) * dist - p.y) * 0.001;
            }
            else if (this.mode === "constellation") {
                // Gentle drift with slight attraction to center
                p.vx += (canvas.width / 2 - p.x) * 0.00001;
                p.vy += (canvas.height / 2 - p.y) * 0.00001;
            }
            p.x += p.vx;
            p.y += p.vy;
            // Bounds
            if (p.x < -20)
                p.x = canvas.width + 20;
            if (p.x > canvas.width + 20)
                p.x = -20;
            if (p.y < -20)
                p.y = canvas.height + 20;
            if (p.y > canvas.height + 20)
                p.y = -20;
            // Mouse repulsion
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                const force = (150 - dist) / 150;
                p.vx += (dx / dist) * force * 0.2;
                p.vy += (dy / dist) * force * 0.2;
            }
            // Damping
            p.vx *= 0.997;
            p.vy *= 0.997;
            // Fade based on life
            const lifeFade = p.life < 30 ? p.life / 30 :
                p.life > p.maxLife - 30 ? (p.maxLife - p.life) / 30 : 1;
            // Draw particle with glow
            const op = p.opacity * lifeFade;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue + this.time * 0.05}, 70%, 70%, ${op})`;
            ctx.fill();
            // Glow for larger particles
            if (p.r > 1.5) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${op * 0.1})`;
                ctx.fill();
            }
            // Respawn dead particles
            if (p.life >= p.maxLife) {
                p.x = Math.random() * canvas.width;
                p.y = Math.random() * canvas.height;
                p.life = 0;
                p.hue = this.hueBase + Math.random() * 60 - 30;
            }
        }
        // Connection lines
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < this.connectDist) {
                    const alpha = (1 - d / this.connectDist) * 0.15;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    const avgHue = (particles[i].hue + particles[j].hue) / 2;
                    ctx.strokeStyle = `hsla(${avgHue}, 60%, 65%, ${alpha})`;
                    ctx.lineWidth = this.mode === "constellation" ? 0.8 : 0.5;
                    ctx.stroke();
                }
            }
        }
        // Mouse attraction lines (constellation mode)
        if (this.mode === "constellation" && mouse.x > 0) {
            for (const p of particles) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 200) {
                    ctx.beginPath();
                    ctx.moveTo(mouse.x, mouse.y);
                    ctx.lineTo(p.x, p.y);
                    ctx.strokeStyle = `hsla(${this.hueBase}, 80%, 75%, ${(1 - d / 200) * 0.2})`;
                    ctx.lineWidth = 0.4;
                    ctx.stroke();
                }
            }
        }
        this.raf = requestAnimationFrame(this.animate);
    };
    destroy() {
        cancelAnimationFrame(this.raf);
        this.canvas.remove();
    }
}
//# sourceMappingURL=particles.js.map

// ── graph.js ──
/* ── Interactive Citation Graph (SVG bipartite) ──────── */

const CRED_COLORS = {
    user: "#6d9fff",
    high: "#34d399",
    medium: "#fbbf24",
    low: "#f87171",
};
const LABEL_COLORS = {
    supported: "#34d399",
    partial: "#fbbf24",
    unsupported: "#f87171",
    unchecked: "#64748b",
};
function drawGraph(data, container) {
    const S = data.sources;
    const C = data.claims;
    const W = 860;
    const rowS = Math.max(34, Math.min(56, 520 / Math.max(S.length, 1)));
    const rowC = 30;
    const H = Math.max(S.length * rowS, C.length * rowC) + 40;
    const sx = 20, sw = 300, cx = W - 400, cw = 380;
    const sy = (i) => 20 + i * ((H - 40) / Math.max(S.length, 1)) + 8;
    const cy = (i) => 20 + i * ((H - 40) / Math.max(C.length, 1)) + 4;
    const idx = new Map(S.map((s, i) => [s.id, i]));
    let edges = "";
    let nodes = "";
    // Draw edges
    C.forEach((c, j) => c.cites.forEach((id) => {
        const si = idx.get(id);
        if (si === undefined)
            return;
        const y1 = sy(si) + 13, y2 = cy(j) + 11;
        edges += `<path class="e" data-s="${id}" data-c="${c.id}" ` +
            `d="M${sx + sw} ${y1} C ${sx + sw + 120} ${y1}, ${cx - 120} ${y2}, ${cx} ${y2}" ` +
            `stroke="${LABEL_COLORS[c.label] || "#64748b"}"/>`;
    }));
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
    container.querySelectorAll(".n").forEach((g) => {
        g.addEventListener("click", () => {
            container.querySelectorAll(".n").forEach((x) => x.classList.remove("sel"));
            g.classList.add("sel");
            const sid = g.dataset.s;
            const cid = g.dataset.c;
            container.querySelectorAll(".e").forEach((p) => {
                p.classList.toggle("hl", (!!sid && p.dataset.s === sid) || (!!cid && p.dataset.c === cid));
            });
            const detail = document.getElementById("gdetail");
            if (cid) {
                const c = C.find((x) => String(x.id) === cid);
                detail.innerHTML =
                    `<div class="detail"><span class="tag" style="color:${LABEL_COLORS[c.label]}">${c.label}</span> ` +
                        `${esc(c.text)}<div class="usage" style="margin-top:6px">${esc(c.reason || "")} · cites ${c.cites.map((x) => "[" + x + "]").join("")}</div>` +
                        (c.facts || [])
                            .map((f) => `<div class="fact"><span style="color:${f.supported ? "#34d399" : "#f87171"}">${f.supported ? "✔" : "✖"}</span>` +
                            `<div>${esc(f.fact)}${f.quote ? `<span class="quote">"${esc(f.quote)}"${f.source ? " — [" + f.source + "]" : ""}</span>` : ""}</div></div>`)
                            .join("") +
                        "</div>";
            }
            else if (sid) {
                const s = S.find((x) => String(x.id) === sid);
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
//# sourceMappingURL=graph.js.map

// ── api.js ──
/* ── API client for the Research Agent backend ────────── */
const BASE = ""; // same-origin
/** Type-safe SSE event stream */
class ResearchStream {
    es;
    constructor(question, depth, fileTokens) {
        const params = new URLSearchParams({
            q: question,
            depth,
            files: fileTokens.join(","),
        });
        this.es = new EventSource(`${BASE}/api/research?${params}`);
    }
    on(event, handler) {
        this.es.addEventListener(event, ((ev) => {
            handler(JSON.parse(ev.data));
        }));
        return this;
    }
    onError(handler) {
        this.es.onerror = handler;
        return this;
    }
    close() {
        this.es.close();
    }
}
/** Upload a file to the server */
async function uploadFile(file) {
    const res = await fetch(`${BASE}/api/upload`, {
        method: "POST",
        headers: { "X-Filename": file.name },
        body: file,
    });
    return res.json();
}
/** Fetch report history */
async function fetchHistory() {
    const res = await fetch(`${BASE}/api/history`);
    return res.json();
}
/** Fetch a single saved report by ID */
async function fetchReport(id) {
    const res = await fetch(`${BASE}/api/report?id=${encodeURIComponent(id)}`);
    return res.json();
}
/** Ask a follow-up question about a report */
async function askFollowUp(reportId, question, history) {
    const res = await fetch(`${BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, question, history }),
    });
    return res.json();
}
//# sourceMappingURL=api.js.map

// ── commands.js ──
/* ── Command Palette (Ctrl+K) + Toast notifications ──── */

const TOAST_ICONS = {
    info: "💡", success: "✅", warn: "⚠️", error: "❌",
};
let toastContainer = null;
function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.className = "toast-container";
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}
function toast(message, kind = "info", duration = 4000) {
    const c = ensureToastContainer();
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[kind]}</span><span>${esc(message)}</span>`;
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.add("toast-in"));
    setTimeout(() => {
        el.classList.add("toast-out");
        el.addEventListener("animationend", () => el.remove());
    }, duration);
}
let overlay = null;
let registered = [];
let isOpen = false;
function registerCommands(cmds) {
    registered = [...registered, ...cmds];
}
function openPalette() {
    if (isOpen) {
        closePalette();
        return;
    }
    isOpen = true;
    overlay = document.createElement("div");
    overlay.className = "cmd-overlay";
    overlay.innerHTML = `
    <div class="cmd-palette">
      <div class="cmd-header">
        <input class="cmd-input" type="text" placeholder="Type a command…" autofocus>
        <kbd class="cmd-esc">ESC</kbd>
      </div>
      <div class="cmd-list"></div>
    </div>
  `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector(".cmd-input");
    const list = overlay.querySelector(".cmd-list");
    let selected = 0;
    function render(filter) {
        const q = filter.toLowerCase();
        const filtered = registered.filter((c) => c.label.toLowerCase().includes(q) ||
            (c.category || "").toLowerCase().includes(q));
        list.innerHTML = filtered.length
            ? filtered
                .map((c, i) => `<div class="cmd-item${i === selected ? " cmd-sel" : ""}" data-idx="${i}">` +
                `<span class="cmd-icon">${c.icon}</span>` +
                `<div class="cmd-text"><span class="cmd-label">${esc(c.label)}</span>` +
                (c.category ? `<span class="cmd-cat">${esc(c.category)}</span>` : "") +
                `</div>` +
                (c.shortcut ? `<kbd class="cmd-key">${esc(c.shortcut)}</kbd>` : "") +
                `</div>`)
                .join("")
            : '<div class="cmd-empty">No matching commands</div>';
        // Click handlers
        list.querySelectorAll(".cmd-item").forEach((el) => {
            el.addEventListener("click", () => {
                const idx = parseInt(el.dataset.idx || "0");
                filtered[idx]?.action();
                closePalette();
            });
        });
    }
    render("");
    input.addEventListener("input", () => {
        selected = 0;
        render(input.value);
    });
    input.addEventListener("keydown", (e) => {
        const items = list.querySelectorAll(".cmd-item");
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selected = Math.min(selected + 1, items.length - 1);
            render(input.value);
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            selected = Math.max(selected - 1, 0);
            render(input.value);
        }
        if (e.key === "Enter") {
            e.preventDefault();
            const sel = items[selected];
            sel?.click();
        }
        if (e.key === "Escape")
            closePalette();
    });
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay)
            closePalette();
    });
    setTimeout(() => input.focus(), 50);
}
function closePalette() {
    isOpen = false;
    overlay?.remove();
    overlay = null;
}
function initCommandPalette() {
    document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault();
            openPalette();
        }
    });
}
//# sourceMappingURL=commands.js.map

// ── inspector.js ──
/* ── Source Inspector — expandable source detail panel ── */

function renderInspector(data, container) {
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

// ── timeline.js ──
/* ── Research Timeline — real-time process visualization ─ */

class ResearchTimeline {
    entries = [];
    container;
    startTime;
    el = null;
    constructor(container) {
        this.container = container;
        this.startTime = Date.now();
    }
    add(stage, icon, label, detail) {
        const now = Date.now();
        // Set duration on previous entry
        if (this.entries.length > 0) {
            const prev = this.entries[this.entries.length - 1];
            prev.duration = now - prev.time;
        }
        this.entries.push({ time: now, stage, icon, label, detail });
        this.render();
    }
    finish() {
        if (this.entries.length > 0) {
            const last = this.entries[this.entries.length - 1];
            last.duration = Date.now() - last.time;
        }
        this.render();
    }
    reset() {
        this.entries = [];
        this.startTime = Date.now();
        if (this.el)
            this.el.remove();
        this.el = null;
    }
    formatDuration(ms) {
        if (ms < 1000)
            return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    }
    render() {
        if (!this.el) {
            this.el = document.createElement("div");
            this.el.className = "timeline";
            this.container.appendChild(this.el);
        }
        const totalMs = Date.now() - this.startTime;
        this.el.innerHTML = `
      <div class="timeline-header">
        <span class="timeline-title">⏱ Research Timeline</span>
        <span class="timeline-total">${this.formatDuration(totalMs)} elapsed</span>
      </div>
      <div class="timeline-track">
        ${this.entries.map((e, i) => {
            const widthPct = e.duration
                ? Math.max(2, (e.duration / totalMs) * 100)
                : 10;
            return `
            <div class="timeline-segment stage-${esc(e.stage)}" style="flex:${widthPct}" title="${esc(e.label)}${e.duration ? " (" + this.formatDuration(e.duration) + ")" : ""}">
              <div class="timeline-seg-fill${!e.duration ? " timeline-seg-active" : ""}"></div>
            </div>
          `;
        }).join("")}
      </div>
      <div class="timeline-entries">
        ${this.entries.map((e, i) => `
          <div class="timeline-entry${i === this.entries.length - 1 && !e.duration ? " timeline-current" : ""}">
            <div class="timeline-dot stage-dot-${esc(e.stage)}"></div>
            <div class="timeline-entry-content">
              <span class="timeline-icon">${e.icon}</span>
              <span class="timeline-label">${esc(e.label)}</span>
              ${e.duration ? `<span class="timeline-dur">${this.formatDuration(e.duration)}</span>` : '<span class="timeline-dur timeline-running">running…</span>'}
            </div>
          </div>
        `).join("")}
      </div>
    `;
    }
}
//# sourceMappingURL=timeline.js.map

// ── perfmon.js ──
/* ── Performance Monitor Widget ──────────────────────── */
class PerfMonitor {
    el = null;
    raf = 0;
    frames = [];
    lastTime = 0;
    visible = false;
    container;
    eventCount = 0;
    sseLatency = [];
    constructor(container) {
        this.container = container;
    }
    toggle() {
        this.visible = !this.visible;
        if (this.visible)
            this.start();
        else
            this.stop();
    }
    recordEvent() { this.eventCount++; }
    recordLatency(ms) {
        this.sseLatency.push(ms);
        if (this.sseLatency.length > 50)
            this.sseLatency.shift();
    }
    start() {
        if (!this.el) {
            this.el = document.createElement("div");
            this.el.className = "perfmon";
            this.container.appendChild(this.el);
        }
        this.el.classList.remove("hidden");
        this.lastTime = performance.now();
        this.tick();
    }
    stop() {
        cancelAnimationFrame(this.raf);
        this.el?.classList.add("hidden");
    }
    tick = () => {
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        this.frames.push(1000 / delta);
        if (this.frames.length > 60)
            this.frames.shift();
        const avgFps = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
        const avgLatency = this.sseLatency.length
            ? this.sseLatency.reduce((a, b) => a + b, 0) / this.sseLatency.length
            : 0;
        // Mini sparkline
        const spark = this.frames.slice(-30).map((f) => {
            const h = Math.min(20, (f / 60) * 20);
            return `<div class="perfmon-bar" style="height:${h}px"></div>`;
        }).join("");
        if (this.el) {
            this.el.innerHTML = `
        <div class="perfmon-row">
          <span class="perfmon-label">FPS</span>
          <span class="perfmon-val ${avgFps < 30 ? "bad" : avgFps < 50 ? "warn" : "ok"}">${avgFps.toFixed(0)}</span>
        </div>
        <div class="perfmon-spark">${spark}</div>
        <div class="perfmon-row">
          <span class="perfmon-label">SSE events</span>
          <span class="perfmon-val">${this.eventCount}</span>
        </div>
        <div class="perfmon-row">
          <span class="perfmon-label">Avg latency</span>
          <span class="perfmon-val">${avgLatency.toFixed(0)}ms</span>
        </div>
        <div class="perfmon-row">
          <span class="perfmon-label">Memory</span>
          <span class="perfmon-val">${this.getMemory()}</span>
        </div>
      `;
        }
        this.raf = requestAnimationFrame(this.tick);
    };
    getMemory() {
        const perf = performance;
        if (perf.memory) {
            const mb = perf.memory.usedJSHeapSize / 1048576;
            return `${mb.toFixed(1)} MB`;
        }
        return "N/A";
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.el?.remove();
        this.el = null;
    }
}
//# sourceMappingURL=perfmon.js.map

// ── pipeline.js ──
/* ── Animated pipeline progress indicator ─────────────── */
const STAGES = [
    { key: "plan", icon: "🧭", label: "Planning" },
    { key: "search", icon: "🔎", label: "Searching" },
    { key: "read", icon: "📄", label: "Reading" },
    { key: "write", icon: "📝", label: "Writing" },
    { key: "verify", icon: "✅", label: "Verifying" },
    { key: "done", icon: "✨", label: "Complete" },
];
class PipelineIndicator {
    el;
    activeIdx = -1;
    constructor(container) {
        this.el = document.createElement("div");
        this.el.className = "pipeline";
        this.el.innerHTML = STAGES.map((s, i) => `<div class="pipeline-stage" data-stage="${s.key}">` +
            `<div class="pipeline-dot"><span>${s.icon}</span></div>` +
            `<div class="pipeline-label">${s.label}</div>` +
            (i < STAGES.length - 1 ? `<div class="pipeline-connector"></div>` : "") +
            `</div>`).join("");
        container.prepend(this.el);
    }
    setStage(key) {
        const idx = STAGES.findIndex((s) => s.key === key);
        if (idx < 0 || idx <= this.activeIdx)
            return;
        this.activeIdx = idx;
        this.el.querySelectorAll(".pipeline-stage").forEach((el, i) => {
            el.classList.toggle("active", i === idx);
            el.classList.toggle("complete", i < idx);
            el.classList.remove("pending");
            if (i > idx)
                el.classList.add("pending");
        });
    }
    reset() {
        this.activeIdx = -1;
        this.el.querySelectorAll(".pipeline-stage").forEach((el) => {
            el.classList.remove("active", "complete");
            el.classList.add("pending");
        });
    }
    destroy() {
        this.el.remove();
    }
}
//# sourceMappingURL=pipeline.js.map

// ── app.js ──
/* ── Main Application Controller ──────────────────────── */
/* Wires: theme, commands, particles, pipeline, timeline, */
/*        inspector, perf monitor, toasts, graph, chat    */











// ── State ─────────────────────────────────────────────
let current = null;
let chatHistory = [];
let uploads = [];
let liveText = "";
let pipeline = null;
let particles = null;
let activeStream = null;
let theme = null;
let timeline = null;
let perfmon = null;
let sidebarCollapsed = false;
// ── Init ──────────────────────────────────────────────
function init() {
    // Theme engine
    theme = new ThemeEngine();
    // Particles
    particles = new ParticleField(document.body);
    // Performance monitor
    perfmon = new PerfMonitor(document.body);
    // UI
    initTabs();
    initForm();
    initFileUpload();
    initChat();
    initDownload();
    initExportMenu();
    initSidebarToggle();
    loadHistory();
    addKeyboardShortcuts();
    initCommandPalette();
    registerAllCommands();
    initScrollProgress();
    initResizeHandle();
    // Welcome toast
    toast("Press Ctrl+K for command palette", "info", 3000);
}
// ── Register commands ─────────────────────────────────
function registerAllCommands() {
    registerCommands([
        { id: "search", label: "Focus search", icon: "🔍", shortcut: "/", category: "Navigation",
            action: () => $("q").focus() },
        { id: "theme", label: "Cycle theme", icon: "🎨", shortcut: "T", category: "Appearance",
            action: () => { const t = theme.cycle(); toast(`Theme: ${t}`, "info"); } },
        { id: "particles-field", label: "Particles: Field mode", icon: "✨", category: "Appearance",
            action: () => { particles?.setMode("field"); toast("Particle mode: field", "info"); } },
        { id: "particles-constellation", label: "Particles: Constellation mode", icon: "🌌", category: "Appearance",
            action: () => { particles?.setMode("constellation"); toast("Particle mode: constellation", "info"); } },
        { id: "particles-vortex", label: "Particles: Vortex mode", icon: "🌀", category: "Appearance",
            action: () => { particles?.setMode("vortex"); toast("Particle mode: vortex", "info"); } },
        { id: "perf", label: "Toggle performance monitor", icon: "📊", shortcut: "P", category: "Debug",
            action: () => perfmon?.toggle() },
        { id: "sidebar", label: "Toggle sidebar", icon: "📋", shortcut: "[", category: "Layout",
            action: toggleSidebar },
        { id: "export-md", label: "Export as Markdown", icon: "📝", category: "Export",
            action: () => exportReport("md") },
        { id: "export-json", label: "Export as JSON", icon: "📦", category: "Export",
            action: () => exportReport("json") },
        { id: "export-html", label: "Export as HTML", icon: "🌐", category: "Export",
            action: () => exportReport("html") },
        { id: "fullscreen", label: "Toggle fullscreen", icon: "⛶", shortcut: "F", category: "View",
            action: () => {
                if (document.fullscreenElement)
                    document.exitFullscreen();
                else
                    document.documentElement.requestFullscreen();
            }
        },
        { id: "clear", label: "Clear current report", icon: "🗑", category: "Actions",
            action: clearReport },
        { id: "history", label: "Show research history", icon: "📚", category: "Navigation",
            action: () => { if (sidebarCollapsed)
                toggleSidebar(); } },
        { id: "cmd-palette", label: "Command palette", icon: "⌨", shortcut: "⌘K", category: "Navigation",
            action: () => openPalette() },
    ]);
}
// ── Scroll progress indicator ─────────────────────────
function initScrollProgress() {
    const main = document.querySelector(".main");
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    document.querySelector(".header")?.appendChild(bar);
    main.addEventListener("scroll", () => {
        const el = main;
        const pct = el.scrollTop / (el.scrollHeight - el.clientHeight);
        bar.style.width = `${Math.min(100, pct * 100)}%`;
    });
}
// ── Sidebar toggle ────────────────────────────────────
function initSidebarToggle() {
    const btn = document.createElement("button");
    btn.className = "sidebar-toggle";
    btn.innerHTML = "☰";
    btn.title = "Toggle sidebar";
    btn.addEventListener("click", toggleSidebar);
    document.querySelector(".header")?.appendChild(btn);
}
function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    document.querySelector(".sidebar")?.classList.toggle("collapsed", sidebarCollapsed);
    document.querySelector(".shell")?.classList.toggle("sidebar-hidden", sidebarCollapsed);
}
// ── Resize handle for trace card ──────────────────────
function initResizeHandle() {
    const trace = document.querySelector(".trace-card");
    if (!trace)
        return;
    const handle = document.createElement("div");
    handle.className = "resize-handle";
    trace.appendChild(handle);
    let startY = 0, startH = 0;
    handle.addEventListener("mousedown", (e) => {
        startY = e.clientY;
        startH = trace.offsetHeight;
        const onMove = (ev) => {
            trace.style.maxHeight = `${Math.max(100, startH + ev.clientY - startY)}px`;
        };
        const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    });
}
// ── Keyboard shortcuts ────────────────────────────────
function addKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
        // Don't trigger shortcuts when typing in an input
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
            if (e.key === "Escape")
                e.target.blur();
            return;
        }
        if (e.key === "/") {
            e.preventDefault();
            $("q").focus();
        }
        if (e.key === "t") {
            theme?.cycle();
            toast(`Theme: ${theme.theme}`, "info");
        }
        if (e.key === "p") {
            perfmon?.toggle();
        }
        if (e.key === "[") {
            toggleSidebar();
        }
        if (e.key === "f" && !e.ctrlKey && !e.metaKey) {
            if (document.fullscreenElement)
                document.exitFullscreen();
            else
                document.documentElement.requestFullscreen();
        }
    });
}
// ── Tabs ──────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
        t.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
            const target = t.dataset.t || "report";
            $("report").classList.toggle("hidden", target !== "report");
            $("graph").classList.toggle("hidden", target !== "graph");
            $("inspector").classList.toggle("hidden", target !== "inspector");
            $("timelinePanel").classList.toggle("hidden", target !== "timeline");
            if (target === "graph" && current)
                drawGraph(current, $("graph"));
            if (target === "inspector" && current)
                renderInspector(current, $("inspector"));
        });
    });
}
// ── Trace log ─────────────────────────────────────────
function addTrace(html, type) {
    const log = $("log");
    if (log.classList.contains("empty")) {
        log.innerHTML = "";
        log.classList.remove("empty");
    }
    const div = document.createElement("div");
    div.innerHTML = `<span class="trace-time">${new Date().toLocaleTimeString()}</span> ${html}`;
    if (type)
        div.dataset.type = type;
    div.classList.add("trace-entry");
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    perfmon?.recordEvent();
}
// ── Skeleton loader ───────────────────────────────────
function showSkeleton(el) {
    el.innerHTML = Array.from({ length: 6 }, () => `<div class="skeleton-line" style="width:${40 + Math.random() * 55}%"></div>`).join("");
    el.classList.remove("empty");
}
// ── Clear report ──────────────────────────────────────
function clearReport() {
    current = null;
    chatHistory = [];
    $("report").innerHTML = '<div class="empty">Your research report will appear here</div>';
    $("report").classList.add("empty");
    $("score").innerHTML = "";
    $("log").innerHTML = '<span class="empty">Waiting for a query…</span>';
    $("log").classList.add("empty");
    ["conflictCard", "chatCard", "dl"].forEach((id) => $(id).classList.add("hidden"));
    $("graph").innerHTML = '<div class="empty">Run a research query to see the citation graph</div>';
    toast("Report cleared", "info");
}
// ── Research form ─────────────────────────────────────
function initForm() {
    $("f").addEventListener("submit", (e) => {
        e.preventDefault();
        startResearch();
    });
}
function startResearch() {
    const btn = $("b");
    const input = $("q");
    const question = input.value.trim();
    if (!question) {
        toast("Enter a research question", "warn");
        return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Researching…';
    $("log").innerHTML = "";
    $("score").innerHTML = "";
    $("loadbar").classList.add("active");
    ["conflictCard", "chatCard", "dl", "exportMenu"].forEach((id) => $(id).classList.add("hidden"));
    showSkeleton($("report"));
    // Create pipeline
    if (pipeline)
        pipeline.destroy();
    pipeline = new PipelineIndicator($("log").parentElement);
    // Create timeline
    if (timeline)
        timeline.reset();
    timeline = new ResearchTimeline($("timelinePanel"));
    timeline.add("init", "🚀", "Research started");
    toast(`Researching: "${question.slice(0, 50)}${question.length > 50 ? "…" : ""}"`, "info");
    const depth = $("depth").value;
    const tokens = uploads.map((u) => u.token);
    let lastEventTime = Date.now();
    activeStream = new ResearchStream(question, depth, tokens);
    activeStream
        .on("status", (d) => {
        addTrace("• " + esc(d.message), "status");
        recordLatency();
    })
        .on("plan", (d) => {
        pipeline?.setStage("plan");
        timeline?.add("plan", "🧭", `Planning: ${d.subquestions.length} sub-questions`);
        addTrace('🧭 <b>Plan</b>' +
            (d.time_sensitive ? ' <span class="tag medium">time-sensitive</span>' : "") +
            "<br>" +
            d.subquestions
                .map((s) => `<span class="trace-sub">→ ${esc(s.question)} <span class="tag">${esc(s.source)}</span></span>`)
                .join("<br>"), "plan");
        recordLatency();
    })
        .on("search", (d) => {
        pipeline?.setStage("search");
        timeline?.add("search", "🔎", `Searching: ${d.query}`);
        addTrace(`🔎 ${esc(d.query)} <span class="tag">${esc(d.kind)}</span>`, "search");
        recordLatency();
    })
        .on("source", (d) => {
        pipeline?.setStage("read");
        timeline?.add("read", "📄", `Reading: ${d.title.slice(0, 40)}`);
        addTrace(`📄 [${d.id}] <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a>` +
            `<span class="tag ${esc(d.credibility)}">${esc(d.credibility)}</span>` +
            (d.date ? `<span class="tag">${esc(d.date)}</span>` : ""), "source");
        recordLatency();
    })
        .on("writing", (d) => {
        pipeline?.setStage("write");
        liveText = "";
        timeline?.add("write", "📝", d.phase === "draft" ? "Drafting report" : "Revising report");
        addTrace(d.phase === "draft" ? "📝 Drafting report (live stream)…" : "📝 Streaming revision…", "writing");
        $("report").classList.remove("empty");
        $("report").innerHTML = '<div class="live"></div>';
        recordLatency();
    })
        .on("token", (d) => {
        liveText += d.text;
        const el = $("report").querySelector(".live");
        if (el)
            el.innerHTML = esc(liveText) + '<span class="cursor"></span>';
    })
        .on("budget", (d) => {
        addTrace(`💰 ${esc(d.message)} <span class="tag warn">${fmt(d.used)}/${fmt(d.limit)}</span>`, "budget");
    })
        .on("gaps", (d) => {
        timeline?.add("search", "🕳️", `Filling ${d.queries.length} gap(s)`);
        addTrace("🕳️ Filling gaps: " + d.queries.map(esc).join("; "), "gaps");
    })
        .on("conflicts", (d) => {
        timeline?.add("read", "⚖️", `${d.conflicts.length} source conflict(s)`);
        addTrace("⚖️ Sources disagree on: " +
            d.conflicts.map((c) => `<b>${esc(c.topic)}</b>`).join("; "), "conflicts");
    })
        .on("verify", (d) => {
        pipeline?.setStage("verify");
        timeline?.add("verify", "✅", `Verified ${d.checked}/${d.total} claims`);
        addTrace(`✅ Checked ${d.checked}/${d.total} claims`, "verify");
        recordLatency();
    })
        .on("revise", (d) => {
        timeline?.add("write", "✍️", `Self-correcting ${d.flagged} claims (round ${d.round})`);
        addTrace(`✍️ Self-correcting ${d.flagged} flagged claims <span class="tag">round ${d.round}</span>`, "revise");
    })
        .on("report", (d) => {
        pipeline?.setStage("done");
        timeline?.add("done", "🎉", "Research complete!");
        timeline?.finish();
        showReport(d);
        done();
        loadHistory();
        toast("Research complete!", "success");
    })
        .on("error", (d) => {
        addTrace('<span class="bad">✖ ' + esc(d.message) + "</span>", "error");
        $("report").innerHTML = "";
        $("report").classList.add("empty");
        done();
        toast("Research failed: " + d.message, "error");
    })
        .onError(() => {
        done();
        toast("Connection lost", "error");
    });
    function recordLatency() {
        const now = Date.now();
        perfmon?.recordLatency(now - lastEventTime);
        lastEventTime = now;
    }
    function done() {
        activeStream?.close();
        activeStream = null;
        btn.disabled = false;
        btn.innerHTML = '⚡ Research';
        $("loadbar").classList.remove("active");
    }
}
// ── Show report ───────────────────────────────────────
function showReport(d) {
    current = d;
    chatHistory = [];
    $("chat").innerHTML = "";
    const s = d.score;
    const h = d.history || [];
    const u = d.usage;
    // Precision badge with color
    const precColor = s.citation_precision >= 0.8 ? "ok" : s.citation_precision >= 0.5 ? "warn" : "bad";
    $("score").innerHTML =
        `<div class="score">` +
            `<span class="pill ${precColor}"><span class="pill-icon">◎</span> Precision <b>${pct(s.citation_precision)}</b></span>` +
            `<span class="pill ok"><span class="pill-icon">✓</span> ${s.supported} supported</span>` +
            `<span class="pill warn"><span class="pill-icon">◐</span> ${s.partial} partial</span>` +
            `<span class="pill bad"><span class="pill-icon">✗</span> ${s.unsupported} unsupported</span>` +
            (h.length > 1
                ? `<span class="pill"><span class="pill-icon">↑</span> Draft ${pct(h[0].citation_precision)} → Final ${pct(s.citation_precision)}</span>`
                : "") +
            (s.fact_precision != null
                ? `<span class="pill"><span class="pill-icon">⚛</span> Atomic facts <b>${pct(s.fact_precision)}</b> of ${s.facts}</span>`
                : "") +
            `<span class="pill"><span class="pill-icon">📚</span> ${d.sources.length} sources</span>` +
            (d.time_sensitive
                ? '<span class="pill warn"><span class="pill-icon">⏰</span> time-sensitive</span>'
                : "") +
            `</div>` +
            (u?.calls !== undefined
                ? `<div class="usage">${u.calls} LLM calls · ${u.cached} cached · ${fmt(u.input_tokens + u.output_tokens)} tokens</div>`
                : "");
    $("report").classList.remove("empty");
    $("report").innerHTML = renderMarkdown(d.markdown);
    // Add word count
    const words = d.markdown.split(/\s+/).length;
    $("report").insertAdjacentHTML("beforeend", `<div class="report-meta">${words.toLocaleString()} words · ${d.sources.length} sources · ${d.claims.length} claims</div>`);
    const c = d.conflicts || [];
    $("conflictCard").classList.toggle("hidden", !c.length);
    $("conflicts").innerHTML = c
        .map((x) => `<div class="conflict"><b>${esc(x.topic)}</b><ul>${x.positions.map((p) => `<li>[${p.source}] ${esc(p.says)}</li>`).join("")}</ul>` +
        (x.assessment ? `<em>${esc(x.assessment)}</em>` : "") +
        `</div>`)
        .join("");
    $("chatCard").classList.toggle("hidden", !d.id);
    $("dl").classList.remove("hidden");
    $("exportMenu").classList.remove("hidden");
    // Update inspector & graph if visible
    if (!$("graph").classList.contains("hidden"))
        drawGraph(d, $("graph"));
    if (!$("inspector").classList.contains("hidden"))
        renderInspector(d, $("inspector"));
}
// ── Export options ─────────────────────────────────────
function initExportMenu() {
    $("dl").addEventListener("click", () => exportReport("md"));
    // JSON export
    const jsonBtn = document.getElementById("export-json");
    if (jsonBtn)
        jsonBtn.addEventListener("click", () => exportReport("json"));
    const htmlBtn = document.getElementById("export-html");
    if (htmlBtn)
        htmlBtn.addEventListener("click", () => exportReport("html"));
}
function exportReport(format) {
    if (!current) {
        toast("No report to export", "warn");
        return;
    }
    let blob;
    let ext;
    if (format === "json") {
        blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
        ext = "json";
    }
    else if (format === "html") {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(current.question)}</title>
<style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333}
a{color:#5b4cdb}h1,h2,h3{margin-top:1.5em}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}
pre{background:#f4f4f4;padding:16px;border-radius:8px;overflow-x:auto}blockquote{border-left:3px solid #5b4cdb;padding-left:16px;color:#666}</style>
</head><body><h1>${esc(current.question)}</h1>${renderMarkdown(current.markdown)}
<hr><p><em>Generated by AI Research Agent · ${current.sources.length} sources · Precision: ${pct(current.score.citation_precision)}</em></p></body></html>`;
        blob = new Blob([html], { type: "text/html" });
        ext = "html";
    }
    else {
        blob = new Blob([`# ${current.question}\n\n${current.markdown}\n\n---\n*${current.sources.length} sources · Precision: ${pct(current.score.citation_precision)}*\n`], { type: "text/markdown" });
        ext = "md";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(current.id || "report")}.${ext}`;
    a.click();
    toast(`Exported as .${ext}`, "success");
}
// ── File uploads ──────────────────────────────────────
function initFileUpload() {
    const input = $("files");
    input.addEventListener("change", async () => {
        for (const f of Array.from(input.files || [])) {
            $("filelist").textContent = `Uploading ${f.name}…`;
            try {
                const result = await uploadFile(f);
                if (result.token) {
                    uploads.push(result);
                    toast(`Uploaded: ${f.name}`, "success");
                }
                else {
                    toast(`Upload failed: ${result.error}`, "error");
                }
            }
            catch {
                toast("Upload failed", "error");
            }
        }
        input.value = "";
        renderFileList();
    });
    // Drag and drop
    const card = document.querySelector(".search-card");
    card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.currentTarget.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", async (e) => {
        e.preventDefault();
        card.classList.remove("drag-over");
        const files = e.dataTransfer?.files;
        if (!files)
            return;
        for (const f of Array.from(files)) {
            const result = await uploadFile(f);
            if (result.token) {
                uploads.push(result);
                toast(`Uploaded: ${f.name}`, "success");
            }
        }
        renderFileList();
    });
}
function renderFileList() {
    if (!uploads.length) {
        $("filelist").innerHTML = "";
        return;
    }
    $("filelist").innerHTML =
        "📎 " +
            uploads.map((u) => `<span class="file-chip">${esc(u.name)}</span>`).join("") +
            ' <a href="#" id="clearf" class="file-clear">✕ clear all</a>';
    const cl = document.getElementById("clearf");
    if (cl) {
        cl.addEventListener("click", (e) => {
            e.preventDefault();
            uploads = [];
            renderFileList();
        });
    }
}
// ── Follow-up chat ────────────────────────────────────
function initChat() {
    $("chatform").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!current?.id)
            return;
        const input = $("cq");
        const q = input.value.trim();
        if (!q)
            return;
        input.value = "";
        $("cb").disabled = true;
        $("chat").insertAdjacentHTML("beforeend", `<div class="msg user"><div class="msg-avatar">You</div><div class="msg-content">${esc(q)}</div></div>` +
            `<div class="msg bot empty" id="pending"><div class="msg-avatar">AI</div><div class="msg-content">` +
            `<div class="typing-indicator"><span></span><span></span><span></span></div></div></div>`);
        $("chat").scrollTop = $("chat").scrollHeight;
        try {
            const r = await askFollowUp(current.id, q, chatHistory);
            const p = $("pending");
            p.removeAttribute("id");
            p.classList.remove("empty");
            const content = p.querySelector(".msg-content");
            if (r.error) {
                content.innerHTML = `<span class="bad">${esc(r.error)}</span>`;
            }
            else {
                content.innerHTML =
                    renderMarkdown(r.answer || "") +
                        `<div class="usage" style="margin-top:8px">citation precision ${pct(r.score?.citation_precision)}</div>`;
                chatHistory.push({ role: "user", content: q }, { role: "assistant", content: r.answer || "" });
            }
        }
        catch {
            const p = document.getElementById("pending");
            if (p) {
                const content = p.querySelector(".msg-content");
                if (content)
                    content.textContent = "Request failed";
            }
        }
        $("cb").disabled = false;
        $("chat").scrollTop = $("chat").scrollHeight;
    });
}
// ── Download ──────────────────────────────────────────
function initDownload() {
    // Handled in initExportMenu
}
// ── History sidebar ───────────────────────────────────
async function loadHistory() {
    try {
        const items = await fetchHistory();
        if (!items.length)
            return;
        $("history").classList.remove("empty");
        $("history").innerHTML = items
            .map((i) => `<a class="hist" data-id="${esc(i.id)}">` +
            `<span class="hist-title">${esc(i.question)}</span>` +
            `<div class="hist-meta">` +
            `<small>${i.precision != null ? pct(i.precision) + " precision" : ""}</small>` +
            `</div></a>`)
            .join("");
        document.querySelectorAll(".hist").forEach((a) => {
            a.addEventListener("click", async () => {
                const id = a.dataset.id;
                if (!id)
                    return;
                // Highlight selected
                document.querySelectorAll(".hist").forEach((x) => x.classList.remove("hist-active"));
                a.classList.add("hist-active");
                const d = await fetchReport(id);
                $("log").innerHTML = '<div class="trace-entry">Loaded saved report.</div>';
                $("q").value = d.question;
                showReport(d);
                toast("Loaded: " + d.question.slice(0, 40), "info");
            });
        });
    }
    catch {
        // silently fail — history is optional
    }
}
//# sourceMappingURL=app.js.map

// ── Bootstrap ──
document.addEventListener("DOMContentLoaded", init);
})();
