/* ── Animated pipeline progress indicator ─────────────── */
const STAGES = [
    { key: "plan", icon: "🧭", label: "Planning" },
    { key: "search", icon: "🔎", label: "Searching" },
    { key: "read", icon: "📄", label: "Reading" },
    { key: "write", icon: "📝", label: "Writing" },
    { key: "verify", icon: "✅", label: "Verifying" },
    { key: "done", icon: "✨", label: "Complete" },
];
export class PipelineIndicator {
    el;
    activeIdx = -1;
    constructor(container) {
        this.el = document.createElement("div");
        this.el.className = "pipeline";
        this.el.innerHTML = STAGES.map((s, i) => `<div class="pipeline-stage" data-stage="${s.key}">` +
            `<div class="pipeline-dot"><span>${s.icon}</span></div>` +
            `<div class="pipeline-label">${s.label}</div>` +
            (i < STAGES.length - 1 ? `<div class="pipeline-connector"></div>` : "") +
            `</div>`).join("");
        container.prepend(this.el);
    }
    setStage(key) {
        const idx = STAGES.findIndex((s) => s.key === key);
        if (idx < 0 || idx <= this.activeIdx)
            return;
        this.activeIdx = idx;
        this.el.querySelectorAll(".pipeline-stage").forEach((el, i) => {
            el.classList.toggle("active", i === idx);
            el.classList.toggle("complete", i < idx);
            el.classList.remove("pending");
            if (i > idx)
                el.classList.add("pending");
        });
    }
    reset() {
        this.activeIdx = -1;
        this.el.querySelectorAll(".pipeline-stage").forEach((el) => {
            el.classList.remove("active", "complete");
            el.classList.add("pending");
        });
    }
    destroy() {
        this.el.remove();
    }
}
//# sourceMappingURL=pipeline.js.map