/* ── Verity FX engine (dependency-free) ────────────────────────────────
   Ambient particles, CSS-3D hero core, scroll reveals, and an
   interactive 3D source map rendered with real rotation + perspective
   projection on Canvas 2D. Honors prefers-reduced-motion; degrades to a
   static frame when animation is off and renders nothing without canvas
   support (pages stay fully functional). */
import { h } from "./u.js";
import { RSource } from "./net.js";

export const REDUCED: boolean =
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function canCanvas(): boolean {
  try { return !!document.createElement("canvas").getContext("2d"); } catch { return false; }
}
const FX_ON = canCanvas();

/* rAF loop that pauses off-screen and dies with its canvas */
function loop(cv: HTMLCanvasElement, draw: (t: number) => void): void {
  let visible = true, raf = 0;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.02 });
  io.observe(cv);
  const tick = (t: number) => {
    if (!cv.isConnected) { cancelAnimationFrame(raf); io.disconnect(); return; }
    if (visible) draw(t / 1000);
    raf = requestAnimationFrame(tick);
  };
  if (REDUCED) { requestAnimationFrame(() => draw(0.001)); return; }
  raf = requestAnimationFrame(tick);
}

function fit(cv: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = cv.getContext("2d")!;
  const scale = Math.min(devicePixelRatio || 1, 2);
  const resize = () => {
    const r = cv.getBoundingClientRect();
    if (r.width && r.height) { cv.width = r.width * scale; cv.height = r.height * scale; }
  };
  requestAnimationFrame(resize);
  new ResizeObserver(resize).observe(cv);
  return ctx;
}

/* ── 3D math ───────────────────────────────────────────────────────── */
type V3 = { x: number; y: number; z: number };
function rotXY(p: V3, ax: number, ay: number): V3 {
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
  return { x: x1, y: p.y * cx - z1 * sx, z: p.y * sx + z1 * cx };
}
function project(p: V3, W: number, H: number, fov = 3.4): { x: number; y: number; s: number } {
  const s = fov / (fov + p.z);
  return { x: W / 2 + p.x * s * W * 0.5, y: H / 2 + p.y * s * W * 0.5, s };
}

/* ── Ambient particle field ────────────────────────────────────────── */
export function particleField(density = 1): HTMLElement {
  const wrap = h("div.fx-particles", { "aria-hidden": "true" });
  wrap.style.pointerEvents = "none";
  if (!FX_ON || REDUCED) return wrap;
  const cv = document.createElement("canvas");
  wrap.append(cv);
  const ctx = fit(cv);
  const P = Array.from({ length: Math.round(64 * density) }, () => ({
    x: Math.random(), y: Math.random(), z: 0.25 + Math.random() * 0.75,
    vx: (Math.random() - 0.5) * 0.014, vy: -0.004 - Math.random() * 0.013,
    tw: Math.random() * Math.PI * 2,
  }));
  loop(cv, (t) => {
    const W = cv.width, H = cv.height;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.x = (p.x + p.vx * 0.016 + 1) % 1;
      p.y = (p.y + p.vy * 0.016 + 1) % 1;
      const a = (0.22 + 0.28 * Math.sin(t * 1.6 + p.tw)) * p.z;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, Math.max((0.8 + p.z * 1.7) * (W / 1100), 0.6), 0, 7);
      ctx.fillStyle = `rgba(167,139,250,${Math.max(a, 0.04).toFixed(3)})`;
      ctx.fill();
    }
  });
  return wrap;
}

/* ── Floating 3D core (CSS 3D, mouse-tilt parallax) ────────────────── */
export function core3D(): HTMLElement {
  const face = (cls: string, letter?: boolean) => {
    const f = h("div.core-face." + cls);
    if (letter) {
      const v = h("span", null, "V");
      v.style.cssText = "font:700 52px 'Space Grotesk',ui-sans-serif;color:#f0eaff;text-shadow:0 0 26px rgba(196,181,253,.9)";
      f.append(v);
    }
    return f;
  };
  const scene = h("div.core-scene", { "aria-hidden": "true" },
    h("div.core-glow"),
    h("div.core-ring.r2"), h("div.core-ring.r1"), h("div.core-ring.r3"),
    h("div.core-pivot", null,
      h("div.core-cube", null,
        face("front", true), face("back", true), face("left"), face("right"), face("top"), face("bottom"))),
    h("div.core-sat.s1"), h("div.core-sat.s2"), h("div.core-sat.s3"),
    h("div.core-base"));
  if (!REDUCED) {
    const sec = scene;
    addEventListener("mousemove", (e) => {
      if (!sec.isConnected) return;
      const r = sec.getBoundingClientRect();
      if (!r.width) return;
      const mx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      const my = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      sec.style.setProperty("--tiltY", (mx * 10).toFixed(2) + "deg");
      sec.style.setProperty("--tiltX", (-my * 8).toFixed(2) + "deg");
    }, { passive: true });
  }
  return scene;
}

/* ── Scroll-triggered reveals ──────────────────────────────────────── */
export function wireReveals(scope: HTMLElement): void {
  const els = Array.from(scope.querySelectorAll<HTMLElement>(".fx-reveal"));
  if (REDUCED || !("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
  els.forEach((e, i) => { e.style.transitionDelay = Math.min(i % 6, 4) * 70 + "ms"; });
  const io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }, { threshold: 0.12 });
  els.forEach(e => io.observe(e));
}

/* ── Interactive 3D source map ─────────────────────────────────────── */
const CRED_RGB: Record<string, string> = { high: "163,230,53", medium: "250,204,21", low: "248,113,113" };

export function sourceMap(sources: RSource[], onPick: (id: number) => void): HTMLElement {
  const wrap = h("div.smap");
  if (!FX_ON || !sources.length) return wrap;
  const cv = document.createElement("canvas");
  cv.style.height = Math.min(430, 300 + sources.length * 10) + "px";
  const tip = h("div.smap-tip");
  wrap.append(cv, tip);
  const ctx = fit(cv);

  const R = 0.62;
  const pts = sources.map((s, i) => {
    const ph = (i / sources.length) * Math.PI * 2 + 0.6;
    const band = (i % 2 ? 0.18 : -0.18) + Math.sin(i * 2.17) * 0.12;
    return {
      id: s.id, title: s.title, cred: s.credibility,
      weight: 0.5 + Math.min((s.passages?.length || 0) * 0.25, 0.5),
      x: R * Math.cos(ph), y: band, z: R * Math.sin(ph),
    };
  });
  const projected: { x: number; y: number; idx: number }[] = [];
  let ay = 0.4, targetAy = 0.4; const ax = 0.3;
  let dragging = false, lastX = 0, autoSpin = !REDUCED, hover = -1, picked = -1;

  const toLocal = (clientX: number, clientY: number) => {
    const r = cv.getBoundingClientRect();
    return { x: (clientX - r.left) * (cv.width / r.width), y: (clientY - r.top) * (cv.height / r.height) };
  };
  const pickAt = (x: number, y: number): number => {
    let best = -1, bd = Math.pow(Math.max(26, cv.width / 24), 2);
    for (const p of projected) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p.idx; }
    }
    return best;
  };
  const showTip = (i: number) => {
    if (i < 0) { tip.style.opacity = "0"; return; }
    const r = cv.getBoundingClientRect();
    const p = projected.find(pp => pp.idx === i);
    if (!p) return;
    tip.textContent = `[${pts[i].id}] ${pts[i].title} — ${pts[i].cred} credibility · click to inspect`;
    tip.style.left = (p.x / cv.width) * r.width + "px";
    tip.style.top = (p.y / cv.height) * r.height - 44 + "px";
    tip.style.opacity = "1";
  };

  cv.addEventListener("mousemove", (e) => {
    if (dragging) { targetAy += (e.clientX - lastX) * 0.008; lastX = e.clientX; autoSpin = false; }
    const { x, y } = toLocal(e.clientX, e.clientY);
    hover = pickAt(x, y);
    cv.style.cursor = hover >= 0 ? "pointer" : "grab";
    showTip(hover);
  });
  cv.addEventListener("mousedown", (e) => { dragging = true; lastX = e.clientX; });
  addEventListener("mouseup", () => { dragging = false; });
  cv.addEventListener("mouseleave", () => { hover = -1; tip.style.opacity = "0"; });
  cv.addEventListener("click", () => { if (hover >= 0) { picked = hover; onPick(pts[hover].id); } });
  cv.addEventListener("touchstart", (e) => {
    const t = e.touches[0]; const { x, y } = toLocal(t.clientX, t.clientY);
    const i = pickAt(x, y);
    if (i >= 0) { picked = i; showTip(i); onPick(pts[i].id); }
  }, { passive: true });

  cv.tabIndex = 0;
  cv.setAttribute("role", "listbox");
  cv.setAttribute("aria-label", "3D source map — use arrow keys to cycle sources, Enter to inspect");
  cv.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      picked = ((picked < 0 ? 0 : picked + (e.key === "ArrowRight" ? 1 : pts.length - 1)) + pts.length) % pts.length;
      autoSpin = false; showTip(picked);
    } else if (e.key === "Enter" && picked >= 0) onPick(pts[picked].id);
  });

  loop(cv, (t) => {
    const W = cv.width, H = cv.height;
    if (!W) return;
    if (autoSpin) targetAy += 0.0022;
    ay += (targetAy - ay) * 0.08;
    ctx.clearRect(0, 0, W, H);
    projected.length = 0;

    const bg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.5);
    bg.addColorStop(0, "rgba(139,92,246,.09)"); bg.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const c = project({ x: 0, y: 0, z: 0 }, W, H);
    const pulse = 1 + 0.07 * Math.sin(t * 2.4);

    // edges + travelling pulses
    pts.forEach((p, i) => {
      const r3 = rotXY(p, ax, ay), pr = project(r3, W, H);
      const hot = i === hover || i === picked;
      const depth = Math.max(0.12, 1 - (r3.z + 0.7) / 1.4);
      const col = CRED_RGB[p.cred] || CRED_RGB.medium;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(pr.x, pr.y);
      ctx.strokeStyle = `rgba(${col},${hot ? 0.85 : 0.1 + 0.22 * depth})`;
      ctx.lineWidth = Math.max(1, W / (hot ? 520 : 1000)); ctx.stroke();
      const f = (t * 0.4 + i * 0.31) % 1;
      ctx.beginPath();
      ctx.arc(c.x + (pr.x - c.x) * f, c.y + (pr.y - c.y) * f, Math.max(1.4, W / 430), 0, 7);
      ctx.fillStyle = `rgba(${col},${hot ? 0.95 : 0.25 + 0.4 * depth})`; ctx.fill();
    });

    // central AI core
    const cg = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, W * 0.075 * pulse);
    cg.addColorStop(0, "#ede9fe"); cg.addColorStop(0.45, "#8b5cf6"); cg.addColorStop(1, "rgba(76,29,149,0)");
    ctx.beginPath(); ctx.arc(c.x, c.y, W * 0.075 * pulse, 0, 7); ctx.fillStyle = cg; ctx.fill();
    ctx.font = `700 ${Math.max(11, W / 70)}px 'Space Grotesk',ui-sans-serif`;
    ctx.textAlign = "center"; ctx.fillStyle = "#150926";
    ctx.fillText("V", c.x, c.y + Math.max(4, W / 210));

    // nodes + labels
    pts.forEach((p, i) => {
      const r3 = rotXY(p, ax, ay), pr = project(r3, W, H);
      projected.push({ x: pr.x, y: pr.y, idx: i });
      const hot = i === hover || i === picked;
      const depth = Math.max(0.25, 1 - (r3.z + 0.7) / 1.4);
      const col = CRED_RGB[p.cred] || CRED_RGB.medium;
      const rad = Math.max(3.6, W / 105) * (0.65 + 0.5 * p.weight) * (hot ? 1.35 : 1) * (0.6 + 0.4 * depth);
      ctx.beginPath(); ctx.arc(pr.x, pr.y, rad * 2.1, 0, 7);
      ctx.fillStyle = `rgba(${col},${hot ? 0.28 : 0.09 * depth})`; ctx.fill();
      ctx.beginPath(); ctx.arc(pr.x, pr.y, rad, 0, 7);
      ctx.fillStyle = `rgba(${col},${hot ? 1 : 0.5 + 0.5 * depth})`; ctx.fill();
      ctx.strokeStyle = "rgba(8,5,15,.7)"; ctx.lineWidth = 1.5; ctx.stroke();
      if (hot || depth > 0.6) {
        ctx.font = `${hot ? 700 : 500} ${Math.max(10, W / 78)}px ui-sans-serif,system-ui`;
        ctx.fillStyle = hot ? "#f3edff" : `rgba(178,166,199,${0.35 + 0.55 * depth})`;
        const label = `[${p.id}] ` + (p.title.length > 26 ? p.title.slice(0, 25) + "…" : p.title);
        ctx.fillText(label, pr.x, pr.y - rad * 2.5);
      }
    });
  });
  return wrap;
}
