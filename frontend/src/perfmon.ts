/* ── Performance Monitor Widget ──────────────────────── */

export class PerfMonitor {
  private el: HTMLElement | null = null;
  private raf = 0;
  private frames: number[] = [];
  private lastTime = 0;
  private visible = false;
  private container: HTMLElement;
  private eventCount = 0;
  private sseLatency: number[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) this.start();
    else this.stop();
  }

  recordEvent(): void { this.eventCount++; }

  recordLatency(ms: number): void {
    this.sseLatency.push(ms);
    if (this.sseLatency.length > 50) this.sseLatency.shift();
  }

  private start(): void {
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.className = "perfmon";
      this.container.appendChild(this.el);
    }
    this.el.classList.remove("hidden");
    this.lastTime = performance.now();
    this.tick();
  }

  private stop(): void {
    cancelAnimationFrame(this.raf);
    this.el?.classList.add("hidden");
  }

  private tick = (): void => {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.frames.push(1000 / delta);
    if (this.frames.length > 60) this.frames.shift();

    const avgFps = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    const avgLatency = this.sseLatency.length
      ? this.sseLatency.reduce((a, b) => a + b, 0) / this.sseLatency.length
      : 0;

    // Mini sparkline
    const spark = this.frames.slice(-30).map((f) => {
      const h = Math.min(20, (f / 60) * 20);
      return `<div class="perfmon-bar" style="height:${h}px"></div>`;
    }).join("");

    if (this.el) {
      this.el.innerHTML = `
        <div class="perfmon-row">
          <span class="perfmon-label">FPS</span>
          <span class="perfmon-val ${avgFps < 30 ? "bad" : avgFps < 50 ? "warn" : "ok"}">${avgFps.toFixed(0)}</span>
        </div>
        <div class="perfmon-spark">${spark}</div>
        <div class="perfmon-row">
          <span class="perfmon-label">SSE events</span>
          <span class="perfmon-val">${this.eventCount}</span>
        </div>
        <div class="perfmon-row">
          <span class="perfmon-label">Avg latency</span>
          <span class="perfmon-val">${avgLatency.toFixed(0)}ms</span>
        </div>
        <div class="perfmon-row">
          <span class="perfmon-label">Memory</span>
          <span class="perfmon-val">${this.getMemory()}</span>
        </div>
      `;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private getMemory(): string {
    const perf = performance as any;
    if (perf.memory) {
      const mb = perf.memory.usedJSHeapSize / 1048576;
      return `${mb.toFixed(1)} MB`;
    }
    return "N/A";
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.el?.remove();
    this.el = null;
  }
}
