export declare class ResearchTimeline {
    private entries;
    private container;
    private startTime;
    private el;
    constructor(container: HTMLElement);
    add(stage: string, icon: string, label: string, detail?: string): void;
    finish(): void;
    reset(): void;
    private formatDuration;
    private render;
}
//# sourceMappingURL=timeline.d.ts.map