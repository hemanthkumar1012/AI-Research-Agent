/* ── Theme Engine — professional light/dark with smooth transitions ── */

export type ThemeName = "light" | "dark" | "midnight";

interface ThemeVars {
  bg: string; bg2: string;
  surface: string; surfaceHover: string;
  border: string; borderHi: string;
  text: string; text2: string; text3: string;
  accent: string; accent2: string; accentGlow: string;
  green: string; amber: string; red: string;
  cardBg: string; headerBg: string;
}

const THEMES: Record<ThemeName, ThemeVars> = {
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
  private current: ThemeName;
  private listeners: ((t: ThemeName) => void)[] = [];

  constructor() {
    // Default to light for the professional gray/white look
    const stored = localStorage.getItem("theme") as ThemeName | null;
    this.current = stored || "light";
    this.apply(this.current);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (!localStorage.getItem("theme")) this.apply(this.systemPref());
    });
  }

  private systemPref(): ThemeName {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  get theme(): ThemeName { return this.current; }

  cycle(): ThemeName {
    const order: ThemeName[] = ["light", "dark", "midnight"];
    const next = order[(order.indexOf(this.current) + 1) % order.length];
    this.set(next);
    return next;
  }

  set(name: ThemeName): void {
    localStorage.setItem("theme", name);
    this.apply(name);
  }

  private apply(name: ThemeName): void {
    this.current = name;
    const root = document.documentElement;
    // Clear any inline vars from older versions so the stylesheet palette wins
    root.removeAttribute("style");
    root.dataset.theme = name;
    if (document.body) document.body.dataset.theme = name;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", name === "light" ? "#ffffff" : name === "dark" ? "#0f1117" : "#05060f");
    this.listeners.forEach((fn) => fn(name));
  }

  onChange(fn: (t: ThemeName) => void): void { this.listeners.push(fn); }
}
