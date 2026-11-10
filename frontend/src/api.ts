/* ── API client for the Research Agent backend ────────── */

import type {
  AgentEventMap,
  HistoryItem,
  ReportData,
  UploadResult,
} from "./types.js";

const BASE = "";  // same-origin

/** Type-safe SSE event stream */
export class ResearchStream {
  private es: EventSource;

  constructor(question: string, depth: string, fileTokens: string[]) {
    const params = new URLSearchParams({
      q: question,
      depth,
      files: fileTokens.join(","),
    });
    this.es = new EventSource(`${BASE}/api/research?${params}`);
  }

  on<K extends keyof AgentEventMap>(
    event: K,
    handler: (data: AgentEventMap[K]) => void
  ): this {
    this.es.addEventListener(event, ((ev: MessageEvent) => {
      handler(JSON.parse(ev.data));
    }) as EventListener);
    return this;
  }

  onError(handler: () => void): this {
    this.es.onerror = handler;
    return this;
  }

  close(): void {
    this.es.close();
  }
}

/** Upload a file to the server */
export async function uploadFile(file: File): Promise<UploadResult> {
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { "X-Filename": file.name },
    body: file,
  });
  return res.json();
}

/** Fetch report history */
export async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await fetch(`${BASE}/api/history`);
  return res.json();
}

/** Fetch a single saved report by ID */
export async function fetchReport(id: string): Promise<ReportData> {
  const res = await fetch(`${BASE}/api/report?id=${encodeURIComponent(id)}`);
  return res.json();
}

/** Ask a follow-up question about a report */
export async function askFollowUp(
  reportId: string,
  question: string,
  history: { role: string; content: string }[]
): Promise<{
  answer?: string;
  error?: string;
  score?: { citation_precision: number };
}> {
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: reportId, question, history }),
  });
  return res.json();
}
