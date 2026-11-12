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
import { renderAnalytics } from "./analytics.js";
import { renderHeatmap } from "./heatmap.js";
import { toggleFocus } from "./focus.js";
import { renderConfidence } from "./confidence.js";
import { initAutoSuggest } from "./autosuggest.js";
import { initAccessibility, announce } from "./accessibility.js";
import { renderWordCloud } from "./wordcloud.js";
import { toggleShortcuts } from "./shortcuts.js";
import { shareReport } from "./share.js";
import { initI18n, t, setLang, getLang, getAvailableLangs } from "./i18n.js";
import { renderSourceMap } from "./sourcemap.js";
import { initReadingProgress, setReadingContent } from "./reading.js";
import { initVoiceInput } from "./voice.js";
import { renderDiff, pushReport, canDiff, getReportHistory } from "./diff.js";
import { renderCredibilityPanel } from "./credibility.js";
import { renderClaimGraph } from "./claimgraph.js";
import { addBookmark, renderBookmarksPanel, getBookmarkCount } from "./bookmarks.js";
import { injectTransitionStyles, fadeIn, staggerChildren } from "./transitions.js";
import { notify, renderNotificationCenter, setNotificationListener, getUnreadCount } from "./notifications.js";
import { printReport } from "./print.js";

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

  // Particles disabled for clean professional look
  // particles = new ParticleField(document.body);

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

  initAutoSuggest();
  initAccessibility();
  initTraceFilter();

  initI18n();
  initReadingProgress();
  initVoiceInput();
  injectTransitionStyles();

  // Notification badge listener
  setNotificationListener(updateNotifBadge);

  // Wire topbar buttons
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    theme?.cycle();
    const currentTheme = theme!.theme;
    const icons: Record<string, string> = { light: "☀️", dark: "🌙", midnight: "🌌" };
    themeBtn.innerHTML = `<span class="theme-icon" style="font-size:16px;line-height:1">${icons[currentTheme] || "☀️"}</span>`;
    toast(`Theme: ${currentTheme}`, "info");
  });
  const focusBtnEl = document.getElementById("focusBtn");
  if (focusBtnEl) focusBtnEl.addEventListener("click", () => {
    const isActive = toggleFocus();
    toast(isActive ? "Focus mode: ON — distraction-free reading" : "Focus mode: OFF", "info");
  });
  const shortcutsBtnEl = document.getElementById("shortcutsBtn");
  if (shortcutsBtnEl) shortcutsBtnEl.addEventListener("click", () => toggleShortcuts());
  const cmdTriggerEl = document.getElementById("cmdTrigger");
  if (cmdTriggerEl) cmdTriggerEl.addEventListener("click", () => openPalette());
  const notifTriggerEl = document.getElementById("notifTrigger");
  if (notifTriggerEl) notifTriggerEl.addEventListener("click", () => {
    switchTab("notifications");
    // Clear badge count
    const badge = notifTriggerEl.querySelector(".notif-count");
    if (badge) (badge as HTMLElement).style.display = "none";
    toast("Viewing notifications", "info");
  });
  const sidebarToggleEl = document.getElementById("sidebarToggle");
  if (sidebarToggleEl) sidebarToggleEl.addEventListener("click", () => toggleSidebar());

  // Wire sidebar quick-action buttons
  initSidebarActions();

  // Dynamic visual effects
  initRippleEffect();
  initParticleSystem();
  initTypingTitle();
  setTimeout(() => initTiltEffect(), 500);

  // Welcome toast
  toast("Press Ctrl+K for command palette · ? for shortcuts", "info", 3000);
}

function updateNotifBadge(): void {
  const count = getUnreadCount();
  const btn = document.querySelector('[data-t="notifications"]');
  if (btn) btn.textContent = count > 0 ? `Alerts (${count})` : "Alerts";
  const dot = document.getElementById("notifDot");
  if (dot) dot.classList.toggle("hidden", count === 0);
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
    { id: "focus", label: "Toggle focus mode", icon: "👁", shortcut: "R", category: "View",
      action: () => { const on = toggleFocus(); toast(on ? "Focus mode on" : "Focus mode off", "info"); } },
    { id: "analytics-tab", label: "Show analytics", icon: "📊", category: "Navigation",
      action: () => switchTab("analytics") },
    { id: "heatmap-tab", label: "Show heatmap", icon: "🗺", category: "Navigation",
      action: () => switchTab("heatmap") },
    { id: "confidence-tab", label: "Show confidence meter", icon: "🎯", category: "Navigation",
      action: () => switchTab("confidence") },
    { id: "print", label: "Print report", icon: "🖨", category: "Export",
      action: () => { if (current) window.print(); else toast("No report to print", "warn"); } },
    { id: "share-copy", label: "Copy report to clipboard", icon: "📋", category: "Share",
      action: () => { if (current) shareReport(current, "copy"); else toast("No report", "warn"); } },
    { id: "share-link", label: "Open report in new tab", icon: "🔗", category: "Share",
      action: () => { if (current) shareReport(current, "link"); else toast("No report", "warn"); } },
    { id: "share-web", label: "Share via system share", icon: "📤", category: "Share",
      action: () => { if (current) shareReport(current, "share"); else toast("No report", "warn"); } },
    { id: "shortcuts", label: "Keyboard shortcuts", icon: "⌨", shortcut: "?", category: "Help",
      action: () => toggleShortcuts() },
    { id: "wordcloud-tab", label: "Show word cloud", icon: "☁", category: "Navigation",
      action: () => switchTab("wordcloud") },
    { id: "sourcemap-tab", label: "Show source map", icon: "🗺", category: "Navigation",
      action: () => switchTab("sourcemap") },
    { id: "lang-en", label: "Language: English", icon: "🇬🇧", category: "Language",
      action: () => { setLang("en"); toast("Language: English", "info"); } },
    { id: "lang-es", label: "Language: Español", icon: "🇪🇸", category: "Language",
      action: () => { setLang("es"); toast("Idioma: Español", "info"); } },
    { id: "lang-te", label: "Language: తెలుగు", icon: "🇮🇳", category: "Language",
      action: () => { setLang("te"); toast("భాష: తెలుగు", "info"); } },
    { id: "credibility-tab", label: "Show source trust scores", icon: "🛡", category: "Navigation",
      action: () => switchTab("credibility") },
    { id: "claimgraph-tab", label: "Show claim dependencies", icon: "🔗", category: "Navigation",
      action: () => switchTab("claimgraph") },
    { id: "diff-tab", label: "Compare reports", icon: "⇄", category: "Navigation",
      action: () => switchTab("diff") },
    { id: "bookmarks-tab", label: "Show bookmarks", icon: "★", category: "Navigation",
      action: () => switchTab("bookmarks") },
    { id: "notifications-tab", label: "Show notifications", icon: "🔔", category: "Navigation",
      action: () => switchTab("notifications") },
    { id: "bookmark-save", label: "Bookmark this research", icon: "★", category: "Actions",
      action: () => {
        if (current) {
          const credNum = Math.round((current.score?.citation_precision || 0) * 100);
          addBookmark(current.question || "Untitled", current.markdown || "", current.sources?.length || 0, current.claims?.length || 0, credNum);
        } else toast("No report to bookmark", "warn");
      }
    },
    { id: "print-report", label: "Print-optimized report", icon: "🖨", category: "Export",
      action: () => {
        if (current) {
          const credSources = current.sources.map(s => ({ url: s.url, title: s.title, credibility: s.credibility === "high" ? 90 : s.credibility === "medium" ? 60 : 30 }));
          printReport(current.question || "Research Report", current.markdown || "", credSources, Math.round((current.score?.citation_precision || 0) * 100));
        } else toast("No report to print", "warn");
      }
    },
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

// ── Sidebar quick actions ────────────────────────────
let searchCount = 0;

function initSidebarActions(): void {
  const newSearch = document.getElementById("sbNewSearch");
  if (newSearch) newSearch.addEventListener("click", () => {
    clearReport();
    ($("q") as HTMLInputElement).focus();
    toast("Ready for new search", "info");
  });

  const bookmark = document.getElementById("sbBookmark");
  if (bookmark) bookmark.addEventListener("click", () => {
    if (current) {
      const credNum = Math.round((current.score?.citation_precision || 0) * 100);
      addBookmark(current.question || "Untitled", current.markdown || "", current.sources?.length || 0, current.claims?.length || 0, credNum);
      toast("Bookmarked!", "success");
      updateSidebarStats();
    } else toast("No report to bookmark", "warn");
  });

  const exportBtn = document.getElementById("sbExport");
  if (exportBtn) exportBtn.addEventListener("click", () => {
    if (current) exportReport("md");
    else toast("No report to export", "warn");
  });

  const shareBtn = document.getElementById("sbShare");
  if (shareBtn) shareBtn.addEventListener("click", () => {
    if (current) shareReport(current, "copy");
    else toast("No report to share", "warn");
  });

  const cmdBtn = document.getElementById("sbCmdPalette");
  if (cmdBtn) cmdBtn.addEventListener("click", () => openPalette());
}

function updateSidebarStats(): void {
  const searches = document.getElementById("statSearches");
  if (searches) animateCounter(searches, searchCount);
  const sources = document.getElementById("statSources");
  if (sources) animateCounter(sources, current ? (current.sources?.length || 0) : 0);
  const precision = document.getElementById("statPrecision");
  if (precision) {
    const pctVal = current ? Math.round((current.score?.citation_precision || 0) * 100) : 0;
    if (pctVal > 0) animateCounter(precision, pctVal, "%");
    else precision.textContent = "—";
  }
  const bookmarks = document.getElementById("statBookmarks");
  if (bookmarks) animateCounter(bookmarks, getBookmarkCount());
}

// ── Dynamic Visual Effects ───────────────────────────

function initRippleEffect(): void {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest("button, .sidebar-quick-btn, .tab, .chip, .icon-btn, .export-btn, .feature-pill");
    if (!btn) return;
    const rect = (btn as HTMLElement).getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple-effect";
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
    ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
    (btn as HTMLElement).style.position = "relative";
    (btn as HTMLElement).style.overflow = "hidden";
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

function initParticleSystem(): void {
  const canvas = document.createElement("canvas");
  canvas.id = "particles-canvas";
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let w = canvas.width = window.innerWidth;
  let h = canvas.height = window.innerHeight;
  window.addEventListener("resize", () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; });

  const colors = ["99,102,241", "236,72,153", "6,182,212", "16,185,129", "139,92,246", "249,115,22"];
  interface Pt { x: number; y: number; vx: number; vy: number; r: number; c: string; a: number; }
  const pts: Pt[] = [];
  const N = Math.min(40, Math.floor(w * h / 30000));
  for (let i = 0; i < N; i++) {
    pts.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
      c: colors[Math.floor(Math.random() * colors.length)],
      a: Math.random() * 0.4 + 0.1
    });
  }

  let mx = w / 2, my = h / 2;
  document.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; });

  function draw(): void {
    ctx!.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      // Mouse repel
      const dx = p.x - mx, dy = p.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        const force = (120 - dist) / 120 * 0.02;
        p.vx += dx / dist * force;
        p.vy += dy / dist * force;
      }

      // Damping
      p.vx *= 0.999; p.vy *= 0.999;

      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(${p.c},${p.a})`;
      ctx!.fill();
    }

    // Draw connections
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 150) {
          ctx!.beginPath();
          ctx!.moveTo(pts[i].x, pts[i].y);
          ctx!.lineTo(pts[j].x, pts[j].y);
          ctx!.strokeStyle = `rgba(99,102,241,${0.06 * (1 - d / 150)})`;
          ctx!.lineWidth = 0.5;
          ctx!.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

function animateCounter(el: HTMLElement, target: number, suffix: string = ""): void {
  const start = parseInt(el.textContent || "0") || 0;
  const diff = target - start;
  if (diff === 0) return;
  const duration = 400;
  const startTime = performance.now();
  function step(now: number): void {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = Math.round(start + diff * eased);
    el.textContent = String(value) + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else {
      el.classList.add("bump");
      setTimeout(() => el.classList.remove("bump"), 300);
    }
  }
  requestAnimationFrame(step);
}

function initTypingTitle(): void {
  const title = document.querySelector(".search-title");
  if (!title) return;
  const words = ["insights instantly", "knowledge deeply", "sources reliably", "claims accurately"];
  let idx = 0;
  const br = title.querySelector("br");
  if (!br) return;
  const afterBr = br.nextSibling;
  if (!afterBr) return;
  const baseText = "Discover verified";

  setInterval(() => {
    idx = (idx + 1) % words.length;
    const word = words[idx];
    // Fade out then swap
    (title as HTMLElement).style.opacity = "0.6";
    setTimeout(() => {
      if (br.nextSibling && br.nextSibling.nodeType === 3) {
        br.nextSibling.textContent = word;
      }
      (title as HTMLElement).style.opacity = "1";
    }, 300);
  }, 3500);
}

function initTiltEffect(): void {
  document.querySelectorAll<HTMLElement>(".panel").forEach((panel) => {
    panel.addEventListener("mousemove", (e) => {
      const rect = panel.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      panel.style.transform = `perspective(1200px) rotateY(${x * 3}deg) rotateX(${-y * 3}deg) translateY(-3px)`;
    });
    panel.addEventListener("mouseleave", () => {
      panel.style.transform = "";
    });
  });
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
    if (e.key === "r" && !e.ctrlKey && !e.metaKey) {
      toggleFocus();
    }
    if (e.key === "?") { toggleShortcuts(); }
  });
}

// ── Tabs ──────────────────────────────────────────────
const TAB_IDS = ["report", "graph", "inspector", "timelinePanel", "analyticsPanel", "heatmapPanel", "confidencePanel", "wordcloudPanel", "sourcemapPanel", "credibilityPanel", "claimgraphPanel", "diffPanel", "bookmarksPanel", "notificationsPanel"];

function switchTab(target: string): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((x) =>
    x.classList.toggle("on", x.dataset.t === target)
  );
  for (const id of TAB_IDS) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", !matchTab(id, target));
  }
  if (target === "graph" && current) drawGraph(current, $("graph"));
  if (target === "inspector" && current) renderInspector(current, $("inspector"));
  if (target === "analytics" && current) renderAnalytics(current, $("analyticsPanel"));
  if (target === "heatmap" && current) renderHeatmap(current, $("heatmapPanel"));
  if (target === "confidence" && current) renderConfidence(current, $("confidencePanel"));
  if (target === "wordcloud" && current) renderWordCloud(current, $("wordcloudPanel"));
  if (target === "sourcemap" && current) renderSourceMap(current, $("sourcemapPanel"));
  if (target === "credibility" && current) {
    const cs = current.sources.map(s => ({ url: s.url, title: s.title, credibility: s.credibility === "high" ? 90 : s.credibility === "medium" ? 60 : 30 }));
    renderCredibilityPanel(cs, $("credibilityPanel"));
  }
  if (target === "claimgraph" && current) {
    const cl = current.claims.map(c => ({ text: c.text, sources: c.cites.map(id => { const s = current!.sources.find(x => x.id === id); return s ? s.title : ""; }).filter(Boolean) }));
    renderClaimGraph(cl, current.sources.map(s => ({ url: s.url, title: s.title })), $("claimgraphPanel"));
  }
  if (target === "diff") {
    const hist = getReportHistory();
    if (hist.length >= 2) renderDiff(hist[hist.length - 2], hist[hist.length - 1], $("diffPanel"));
  }
  if (target === "bookmarks") renderBookmarksPanel($("bookmarksPanel"), (q) => {
    ($("q") as HTMLInputElement).value = q;
    ($("f") as HTMLFormElement).dispatchEvent(new Event("submit", { cancelable: true }));
  });
  if (target === "notifications") renderNotificationCenter($("notificationsPanel"));
  announce(`Switched to ${target} tab`);
}

function matchTab(id: string, target: string): boolean {
  const map: Record<string, string> = {
    report: "report", graph: "graph", inspector: "inspector",
    timelinePanel: "timeline", analyticsPanel: "analytics",
    heatmapPanel: "heatmap", confidencePanel: "confidence",
    wordcloudPanel: "wordcloud", sourcemapPanel: "sourcemap",
    credibilityPanel: "credibility", claimgraphPanel: "claimgraph",
    diffPanel: "diff", bookmarksPanel: "bookmarks",
    notificationsPanel: "notifications",
  };
  return map[id] === target;
}

function initTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      const target = t.dataset.t || "report";
      switchTab(target);
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

  searchCount++;
  updateSidebarStats();
  toast(`Researching: "${question.slice(0, 50)}${question.length > 50 ? "…" : ""}"`, "info");
  notify("Research Started", `Query: "${question.slice(0, 80)}"`, "info");

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
      notify("Research Failed", d.message, "error");
    })
    .onError(() => {
      done();
      toast("Connection lost", "error");
      notify("Connection Lost", "SSE stream disconnected", "error");
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

  // Update visible panels
  if (!$("graph").classList.contains("hidden")) drawGraph(d, $("graph"));
  if (!$("inspector").classList.contains("hidden")) renderInspector(d, $("inspector"));
  if (!$("analyticsPanel").classList.contains("hidden")) renderAnalytics(d, $("analyticsPanel"));
  if (!$("heatmapPanel").classList.contains("hidden")) renderHeatmap(d, $("heatmapPanel"));
  if (!$("confidencePanel").classList.contains("hidden")) renderConfidence(d, $("confidencePanel"));
  if (!$("wordcloudPanel").classList.contains("hidden")) renderWordCloud(d, $("wordcloudPanel"));
  if (!$("sourcemapPanel").classList.contains("hidden")) renderSourceMap(d, $("sourcemapPanel"));

  // Update new panels if visible
  if (!$("credibilityPanel").classList.contains("hidden")) {
    const cs = d.sources.map(s => ({ url: s.url, title: s.title, credibility: s.credibility === "high" ? 90 : s.credibility === "medium" ? 60 : 30 }));
    renderCredibilityPanel(cs, $("credibilityPanel"));
  }
  if (!$("claimgraphPanel").classList.contains("hidden")) {
    const cl = d.claims.map(c => ({ text: c.text, sources: c.cites.map(id => { const src = d.sources.find(x => x.id === id); return src ? src.title : ""; }).filter(Boolean) }));
    renderClaimGraph(cl, d.sources.map(s => ({ url: s.url, title: s.title })), $("claimgraphPanel"));
  }

  // Push to diff history
  pushReport(d.markdown);

  // Notify
  notify("Research Complete", `"${(d.question || "").slice(0, 50)}" — ${d.sources.length} sources, precision ${pct(d.score.citation_precision)}`, "success");

  // Animate report in
  fadeIn($("report"));
  staggerChildren($("score"), ".pill", 60);

  // Update sidebar stats
  updateSidebarStats();

  // Reading progress
  setReadingContent(words);
  announce(`Research report loaded: ${d.question}`);
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

// ── Trace filter buttons ─────────────────────────────
function initTraceFilter(): void {
  document.querySelectorAll<HTMLButtonElement>(".trace-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter || "all";
      document.querySelectorAll(".trace-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll<HTMLDivElement>(".trace-entry").forEach((entry) => {
        if (filter === "all") {
          entry.style.display = "";
        } else {
          entry.style.display = entry.dataset.type === filter ? "" : "none";
        }
      });
    });
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
