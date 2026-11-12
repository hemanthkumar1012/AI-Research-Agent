type Lang = "en" | "es" | "fr" | "de" | "ja" | "zh" | "hi" | "te";
export declare function initI18n(): void;
export declare function t(key: string): string;
export declare function setLang(lang: Lang): void;
export declare function getLang(): Lang;
export declare function getAvailableLangs(): {
    code: Lang;
    name: string;
}[];
export {};
//# sourceMappingURL=i18n.d.ts.map