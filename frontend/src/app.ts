/* ── Main Application Controller ──────────────────────── */

import type { ReportData, UploadResult } from "./types.js";
import { $, esc, pct, fmt } from "./utils.js";
import { renderMarkdown } from "./markdown.js";
import { drawGraph } from "./graph.js";
import { ResearchStream, uploadFile, fetchHistory, fetchReport, askFollowUp } from "./api.js";
import { ParticleField } from "./particles.js";
import { PipelineIndicator } from "./pipeline.js";

// ── State ─────────────────────────────────────────────
let current: ReportData | null = null;
let chatHistory: { role: string; content: string }[] = [];
let uploads: UploadResult[] = [];
let liveText = "";
let pipeline: PipelineIndicator | null = null;
let particles: ParticleField | null = null;
let activeStream: ResearchStream | null = null;

// ── Init ──────────────────────────────────────────────
export function init(): void {
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
function addKeyboardShortcuts(): void {
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement === document.body) {
      e.preventDefault();
      ($("q") as HTMLInputElement).focus();
    }
    if (e.key === "Escape") {
      ($("q") as HTMLInputElement).blur();
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
      $("report").classList.toggle("hidden", t.dataset.t !== "report");
      $("graph").classList.toggle("hidden", t.dataset.t !== "graph");
      if (t.dataset.t === "graph" && current) drawGraph(current, $("graph"));
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
  div.innerHTML = html;
  if (type) div.dataset.type = type;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ── Skeleton loader ───────────────────────────────────
function showSkeleton(el: HTMLElement): void {
  el.innerHTML = Array.from({ length: 4 }, () =>
    `<div class="skeleton-line" style="width:${60 + Math.random() * 35}%"></div>`
  ).join("");
  el.classList.remove("empty");
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
  if (!question) return;

  btn.disabled = true;
  $("log").innerHTML = "";
  $("score").innerHTML = "";
  $("loadbar").classList.add("active");
  ["conflictCard", "chatCard", "dl"].forEach((id) => $(id).classList.add("hidden"));
  showSkeleton($("report"));

  // Create pipeline
  if (pipeline) pipeline.destroy();
  pipeline = new PipelineIndicator($("log").parentElement!);

  const depth = ($("depth") as HTMLSelectElement).value;
  const tokens = uploads.map((u) => u.token);

  activeStream = new ResearchStream(question, depth, tokens);

  activeStream
    .on("status", (d) => addTrace("• " + esc(d.message), "status"))
    .on("plan", (d) => {
      pipeline?.setStage("plan");
      addTrace(
        '🧭 <b>Plan</b>' +
          (d.time_sensitive ? ' <span class="tag medium">time-sensitive</span>' : "") +
          "<br>" +
          d.subquestions
            .map(
              (s) =>
                `<span style="padding-left:12px">→ ${esc(s.question)} <span class="tag">${esc(s.source)}</span></span>`
            )
            .join("<br>"),
        "plan"
      );
    })
    .on("search", (d) => {
      pipeline?.setStage("search");
      addTrace(
        `🔎 ${esc(d.query)} <span class="tag">${esc(d.kind)}</span>`,
        "search"
      );
    })
    .on("source", (d) => {
      pipeline?.setStage("read");
      addTrace(
        `📄 [${d.id}] <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a>` +
          `<span class="tag ${esc(d.credibility)}">${esc(d.credibility)}</span>` +
          (d.date ? `<span class="tag">${esc(d.date)}</span>` : ""),
        "source"
      );
    })
    .on("writing", (d) => {
      pipeline?.setStage("write");
      liveText = "";
      addTrace(
        d.phase === "draft" ? "📝 Drafting report (live)…" : "📝 Streaming revision…",
        "writing"
      );
      $("report").classList.remove("empty");
      $("report").innerHTML = '<div class="live"></div>';
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
    .on("gaps", (d) =>
      addTrace("🕳️ Filling gaps: " + d.queries.map(esc).join("; "), "gaps")
    )
    .on("conflicts", (d) =>
      addTrace(
        "⚖️ Sources disagree on: " +
          d.conflicts.map((c) => `<b>${esc(c.topic)}</b>`).join("; "),
        "conflicts"
      )
    )
    .on("verify", (d) => {
      pipeline?.setStage("verify");
      addTrace(`✅ Checked ${d.checked}/${d.total} claims`, "verify");
    })
    .on("revise", (d) =>
      addTrace(
        `✍️ Self-correcting ${d.flagged} flagged claims <span class="tag">round ${d.round}</span>`,
        "revise"
      )
    )
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

  function done(): void {
    activeStream?.close();
    activeStream = null;
    btn.disabled = false;
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
    .map(
      (x) =>
        `<div class="conflict"><b>${esc(x.topic)}</b><ul>${x.positions.map((p) => `<li>[${p.source}] ${esc(p.says)}</li>`).join("")}</ul>` +
        (x.assessment ? `<em>${esc(x.assessment)}</em>` : "") +
        `</div>`
    )
    .join("");

  $("chatCard").classList.toggle("hidden", !d.id);
  $("dl").classList.remove("hidden");

  if (!$("graph").classList.contains("hidden")) drawGraph(d, $("graph"));
}

// ── File uploads ──────────────────────────────────────
function initFileUpload(): void {
  const input = $("files") as HTMLInputElement;
  input.addEventListener("change", async () => {
    for (const f of Array.from(input.files || [])) {
      $("filelist").textContent = `Uploading ${f.name}…`;
      const result = await uploadFile(f);
      if (result.token) {
        uploads.push(result);
      } else {
        $("filelist").textContent = `Error: ${result.error}`;
      }
    }
    input.value = "";
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
      `<div class="msg user">${esc(q)}</div><div class="msg bot empty" id="pending">` +
        `<div class="typing-indicator"><span></span><span></span><span></span></div></div>`
    );

    try {
      const r = await askFollowUp(current.id, q, chatHistory);
      const p = $("pending");
      p.removeAttribute("id");
      p.classList.remove("empty");
      if (r.error) {
        p.innerHTML = `<span class="bad">${esc(r.error)}</span>`;
      } else {
        p.innerHTML =
          renderMarkdown(r.answer || "") +
          `<div class="usage" style="margin-top:8px">citation precision ${pct(r.score?.citation_precision)}</div>`;
        chatHistory.push(
          { role: "user", content: q },
          { role: "assistant", content: r.answer || "" }
        );
      }
    } catch {
      const p = document.getElementById("pending");
      if (p) p.textContent = "Request failed";
    }
    ($("cb") as HTMLButtonElement).disabled = false;
  });
}

// ── Download ──────────────────────────────────────────
function initDownload(): void {
  $("dl").addEventListener("click", () => {
    if (!current) return;
    const blob = new Blob(
      [`# ${current.question}\n\n${current.markdown}\n`],
      { type: "text/markdown" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (current.id || "report") + ".md";
    a.click();
  });
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
          `<small>${i.precision != null ? pct(i.precision) + " precision" : ""}</small></a>`
      )
      .join("");
    document.querySelectorAll<HTMLAnchorElement>(".hist").forEach((a) => {
      a.addEventListener("click", async () => {
        const id = a.dataset.id;
        if (!id) return;
        const d = await fetchReport(id);
        $("log").innerHTML = '<div>Loaded saved report.</div>';
        ($("q") as HTMLInputElement).value = d.question;
        showReport(d);
      });
    });
  } catch {
    // silently fail — history is optional
  }
}
