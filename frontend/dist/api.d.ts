import type { AgentEventMap, HistoryItem, ReportData, UploadResult } from "./types.js";
/** Type-safe SSE event stream */
export declare class ResearchStream {
    private es;
    constructor(question: string, depth: string, fileTokens: string[]);
    on<K extends keyof AgentEventMap>(event: K, handler: (data: AgentEventMap[K]) => void): this;
    onError(handler: () => void): this;
    close(): void;
}
/** Upload a file to the server */
export declare function uploadFile(file: File): Promise<UploadResult>;
/** Fetch report history */
export declare function fetchHistory(): Promise<HistoryItem[]>;
/** Fetch a single saved report by ID */
export declare function fetchReport(id: string): Promise<ReportData>;
/** Ask a follow-up question about a report */
export declare function askFollowUp(reportId: string, question: string, history: {
    role: string;
    content: string;
}[]): Promise<{
    answer?: string;
    error?: string;
    score?: {
        citation_precision: number;
    };
}>;
//# sourceMappingURL=api.d.ts.map