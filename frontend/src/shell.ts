/* ── App shell: sidebar, topbar, workspace & notifications ─────────── */
import { h, icon, popMenu, modal, frag, toast, timeAgo } from "./u.js";
import { ST } from "./store.js";
import { openPalette } from "./palette.js";

const NAV: [string, string, string][] = [
  ["home", "Home", "#/app"],
  ["folder", "Projects", "#/app/projects"],
  ["doc", "Reports", "#/app/reports"],
  ["book", "Knowledge Base", "#/app/kb"],
  ["chart", "Analytics", "#/app/analytics"],
];

export function renderShell(active: string, view: HTMLElement): HTMLElement {
  const collapsed = ST.root.sidebarCollapsed;

  const navLink = (icn: string, label: string, href: string, cls = "") =>
    h("a.side-link" + cls + (active === href ? ".on" : ""), { href, title: label },
      icon(icn, 18), h("span.side-label", null, label));

  const sidebar = h("aside.side" + (collapsed ? ".collapsed" : ""), null,
    h("div.side-top", null,
      h("a.brand", { href: "#/app" }, h("span.brand-mark", null, icon("logo", 18)), h("span.brand-name.side-label", null, "Nyna AI")),
      h("button.v-iconbtn.side-collapse", {
        title: collapsed ? "Expand sidebar" : "Collapse sidebar",
        onclick: () => { ST.root.sidebarCollapsed = !ST.root.sidebarCollapsed; ST.save(); rerender(); },
      }, icon("collapse", 16))),
    h("a.v-btn.primary.side-new" + (active === "#/app/research" ? ".glow" : ""), { href: "#/app/research", title: "New Research" },
      icon("plus", 16), h("span.side-label", null, "New Research")),
    h("nav.side-nav", null, ...NAV.map(([i, l, hr]) => navLink(i, l, hr))),
    h("div.side-foot", null,
      navLink("settings", "Settings", "#/app/settings"),
      h("a.side-link", { href: "#", onclick: (e: Event) => { e.preventDefault(); helpModal(); } },
        icon("help", 18), h("span.side-label", null, "Help"))));

  /* topbar */
  const wsBtn = h("button.ws-btn", {
    onclick: () => popMenu(wsBtn, [
      ...ST.root.workspaces.map(w => ({
        label: (w.id === ST.root.activeWs ? "✓ " : "") + w.name, icon: "grid",
        on: () => { ST.switchWorkspace(w.id); rerender(); },
      })),
      { label: "New workspace…", icon: "plus", on: newWorkspaceModal },
    ]),
  }, icon("grid", 15), h("span.ws-name", null, ST.wsMeta.name), icon("chevd", 14));

  const unread = ST.ws.notifs.filter(n => !n.read).length;
  const bellBtn = h("button.v-iconbtn.bell", { title: "Notifications", onclick: () => notifPopover(bellBtn) },
    icon("bell", 18), unread ? h("span.bell-dot", null, String(Math.min(unread, 9))) : null);

  const initials = (ST.root.user?.name || "U").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatar = h("button.avatar", {
    title: ST.root.user?.name || "Account",
    onclick: () => popMenu(avatar, [
      { label: ST.root.user?.name || "Account", icon: "user", on: () => { location.hash = "#/app/settings"; } },
      { label: "Settings", icon: "settings", on: () => { location.hash = "#/app/settings"; } },
      { label: "Help & shortcuts", icon: "help", on: helpModal },
      { label: "Sign out", icon: "logout", danger: true, on: () => { ST.signOut(); location.hash = "#/"; } },
    ]),
  }, initials);

  const topbar = h("header.topbar", null,
    h("button.v-iconbtn.only-mobile", { "aria-label": "Menu", onclick: () => document.body.classList.toggle("drawer-open") }, icon("menu", 18)),
    h("div.topbar-spacer"),
    h("button.topbar-search", { onclick: openPalette, "aria-label": "Search (Ctrl+K)" },
      icon("search", 15), h("span", null, "Search"), h("kbd", null, "Ctrl K")),
    wsBtn, bellBtn, avatar);

  const main = h("main.app-main", null, view);
  const scrim = h("div.drawer-scrim", { onclick: () => document.body.classList.remove("drawer-open") });
  document.body.classList.remove("drawer-open");
  return h("div.app" + (collapsed ? ".side-min" : ""), null, sidebar, scrim, h("div.app-right", null, topbar, main));
}

function rerender(): void { window.dispatchEvent(new HashChangeEvent("hashchange")); }

function newWorkspaceModal(): void {
  const inp = h("input.v-input", { placeholder: "e.g. Market Research" }) as HTMLInputElement;
  const m = modal({
    title: "New workspace", sub: "Workspaces keep projects, reports and knowledge separate.",
    body: h("label.v-field", null, "Workspace name", inp),
    footer: frag(
      h("button.v-btn.ghost", { onclick: () => m.close() }, "Cancel"),
      h("button.v-btn.primary", {
        onclick: () => {
          const n = inp.value.trim();
          if (!n) { toast("Give the workspace a name.", "error"); return; }
          ST.addWorkspace(n); m.close(); rerender(); toast(`Workspace “${n}” created.`);
        },
      }, "Create workspace")),
  });
  setTimeout(() => inp.focus(), 50);
}

function notifPopover(anchor: HTMLElement): void {
  document.querySelectorAll(".v-pop").forEach(p => p.remove());
  const pop = h("div.v-pop.notif-pop");
  pop.append(h("div.notif-head", null, h("strong", null, "Notifications"),
    ST.ws.notifs.length ? h("button.v-link", {
      onclick: () => { ST.markNotifsRead(); pop.remove(); rerender(); },
    }, "Mark all read") : null));
  if (!ST.ws.notifs.length) {
    pop.append(h("p.notif-empty", null, "Nothing yet — finished research will show up here."));
  } else {
    for (const n of ST.ws.notifs.slice(0, 8)) {
      pop.append(h("button.notif-item" + (n.read ? "" : ".unread"), {
        onclick: () => { pop.remove(); if (n.reportId) location.hash = "#/app/report/" + n.reportId; },
      }, h("span.notif-text", null, n.text), h("span.notif-time", null, timeAgo(n.t))));
    }
  }
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = r.bottom + 8 + "px";
  pop.style.left = Math.max(10, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 10)) + "px";
  const off = (e: Event) => { if (!pop.contains(e.target as Node)) { pop.remove(); document.removeEventListener("click", off, true); } };
  setTimeout(() => document.addEventListener("click", off, true), 0);
}

export function helpModal(): void {
  const row = (k: string, d: string) => h("div.help-row", null, h("kbd", null, k), h("span", null, d));
  const m = modal({
    title: "Help",
    body: frag(
      h("h4.help-h", null, "How research works"),
      h("p.help-p", null, "Nyna plans sub-questions, searches the web and academic sources, reads what it finds, then writes a cited report. Every run shows its steps live, and every claim links back to a numbered source."),
      h("h4.help-h", null, "Shortcuts"),
      row("N", "New research"), row("/", "Focus search on list pages"), row("Esc", "Close dialogs"),
      h("h4.help-h", null, "Your data"),
      h("p.help-p", null, "Projects, reports and knowledge-base files are stored privately in this browser (localStorage + IndexedDB). Use Settings → Export data for a full backup.")),
    footer: h("button.v-btn.primary", { onclick: () => m.close() }, "Got it"),
  });
}
