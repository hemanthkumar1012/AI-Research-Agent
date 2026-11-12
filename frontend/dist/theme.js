/* ── Theme Engine — professional light/dark with smooth transitions ── */
const THEMES = {
    light: {
        bg: "#f8fafc", bg2: "#ffffff",
        surface: "rgba(99,102,241,0.03)", surfaceHover: "rgba(99,102,241,0.06)",
        border: "rgba(99,102,241,0.12)", borderHi: "rgba(99,102,241,0.2)",
        text: "#0f172a", text2: "#475569", text3: "#94a3b8",
        accent: "#6366f1", accent2: "#8b5cf6", accentGlow: "rgba(99,102,241,0.1)",
        green: "#10b981", amber: "#f59e0b", red: "#ef4444",
        cardBg: "#ffffff", headerBg: "rgba(255,255,255,0.75)",
    },
    dark: {
        bg: "#0f0f13", bg2: "#1a1a22",
        surface: "rgba(255,255,255,0.04)", surfaceHover: "rgba(255,255,255,0.07)",
        border: "rgba(255,255,255,0.08)", borderHi: "rgba(255,255,255,0.15)",
        text: "#e8e8f0", text2: "#9898a8", text3: "#68687a",
        accent: "#e8e8f0", accent2: "#bbbbcc", accentGlow: "rgba(255,255,255,0.06)",
        green: "#4ade80", amber: "#fbbf24", red: "#f87171",
        cardBg: "rgba(255,255,255,0.04)", headerBg: "rgba(15,15,19,0.85)",
    },
    midnight: {
        bg: "#08081a", bg2: "#0e0e28",
        surface: "rgba(99,102,241,0.04)", surfaceHover: "rgba(99,102,241,0.08)",
        border: "rgba(99,102,241,0.12)", borderHi: "rgba(99,102,241,0.2)",
        text: "#d4d4f8", text2: "#8888b8", text3: "#5555888",
        accent: "#818cf8", accent2: "#a5b4fc", accentGlow: "rgba(99,102,241,0.15)",
        green: "#34d399", amber: "#fbbf24", red: "#fb7185",
        cardBg: "rgba(99,102,241,0.04)", headerBg: "rgba(8,8,26,0.85)",
    },
};
export class ThemeEngine {
    current;
    listeners = [];
    constructor() {
        // Default to light for the professional gray/white look
        const stored = localStorage.getItem("theme");
        this.current = stored || "light";
        this.apply(this.current);
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (!localStorage.getItem("theme"))
                this.apply(this.systemPref());
        });
    }
    systemPref() {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    get theme() { return this.current; }
    cycle() {
        const order = ["light", "dark", "midnight"];
        const next = order[(order.indexOf(this.current) + 1) % order.length];
        this.set(next);
        return next;
    }
    set(name) {
        localStorage.setItem("theme", name);
        this.apply(name);
    }
    apply(name) {
        this.current = name;
        const vars = THEMES[name];
        const root = document.documentElement;
        root.style.setProperty("--bg", vars.bg);
        root.style.setProperty("--bg2", vars.bg2);
        root.style.setProperty("--surface", vars.surface);
        root.style.setProperty("--surface-hover", vars.surfaceHover);
        root.style.setProperty("--border", vars.border);
        root.style.setProperty("--border-hi", vars.borderHi);
        root.style.setProperty("--text", vars.text);
        root.style.setProperty("--text2", vars.text2);
        root.style.setProperty("--text3", vars.text3);
        root.style.setProperty("--accent", vars.accent);
        root.style.setProperty("--accent2", vars.accent2);
        root.style.setProperty("--accent-glow", vars.accentGlow);
        root.style.setProperty("--green", vars.green);
        root.style.setProperty("--amber", vars.amber);
        root.style.setProperty("--red", vars.red);
        root.style.setProperty("--card-bg", vars.cardBg);
        root.style.setProperty("--header-bg", vars.headerBg);
        // Also update the new CSS variable names to match the gray/white design system
        root.style.setProperty("--bg-secondary", name === "light" ? "#f1f5f9" : vars.bg);
        root.style.setProperty("--bg-tertiary", name === "light" ? "#e2e8f0" : vars.surface);
        root.style.setProperty("--surface", vars.surface);
        root.style.setProperty("--surface-raised", vars.cardBg);
        root.style.setProperty("--text-primary", vars.text);
        root.style.setProperty("--text-secondary", vars.text2);
        root.style.setProperty("--text-tertiary", vars.text3);
        root.style.setProperty("--success", vars.green);
        root.style.setProperty("--warning", vars.amber);
        root.style.setProperty("--danger", vars.red);
        document.body.dataset.theme = name;
        this.listeners.forEach((fn) => fn(name));
    }
    onChange(fn) { this.listeners.push(fn); }
}
//# sourceMappingURL=theme.js.map