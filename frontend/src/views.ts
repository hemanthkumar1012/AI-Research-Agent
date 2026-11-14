/* ── Home, Projects, Reports, Knowledge Base, Analytics, Settings ──── */
import { h, frag, icon, toast, modal, popMenu, confirmBox, emptyState, timeAgo, fmtSize, fmtDate, debounce, uid } from "./u.js";
import { ST, dbPut, dbGet, dbDel, VDoc, VFilePayload, VReportMeta } from "./store.js";
import { chArea, chDonut, chBars } from "./charts.js";

/* ═══ HOME ═══ */
export function renderHome(): HTMLElement {
  const user = ST.root.user;
  const reports = ST.ws.reports;
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statCard = (label: string, value: string, icn: string) =>
    h("div.v-card.stat-sm", null, h("span.stat-icn", null, icon(icn, 17)),
      h("div", null, h("strong", null, value), h("span", null, label)));

  const totSources = reports.reduce((a, r) => a + r.sources, 0);
  const avgPrec = reports.length ? Math.round(reports.reduce((a, r) => a + r.precision, 0) / reports.length) : 0;

  return h("div.page", null,
    h("div.page-head", null,
      h("div", null,
        h("h1", null, `${greet}, ${user?.name?.split(" ")[0] || "researcher"}`),
        h("p.page-sub", null, "Pick up where you left off, or start something new.")),
      h("a.v-btn.primary", { href: "#/app/research" }, icon("plus", 15), "New Research")),
    h("div.stat-row", null,
      statCard("research runs", String(reports.length), "zap"),
      statCard("sources analysed", String(totSources), "link"),
      statCard("avg. citation precision", reports.length ? avgPrec + "%" : "—", "shield"),
      statCard("knowledge docs", String(ST.ws.docs.length), "book")),
    h("div.home-grid", null,
      h("div.v-card", null,
        h("div.card-head", null, h("h3", null, "Recent reports"), h("a.v-link", { href: "#/app/reports" }, "View all")),
        reports.length
          ? h("div.list", null, ...reports.slice(0, 5).map(reportRow))
          : emptyState("doc", "No research yet", "Run your first research and the report will appear here.",
            h("a.v-btn.primary.sm", { href: "#/app/research" }, "Start researching"))),
      h("div.v-card", null,
        h("div.card-head", null, h("h3", null, "Projects"), h("a.v-link", { href: "#/app/projects" }, "View all")),
        ST.ws.projects.length
          ? h("div.list", null, ...ST.ws.projects.slice(0, 5).map(p =>
            h("a.list-row", { href: "#/app/project/" + p.id },
              h("span.row-icn.green", null, icon("folder", 16)),
              h("div.row-main", null, h("strong", null, p.name),
                h("span", null, `${ST.reportsIn(p.id).length} reports · updated ${timeAgo(p.updated)}`)),
              icon("back", 14))))
          : emptyState("folder", "No projects yet", "Group related research into projects to keep things tidy."))));
}

function reportRow(r: VReportMeta): HTMLElement {
  return h("a.list-row", { href: "#/app/report/" + r.id },
    h("span.row-icn" + (r.starred ? ".starred" : ""), null, icon(r.starred ? "star" : "doc", 16)),
    h("div.row-main", null, h("strong", null, r.question),
      h("span", null, `${r.sources} sources · ${r.precision}% precision · ${timeAgo(r.created)}`)),
    icon("back", 14));
}

/* ═══ PROJECTS ═══ */
export function renderProjects(): HTMLElement {
  const grid = h("div.proj-grid");
  const paintGrid = () => {
    grid.innerHTML = "";
    if (!ST.ws.projects.length) {
      grid.append(emptyState("folder", "Organise your research", "Projects group related reports — create one to get started.",
        h("button.v-btn.primary", { onclick: newProject }, icon("plus", 15), "New Project")));
      return;
    }
    for (const p of ST.ws.projects) {
      const n = ST.reportsIn(p.id).length;
      const kebab = h("button.v-iconbtn", {
        onclick: (e: Event) => { e.preventDefault(); e.stopPropagation(); popMenu(e.currentTarget as HTMLElement, [
          { label: "Rename", icon: "edit", on: () => renameProject(p.id, paintGrid) },
          { label: "Delete", icon: "trash", danger: true, on: () =>
            confirmBox("Delete project?", `Reports inside “${p.name}” are kept — they just leave the project.`, "Delete",
              () => { ST.deleteProject(p.id); paintGrid(); toast("Project deleted."); }) },
        ]); },
      }, icon("dots", 16));
      grid.append(h("a.proj-card", { href: "#/app/project/" + p.id },
        h("div.proj-top", null, h("span.proj-icn", null, icon("folder", 19)), kebab),
        h("strong.proj-name", null, p.name),
        h("span.proj-meta", null, `Updated ${timeAgo(p.updated)} · ${n} report${n === 1 ? "" : "s"}`)));
    }
  };
  paintGrid();

  function newProject(): void {
    const inp = h("input.v-input", { placeholder: "e.g. EV Market Research" }) as HTMLInputElement;
    const m = modal({
      title: "New Project", body: h("label.v-field", null, "Project name", inp),
      footer: frag(h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"),
        h("button.v-btn.primary", { onclick: () => {
          const n = inp.value.trim(); if (!n) { toast("Give the project a name.", "error"); return; }
          ST.addProject(n); m.close(); paintGrid(); toast(`Project “${n}” created.`);
        } }, "Create project")),
    });
    setTimeout(() => inp.focus(), 50);
  }

  return h("div.page", null,
    h("div.page-head", null,
      h("div", null, h("h1", null, "Projects"), h("p.page-sub", null, "Organise your research into projects and keep track of progress.")),
      h("button.v-btn.primary", { onclick: newProject }, icon("plus", 15), "New Project")),
    grid);
}

function renameProject(id: string, after: () => void): void {
  const p = ST.project(id); if (!p) return;
  const inp = h("input.v-input", { value: p.name }) as HTMLInputElement;
  const m = modal({
    title: "Rename project", body: h("label.v-field", null, "Project name", inp),
    footer: frag(h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"),
      h("button.v-btn.primary", { onclick: () => {
        if (inp.value.trim()) { ST.renameProject(id, inp.value.trim()); m.close(); after(); toast("Renamed."); }
      } }, "Save")),
  });
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
}

export function renderProjectDetail(id: string): HTMLElement {
  const p = ST.project(id);
  if (!p) return h("div.page", null, h("p.v-muted", null, "Project not found."));
  const reports = ST.reportsIn(id);
  return h("div.page", null,
    h("a.v-link.back", { href: "#/app/projects" }, icon("back", 15), "All projects"),
    h("div.page-head", null,
      h("div", null, h("h1", null, p.name),
        h("p.page-sub", null, `${reports.length} report${reports.length === 1 ? "" : "s"} · created ${fmtDate(p.created)}`)),
      h("div", null,
        h("button.v-btn.ghost", { onclick: () => renameProject(id, () => window.dispatchEvent(new HashChangeEvent("hashchange"))) }, icon("edit", 15), "Rename"),
        " ",
        h("a.v-btn.primary", { href: "#/app/research" }, icon("plus", 15), "New Research"))),
    reports.length
      ? h("div.v-card", null, h("div.list", null, ...reports.map(reportRow)))
      : emptyState("doc", "Nothing here yet", "Open any report and use “Add to project” to file it here."));
}

/* ═══ REPORTS LIST ═══ */
export function renderReports(): HTMLElement {
  const q = h("input.v-input.search-inp", { placeholder: "Search reports…  ( / )", id: "page-search" }) as HTMLInputElement;
  const listBox = h("div.v-card");
  let onlyStarred = false;
  const filterRow = h("div.kb-chips");
  const paintChips = () => {
    filterRow.innerHTML = "";
    filterRow.append(
      h("button.kb-chip" + (onlyStarred ? "" : ".on"), { onclick: () => { onlyStarred = false; paintChips(); paintList(); } }, "All"),
      h("button.kb-chip" + (onlyStarred ? ".on" : ""), { onclick: () => { onlyStarred = true; paintChips(); paintList(); } }, "★ Starred"));
  };
  const paintList = () => {
    const term = q.value.trim().toLowerCase();
    const rows = ST.ws.reports.filter(r =>
      (!onlyStarred || r.starred) && (!term || r.question.toLowerCase().includes(term)));
    listBox.innerHTML = "";
    if (!ST.ws.reports.length) {
      listBox.append(emptyState("doc", "No reports yet", "Everything you research is saved here automatically.",
        h("a.v-btn.primary.sm", { href: "#/app/research" }, "Start researching")));
    } else if (!rows.length) {
      listBox.append(onlyStarred && !q.value.trim()
        ? emptyState("star", "No starred reports", "Star a report from its page to pin it here.")
        : emptyState("search", "No matches", `Nothing matching “${q.value.trim()}”.`));
    } else {
      const list = h("div.list");
      for (const r of rows) {
        const row = reportRow(r);
        const kebab = h("button.v-iconbtn", {
          onclick: (e: Event) => { e.preventDefault(); e.stopPropagation(); popMenu(e.currentTarget as HTMLElement, [
            { label: "Delete report", icon: "trash", danger: true, on: () =>
              confirmBox("Delete report?", "This removes it permanently from the workspace.", "Delete",
                () => { ST.deleteReport(r.id); paintList(); toast("Report deleted."); }) },
          ]); },
        }, icon("dots", 16));
        row.append(kebab);
        list.append(row);
      }
      listBox.append(list);
    }
  };
  q.addEventListener("input", debounce(paintList, 150));
  paintChips(); paintList();
  return h("div.page", null,
    h("div.page-head", null,
      h("div", null, h("h1", null, "Reports"), h("p.page-sub", null, "Every research run in this workspace.")),
      h("a.v-btn.primary", { href: "#/app/research" }, icon("plus", 15), "New Research")),
    q, filterRow, listBox);
}

/* ═══ KNOWLEDGE BASE ═══ */
const KIND_OF: Record<string, VDoc["kind"]> = {
  pdf: "pdf", doc: "doc", docx: "doc", txt: "note", md: "note", markdown: "note",
  csv: "data", tsv: "data", json: "data", png: "image", jpg: "image", jpeg: "image", webp: "image", gif: "image",
};
const TEXT_KINDS = new Set(["txt", "md", "markdown", "csv", "tsv", "json"]);

export function renderKB(): HTMLElement {
  let filter = "all";
  const q = h("input.v-input.search-inp", { placeholder: "Search your knowledge base…  ( / )", id: "page-search" }) as HTMLInputElement;
  const fileInput = h("input", { type: "file", multiple: true, style: "display:none",
    accept: ".pdf,.doc,.docx,.txt,.md,.csv,.tsv,.json,.png,.jpg,.jpeg,.webp,.gif" }) as HTMLInputElement;
  const listBox = h("div.v-card");
  const chipsRow = h("div.kb-chips");

  const paintChips = () => {
    chipsRow.innerHTML = "";
    const defs: [string, string][] = [["all", "All"], ["pdf", "PDFs"], ["note", "Notes"], ["data", "Datasets"], ["image", "Images"]];
    for (const [k, label] of defs) {
      chipsRow.append(h("button.kb-chip" + (filter === k ? ".on" : ""), {
        onclick: () => { filter = k; paintChips(); paintKB(); },
      }, label));
    }
  };

  const texts = new Map<string, string>(); // search cache
  const paintKB = async () => {
    const term = q.value.trim().toLowerCase();
    let docs = ST.ws.docs.filter(d => filter === "all" || d.kind === filter || (filter === "pdf" && d.kind === "doc"));
    if (term) {
      const out: VDoc[] = [];
      for (const d of docs) {
        if (d.name.toLowerCase().includes(term)) { out.push(d); continue; }
        if (d.hasText) {
          if (!texts.has(d.id)) {
            const p = await dbGet<VFilePayload>("files", d.id);
            texts.set(d.id, (p?.text || "").toLowerCase());
          }
          if (texts.get(d.id)!.includes(term)) out.push(d);
        }
      }
      docs = out;
    }
    listBox.innerHTML = "";
    if (!ST.ws.docs.length) {
      listBox.append(emptyState("upload", "Build your knowledge base", "Upload PDFs, notes, datasets and images. Text documents can steer your research runs.",
        h("button.v-btn.primary.sm", { onclick: () => fileInput.click() }, icon("upload", 15), "Upload files")));
      return;
    }
    if (!docs.length) { listBox.append(emptyState("search", "No matches", "Try a different search or filter.")); return; }
    const list = h("div.list");
    for (const d of docs) list.append(kbRow(d, () => void paintKB()));
    listBox.append(list);
  };

  const ingest = async (files: File[]) => {
    let added = 0;
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) { toast(`“${f.name}” is over 25 MB — skipped.`, "error"); continue; }
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      const kind = KIND_OF[ext];
      if (!kind) { toast(`“${f.name}”: unsupported type .${ext}`, "error"); continue; }
      let text = "";
      if (TEXT_KINDS.has(ext)) {
        try { text = (await f.text()).slice(0, 400_000); } catch { /* binary */ }
      }
      const id = uid();
      try {
        await dbPut("files", id, { blob: f, text } as VFilePayload);
        ST.addDoc({ id, name: f.name, kind, size: f.size, added: Date.now(), hasText: !!text, useInResearch: false });
        ST.log("kb_upload", f.size);
        added++;
      } catch { toast(`Couldn't store “${f.name}” locally.`, "error"); }
    }
    if (added) toast(`${added} file${added === 1 ? "" : "s"} added to your knowledge base.`);
    void paintKB();
  };
  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = "";
    void ingest(files);
  });

  q.addEventListener("input", debounce(() => void paintKB(), 200));
  paintChips(); void paintKB();

  const page = h("div.page.kb-page", null,
    h("div.page-head", null,
      h("div", null, h("h1", null, "Knowledge Base"),
        h("p.page-sub", null, "Upload your own documents, notes and data. Text files can guide new research runs.")),
      h("button.v-btn.primary", { onclick: () => fileInput.click() }, icon("upload", 15), "Upload")),
    fileInput, q, chipsRow,
    h("div.kb-dropzone", null, icon("upload", 18),
      h("span", null, "Drag & drop files anywhere on this page — PDF, DOCX, CSV, MD, TXT, images"),
      h("button.v-link", { onclick: () => fileInput.click() }, "or browse")),
    listBox);
  let dragDepth = 0;
  page.addEventListener("dragover", (e) => { e.preventDefault(); });
  page.addEventListener("dragenter", (e) => { e.preventDefault(); if (++dragDepth === 1) page.classList.add("dragging"); });
  page.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; page.classList.remove("dragging"); } });
  page.addEventListener("drop", (e) => {
    e.preventDefault(); dragDepth = 0; page.classList.remove("dragging");
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) void ingest(files);
  });
  return page;
}

function kbRow(d: VDoc, repaint: () => void): HTMLElement {
  const icn = d.kind === "pdf" ? "doc" : d.kind === "data" ? "database" : d.kind === "image" ? "image" : d.kind === "doc" ? "file" : "edit";
  const kebab = h("button.v-iconbtn", {
    onclick: (e: Event) => popMenu(e.currentTarget as HTMLElement, [
      { label: "Preview", icon: "search", on: () => void previewDoc(d) },
      { label: "Download", icon: "download", on: async () => {
        const p = await dbGet<VFilePayload>("files", d.id);
        if (!p) { toast("File data missing.", "error"); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(p.blob); a.download = d.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 400);
      } },
      { label: "Delete", icon: "trash", danger: true, on: () =>
        confirmBox("Delete file?", `“${d.name}” will be removed from the knowledge base.`, "Delete",
          () => { ST.deleteDoc(d.id); repaint(); toast("File deleted."); }) },
    ]),
  }, icon("dots", 16));
  return h("div.list-row.kb-row", null,
    h("span.row-icn.kb-" + d.kind, null, icon(icn, 16)),
    h("div.row-main", null,
      h("strong", null, d.name),
      h("span", null, `${d.kind.toUpperCase()} · ${fmtSize(d.size)} · ${timeAgo(d.added)}` + (d.hasText ? " · usable in research" : ""))),
    kebab);
}

async function previewDoc(d: VDoc): Promise<void> {
  const p = await dbGet<VFilePayload>("files", d.id);
  if (!p) { toast("File data missing.", "error"); return; }
  let body: HTMLElement;
  if (d.kind === "image") {
    const img = h("img.kb-preview-img") as HTMLImageElement;
    img.src = URL.createObjectURL(p.blob);
    body = h("div", null, img);
  } else if (p.text) {
    body = h("pre.kb-preview-text", null, p.text.slice(0, 8000) + (p.text.length > 8000 ? "\n…" : ""));
  } else {
    body = h("p.v-muted", null, "No inline preview for this file type — use Download to open it locally.");
  }
  modal({ title: d.name, sub: `${fmtSize(d.size)} · added ${fmtDate(d.added)}`, body, wide: true });
}

/* ═══ ANALYTICS ═══ */
export function renderAnalytics(): HTMLElement {
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
    const labels: string[] = [];
    for (let i = 0; i < buckets; i++) {
      const t = since + i * bucketMs;
      labels.push(new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    }
    for (const e of ev) if (e.type === "run_started") {
      const i = Math.min(buckets - 1, Math.floor((e.t - since) / bucketMs));
      values[i]++;
    }

    const avgPrec = reports.length ? Math.round(reports.reduce((a, r) => a + r.precision, 0) / reports.length) : 0;
    const statBig = (v: string, label: string, sub?: string | null) =>
      h("div.v-card.stat-big", null, h("strong", null, v), h("span", null, label),
        sub ? h("em.stat-delta", null, sub) : null);

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

    // 12-week research heatmap (one cell per day)
    const DAY = 86400_000;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const start = todayStart.getTime() - (7 * 12 - 1) * DAY;
    const perDay = new Map<number, number>();
    for (const e of ST.ws.events) if (e.type === "run_started" && e.t >= start) {
      const d = Math.floor((e.t - start) / DAY);
      perDay.set(d, (perDay.get(d) || 0) + 1);
    }
    const maxDay = Math.max(1, ...perDay.values());
    const heat = h("div.heatmap", { role: "img", "aria-label": "Research activity over the last 12 weeks" });
    for (let w = 0; w < 12; w++) {
      const colEl = h("div.heat-col");
      for (let d = 0; d < 7; d++) {
        const idx = w * 7 + d, t = start + idx * DAY;
        if (t > Date.now()) break;
        const n = perDay.get(idx) || 0;
        const lvl = n === 0 ? 0 : Math.min(4, Math.ceil((n / maxDay) * 4));
        colEl.append(h("span.heat-cell.l" + lvl, {
          title: `${new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${n} run${n === 1 ? "" : "s"}`,
        }));
      }
      heat.append(colEl);
    }

    root.innerHTML = "";
    root.append(
      h("div.page-head", null,
        h("div", null, h("h1", null, "Research Analytics"), h("p.page-sub", null, "Your research activity and usage insights.")),
        rangeBtn),
      h("div.stat-row", null,
        statBig(String(runs), "Research runs", delta === null ? null : (delta >= 0 ? "+" : "") + delta + "% vs previous"),
        statBig(String(sources), "Sources analysed", null),
        statBig(String(reports.length), "Reports generated", null),
        statBig(reports.length ? avgPrec + "%" : "—", "Avg. citation precision", null)),
      runs || reports.length
        ? frag(
          h("div.v-card", null, h("div.card-head", null, h("h3", null, "Research Activity")), chArea(values, labels)),
          h("div.v-card", null, h("div.card-head", null, h("h3", null, "Last 12 weeks"),
            h("span.v-muted", null, "every research run, day by day")), heat),
          h("div.ana-grid", null,
            h("div.v-card", null, h("h3", null, "Runs by depth"), chDonut(byDepth, String(reports.length), "reports")),
            h("div.v-card", null, h("h3", null, "Most-sourced reports"),
              topReports.length ? chBars(topReports, " src") : h("p.v-muted", null, "Finish a research run to see this."))),
          h("p.v-muted.ana-note", null, `${exportsN} export${exportsN === 1 ? "" : "s"} in this period.`))
        : emptyState("chart", "No activity yet", "Run research in this period and your activity will chart here.",
          h("a.v-btn.primary.sm", { href: "#/app/research" }, "Start researching")));
  };
  paintA();
  return root;
}

/* ═══ SETTINGS ═══ */
export function renderSettings(): HTMLElement {
  const u = ST.root.user;
  const nameI = h("input.v-input", { value: u?.name || "" }) as HTMLInputElement;
  const mailI = h("input.v-input", { value: u?.email || "", type: "email" }) as HTMLInputElement;
  const wsI = h("input.v-input", { value: ST.wsMeta.name }) as HTMLInputElement;

  const wsList = h("div.list");
  const paintWs = () => {
    wsList.innerHTML = "";
    for (const w of ST.root.workspaces) {
      const kebab = h("button.v-iconbtn", {
        onclick: (e: Event) => popMenu(e.currentTarget as HTMLElement, [
          { label: "Switch to", icon: "grid", on: () => { ST.switchWorkspace(w.id); location.reload(); } },
          { label: "Delete", icon: "trash", danger: true, on: () => {
            if (!ST.deleteWorkspace(w.id)) { toast("You need at least one workspace.", "error"); return; }
            paintWs(); toast("Workspace deleted.");
          } },
        ]),
      }, icon("dots", 16));
      wsList.append(h("div.list-row", null,
        h("span.row-icn.green", null, icon("grid", 16)),
        h("div.row-main", null, h("strong", null, w.name + (w.id === ST.root.activeWs ? "  (current)" : "")),
          h("span", null, `created ${fmtDate(w.created)}`)),
        kebab));
    }
  };
  paintWs();

  return h("div.page.settings-page", null,
    h("div.page-head", null, h("div", null, h("h1", null, "Settings"), h("p.page-sub", null, "Profile, workspaces and your data."))),

    h("div.v-card", null, h("h3", null, "Profile"),
      h("div.set-grid", null,
        h("label.v-field", null, "Name", nameI),
        h("label.v-field", null, "Email", mailI)),
      h("button.v-btn.primary.sm", { onclick: () => {
        if (!nameI.value.trim()) { toast("Name can't be empty.", "error"); return; }
        ST.signIn(nameI.value.trim(), mailI.value.trim());
        toast("Profile saved.");
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } }, "Save profile")),

    h("div.v-card", null, h("h3", null, "Current workspace"),
      h("div.set-grid", null, h("label.v-field", null, "Workspace name", wsI)),
      h("button.v-btn.primary.sm", { onclick: () => {
        if (wsI.value.trim()) { ST.renameWorkspace(ST.root.activeWs, wsI.value.trim()); toast("Workspace renamed."); window.dispatchEvent(new HashChangeEvent("hashchange")); }
      } }, "Rename workspace"),
      h("h3.set-sub", null, "All workspaces"), wsList),

    h("div.v-card", null, h("h3", null, "Your data"),
      h("p.v-muted", null, "Reports, projects and analytics live in this browser. Export a backup any time; knowledge-base file contents are not included in the JSON backup."),
      h("div.set-actions", null,
        h("button.v-btn.ghost.sm", { onclick: exportData }, icon("download", 15), "Export data (JSON)"),
        h("button.v-btn.danger.sm", { onclick: () =>
          confirmBox("Clear this workspace?", "All projects, reports, knowledge files and analytics in this workspace will be permanently removed.", "Clear workspace", async () => {
            for (const r of ST.ws.reports) await dbDel("reports", r.id);
            for (const d of ST.ws.docs) await dbDel("files", d.id);
            ST.root.byWs[ST.root.activeWs] = { projects: [], reports: [], docs: [], events: [], notifs: [] };
            ST.save(); toast("Workspace cleared.");
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          }) }, icon("trash", 15), "Clear workspace"))));
}

function exportData(): void {
  const data = JSON.stringify(ST.root, null, 2);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  a.download = "nyna-backup.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 400);
  toast("Backup downloaded.");
}
