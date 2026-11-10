/* ── Main Application Controller ──────────────────────── */
/* Wires: theme, commands, particles, pipeline, timeline, */
/*        inspector, perf monitor, toasts, graph, chat    */

import type { ReportData, UploadResult } from "./types.js";
import { $, esc, pct, fmt, timeAgo, debounce } from "./utils.js";
import { renderMarkdown } from "./markdown.js";
import { drawGraph } from "./graph.js";
import { ResearchStream, uploadFile, fetchHistory, fetchReport, askFollowUp } from "./api.js";
import { ParticleField } from "./particles.js";
import { PipelineIndicator } from "./pipeline.js";
import { ThemeEngine } from "./theme.js";
import { initCommandPalette, registerCommands, openPalette, toast } from "./commands.js";
import { renderInspector } from "./inspector.js";
import { ResearchTimeline } from "./timeline.js";
import { PerfMonitor } from "./perfmon.js";

// ── State ─────────────────────────────────────────────
let current: ReportData | null = null;
let chatHistory: { role: string; content: string }[] = [];
let uploads: UploadResult[] = [];
let liveText = "";
let pipeline: PipelineIndicator | null = null;
let particles: ParticleField | null = null;
let activeStream: ResearchStream | null = null;
let theme: ThemeEngine | null = null;
let timeline: ResearchTimeline | null = null;
let perfmon: PerfMonitor | null = null;
let sidebarCollapsed = false;

// ── Init ──────────────────────────────────────────────
export function init(): void {
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
function registerAllCommands(): void {
  registerCommands([
    { id: "search", label: "Focus search", icon: "🔍", shortcut: "/", category: "Navigation",
      action: () => ($("q") as HTMLInputElement).focus() },
    { id: "theme", label: "Cycle theme", icon: "🎨", shortcut: "T", category: "Appearance",
      action: () => { const t = theme!.cycle(); toast(`Theme: ${t}`, "info"); } },
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
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      }
    },
    { id: "clear", label: "Clear current report", icon: "🗑", category: "Actions",
      action: clearReport },
    { id: "history", label: "Show research history", icon: "📚", category: "Navigation",
      action: () => { if (sidebarCollapsed) toggleSidebar(); } },
    { id: "cmd-palette", label: "Command palette", icon: "⌨", shortcut: "⌘K", category: "Navigation",
      action: () => openPalette() },
  ]);
}

// ── Scroll progress indicator ─────────────────────────
function initScrollProgress(): void {
  const main = document.querySelector(".main")!;
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  document.querySelector(".header")?.appendChild(bar);

  main.addEventListener("scroll", () => {
    const el = main as HTMLElement;
    const pct = el.scrollTop / (el.scrollHeight - el.clientHeight);
    bar.style.width = `${Math.min(100, pct * 100)}%`;
  });
}

// ── Sidebar toggle ────────────────────────────────────
function initSidebarToggle(): void {
  const btn = document.createElement("button");
  btn.className = "sidebar-toggle";
  btn.innerHTML = "☰";
  btn.title = "Toggle sidebar";
  btn.addEventListener("click", toggleSidebar);
  document.querySelector(".header")?.appendChild(btn);
}

function toggleSidebar(): void {
  sidebarCollapsed = !sidebarCollapsed;
  document.querySelector(".sidebar")?.classList.toggle("collapsed", sidebarCollapsed);
  document.querySelector(".shell")?.classList.toggle("sidebar-hidden", sidebarCollapsed);
}

// ── Resize handle for trace card ──────────────────────
function initResizeHandle(): void {
  const trace = document.querySelector<HTMLElement>(".trace-card");
  if (!trace) return;
  const handle = document.createElement("div");
  handle.className = "resize-handle";
  trace.appendChild(handle);

  let startY = 0, startH = 0;

  handle.addEventListener("mousedown", (e) => {
    startY = e.clientY;
    startH = trace.offsetHeight;
    const onMove = (ev: MouseEvent) => {
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
function addKeyboardShortcuts(): void {
  document.addEventListener("keydown", (e) => {
    // Don't trigger shortcuts when typing in an input
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      if (e.key === "Escape") (e.target as HTMLElement).blur();
      return;
    }

    if (e.key === "/") { e.preventDefault(); ($("q") as HTMLInputElement).focus(); }
    if (e.key === "t") { theme?.cycle(); toast(`Theme: ${theme!.theme}`, "info"); }
    if (e.key === "p") { perfmon?.toggle(); }
    if (e.key === "[") { toggleSidebar(); }
    if (e.key === "f" && !e.ctrlKey && !e.metaKey) {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
  });
}

// ── Tabs ──────────────────────────────────────────────
function initTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) =>
        x.classList.toggle("on", x === t)
      );
      const target = t.dataset.t || "report";
      $("report").classList.toggle("hidden", target !== "report");
      $("graph").classList.toggle("hidden", target !== "graph");
      $("inspector").classList.toggle("hidden", target !== "inspector");
      $("timelinePanel").classList.toggle("hidden", target !== "timeline");

      if (target === "graph" && current) drawGraph(current, $("graph"));
      if (target === "inspector" && current) renderInspector(current, $("inspector"));
    });
  });
}

// ── Trace log ─────────────────────────────────────────
function addTrace(html: string, type?: string): void {
  const log = $("log");
  if (log.classList.contains("empty")) {
    log.innerHTML = "";
    log.classList.remove("empty");
  }
  const div = document.createElement("div");
  div.innerHTML = `<span class="trace-time">${new Date().toLocaleTimeString()}</span> ${html}`;
  if (type) div.dataset.type = type;
  div.classList.add("trace-entry");
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  perfmon?.recordEvent();
}

// ── Skeleton loader ───────────────────────────────────
function showSkeleton(el: HTMLElement): void {
  el.innerHTML = Array.from({ length: 6 }, () =>
    `<div class="skeleton-line" style="width:${40 + Math.random() * 55}%"></div>`
  ).join("");
  el.classList.remove("empty");
}

// ── Clear report ──────────────────────────────────────
function clearReport(): void {
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
function initForm(): void {
  $("f").addEventListener("submit", (e: Event) => {
    e.preventDefault();
    startResearch();
  });
}

function startResearch(): void {
  const btn = $("b") as HTMLButtonElement;
  const input = $("q") as HTMLInputElement;
  const question = input.value.trim();
  if (!question) { toast("Enter a research question", "warn"); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> Researching…';
  $("log").innerHTML = "";
  $("score").innerHTML = "";
  $("loadbar").classList.add("active");
  ["conflictCard", "chatCard", "dl", "exportMenu"].forEach((id) => $(id).classList.add("hidden"));
  showSkeleton($("report"));

  // Create pipeline
  if (pipeline) pipeline.destroy();
  pipeline = new PipelineIndicator($("log").parentElement!);

  // Create timeline
  if (timeline) timeline.reset();
  timeline = new ResearchTimeline($("timelinePanel"));
  timeline.add("init", "🚀", "Research started");

  toast(`Researching: "${question.slice(0, 50)}${question.length > 50 ? "…" : ""}"`, "info");

  const depth = ($("depth") as HTMLSelectElement).value;
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
      addTrace(
        '🧭 <b>Plan</b>' +
          (d.time_sensitive ? ' <span class="tag medium">time-sensitive</span>' : "") +
          "<br>" +
          d.subquestions
            .map((s) =>
              `<span class="trace-sub">→ ${esc(s.question)} <span class="tag">${esc(s.source)}</span></span>`
            )
            .join("<br>"),
        "plan"
      );
      recordLatency();
    })
    .on("search", (d) => {
      pipeline?.setStage("search");
      timeline?.add("search", "🔎", `Searching: ${d.query}`);
      addTrace(
        `🔎 ${esc(d.query)} <span class="tag">${esc(d.kind)}</span>`,
        "search"
      );
      recordLatency();
    })
    .on("source", (d) => {
      pipeline?.setStage("read");
      timeline?.add("read", "📄", `Reading: ${d.title.slice(0, 40)}`);
      addTrace(
        `📄 [${d.id}] <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a>` +
          `<span class="tag ${esc(d.credibility)}">${esc(d.credibility)}</span>` +
          (d.date ? `<span class="tag">${esc(d.date)}</span>` : ""),
        "source"
      );
      recordLatency();
    })
    .on("writing", (d) => {
      pipeline?.setStage("write");
      liveText = "";
      timeline?.add("write", "📝", d.phase === "draft" ? "Drafting report" : "Revising report");
      addTrace(
        d.phase === "draft" ? "📝 Drafting report (live stream)…" : "📝 Streaming revision…",
        "writing"
      );
      $("report").classList.remove("empty");
      $("report").innerHTML = '<div class="live"></div>';
      recordLatency();
    })
    .on("token", (d) => {
      liveText += d.text;
      const el = $("report").querySelector(".live");
      if (el) el.innerHTML = esc(liveText) + '<span class="cursor"></span>';
    })
    .on("budget", (d) => {
      addTrace(
        `💰 ${esc(d.message)} <span class="tag warn">${fmt(d.used)}/${fmt(d.limit)}</span>`,
        "budget"
      );
    })
    .on("gaps", (d) => {
      timeline?.add("search", "🕳️", `Filling ${d.queries.length} gap(s)`);
      addTrace("🕳️ Filling gaps: " + d.queries.map(esc).join("; "), "gaps");
    })
    .on("conflicts", (d) => {
      timeline?.add("read", "⚖️", `${d.conflicts.length} source conflict(s)`);
      addTrace(
        "⚖️ Sources disagree on: " +
          d.conflicts.map((c) => `<b>${esc(c.topic)}</b>`).join("; "),
        "conflicts"
      );
    })
    .on("verify", (d) => {
      pipeline?.setStage("verify");
      timeline?.add("verify", "✅", `Verified ${d.checked}/${d.total} claims`);
      addTrace(`✅ Checked ${d.checked}/${d.total} claims`, "verify");
      recordLatency();
    })
    .on("revise", (d) => {
      timeline?.add("write", "✍️", `Self-correcting ${d.flagged} claims (round ${d.round})`);
      addTrace(
        `✍️ Self-correcting ${d.flagged} flagged claims <span class="tag">round ${d.round}</span>`,
        "revise"
      );
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

  function recordLatency(): void {
    const now = Date.now();
    perfmon?.recordLatency(now - lastEventTime);
    lastEventTime = now;
  }

  function done(): void {
    activeStream?.close();
    activeStream = null;
    btn.disabled = false;
    btn.innerHTML = '⚡ Research';
    $("loadbar").classList.remove("active");
  }
}

// ── Show report ───────────────────────────────────────
function showReport(d: ReportData): void {
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
  $("report").insertAdjacentHTML("beforeend",
    `<div class="report-meta">${words.toLocaleString()} words · ${d.sources.length} sources · ${d.claims.length} claims</div>`
  );

  const c = d.conflicts || [];
  $("conflictCard").classList.toggle("hidden", !c.length);
  $("conflicts").innerHTML = c
    .map(
      (x) =>
        `<div class="conflict"><b>${esc(x.topic)}</b><ul>${x.positions.map((p) => `<li>[${p.source}] ${esc(p.says)}</li>`).join("")}</ul>` +
        (x.assessment ? `<em>${esc(x.assessment)}</em>` : "") +
        `</div>`
    )
    .join("");

  $("chatCard").classList.toggle("hidden", !d.id);
  $("dl").classList.remove("hidden");
  $("exportMenu").classList.remove("hidden");

  // Update inspector & graph if visible
  if (!$("graph").classList.contains("hidden")) drawGraph(d, $("graph"));
  if (!$("inspector").classList.contains("hidden")) renderInspector(d, $("inspector"));
}

// ── Export options ─────────────────────────────────────
function initExportMenu(): void {
  $("dl").addEventListener("click", () => exportReport("md"));

  // JSON export
  const jsonBtn = document.getElementById("export-json");
  if (jsonBtn) jsonBtn.addEventListener("click", () => exportReport("json"));
  const htmlBtn = document.getElementById("export-html");
  if (htmlBtn) htmlBtn.addEventListener("click", () => exportReport("html"));
}

function exportReport(format: string): void {
  if (!current) { toast("No report to export", "warn"); return; }

  let blob: Blob;
  let ext: string;

  if (format === "json") {
    blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
    ext = "json";
  } else if (format === "html") {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(current.question)}</title>
<style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333}
a{color:#5b4cdb}h1,h2,h3{margin-top:1.5em}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}
pre{background:#f4f4f4;padding:16px;border-radius:8px;overflow-x:auto}blockquote{border-left:3px solid #5b4cdb;padding-left:16px;color:#666}</style>
</head><body><h1>${esc(current.question)}</h1>${renderMarkdown(current.markdown)}
<hr><p><em>Generated by AI Research Agent · ${current.sources.length} sources · Precision: ${pct(current.score.citation_precision)}</em></p></body></html>`;
    blob = new Blob([html], { type: "text/html" });
    ext = "html";
  } else {
    blob = new Blob(
      [`# ${current.question}\n\n${current.markdown}\n\n---\n*${current.sources.length} sources · Precision: ${pct(current.score.citation_precision)}*\n`],
      { type: "text/markdown" }
    );
    ext = "md";
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(current.id || "report")}.${ext}`;
  a.click();
  toast(`Exported as .${ext}`, "success");
}

// ── File uploads ──────────────────────────────────────
function initFileUpload(): void {
  const input = $("files") as HTMLInputElement;
  input.addEventListener("change", async () => {
    for (const f of Array.from(input.files || [])) {
      $("filelist").textContent = `Uploading ${f.name}…`;
      try {
        const result = await uploadFile(f);
        if (result.token) {
          uploads.push(result);
          toast(`Uploaded: ${f.name}`, "success");
        } else {
          toast(`Upload failed: ${result.error}`, "error");
        }
      } catch {
        toast("Upload failed", "error");
      }
    }
    input.value = "";
    renderFileList();
  });

  // Drag and drop
  const card = document.querySelector(".search-card")!;
  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.add("drag-over");
  });
  card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
  card.addEventListener("drop", async (e) => {
    e.preventDefault();
    card.classList.remove("drag-over");
    const files = (e as DragEvent).dataTransfer?.files;
    if (!files) return;
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

function renderFileList(): void {
  if (!uploads.length) {
    $("filelist").innerHTML = "";
    return;
  }
  $("filelist").innerHTML =
    "📎 " +
    uploads.map((u) =>
      `<span class="file-chip">${esc(u.name)}</span>`
    ).join("") +
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
function initChat(): void {
  $("chatform").addEventListener("submit", async (e: Event) => {
    e.preventDefault();
    if (!current?.id) return;
    const input = $("cq") as HTMLInputElement;
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    ($("cb") as HTMLButtonElement).disabled = true;

    $("chat").insertAdjacentHTML(
      "beforeend",
      `<div class="msg user"><div class="msg-avatar">You</div><div class="msg-content">${esc(q)}</div></div>` +
      `<div class="msg bot empty" id="pending"><div class="msg-avatar">AI</div><div class="msg-content">` +
        `<div class="typing-indicator"><span></span><span></span><span></span></div></div></div>`
    );
    $("chat").scrollTop = $("chat").scrollHeight;

    try {
      const r = await askFollowUp(current.id, q, chatHistory);
      const p = $("pending");
      p.removeAttribute("id");
      p.classList.remove("empty");
      const content = p.querySelector(".msg-content")!;
      if (r.error) {
        content.innerHTML = `<span class="bad">${esc(r.error)}</span>`;
      } else {
        content.innerHTML =
          renderMarkdown(r.answer || "") +
          `<div class="usage" style="margin-top:8px">citation precision ${pct(r.score?.citation_precision)}</div>`;
        chatHistory.push(
          { role: "user", content: q },
          { role: "assistant", content: r.answer || "" }
        );
      }
    } catch {
      const p = document.getElementById("pending");
      if (p) {
        const content = p.querySelector(".msg-content");
        if (content) content.textContent = "Request failed";
      }
    }
    ($("cb") as HTMLButtonElement).disabled = false;
    $("chat").scrollTop = $("chat").scrollHeight;
  });
}

// ── Download ──────────────────────────────────────────
function initDownload(): void {
  // Handled in initExportMenu
}

// ── History sidebar ───────────────────────────────────
async function loadHistory(): Promise<void> {
  try {
    const items = await fetchHistory();
    if (!items.length) return;
    $("history").classList.remove("empty");
    $("history").innerHTML = items
      .map(
        (i) =>
          `<a class="hist" data-id="${esc(i.id)}">` +
          `<span class="hist-title">${esc(i.question)}</span>` +
          `<div class="hist-meta">` +
          `<small>${i.precision != null ? pct(i.precision) + " precision" : ""}</small>` +
          `</div></a>`
      )
      .join("");
    document.querySelectorAll<HTMLAnchorElement>(".hist").forEach((a) => {
      a.addEventListener("click", async () => {
        const id = a.dataset.id;
        if (!id) return;
        // Highlight selected
        document.querySelectorAll(".hist").forEach((x) => x.classList.remove("hist-active"));
        a.classList.add("hist-active");

        const d = await fetchReport(id);
        $("log").innerHTML = '<div class="trace-entry">Loaded saved report.</div>';
        ($("q") as HTMLInputElement).value = d.question;
        showReport(d);
        toast("Loaded: " + d.question.slice(0, 40), "info");
      });
    });
  } catch {
    // silently fail — history is optional
  }
}
