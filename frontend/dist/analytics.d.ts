import type { ReportData } from "./types.js";
export interface AnalyticsData {
    wordCount: number;
    readingMinutes: number;
    sentenceCount: number;
    avgSentenceLen: number;
    sourceBreakdown: {
        label: string;
        count: number;
        color: string;
    }[];
    claimBreakdown: {
        label: string;
        count: number;
        color: string;
    }[];
    depthScore: number;
}
export declare function computeAnalytics(d: ReportData): AnalyticsData;
export declare function renderAnalytics(d: ReportData, container: HTMLElement): void;
//# sourceMappingURL=analytics.d.ts.map