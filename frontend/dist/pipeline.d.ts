declare const STAGES: readonly [{
    readonly key: "plan";
    readonly icon: "🧭";
    readonly label: "Planning";
}, {
    readonly key: "search";
    readonly icon: "🔎";
    readonly label: "Searching";
}, {
    readonly key: "read";
    readonly icon: "📄";
    readonly label: "Reading";
}, {
    readonly key: "write";
    readonly icon: "📝";
    readonly label: "Writing";
}, {
    readonly key: "verify";
    readonly icon: "✅";
    readonly label: "Verifying";
}, {
    readonly key: "done";
    readonly icon: "✨";
    readonly label: "Complete";
}];
type StageKey = (typeof STAGES)[number]["key"];
export declare class PipelineIndicator {
    private el;
    private activeIdx;
    constructor(container: HTMLElement);
    setStage(key: StageKey): void;
    reset(): void;
    destroy(): void;
}
export {};
//# sourceMappingURL=pipeline.d.ts.map