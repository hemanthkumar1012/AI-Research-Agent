/* ── Performance Monitor Widget ──────────────────────── */
export class PerfMonitor {
    el = null;
    raf = 0;
    frames = [];
    lastTime = 0;
    visible = false;
    container;
    eventCount = 0;
    sseLatency = [];
    constructor(container) {
        this.container = container;
    }
    toggle() {
        this.visible = !this.visible;
        if (this.visible)
            this.start();
        else
            this.stop();
    }
    recordEvent() { this.eventCount++; }
    recordLatency(ms) {
        this.sseLatency.push(ms);
        if (this.sseLatency.length > 50)
            this.sseLatency.shift();
    }
    start() {
        if (!this.el) {
            this.el = document.createElement("div");
            this.el.className = "perfmon";
            this.container.appendChild(this.el);
        }
        this.el.classList.remove("hidden");
        this.lastTime = performance.now();
        this.tick();
    }
    stop() {
        cancelAnimationFrame(this.raf);
        this.el?.classList.add("hidden");
    }
    tick = () => {
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        this.frames.push(1000 / delta);
        if (this.frames.length > 60)
            this.frames.shift();
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
    getMemory() {
        const perf = performance;
        if (perf.memory) {
            const mb = perf.memory.usedJSHeapSize / 1048576;
            return `${mb.toFixed(1)} MB`;
        }
        return "N/A";
    }
    destroy() {
        cancelAnimationFrame(this.raf);
        this.el?.remove();
        this.el = null;
    }
}
//# sourceMappingURL=perfmon.js.map