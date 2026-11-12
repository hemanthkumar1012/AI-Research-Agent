/* ── Keyboard Shortcut Cheat Sheet ──────────────────────── */
/* Toggleable overlay showing all keyboard shortcuts          */

let scOverlay: HTMLDivElement | null = null;
let scVisible = false;

interface ShortcutGroup {
  title: string;
  items: { key: string; label: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    items: [
      { key: "/", label: "Focus search input" },
      { key: "⌘K", label: "Open command palette" },
      { key: "[", label: "Toggle sidebar" },
      { key: "?", label: "Show this cheat sheet" },
    ],
  },
  {
    title: "Appearance",
    items: [
      { key: "T", label: "Cycle theme (dark → light → midnight)" },
      { key: "R", label: "Toggle focus / reading mode" },
      { key: "F", label: "Toggle fullscreen" },
      { key: "P", label: "Toggle performance monitor" },
    ],
  },
  {
    title: "Actions",
    items: [
      { key: "Enter", label: "Submit research question" },
      { key: "Esc", label: "Close overlay / blur input" },
      { key: "↑↓", label: "Navigate suggestions / commands" },
    ],
  },
  {
    title: "Export",
    items: [
      { key: "⌘K → md", label: "Export Markdown" },
      { key: "⌘K → json", label: "Export JSON" },
      { key: "⌘K → html", label: "Export HTML" },
      { key: "⌘K → print", label: "Print report" },
    ],
  },
];

export function toggleShortcuts(): boolean {
  scVisible = !scVisible;
  if (scVisible) showSheet();
  else hideSheet();
  return scVisible;
}

function showSheet(): void {
  scOverlay = document.createElement("div");
  scOverlay.className = "shortcuts-overlay";

  const card = document.createElement("div");
  card.className = "shortcuts-card";

  card.innerHTML = `
    <div class="shortcuts-header">
      <h2>⌨ Keyboard Shortcuts</h2>
      <button class="shortcuts-close">✕</button>
    </div>
    <div class="shortcuts-grid">
      ${GROUPS.map((g) => `
        <div class="shortcuts-group">
          <h3>${g.title}</h3>
          ${g.items.map((i) => `
            <div class="shortcut-row">
              <kbd class="shortcut-key">${i.key}</kbd>
              <span class="shortcut-label">${i.label}</span>
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
    <div class="shortcuts-footer">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</div>
  `;

  scOverlay.appendChild(card);
  document.body.appendChild(scOverlay);

  // Animate in
  requestAnimationFrame(() => scOverlay?.classList.add("shortcuts-visible"));

  // Close handlers
  scOverlay.querySelector(".shortcuts-close")?.addEventListener("click", () => toggleShortcuts());
  scOverlay.addEventListener("click", (e) => {
    if (e.target === scOverlay) toggleShortcuts();
  });
  const onScKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && scVisible) {
      e.stopPropagation();
      toggleShortcuts();
      document.removeEventListener("keydown", onScKey, true);
    }
  };
  document.addEventListener("keydown", onScKey, true);
}

function hideSheet(): void {
  if (scOverlay) {
    scOverlay.classList.remove("shortcuts-visible");
    setTimeout(() => { scOverlay?.remove(); scOverlay = null; }, 300);
  }
}
