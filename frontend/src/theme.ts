/* ── Theme Engine — light/dark/midnight + system pref ── */

export type ThemeName = "dark" | "light" | "midnight";

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
  dark: {
    bg: "#0a0a0f", bg2: "#12121a",
    surface: "rgba(255,255,255,0.04)", surfaceHover: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.08)", borderHi: "rgba(255,255,255,0.15)",
    text: "#e8e8ed", text2: "#9898a8", text3: "#68687a",
    accent: "#6c5ce7", accent2: "#a29bfe", accentGlow: "rgba(108,92,231,0.25)",
    green: "#00cec9", amber: "#fdcb6e", red: "#ff6b6b",
    cardBg: "rgba(255,255,255,0.04)", headerBg: "rgba(10,10,15,0.7)",
  },
  light: {
    bg: "#f0f2f5", bg2: "#ffffff",
    surface: "rgba(0,0,0,0.03)", surfaceHover: "rgba(0,0,0,0.06)",
    border: "rgba(0,0,0,0.1)", borderHi: "rgba(0,0,0,0.18)",
    text: "#1a1a2e", text2: "#4a4a5c", text3: "#8888a0",
    accent: "#5b4cdb", accent2: "#7c6ef7", accentGlow: "rgba(91,76,219,0.2)",
    green: "#00a89e", amber: "#e6a817", red: "#e84d4d",
    cardBg: "rgba(255,255,255,0.85)", headerBg: "rgba(240,242,245,0.85)",
  },
  midnight: {
    bg: "#050510", bg2: "#0a0a1a",
    surface: "rgba(100,100,255,0.04)", surfaceHover: "rgba(100,100,255,0.08)",
    border: "rgba(100,100,255,0.1)", borderHi: "rgba(100,100,255,0.2)",
    text: "#d0d0f0", text2: "#8080b0", text3: "#505078",
    accent: "#8b5cf6", accent2: "#c4b5fd", accentGlow: "rgba(139,92,246,0.3)",
    green: "#22d3ee", amber: "#facc15", red: "#fb7185",
    cardBg: "rgba(100,100,255,0.04)", headerBg: "rgba(5,5,16,0.8)",
  },
};

export class ThemeEngine {
  private current: ThemeName;
  private listeners: ((t: ThemeName) => void)[] = [];

  constructor() {
    this.current = (localStorage.getItem("theme") as ThemeName) || this.systemPref();
    this.apply(this.current);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (!localStorage.getItem("theme")) this.apply(this.systemPref());
    });
  }

  private systemPref(): ThemeName {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  get theme(): ThemeName { return this.current; }

  cycle(): ThemeName {
    const order: ThemeName[] = ["dark", "light", "midnight"];
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
    document.body.dataset.theme = name;
    this.listeners.forEach((fn) => fn(name));
  }

  onChange(fn: (t: ThemeName) => void): void { this.listeners.push(fn); }
}
