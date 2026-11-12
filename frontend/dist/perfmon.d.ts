export declare class PerfMonitor {
    private el;
    private raf;
    private frames;
    private lastTime;
    private visible;
    private container;
    private eventCount;
    private sseLatency;
    constructor(container: HTMLElement);
    toggle(): void;
    recordEvent(): void;
    recordLatency(ms: number): void;
    private start;
    private stop;
    private tick;
    private getMemory;
    destroy(): void;
}
//# sourceMappingURL=perfmon.d.ts.map