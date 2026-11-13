"use strict";
(() => {

// ── u.js ──
/* ── Verity core: dom, icons, markdown, overlays ───────────────────── */
function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
/** Tiny element builder: h("div.card#x", {onclick}, child, "text") */
function h(spec, attrs, ...kids) {
    const [tagPart] = spec.split(/(?=[.#])/);
    const el = document.createElement(tagPart || "div");
    const classes = spec.match(/\.[\w-]+/g);
    if (classes)
        el.className = classes.map(c => c.slice(1)).join(" ");
    const id = spec.match(/#([\w-]+)/);
    if (id)
        el.id = id[1];
    if (attrs)
        for (const [k, v] of Object.entries(attrs)) {
            if (v === undefined || v === false)
                continue;
            if (k.startsWith("on") && typeof v === "function")
                el.addEventListener(k.slice(2), v);
            else if (k === "html")
                el.innerHTML = String(v);
            else
                el.setAttribute(k, String(v));
        }
    for (const k of kids) {
        if (k === null || k === undefined || k === false)
            continue;
        el.append(typeof k === "string" ? document.createTextNode(k) : k);
    }
    return el;
}
function frag(...kids) {
    const f = document.createDocumentFragment();
    for (const k of kids)
        if (k)
            f.append(typeof k === "string" ? document.createTextNode(k) : k);
    return f;
}
/* ── Icon set (16/18px stroke icons, inherit currentColor) ─────────── */
const PATHS = {
    logo: '<path d="M3 4l5.5 13h2L16 4h-2.6L9.5 13.6 5.7 4z" fill="currentColor" stroke="none"/>',
    search: '<circle cx="8.5" cy="8.5" r="5.5"/><path d="m16 16-3.2-3.2"/>',
    home: '<path d="M3 9.5 10 3l7 6.5V17h-5v-5H8v5H3z"/>',
    folder: '<path d="M2.5 5a1.5 1.5 0 0 1 1.5-1.5h3.6L9.6 5.5H16A1.5 1.5 0 0 1 17.5 7v7.5A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z"/>',
    doc: '<path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11.5 2.5V6H15"/><path d="M7.5 10h5M7.5 13h5"/>',
    book: '<path d="M3.5 4A1.5 1.5 0 0 1 5 2.5h11.5v13H5A1.5 1.5 0 0 0 3.5 17z"/><path d="M3.5 15.5A1.5 1.5 0 0 1 5 14h11.5"/>',
    chart: '<path d="M3 17h14"/><path d="M5.5 13v-3M9.5 13V6M13.5 13V9"/>',
    settings: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.8v2M10 15.2v2M2.8 10h2M15.2 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4"/>',
    help: '<circle cx="10" cy="10" r="7.5"/><path d="M7.8 7.7a2.3 2.3 0 0 1 4.5.7c0 1.5-2.2 1.8-2.2 3.1"/><circle cx="10" cy="14.3" r=".4" fill="currentColor"/>',
    bell: '<path d="M10 3a4.5 4.5 0 0 1 4.5 4.5c0 3.6 1.5 4.8 1.5 4.8H4s1.5-1.2 1.5-4.8A4.5 4.5 0 0 1 10 3z"/><path d="M8.3 15.5a1.8 1.8 0 0 0 3.4 0"/>',
    plus: '<path d="M10 4v12M4 10h12"/>',
    send: '<path d="M3 10 17 3l-3.5 14-4-5.5z"/><path d="M9.5 11.5 17 3"/>',
    globe: '<circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2.5 2.5 2.5 12.5 0 15M10 2.5c-2.5 2.5-2.5 12.5 0 15"/>',
    file: '<path d="M5.5 2.5h6L15 6v11.5h-9.5z"/><path d="M11 2.5V6.5h4"/>',
    image: '<rect x="3" y="4" width="14" height="12" rx="1.5"/><circle cx="7.5" cy="8.5" r="1.3"/><path d="m4 14 4-4 3 3 2.5-2.5L17 14"/>',
    check: '<path d="m4 10.5 4 4L16.5 6"/>',
    x: '<path d="m5 5 10 10M15 5 5 15"/>',
    dots: '<circle cx="4.5" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.3" fill="currentColor" stroke="none"/>',
    external: '<path d="M8.5 5H4.5A1.5 1.5 0 0 0 3 6.5v9A1.5 1.5 0 0 0 4.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-4"/><path d="M11 3h6v6M17 3l-8 8"/>',
    download: '<path d="M10 3v9.5M6 9l4 4 4-4"/><path d="M3.5 16.5h13"/>',
    share: '<circle cx="14.5" cy="4.5" r="2"/><circle cx="5" cy="10" r="2"/><circle cx="14.5" cy="15.5" r="2"/><path d="m6.8 9 5.9-3.4M6.8 11l5.9 3.4"/>',
    back: '<path d="M12.5 4 6.5 10l6 6"/>',
    upload: '<path d="M10 13V3.5M6 7l4-4 4 4"/><path d="M3.5 16.5h13"/>',
    clock: '<circle cx="10" cy="10" r="7.5"/><path d="M10 5.5V10l3 2"/>',
    spark: '<path d="M10 2.5 11.8 7.6 17 9l-5.2 1.6L10 16l-1.8-5.4L3 9l5.2-1.4z"/>',
    shield: '<path d="M10 2.5 16.5 5v5c0 4.2-2.8 6.6-6.5 7.5C6.3 16.6 3.5 14.2 3.5 10V5z"/><path d="m7.3 10 1.9 1.9 3.5-3.8"/>',
    layers: '<path d="m10 3 7 3.8-7 3.7-7-3.7z"/><path d="m3.5 10.5 6.5 3.5 6.5-3.5M3.5 13.8 10 17.3l6.5-3.5"/>',
    menu: '<path d="M3.5 6h13M3.5 10h13M3.5 14h13"/>',
    collapse: '<path d="M12 4 6 10l6 6"/><path d="M16.5 4v12"/>',
    trash: '<path d="M4 6h12M8 6V4.5h4V6M6 6l.7 10h6.6L14 6"/><path d="M8.5 9v4.5M11.5 9v4.5"/>',
    edit: '<path d="m12.8 3.7 3.5 3.5L7 16.5l-4 .5.5-4z"/>',
    copy: '<rect x="7" y="7" width="9.5" height="9.5" rx="1.5"/><path d="M4.5 13H4a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 4 3h7a1.5 1.5 0 0 1 1.5 1.5V5"/>',
    refresh: '<path d="M16.5 8A6.7 6.7 0 0 0 4.6 5.6L3 7.5M3.5 12a6.7 6.7 0 0 0 11.9 2.4l1.6-1.9"/><path d="M3 3.5v4h4M17 16.5v-4h-4"/>',
    user: '<circle cx="10" cy="6.8" r="3.2"/><path d="M3.8 17a6.4 6.4 0 0 1 12.4 0"/>',
    grid: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>',
    zap: '<path d="M11 2.5 4 11.5h5L9 17.5l7-9h-5z"/>',
    chevd: '<path d="m5.5 7.5 4.5 5 4.5-5"/>',
    link: '<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L9.8 5.2"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1.2-1.2"/>',
    alert: '<path d="M10 3 2.5 16h15z"/><path d="M10 8v4M10 14.6v.2"/>',
    database: '<ellipse cx="10" cy="4.5" rx="6.5" ry="2.3"/><path d="M3.5 4.5v11c0 1.3 2.9 2.3 6.5 2.3s6.5-1 6.5-2.3v-11"/><path d="M3.5 10c0 1.3 2.9 2.3 6.5 2.3s6.5-1 6.5-2.3"/>',
    logout: '<path d="M8 3.5H4.5v13H8"/><path d="M13 6.5 16.5 10 13 13.5M16.5 10h-9"/>',
};
function icon(name, size = 18) {
    const s = h("span.icn");
    s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.doc}</svg>`;
    return s;
}
/* ── Formatting helpers ────────────────────────────────────────────── */
function fmtSize(b) {
    if (b < 1024)
        return b + " B";
    if (b < 1048576)
        return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
}
function timeAgo(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60)
        return "just now";
    if (s < 3600)
        return Math.floor(s / 60) + " min ago";
    if (s < 86400)
        return Math.floor(s / 3600) + " hours ago";
    const d = Math.floor(s / 86400);
    if (d === 1)
        return "yesterday";
    if (d < 7)
        return d + " days ago";
    if (d < 30)
        return Math.floor(d / 7) + " weeks ago";
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtDate(t) {
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function hostOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    }
    catch {
        return url;
    }
}
function debounce(fn, ms) {
    let t = 0;
    return ((...a) => { clearTimeout(t); t = window.setTimeout(() => fn(...a), ms); });
}
/* ── Markdown (safe, minimal, citation-aware) ──────────────────────── */
function md(src) {
    const lines = (src || "").split("\n");
    const out = [];
    let inList = false, inOl = false, para = [];
    const inline = (t) => {
        const x = esc(t)
            .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_m, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`)
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/(^|[\s(·])_([^_\n]+)_(?=[\s).,;:·]|$)/g, "$1<em>$2</em>")
            .replace(/\[(\d{1,2})\]/g, '<sup class="cite" data-cite="$1">[$1]</sup>');
        return x;
    };
    const flushP = () => {
        if (para.length) {
            out.push(`<p>${inline(para.join(" "))}</p>`);
            para = [];
        }
    };
    const closeLists = () => {
        if (inList) {
            out.push("</ul>");
            inList = false;
        }
        if (inOl) {
            out.push("</ol>");
            inOl = false;
        }
    };
    for (const raw of lines) {
        const line = raw.trimEnd();
        const hm = /^(#{1,4})\s+(.*)/.exec(line);
        if (hm) {
            flushP();
            closeLists();
            out.push(`<h${hm[1].length + 1}>${inline(hm[2])}</h${hm[1].length + 1}>`);
            continue;
        }
        if (/^[-*]\s+/.test(line)) {
            flushP();
            if (inOl) {
                out.push("</ol>");
                inOl = false;
            }
            if (!inList) {
                out.push("<ul>");
                inList = true;
            }
            out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
            continue;
        }
        if (/^\d+\.\s+/.test(line)) {
            flushP();
            if (inList) {
                out.push("</ul>");
                inList = false;
            }
            if (!inOl) {
                out.push("<ol>");
                inOl = true;
            }
            out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`);
            continue;
        }
        if (/^>\s?/.test(line)) {
            flushP();
            closeLists();
            out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
            continue;
        }
        if (line === "") {
            flushP();
            closeLists();
            continue;
        }
        para.push(line);
    }
    flushP();
    closeLists();
    return out.join("\n");
}
/* ── Toast (errors + confirmations only) ───────────────────────────── */
let toastWrap = null;
function toast(msg, kind = "success") {
    if (!toastWrap) {
        toastWrap = h("div.v-toasts");
        document.body.append(toastWrap);
    }
    const t = h("div.v-toast." + kind, null, icon(kind === "error" ? "alert" : "check", 16), h("span", null, msg));
    toastWrap.append(t);
    requestAnimationFrame(() => t.classList.add("in"));
    setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 300); }, kind === "error" ? 6000 : 3200);
}
/* ── Modal ─────────────────────────────────────────────────────────── */
function modal(opts) {
    const close = () => { wrap.classList.remove("in"); setTimeout(() => wrap.remove(), 180); document.removeEventListener("keydown", onKey, true); };
    const onKey = (e) => { if (e.key === "Escape") {
        e.stopPropagation();
        close();
    } };
    const card = h("div.v-modal" + (opts.wide ? ".wide" : ""), null, h("div.v-modal-head", null, h("div", null, h("h3", null, opts.title), opts.sub ? h("p.v-modal-sub", null, opts.sub) : null), h("button.v-iconbtn", { onclick: close, "aria-label": "Close" }, icon("x", 16))), h("div.v-modal-body", null, opts.body), opts.footer ? h("div.v-modal-foot", null, opts.footer) : null);
    const wrap = h("div.v-overlay", { onclick: (e) => { if (e.target === wrap)
            close(); } }, card);
    document.body.append(wrap);
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => wrap.classList.add("in"));
    return { close, el: card };
}
function confirmBox(title, text, action, onYes, danger = true) {
    const m = modal({
        title, body: h("p.v-confirm-text", null, text),
        footer: frag(h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"), h("button.v-btn" + (danger ? ".danger" : ".primary"), { onclick: () => { m.close(); onYes(); } }, action)),
    });
}
/* ── Popover menu ──────────────────────────────────────────────────── */
function popMenu(anchor, items) {
    document.querySelectorAll(".v-pop").forEach(p => p.remove());
    const pop = h("div.v-pop");
    for (const it of items) {
        pop.append(h("button.v-pop-item" + (it.danger ? ".danger" : ""), {
            onclick: () => { pop.remove(); it.on(); },
        }, it.icon ? icon(it.icon, 15) : null, h("span", null, it.label)));
    }
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.top = Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 10) + "px";
    pop.style.left = Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 10) + "px";
    const off = (e) => { if (!pop.contains(e.target)) {
        pop.remove();
        document.removeEventListener("click", off, true);
    } };
    setTimeout(() => document.addEventListener("click", off, true), 0);
}
/* ── Empty state ───────────────────────────────────────────────────── */
function emptyState(icn, title, sub, action) {
    return h("div.v-empty", null, h("div.v-empty-icn", null, icon(icn, 26)), h("h3", null, title), h("p", null, sub), action || null);
}
function spinner(label) {
    return h("div.v-loading", null, h("span.v-spin"), label ? h("span", null, label) : null);
}
//# sourceMappingURL=u.js.map

// ── store.js ──
/* ── Verity state: localStorage index + IndexedDB blobs ────────────── */

const LS_KEY = "verity:v1";
function blankWs() {
    return { projects: [], reports: [], docs: [], events: [], notifs: [] };
}
function loadRoot() {
    try {
        const r = JSON.parse(localStorage.getItem(LS_KEY) || "");
        if (r && r.workspaces)
            return r;
    }
    catch { /* fresh */ }
    const wsId = uid();
    return { user: null, workspaces: [{ id: wsId, name: "Personal Workspace", created: Date.now() }], activeWs: wsId, byWs: { [wsId]: blankWs() }, sidebarCollapsed: false };
}
class Store {
    root = loadRoot();
    save() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(this.root));
        }
        catch { /* quota — metadata only, should not happen */ }
    }
    get ws() {
        if (!this.root.byWs[this.root.activeWs])
            this.root.byWs[this.root.activeWs] = blankWs();
        return this.root.byWs[this.root.activeWs];
    }
    get wsMeta() {
        return this.root.workspaces.find(w => w.id === this.root.activeWs) || this.root.workspaces[0];
    }
    /* auth */
    signIn(name, email) { this.root.user = { name, email }; this.save(); }
    signOut() { this.root.user = null; this.save(); }
    /* workspaces */
    addWorkspace(name) {
        const w = { id: uid(), name, created: Date.now() };
        this.root.workspaces.push(w);
        this.root.byWs[w.id] = blankWs();
        this.root.activeWs = w.id;
        this.save();
    }
    switchWorkspace(id) { this.root.activeWs = id; this.save(); }
    renameWorkspace(id, name) {
        const w = this.root.workspaces.find(x => x.id === id);
        if (w) {
            w.name = name;
            this.save();
        }
    }
    deleteWorkspace(id) {
        if (this.root.workspaces.length < 2)
            return false;
        this.root.workspaces = this.root.workspaces.filter(w => w.id !== id);
        delete this.root.byWs[id];
        if (this.root.activeWs === id)
            this.root.activeWs = this.root.workspaces[0].id;
        this.save();
        return true;
    }
    /* projects */
    addProject(name) {
        const p = { id: uid(), name, created: Date.now(), updated: Date.now() };
        this.ws.projects.unshift(p);
        this.save();
        return p;
    }
    project(id) { return this.ws.projects.find(p => p.id === id); }
    renameProject(id, name) {
        const p = this.project(id);
        if (p) {
            p.name = name;
            p.updated = Date.now();
            this.save();
        }
    }
    deleteProject(id) {
        this.ws.projects = this.ws.projects.filter(p => p.id !== id);
        for (const r of this.ws.reports)
            if (r.projectId === id)
                delete r.projectId;
        this.save();
    }
    touchProject(id) { const p = this.project(id); if (p) {
        p.updated = Date.now();
        this.save();
    } }
    reportsIn(projectId) { return this.ws.reports.filter(r => r.projectId === projectId); }
    /* reports */
    addReport(m) { this.ws.reports.unshift(m); this.save(); }
    reportMeta(id) { return this.ws.reports.find(r => r.id === id); }
    assignReport(id, projectId) {
        const r = this.reportMeta(id);
        if (!r)
            return;
        r.projectId = projectId;
        if (projectId)
            this.touchProject(projectId);
        this.save();
    }
    deleteReport(id) {
        this.ws.reports = this.ws.reports.filter(r => r.id !== id);
        this.save();
        void dbDel("reports", id);
    }
    /* knowledge base */
    addDoc(d) { this.ws.docs.unshift(d); this.save(); }
    deleteDoc(id) {
        this.ws.docs = this.ws.docs.filter(d => d.id !== id);
        this.save();
        void dbDel("files", id);
    }
    /* analytics + notifications */
    log(type, n, label) {
        this.ws.events.push({ t: Date.now(), type, n, label });
        if (this.ws.events.length > 3000)
            this.ws.events = this.ws.events.slice(-2500);
        this.save();
    }
    notify(text, reportId) {
        this.ws.notifs.unshift({ t: Date.now(), text, reportId, read: false });
        this.ws.notifs = this.ws.notifs.slice(0, 30);
        this.save();
    }
    markNotifsRead() { for (const n of this.ws.notifs)
        n.read = true; this.save(); }
}
const ST = new Store();
/* ── IndexedDB for large payloads (full reports, file blobs) ───────── */
let dbp = null;
function db() {
    if (!dbp)
        dbp = new Promise((res, rej) => {
            const req = indexedDB.open("verity-db", 1);
            req.onupgradeneeded = () => {
                const d = req.result;
                if (!d.objectStoreNames.contains("reports"))
                    d.createObjectStore("reports");
                if (!d.objectStoreNames.contains("files"))
                    d.createObjectStore("files");
            };
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
    return dbp;
}
function tx(store, mode, fn) {
    return db().then(d => new Promise((res, rej) => {
        const r = fn(d.transaction(store, mode).objectStore(store));
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}
function dbPut(store, key, val) {
    return tx(store, "readwrite", s => s.put(val, key));
}
function dbGet(store, key) {
    return tx(store, "readonly", s => s.get(key));
}
function dbDel(store, key) {
    return tx(store, "readwrite", s => s.delete(key));
}
//# sourceMappingURL=store.js.map

// ── net.js ──
/* ── Verity network: SSE research client + JSON endpoints ──────────── */
/** POST /api/research and parse the SSE stream (works buffered or chunked). */
function runResearch(q, depth, context, on) {
    const ctrl = new AbortController();
    let finished = false;
    const done = (async () => {
        let resp;
        try {
            resp = await fetch("/api/research", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ q, depth, context }),
                signal: ctrl.signal,
            });
        }
        catch (e) {
            if (!ctrl.signal.aborted)
                on.error("Could not reach the research service. Check your connection and try again.");
            return;
        }
        if (!resp.ok || !resp.body) {
            on.error(resp.status === 504
                ? "The research service timed out. Try a shorter, more specific question."
                : `Research service error (HTTP ${resp.status}).`);
            return;
        }
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        const dispatch = (block) => {
            let ev = "message";
            const datas = [];
            for (const line of block.split("\n")) {
                if (line.startsWith("event:"))
                    ev = line.slice(6).trim();
                else if (line.startsWith("data:"))
                    datas.push(line.slice(5).trim());
            }
            if (!datas.length)
                return;
            let data;
            try {
                data = JSON.parse(datas.join("\n"));
            }
            catch {
                return;
            }
            switch (ev) {
                case "status":
                    on.status(String(data.message || ""));
                    break;
                case "plan":
                    on.plan(data.subquestions || []);
                    break;
                case "search":
                    on.search(String(data.query || ""), String(data.kind || "web"));
                    break;
                case "source":
                    on.source(data);
                    break;
                case "draft":
                    on.draft(String(data.body || ""));
                    break;
                case "report":
                    finished = true;
                    on.report(data);
                    break;
                case "error":
                    finished = true;
                    on.error(String(data.message || "Research failed."));
                    break;
            }
        };
        try {
            for (;;) {
                const { value, done: eof } = await reader.read();
                if (value) {
                    buf += dec.decode(value, { stream: true });
                    let i;
                    while ((i = buf.indexOf("\n\n")) >= 0) {
                        dispatch(buf.slice(0, i));
                        buf = buf.slice(i + 2);
                    }
                }
                if (eof)
                    break;
            }
            if (buf.trim())
                dispatch(buf);
            if (!finished)
                on.error("The research stream ended unexpectedly. Please try again.");
        }
        catch (e) {
            if (!ctrl.signal.aborted && !finished)
                on.error("Connection lost while researching. Please try again.");
        }
    })();
    return { cancel: () => ctrl.abort(), done };
}
/** Follow-up question grounded in a report (sends the report inline). */
async function askFollowup(report, question, history) {
    try {
        const r = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ report, question, history }),
        });
        const j = await r.json();
        if (j.error)
            return { error: String(j.error) };
        return j;
    }
    catch {
        return { error: "Could not reach the server." };
    }
}
async function fetchServerHistory() {
    try {
        const r = await fetch("/api/history");
        const j = await r.json();
        return Array.isArray(j) ? j : [];
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=net.js.map

// ── charts.js ──
/* ── Verity charts: dependency-free SVG ────────────────────────────── */

const NS = "http://www.w3.org/2000/svg";
function sv(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs))
        e.setAttribute(k, String(v));
    return e;
}
/** Area/line chart with x labels, hover dots and tooltip. */
function chArea(values, labels, opts) {
    const W = 720, H = opts?.height ?? 220, PL = 34, PB = 24, PT = 12, PR = 8;
    const max = Math.max(1, ...values);
    const stepX = (W - PL - PR) / Math.max(1, values.length - 1);
    const X = (i) => PL + i * stepX;
    const Y = (v) => PT + (H - PT - PB) * (1 - v / max);
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "v-chart" });
    // grid + y labels
    const ticks = 4;
    const seen = new Set();
    for (let t = 0; t <= ticks; t++) {
        const v = Math.round((max / ticks) * t), y = Y(v);
        svg.append(sv("line", { x1: PL, y1: Y((max / ticks) * t), x2: W - PR, y2: Y((max / ticks) * t), class: "grid" }));
        if (seen.has(v))
            continue;
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
        const defs = sv("defs", {});
        defs.append(grad);
        svg.append(defs);
        svg.append(sv("path", { d: areaD, fill: "url(#vag)", stroke: "none" }));
        svg.append(sv("polyline", { points: pts, class: "line" }));
        values.forEach((v, i) => {
            if (v > 0 || values.length < 40)
                svg.append(sv("circle", { cx: X(i), cy: Y(v), r: 2.6, class: "dot" }));
        });
    }
    // x labels (thin out)
    const every = Math.max(1, Math.ceil(labels.length / 9));
    labels.forEach((l, i) => {
        if (i % every !== 0 && i !== labels.length - 1)
            return;
        const t = sv("text", { x: X(i), y: H - 7, class: "xlab", "text-anchor": "middle" });
        t.textContent = l;
        svg.append(t);
    });
    const wrap = h("div.v-chartwrap");
    const tip = h("div.v-tip");
    wrap.append(svg, tip);
    svg.addEventListener("mousemove", (e) => {
        const r = svg.getBoundingClientRect();
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
function chDonut(parts, center, sub) {
    const total = Math.max(1, parts.reduce((a, p) => a + p.value, 0));
    const R = 52, C = 2 * Math.PI * R;
    const svg = sv("svg", { viewBox: "0 0 140 140", class: "v-donut" });
    let off = C * 0.25;
    svg.append(sv("circle", { cx: 70, cy: 70, r: R, fill: "none", stroke: "var(--line)", "stroke-width": 14 }));
    for (const p of parts) {
        if (!p.value)
            continue;
        const len = (p.value / total) * C;
        svg.append(sv("circle", {
            cx: 70, cy: 70, r: R, fill: "none", stroke: p.color, "stroke-width": 14,
            "stroke-dasharray": `${len} ${C - len}`, "stroke-dashoffset": off, "stroke-linecap": "butt",
        }));
        off -= len;
    }
    const c1 = sv("text", { x: 70, y: 66, class: "dn-c", "text-anchor": "middle" });
    c1.textContent = center;
    const c2 = sv("text", { x: 70, y: 84, class: "dn-s", "text-anchor": "middle" });
    c2.textContent = sub;
    svg.append(c1, c2);
    const legend = h("div.v-legend");
    for (const p of parts)
        legend.append(h("span.v-legend-it", null, h("i", { style: `background:${p.color}` }), `${p.label} (${p.value})`));
    return h("div.v-donutwrap", null, svg, legend);
}
/** Horizontal bars (label, value, max). */
function chBars(rows, unit = "") {
    const max = Math.max(1, ...rows.map(r => r.value));
    const box = h("div.v-bars");
    for (const r of rows) {
        box.append(h("div.v-bar-row", null, h("span.v-bar-label", { title: r.label }, r.label), h("div.v-bar-track", null, h("div.v-bar-fill", { style: `width:${(r.value / max) * 100}%` })), h("span.v-bar-val", null, `${r.value}${unit}${r.hint ? " · " + r.hint : ""}`)));
    }
    return box;
}
//# sourceMappingURL=charts.js.map

// ── landing.js ──
/* ── Landing page + sign-in ────────────────────────────────────────── */


function heroArt() {
    const w = h("div.hero-art");
    w.innerHTML = `
  <svg viewBox="0 0 420 340" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="hg1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#d9f5e2"/><stop offset="100%" stop-color="#7ed9a3"/>
      </linearGradient>
      <linearGradient id="hg2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#eefcf3"/><stop offset="100%" stop-color="#b9ecd0"/>
      </linearGradient>
    </defs>
    <ellipse cx="210" cy="300" rx="150" ry="22" fill="#0f172a" opacity=".06"/>
    <g class="float-b">
      <rect x="90" y="150" width="150" height="110" rx="14" fill="url(#hg1)" opacity=".95"/>
      <rect x="90" y="150" width="150" height="110" rx="14" fill="none" stroke="#2f9e63" stroke-opacity=".35"/>
    </g>
    <g class="float-a">
      <rect x="170" y="70" width="170" height="130" rx="14" fill="url(#hg2)"/>
      <rect x="170" y="70" width="170" height="130" rx="14" fill="none" stroke="#2f9e63" stroke-opacity=".3"/>
      <path d="M190 102h120M190 126h96M190 150h110" stroke="#2f9e63" stroke-width="7" stroke-linecap="round" opacity=".45"/>
    </g>
    <g class="float-c">
      <circle cx="320" cy="238" r="34" fill="#16a34a"/>
      <path d="m306 238 9 9 18-19" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    <circle cx="96" cy="92" r="7" fill="#16a34a" opacity=".5" class="float-c"/>
    <circle cx="368" cy="120" r="5" fill="#16a34a" opacity=".35" class="float-b"/>
  </svg>`;
    return w;
}
const FEATURES = [
    { icn: "layers", t: "Deep Research", d: "Multi-step agent workflow: planning, web search, source analysis and synthesis — not a single prompt." },
    { icn: "shield", t: "Trusted Sources", d: "Every claim carries numbered citations. Source credibility is rated and verifiable in one click." },
    { icn: "file", t: "Knowledge Base", d: "Bring your own PDFs, notes and datasets. Verity uses them to focus the research direction." },
    { icn: "download", t: "Export & Share", d: "One-click export to PDF, Markdown, Word and HTML with citations included." },
    { icn: "chart", t: "Research Analytics", d: "Track runs, sources analysed and citation precision across your whole workspace." },
    { icn: "folder", t: "Projects", d: "Organise reports into projects, keep a searchable archive and return to any finding." },
];
const STEPS = [
    ["Ask", "Describe what you need in plain language — from market analysis to technical deep-dives."],
    ["Plan", "The agent breaks your question into focused sub-questions and picks the right source types."],
    ["Search & read", "It searches the web, encyclopedic and academic sources, then reads and scores the results."],
    ["Report", "You get a structured, cited report with an executive summary — ready to export and share."],
];
function renderLanding() {
    const nav = (label, target) => h("a.land-nav-link", { href: "#", onclick: (e) => { e.preventDefault(); document.getElementById(target)?.scrollIntoView({ behavior: "smooth" }); } }, label);
    const page = h("div.landing", null, h("header.land-head", null, h("div.land-head-in", null, h("a.brand", { href: "#/" }, h("span.brand-mark", null, icon("logo", 18)), h("span.brand-name", null, "Verity AI")), h("nav.land-nav", null, nav("Features", "features"), nav("How it works", "how"), nav("Pricing", "pricing")), h("div.land-cta", null, h("a.v-btn.ghost", { href: "#/signin" }, "Log in"), h("a.v-btn.primary", { href: "#/signin" }, "Get Started")))), h("section.hero", null, h("div.hero-in", null, h("div.hero-copy", null, h("span.hero-badge", null, icon("spark", 14), "AI Research Agent"), h("h1", { html: "Your Autonomous<br><em>AI Research</em> Agent" }), h("p.hero-sub", null, "Turn complex questions into deep, trustworthy and well-cited research — with web search, multi-source analysis and structured reports."), h("div.hero-actions", null, h("a.v-btn.dark.lg", { href: "#/signin" }, "Get Started", icon("send", 15)), h("a.v-btn.ghost.lg", { href: "#", onclick: (e) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); } }, "See how it works"))), heroArt()), h("div.hero-chips", null, ...[["layers", "Deep Research", "Multi-step analysis"], ["shield", "Trusted Sources", "Citations & links"],
        ["image", "Multimodal", "Text, PDF, data, tables"], ["download", "Export & Share", "PDF, MD, Word"]].map(([i, t, d]) => h("div.hero-chip", null, h("span.chip-icn", null, icon(i, 18)), h("div", null, h("strong", null, t), h("span", null, d)))))), h("section.land-sec#features", null, h("div.sec-head", null, h("h2", null, "Research that holds up to scrutiny"), h("p", null, "Built for work where the sources matter as much as the answer.")), h("div.feat-grid", null, ...FEATURES.map(f => h("div.feat-card", null, h("span.feat-icn", null, icon(f.icn, 19)), h("h3", null, f.t), h("p", null, f.d))))), h("section.land-sec.alt#how", null, h("div.sec-head", null, h("h2", null, "How Verity works"), h("p", null, "A real agent pipeline — every step visible while it runs.")), h("div.steps-row", null, ...STEPS.map(([t, d], i) => h("div.step-card", null, h("span.step-n", null, String(i + 1)), h("h3", null, t), h("p", null, d))))), h("section.land-sec#pricing", null, h("div.sec-head", null, h("h2", null, "Simple pricing"), h("p", null, "Start free. Upgrade when your team does.")), h("div.price-grid", null, priceCard("Free", "$0", ["Unlimited local projects", "Standard research depth", "Knowledge base uploads", "All export formats"], false), priceCard("Pro", "$16", ["Everything in Free", "Deep research depth", "Priority model capacity", "Research analytics"], true), priceCard("Team", "$49", ["Everything in Pro", "Shared workspaces", "Admin controls", "Priority support"], false))), h("footer.land-foot", null, h("div.land-foot-in", null, h("a.brand.dim", { href: "#/" }, h("span.brand-mark", null, icon("logo", 16)), h("span.brand-name", null, "Verity AI")), h("span.foot-note", null, `© ${new Date().getFullYear()} Verity AI — autonomous research with verifiable sources.`))));
    return page;
}
function priceCard(name, price, items, hot) {
    return h("div.price-card" + (hot ? ".hot" : ""), null, hot ? h("span.price-tag", null, "Most popular") : null, h("h3", null, name), h("div.price-amt", null, h("strong", null, price), h("span", null, "/month")), h("ul", null, ...items.map(i => h("li", null, icon("check", 14), i))), h("a.v-btn.block" + (hot ? ".primary" : ".ghost"), { href: "#/signin" }, name === "Free" ? "Get started" : "Start free trial"));
}
/* ── Sign in ───────────────────────────────────────────────────────── */
function renderSignin() {
    const name = h("input.v-input", { placeholder: "Your name", value: ST.root.user?.name || "" });
    const email = h("input.v-input", { placeholder: "you@company.com", type: "email", value: ST.root.user?.email || "" });
    const wsName = h("input.v-input", { placeholder: "Workspace name", value: ST.wsMeta?.name || "Personal Workspace" });
    const submit = (e) => {
        e.preventDefault();
        const n = name.value.trim(), m = email.value.trim();
        if (!n) {
            toast("Please enter your name.", "error");
            name.focus();
            return;
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) {
            toast("Please enter a valid email address.", "error");
            email.focus();
            return;
        }
        ST.signIn(n, m);
        if (wsName.value.trim())
            ST.renameWorkspace(ST.root.activeWs, wsName.value.trim());
        ST.log("signin");
        location.hash = "#/app";
    };
    return h("div.auth-page", null, h("div.auth-card", null, h("a.brand.auth-brand", { href: "#/" }, h("span.brand-mark", null, icon("logo", 18)), h("span.brand-name", null, "Verity AI")), h("h1", null, "Welcome"), h("p.auth-sub", null, "Sign in to your workspace. Your account and research are stored privately in this browser."), h("form.auth-form", { onsubmit: submit }, h("label", null, "Name", name), h("label", null, "Email", email), h("label", null, "Workspace", wsName), h("button.v-btn.primary.block.lg", { type: "submit" }, "Continue", icon("send", 15))), h("p.auth-note", null, "No password needed — this workspace lives in your browser's storage.")));
}
//# sourceMappingURL=landing.js.map

// ── shell.js ──
/* ── App shell: sidebar, topbar, workspace & notifications ─────────── */


const NAV = [
    ["home", "Home", "#/app"],
    ["folder", "Projects", "#/app/projects"],
    ["doc", "Reports", "#/app/reports"],
    ["book", "Knowledge Base", "#/app/kb"],
    ["chart", "Analytics", "#/app/analytics"],
];
function renderShell(active, view) {
    const collapsed = ST.root.sidebarCollapsed;
    const navLink = (icn, label, href, cls = "") => h("a.side-link" + cls + (active === href ? ".on" : ""), { href, title: label }, icon(icn, 18), h("span.side-label", null, label));
    const sidebar = h("aside.side" + (collapsed ? ".collapsed" : ""), null, h("div.side-top", null, h("a.brand", { href: "#/app" }, h("span.brand-mark", null, icon("logo", 18)), h("span.brand-name.side-label", null, "Verity AI")), h("button.v-iconbtn.side-collapse", {
        title: collapsed ? "Expand sidebar" : "Collapse sidebar",
        onclick: () => { ST.root.sidebarCollapsed = !ST.root.sidebarCollapsed; ST.save(); rerender(); },
    }, icon("collapse", 16))), h("a.v-btn.primary.side-new" + (active === "#/app/research" ? ".glow" : ""), { href: "#/app/research", title: "New Research" }, icon("plus", 16), h("span.side-label", null, "New Research")), h("nav.side-nav", null, ...NAV.map(([i, l, hr]) => navLink(i, l, hr))), h("div.side-foot", null, navLink("settings", "Settings", "#/app/settings"), h("a.side-link", { href: "#", onclick: (e) => { e.preventDefault(); helpModal(); } }, icon("help", 18), h("span.side-label", null, "Help"))));
    /* topbar */
    const wsBtn = h("button.ws-btn", {
        onclick: () => popMenu(wsBtn, [
            ...ST.root.workspaces.map(w => ({
                label: (w.id === ST.root.activeWs ? "✓ " : "") + w.name, icon: "grid",
                on: () => { ST.switchWorkspace(w.id); rerender(); },
            })),
            { label: "New workspace…", icon: "plus", on: newWorkspaceModal },
        ]),
    }, icon("grid", 15), h("span.ws-name", null, ST.wsMeta.name), icon("chevd", 14));
    const unread = ST.ws.notifs.filter(n => !n.read).length;
    const bellBtn = h("button.v-iconbtn.bell", { title: "Notifications", onclick: () => notifPopover(bellBtn) }, icon("bell", 18), unread ? h("span.bell-dot", null, String(Math.min(unread, 9))) : null);
    const initials = (ST.root.user?.name || "U").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const avatar = h("button.avatar", {
        title: ST.root.user?.name || "Account",
        onclick: () => popMenu(avatar, [
            { label: ST.root.user?.name || "Account", icon: "user", on: () => { location.hash = "#/app/settings"; } },
            { label: "Settings", icon: "settings", on: () => { location.hash = "#/app/settings"; } },
            { label: "Help & shortcuts", icon: "help", on: helpModal },
            { label: "Sign out", icon: "logout", danger: true, on: () => { ST.signOut(); location.hash = "#/"; } },
        ]),
    }, initials);
    const topbar = h("header.topbar", null, h("button.v-iconbtn.only-mobile", { "aria-label": "Menu", onclick: () => document.body.classList.toggle("drawer-open") }, icon("menu", 18)), h("div.topbar-spacer"), wsBtn, bellBtn, avatar);
    const main = h("main.app-main", null, view);
    const scrim = h("div.drawer-scrim", { onclick: () => document.body.classList.remove("drawer-open") });
    document.body.classList.remove("drawer-open");
    return h("div.app" + (collapsed ? ".side-min" : ""), null, sidebar, scrim, h("div.app-right", null, topbar, main));
}
function rerender() { window.dispatchEvent(new HashChangeEvent("hashchange")); }
function newWorkspaceModal() {
    const inp = h("input.v-input", { placeholder: "e.g. Market Research" });
    const m = modal({
        title: "New workspace", sub: "Workspaces keep projects, reports and knowledge separate.",
        body: h("label.v-field", null, "Workspace name", inp),
        footer: frag(h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"), h("button.v-btn.primary", {
            onclick: () => {
                const n = inp.value.trim();
                if (!n) {
                    toast("Give the workspace a name.", "error");
                    return;
                }
                ST.addWorkspace(n);
                m.close();
                rerender();
                toast(`Workspace “${n}” created.`);
            },
        }, "Create workspace")),
    });
    setTimeout(() => inp.focus(), 50);
}
function notifPopover(anchor) {
    document.querySelectorAll(".v-pop").forEach(p => p.remove());
    const pop = h("div.v-pop.notif-pop");
    pop.append(h("div.notif-head", null, h("strong", null, "Notifications"), ST.ws.notifs.length ? h("button.v-link", {
        onclick: () => { ST.markNotifsRead(); pop.remove(); rerender(); },
    }, "Mark all read") : null));
    if (!ST.ws.notifs.length) {
        pop.append(h("p.notif-empty", null, "Nothing yet — finished research will show up here."));
    }
    else {
        for (const n of ST.ws.notifs.slice(0, 8)) {
            pop.append(h("button.notif-item" + (n.read ? "" : ".unread"), {
                onclick: () => { pop.remove(); if (n.reportId)
                    location.hash = "#/app/report/" + n.reportId; },
            }, h("span.notif-text", null, n.text), h("span.notif-time", null, timeAgo(n.t))));
        }
    }
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.top = r.bottom + 8 + "px";
    pop.style.left = Math.max(10, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 10)) + "px";
    const off = (e) => { if (!pop.contains(e.target)) {
        pop.remove();
        document.removeEventListener("click", off, true);
    } };
    setTimeout(() => document.addEventListener("click", off, true), 0);
}
function helpModal() {
    const row = (k, d) => h("div.help-row", null, h("kbd", null, k), h("span", null, d));
    const m = modal({
        title: "Help",
        body: frag(h("h4.help-h", null, "How research works"), h("p.help-p", null, "Verity plans sub-questions, searches the web and academic sources, reads what it finds, then writes a cited report. Every run shows its steps live, and every claim links back to a numbered source."), h("h4.help-h", null, "Shortcuts"), row("N", "New research"), row("/", "Focus search on list pages"), row("Esc", "Close dialogs"), h("h4.help-h", null, "Your data"), h("p.help-p", null, "Projects, reports and knowledge-base files are stored privately in this browser (localStorage + IndexedDB). Use Settings → Export data for a full backup.")),
        footer: h("button.v-btn.primary", { onclick: () => m.close() }, "Got it"),
    });
}
//# sourceMappingURL=shell.js.map

// ── views.js ──
/* ── Home, Projects, Reports, Knowledge Base, Analytics, Settings ──── */



/* ═══ HOME ═══ */
function renderHome() {
    const user = ST.root.user;
    const reports = ST.ws.reports;
    const now = new Date();
    const hour = now.getHours();
    const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const statCard = (label, value, icn) => h("div.v-card.stat-sm", null, h("span.stat-icn", null, icon(icn, 17)), h("div", null, h("strong", null, value), h("span", null, label)));
    const totSources = reports.reduce((a, r) => a + r.sources, 0);
    const avgPrec = reports.length ? Math.round(reports.reduce((a, r) => a + r.precision, 0) / reports.length) : 0;
    return h("div.page", null, h("div.page-head", null, h("div", null, h("h1", null, `${greet}, ${user?.name?.split(" ")[0] || "researcher"}`), h("p.page-sub", null, "Pick up where you left off, or start something new.")), h("a.v-btn.primary", { href: "#/app/research" }, icon("plus", 15), "New Research")), h("div.stat-row", null, statCard("research runs", String(reports.length), "zap"), statCard("sources analysed", String(totSources), "link"), statCard("avg. citation precision", reports.length ? avgPrec + "%" : "—", "shield"), statCard("knowledge docs", String(ST.ws.docs.length), "book")), h("div.home-grid", null, h("div.v-card", null, h("div.card-head", null, h("h3", null, "Recent reports"), h("a.v-link", { href: "#/app/reports" }, "View all")), reports.length
        ? h("div.list", null, ...reports.slice(0, 5).map(reportRow))
        : emptyState("doc", "No research yet", "Run your first research and the report will appear here.", h("a.v-btn.primary.sm", { href: "#/app/research" }, "Start researching"))), h("div.v-card", null, h("div.card-head", null, h("h3", null, "Projects"), h("a.v-link", { href: "#/app/projects" }, "View all")), ST.ws.projects.length
        ? h("div.list", null, ...ST.ws.projects.slice(0, 5).map(p => h("a.list-row", { href: "#/app/project/" + p.id }, h("span.row-icn.green", null, icon("folder", 16)), h("div.row-main", null, h("strong", null, p.name), h("span", null, `${ST.reportsIn(p.id).length} reports · updated ${timeAgo(p.updated)}`)), icon("back", 14))))
        : emptyState("folder", "No projects yet", "Group related research into projects to keep things tidy."))));
}
function reportRow(r) {
    return h("a.list-row", { href: "#/app/report/" + r.id }, h("span.row-icn", null, icon("doc", 16)), h("div.row-main", null, h("strong", null, r.question), h("span", null, `${r.sources} sources · ${r.precision}% precision · ${timeAgo(r.created)}`)), icon("back", 14));
}
/* ═══ PROJECTS ═══ */
function renderProjects() {
    const grid = h("div.proj-grid");
    const paintGrid = () => {
        grid.innerHTML = "";
        if (!ST.ws.projects.length) {
            grid.append(emptyState("folder", "Organise your research", "Projects group related reports — create one to get started.", h("button.v-btn.primary", { onclick: newProject }, icon("plus", 15), "New Project")));
            return;
        }
        for (const p of ST.ws.projects) {
            const n = ST.reportsIn(p.id).length;
            const kebab = h("button.v-iconbtn", {
                onclick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    popMenu(e.currentTarget, [
                        { label: "Rename", icon: "edit", on: () => renameProject(p.id, paintGrid) },
                        { label: "Delete", icon: "trash", danger: true, on: () => confirmBox("Delete project?", `Reports inside “${p.name}” are kept — they just leave the project.`, "Delete", () => { ST.deleteProject(p.id); paintGrid(); toast("Project deleted."); }) },
                    ]);
                },
            }, icon("dots", 16));
            grid.append(h("a.proj-card", { href: "#/app/project/" + p.id }, h("div.proj-top", null, h("span.proj-icn", null, icon("folder", 19)), kebab), h("strong.proj-name", null, p.name), h("span.proj-meta", null, `Updated ${timeAgo(p.updated)} · ${n} report${n === 1 ? "" : "s"}`)));
        }
    };
    paintGrid();
    function newProject() {
        const inp = h("input.v-input", { placeholder: "e.g. EV Market Research" });
        const m = modal({
            title: "New Project", body: h("label.v-field", null, "Project name", inp),
            footer: frag(h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"), h("button.v-btn.primary", { onclick: () => {
                    const n = inp.value.trim();
                    if (!n) {
                        toast("Give the project a name.", "error");
                        return;
                    }
                    ST.addProject(n);
                    m.close();
                    paintGrid();
                    toast(`Project “${n}” created.`);
                } }, "Create project")),
        });
        setTimeout(() => inp.focus(), 50);
    }
    return h("div.page", null, h("div.page-head", null, h("div", null, h("h1", null, "Projects"), h("p.page-sub", null, "Organise your research into projects and keep track of progress.")), h("button.v-btn.primary", { onclick: newProject }, icon("plus", 15), "New Project")), grid);
}
function renameProject(id, after) {
    const p = ST.project(id);
    if (!p)
        return;
    const inp = h("input.v-input", { value: p.name });
    const m = modal({
        title: "Rename project", body: h("label.v-field", null, "Project name", inp),
        footer: frag(h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"), h("button.v-btn.primary", { onclick: () => {
                if (inp.value.trim()) {
                    ST.renameProject(id, inp.value.trim());
                    m.close();
                    after();
                    toast("Renamed.");
                }
            } }, "Save")),
    });
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
}
function renderProjectDetail(id) {
    const p = ST.project(id);
    if (!p)
        return h("div.page", null, h("p.v-muted", null, "Project not found."));
    const reports = ST.reportsIn(id);
    return h("div.page", null, h("a.v-link.back", { href: "#/app/projects" }, icon("back", 15), "All projects"), h("div.page-head", null, h("div", null, h("h1", null, p.name), h("p.page-sub", null, `${reports.length} report${reports.length === 1 ? "" : "s"} · created ${fmtDate(p.created)}`)), h("div", null, h("button.v-btn.ghost", { onclick: () => renameProject(id, () => window.dispatchEvent(new HashChangeEvent("hashchange"))) }, icon("edit", 15), "Rename"), " ", h("a.v-btn.primary", { href: "#/app/research" }, icon("plus", 15), "New Research"))), reports.length
        ? h("div.v-card", null, h("div.list", null, ...reports.map(reportRow)))
        : emptyState("doc", "Nothing here yet", "Open any report and use “Add to project” to file it here."));
}
/* ═══ REPORTS LIST ═══ */
function renderReports() {
    const q = h("input.v-input.search-inp", { placeholder: "Search reports…  ( / )", id: "page-search" });
    const listBox = h("div.v-card");
    const paintList = () => {
        const term = q.value.trim().toLowerCase();
        const rows = ST.ws.reports.filter(r => !term || r.question.toLowerCase().includes(term));
        listBox.innerHTML = "";
        if (!ST.ws.reports.length) {
            listBox.append(emptyState("doc", "No reports yet", "Everything you research is saved here automatically.", h("a.v-btn.primary.sm", { href: "#/app/research" }, "Start researching")));
        }
        else if (!rows.length) {
            listBox.append(emptyState("search", "No matches", `Nothing matching “${q.value.trim()}”.`));
        }
        else {
            const list = h("div.list");
            for (const r of rows) {
                const row = reportRow(r);
                const kebab = h("button.v-iconbtn", {
                    onclick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        popMenu(e.currentTarget, [
                            { label: "Delete report", icon: "trash", danger: true, on: () => confirmBox("Delete report?", "This removes it permanently from the workspace.", "Delete", () => { ST.deleteReport(r.id); paintList(); toast("Report deleted."); }) },
                        ]);
                    },
                }, icon("dots", 16));
                row.append(kebab);
                list.append(row);
            }
            listBox.append(list);
        }
    };
    q.addEventListener("input", debounce(paintList, 150));
    paintList();
    return h("div.page", null, h("div.page-head", null, h("div", null, h("h1", null, "Reports"), h("p.page-sub", null, "Every research run in this workspace.")), h("a.v-btn.primary", { href: "#/app/research" }, icon("plus", 15), "New Research")), q, listBox);
}
/* ═══ KNOWLEDGE BASE ═══ */
const KIND_OF = {
    pdf: "pdf", doc: "doc", docx: "doc", txt: "note", md: "note", markdown: "note",
    csv: "data", tsv: "data", json: "data", png: "image", jpg: "image", jpeg: "image", webp: "image", gif: "image",
};
const TEXT_KINDS = new Set(["txt", "md", "markdown", "csv", "tsv", "json"]);
function renderKB() {
    let filter = "all";
    const q = h("input.v-input.search-inp", { placeholder: "Search your knowledge base…  ( / )", id: "page-search" });
    const fileInput = h("input", { type: "file", multiple: true, style: "display:none",
        accept: ".pdf,.doc,.docx,.txt,.md,.csv,.tsv,.json,.png,.jpg,.jpeg,.webp,.gif" });
    const listBox = h("div.v-card");
    const chipsRow = h("div.kb-chips");
    const paintChips = () => {
        chipsRow.innerHTML = "";
        const defs = [["all", "All"], ["pdf", "PDFs"], ["note", "Notes"], ["data", "Datasets"], ["image", "Images"]];
        for (const [k, label] of defs) {
            chipsRow.append(h("button.kb-chip" + (filter === k ? ".on" : ""), {
                onclick: () => { filter = k; paintChips(); paintKB(); },
            }, label));
        }
    };
    const texts = new Map(); // search cache
    const paintKB = async () => {
        const term = q.value.trim().toLowerCase();
        let docs = ST.ws.docs.filter(d => filter === "all" || d.kind === filter || (filter === "pdf" && d.kind === "doc"));
        if (term) {
            const out = [];
            for (const d of docs) {
                if (d.name.toLowerCase().includes(term)) {
                    out.push(d);
                    continue;
                }
                if (d.hasText) {
                    if (!texts.has(d.id)) {
                        const p = await dbGet("files", d.id);
                        texts.set(d.id, (p?.text || "").toLowerCase());
                    }
                    if (texts.get(d.id).includes(term))
                        out.push(d);
                }
            }
            docs = out;
        }
        listBox.innerHTML = "";
        if (!ST.ws.docs.length) {
            listBox.append(emptyState("upload", "Build your knowledge base", "Upload PDFs, notes, datasets and images. Text documents can steer your research runs.", h("button.v-btn.primary.sm", { onclick: () => fileInput.click() }, icon("upload", 15), "Upload files")));
            return;
        }
        if (!docs.length) {
            listBox.append(emptyState("search", "No matches", "Try a different search or filter."));
            return;
        }
        const list = h("div.list");
        for (const d of docs)
            list.append(kbRow(d, () => void paintKB()));
        listBox.append(list);
    };
    fileInput.addEventListener("change", async () => {
        const files = Array.from(fileInput.files || []);
        fileInput.value = "";
        let added = 0;
        for (const f of files) {
            if (f.size > 25 * 1024 * 1024) {
                toast(`“${f.name}” is over 25 MB — skipped.`, "error");
                continue;
            }
            const ext = (f.name.split(".").pop() || "").toLowerCase();
            const kind = KIND_OF[ext];
            if (!kind) {
                toast(`“${f.name}”: unsupported type .${ext}`, "error");
                continue;
            }
            let text = "";
            if (TEXT_KINDS.has(ext)) {
                try {
                    text = (await f.text()).slice(0, 400_000);
                }
                catch { /* binary */ }
            }
            const id = uid();
            try {
                await dbPut("files", id, { blob: f, text });
                ST.addDoc({ id, name: f.name, kind, size: f.size, added: Date.now(), hasText: !!text, useInResearch: false });
                ST.log("kb_upload", f.size);
                added++;
            }
            catch {
                toast(`Couldn't store “${f.name}” locally.`, "error");
            }
        }
        if (added)
            toast(`${added} file${added === 1 ? "" : "s"} added to your knowledge base.`);
        void paintKB();
    });
    q.addEventListener("input", debounce(() => void paintKB(), 200));
    paintChips();
    void paintKB();
    return h("div.page", null, h("div.page-head", null, h("div", null, h("h1", null, "Knowledge Base"), h("p.page-sub", null, "Upload your own documents, notes and data. Text files can guide new research runs.")), h("button.v-btn.primary", { onclick: () => fileInput.click() }, icon("upload", 15), "Upload")), fileInput, q, chipsRow, listBox);
}
function kbRow(d, repaint) {
    const icn = d.kind === "pdf" ? "doc" : d.kind === "data" ? "database" : d.kind === "image" ? "image" : d.kind === "doc" ? "file" : "edit";
    const kebab = h("button.v-iconbtn", {
        onclick: (e) => popMenu(e.currentTarget, [
            { label: "Preview", icon: "search", on: () => void previewDoc(d) },
            { label: "Download", icon: "download", on: async () => {
                    const p = await dbGet("files", d.id);
                    if (!p) {
                        toast("File data missing.", "error");
                        return;
                    }
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(p.blob);
                    a.download = d.name;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 400);
                } },
            { label: "Delete", icon: "trash", danger: true, on: () => confirmBox("Delete file?", `“${d.name}” will be removed from the knowledge base.`, "Delete", () => { ST.deleteDoc(d.id); repaint(); toast("File deleted."); }) },
        ]),
    }, icon("dots", 16));
    return h("div.list-row.kb-row", null, h("span.row-icn.kb-" + d.kind, null, icon(icn, 16)), h("div.row-main", null, h("strong", null, d.name), h("span", null, `${d.kind.toUpperCase()} · ${fmtSize(d.size)} · ${timeAgo(d.added)}` + (d.hasText ? " · usable in research" : ""))), kebab);
}
async function previewDoc(d) {
    const p = await dbGet("files", d.id);
    if (!p) {
        toast("File data missing.", "error");
        return;
    }
    let body;
    if (d.kind === "image") {
        const img = h("img.kb-preview-img");
        img.src = URL.createObjectURL(p.blob);
        body = h("div", null, img);
    }
    else if (p.text) {
        body = h("pre.kb-preview-text", null, p.text.slice(0, 8000) + (p.text.length > 8000 ? "\n…" : ""));
    }
    else {
        body = h("p.v-muted", null, "No inline preview for this file type — use Download to open it locally.");
    }
    modal({ title: d.name, sub: `${fmtSize(d.size)} · added ${fmtDate(d.added)}`, body, wide: true });
}
/* ═══ ANALYTICS ═══ */
function renderAnalytics() {
    let days = 30;
    const root = h("div.page");
    const paintA = () => {
        const since = Date.now() - days * 86400_000;
        const ev = ST.ws.events.filter(e => e.t >= since);
        const runs = ev.filter(e => e.type === "run_started").length;
        const doneEv = ev.filter(e => e.type === "run_done");
        const sources = doneEv.reduce((a, e) => a + (e.n || 0), 0);
        const reports = ST.ws.reports.filter(r => r.created >= since);
        const exportsN = ev.filter(e => e.type === "export").length;
        const prevSince = since - days * 86400_000;
        const prevRuns = ST.ws.events.filter(e => e.t >= prevSince && e.t < since && e.type === "run_started").length;
        const delta = prevRuns ? Math.round(((runs - prevRuns) / prevRuns) * 100) : null;
        // runs per day series
        const buckets = Math.min(days, 45);
        const bucketMs = (days * 86400_000) / buckets;
        const values = new Array(buckets).fill(0);
        const labels = [];
        for (let i = 0; i < buckets; i++) {
            const t = since + i * bucketMs;
            labels.push(new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
        }
        for (const e of ev)
            if (e.type === "run_started") {
                const i = Math.min(buckets - 1, Math.floor((e.t - since) / bucketMs));
                values[i]++;
            }
        const avgPrec = reports.length ? Math.round(reports.reduce((a, r) => a + r.precision, 0) / reports.length) : 0;
        const statBig = (v, label, sub) => h("div.v-card.stat-big", null, h("strong", null, v), h("span", null, label), sub ? h("em.stat-delta", null, sub) : null);
        const rangeBtn = h("button.pill-btn", {
            onclick: () => popMenu(rangeBtn, [7, 30, 90].map(d => ({
                label: (d === days ? "✓ " : "") + `Last ${d} days`, icon: "clock",
                on: () => { days = d; paintA(); },
            }))),
        }, icon("clock", 14), h("span", null, `Last ${days} Days`), icon("chevd", 13));
        const byDepth = [
            { label: "Standard", value: reports.filter(r => r.depth !== "deep").length, color: "var(--green-500)" },
            { label: "Deep", value: reports.filter(r => r.depth === "deep").length, color: "var(--green-700)" },
        ];
        const topReports = reports.slice().sort((a, b) => b.sources - a.sources).slice(0, 6)
            .map(r => ({ label: r.question.slice(0, 44), value: r.sources, hint: r.precision + "%" }));
        root.innerHTML = "";
        root.append(h("div.page-head", null, h("div", null, h("h1", null, "Research Analytics"), h("p.page-sub", null, "Your research activity and usage insights.")), rangeBtn), h("div.stat-row", null, statBig(String(runs), "Research runs", delta === null ? null : (delta >= 0 ? "+" : "") + delta + "% vs previous"), statBig(String(sources), "Sources analysed", null), statBig(String(reports.length), "Reports generated", null), statBig(reports.length ? avgPrec + "%" : "—", "Avg. citation precision", null)), runs || reports.length
            ? frag(h("div.v-card", null, h("div.card-head", null, h("h3", null, "Research Activity")), chArea(values, labels)), h("div.ana-grid", null, h("div.v-card", null, h("h3", null, "Runs by depth"), chDonut(byDepth, String(reports.length), "reports")), h("div.v-card", null, h("h3", null, "Most-sourced reports"), topReports.length ? chBars(topReports, " src") : h("p.v-muted", null, "Finish a research run to see this."))), h("p.v-muted.ana-note", null, `${exportsN} export${exportsN === 1 ? "" : "s"} in this period.`))
            : emptyState("chart", "No activity yet", "Run research in this period and your activity will chart here.", h("a.v-btn.primary.sm", { href: "#/app/research" }, "Start researching")));
    };
    paintA();
    return root;
}
/* ═══ SETTINGS ═══ */
function renderSettings() {
    const u = ST.root.user;
    const nameI = h("input.v-input", { value: u?.name || "" });
    const mailI = h("input.v-input", { value: u?.email || "", type: "email" });
    const wsI = h("input.v-input", { value: ST.wsMeta.name });
    const wsList = h("div.list");
    const paintWs = () => {
        wsList.innerHTML = "";
        for (const w of ST.root.workspaces) {
            const kebab = h("button.v-iconbtn", {
                onclick: (e) => popMenu(e.currentTarget, [
                    { label: "Switch to", icon: "grid", on: () => { ST.switchWorkspace(w.id); location.reload(); } },
                    { label: "Delete", icon: "trash", danger: true, on: () => {
                            if (!ST.deleteWorkspace(w.id)) {
                                toast("You need at least one workspace.", "error");
                                return;
                            }
                            paintWs();
                            toast("Workspace deleted.");
                        } },
                ]),
            }, icon("dots", 16));
            wsList.append(h("div.list-row", null, h("span.row-icn.green", null, icon("grid", 16)), h("div.row-main", null, h("strong", null, w.name + (w.id === ST.root.activeWs ? "  (current)" : "")), h("span", null, `created ${fmtDate(w.created)}`)), kebab));
        }
    };
    paintWs();
    return h("div.page.settings-page", null, h("div.page-head", null, h("div", null, h("h1", null, "Settings"), h("p.page-sub", null, "Profile, workspaces and your data."))), h("div.v-card", null, h("h3", null, "Profile"), h("div.set-grid", null, h("label.v-field", null, "Name", nameI), h("label.v-field", null, "Email", mailI)), h("button.v-btn.primary.sm", { onclick: () => {
            if (!nameI.value.trim()) {
                toast("Name can't be empty.", "error");
                return;
            }
            ST.signIn(nameI.value.trim(), mailI.value.trim());
            toast("Profile saved.");
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        } }, "Save profile")), h("div.v-card", null, h("h3", null, "Current workspace"), h("div.set-grid", null, h("label.v-field", null, "Workspace name", wsI)), h("button.v-btn.primary.sm", { onclick: () => {
            if (wsI.value.trim()) {
                ST.renameWorkspace(ST.root.activeWs, wsI.value.trim());
                toast("Workspace renamed.");
                window.dispatchEvent(new HashChangeEvent("hashchange"));
            }
        } }, "Rename workspace"), h("h3.set-sub", null, "All workspaces"), wsList), h("div.v-card", null, h("h3", null, "Your data"), h("p.v-muted", null, "Reports, projects and analytics live in this browser. Export a backup any time; knowledge-base file contents are not included in the JSON backup."), h("div.set-actions", null, h("button.v-btn.ghost.sm", { onclick: exportData }, icon("download", 15), "Export data (JSON)"), h("button.v-btn.danger.sm", { onclick: () => confirmBox("Clear this workspace?", "All projects, reports, knowledge files and analytics in this workspace will be permanently removed.", "Clear workspace", async () => {
            for (const r of ST.ws.reports)
                await dbDel("reports", r.id);
            for (const d of ST.ws.docs)
                await dbDel("files", d.id);
            ST.root.byWs[ST.root.activeWs] = { projects: [], reports: [], docs: [], events: [], notifs: [] };
            ST.save();
            toast("Workspace cleared.");
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        }) }, icon("trash", 15), "Clear workspace"))));
}
function exportData() {
    const data = JSON.stringify(ST.root, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = "verity-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 400);
    toast("Backup downloaded.");
}
//# sourceMappingURL=views.js.map

// ── research.js ──
/* ── Research: input screen + live progress ────────────────────────── */



const SUGGESTIONS = [
    "Compare LLMs for enterprise use",
    "EV market in India 2026",
    "AI in healthcare — current evidence",
    "Semiconductor supply chain risks",
];
let live = null;
function renderResearchHome() {
    const ta = h("textarea.ask-input", {
        placeholder: "e.g., “Analyse the impact of generative AI on the job market in India”",
        rows: 3,
    });
    let depth = "standard";
    const depthBtn = h("button.pill-btn", {
        onclick: () => popMenu(depthBtn, [
            { label: "Standard — fast, focused (recommended)", icon: "zap", on: () => { depth = "standard"; depthLabel.textContent = "Standard"; } },
            { label: "Deep — more sources and checks", icon: "layers", on: () => { depth = "deep"; depthLabel.textContent = "Deep Research"; } },
        ]),
    }, icon("layers", 15), undefined);
    const depthLabel = h("span", null, "Standard");
    depthBtn.append(depthLabel, icon("chevd", 13));
    /* knowledge-base context picker */
    const usable = ST.ws.docs.filter(d => d.hasText);
    const picked = new Set();
    const filesBtn = h("button.pill-btn", {
        onclick: () => {
            if (!usable.length) {
                toast("Upload notes, markdown or CSV files to the Knowledge Base first.", "error");
                return;
            }
            popMenu(filesBtn, usable.map(d => ({
                label: (picked.has(d.id) ? "✓ " : "") + d.name, icon: "file",
                on: () => { picked.has(d.id) ? picked.delete(d.id) : picked.add(d.id); syncFiles(); },
            })));
        },
    }, icon("file", 15), undefined);
    const filesLabel = h("span", null, "Files");
    filesBtn.append(filesLabel, icon("chevd", 13));
    const syncFiles = () => {
        filesLabel.textContent = picked.size ? `Files (${picked.size})` : "Files";
        filesBtn.classList.toggle("on", picked.size > 0);
    };
    const start = async () => {
        const q = ta.value.trim();
        if (q.length < 8) {
            toast("Describe what you want to research (a full question works best).", "error");
            ta.focus();
            return;
        }
        const context = [];
        for (const id of picked) {
            const docMeta = ST.ws.docs.find(d => d.id === id);
            const payload = await dbGet("files", id);
            if (docMeta && payload?.text)
                context.push({ name: docMeta.name, text: payload.text.slice(0, 2500) });
        }
        beginRun(q, depth, context);
    };
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void start();
        }
    });
    const recent = ST.ws.reports.slice(0, 3);
    return h("div.page.ask-page", null, h("div.ask-hero", null, h("h1", null, "What do you want to research today?"), h("p.ask-sub", null, "Ask anything, from market analysis to complex technical topics."), h("div.ask-card", null, ta, h("div.ask-row", null, h("div.ask-row-left", null, depthBtn, h("span.pill-static", { title: "Verity always researches with live web search" }, icon("globe", 15), "Web"), filesBtn), h("button.v-btn.primary.send-btn", { "aria-label": "Start research", onclick: () => void start() }, icon("send", 17)))), h("div.ask-sugs", null, ...SUGGESTIONS.map(s => h("button.sug", { onclick: () => { ta.value = s; ta.focus(); } }, h("span", null, s), icon("external", 13)))), recent.length ? h("div.ask-recent", null, h("h3", null, "Recent research"), ...recent.map(r => h("a.recent-row", { href: "#/app/report/" + r.id }, icon("doc", 16), h("span.recent-q", null, r.question), h("span.recent-meta", null, `${r.sources} sources`)))) : null));
}
/* ── live progress ─────────────────────────────────────────────────── */
function beginRun(q, depth, context) {
    const steps = [
        "Understanding your query", "Planning research steps", "Searching the web",
        "Reading and analysing sources", "Synthesising insights", "Generating structured report",
    ].map((label, i) => ({ label, state: (i === 0 ? "doing" : "todo") }));
    live = { q, depth, run: null, steps, feed: [], draft: "", startedAt: Date.now() };
    ST.log("run_started", undefined, q);
    location.hash = "#/app/progress";
    let sourceCount = 0, searchCount = 0;
    const setStep = (i) => {
        for (let k = 0; k < live.steps.length; k++)
            live.steps[k].state = k < i ? "done" : k === i ? "doing" : "todo";
        paintProgress();
    };
    const feed = (icn, text) => {
        live.feed.unshift({ icn, text });
        live.feed = live.feed.slice(0, 30);
        paintProgress();
    };
    const finish = async (r) => {
        const id = uid();
        const secs = Math.round((Date.now() - live.startedAt) / 1000);
        await dbPut("reports", id, r);
        ST.addReport({
            id, question: r.question || q, created: Date.now(),
            sources: r.sources?.length || 0,
            precision: Math.round((r.score?.citation_precision || 0) * 100),
            claims: r.score?.claims || r.claims?.length || 0, depth, secs,
        });
        ST.log("run_done", r.sources?.length || 0);
        ST.notify(`Report ready — ${(r.question || q).slice(0, 70)}`, id);
        live = null;
        location.hash = "#/app/report/" + id;
    };
    live.run = runResearch(q, depth, context, {
        status(msg) {
            if (/writing report/i.test(msg))
                setStep(4);
            else if (/verifying/i.test(msg))
                setStep(5);
            if (/unavailable|extractive/i.test(msg))
                feed("alert", msg);
            else
                feed("clock", msg);
        },
        plan(subs) { setStep(2); feed("check", `Planned ${subs.length} research angles`); for (const s of subs)
            feed("spark", s.question); },
        search(query) { searchCount++; setStep(2); feed("search", `Searching: ${query}`); },
        source(s) {
            sourceCount++;
            setStep(3);
            feed("link", `Source [${s.id}] ${s.title}`);
            const el = document.getElementById("prog-count");
            if (el)
                el.textContent = `${sourceCount} sources`;
        },
        draft(body) { live && (live.draft = body); setStep(5); feed("doc", "Draft report written"); },
        report(r) { void finish(r); },
        error(msg) {
            ST.log("run_error");
            if (live?.draft) {
                // We still have a written draft — salvage it as the report
                void finish({
                    question: q, markdown: live.draft, body: live.draft,
                    score: { supported: 0, partial: 0, unsupported: 0, citation_precision: 0, claims: 0 },
                    sources: [], claims: [], plan: [], conflicts: [],
                });
                return;
            }
            if (live) {
                live.run = null;
                paintProgress(msg);
            }
        },
    });
    paintProgress();
}
function renderProgress() {
    if (!live) {
        location.hash = "#/app/research";
        return h("div");
    }
    return h("div.page.prog-page#prog-root");
}
function paintProgress(error) {
    const root = document.getElementById("prog-root");
    if (!root || !live)
        return;
    const doneCount = live.steps.filter(s => s.state === "done").length;
    const current = live.steps.find(s => s.state === "doing");
    root.innerHTML = "";
    if (error) {
        root.append(h("div.prog-error", null, h("span.prog-err-icn", null, icon("alert", 22)), h("h2", null, "Research couldn't finish"), h("p", null, error), h("div.prog-err-actions", null, h("button.v-btn.primary", { onclick: () => beginRun(live.q, live.depth, []) }, icon("refresh", 15), "Try again"), h("button.v-btn.ghost", { onclick: () => { live = null; location.hash = "#/app/research"; } }, "Back to research"))));
        return;
    }
    root.append(h("div.prog-head", null, h("h1", null, h("span.pulse-dot"), "Research in progress…"), h("p", null, "Analysing, searching, and synthesising information from multiple sources."), h("p.prog-q", null, "“", live.q, "”")), h("div.prog-grid", null, h("div.prog-steps", null, ...live.steps.map(s => h("div.prog-step." + s.state, null, h("span.step-dot", null, s.state === "done" ? icon("check", 12) : null), h("span", null, s.label)))), h("div.prog-side", null, h("div.prog-visual", null, progressArt(), h("div.prog-stat", null, h("strong", null, `Step ${Math.min(doneCount + 1, 6)} / 6`), h("span#prog-count", null, current ? current.label : "Working…"))), h("div.prog-feed", null, h("h3", null, "Agent activity"), h("div.prog-feed-list", null, ...live.feed.map(f => h("div.feed-row", null, icon(f.icn, 14), h("span", null, f.text))))), h("button.v-btn.ghost.prog-cancel", {
        onclick: () => { live?.run?.cancel(); live = null; location.hash = "#/app/research"; },
    }, "Cancel research"))));
}
function progressArt() {
    const w = h("div.prog-art");
    w.innerHTML = `<svg viewBox="0 0 200 120" aria-hidden="true">
    <defs><radialGradient id="pg" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#34d399" stop-opacity=".9"/><stop offset="100%" stop-color="#065f46" stop-opacity=".15"/>
    </radialGradient></defs>
    <rect width="200" height="120" rx="10" fill="#07120c"/>
    <circle cx="100" cy="58" r="38" fill="url(#pg)" opacity=".8"/>
    <g stroke="#6ee7b7" stroke-width=".7" fill="none" opacity=".75">
      <ellipse cx="100" cy="58" rx="38" ry="13"/><ellipse cx="100" cy="58" rx="38" ry="26" opacity=".5"/>
      <ellipse cx="100" cy="58" rx="13" ry="38" opacity=".5"/><circle cx="100" cy="58" r="38" opacity=".6"/>
    </g>
    <g fill="#a7f3d0"><circle cx="70" cy="40" r="1.6" class="tw1"/><circle cx="135" cy="70" r="1.6" class="tw2"/>
    <circle cx="112" cy="30" r="1.3" class="tw3"/><circle cx="85" cy="82" r="1.3" class="tw1"/></g>
  </svg>`;
    return w;
}
//# sourceMappingURL=research.js.map

// ── report.js ──
/* ── Report view: overview, findings, analysis, sources, export ────── */




let curTab = "overview";
function renderReport(id) {
    const meta = ST.reportMeta(id);
    const root = h("div.page.rep-page", null, spinner("Loading report…"));
    if (!meta) {
        root.innerHTML = "";
        root.append(h("p.v-muted", null, "This report was not found in the current workspace."));
        return root;
    }
    void dbGet("reports", id).then(r => {
        root.innerHTML = "";
        if (!r) {
            root.append(h("p.v-muted", null, "Report data is missing from local storage."));
            return;
        }
        curTab = "overview";
        paint(root, id, meta, r);
    });
    return root;
}
function paint(root, id, meta, r) {
    const tabs = [
        ["overview", "Overview"], ["findings", "Key Findings"], ["analysis", "Analysis"],
        ["sources", `Sources (${r.sources.length})`],
    ];
    const body = h("div.rep-body");
    const tabBar = h("div.rep-tabs", null, ...tabs.map(([k, label]) => h("button.rep-tab" + (curTab === k ? ".on" : ""), {
        onclick: (e) => {
            curTab = k;
            tabBar.querySelectorAll(".rep-tab").forEach(t => t.classList.remove("on"));
            e.currentTarget.classList.add("on");
            paintTab(body, k, meta, r);
        },
    }, label)));
    const projBtn = h("button.v-btn.ghost.sm", {
        onclick: () => {
            const items = ST.ws.projects.map(p => ({
                label: (meta.projectId === p.id ? "✓ " : "") + p.name, icon: "folder",
                on: () => { ST.assignReport(id, meta.projectId === p.id ? undefined : p.id); toast("Project updated."); refreshProjLabel(); },
            }));
            items.push({ label: "New project…", icon: "plus", on: () => {
                    const name = prompt("Project name");
                    if (name?.trim()) {
                        const p = ST.addProject(name.trim());
                        ST.assignReport(id, p.id);
                        refreshProjLabel();
                        toast(`Added to “${p.name}”.`);
                    }
                } });
            popMenu(projBtn, items);
        },
    }, icon("folder", 15), undefined);
    const projLabel = h("span", null, "");
    projBtn.append(projLabel, icon("chevd", 13));
    const refreshProjLabel = () => {
        const p = meta.projectId ? ST.project(meta.projectId) : undefined;
        projLabel.textContent = p ? p.name : "Add to project";
    };
    refreshProjLabel();
    root.append(h("div.rep-topline", null, h("a.v-link.back", { href: "#/app/reports" }, icon("back", 15), "Back to Reports"), h("div.rep-actions", null, projBtn, h("button.v-btn.ghost.sm", { onclick: () => exportModal(meta, r) }, icon("download", 15), "Export", icon("chevd", 13)), h("button.v-btn.primary.sm", { onclick: () => shareModal(meta, r) }, icon("share", 15), "Share"), h("button.v-iconbtn", {
        title: "More", onclick: (e) => popMenu(e.currentTarget, [
            { label: "Ask a follow-up", icon: "help", on: () => askPanel(r) },
            { label: "Delete report", icon: "trash", danger: true, on: () => confirmBox("Delete report?", "This removes the report from your workspace permanently.", "Delete", () => {
                    ST.deleteReport(id);
                    toast("Report deleted.");
                    location.hash = "#/app/reports";
                }) },
        ]),
    }, icon("dots", 16)))), h("h1.rep-title", null, r.question || meta.question), tabBar, body);
    paintTab(body, curTab, meta, r);
}
/* ── tabs ──────────────────────────────────────────────────────────── */
function paintTab(body, tab, meta, r) {
    body.innerHTML = "";
    if (tab === "overview")
        return overviewTab(body, meta, r);
    if (tab === "findings")
        return findingsTab(body, r);
    if (tab === "analysis")
        return analysisTab(body, meta, r);
    if (tab === "sources")
        return sourcesTab(body, r);
}
function firstParagraph(markdown) {
    for (const block of markdown.split(/\n{2,}/)) {
        const t = block.trim();
        if (t && !t.startsWith("#") && !t.startsWith("*The language model") && t.length > 80)
            return t;
    }
    return markdown.slice(0, 400);
}
function overviewTab(body, meta, r) {
    const takeaways = r.claims.slice(0, 4);
    const stat = h("div.rep-stat-card", null, h("span.rep-stat-label", null, "Research snapshot"), h("div.rep-stat-num", null, String(r.sources.length)), h("span.rep-stat-sub", null, "sources analysed"), h("div.rep-stat-row", null, h("span", null, "Cited claims"), h("strong", null, String(r.score.claims || r.claims.length))), h("div.rep-stat-row", null, h("span", null, "Citation precision"), h("strong", null, meta.precision + "%")), h("div.rep-stat-row", null, h("span", null, "Depth"), h("strong", null, meta.depth === "deep" ? "Deep" : "Standard")), h("div.rep-stat-row", null, h("span", null, "Completed"), h("strong", null, fmtDate(meta.created))));
    body.append(h("div.rep-overview-grid", null, h("div", null, h("div.exec-card", null, h("h3", null, "Executive Summary"), h("div.exec-text", { html: md(firstParagraph(r.markdown)) })), takeaways.length ? h("div.takeaways", null, h("h3", null, "Key Takeaways"), ...takeaways.map(c => h("div.tk-row", null, h("span.tk-icn." + labelClass(c.label), null, icon(labelIcon(c.label), 13)), h("span", { html: inlineMd(c.text) })))) : null), stat), h("article.rep-article", { html: md(r.markdown) }));
    wireCites(body, r);
}
function findingsTab(body, r) {
    if (!r.claims.length) {
        body.append(h("p.v-muted", null, "No individual claims were extracted for this report (citation verification was skipped to stay within the time limit)."));
        body.append(h("article.rep-article", { html: md(r.markdown) }));
        return;
    }
    const groups = [
        ["supported", "Verified findings", r.claims.filter(c => c.label === "supported")],
        ["partial", "Partially supported", r.claims.filter(c => c.label === "partial")],
        ["unchecked", "Awaiting verification", r.claims.filter(c => c.label !== "supported" && c.label !== "partial" && c.label !== "unsupported")],
        ["unsupported", "Not supported by sources", r.claims.filter(c => c.label === "unsupported")],
    ];
    for (const [cls, title, claims] of groups) {
        if (!claims.length)
            continue;
        body.append(h("h3.find-h." + cls, null, icon(labelIcon(cls), 15), `${title} (${claims.length})`));
        for (const c of claims) {
            body.append(h("div.find-card." + cls, null, h("p", { html: inlineMd(c.text) }), h("div.find-meta", null, ...c.cites.map(n => h("button.cite-chip", {
                onclick: () => { curTabSet("sources"); },
            }, `[${n}] ${r.sources.find(s => s.id === n)?.title.slice(0, 40) || "source"}`)), c.reason ? h("span.find-reason", null, c.reason) : null)));
        }
    }
}
function analysisTab(body, meta, r) {
    const s = r.score;
    const donut = chDonut([
        { label: "Supported", value: s.supported, color: "var(--green-600)" },
        { label: "Partial", value: s.partial, color: "#f59e0b" },
        { label: "Unsupported", value: s.unsupported, color: "#ef4444" },
        { label: "Unchecked", value: Math.max(0, (s.claims || r.claims.length) - s.supported - s.partial - s.unsupported), color: "#cbd5e1" },
    ], meta.precision + "%", "citation precision");
    const credOrder = { high: 3, medium: 2, low: 1 };
    const credRows = r.sources
        .slice().sort((a, b) => (credOrder[b.credibility] || 0) - (credOrder[a.credibility] || 0))
        .map(src => ({ label: `[${src.id}] ${hostOf(src.url)}`, value: credOrder[src.credibility] || 1, hint: src.credibility }));
    body.append(frag(h("div.ana-grid", null, h("div.v-card", null, h("h3", null, "Claim verification"), donut), h("div.v-card", null, h("h3", null, "Source credibility"), chBars(credRows))), r.plan?.length ? h("div.v-card.ana-plan", null, h("h3", null, "Research plan the agent followed"), h("ol.plan-list", null, ...r.plan.map(p => h("li", null, h("strong", null, p.question), h("span.plan-q", null, ` — searched “${p.query}” (${p.source})`))))) : null, r.conflicts?.length ? h("div.v-card", null, h("h3", null, "Source disagreements"), ...r.conflicts.map(c => h("p.v-muted", null, String(c.topic || "")))) : null));
}
function sourcesTab(body, r) {
    if (!r.sources.length) {
        body.append(h("p.v-muted", null, "No sources were captured for this run."));
        return;
    }
    for (const s of r.sources) {
        body.append(h("div.src-card#src-" + s.id, null, h("span.src-n", null, String(s.id)), h("div.src-main", null, h("div.src-top", null, h("strong.src-title", null, s.title), h("a.v-iconbtn", { href: s.url, target: "_blank", rel: "noopener", title: "Open source" }, icon("external", 15))), h("a.src-url", { href: s.url, target: "_blank", rel: "noopener" }, s.url), h("div.src-meta", null, h("span.src-badge." + s.credibility, null, s.credibility + " credibility"), h("span.src-host", null, hostOf(s.url)), s.date ? h("span.src-date", null, s.date) : null), s.passages?.length ? h("details.src-quote", null, h("summary", null, "Key passage used"), h("blockquote", null, s.passages[0].slice(0, 500) + (s.passages[0].length > 500 ? "…" : ""))) : null)));
    }
}
/* ── follow-up ask ─────────────────────────────────────────────────── */
function askPanel(r) {
    const history = [];
    const log = h("div.ask-log");
    const inp = h("input.v-input", { placeholder: "Ask about this report…" });
    const send = async () => {
        const q = inp.value.trim();
        if (!q)
            return;
        inp.value = "";
        log.append(h("div.ask-msg.me", null, q));
        const wait = h("div.ask-msg.ai", null, spinner("Thinking…"));
        log.append(wait);
        log.scrollTop = log.scrollHeight;
        const res = await askFollowup(r, q, history);
        wait.remove();
        if ("error" in res) {
            log.append(h("div.ask-msg.ai.err", null, "Couldn't answer: " + res.error));
        }
        else {
            history.push({ role: "user", content: q }, { role: "assistant", content: res.answer });
            log.append(h("div.ask-msg.ai", { html: md(res.answer) }));
        }
        log.scrollTop = log.scrollHeight;
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter")
        void send(); });
    modal({
        title: "Ask a follow-up", sub: "Answers stay grounded in this report's sources.",
        wide: true,
        body: frag(log, h("div.ask-sendrow", null, inp, h("button.v-btn.primary", { onclick: () => void send() }, icon("send", 15)))),
    });
    setTimeout(() => inp.focus(), 60);
}
/* ── export & share ────────────────────────────────────────────────── */
function buildMarkdown(r, inc) {
    let out = r.markdown;
    if (!inc.src)
        out = out.replace(/\n## Sources[\s\S]*$/, "");
    if (inc.sum)
        out = out; // summary is part of the report body
    return out;
}
function download(name, mime, content) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function reportHtml(r, inc) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(r.question)}</title>
<style>body{font:15px/1.65 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a2332;max-width:760px;margin:40px auto;padding:0 20px}
h1,h2,h3{line-height:1.25}a{color:#15803d}sup{color:#15803d;font-weight:600}blockquote{border-left:3px solid #d1d5db;margin:0;padding:4px 14px;color:#475467}</style>
</head><body>${md(buildMarkdown(r, inc))}<hr><p style="color:#98a2b3;font-size:13px">Generated by Verity AI</p></body></html>`;
}
function exportModal(meta, r) {
    let fmt = "pdf";
    const inc = { src: true, charts: true, sum: true };
    const fmts = [
        ["pdf", "PDF", "Best for sharing"], ["md", "Markdown", "For docs and GitHub"],
        ["doc", "Word (.doc)", "Editable document"], ["html", "HTML", "Self-contained page"],
    ];
    const cards = h("div.exp-grid", null, ...fmts.map(([k, name, sub]) => h("button.exp-card" + (fmt === k ? ".on" : ""), {
        onclick: (e) => {
            fmt = k;
            cards.querySelectorAll(".exp-card").forEach(c => c.classList.remove("on"));
            e.currentTarget.classList.add("on");
        },
    }, h("span.exp-icn." + k, null, icon(k === "pdf" ? "doc" : k === "md" ? "file" : k === "doc" ? "edit" : "globe", 18)), h("strong", null, name), h("span", null, sub))));
    const tgl = (key, label) => {
        const b = h("button.v-toggle" + (inc[key] ? ".on" : ""), {
            role: "switch", "aria-checked": String(inc[key]),
            onclick: () => { inc[key] = !inc[key]; b.classList.toggle("on", inc[key]); b.setAttribute("aria-checked", String(inc[key])); },
        }, h("span.v-knob"));
        return h("div.exp-opt", null, h("span", null, label), b);
    };
    const slug = (r.question || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
    const m = modal({
        title: "Export Report", sub: "Choose your export format and options.",
        body: frag(cards, h("div.exp-opts", null, tgl("src", "Include sources and citations"), tgl("charts", "Include charts and tables"), tgl("sum", "Include executive summary"))),
        footer: frag(h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"), h("button.v-btn.primary", {
            onclick: () => {
                const mdText = buildMarkdown(r, inc);
                if (fmt === "md")
                    download(slug + ".md", "text/markdown", mdText);
                else if (fmt === "html")
                    download(slug + ".html", "text/html", reportHtml(r, inc));
                else if (fmt === "doc")
                    download(slug + ".doc", "application/msword", reportHtml(r, inc));
                else
                    printPdf(r, inc);
                ST.log("export", undefined, fmt);
                m.close();
                toast(fmt === "pdf" ? "Print dialog opened — choose “Save as PDF”." : "Export downloaded.");
            },
        }, icon("download", 15), "Export")),
    });
}
function printPdf(r, inc) {
    const w = window.open("", "_blank");
    if (!w) {
        toast("Allow pop-ups to export as PDF.", "error");
        return;
    }
    w.document.write(reportHtml(r, inc));
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 250);
}
function shareModal(meta, r) {
    const summary = `${r.question}\n\n${firstParagraph(r.markdown).replace(/\[\d+\]/g, "")}\n\n— researched with Verity AI (${r.sources.length} sources, ${meta.precision}% citation precision)`;
    const ta = h("textarea.v-input.share-ta", { rows: 7 });
    ta.value = summary;
    const m = modal({
        title: "Share report", sub: "Copy a summary, or export a file to attach.",
        body: frag(ta),
        footer: frag(h("button.v-btn.ghost", { onclick: () => { exportModal(meta, r); m.close(); } }, icon("download", 15), "Export file instead"), h("button.v-btn.primary", {
            onclick: async () => {
                try {
                    await navigator.clipboard.writeText(ta.value);
                    toast("Summary copied to clipboard.");
                }
                catch {
                    ta.select();
                    document.execCommand("copy");
                    toast("Summary copied.");
                }
                ST.log("share");
                m.close();
            },
        }, icon("copy", 15), "Copy summary")),
    });
}
/* ── small helpers ─────────────────────────────────────────────────── */
function labelClass(l) {
    return l === "supported" ? "ok" : l === "partial" ? "mid" : l === "unsupported" ? "bad" : "na";
}
function labelIcon(l) {
    return l === "supported" ? "check" : l === "partial" ? "alert" : l === "unsupported" ? "x" : "clock";
}
function inlineMd(t) {
    return esc(t).replace(/\[(\d{1,2})\]/g, '<sup class="cite">[$1]</sup>');
}
function curTabSet(tab) {
    const btns = document.querySelectorAll(".rep-tab");
    btns.forEach((b, i) => {
        const keys = ["overview", "findings", "analysis", "sources"];
        if (keys[i] === tab)
            b.click();
    });
}
function wireCites(scope, r) {
    scope.querySelectorAll("sup.cite[data-cite]").forEach(el => {
        el.addEventListener("click", () => {
            curTabSet("sources");
            setTimeout(() => document.getElementById("src-" + el.getAttribute("data-cite"))?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
        });
    });
}
//# sourceMappingURL=report.js.map

// ── main.js ──
/* ── Verity router + boot ──────────────────────────────────────────── */






const rootEl = document.getElementById("app");
function route() {
    const hash = location.hash || "#/";
    const authed = !!ST.root.user;
    rootEl.innerHTML = "";
    window.scrollTo(0, 0);
    if (hash === "#/" || hash === "") {
        rootEl.append(renderLanding());
        return;
    }
    if (hash === "#/signin") {
        rootEl.append(renderSignin());
        return;
    }
    if (hash.startsWith("#/app")) {
        if (!authed) {
            location.hash = "#/signin";
            return;
        }
        let active = hash, view;
        const seg = hash.split("/");
        if (hash === "#/app")
            view = renderHome();
        else if (hash === "#/app/research")
            view = renderResearchHome();
        else if (hash === "#/app/progress")
            view = renderProgress();
        else if (hash.startsWith("#/app/report/")) {
            view = renderReport(seg[3]);
            active = "#/app/reports";
        }
        else if (hash === "#/app/projects")
            view = renderProjects();
        else if (hash.startsWith("#/app/project/")) {
            view = renderProjectDetail(seg[3]);
            active = "#/app/projects";
        }
        else if (hash === "#/app/reports")
            view = renderReports();
        else if (hash === "#/app/kb")
            view = renderKB();
        else if (hash === "#/app/analytics")
            view = renderAnalytics();
        else if (hash === "#/app/settings")
            view = renderSettings();
        else {
            location.hash = "#/app";
            return;
        }
        rootEl.append(renderShell(active, view));
        return;
    }
    location.hash = "#/";
}
window.addEventListener("hashchange", route);
/* global shortcuts */
document.addEventListener("keydown", (e) => {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey)
        return;
    if (e.key === "n" && ST.root.user && location.hash.startsWith("#/app")) {
        e.preventDefault();
        location.hash = "#/app/research";
    }
    if (e.key === "/") {
        const s = document.getElementById("page-search");
        if (s) {
            e.preventDefault();
            s.focus();
        }
    }
});
route();
//# sourceMappingURL=main.js.map

})();
