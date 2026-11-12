/** Escape HTML entities */
export declare function esc(s: unknown): string;
/** Format a float as a percentage string */
export declare function pct(x: number | undefined | null): string;
/** Shorthand for getElementById */
export declare function $(id: string): HTMLElement;
/** Type-safe query selector */
export declare function $q<T extends HTMLElement>(sel: string, root?: ParentNode): T;
/** Format number with locale separators */
export declare function fmt(n: number): string;
/** Generate a unique ID */
export declare function uid(): string;
/** Debounce a function */
export declare function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T;
/** Clamp a number between min and max */
export declare function clamp(n: number, min: number, max: number): number;
/** Format a date string relative to now */
export declare function timeAgo(date: string): string;
//# sourceMappingURL=utils.d.ts.map