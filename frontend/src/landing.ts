/* ── Landing page + sign-in ────────────────────────────────────────── */
import { h, frag, icon, toast } from "./u.js";
import { ST } from "./store.js";
import { particleField, core3D, wireReveals } from "./fx.js";

const FEATURES = [
  { icn: "layers", t: "Deep Research", d: "Multi-step agent workflow: planning, web search, source analysis and synthesis — not a single prompt." },
  { icn: "shield", t: "Trusted Sources", d: "Every claim carries numbered citations. Source credibility is rated and verifiable in one click." },
  { icn: "file", t: "Knowledge Base", d: "Bring your own PDFs, notes and datasets. Nyna uses them to focus the research direction." },
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
        h("a.brand", { href: "#/" }, h("span.brand-mark", null, icon("logo", 18)), h("span.brand-name", null, "Nyna AI")),
        h("nav.land-nav", null, nav("Features", "features"), nav("How it works", "how"), nav("Pricing", "pricing")),
        h("div.land-cta", null,
          h("a.v-btn.ghost", { href: "#/signin" }, "Log in"),
          h("a.v-btn.primary", { href: "#/signin" }, "Get Started")))),

    h("section.hero", null,
      particleField(1),
      h("div.hero-in", null,
        h("div.hero-copy.fx-reveal", null,
          h("span.hero-badge", null, icon("spark", 14), "Autonomous AI Research Agent"),
          h("h1", { html: "From Questions to<br><em>Verified Research</em>" }),
          h("p.hero-sub", null,
            "An enterprise-grade AI agent that researches, analyses, synthesises, and delivers trusted, citation-backed insights."),
          h("div.hero-actions", null,
            h("a.v-btn.primary.lg.glowbtn", { href: "#/signin" }, "Get Started Free", icon("send", 15)),
            h("a.v-btn.ghost.lg", { href: "#", onclick: (e: Event) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); } }, "▶ Watch the flow"))),
        core3D()),
      h("div.hero-chips", null,
        ...[["layers", "Deep Research", "Multi-step analysis"], ["shield", "Trusted Sources", "Citations & links"],
        ["image", "Multimodal", "Text, PDF, data, tables"], ["download", "Export & Share", "PDF, MD, Word"]].map(
          ([i, t, d]) => h("div.hero-chip.fx-reveal", null, h("span.chip-icn", null, icon(i, 18)),
            h("div", null, h("strong", null, t), h("span", null, d)))))),

    h("section.land-sec#features", null,
      h("div.sec-head", null, h("h2", null, "Research that holds up to scrutiny"),
        h("p", null, "Built for work where the sources matter as much as the answer.")),
      h("div.feat-grid", null, ...FEATURES.map(f =>
        h("div.feat-card.fx-reveal", null, h("span.feat-icn", null, icon(f.icn, 19)), h("h3", null, f.t), h("p", null, f.d))))),

    h("section.land-sec.alt#how", null,
      h("div.sec-head", null, h("h2", null, "How Nyna works"), h("p", null, "A real agent pipeline — every step visible while it runs.")),
      h("div.steps-row", null, ...STEPS.map(([t, d], i) =>
        h("div.step-card.fx-reveal", null, h("span.step-n", null, String(i + 1)), h("h3", null, t), h("p", null, d))))),

    h("section.land-sec#pricing", null,
      h("div.sec-head", null, h("h2", null, "Simple pricing"), h("p", null, "Start free. Upgrade when your team does.")),
      h("div.price-grid", null,
        priceCard("Free", "$0", ["Unlimited local projects", "Standard research depth", "Knowledge base uploads", "All export formats"], false),
        priceCard("Pro", "$16", ["Everything in Free", "Deep research depth", "Priority model capacity", "Research analytics"], true),
        priceCard("Team", "$49", ["Everything in Pro", "Shared workspaces", "Admin controls", "Priority support"], false))),

    h("footer.land-foot", null,
      h("div.land-foot-in", null,
        h("a.brand.dim", { href: "#/" }, h("span.brand-mark", null, icon("logo", 16)), h("span.brand-name", null, "Nyna AI")),
        h("span.foot-note", null, `© ${new Date().getFullYear()} Nyna AI — autonomous research with verifiable sources.`))));
  wireReveals(page);
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
      h("a.brand.auth-brand", { href: "#/" }, h("span.brand-mark", null, icon("logo", 18)), h("span.brand-name", null, "Nyna AI")),
      h("h1", null, "Welcome"),
      h("p.auth-sub", null, "Sign in to your workspace. Your account and research are stored privately in this browser."),
      h("form.auth-form", { onsubmit: submit },
        h("label", null, "Name", name),
        h("label", null, "Email", email),
        h("label", null, "Workspace", wsName),
        h("button.v-btn.primary.block.lg", { type: "submit" }, "Continue", icon("send", 15))),
      h("p.auth-note", null, "No password needed — this workspace lives in your browser's storage.")));
}
