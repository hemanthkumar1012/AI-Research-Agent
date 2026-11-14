/* ── Command palette (Ctrl/Cmd+K): actions, reports, projects, docs ── */
import { h, icon } from "./u.js";
import { ST } from "./store.js";

interface Cmd { icn: string; label: string; hint?: string; kind: string; run(): void }

let open = false;

function fuzzy(hay: string, needle: string): number {
  const H = hay.toLowerCase(), N = needle.toLowerCase();
  if (!N) return 1;
  if (H.includes(N)) return 100 - H.indexOf(N);
  let i = 0, score = 0;
  for (const ch of H) { if (ch === N[i]) { i++; score += 2; } }
  return i === N.length ? score : 0;
}

function commands(): Cmd[] {
  const nav = (label: string, icn: string, hash: string): Cmd =>
    ({ icn, label, kind: "Navigate", run: () => { location.hash = hash; } });
  const out: Cmd[] = [
    { icn: "plus", label: "New Research", hint: "N", kind: "Actions", run: () => { location.hash = "#/app/research"; } },
    nav("Home", "home", "#/app"), nav("Projects", "folder", "#/app/projects"),
    nav("Reports", "doc", "#/app/reports"), nav("Knowledge Base", "book", "#/app/kb"),
    nav("Analytics", "chart", "#/app/analytics"), nav("Settings", "settings", "#/app/settings"),
  ];
  for (const r of ST.ws.reports.slice(0, 40))
    out.push({ icn: "doc", label: r.question, hint: `${r.sources} sources`, kind: "Reports",
               run: () => { location.hash = "#/app/report/" + r.id; } });
  for (const p of ST.ws.projects)
    out.push({ icn: "folder", label: p.name, kind: "Projects",
               run: () => { location.hash = "#/app/project/" + p.id; } });
  for (const d of ST.ws.docs.slice(0, 25))
    out.push({ icn: "file", label: d.name, hint: d.kind.toUpperCase(), kind: "Knowledge",
               run: () => { location.hash = "#/app/kb"; } });
  return out;
}

export function openPalette(): void {
  if (open || !ST.root.user) return;
  open = true;
  const all = commands();
  let sel = 0, shown: Cmd[] = all;

  const inp = h("input.pal-input", { placeholder: "Search actions, reports, projects, knowledge…", "aria-label": "Command palette" }) as HTMLInputElement;
  const list = h("div.pal-list", { role: "listbox" });
  const card = h("div.pal-card", null,
    h("div.pal-top", null, icon("search", 17), inp, h("kbd", null, "esc")), list);
  const wrap = h("div.v-overlay.pal-wrap", { onclick: (e: Event) => { if (e.target === wrap) close(); } }, card);

  const close = () => {
    open = false;
    wrap.classList.remove("in");
    document.removeEventListener("keydown", onKey, true);
    setTimeout(() => wrap.remove(), 150);
  };

  const paint = () => {
    list.innerHTML = "";
    let lastKind = "";
    if (!shown.length) { list.append(h("p.pal-empty", null, "No matches.")); return; }
    shown.slice(0, 14).forEach((c, i) => {
      if (c.kind !== lastKind) { list.append(h("div.pal-kind", null, c.kind)); lastKind = c.kind; }
      list.append(h("button.pal-item" + (i === sel ? ".on" : ""), {
        role: "option", onclick: () => { close(); c.run(); },
        onmousemove: () => { if (sel !== i) { sel = i; paint(); } },
      }, icon(c.icn, 15), h("span.pal-label", null, c.label), c.hint ? h("span.pal-hint", null, c.hint) : null));
    });
    list.querySelector(".pal-item.on")?.scrollIntoView({ block: "nearest" });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, Math.min(shown.length, 14) - 1); paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); paint(); }
    else if (e.key === "Enter") { e.preventDefault(); const c = shown[sel]; if (c) { close(); c.run(); } }
  };

  inp.addEventListener("input", () => {
    const q = inp.value.trim();
    shown = all.map(c => ({ c, s: fuzzy(c.label + " " + c.kind, q) }))
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.c);
    sel = 0; paint();
  });
  document.addEventListener("keydown", onKey, true);
  document.body.append(wrap);
  requestAnimationFrame(() => { wrap.classList.add("in"); inp.focus(); });
  paint();
}
