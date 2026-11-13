/* ── Research: input screen + live progress ────────────────────────── */
import { h, frag, icon, toast, uid, popMenu } from "./u.js";
import { ST, dbPut, dbGet, VFilePayload } from "./store.js";
import { runResearch, RReport, ResearchRun } from "./net.js";

const SUGGESTIONS = [
  "Compare LLMs for enterprise use",
  "EV market in India 2026",
  "AI in healthcare — current evidence",
  "Semiconductor supply chain risks",
];

let liveSourceCount = 0;
let clockTimer = 0;
function clockStr(): string {
  if (!live) return "00:00";
  const s = Math.floor((Date.now() - live.startedAt) / 1000);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

interface LiveState {
  q: string; depth: string; run: ResearchRun | null;
  steps: { label: string; state: "todo" | "doing" | "done" }[];
  feed: { icn: string; text: string }[];
  draft: string; startedAt: number;
}
let live: LiveState | null = null;

export function renderResearchHome(): HTMLElement {
  const ta = h("textarea.ask-input", {
    placeholder: "e.g., “Analyse the impact of generative AI on the job market in India”",
    rows: 3,
  }) as HTMLTextAreaElement;

  let depth = "standard";
  const depthBtn = h("button.pill-btn", {
    onclick: () => popMenu(depthBtn, [
      { label: "Standard — fast, focused (recommended)", icon: "zap", on: () => { depth = "standard"; depthLabel.textContent = "Standard"; } },
      { label: "Deep — more sources and checks", icon: "layers", on: () => { depth = "deep"; depthLabel.textContent = "Deep Research"; } },
    ]),
  }, icon("layers", 15), undefined as never);
  const depthLabel = h("span", null, "Standard");
  depthBtn.append(depthLabel, icon("chevd", 13));

  /* knowledge-base context picker */
  const usable = ST.ws.docs.filter(d => d.hasText);
  const picked = new Set<string>();
  const filesBtn = h("button.pill-btn", {
    onclick: () => {
      if (!usable.length) { toast("Upload notes, markdown or CSV files to the Knowledge Base first.", "error"); return; }
      popMenu(filesBtn, usable.map(d => ({
        label: (picked.has(d.id) ? "✓ " : "") + d.name, icon: "file",
        on: () => { picked.has(d.id) ? picked.delete(d.id) : picked.add(d.id); syncFiles(); },
      })));
    },
  }, icon("file", 15), undefined as never);
  const filesLabel = h("span", null, "Files");
  filesBtn.append(filesLabel, icon("chevd", 13));
  const syncFiles = () => {
    filesLabel.textContent = picked.size ? `Files (${picked.size})` : "Files";
    filesBtn.classList.toggle("on", picked.size > 0);
  };

  const start = async () => {
    const q = ta.value.trim();
    if (q.length < 8) { toast("Describe what you want to research (a full question works best).", "error"); ta.focus(); return; }
    const context: { name: string; text: string }[] = [];
    for (const id of picked) {
      const docMeta = ST.ws.docs.find(d => d.id === id);
      const payload = await dbGet<VFilePayload>("files", id);
      if (docMeta && payload?.text) context.push({ name: docMeta.name, text: payload.text.slice(0, 2500) });
    }
    beginRun(q, depth, context);
  };

  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void start(); }
  });

  const recent = ST.ws.reports.slice(0, 3);

  return h("div.page.ask-page", null,
    h("div.ask-hero", null,
      h("h1", null, "What do you want to research today?"),
      h("p.ask-sub", null, "Ask anything, from market analysis to complex technical topics."),
      h("div.ask-card", null,
        ta,
        h("div.ask-row", null,
          h("div.ask-row-left", null,
            depthBtn,
            h("span.pill-static", { title: "Verity always researches with live web search" }, icon("globe", 15), "Web"),
            filesBtn),
          h("button.v-btn.primary.send-btn", { "aria-label": "Start research", onclick: () => void start() }, icon("send", 17)))),
      h("div.ask-sugs", null, ...SUGGESTIONS.map(s =>
        h("button.sug", { onclick: () => { ta.value = s; ta.focus(); } }, h("span", null, s), icon("external", 13)))),
      recent.length ? h("div.ask-recent", null,
        h("h3", null, "Recent research"),
        ...recent.map(r => h("a.recent-row", { href: "#/app/report/" + r.id },
          icon("doc", 16), h("span.recent-q", null, r.question),
          h("span.recent-meta", null, `${r.sources} sources`)))) : null));
}

/* ── live progress ─────────────────────────────────────────────────── */
export function beginRun(q: string, depth: string, context: { name: string; text: string }[]): void {
  const steps = [
    "Understanding your query", "Planning research steps", "Searching the web",
    "Reading and analysing sources", "Synthesising insights", "Generating structured report",
  ].map((label, i) => ({ label, state: (i === 0 ? "doing" : "todo") as "todo" | "doing" | "done" }));

  live = { q, depth, run: null, steps, feed: [], draft: "", startedAt: Date.now() };
  liveSourceCount = 0;
  clearInterval(clockTimer);
  clockTimer = window.setInterval(() => {
    const el = document.getElementById("prog-clock");
    if (!el || !live) { clearInterval(clockTimer); return; }
    el.textContent = clockStr();
  }, 1000);
  ST.log("run_started", undefined, q);
  location.hash = "#/app/progress";

  let sourceCount = 0, searchCount = 0;
  const setStep = (i: number) => {
    for (let k = 0; k < live!.steps.length; k++)
      live!.steps[k].state = k < i ? "done" : k === i ? "doing" : "todo";
    paintProgress();
  };
  const feed = (icn: string, text: string) => {
    live!.feed.unshift({ icn, text });
    live!.feed = live!.feed.slice(0, 30);
    paintProgress();
  };

  const finish = async (r: RReport) => {
    const id = uid();
    const secs = Math.round((Date.now() - live!.startedAt) / 1000);
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
      if (/writing report/i.test(msg)) setStep(4);
      else if (/verifying/i.test(msg)) setStep(5);
      if (/unavailable|extractive/i.test(msg)) feed("alert", msg);
      else feed("clock", msg);
    },
    plan(subs) { setStep(2); feed("check", `Planned ${subs.length} research angles`); for (const s of subs) feed("spark", s.question); },
    search(query) { searchCount++; setStep(2); feed("search", `Searching: ${query}`); },
    source(s) {
      sourceCount++; liveSourceCount = sourceCount; setStep(3);
      feed("link", `Source [${s.id}] ${s.title}`);
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
      if (live) { live.run = null; paintProgress(msg); }
    },
  });
  paintProgress();
}

export function renderProgress(): HTMLElement {
  if (!live) { location.hash = "#/app/research"; return h("div"); }
  return h("div.page.prog-page#prog-root");
}

function paintProgress(error?: string): void {
  const root = document.getElementById("prog-root");
  if (!root || !live) return;
  const doneCount = live.steps.filter(s => s.state === "done").length;
  const current = live.steps.find(s => s.state === "doing");

  root.innerHTML = "";
  if (error) {
    root.append(h("div.prog-error", null,
      h("span.prog-err-icn", null, icon("alert", 22)),
      h("h2", null, "Research couldn't finish"),
      h("p", null, error),
      h("div.prog-err-actions", null,
        h("button.v-btn.primary", { onclick: () => beginRun(live!.q, live!.depth, []) }, icon("refresh", 15), "Try again"),
        h("button.v-btn.ghost", { onclick: () => { live = null; location.hash = "#/app/research"; } }, "Back to research"))));
    return;
  }

  root.append(
    h("div.prog-head", null,
      h("h1", null, h("span.pulse-dot"), "Research in progress…"),
      h("p", null, "Analysing, searching, and synthesising information from multiple sources."),
      h("p.prog-q", null, "“", live.q, "”")),
    h("div.prog-grid", null,
      h("div.prog-steps", null, ...live.steps.map(s =>
        h("div.prog-step." + s.state, null,
          h("span.step-dot", null, s.state === "done" ? icon("check", 12) : null),
          h("span", null, s.label)))),
      h("div.prog-side", null,
        h("div.prog-visual", null, progressArt(),
          h("div.prog-stat", null,
            h("strong", null, `Step ${Math.min(doneCount + 1, 6)} / 6`),
            h("span#prog-count", null, current ? current.label : "Working…")),
          h("div.prog-meters", null,
            h("div.prog-meter", null, h("span", null, "Time elapsed"), h("strong#prog-clock", null, clockStr())),
            h("div.prog-meter", null, h("span", null, "Sources found"), h("strong#prog-src", null, String(liveSourceCount))))),
        h("div.prog-feed", null,
          h("h3", null, "Agent activity"),
          h("div.prog-feed-list", null, ...live.feed.map(f =>
            h("div.feed-row", null, icon(f.icn, 14), h("span", null, f.text)))),
        ),
        h("button.v-btn.ghost.prog-cancel", {
          onclick: () => { live?.run?.cancel(); live = null; location.hash = "#/app/research"; },
        }, "Cancel research"))));
}

function progressArt(): HTMLElement {
  const w = h("div.prog-art");
  w.innerHTML = `<svg viewBox="0 0 200 120" aria-hidden="true">
    <defs><radialGradient id="pg" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#a78bfa" stop-opacity=".9"/><stop offset="100%" stop-color="#4c1d95" stop-opacity=".15"/>
    </radialGradient></defs>
    <rect width="200" height="120" rx="10" fill="#0e0820"/>
    <circle cx="100" cy="58" r="38" fill="url(#pg)" opacity=".8"/>
    <g stroke="#c4b5fd" stroke-width=".7" fill="none" opacity=".75">
      <ellipse cx="100" cy="58" rx="38" ry="13"/><ellipse cx="100" cy="58" rx="38" ry="26" opacity=".5"/>
      <ellipse cx="100" cy="58" rx="13" ry="38" opacity=".5"/><circle cx="100" cy="58" r="38" opacity=".6"/>
    </g>
    <g fill="#ddd6fe"><circle cx="70" cy="40" r="1.6" class="tw1"/><circle cx="135" cy="70" r="1.6" class="tw2"/>
    <circle cx="112" cy="30" r="1.3" class="tw3"/><circle cx="85" cy="82" r="1.3" class="tw1"/></g>
  </svg>`;
  return w;
}
