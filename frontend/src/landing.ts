/* ── Landing page + sign-in ────────────────────────────────────────── */
import { h, frag, icon, toast } from "./u.js";
import { ST } from "./store.js";

function heroArt(): HTMLElement {
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

export function renderLanding(): HTMLElement {
  const nav = (label: string, target: string) =>
    h("a.land-nav-link", { href: "#", onclick: (e: Event) => { e.preventDefault(); document.getElementById(target)?.scrollIntoView({ behavior: "smooth" }); } }, label);

  const page = h("div.landing", null,
    h("header.land-head", null,
      h("div.land-head-in", null,
        h("a.brand", { href: "#/" }, h("span.brand-mark", null, icon("logo", 18)), h("span.brand-name", null, "Verity AI")),
        h("nav.land-nav", null, nav("Features", "features"), nav("How it works", "how"), nav("Pricing", "pricing")),
        h("div.land-cta", null,
          h("a.v-btn.ghost", { href: "#/signin" }, "Log in"),
          h("a.v-btn.primary", { href: "#/signin" }, "Get Started")))),

    h("section.hero", null,
      h("div.hero-in", null,
        h("div.hero-copy", null,
          h("span.hero-badge", null, icon("spark", 14), "AI Research Agent"),
          h("h1", { html: "Your Autonomous<br><em>AI Research</em> Agent" }),
          h("p.hero-sub", null,
            "Turn complex questions into deep, trustworthy and well-cited research — with web search, multi-source analysis and structured reports."),
          h("div.hero-actions", null,
            h("a.v-btn.dark.lg", { href: "#/signin" }, "Get Started", icon("send", 15)),
            h("a.v-btn.ghost.lg", { href: "#", onclick: (e: Event) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); } }, "See how it works"))),
        heroArt()),
      h("div.hero-chips", null,
        ...[["layers", "Deep Research", "Multi-step analysis"], ["shield", "Trusted Sources", "Citations & links"],
        ["image", "Multimodal", "Text, PDF, data, tables"], ["download", "Export & Share", "PDF, MD, Word"]].map(
          ([i, t, d]) => h("div.hero-chip", null, h("span.chip-icn", null, icon(i, 18)),
            h("div", null, h("strong", null, t), h("span", null, d)))))),

    h("section.land-sec#features", null,
      h("div.sec-head", null, h("h2", null, "Research that holds up to scrutiny"),
        h("p", null, "Built for work where the sources matter as much as the answer.")),
      h("div.feat-grid", null, ...FEATURES.map(f =>
        h("div.feat-card", null, h("span.feat-icn", null, icon(f.icn, 19)), h("h3", null, f.t), h("p", null, f.d))))),

    h("section.land-sec.alt#how", null,
      h("div.sec-head", null, h("h2", null, "How Verity works"), h("p", null, "A real agent pipeline — every step visible while it runs.")),
      h("div.steps-row", null, ...STEPS.map(([t, d], i) =>
        h("div.step-card", null, h("span.step-n", null, String(i + 1)), h("h3", null, t), h("p", null, d))))),

    h("section.land-sec#pricing", null,
      h("div.sec-head", null, h("h2", null, "Simple pricing"), h("p", null, "Start free. Upgrade when your team does.")),
      h("div.price-grid", null,
        priceCard("Free", "$0", ["Unlimited local projects", "Standard research depth", "Knowledge base uploads", "All export formats"], false),
        priceCard("Pro", "$16", ["Everything in Free", "Deep research depth", "Priority model capacity", "Research analytics"], true),
        priceCard("Team", "$49", ["Everything in Pro", "Shared workspaces", "Admin controls", "Priority support"], false))),

    h("footer.land-foot", null,
      h("div.land-foot-in", null,
        h("a.brand.dim", { href: "#/" }, h("span.brand-mark", null, icon("logo", 16)), h("span.brand-name", null, "Verity AI")),
        h("span.foot-note", null, `© ${new Date().getFullYear()} Verity AI — autonomous research with verifiable sources.`))));
  return page;
}

function priceCard(name: string, price: string, items: string[], hot: boolean): HTMLElement {
  return h("div.price-card" + (hot ? ".hot" : ""), null,
    hot ? h("span.price-tag", null, "Most popular") : null,
    h("h3", null, name),
    h("div.price-amt", null, h("strong", null, price), h("span", null, "/month")),
    h("ul", null, ...items.map(i => h("li", null, icon("check", 14), i))),
    h("a.v-btn.block" + (hot ? ".primary" : ".ghost"), { href: "#/signin" }, name === "Free" ? "Get started" : "Start free trial"));
}

/* ── Sign in ───────────────────────────────────────────────────────── */
export function renderSignin(): HTMLElement {
  const name = h("input.v-input", { placeholder: "Your name", value: ST.root.user?.name || "" }) as HTMLInputElement;
  const email = h("input.v-input", { placeholder: "you@company.com", type: "email", value: ST.root.user?.email || "" }) as HTMLInputElement;
  const wsName = h("input.v-input", { placeholder: "Workspace name", value: ST.wsMeta?.name || "Personal Workspace" }) as HTMLInputElement;

  const submit = (e: Event) => {
    e.preventDefault();
    const n = name.value.trim(), m = email.value.trim();
    if (!n) { toast("Please enter your name.", "error"); name.focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) { toast("Please enter a valid email address.", "error"); email.focus(); return; }
    ST.signIn(n, m);
    if (wsName.value.trim()) ST.renameWorkspace(ST.root.activeWs, wsName.value.trim());
    ST.log("signin");
    location.hash = "#/app";
  };

  return h("div.auth-page", null,
    h("div.auth-card", null,
      h("a.brand.auth-brand", { href: "#/" }, h("span.brand-mark", null, icon("logo", 18)), h("span.brand-name", null, "Verity AI")),
      h("h1", null, "Welcome"),
      h("p.auth-sub", null, "Sign in to your workspace. Your account and research are stored privately in this browser."),
      h("form.auth-form", { onsubmit: submit },
        h("label", null, "Name", name),
        h("label", null, "Email", email),
        h("label", null, "Workspace", wsName),
        h("button.v-btn.primary.block.lg", { type: "submit" }, "Continue", icon("send", 15))),
      h("p.auth-note", null, "No password needed — this workspace lives in your browser's storage.")));
}
