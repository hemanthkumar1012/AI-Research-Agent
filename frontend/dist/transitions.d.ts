export declare function fadeIn(el: HTMLElement, duration?: number): Promise<void>;
export declare function fadeOut(el: HTMLElement, duration?: number): Promise<void>;
export declare function slideIn(el: HTMLElement, direction?: "left" | "right" | "up" | "down", duration?: number): Promise<void>;
export declare function scaleIn(el: HTMLElement, duration?: number): Promise<void>;
export declare function morphPanel(from: HTMLElement, to: HTMLElement, duration?: number): Promise<void>;
export declare function staggerChildren(parent: HTMLElement, selector: string, delay?: number): void;
export declare function pulseElement(el: HTMLElement): void;
export declare function shakeElement(el: HTMLElement): void;
export declare function injectTransitionStyles(): void;
export declare function addRipple(el: HTMLElement, event: MouseEvent): void;
//# sourceMappingURL=transitions.d.ts.map