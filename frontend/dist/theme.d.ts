export type ThemeName = "light" | "dark" | "midnight";
export declare class ThemeEngine {
    private current;
    private listeners;
    constructor();
    private systemPref;
    get theme(): ThemeName;
    cycle(): ThemeName;
    set(name: ThemeName): void;
    private apply;
    onChange(fn: (t: ThemeName) => void): void;
}
//# sourceMappingURL=theme.d.ts.map