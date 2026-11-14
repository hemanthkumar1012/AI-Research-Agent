/* ── Report view: overview, findings, analysis, sources, export ────── */
import { h, frag, icon, md, esc, toast, modal, popMenu, confirmBox, hostOf, fmtDate, spinner } from "./u.js";
import { ST, dbGet, dbPut, VReportMeta } from "./store.js";
import { RReport, RClaim, askFollowup } from "./net.js";
import { chDonut, chBars } from "./charts.js";
import { beginRun } from "./research.js";
import { sourceMap } from "./fx.js";

let curTab = "overview";

export function renderReport(id: string): HTMLElement {
  const meta = ST.reportMeta(id);
  const root = h("div.page.rep-page", null, spinner("Loading report…"));
  if (!meta) { root.innerHTML = ""; root.append(h("p.v-muted", null, "This report was not found in the current workspace.")); return root; }

  void dbGet<RReport>("reports", id).then(r => {
    root.innerHTML = "";
    if (!r) { root.append(h("p.v-muted", null, "Report data is missing from local storage.")); return; }
    curTab = "overview";
    paint(root, id, meta, r);
  });
  return root;
}

function paint(root: HTMLElement, id: string, meta: VReportMeta, r: RReport): void {
  const tabs: [string, string][] = [
    ["overview", "Overview"], ["findings", "Key Findings"], ["analysis", "Analysis"],
    ["sources", `Sources (${r.sources.length})`],
  ];
  const body = h("div.rep-body");
  const tabBar = h("div.rep-tabs", null, ...tabs.map(([k, label]) =>
    h("button.rep-tab" + (curTab === k ? ".on" : ""), {
      onclick: (e: Event) => {
        curTab = k;
        tabBar.querySelectorAll(".rep-tab").forEach(t => t.classList.remove("on"));
        (e.currentTarget as HTMLElement).classList.add("on");
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
        if (name?.trim()) { const p = ST.addProject(name.trim()); ST.assignReport(id, p.id); refreshProjLabel(); toast(`Added to “${p.name}”.`); }
      } } as never);
      popMenu(projBtn, items);
    },
  }, icon("folder", 15), undefined as never);
  const projLabel = h("span", null, "");
  projBtn.append(projLabel, icon("chevd", 13));
  const refreshProjLabel = () => {
    const p = meta.projectId ? ST.project(meta.projectId) : undefined;
    projLabel.textContent = p ? p.name : "Add to project";
  };
  refreshProjLabel();

  const starBtn = h("button.v-iconbtn.star-btn" + (meta.starred ? ".on" : ""), {
    title: meta.starred ? "Unstar" : "Star this report",
    "aria-pressed": String(!!meta.starred),
    onclick: () => {
      ST.toggleStar(id);
      const on = !!ST.reportMeta(id)?.starred;
      starBtn.classList.toggle("on", on);
      starBtn.setAttribute("aria-pressed", String(on));
      toast(on ? "Report starred." : "Star removed.");
    },
  }, icon("star", 17));

  root.append(
    h("div.rep-topline", null,
      h("a.v-link.back", { href: "#/app/reports" }, icon("back", 15), "Back to Reports"),
      h("div.rep-actions", null,
        starBtn,
        projBtn,
        h("button.v-btn.ghost.sm", { onclick: () => exportModal(meta, r) }, icon("download", 15), "Export", icon("chevd", 13)),
        h("button.v-btn.primary.sm", { onclick: () => shareModal(meta, r) }, icon("share", 15), "Share"),
        h("button.v-iconbtn", {
          title: "More", onclick: (e: Event) => popMenu(e.currentTarget as HTMLElement, [
            { label: "Ask a follow-up", icon: "help", on: () => {
              const d = document.querySelector(".ask-dock");
              d?.classList.add("open");
              (d?.querySelector("input") as HTMLInputElement)?.focus();
            } },
            { label: "Re-run this research", icon: "refresh", on: () =>
              beginRun(meta.question, meta.depth === "deep" ? "deep" : "standard", []) },
            { label: "Compare with…", icon: "layers", on: () => {
              const others = ST.ws.reports.filter(x => x.id !== id);
              if (!others.length) { toast("Run another research first to compare.", "error"); return; }
              popMenu(document.querySelector(".rep-actions .v-iconbtn[title=More]") as HTMLElement || root,
                others.slice(0, 10).map(o => ({ label: o.question.slice(0, 50), icon: "doc",
                  on: () => { location.hash = `#/app/compare/${id}/${o.id}`; } })));
            } },
            { label: "Delete report", icon: "trash", danger: true, on: () =>
              confirmBox("Delete report?", "This removes the report from your workspace permanently.", "Delete", () => {
                ST.deleteReport(id); toast("Report deleted."); location.hash = "#/app/reports";
              }) },
          ]),
        }, icon("dots", 16)))),
    h("h1.rep-title", null, r.question || meta.question),
    tabBar, body, askDock(id, r));
  paintTab(body, curTab, meta, r);
}

/* ── tabs ──────────────────────────────────────────────────────────── */
function paintTab(body: HTMLElement, tab: string, meta: VReportMeta, r: RReport): void {
  body.innerHTML = "";
  if (tab === "overview") return overviewTab(body, meta, r);
  if (tab === "findings") return findingsTab(body, r);
  if (tab === "analysis") return analysisTab(body, meta, r);
  if (tab === "sources") return sourcesTab(body, r);
}

function firstParagraph(markdown: string): string {
  for (const block of markdown.split(/\n{2,}/)) {
    const t = block.trim();
    if (t && !t.startsWith("#") && !t.startsWith("*The language model") && t.length > 80) return t;
  }
  return markdown.slice(0, 400);
}

function overviewTab(body: HTMLElement, meta: VReportMeta, r: RReport): void {
  const takeaways = r.claims.slice(0, 4);
  const stat = h("div.rep-stat-card", null,
    h("span.rep-stat-label", null, "Research snapshot"),
    h("div.rep-stat-num", null, String(r.sources.length)), h("span.rep-stat-sub", null, "sources analysed"),
    h("div.rep-stat-row", null, h("span", null, "Cited claims"), h("strong", null, String(r.score.claims || r.claims.length))),
    h("div.rep-stat-row", null, h("span", null, "Citation precision"), h("strong", null, meta.precision + "%")),
    h("div.rep-stat-row", null, h("span", null, "Depth"), h("strong", null, meta.depth === "deep" ? "Deep" : "Standard")),
    h("div.rep-stat-row", null, h("span", null, "Completed"), h("strong", null, fmtDate(meta.created))));

  const words = (r.markdown.match(/\S+/g) || []).length;
  const domains = [...new Set(r.sources.map(src => hostOf(src.url)))];
  const metaBar = h("div.rep-meta-bar", null,
    h("span.rep-meta-chip", null, icon("clock", 13), `${Math.max(1, Math.round(words / 220))} min read`),
    h("span.rep-meta-chip", null, icon("edit", 13), `${words.toLocaleString()} words`),
    ...domains.slice(0, 5).map(d => h("span.rep-meta-chip.domain", null, icon("globe", 13), d)),
    domains.length > 5 ? h("span.rep-meta-chip", null, `+${domains.length - 5} more`) : null);

  const article = h("article.rep-article", { html: md(r.markdown) });
  // Build a table of contents from the report's own sections
  const heads = Array.from(article.querySelectorAll("h2, h3")).slice(0, 14);
  heads.forEach((el, i) => { el.id = "sec-" + i; });
  const toc = heads.length >= 2 ? h("nav.rep-toc", { "aria-label": "Report sections" },
    h("span.rep-stat-label", null, "On this page"),
    ...heads.map((el, i) => h("a.toc-link" + (el.tagName === "H3" ? ".sub" : ""), {
      href: "#", "data-sec": String(i),
      onclick: (e: Event) => { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); },
    }, el.textContent || ""))) : null;

  body.append(
    h("div.rep-overview-grid", null,
      h("div", null,
        metaBar,
        h("div.exec-card", null,
          h("h3", null, "Executive Summary"),
          h("div.exec-text", { html: md(firstParagraph(r.markdown)) })),
        takeaways.length ? h("div.takeaways", null,
          h("h3", null, "Key Takeaways"),
          ...takeaways.map(c => h("div.tk-row", null,
            h("span.tk-icn." + labelClass(c.label), null, icon(labelIcon(c.label), 13)),
            h("span", { html: inlineMd(c.text) })))) : null),
      h("div.rep-rail", null, stat, toc)),
    article);
  wireCites(body, r);

  if (toc && "IntersectionObserver" in window) {   // scrollspy
    const links = toc.querySelectorAll<HTMLElement>(".toc-link");
    const io = new IntersectionObserver((es) => {
      for (const en of es) if (en.isIntersecting) {
        links.forEach(l => l.classList.toggle("on", l.dataset.sec === (en.target as HTMLElement).id.slice(4)));
      }
    }, { rootMargin: "-10% 0px -70% 0px" });
    heads.forEach(hd => io.observe(hd));
  }
}

function findingsTab(body: HTMLElement, r: RReport): void {
  if (!r.claims.length) {
    body.append(h("p.v-muted", null, "No individual claims were extracted for this report (citation verification was skipped to stay within the time limit)."));
    body.append(h("article.rep-article", { html: md(r.markdown) }));
    return;
  }
  const groups: [string, string, RClaim[]][] = [
    ["supported", "Verified findings", r.claims.filter(c => c.label === "supported")],
    ["partial", "Partially supported", r.claims.filter(c => c.label === "partial")],
    ["unchecked", "Awaiting verification", r.claims.filter(c => c.label !== "supported" && c.label !== "partial" && c.label !== "unsupported")],
    ["unsupported", "Not supported by sources", r.claims.filter(c => c.label === "unsupported")],
  ];
  for (const [cls, title, claims] of groups) {
    if (!claims.length) continue;
    body.append(h("h3.find-h." + cls, null, icon(labelIcon(cls), 15), `${title} (${claims.length})`));
    for (const c of claims) {
      body.append(h("div.find-card." + cls, null,
        h("p", { html: inlineMd(c.text) }),
        h("div.find-meta", null,
          ...c.cites.map(n => h("button.cite-chip", {
            onclick: () => { curTabSet("sources"); },
          }, `[${n}] ${r.sources.find(s => s.id === n)?.title.slice(0, 40) || "source"}`)),
          c.reason ? h("span.find-reason", null, c.reason) : null)));
    }
  }
}

function analysisTab(body: HTMLElement, meta: VReportMeta, r: RReport): void {
  const s = r.score;
  const donut = chDonut([
    { label: "Supported", value: s.supported, color: "var(--lime-500)" },
    { label: "Partial", value: s.partial, color: "#f59e0b" },
    { label: "Unsupported", value: s.unsupported, color: "#ef4444" },
    { label: "Unchecked", value: Math.max(0, (s.claims || r.claims.length) - s.supported - s.partial - s.unsupported), color: "#cbd5e1" },
  ], meta.precision + "%", "citation precision");

  const credOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const credRows = r.sources
    .slice().sort((a, b) => (credOrder[b.credibility] || 0) - (credOrder[a.credibility] || 0))
    .map(src => ({ label: `[${src.id}] ${hostOf(src.url)}`, value: credOrder[src.credibility] || 1, hint: src.credibility }));

  body.append(frag(
    h("div.ana-grid", null,
      h("div.v-card", null, h("h3", null, "Claim verification"), donut),
      h("div.v-card", null, h("h3", null, "Source credibility"), chBars(credRows)),
    ),
    r.plan?.length ? h("div.v-card.ana-plan", null,
      h("h3", null, "Research plan the agent followed"),
      h("ol.plan-list", null, ...r.plan.map(p => h("li", null,
        h("strong", null, p.question), h("span.plan-q", null, ` — searched “${p.query}” (${p.source})`))))) : null,
    r.conflicts?.length ? h("div.v-card", null,
      h("h3", null, "Source disagreements"),
      ...(r.conflicts as { topic?: string }[]).map(c => h("p.v-muted", null, String(c.topic || "")))) : null));
}

function sourcesTab(body: HTMLElement, r: RReport): void {
  if (!r.sources.length) {
    body.append(h("p.v-muted", null, "No sources were captured for this run.")); return;
  }
  if (r.sources.length > 1) {
    let mapOn = true;
    const cred = { high: true, medium: true, low: true };
    let mapEl: HTMLElement;
    const jump = (id: number) => {
      document.getElementById("src-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("src-" + id)?.classList.add("src-flash");
      setTimeout(() => document.getElementById("src-" + id)?.classList.remove("src-flash"), 1600);
    };
    const buildMap = () => {
      const subset = r.sources.filter(src => cred[src.credibility as keyof typeof cred] ?? true);
      if (!subset.length) return h("div.smap.smap-none", null,
        icon("search", 18), h("span", null, "No sources match the credibility filters."));
      return sourceMap(subset, jump);
    };
    mapEl = buildMap();
    const credChip = (k: keyof typeof cred, label: string) => {
      const b = h("button.cred-chip." + k + ".on", {
        "aria-pressed": "true",
        onclick: () => {
          cred[k] = !cred[k];
          b.classList.toggle("on", cred[k]);
          b.setAttribute("aria-pressed", String(cred[k]));
          const fresh = buildMap();
          mapEl.replaceWith(fresh); mapEl = fresh;
          sync();
        },
      }, h("i"), label);
      return b;
    };
    const credRow = h("div.cred-row", null,
      credChip("high", "High"), credChip("medium", "Medium"), credChip("low", "Low"));
    const mapCard = h("div.smap-card", null,
      h("div.smap-head", null,
        h("h3", null, "Sources & Evidence"),
        h("div.smap-toggle", null,
          h("button.smap-tbtn.on#smap-b1", { onclick: () => { mapOn = true; sync(); } }, "Source Map"),
          h("button.smap-tbtn#smap-b2", { onclick: () => { mapOn = false; sync(); } }, "List View"))),
      credRow, mapEl);
    const sync = () => {
      mapEl.style.display = mapOn ? "" : "none";
      credRow.style.display = mapOn ? "" : "none";
      document.getElementById("smap-b1")?.classList.toggle("on", mapOn);
      document.getElementById("smap-b2")?.classList.toggle("on", !mapOn);
    };
    body.append(mapCard);
  }
  for (const s of r.sources) {
    body.append(h("div.src-card#src-" + s.id, null,
      h("span.src-n", null, String(s.id)),
      h("div.src-main", null,
        h("div.src-top", null,
          h("strong.src-title", null, s.title),
          h("a.v-iconbtn", { href: s.url, target: "_blank", rel: "noopener", title: "Open source" }, icon("external", 15))),
        h("a.src-url", { href: s.url, target: "_blank", rel: "noopener" }, s.url),
        h("div.src-meta", null,
          h("span.src-badge." + s.credibility, null, s.credibility + " credibility"),
          h("span.src-host", null, hostOf(s.url)),
          s.date ? h("span.src-date", null, s.date) : null),
        s.passages?.length ? h("details.src-quote", null,
          h("summary", null, "Key passage used"),
          h("blockquote", null, s.passages[0].slice(0, 500) + (s.passages[0].length > 500 ? "…" : ""))) : null)));
  }
}

/* ── follow-up ask ─────────────────────────────────────────────────── */
function askDock(reportId: string, r: RReport): HTMLElement {
  const history: { role: string; content: string }[] = [];
  const log = h("div.ask-log.dock-log");
  const bubble = (cls: string, html: string) => h("div.ask-msg." + cls, { html });

  void dbGet<{ role: string; content: string }[]>("reports", reportId + ":thread").then(saved => {
    for (const m of saved || []) {
      history.push(m);
      log.append(m.role === "user" ? h("div.ask-msg.me", null, m.content) : bubble("ai", md(m.content)));
    }
    log.scrollTop = log.scrollHeight;
  });

  const inp = h("input.v-input", { placeholder: "Ask Nyna about this report…" }) as HTMLInputElement;
  const send = async () => {
    const q = inp.value.trim(); if (!q) return;
    inp.value = "";
    dock.classList.add("open");
    log.append(h("div.ask-msg.me", null, q));
    const wait = h("div.ask-msg.ai", null, spinner("Thinking…"));
    log.append(wait); log.scrollTop = log.scrollHeight;
    const res = await askFollowup(r, q, history);
    wait.remove();
    if ("error" in res) {
      log.append(h("div.ask-msg.ai.err", null, "Couldn't answer: " + res.error));
    } else {
      history.push({ role: "user", content: q }, { role: "assistant", content: res.answer });
      void dbPut("reports", reportId + ":thread", history.slice(-24));
      log.append(bubble("ai", md(res.answer)));
      ST.log("followup");
    }
    log.scrollTop = log.scrollHeight;
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") void send(); });
  inp.addEventListener("focus", () => dock.classList.add("open"));

  const dock = h("aside.ask-dock", { "aria-label": "Ask Nyna" },
    h("button.ask-dock-head", {
      onclick: () => dock.classList.toggle("open"),
      "aria-expanded": "false",
    }, h("span.ask-dock-orb"), h("strong", null, "Ask Nyna"),
      h("span.ask-dock-sub", null, "grounded in this report"), icon("chevd", 14)),
    h("div.ask-dock-body", null, log,
      h("div.ask-sendrow", null, inp,
        h("button.v-btn.primary", { "aria-label": "Send", onclick: () => void send() }, icon("send", 15)))));
  return dock;
}

/* ── export & share ────────────────────────────────────────────────── */
function buildMarkdown(r: RReport, inc: { src: boolean; sum: boolean }): string {
  let out = r.markdown;
  if (!inc.src) out = out.replace(/\n## Sources[\s\S]*$/, "");
  if (inc.sum) out = out; // summary is part of the report body
  return out;
}
function download(name: string, mime: string, content: string | Blob): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function reportHtml(r: RReport, inc: { src: boolean; sum: boolean }): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(r.question)}</title>
<style>body{font:15px/1.65 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a2332;max-width:760px;margin:40px auto;padding:0 20px}
h1,h2,h3{line-height:1.25}a{color:#7c3aed}sup{color:#7c3aed;font-weight:600}blockquote{border-left:3px solid #d1d5db;margin:0;padding:4px 14px;color:#475467}</style>
</head><body>${md(buildMarkdown(r, inc))}<hr><p style="color:#98a2b3;font-size:13px">Generated by Nyna AI</p></body></html>`;
}

function exportModal(meta: VReportMeta, r: RReport): void {
  let fmt = "pdf";
  const inc = { src: true, charts: true, sum: true };
  const fmts: [string, string, string][] = [
    ["pdf", "PDF", "Best for sharing"], ["md", "Markdown", "For docs and GitHub"],
    ["doc", "Word (.doc)", "Editable document"], ["html", "HTML", "Self-contained page"],
  ];
  const cards = h("div.exp-grid", null, ...fmts.map(([k, name, sub]) =>
    h("button.exp-card" + (fmt === k ? ".on" : ""), {
      onclick: (e: Event) => {
        fmt = k;
        cards.querySelectorAll(".exp-card").forEach(c => c.classList.remove("on"));
        (e.currentTarget as HTMLElement).classList.add("on");
      },
    }, h("span.exp-icn." + k, null, icon(k === "pdf" ? "doc" : k === "md" ? "file" : k === "doc" ? "edit" : "globe", 18)),
    h("strong", null, name), h("span", null, sub))));

  const tgl = (key: keyof typeof inc, label: string) => {
    const b = h("button.v-toggle" + (inc[key] ? ".on" : ""), {
      role: "switch", "aria-checked": String(inc[key]),
      onclick: () => { inc[key] = !inc[key]; b.classList.toggle("on", inc[key]); b.setAttribute("aria-checked", String(inc[key])); },
    }, h("span.v-knob"));
    return h("div.exp-opt", null, h("span", null, label), b);
  };

  const slug = (r.question || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  const m = modal({
    title: "Export Report", sub: "Choose your export format and options.",
    body: frag(cards, h("div.exp-opts", null,
      tgl("src", "Include sources and citations"),
      tgl("charts", "Include charts and tables"),
      tgl("sum", "Include executive summary"))),
    footer: frag(
      h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"),
      h("button.v-btn.primary", {
        onclick: () => {
          const mdText = buildMarkdown(r, inc);
          if (fmt === "md") download(slug + ".md", "text/markdown", mdText);
          else if (fmt === "html") download(slug + ".html", "text/html", reportHtml(r, inc));
          else if (fmt === "doc") download(slug + ".doc", "application/msword", reportHtml(r, inc));
          else printPdf(r, inc);
          ST.log("export", undefined, fmt);
          m.close();
          toast(fmt === "pdf" ? "Print dialog opened — choose “Save as PDF”." : "Export downloaded.");
        },
      }, icon("download", 15), "Export")),
  });
}

function printPdf(r: RReport, inc: { src: boolean; sum: boolean }): void {
  const w = window.open("", "_blank");
  if (!w) { toast("Allow pop-ups to export as PDF.", "error"); return; }
  w.document.write(reportHtml(r, inc));
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 250);
}

function shareModal(meta: VReportMeta, r: RReport): void {
  const summary = `${r.question}\n\n${firstParagraph(r.markdown).replace(/\[\d+\]/g, "")}\n\n— researched with Nyna AI (${r.sources.length} sources, ${meta.precision}% citation precision)`;
  const ta = h("textarea.v-input.share-ta", { rows: 7 }) as HTMLTextAreaElement;
  ta.value = summary;
  const m = modal({
    title: "Share report", sub: "Copy a summary, or export a file to attach.",
    body: frag(ta),
    footer: frag(
      h("button.v-btn.ghost", { onclick: () => { exportModal(meta, r); m.close(); } }, icon("download", 15), "Export file instead"),
      h("button.v-btn.primary", {
        onclick: async () => {
          try { await navigator.clipboard.writeText(ta.value); toast("Summary copied to clipboard."); }
          catch { ta.select(); document.execCommand("copy"); toast("Summary copied."); }
          ST.log("share"); m.close();
        },
      }, icon("copy", 15), "Copy summary")),
  });
}

/* ── small helpers ─────────────────────────────────────────────────── */
function labelClass(l: string): string {
  return l === "supported" ? "ok" : l === "partial" ? "mid" : l === "unsupported" ? "bad" : "na";
}
function labelIcon(l: string): string {
  return l === "supported" ? "check" : l === "partial" ? "alert" : l === "unsupported" ? "x" : "clock";
}
function inlineMd(t: string): string {
  return esc(t).replace(/\[(\d{1,2})\]/g, '<sup class="cite">[$1]</sup>');
}
function curTabSet(tab: string): void {
  const btns = document.querySelectorAll(".rep-tab");
  btns.forEach((b, i) => {
    const keys = ["overview", "findings", "analysis", "sources"];
    if (keys[i] === tab) (b as HTMLElement).click();
  });
}
function wireCites(scope: HTMLElement, r: RReport): void {
  scope.querySelectorAll("sup.cite[data-cite]").forEach(el => {
    el.addEventListener("click", () => {
      curTabSet("sources");
      setTimeout(() => document.getElementById("src-" + el.getAttribute("data-cite"))?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    });
  });
}


/* ── Compare two reports side by side ─────────────────────────────── */
export function renderCompare(idA: string, idB: string): HTMLElement {
  const root = h("div.page", null, spinner("Loading comparison…"));
  void Promise.all([dbGet<RReport>("reports", idA), dbGet<RReport>("reports", idB)]).then(([a, b]) => {
    root.innerHTML = "";
    const ma = ST.reportMeta(idA), mb = ST.reportMeta(idB);
    if (!a || !b || !ma || !mb) {
      root.append(h("p.v-muted", null, "One of the reports is missing from this workspace."));
      return;
    }
    const domainsA = new Set(a.sources.map(s => hostOf(s.url)));
    const domainsB = new Set(b.sources.map(s => hostOf(s.url)));
    const shared = [...domainsA].filter(d => domainsB.has(d));

    const col = (m: typeof ma, r: RReport, other: typeof ma) => h("div.cmp-col", null,
      h("a.cmp-title", { href: "#/app/report/" + m.id }, r.question),
      h("span.cmp-date", null, fmtDate(m.created) + " · " + (m.depth === "deep" ? "Deep" : "Standard")),
      h("div.cmp-stats", null,
        cmpStat("Sources", m.sources, other.sources),
        cmpStat("Cited claims", m.claims, other.claims),
        cmpStat("Citation precision", m.precision, other.precision, "%")),
      h("div.cmp-domains", null,
        h("span.rep-stat-label", null, "Source domains"),
        ...[...new Set(r.sources.map(s => hostOf(s.url)))].slice(0, 8).map(d =>
          h("span.rep-meta-chip" + (shared.includes(d) ? ".shared" : ""), null, d))),
      r.claims.length ? h("div.cmp-claims", null,
        h("span.rep-stat-label", null, "Top findings"),
        ...r.claims.slice(0, 3).map(c => h("div.tk-row", null,
          h("span.tk-icn." + (c.label === "supported" ? "ok" : c.label === "partial" ? "mid" : "na"), null,
            icon(c.label === "supported" ? "check" : "clock", 12)),
          h("span", { html: inlineMd(c.text.slice(0, 160)) })))) : null);

    root.append(
      h("a.v-link.back", { href: "#/app/report/" + idA }, icon("back", 15), "Back to report"),
      h("div.page-head", null, h("div", null,
        h("h1", null, "Compare research"),
        h("p.page-sub", null, shared.length
          ? `${shared.length} shared source domain${shared.length === 1 ? "" : "s"} — highlighted below.`
          : "These reports draw on entirely different sources."))),
      h("div.cmp-grid", null, col(ma, a, mb), h("div.cmp-divider", null, h("span", null, "VS")), col(mb, b, ma)));
  });
  return root;
}

function cmpStat(label: string, v: number, other: number, unit = ""): HTMLElement {
  const cls = v > other ? ".win" : v < other ? ".lose" : "";
  return h("div.cmp-stat" + cls, null,
    h("strong", null, v + unit), h("span", null, label),
    v > other ? icon("check", 12) : null);
}