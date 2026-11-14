/* ── Nyna core: dom, icons, markdown, overlays ───────────────────── */

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

/** Tiny element builder: h("div.card#x", {onclick}, child, "text") */
export function h(spec: string, attrs?: Attrs | null, ...kids: (Node | string | null | undefined | false)[]): HTMLElement {
  const [tagPart] = spec.split(/(?=[.#])/);
  const el = document.createElement(tagPart || "div");
  const classes = spec.match(/\.[\w-]+/g);
  if (classes) el.className = classes.map(c => c.slice(1)).join(" ");
  const id = spec.match(/#([\w-]+)/);
  if (id) el.id = id[1];
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "html") el.innerHTML = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    el.append(typeof k === "string" ? document.createTextNode(k) : k);
  }
  return el;
}

export function frag(...kids: (Node | string | null | false | undefined)[]): DocumentFragment {
  const f = document.createDocumentFragment();
  for (const k of kids) if (k) f.append(typeof k === "string" ? document.createTextNode(k) : k);
  return f;
}

/* ── Icon set (16/18px stroke icons, inherit currentColor) ─────────── */
const PATHS: Record<string, string> = {
  logo: '<path d="M4.5 16.5V3.5h2.6l5.6 8.6V3.5h2.8v13h-2.6L7.3 7.8v8.7z" fill="currentColor" stroke="none"/>',
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
  star: '<path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z"/>',
  logout: '<path d="M8 3.5H4.5v13H8"/><path d="M13 6.5 16.5 10 13 13.5M16.5 10h-9"/>',
};

export function icon(name: string, size = 18): HTMLElement {
  const s = h("span.icn");
  s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.doc}</svg>`;
  return s;
}

/* ── Formatting helpers ────────────────────────────────────────────── */
export function fmtSize(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}
export function timeAgo(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hours ago";
  const d = Math.floor(s / 86400);
  if (d === 1) return "yesterday";
  if (d < 7) return d + " days ago";
  if (d < 30) return Math.floor(d / 7) + " weeks ago";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
export function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
export function debounce<T extends (...a: never[]) => void>(fn: T, ms: number): T {
  let t = 0;
  return ((...a: never[]) => { clearTimeout(t); t = window.setTimeout(() => fn(...a), ms); }) as T;
}

/* ── Markdown (safe, minimal, citation-aware) ──────────────────────── */
export function md(src: string): string {
  const lines = (src || "").split("\n");
  const out: string[] = [];
  let inList = false, inOl = false, para: string[] = [];

  const inline = (t: string): string => {
    const x = esc(t)
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_m, a: string, u: string) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/(^|[\s(·])_([^_\n]+)_(?=[\s).,;:·]|$)/g, "$1<em>$2</em>")
      .replace(/\[(\d{1,2})\]/g, '<sup class="cite" data-cite="$1">[$1]</sup>');
    return x;
  };
  const flushP = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
  };
  const closeLists = () => {
    if (inList) { out.push("</ul>"); inList = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const hm = /^(#{1,4})\s+(.*)/.exec(line);
    if (hm) { flushP(); closeLists(); out.push(`<h${hm[1].length + 1}>${inline(hm[2])}</h${hm[1].length + 1}>`); continue; }
    if (/^[-*]\s+/.test(line)) {
      flushP(); if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushP(); if (inList) { out.push("</ul>"); inList = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`); continue;
    }
    if (/^>\s?/.test(line)) { flushP(); closeLists(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`); continue; }
    if (line === "") { flushP(); closeLists(); continue; }
    para.push(line);
  }
  flushP(); closeLists();
  return out.join("\n");
}

/* ── Toast (errors + confirmations only) ───────────────────────────── */
let toastWrap: HTMLElement | null = null;
export function toast(msg: string, kind: "error" | "success" = "success"): void {
  if (!toastWrap) { toastWrap = h("div.v-toasts"); document.body.append(toastWrap); }
  const t = h("div.v-toast." + kind, null, icon(kind === "error" ? "alert" : "check", 16), h("span", null, msg));
  toastWrap.append(t);
  requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 300); }, kind === "error" ? 6000 : 3200);
}

/* ── Modal ─────────────────────────────────────────────────────────── */
export function modal(opts: { title: string; sub?: string; body: Node; footer?: Node; wide?: boolean }): { close(): void; el: HTMLElement } {
  const close = () => { wrap.classList.remove("in"); setTimeout(() => wrap.remove(), 180); document.removeEventListener("keydown", onKey, true); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  const card = h("div.v-modal" + (opts.wide ? ".wide" : ""), null,
    h("div.v-modal-head", null,
      h("div", null, h("h3", null, opts.title), opts.sub ? h("p.v-modal-sub", null, opts.sub) : null),
      h("button.v-iconbtn", { onclick: close, "aria-label": "Close" }, icon("x", 16))),
    h("div.v-modal-body", null, opts.body),
    opts.footer ? h("div.v-modal-foot", null, opts.footer) : null);
  const wrap = h("div.v-overlay", { onclick: (e: Event) => { if (e.target === wrap) close(); } }, card);
  document.body.append(wrap);
  document.addEventListener("keydown", onKey, true);
  requestAnimationFrame(() => wrap.classList.add("in"));
  return { close, el: card };
}

export function confirmBox(title: string, text: string, action: string, onYes: () => void, danger = true): void {
  const m = modal({
    title, body: h("p.v-confirm-text", null, text),
    footer: frag(
      h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"),
      h("button.v-btn" + (danger ? ".danger" : ".primary"), { onclick: () => { m.close(); onYes(); } }, action)),
  });
}

/* ── Popover menu ──────────────────────────────────────────────────── */
export function popMenu(anchor: HTMLElement, items: { label: string; icon?: string; danger?: boolean; on: () => void }[]): void {
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
  const off = (e: Event) => { if (!pop.contains(e.target as Node)) { pop.remove(); document.removeEventListener("click", off, true); } };
  setTimeout(() => document.addEventListener("click", off, true), 0);
}

/* ── Empty state ───────────────────────────────────────────────────── */
export function emptyState(icn: string, title: string, sub: string, action?: HTMLElement): HTMLElement {
  return h("div.v-empty", null,
    h("div.v-empty-icn", null, icon(icn, 26)),
    h("h3", null, title), h("p", null, sub), action || null);
}

export function spinner(label?: string): HTMLElement {
  return h("div.v-loading", null, h("span.v-spin"), label ? h("span", null, label) : null);
}
