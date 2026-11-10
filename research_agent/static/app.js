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

// ── particles.js ──
/* ── Animated particle background ─────────────────────── */
class ParticleField {
    canvas;
    ctx;
    particles = [];
    raf = 0;
    mouse = { x: -1000, y: -1000 };
    COUNT = 60;
    CONNECT_DIST = 140;
    constructor(container) {
        this.canvas = document.createElement("canvas");
        this.canvas.style.cssText =
            "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.35";
        container.prepend(this.canvas);
        this.ctx = this.canvas.getContext("2d");
        this.resize();
        this.init();
        window.addEventListener("resize", () => this.resize());
        document.addEventListener("mousemove", (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        this.animate();
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    init() {
        this.particles = [];
        for (let i = 0; i < this.COUNT; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2 + 0.8,
                opacity: Math.random() * 0.5 + 0.15,
                hue: 220 + Math.random() * 40,
            });
        }
    }
    animate = () => {
        const { ctx, canvas, particles, mouse } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width)
                p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height)
                p.vy *= -1;
            // Mouse repulsion
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                const force = (120 - dist) / 120;
                p.vx += (dx / dist) * force * 0.15;
                p.vy += (dy / dist) * force * 0.15;
            }
            // Damping
            p.vx *= 0.998;
            p.vy *= 0.998;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${p.opacity})`;
            ctx.fill();
        }
        // Connection lines
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < this.CONNECT_DIST) {
                    const alpha = (1 - d / this.CONNECT_DIST) * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(109,159,255,${alpha})`;
                    ctx.lineWidth = 0.6;
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






// ── State ─────────────────────────────────────────────
let current = null;
let chatHistory = [];
let uploads = [];
let liveText = "";
let pipeline = null;
let particles = null;
let activeStream = null;
// ── Init ──────────────────────────────────────────────
function init() {
    particles = new ParticleField(document.body);
    initTabs();
    initForm();
    initFileUpload();
    initChat();
    initDownload();
    loadHistory();
    addKeyboardShortcuts();
}
// ── Keyboard shortcuts ────────────────────────────────
function addKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
        if (e.key === "/" && document.activeElement === document.body) {
            e.preventDefault();
            $("q").focus();
        }
        if (e.key === "Escape") {
            $("q").blur();
        }
    });
}
// ── Tabs ──────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
        t.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
            $("report").classList.toggle("hidden", t.dataset.t !== "report");
            $("graph").classList.toggle("hidden", t.dataset.t !== "graph");
            if (t.dataset.t === "graph" && current)
                drawGraph(current, $("graph"));
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
    div.innerHTML = html;
    if (type)
        div.dataset.type = type;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}
// ── Skeleton loader ───────────────────────────────────
function showSkeleton(el) {
    el.innerHTML = Array.from({ length: 4 }, () => `<div class="skeleton-line" style="width:${60 + Math.random() * 35}%"></div>`).join("");
    el.classList.remove("empty");
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
    if (!question)
        return;
    btn.disabled = true;
    $("log").innerHTML = "";
    $("score").innerHTML = "";
    $("loadbar").classList.add("active");
    ["conflictCard", "chatCard", "dl"].forEach((id) => $(id).classList.add("hidden"));
    showSkeleton($("report"));
    // Create pipeline
    if (pipeline)
        pipeline.destroy();
    pipeline = new PipelineIndicator($("log").parentElement);
    const depth = $("depth").value;
    const tokens = uploads.map((u) => u.token);
    activeStream = new ResearchStream(question, depth, tokens);
    activeStream
        .on("status", (d) => addTrace("• " + esc(d.message), "status"))
        .on("plan", (d) => {
        pipeline?.setStage("plan");
        addTrace('🧭 <b>Plan</b>' +
            (d.time_sensitive ? ' <span class="tag medium">time-sensitive</span>' : "") +
            "<br>" +
            d.subquestions
                .map((s) => `<span style="padding-left:12px">→ ${esc(s.question)} <span class="tag">${esc(s.source)}</span></span>`)
                .join("<br>"), "plan");
    })
        .on("search", (d) => {
        pipeline?.setStage("search");
        addTrace(`🔎 ${esc(d.query)} <span class="tag">${esc(d.kind)}</span>`, "search");
    })
        .on("source", (d) => {
        pipeline?.setStage("read");
        addTrace(`📄 [${d.id}] <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a>` +
            `<span class="tag ${esc(d.credibility)}">${esc(d.credibility)}</span>` +
            (d.date ? `<span class="tag">${esc(d.date)}</span>` : ""), "source");
    })
        .on("writing", (d) => {
        pipeline?.setStage("write");
        liveText = "";
        addTrace(d.phase === "draft" ? "📝 Drafting report (live)…" : "📝 Streaming revision…", "writing");
        $("report").classList.remove("empty");
        $("report").innerHTML = '<div class="live"></div>';
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
        .on("gaps", (d) => addTrace("🕳️ Filling gaps: " + d.queries.map(esc).join("; "), "gaps"))
        .on("conflicts", (d) => addTrace("⚖️ Sources disagree on: " +
        d.conflicts.map((c) => `<b>${esc(c.topic)}</b>`).join("; "), "conflicts"))
        .on("verify", (d) => {
        pipeline?.setStage("verify");
        addTrace(`✅ Checked ${d.checked}/${d.total} claims`, "verify");
    })
        .on("revise", (d) => addTrace(`✍️ Self-correcting ${d.flagged} flagged claims <span class="tag">round ${d.round}</span>`, "revise"))
        .on("report", (d) => {
        pipeline?.setStage("done");
        showReport(d);
        done();
        loadHistory();
    })
        .on("error", (d) => {
        addTrace('<span class="bad">✖ ' + esc(d.message) + "</span>", "error");
        $("report").innerHTML = "";
        done();
    })
        .onError(() => done());
    function done() {
        activeStream?.close();
        activeStream = null;
        btn.disabled = false;
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
    $("score").innerHTML =
        `<div class="score">` +
            `<span class="pill"><span class="pill-icon">◎</span> Precision <b>${pct(s.citation_precision)}</b></span>` +
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
    const c = d.conflicts || [];
    $("conflictCard").classList.toggle("hidden", !c.length);
    $("conflicts").innerHTML = c
        .map((x) => `<div class="conflict"><b>${esc(x.topic)}</b><ul>${x.positions.map((p) => `<li>[${p.source}] ${esc(p.says)}</li>`).join("")}</ul>` +
        (x.assessment ? `<em>${esc(x.assessment)}</em>` : "") +
        `</div>`)
        .join("");
    $("chatCard").classList.toggle("hidden", !d.id);
    $("dl").classList.remove("hidden");
    if (!$("graph").classList.contains("hidden"))
        drawGraph(d, $("graph"));
}
// ── File uploads ──────────────────────────────────────
function initFileUpload() {
    const input = $("files");
    input.addEventListener("change", async () => {
        for (const f of Array.from(input.files || [])) {
            $("filelist").textContent = `Uploading ${f.name}…`;
            const result = await uploadFile(f);
            if (result.token) {
                uploads.push(result);
            }
            else {
                $("filelist").textContent = `Error: ${result.error}`;
            }
        }
        input.value = "";
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
            uploads.map((u) => esc(u.name)).join(", ") +
            ' <a href="#" id="clearf">clear</a>';
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
        $("chat").insertAdjacentHTML("beforeend", `<div class="msg user">${esc(q)}</div><div class="msg bot empty" id="pending">` +
            `<div class="typing-indicator"><span></span><span></span><span></span></div></div>`);
        try {
            const r = await askFollowUp(current.id, q, chatHistory);
            const p = $("pending");
            p.removeAttribute("id");
            p.classList.remove("empty");
            if (r.error) {
                p.innerHTML = `<span class="bad">${esc(r.error)}</span>`;
            }
            else {
                p.innerHTML =
                    renderMarkdown(r.answer || "") +
                        `<div class="usage" style="margin-top:8px">citation precision ${pct(r.score?.citation_precision)}</div>`;
                chatHistory.push({ role: "user", content: q }, { role: "assistant", content: r.answer || "" });
            }
        }
        catch {
            const p = document.getElementById("pending");
            if (p)
                p.textContent = "Request failed";
        }
        $("cb").disabled = false;
    });
}
// ── Download ──────────────────────────────────────────
function initDownload() {
    $("dl").addEventListener("click", () => {
        if (!current)
            return;
        const blob = new Blob([`# ${current.question}\n\n${current.markdown}\n`], { type: "text/markdown" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (current.id || "report") + ".md";
        a.click();
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
            `<small>${i.precision != null ? pct(i.precision) + " precision" : ""}</small></a>`)
            .join("");
        document.querySelectorAll(".hist").forEach((a) => {
            a.addEventListener("click", async () => {
                const id = a.dataset.id;
                if (!id)
                    return;
                const d = await fetchReport(id);
                $("log").innerHTML = '<div>Loaded saved report.</div>';
                $("q").value = d.question;
                showReport(d);
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
