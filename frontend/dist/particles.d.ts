export type ParticleMode = "field" | "constellation" | "vortex";
export declare class ParticleField {
    private canvas;
    private ctx;
    private particles;
    private raf;
    private mouse;
    private count;
    private connectDist;
    private mode;
    private time;
    private hueBase;
    constructor(container: HTMLElement);
    setMode(m: ParticleMode): void;
    setHue(h: number): void;
    setDensity(n: number): void;
    private resize;
    private spawn;
    private animate;
    destroy(): void;
}
//# sourceMappingURL=particles.d.ts.map