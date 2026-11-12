type ToastKind = "info" | "success" | "warn" | "error";
export declare function toast(message: string, kind?: ToastKind, duration?: number): void;
export interface Command {
    id: string;
    label: string;
    icon: string;
    shortcut?: string;
    action: () => void;
    category?: string;
}
export declare function registerCommands(cmds: Command[]): void;
export declare function openPalette(): void;
export declare function closePalette(): void;
export declare function initCommandPalette(): void;
export {};
//# sourceMappingURL=commands.d.ts.map