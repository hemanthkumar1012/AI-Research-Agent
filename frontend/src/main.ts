/* ── Nyna router + boot ──────────────────────────────────────────── */
import { ST } from "./store.js";
import { renderLanding, renderSignin } from "./landing.js";
import { renderShell } from "./shell.js";
import { renderHome, renderProjects, renderProjectDetail, renderReports, renderKB, renderAnalytics, renderSettings } from "./views.js";
import { renderResearchHome, renderProgress } from "./research.js";
import { renderReport } from "./report.js";

const rootEl = document.getElementById("app") as HTMLElement;

function route(): void {
  const hash = location.hash || "#/";
  const authed = !!ST.root.user;
  rootEl.innerHTML = "";
  window.scrollTo(0, 0);

  if (hash === "#/" || hash === "") { rootEl.append(renderLanding()); return; }
  if (hash === "#/signin") { rootEl.append(renderSignin()); return; }

  if (hash.startsWith("#/app")) {
    if (!authed) { location.hash = "#/signin"; return; }
    let active = hash, view: HTMLElement;
    const seg = hash.split("/");
    if (hash === "#/app") view = renderHome();
    else if (hash === "#/app/research") view = renderResearchHome();
    else if (hash === "#/app/progress") view = renderProgress();
    else if (hash.startsWith("#/app/report/")) { view = renderReport(seg[3]); active = "#/app/reports"; }
    else if (hash === "#/app/projects") view = renderProjects();
    else if (hash.startsWith("#/app/project/")) { view = renderProjectDetail(seg[3]); active = "#/app/projects"; }
    else if (hash === "#/app/reports") view = renderReports();
    else if (hash === "#/app/kb") view = renderKB();
    else if (hash === "#/app/analytics") view = renderAnalytics();
    else if (hash === "#/app/settings") view = renderSettings();
    else { location.hash = "#/app"; return; }
    rootEl.append(renderShell(active, view));
    return;
  }
  location.hash = "#/";
}

window.addEventListener("hashchange", route);

/* global shortcuts */
document.addEventListener("keydown", (e) => {
  const tag = (document.activeElement?.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || (document.activeElement as HTMLElement)?.isContentEditable;
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "n" && ST.root.user && location.hash.startsWith("#/app")) {
    e.preventDefault(); location.hash = "#/app/research";
  }
  if (e.key === "/") {
    const s = document.getElementById("page-search") as HTMLInputElement | null;
    if (s) { e.preventDefault(); s.focus(); }
  }
});

route();
