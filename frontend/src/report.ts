/* ── Report view: overview, findings, analysis, sources, export ────── */
import { h, frag, icon, md, esc, toast, modal, popMenu, confirmBox, hostOf, fmtDate, spinner } from "./u.js";
import { ST, dbGet, VReportMeta } from "./store.js";
import { RReport, RClaim, askFollowup } from "./net.js";
import { chDonut, chBars } from "./charts.js";
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

  root.append(
    h("div.rep-topline", null,
      h("a.v-link.back", { href: "#/app/reports" }, icon("back", 15), "Back to Reports"),
      h("div.rep-actions", null,
        projBtn,
        h("button.v-btn.ghost.sm", { onclick: () => exportModal(meta, r) }, icon("download", 15), "Export", icon("chevd", 13)),
        h("button.v-btn.primary.sm", { onclick: () => shareModal(meta, r) }, icon("share", 15), "Share"),
        h("button.v-iconbtn", {
          title: "More", onclick: (e: Event) => popMenu(e.currentTarget as HTMLElement, [
            { label: "Ask a follow-up", icon: "help", on: () => askPanel(r) },
            { label: "Delete report", icon: "trash", danger: true, on: () =>
              confirmBox("Delete report?", "This removes the report from your workspace permanently.", "Delete", () => {
                ST.deleteReport(id); toast("Report deleted."); location.hash = "#/app/reports";
              }) },
          ]),
        }, icon("dots", 16)))),
    h("h1.rep-title", null, r.question || meta.question),
    tabBar, body);
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

  body.append(
    h("div.rep-overview-grid", null,
      h("div", null,
        h("div.exec-card", null,
          h("h3", null, "Executive Summary"),
          h("div.exec-text", { html: md(firstParagraph(r.markdown)) })),
        takeaways.length ? h("div.takeaways", null,
          h("h3", null, "Key Takeaways"),
          ...takeaways.map(c => h("div.tk-row", null,
            h("span.tk-icn." + labelClass(c.label), null, icon(labelIcon(c.label), 13)),
            h("span", { html: inlineMd(c.text) })))) : null),
      stat),
    h("article.rep-article", { html: md(r.markdown) }));
  wireCites(body, r);
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
    { label: "Supported", value: s.supported, color: "var(--green-600)" },
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
    const mapEl = sourceMap(r.sources, (id) => {
      document.getElementById("src-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("src-" + id)?.classList.add("src-flash");
      setTimeout(() => document.getElementById("src-" + id)?.classList.remove("src-flash"), 1600);
    });
    const mapCard = h("div.smap-card", null,
      h("div.smap-head", null,
        h("h3", null, "Sources & Evidence"),
        h("div.smap-toggle", null,
          h("button.smap-tbtn.on#smap-b1", { onclick: () => { mapOn = true; sync(); } }, "Source Map"),
          h("button.smap-tbtn#smap-b2", { onclick: () => { mapOn = false; sync(); } }, "List View"))),
      mapEl);
    const sync = () => {
      mapEl.style.display = mapOn ? "" : "none";
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
function askPanel(r: RReport): void {
  const history: { role: string; content: string }[] = [];
  const log = h("div.ask-log");
  const inp = h("input.v-input", { placeholder: "Ask about this report…" }) as HTMLInputElement;
  const send = async () => {
    const q = inp.value.trim(); if (!q) return;
    inp.value = "";
    log.append(h("div.ask-msg.me", null, q));
    const wait = h("div.ask-msg.ai", null, spinner("Thinking…"));
    log.append(wait); log.scrollTop = log.scrollHeight;
    const res = await askFollowup(r, q, history);
    wait.remove();
    if ("error" in res) {
      log.append(h("div.ask-msg.ai.err", null, "Couldn't answer: " + res.error));
    } else {
      history.push({ role: "user", content: q }, { role: "assistant", content: res.answer });
      log.append(h("div.ask-msg.ai", { html: md(res.answer) }));
    }
    log.scrollTop = log.scrollHeight;
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") void send(); });
  modal({
    title: "Ask a follow-up", sub: "Answers stay grounded in this report's sources.",
    wide: true,
    body: frag(log, h("div.ask-sendrow", null, inp, h("button.v-btn.primary", { onclick: () => void send() }, icon("send", 15)))),
  });
  setTimeout(() => inp.focus(), 60);
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
h1,h2,h3{line-height:1.25}a{color:#15803d}sup{color:#15803d;font-weight:600}blockquote{border-left:3px solid #d1d5db;margin:0;padding:4px 14px;color:#475467}</style>
</head><body>${md(buildMarkdown(r, inc))}<hr><p style="color:#98a2b3;font-size:13px">Generated by Verity AI</p></body></html>`;
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
  const summary = `${r.question}\n\n${firstParagraph(r.markdown).replace(/\[\d+\]/g, "")}\n\n— researched with Verity AI (${r.sources.length} sources, ${meta.precision}% citation precision)`;
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
