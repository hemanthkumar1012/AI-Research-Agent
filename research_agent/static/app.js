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
/* ── Theme Engine — professional light/dark with smooth transitions ── */
const THEMES = {
    light: {
        bg: "#f8fafc", bg2: "#ffffff",
        surface: "rgba(99,102,241,0.03)", surfaceHover: "rgba(99,102,241,0.06)",
        border: "rgba(99,102,241,0.12)", borderHi: "rgba(99,102,241,0.2)",
        text: "#0f172a", text2: "#475569", text3: "#94a3b8",
        accent: "#6366f1", accent2: "#8b5cf6", accentGlow: "rgba(99,102,241,0.1)",
        green: "#10b981", amber: "#f59e0b", red: "#ef4444",
        cardBg: "#ffffff", headerBg: "rgba(255,255,255,0.75)",
    },
    dark: {
        bg: "#0f0f13", bg2: "#1a1a22",
        surface: "rgba(255,255,255,0.04)", surfaceHover: "rgba(255,255,255,0.07)",
        border: "rgba(255,255,255,0.08)", borderHi: "rgba(255,255,255,0.15)",
        text: "#e8e8f0", text2: "#9898a8", text3: "#68687a",
        accent: "#e8e8f0", accent2: "#bbbbcc", accentGlow: "rgba(255,255,255,0.06)",
        green: "#4ade80", amber: "#fbbf24", red: "#f87171",
        cardBg: "rgba(255,255,255,0.04)", headerBg: "rgba(15,15,19,0.85)",
    },
    midnight: {
        bg: "#08081a", bg2: "#0e0e28",
        surface: "rgba(99,102,241,0.04)", surfaceHover: "rgba(99,102,241,0.08)",
        border: "rgba(99,102,241,0.12)", borderHi: "rgba(99,102,241,0.2)",
        text: "#d4d4f8", text2: "#8888b8", text3: "#5555888",
        accent: "#818cf8", accent2: "#a5b4fc", accentGlow: "rgba(99,102,241,0.15)",
        green: "#34d399", amber: "#fbbf24", red: "#fb7185",
        cardBg: "rgba(99,102,241,0.04)", headerBg: "rgba(8,8,26,0.85)",
    },
};
class ThemeEngine {
    current;
    listeners = [];
    constructor() {
        // Default to light for the professional gray/white look
        const stored = localStorage.getItem("theme");
        this.current = stored || "light";
        this.apply(this.current);
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (!localStorage.getItem("theme"))
                this.apply(this.systemPref());
        });
    }
    systemPref() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    get theme() { return this.current; }
    cycle() {
        const order = ["light", "dark", "midnight"];
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
        // Also update the new CSS variable names to match the gray/white design system
        root.style.setProperty("--bg-secondary", name === "light" ? "#f1f5f9" : vars.bg);
        root.style.setProperty("--bg-tertiary", name === "light" ? "#e2e8f0" : vars.surface);
        root.style.setProperty("--surface", vars.surface);
        root.style.setProperty("--surface-raised", vars.cardBg);
        root.style.setProperty("--text-primary", vars.text);
        root.style.setProperty("--text-secondary", vars.text2);
        root.style.setProperty("--text-tertiary", vars.text3);
        root.style.setProperty("--success", vars.green);
        root.style.setProperty("--warning", vars.amber);
        root.style.setProperty("--danger", vars.red);
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

// ── analytics.js ──
/* ── Analytics Dashboard ───────────────────────────────── */
/* Reading time, word stats, source breakdown, depth gauge  */

const WPM = 230; // average reading speed
function computeAnalytics(d) {
    const words = d.markdown.split(/\s+/).filter(Boolean);
    const sentences = d.markdown.split(/[.!?]+/).filter((s) => s.trim().length > 5);
    const wordCount = words.length;
    const credMap = { high: 0, medium: 0, low: 0, user: 0 };
    for (const s of d.sources)
        credMap[s.credibility] = (credMap[s.credibility] || 0) + 1;
    const claimMap = { supported: 0, partial: 0, unsupported: 0, unchecked: 0 };
    for (const c of d.claims)
        claimMap[c.label] = (claimMap[c.label] || 0) + 1;
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
function renderAnalytics(d, container) {
    const a = computeAnalytics(d);
    const barHTML = (items) => {
        const total = items.reduce((s, x) => s + x.count, 0);
        if (!total)
            return '<div class="ana-bar-empty">No data</div>';
        return `<div class="ana-bar">${items
            .map((x) => `<div class="ana-bar-seg" style="width:${(x.count / total) * 100}%;background:${x.color}" title="${x.label}: ${x.count}"></div>`)
            .join("")}</div>
    <div class="ana-bar-legend">${items
            .map((x) => `<span style="color:${x.color}">● ${x.label} (${x.count})</span>`)
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
//# sourceMappingURL=analytics.js.map

// ── heatmap.js ──
/* ── Source Credibility Heatmap ─────────────────────────── */
/* Treemap-style visualization of source trust & citation   */

const CRED_COLORS = {
    high: { bg: "rgba(0,206,201,0.15)", border: "var(--green)" },
    medium: { bg: "rgba(253,203,110,0.15)", border: "var(--amber)" },
    low: { bg: "rgba(255,118,117,0.12)", border: "var(--red)" },
    user: { bg: "rgba(109,159,255,0.12)", border: "#6d9fff" },
};
function renderHeatmap(d, container) {
    // Build claim count per source
    const map = new Map();
    for (const c of d.claims) {
        for (const sid of c.cites) {
            const entry = map.get(sid) || { total: 0, supported: 0 };
            entry.total++;
            if (c.label === "supported")
                entry.supported++;
            map.set(sid, entry);
        }
    }
    const cells = d.sources.map((s) => {
        const m = map.get(s.id) || { total: 0, supported: 0 };
        return {
            source: s,
            claimCount: m.total,
            supportedPct: m.total ? m.supported / m.total : 0,
        };
    }).sort((a, b) => b.claimCount - a.claimCount);
    const maxClaims = Math.max(1, ...cells.map((c) => c.claimCount));
    container.innerHTML = `
    <div class="heatmap">
      <div class="heatmap-header">
        <h3>🗺 Source Credibility Heatmap</h3>
        <span class="heatmap-hint">Size = citations · Color = credibility · Opacity = support rate</span>
      </div>
      <div class="heatmap-grid">
        ${cells.map((c) => {
        const colors = CRED_COLORS[c.source.credibility] || CRED_COLORS.medium;
        const size = 0.5 + (c.claimCount / maxClaims) * 0.5;
        const opacity = 0.4 + c.supportedPct * 0.6;
        return `<div class="heatmap-cell" style="
            flex: ${Math.max(1, Math.round(size * 3))};
            background: ${colors.bg};
            border-color: ${colors.border};
            opacity: ${opacity};
          " title="${esc(c.source.title)} — ${c.claimCount} citations, ${Math.round(c.supportedPct * 100)}% supported">
            <div class="heatmap-cell-id">[${c.source.id}]</div>
            <div class="heatmap-cell-title">${esc(c.source.title.slice(0, 30))}${c.source.title.length > 30 ? "…" : ""}</div>
            <div class="heatmap-cell-stats">
              <span class="heatmap-cred ${c.source.credibility}">${c.source.credibility}</span>
              <span>${c.claimCount} cites</span>
            </div>
          </div>`;
    }).join("")}
      </div>
      <div class="heatmap-legend">
        <span>🟢 High</span>
        <span>🟡 Medium</span>
        <span>🔴 Low</span>
        <span>🔵 User-provided</span>
        <span style="margin-left:auto">Larger = more citations</span>
      </div>
    </div>
  `;
}
//# sourceMappingURL=heatmap.js.map

// ── focus.js ──
/* ── Focus Mode (Distraction-Free Reading) ─────────────── */
/* Hides chrome, centers report, adds reading progress bar  */

let active = false;
let overlay = null;
function toggleFocus() {
    active = !active;
    if (active)
        enterFocus();
    else
        exitFocus();
    return active;
}
function isFocusActive() { return active; }
function enterFocus() {
    overlay = document.createElement("div");
    overlay.className = "focus-overlay";
    // Close button
    const close = document.createElement("button");
    close.className = "focus-close";
    close.innerHTML = "✕ Exit Focus";
    close.addEventListener("click", () => toggleFocus());
    overlay.appendChild(close);
    // Reading progress
    const progress = document.createElement("div");
    progress.className = "focus-progress";
    const bar = document.createElement("div");
    bar.className = "focus-progress-bar";
    progress.appendChild(bar);
    overlay.appendChild(progress);
    // Content wrapper
    const wrap = document.createElement("div");
    wrap.className = "focus-content";
    // Clone report
    const report = $("report");
    wrap.innerHTML = report.innerHTML;
    overlay.appendChild(wrap);
    // Scroll tracking
    wrap.addEventListener("scroll", () => {
        const pct = wrap.scrollTop / (wrap.scrollHeight - wrap.clientHeight);
        bar.style.width = `${Math.min(100, pct * 100)}%`;
    });
    // Keyboard: Escape to close
    const onKey = (e) => {
        if (e.key === "Escape") {
            toggleFocus();
            document.removeEventListener("keydown", onKey);
        }
    };
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    document.body.classList.add("focus-active");
    // Animate in
    requestAnimationFrame(() => overlay?.classList.add("focus-visible"));
}
function exitFocus() {
    if (overlay) {
        overlay.classList.remove("focus-visible");
        setTimeout(() => {
            overlay?.remove();
            overlay = null;
        }, 300);
    }
    document.body.classList.remove("focus-active");
}
//# sourceMappingURL=focus.js.map

// ── confidence.js ──
/* ── AI Confidence Meter ───────────────────────────────── */
/* Animated radial gauge showing overall research confidence */

function renderConfidence(d, container) {
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

// ── autosuggest.js ──
/* ── Auto-Suggest for Search Input ──────────────────────── */
/* Shows suggestion dropdown based on history + templates   */

const TEMPLATES = [
    "What are the latest developments in {topic}?",
    "Compare {A} vs {B}: comprehensive analysis",
    "Explain how {topic} works with real-world examples",
    "What are the pros and cons of {topic}?",
    "Current state of {field} research in 2025",
    "Historical timeline of {topic}",
    "Best practices for {topic}",
    "Impact of {topic} on {industry}",
];
let dropdown = null;
let selectedIdx = -1;
function initAutoSuggest() {
    const input = $("q");
    if (!input)
        return;
    // Create dropdown
    dropdown = document.createElement("div");
    dropdown.className = "suggest-dropdown hidden";
    input.parentElement?.appendChild(dropdown);
    const update = debounce(() => showSuggestions(input.value.trim()), 200);
    input.addEventListener("input", update);
    input.addEventListener("focus", () => {
        if (input.value.trim())
            update();
    });
    // Close on outside click
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-input-wrap")) {
            hideSuggestions();
        }
    });
    // Keyboard nav
    input.addEventListener("keydown", (e) => {
        if (!dropdown || dropdown.classList.contains("hidden"))
            return;
        const items = dropdown.querySelectorAll(".suggest-item");
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
            highlightItem(items);
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIdx = Math.max(selectedIdx - 1, -1);
            highlightItem(items);
        }
        else if (e.key === "Enter" && selectedIdx >= 0) {
            e.preventDefault();
            const sel = items[selectedIdx];
            if (sel) {
                input.value = sel.dataset.value || "";
                hideSuggestions();
            }
        }
        else if (e.key === "Escape") {
            hideSuggestions();
        }
    });
}
function showSuggestions(query) {
    if (!dropdown)
        return;
    selectedIdx = -1;
    const suggestions = [];
    // History-based suggestions
    const histItems = document.querySelectorAll(".hist");
    histItems.forEach((h) => {
        const title = h.querySelector(".hist-title")?.textContent || "";
        if (title.toLowerCase().includes(query.toLowerCase())) {
            suggestions.push({ text: title, kind: "history" });
        }
    });
    // Template suggestions
    if (query.length >= 2) {
        for (const tmpl of TEMPLATES) {
            const filled = tmpl.replace(/\{[^}]+\}/g, query);
            if (!suggestions.some((s) => s.text === filled)) {
                suggestions.push({ text: filled, kind: "template" });
            }
        }
    }
    if (!suggestions.length || !query) {
        hideSuggestions();
        return;
    }
    const shown = suggestions.slice(0, 6);
    dropdown.innerHTML = shown
        .map((s, i) => `<div class="suggest-item" data-value="${esc(s.text)}">
          <span class="suggest-icon">${s.kind === "history" ? "🕐" : "💡"}</span>
          <span class="suggest-text">${highlightMatch(s.text, query)}</span>
          <span class="suggest-kind">${s.kind}</span>
        </div>`)
        .join("");
    dropdown.classList.remove("hidden");
    // Click to select
    dropdown.querySelectorAll(".suggest-item").forEach((item) => {
        item.addEventListener("click", () => {
            $("q").value = item.dataset.value || "";
            hideSuggestions();
            $("q").focus();
        });
    });
}
function hideSuggestions() {
    dropdown?.classList.add("hidden");
    selectedIdx = -1;
}
function highlightItem(items) {
    items.forEach((it, i) => it.classList.toggle("suggest-sel", i === selectedIdx));
}
function highlightMatch(text, query) {
    if (!query)
        return esc(text);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0)
        return esc(text);
    return (esc(text.slice(0, idx)) +
        `<mark>${esc(text.slice(idx, idx + query.length))}</mark>` +
        esc(text.slice(idx + query.length)));
}
//# sourceMappingURL=autosuggest.js.map

// ── accessibility.js ──
/* ── Accessibility Enhancements ─────────────────────────── */
/* ARIA labels, focus traps, reduced motion, screen reader  */
function initAccessibility() {
    addAriaLabels();
    addSkipLink();
    setupReducedMotion();
    addLiveRegion();
    setupFocusVisible();
}
function addAriaLabels() {
    const pairs = [
        ["q", "role", "searchbox"],
        ["q", "aria-label", "Research question input"],
        ["f", "role", "search"],
        ["history", "role", "navigation"],
        ["history", "aria-label", "Research history"],
        ["report", "role", "article"],
        ["report", "aria-label", "Research report"],
        ["log", "role", "log"],
        ["log", "aria-label", "Research trace log"],
        ["chat", "role", "log"],
        ["chat", "aria-label", "Follow-up conversation"],
    ];
    for (const [id, attr, val] of pairs) {
        const el = document.getElementById(id);
        if (el)
            el.setAttribute(attr, val);
    }
    // Tab buttons
    document.querySelectorAll(".tab").forEach((t) => {
        t.setAttribute("role", "tab");
        t.setAttribute("aria-selected", t.classList.contains("on") ? "true" : "false");
    });
    document.querySelector(".tabs")?.setAttribute("role", "tablist");
}
function addSkipLink() {
    const link = document.createElement("a");
    link.href = "#q";
    link.className = "skip-link";
    link.textContent = "Skip to search";
    document.body.insertBefore(link, document.body.firstChild);
}
function setupReducedMotion() {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = (matches) => {
        document.body.classList.toggle("reduced-motion", matches);
    };
    apply(mq.matches);
    mq.addEventListener("change", (e) => apply(e.matches));
}
function addLiveRegion() {
    // Screen reader announcements for dynamic content
    const region = document.createElement("div");
    region.id = "sr-announce";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    document.body.appendChild(region);
}
function announce(message) {
    const region = document.getElementById("sr-announce");
    if (region) {
        region.textContent = "";
        requestAnimationFrame(() => { region.textContent = message; });
    }
}
function setupFocusVisible() {
    // Show focus rings only for keyboard navigation
    let usingKeyboard = false;
    document.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            usingKeyboard = true;
            document.body.classList.add("keyboard-nav");
        }
    });
    document.addEventListener("mousedown", () => {
        usingKeyboard = false;
        document.body.classList.remove("keyboard-nav");
    });
}
//# sourceMappingURL=accessibility.js.map

// ── wordcloud.js ──
/* ── Word Cloud Visualizer ──────────────────────────────── */
/* Extracts key terms from report and renders an interactive  */
/* word cloud with hover highlights and click-to-search       */

const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did", "will", "would", "could", "should", "may", "might",
    "shall", "can", "that", "this", "these", "those", "it", "its", "not", "no",
    "than", "into", "about", "also", "such", "more", "most", "very", "just", "only",
    "some", "any", "all", "each", "every", "both", "few", "many", "much", "own",
    "other", "new", "old", "first", "last", "same", "well", "even", "still", "out",
    "up", "one", "two", "three", "our", "we", "they", "their", "them", "which",
    "what", "when", "where", "how", "who", "whom", "whose", "between", "through",
    "during", "before", "after", "above", "below", "while", "however", "although",
    "because", "since", "until", "over", "under", "here", "there", "then", "so",
]);
function extractWords(markdown) {
    const text = markdown
        .replace(/#+\s/g, "")
        .replace(/\[.*?\]\(.*?\)/g, "")
        .replace(/[*_`~]/g, "")
        .replace(/\d+/g, " ");
    const freq = new Map();
    for (const w of text.split(/\s+/)) {
        const lower = w.toLowerCase().replace(/[^a-z'-]/g, "");
        if (lower.length < 3 || STOP_WORDS.has(lower))
            continue;
        freq.set(lower, (freq.get(lower) || 0) + 1);
    }
    const sorted = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60);
    if (!sorted.length)
        return [];
    const maxCount = sorted[0][1];
    const minCount = sorted[sorted.length - 1][1];
    const range = maxCount - minCount || 1;
    return sorted.map(([word, count]) => ({
        word,
        count,
        size: 0.6 + ((count - minCount) / range) * 2.4, // 0.6rem to 3rem
    }));
}
const CLOUD_COLORS = [
    "var(--accent)", "var(--accent2)", "var(--green)", "var(--amber)",
    "#6d9fff", "#a78bfa", "#f472b6", "#34d399",
];
function renderWordCloud(d, container) {
    const words = extractWords(d.markdown);
    if (!words.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">☁</div>
      <div class="empty-title">No Keywords</div>
      <div class="empty-sub">Report too short for word cloud</div></div>`;
        return;
    }
    // Shuffle for visual variety
    for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
    }
    container.innerHTML = `
    <div class="wordcloud">
      <div class="wc-header">
        <h3>☁ Key Terms Word Cloud</h3>
        <span class="wc-count">${words.length} terms extracted</span>
      </div>
      <div class="wc-canvas" role="img" aria-label="Word cloud of key research terms">
        ${words.map((w, i) => {
        const color = CLOUD_COLORS[i % CLOUD_COLORS.length];
        const rotation = (Math.random() - 0.5) * 20;
        return `<span class="wc-word" style="
            font-size: ${w.size}rem;
            color: ${color};
            transform: rotate(${rotation}deg);
            opacity: ${0.6 + (w.size / 3) * 0.4};
          " data-word="${esc(w.word)}" data-count="${w.count}"
            title="${w.word} (${w.count} occurrences)">${esc(w.word)}</span>`;
    }).join("")}
      </div>
      <div class="wc-legend">Click a word to search · Size = frequency</div>
    </div>
  `;
    // Click to search
    container.querySelectorAll(".wc-word").forEach((el) => {
        el.addEventListener("click", () => {
            const q = document.getElementById("q");
            if (q) {
                q.value = el.dataset.word || "";
                q.focus();
            }
        });
        el.addEventListener("mouseenter", () => el.style.textShadow = `0 0 20px currentColor`);
        el.addEventListener("mouseleave", () => el.style.textShadow = "none");
    });
}
//# sourceMappingURL=wordcloud.js.map

// ── shortcuts.js ──
/* ── Keyboard Shortcut Cheat Sheet ──────────────────────── */
/* Toggleable overlay showing all keyboard shortcuts          */
let overlay = null;
let visible = false;
const GROUPS = [
    {
        title: "Navigation",
        items: [
            { key: "/", label: "Focus search input" },
            { key: "⌘K", label: "Open command palette" },
            { key: "[", label: "Toggle sidebar" },
            { key: "?", label: "Show this cheat sheet" },
        ],
    },
    {
        title: "Appearance",
        items: [
            { key: "T", label: "Cycle theme (dark → light → midnight)" },
            { key: "R", label: "Toggle focus / reading mode" },
            { key: "F", label: "Toggle fullscreen" },
            { key: "P", label: "Toggle performance monitor" },
        ],
    },
    {
        title: "Actions",
        items: [
            { key: "Enter", label: "Submit research question" },
            { key: "Esc", label: "Close overlay / blur input" },
            { key: "↑↓", label: "Navigate suggestions / commands" },
        ],
    },
    {
        title: "Export",
        items: [
            { key: "⌘K → md", label: "Export Markdown" },
            { key: "⌘K → json", label: "Export JSON" },
            { key: "⌘K → html", label: "Export HTML" },
            { key: "⌘K → print", label: "Print report" },
        ],
    },
];
function toggleShortcuts() {
    visible = !visible;
    if (visible)
        showSheet();
    else
        hideSheet();
    return visible;
}
function showSheet() {
    overlay = document.createElement("div");
    overlay.className = "shortcuts-overlay";
    const card = document.createElement("div");
    card.className = "shortcuts-card";
    card.innerHTML = `
    <div class="shortcuts-header">
      <h2>⌨ Keyboard Shortcuts</h2>
      <button class="shortcuts-close">✕</button>
    </div>
    <div class="shortcuts-grid">
      ${GROUPS.map((g) => `
        <div class="shortcuts-group">
          <h3>${g.title}</h3>
          ${g.items.map((i) => `
            <div class="shortcut-row">
              <kbd class="shortcut-key">${i.key}</kbd>
              <span class="shortcut-label">${i.label}</span>
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
    <div class="shortcuts-footer">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</div>
  `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    // Animate in
    requestAnimationFrame(() => overlay?.classList.add("shortcuts-visible"));
    // Close handlers
    overlay.querySelector(".shortcuts-close")?.addEventListener("click", () => toggleShortcuts());
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay)
            toggleShortcuts();
    });
}
function hideSheet() {
    if (overlay) {
        overlay.classList.remove("shortcuts-visible");
        setTimeout(() => { overlay?.remove(); overlay = null; }, 300);
    }
}
//# sourceMappingURL=shortcuts.js.map

// ── share.js ──
/* ── Share Report ───────────────────────────────────────── */
/* Copy shareable link, copy to clipboard, or share via       */
/* Web Share API. Generates a self-contained data URL.        */



function shareReport(d, method) {
    if (method === "copy") {
        copyToClipboard(d);
    }
    else if (method === "link") {
        copyShareLink(d);
    }
    else if (method === "share") {
        webShare(d);
    }
}
async function copyToClipboard(d) {
    const text = `# ${d.question}\n\n${d.markdown}\n\n---\n` +
        `Sources: ${d.sources.length} · Precision: ${pct(d.score.citation_precision)}\n` +
        `Generated by AI Research Agent`;
    try {
        await navigator.clipboard.writeText(text);
        toast("Report copied to clipboard!", "success");
    }
    catch {
        // Fallback
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("Report copied!", "success");
    }
}
function copyShareLink(d) {
    // Generate a self-contained HTML data URI
    const html = buildShareHTML(d);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    // Open in new tab for now (actual link sharing would need a backend)
    window.open(url, "_blank");
    toast("Report opened in new tab", "info");
}
async function webShare(d) {
    if (!navigator.share) {
        toast("Web Share not supported — copied to clipboard instead", "warn");
        copyToClipboard(d);
        return;
    }
    try {
        await navigator.share({
            title: `Research: ${d.question}`,
            text: `AI Research Report: ${d.question}\n\n${d.markdown.slice(0, 200)}…`,
        });
        toast("Shared successfully!", "success");
    }
    catch (e) {
        if (e.name !== "AbortError")
            toast("Share cancelled", "info");
    }
}
function buildShareHTML(d) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Research: ${esc(d.question)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:32px 20px;
  line-height:1.7;color:#e0e0e0;background:#0a0a0f}
h1{font-size:1.8rem;margin-bottom:8px;background:linear-gradient(135deg,#6c5ce7,#00cec9);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.meta{color:#888;font-size:.85rem;margin-bottom:32px;font-family:monospace}
h2{font-size:1.3rem;margin:28px 0 12px;color:#e8e8e8;border-bottom:1px solid #222;padding-bottom:6px}
h3{font-size:1.1rem;margin:20px 0 8px;color:#d0d0d0}
p{margin:12px 0}
a{color:#6c5ce7}
code{background:#161622;padding:2px 6px;border-radius:4px;font-size:.88em}
pre{background:#161622;padding:16px;border-radius:8px;overflow-x:auto;margin:16px 0}
blockquote{border-left:3px solid #6c5ce7;padding-left:16px;color:#999;margin:12px 0}
ul,ol{padding-left:24px;margin:8px 0}
li{margin:4px 0}
.badge{display:inline-block;padding:3px 10px;border-radius:100px;font-size:.78rem;margin:2px}
.badge-ok{background:rgba(0,206,201,0.15);color:#00cec9}
.badge-warn{background:rgba(253,203,110,0.15);color:#fdcb6e}
.badge-bad{background:rgba(255,118,117,0.12);color:#ff7675}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #222;font-size:.78rem;color:#666;font-family:monospace}
</style></head><body>
<h1>${esc(d.question)}</h1>
<div class="meta">
  <span class="badge badge-ok">Precision: ${pct(d.score.citation_precision)}</span>
  <span class="badge">${d.sources.length} sources</span>
  <span class="badge">${d.claims.length} claims</span>
  <span class="badge badge-ok">${d.score.supported} supported</span>
  <span class="badge badge-warn">${d.score.partial} partial</span>
  <span class="badge badge-bad">${d.score.unsupported} unsupported</span>
</div>
${renderMarkdown(d.markdown)}
<div class="footer">Generated by AI Research Agent · ${new Date().toLocaleDateString()}</div>
</body></html>`;
}
function initShareButtons() {
    // Will be wired in app.ts
}
//# sourceMappingURL=share.js.map

// ── i18n.js ──
/* ── Internationalization Framework ─────────────────────── */
/* Simple i18n with language detection, localStorage persist  */
const TRANSLATIONS = {
    en: {
        "app.title": "AI Research Agent",
        "app.subtitle": "Multi-source verified research · Citation graphs · Claim verification",
        "search.placeholder": "Ask a research question…",
        "search.button": "⚡ Research",
        "search.depth.standard": "⚡ Standard",
        "search.depth.deep": "🔬 Deep",
        "search.depth.deeper": "🏔 Deeper",
        "search.attach": "📎 Attach files",
        "search.hint": "(or drag & drop)",
        "history.title": "Research History",
        "history.empty": "No past research yet",
        "trace.title": "Research Trace",
        "trace.waiting": "Waiting for a query…",
        "tab.report": "📄 Report",
        "tab.graph": "🕸 Graph",
        "tab.inspector": "🔍 Inspector",
        "tab.timeline": "⏱ Timeline",
        "tab.analytics": "📊 Analytics",
        "tab.heatmap": "🗺 Heatmap",
        "tab.confidence": "🎯 Confidence",
        "tab.wordcloud": "☁ Words",
        "empty.report.title": "Ready to Research",
        "empty.report.sub": "Enter a question above to generate a verified research report",
        "chat.title": "💬 Follow-up Questions",
        "chat.placeholder": "Ask a follow-up…",
        "chat.button": "Ask",
        "export.md": "⬇ Markdown",
        "export.json": "📦 JSON",
        "export.html": "🌐 HTML",
        "toast.researching": "Researching",
        "toast.complete": "Research complete!",
        "toast.error": "Research failed",
        "toast.copied": "Copied to clipboard!",
        "toast.noReport": "No report to export",
    },
    es: {
        "app.title": "Agente de Investigación IA",
        "app.subtitle": "Investigación verificada · Grafos de citación · Verificación de afirmaciones",
        "search.placeholder": "Haz una pregunta de investigación…",
        "search.button": "⚡ Investigar",
        "history.title": "Historial",
        "history.empty": "Sin investigaciones previas",
        "toast.complete": "¡Investigación completa!",
        "toast.copied": "¡Copiado al portapapeles!",
        "empty.report.title": "Listo para Investigar",
        "empty.report.sub": "Ingresa una pregunta para generar un informe verificado",
    },
    fr: {
        "app.title": "Agent de Recherche IA",
        "search.placeholder": "Posez une question de recherche…",
        "search.button": "⚡ Rechercher",
        "history.title": "Historique",
        "toast.complete": "Recherche terminée !",
        "empty.report.title": "Prêt à Rechercher",
    },
    de: {
        "app.title": "KI-Forschungsagent",
        "search.placeholder": "Stellen Sie eine Forschungsfrage…",
        "search.button": "⚡ Forschen",
        "toast.complete": "Forschung abgeschlossen!",
        "empty.report.title": "Bereit zur Forschung",
    },
    ja: {
        "app.title": "AI研究エージェント",
        "search.placeholder": "研究の質問を入力…",
        "search.button": "⚡ 研究",
        "toast.complete": "研究完了！",
        "empty.report.title": "研究準備完了",
    },
    zh: {
        "app.title": "AI研究代理",
        "search.placeholder": "输入研究问题…",
        "search.button": "⚡ 研究",
        "toast.complete": "研究完成！",
        "empty.report.title": "准备就绪",
    },
    hi: {
        "app.title": "AI अनुसंधान एजेंट",
        "search.placeholder": "एक शोध प्रश्न पूछें…",
        "search.button": "⚡ शोध करें",
        "toast.complete": "शोध पूरा!",
    },
    te: {
        "app.title": "AI పరిశోధన ఏజెంట్",
        "search.placeholder": "పరిశోధన ప్రశ్న అడగండి…",
        "search.button": "⚡ పరిశోధన",
        "toast.complete": "పరిశోధన పూర్తయింది!",
    },
};
let currentLang = "en";
function initI18n() {
    // Detect from localStorage, then browser
    const stored = localStorage.getItem("ra-lang");
    if (stored && stored in TRANSLATIONS) {
        currentLang = stored;
    }
    else {
        const browserLang = navigator.language.split("-")[0];
        if (browserLang in TRANSLATIONS)
            currentLang = browserLang;
    }
}
function t(key) {
    return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.en[key] || key;
}
function setLang(lang) {
    currentLang = lang;
    localStorage.setItem("ra-lang", lang);
}
function getLang() { return currentLang; }
function getAvailableLangs() {
    return [
        { code: "en", name: "English" },
        { code: "es", name: "Español" },
        { code: "fr", name: "Français" },
        { code: "de", name: "Deutsch" },
        { code: "ja", name: "日本語" },
        { code: "zh", name: "中文" },
        { code: "hi", name: "हिन्दी" },
        { code: "te", name: "తెలుగు" },
    ];
}
//# sourceMappingURL=i18n.js.map

// ── sourcemap.js ──
/* ── Source Relationship Map (Force-Directed) ──────────── */
/* Interactive SVG graph showing source co-citation links     */
/* Sources that cite the same claims are connected            */
const CRED_COLORS = {
    high: "var(--green)",
    medium: "var(--amber)",
    low: "var(--red)",
    user: "#6d9fff",
};
function renderSourceMap(d, container) {
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
            <circle cx="${n.x}" cy="${n.y}" r="${n.radius}" fill="${CRED_COLORS[n.credibility] || "var(--text3)"}"
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

// ── reading.js ──
/* ── Reading Progress & Estimated Time ─────────────────── */
/* Floating progress indicator with reading time estimate     */

let progressEl = null;
let timerEl = null;
let percentEl = null;
let barEl = null;
let active = false;
let totalWords = 0;
const WPM = 230;
function initReadingProgress() {
    // Create floating indicator
    progressEl = document.createElement("div");
    progressEl.className = "reading-progress-float hidden";
    progressEl.innerHTML = `
    <div class="rpf-bar-wrap"><div class="rpf-bar"></div></div>
    <span class="rpf-percent">0%</span>
    <span class="rpf-divider">·</span>
    <span class="rpf-time">0 min left</span>
  `;
    document.body.appendChild(progressEl);
    barEl = progressEl.querySelector(".rpf-bar");
    percentEl = progressEl.querySelector(".rpf-percent");
    timerEl = progressEl.querySelector(".rpf-time");
    // Listen to scroll
    const main = document.querySelector(".main");
    if (main) {
        main.addEventListener("scroll", () => updateProgress(main));
    }
}
function setReadingContent(wordCount) {
    totalWords = wordCount;
    active = wordCount > 50;
    if (progressEl)
        progressEl.classList.toggle("hidden", !active);
}
function updateProgress(scrollContainer) {
    if (!active || !barEl || !percentEl || !timerEl)
        return;
    const report = $("report");
    if (!report || report.classList.contains("empty")) {
        if (progressEl)
            progressEl.classList.add("hidden");
        return;
    }
    // Calculate how far the report is scrolled
    const rect = report.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const reportTop = rect.top - containerRect.top;
    const reportHeight = rect.height;
    const viewHeight = containerRect.height;
    // Progress: how much of the report has scrolled past top
    let progress = 0;
    if (reportTop >= 0) {
        progress = 0;
    }
    else if (reportTop + reportHeight <= viewHeight) {
        progress = 1;
    }
    else {
        progress = Math.abs(reportTop) / (reportHeight - viewHeight);
    }
    progress = Math.max(0, Math.min(1, progress));
    const pctVal = Math.round(progress * 100);
    const wordsLeft = Math.round(totalWords * (1 - progress));
    const minsLeft = Math.ceil(wordsLeft / WPM);
    barEl.style.width = `${pctVal}%`;
    percentEl.textContent = `${pctVal}%`;
    timerEl.textContent = progress >= 1
        ? "Done ✓"
        : `${minsLeft} min left`;
    if (progressEl) {
        progressEl.classList.toggle("hidden", !active);
        progressEl.classList.toggle("rpf-done", progress >= 1);
    }
}
//# sourceMappingURL=reading.js.map

// ── voice.js ──
/* ── Voice Input ────────────────────────────────────────── */
/* Web Speech API for dictating research questions            */
/* Animated microphone button with live transcript feedback   */


let recognition = null;
let listening = false;
let voiceBtn = null;
function initVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition)
        return; // Browser doesn't support it
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    // Create mic button
    voiceBtn = document.createElement("button");
    voiceBtn.type = "button";
    voiceBtn.className = "voice-btn";
    voiceBtn.innerHTML = '<span class="voice-icon">🎙</span>';
    voiceBtn.title = "Voice input (click to dictate)";
    const wrap = document.querySelector(".search-input-wrap");
    if (wrap)
        wrap.appendChild(voiceBtn);
    voiceBtn.addEventListener("click", toggleVoice);
    recognition.onresult = (event) => {
        const input = $("q");
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        input.value = transcript;
        input.dispatchEvent(new Event("input"));
    };
    recognition.onend = () => {
        listening = false;
        if (voiceBtn) {
            voiceBtn.classList.remove("voice-active");
            voiceBtn.innerHTML = '<span class="voice-icon">🎙</span>';
        }
    };
    recognition.onerror = (event) => {
        listening = false;
        if (voiceBtn) {
            voiceBtn.classList.remove("voice-active");
            voiceBtn.innerHTML = '<span class="voice-icon">🎙</span>';
        }
        if (event.error === "not-allowed") {
            toast("Microphone access denied", "error");
        }
        else if (event.error !== "aborted") {
            toast("Voice input error: " + event.error, "warn");
        }
    };
}
function toggleVoice() {
    if (!recognition)
        return;
    if (listening) {
        recognition.stop();
        listening = false;
        toast("Voice input stopped", "info");
    }
    else {
        try {
            recognition.start();
            listening = true;
            if (voiceBtn) {
                voiceBtn.classList.add("voice-active");
                voiceBtn.innerHTML = '<span class="voice-icon voice-pulse">🔴</span>';
            }
            toast("Listening… speak your question", "info", 2000);
        }
        catch {
            toast("Could not start voice input", "error");
        }
    }
}
function isVoiceSupported() {
    return !!window.SpeechRecognition || !!window.webkitSpeechRecognition;
}
//# sourceMappingURL=voice.js.map

// ── diff.js ──
/* ── Report Comparison / Diff ──────────────────────────── */
/* Side-by-side diff of two research reports                 */
/* Highlights added, removed, and changed sections           */

function computeDiff(a, b) {
    const linesA = a.split("\n");
    const linesB = b.split("\n");
    const result = [];
    // Simple LCS-based diff
    const m = linesA.length;
    const n = linesB.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = linesA[i - 1] === linesB[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    // Backtrack
    let i = m, j = n;
    const ops = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
            ops.push({ type: "same", text: linesA[i - 1] });
            i--;
            j--;
        }
        else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            ops.push({ type: "added", text: linesB[j - 1] });
            j--;
        }
        else {
            ops.push({ type: "removed", text: linesA[i - 1] });
            i--;
        }
    }
    return ops.reverse();
}
function renderDiff(reportA, reportB, container) {
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
let reportHistory = [];
function pushReport(markdown) {
    reportHistory.push(markdown);
    if (reportHistory.length > 10)
        reportHistory.shift();
}
function getReportHistory() {
    return [...reportHistory];
}
function canDiff() {
    return reportHistory.length >= 2;
}
//# sourceMappingURL=diff.js.map

// ── credibility.js ──
/* ── Source Credibility Scoring ────────────────────────── */
/* Visual credibility breakdown per source with badges       */
/* Factors: domain authority, HTTPS, citation count, age     */

const TRUSTED_DOMAINS = [
    "nature.com", "science.org", "ieee.org", "acm.org", "arxiv.org",
    "nih.gov", "who.int", "cdc.gov", "edu", "gov",
    "reuters.com", "apnews.com", "bbc.com", "nytimes.com"
];
function scoreDomain(url) {
    let domain = "";
    try {
        domain = new URL(url).hostname.replace("www.", "");
    }
    catch {
        domain = url;
    }
    const factors = [];
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
function renderCredibilityPanel(sources, container) {
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
//# sourceMappingURL=credibility.js.map

// ── claimgraph.js ──
/* ── Claim Dependency Graph ────────────────────────────── */
/* Interactive SVG graph showing how claims depend on each    */
/* other and which sources back each claim                    */

function renderClaimGraph(claims, allSources, container) {
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

// ── bookmarks.js ──
/* ── Research Session Bookmarks ────────────────────────── */
/* Save and restore research sessions from localStorage      */
/* Includes session naming, tagging, and quick recall         */


const STORAGE_KEY = "ai-research-bookmarks";
function loadBookmarks() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
function saveBookmarks(bookmarks) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    }
    catch { /* quota exceeded */ }
}
function addBookmark(query, report, sourceCount, claimCount, score) {
    const bookmarks = loadBookmarks();
    const preview = report.replace(/[#*_`>]/g, "").slice(0, 150);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    bookmarks.unshift({
        id,
        query,
        title: query.slice(0, 80),
        tags: extractTags(query),
        timestamp: Date.now(),
        reportPreview: preview,
        sourceCount,
        claimCount,
        score
    });
    // Keep max 50
    if (bookmarks.length > 50)
        bookmarks.length = 50;
    saveBookmarks(bookmarks);
    toast("Research bookmarked ★", "info", 2000);
}
function removeBookmark(id) {
    const bookmarks = loadBookmarks().filter(b => b.id !== id);
    saveBookmarks(bookmarks);
}
function extractTags(query) {
    const tags = [];
    const words = query.toLowerCase().split(/\s+/);
    const tagWords = ["ai", "ml", "science", "health", "tech", "finance", "crypto", "climate", "politics", "security", "education", "research"];
    for (const w of words) {
        if (tagWords.includes(w) && !tags.includes(w))
            tags.push(w);
    }
    return tags.slice(0, 3);
}
function renderBookmarksPanel(container, onLoad) {
    const bookmarks = loadBookmarks();
    if (!bookmarks.length) {
        container.innerHTML = `<div class="empty-state"><span class="es-icon">★</span><h3>No Bookmarks</h3><p>Bookmark research sessions for quick recall</p></div>`;
        return;
    }
    let html = `<div class="bm-panel">`;
    html += `<div class="bm-header"><span class="bm-count">${bookmarks.length} saved</span></div>`;
    for (const b of bookmarks) {
        const date = new Date(b.timestamp);
        const ago = formatAgo(date);
        html += `<div class="bm-card" data-id="${b.id}">`;
        html += `<div class="bm-card-top">`;
        html += `<span class="bm-title">${esc(b.title)}</span>`;
        html += `<button class="bm-delete" data-del="${b.id}" title="Remove">✕</button>`;
        html += `</div>`;
        html += `<div class="bm-preview">${esc(b.reportPreview)}…</div>`;
        html += `<div class="bm-meta">`;
        html += `<span class="bm-time">${ago}</span>`;
        html += `<span class="bm-stat">${b.sourceCount} sources</span>`;
        html += `<span class="bm-stat">${b.claimCount} claims</span>`;
        html += `<span class="bm-score">${b.score}/100</span>`;
        html += `</div>`;
        if (b.tags.length) {
            html += `<div class="bm-tags">`;
            for (const t of b.tags)
                html += `<span class="bm-tag">${t}</span>`;
            html += `</div>`;
        }
        html += `<button class="bm-load" data-query="${esc(b.query)}">Load Research →</button>`;
        html += `</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
    // Event delegation
    container.addEventListener("click", (e) => {
        const target = e.target;
        if (target.classList.contains("bm-load")) {
            const query = target.getAttribute("data-query") || "";
            onLoad(query);
        }
        if (target.classList.contains("bm-delete")) {
            const id = target.getAttribute("data-del") || "";
            removeBookmark(id);
            renderBookmarksPanel(container, onLoad);
        }
    });
}
function formatAgo(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30)
        return `${days}d ago`;
    return date.toLocaleDateString();
}
function getBookmarkCount() {
    return loadBookmarks().length;
}
//# sourceMappingURL=bookmarks.js.map

// ── transitions.js ──
/* ── Animated Transitions System ───────────────────────── */
/* Smooth page transitions, panel morphing, and micro-        */
/* animations for all interactive elements                    */
function fadeIn(el, duration = 300) {
    return new Promise(resolve => {
        el.style.opacity = "0";
        el.style.transform = "translateY(8px)";
        el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
        el.offsetHeight; // force reflow
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        setTimeout(resolve, duration);
    });
}
function fadeOut(el, duration = 200) {
    return new Promise(resolve => {
        el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
        el.style.opacity = "0";
        el.style.transform = "translateY(-4px)";
        setTimeout(resolve, duration);
    });
}
function slideIn(el, direction = "left", duration = 300) {
    const transforms = {
        left: "translateX(-20px)",
        right: "translateX(20px)",
        up: "translateY(-20px)",
        down: "translateY(20px)"
    };
    return new Promise(resolve => {
        el.style.opacity = "0";
        el.style.transform = transforms[direction];
        el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms cubic-bezier(0.22,1,0.36,1)`;
        el.offsetHeight;
        el.style.opacity = "1";
        el.style.transform = "translate(0,0)";
        setTimeout(resolve, duration);
    });
}
function scaleIn(el, duration = 250) {
    return new Promise(resolve => {
        el.style.opacity = "0";
        el.style.transform = "scale(0.92)";
        el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms cubic-bezier(0.34,1.56,0.64,1)`;
        el.offsetHeight;
        el.style.opacity = "1";
        el.style.transform = "scale(1)";
        setTimeout(resolve, duration);
    });
}
function morphPanel(from, to, duration = 350) {
    return new Promise(resolve => {
        const fromRect = from.getBoundingClientRect();
        from.style.transition = `opacity ${duration / 2}ms ease, transform ${duration / 2}ms ease`;
        from.style.opacity = "0";
        from.style.transform = "scale(0.96)";
        setTimeout(() => {
            from.style.display = "none";
            to.style.display = "";
            to.style.opacity = "0";
            to.style.transform = "scale(1.02)";
            to.style.transition = `opacity ${duration / 2}ms ease, transform ${duration / 2}ms ease`;
            to.offsetHeight;
            to.style.opacity = "1";
            to.style.transform = "scale(1)";
            setTimeout(resolve, duration / 2);
        }, duration / 2);
    });
}
function staggerChildren(parent, selector, delay = 50) {
    const children = parent.querySelectorAll(selector);
    children.forEach((child, i) => {
        const el = child;
        el.style.opacity = "0";
        el.style.transform = "translateY(10px)";
        el.style.transition = `opacity 300ms ease ${i * delay}ms, transform 300ms ease ${i * delay}ms`;
        requestAnimationFrame(() => {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
        });
    });
}
function pulseElement(el) {
    el.style.transition = "transform 150ms ease";
    el.style.transform = "scale(1.05)";
    setTimeout(() => {
        el.style.transform = "scale(1)";
    }, 150);
}
function shakeElement(el) {
    el.style.animation = "none";
    el.offsetHeight;
    el.style.animation = "shake 0.4s ease";
    setTimeout(() => { el.style.animation = ""; }, 400);
}
// CSS keyframes injected once
let injected = false;
function injectTransitionStyles() {
    if (injected)
        return;
    injected = true;
    const style = document.createElement("style");
    style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-2px); }
      80% { transform: translateX(2px); }
    }
    @keyframes ripple {
      to { transform: scale(2); opacity: 0; }
    }
    .ripple-effect {
      position: absolute;
      border-radius: 50%;
      background: var(--accent);
      opacity: 0.3;
      pointer-events: none;
      animation: ripple 0.5s ease-out forwards;
    }
  `;
    document.head.appendChild(style);
}
function addRipple(el, event) {
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple-effect";
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = (event.clientX - rect.left - size / 2) + "px";
    ripple.style.top = (event.clientY - rect.top - size / 2) + "px";
    el.style.position = "relative";
    el.style.overflow = "hidden";
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
}
//# sourceMappingURL=transitions.js.map

// ── notifications.js ──
/* ── Notification Center ──────────────────────────────── */
/* Collects research events into a dismissable feed panel    */
/* Supports priorities, grouping, and auto-dismiss           */

const notifications = [];
let onUpdate = null;
const ICONS = {
    info: "ℹ️",
    success: "✅",
    warn: "⚠️",
    error: "❌"
};
function notify(title, message, priority = "info") {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    notifications.unshift({
        id,
        title,
        message,
        priority,
        timestamp: Date.now(),
        read: false,
        icon: ICONS[priority]
    });
    // Keep max 100
    if (notifications.length > 100)
        notifications.length = 100;
    if (onUpdate)
        onUpdate();
}
function markRead(id) {
    const n = notifications.find(x => x.id === id);
    if (n)
        n.read = true;
    if (onUpdate)
        onUpdate();
}
function markAllRead() {
    for (const n of notifications)
        n.read = true;
    if (onUpdate)
        onUpdate();
}
function clearNotifications() {
    notifications.length = 0;
    if (onUpdate)
        onUpdate();
}
function getUnreadCount() {
    return notifications.filter(n => !n.read).length;
}
function setNotificationListener(fn) {
    onUpdate = fn;
}
function renderNotificationCenter(container) {
    const unread = getUnreadCount();
    if (!notifications.length) {
        container.innerHTML = `<div class="empty-state"><span class="es-icon">🔔</span><h3>No Notifications</h3><p>Events will appear here during research</p></div>`;
        return;
    }
    let html = `<div class="notif-center">`;
    html += `<div class="notif-toolbar">`;
    html += `<span class="notif-count">${unread} unread</span>`;
    html += `<div class="notif-actions">`;
    html += `<button class="notif-btn notif-mark-all">Mark all read</button>`;
    html += `<button class="notif-btn notif-clear-all">Clear all</button>`;
    html += `</div></div>`;
    html += `<div class="notif-list">`;
    for (const n of notifications) {
        const cls = n.read ? "notif-item notif-read" : "notif-item notif-unread";
        const ago = formatTimeAgo(n.timestamp);
        html += `<div class="${cls} notif-${n.priority}" data-nid="${n.id}">`;
        html += `<span class="notif-icon">${n.icon}</span>`;
        html += `<div class="notif-body">`;
        html += `<div class="notif-title">${esc(n.title)}</div>`;
        html += `<div class="notif-msg">${esc(n.message)}</div>`;
        html += `<div class="notif-time">${ago}</div>`;
        html += `</div></div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
    // Events
    container.querySelector(".notif-mark-all")?.addEventListener("click", () => {
        markAllRead();
        renderNotificationCenter(container);
    });
    container.querySelector(".notif-clear-all")?.addEventListener("click", () => {
        clearNotifications();
        renderNotificationCenter(container);
    });
    container.querySelectorAll(".notif-item").forEach(el => {
        el.addEventListener("click", () => {
            const id = el.getAttribute("data-nid") || "";
            markRead(id);
            renderNotificationCenter(container);
        });
    });
}
function formatTimeAgo(ts) {
    const diff = Date.now() - ts;
    const secs = Math.floor(diff / 1000);
    if (secs < 60)
        return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
}
//# sourceMappingURL=notifications.js.map

// ── print.js ──
/* ── Print-Optimized Layout ────────────────────────────── */
/* Generates a clean, printer-friendly version of reports     */
/* with proper page breaks, headers, and styling              */

function printReport(title, markdown, sources, score) {
    const html = renderMarkdown(markdown);
    const now = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
    });
    const sourceList = sources.map((s, i) => `<li class="print-source">
      <span class="print-src-num">[${i + 1}]</span>
      <span class="print-src-title">${s.title}</span>
      <span class="print-src-url">${s.url}</span>
      <span class="print-src-cred">${s.credibility}%</span>
    </li>`).join("");
    const printDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title} — AI Research Agent</title>
<style>
  @page {
    margin: 2cm 2.5cm;
    @top-right { content: "AI Research Agent"; font-size: 9pt; color: #888; }
    @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #888; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 100%;
  }
  .print-header {
    border-bottom: 2px solid #333;
    padding-bottom: 12pt;
    margin-bottom: 18pt;
  }
  .print-title {
    font-size: 22pt;
    font-weight: 700;
    margin-bottom: 4pt;
    color: #111;
  }
  .print-meta {
    font-size: 9pt;
    color: #666;
    display: flex;
    gap: 16pt;
  }
  .print-score {
    display: inline-block;
    padding: 2pt 8pt;
    border: 1px solid #333;
    border-radius: 3pt;
    font-weight: 700;
  }
  .print-body h1 { font-size: 16pt; margin-top: 18pt; margin-bottom: 8pt; page-break-after: avoid; }
  .print-body h2 { font-size: 14pt; margin-top: 14pt; margin-bottom: 6pt; page-break-after: avoid; }
  .print-body h3 { font-size: 12pt; margin-top: 10pt; margin-bottom: 4pt; page-break-after: avoid; }
  .print-body p { margin-bottom: 8pt; text-align: justify; }
  .print-body ul, .print-body ol { margin: 6pt 0 6pt 20pt; }
  .print-body li { margin-bottom: 3pt; }
  .print-body blockquote {
    border-left: 3pt solid #ccc;
    padding-left: 10pt;
    color: #555;
    margin: 8pt 0;
    font-style: italic;
  }
  .print-body code {
    font-family: "Courier New", monospace;
    font-size: 10pt;
    background: #f0f0f0;
    padding: 1pt 3pt;
    border-radius: 2pt;
  }
  .print-body pre {
    background: #f5f5f5;
    padding: 8pt;
    border: 1px solid #ddd;
    border-radius: 3pt;
    overflow-x: auto;
    margin: 8pt 0;
    page-break-inside: avoid;
  }
  .print-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0;
    page-break-inside: avoid;
  }
  .print-body th, .print-body td {
    border: 1px solid #ccc;
    padding: 4pt 8pt;
    text-align: left;
    font-size: 10pt;
  }
  .print-body th { background: #f0f0f0; font-weight: 700; }
  .print-sources {
    page-break-before: always;
    border-top: 1px solid #333;
    padding-top: 12pt;
  }
  .print-sources h2 { font-size: 14pt; margin-bottom: 10pt; }
  .print-source {
    list-style: none;
    padding: 4pt 0;
    border-bottom: 1px solid #eee;
    font-size: 9pt;
    display: flex;
    gap: 8pt;
    align-items: baseline;
  }
  .print-src-num { font-weight: 700; min-width: 24pt; }
  .print-src-title { flex: 1; }
  .print-src-url { color: #666; word-break: break-all; max-width: 200pt; font-size: 8pt; }
  .print-src-cred { font-weight: 700; }
  .print-footer {
    margin-top: 24pt;
    padding-top: 8pt;
    border-top: 1px solid #ccc;
    font-size: 8pt;
    color: #999;
    text-align: center;
  }
  @media print {
    body { font-size: 11pt; }
    a { color: inherit; text-decoration: none; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="print-header">
    <div class="print-title">${title}</div>
    <div class="print-meta">
      <span>Generated: ${now}</span>
      <span>Quality Score: <span class="print-score">${score}/100</span></span>
      <span>${sources.length} Sources</span>
    </div>
  </div>
  <div class="print-body">${html}</div>
  ${sources.length ? `
  <div class="print-sources">
    <h2>Sources &amp; References</h2>
    <ol>${sourceList}</ol>
  </div>` : ""}
  <div class="print-footer">
    Generated by AI Research Agent — Multi-source automated research with verification
  </div>
  <script>window.print();</script>
</body>
</html>`;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
        printWindow.document.write(printDoc);
        printWindow.document.close();
    }
}
//# sourceMappingURL=print.js.map

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
    // Particles disabled for clean professional look
    // particles = new ParticleField(document.body);
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
    initAutoSuggest();
    initAccessibility();
    initTraceFilter();
    initI18n();
    initReadingProgress();
    initVoiceInput();
    injectTransitionStyles();
    // Notification badge listener
    setNotificationListener(updateNotifBadge);
    // Wire topbar buttons
    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn)
        themeBtn.addEventListener("click", () => { theme?.cycle(); toast(`Theme: ${theme.theme}`, "info"); });
    const focusBtnEl = document.getElementById("focusBtn");
    if (focusBtnEl)
        focusBtnEl.addEventListener("click", () => toggleFocus());
    const shortcutsBtnEl = document.getElementById("shortcutsBtn");
    if (shortcutsBtnEl)
        shortcutsBtnEl.addEventListener("click", () => toggleShortcuts());
    const cmdTriggerEl = document.getElementById("cmdTrigger");
    if (cmdTriggerEl)
        cmdTriggerEl.addEventListener("click", () => openPalette());
    const notifTriggerEl = document.getElementById("notifTrigger");
    if (notifTriggerEl)
        notifTriggerEl.addEventListener("click", () => switchTab("notifications"));
    const sidebarToggleEl = document.getElementById("sidebarToggle");
    if (sidebarToggleEl)
        sidebarToggleEl.addEventListener("click", () => toggleSidebar());
    // Welcome toast
    toast("Press Ctrl+K for command palette · ? for shortcuts", "info", 3000);
}
function updateNotifBadge() {
    const count = getUnreadCount();
    const btn = document.querySelector('[data-t="notifications"]');
    if (btn)
        btn.textContent = count > 0 ? `Alerts (${count})` : "Alerts";
    const dot = document.getElementById("notifDot");
    if (dot)
        dot.classList.toggle("hidden", count === 0);
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
        { id: "focus", label: "Toggle focus mode", icon: "👁", shortcut: "R", category: "View",
            action: () => { const on = toggleFocus(); toast(on ? "Focus mode on" : "Focus mode off", "info"); } },
        { id: "analytics-tab", label: "Show analytics", icon: "📊", category: "Navigation",
            action: () => switchTab("analytics") },
        { id: "heatmap-tab", label: "Show heatmap", icon: "🗺", category: "Navigation",
            action: () => switchTab("heatmap") },
        { id: "confidence-tab", label: "Show confidence meter", icon: "🎯", category: "Navigation",
            action: () => switchTab("confidence") },
        { id: "print", label: "Print report", icon: "🖨", category: "Export",
            action: () => { if (current)
                window.print();
            else
                toast("No report to print", "warn"); } },
        { id: "share-copy", label: "Copy report to clipboard", icon: "📋", category: "Share",
            action: () => { if (current)
                shareReport(current, "copy");
            else
                toast("No report", "warn"); } },
        { id: "share-link", label: "Open report in new tab", icon: "🔗", category: "Share",
            action: () => { if (current)
                shareReport(current, "link");
            else
                toast("No report", "warn"); } },
        { id: "share-web", label: "Share via system share", icon: "📤", category: "Share",
            action: () => { if (current)
                shareReport(current, "share");
            else
                toast("No report", "warn"); } },
        { id: "shortcuts", label: "Keyboard shortcuts", icon: "⌨", shortcut: "?", category: "Help",
            action: () => toggleShortcuts() },
        { id: "wordcloud-tab", label: "Show word cloud", icon: "☁", category: "Navigation",
            action: () => switchTab("wordcloud") },
        { id: "sourcemap-tab", label: "Show source map", icon: "🗺", category: "Navigation",
            action: () => switchTab("sourcemap") },
        { id: "lang-en", label: "Language: English", icon: "🇬🇧", category: "Language",
            action: () => { setLang("en"); toast("Language: English", "info"); } },
        { id: "lang-es", label: "Language: Español", icon: "🇪🇸", category: "Language",
            action: () => { setLang("es"); toast("Idioma: Español", "info"); } },
        { id: "lang-te", label: "Language: తెలుగు", icon: "🇮🇳", category: "Language",
            action: () => { setLang("te"); toast("భాష: తెలుగు", "info"); } },
        { id: "credibility-tab", label: "Show source trust scores", icon: "🛡", category: "Navigation",
            action: () => switchTab("credibility") },
        { id: "claimgraph-tab", label: "Show claim dependencies", icon: "🔗", category: "Navigation",
            action: () => switchTab("claimgraph") },
        { id: "diff-tab", label: "Compare reports", icon: "⇄", category: "Navigation",
            action: () => switchTab("diff") },
        { id: "bookmarks-tab", label: "Show bookmarks", icon: "★", category: "Navigation",
            action: () => switchTab("bookmarks") },
        { id: "notifications-tab", label: "Show notifications", icon: "🔔", category: "Navigation",
            action: () => switchTab("notifications") },
        { id: "bookmark-save", label: "Bookmark this research", icon: "★", category: "Actions",
            action: () => {
                if (current) {
                    const credNum = Math.round((current.score?.citation_precision || 0) * 100);
                    addBookmark(current.question || "Untitled", current.markdown || "", current.sources?.length || 0, current.claims?.length || 0, credNum);
                }
                else
                    toast("No report to bookmark", "warn");
            }
        },
        { id: "print-report", label: "Print-optimized report", icon: "🖨", category: "Export",
            action: () => {
                if (current) {
                    const credSources = current.sources.map(s => ({ url: s.url, title: s.title, credibility: s.credibility === "high" ? 90 : s.credibility === "medium" ? 60 : 30 }));
                    printReport(current.question || "Research Report", current.markdown || "", credSources, Math.round((current.score?.citation_precision || 0) * 100));
                }
                else
                    toast("No report to print", "warn");
            }
        },
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
        if (e.key === "r" && !e.ctrlKey && !e.metaKey) {
            toggleFocus();
        }
        if (e.key === "?") {
            toggleShortcuts();
        }
    });
}
// ── Tabs ──────────────────────────────────────────────
const TAB_IDS = ["report", "graph", "inspector", "timelinePanel", "analyticsPanel", "heatmapPanel", "confidencePanel", "wordcloudPanel", "sourcemapPanel", "credibilityPanel", "claimgraphPanel", "diffPanel", "bookmarksPanel", "notificationsPanel"];
function switchTab(target) {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x.dataset.t === target));
    for (const id of TAB_IDS) {
        const el = document.getElementById(id);
        if (el)
            el.classList.toggle("hidden", !matchTab(id, target));
    }
    if (target === "graph" && current)
        drawGraph(current, $("graph"));
    if (target === "inspector" && current)
        renderInspector(current, $("inspector"));
    if (target === "analytics" && current)
        renderAnalytics(current, $("analyticsPanel"));
    if (target === "heatmap" && current)
        renderHeatmap(current, $("heatmapPanel"));
    if (target === "confidence" && current)
        renderConfidence(current, $("confidencePanel"));
    if (target === "wordcloud" && current)
        renderWordCloud(current, $("wordcloudPanel"));
    if (target === "sourcemap" && current)
        renderSourceMap(current, $("sourcemapPanel"));
    if (target === "credibility" && current) {
        const cs = current.sources.map(s => ({ url: s.url, title: s.title, credibility: s.credibility === "high" ? 90 : s.credibility === "medium" ? 60 : 30 }));
        renderCredibilityPanel(cs, $("credibilityPanel"));
    }
    if (target === "claimgraph" && current) {
        const cl = current.claims.map(c => ({ text: c.text, sources: c.cites.map(id => { const s = current.sources.find(x => x.id === id); return s ? s.title : ""; }).filter(Boolean) }));
        renderClaimGraph(cl, current.sources.map(s => ({ url: s.url, title: s.title })), $("claimgraphPanel"));
    }
    if (target === "diff") {
        const hist = getReportHistory();
        if (hist.length >= 2)
            renderDiff(hist[hist.length - 2], hist[hist.length - 1], $("diffPanel"));
    }
    if (target === "bookmarks")
        renderBookmarksPanel($("bookmarksPanel"), (q) => {
            $("q").value = q;
            $("f").dispatchEvent(new Event("submit", { cancelable: true }));
        });
    if (target === "notifications")
        renderNotificationCenter($("notificationsPanel"));
    announce(`Switched to ${target} tab`);
}
function matchTab(id, target) {
    const map = {
        report: "report", graph: "graph", inspector: "inspector",
        timelinePanel: "timeline", analyticsPanel: "analytics",
        heatmapPanel: "heatmap", confidencePanel: "confidence",
        wordcloudPanel: "wordcloud", sourcemapPanel: "sourcemap",
        credibilityPanel: "credibility", claimgraphPanel: "claimgraph",
        diffPanel: "diff", bookmarksPanel: "bookmarks",
        notificationsPanel: "notifications",
    };
    return map[id] === target;
}
function initTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
        t.addEventListener("click", () => {
            const target = t.dataset.t || "report";
            switchTab(target);
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
    notify("Research Started", `Query: "${question.slice(0, 80)}"`, "info");
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
        notify("Research Failed", d.message, "error");
    })
        .onError(() => {
        done();
        toast("Connection lost", "error");
        notify("Connection Lost", "SSE stream disconnected", "error");
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
    // Update visible panels
    if (!$("graph").classList.contains("hidden"))
        drawGraph(d, $("graph"));
    if (!$("inspector").classList.contains("hidden"))
        renderInspector(d, $("inspector"));
    if (!$("analyticsPanel").classList.contains("hidden"))
        renderAnalytics(d, $("analyticsPanel"));
    if (!$("heatmapPanel").classList.contains("hidden"))
        renderHeatmap(d, $("heatmapPanel"));
    if (!$("confidencePanel").classList.contains("hidden"))
        renderConfidence(d, $("confidencePanel"));
    if (!$("wordcloudPanel").classList.contains("hidden"))
        renderWordCloud(d, $("wordcloudPanel"));
    if (!$("sourcemapPanel").classList.contains("hidden"))
        renderSourceMap(d, $("sourcemapPanel"));
    // Update new panels if visible
    if (!$("credibilityPanel").classList.contains("hidden")) {
        const cs = d.sources.map(s => ({ url: s.url, title: s.title, credibility: s.credibility === "high" ? 90 : s.credibility === "medium" ? 60 : 30 }));
        renderCredibilityPanel(cs, $("credibilityPanel"));
    }
    if (!$("claimgraphPanel").classList.contains("hidden")) {
        const cl = d.claims.map(c => ({ text: c.text, sources: c.cites.map(id => { const src = d.sources.find(x => x.id === id); return src ? src.title : ""; }).filter(Boolean) }));
        renderClaimGraph(cl, d.sources.map(s => ({ url: s.url, title: s.title })), $("claimgraphPanel"));
    }
    // Push to diff history
    pushReport(d.markdown);
    // Notify
    notify("Research Complete", `"${(d.question || "").slice(0, 50)}" — ${d.sources.length} sources, precision ${pct(d.score.citation_precision)}`, "success");
    // Animate report in
    fadeIn($("report"));
    staggerChildren($("score"), ".pill", 60);
    // Reading progress
    setReadingContent(words);
    announce(`Research report loaded: ${d.question}`);
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
// ── Trace filter buttons ─────────────────────────────
function initTraceFilter() {
    document.querySelectorAll(".trace-filter-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const filter = btn.dataset.filter || "all";
            document.querySelectorAll(".trace-filter-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            document.querySelectorAll(".trace-entry").forEach((entry) => {
                if (filter === "all") {
                    entry.style.display = "";
                }
                else {
                    entry.style.display = entry.dataset.type === filter ? "" : "none";
                }
            });
        });
    });
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
