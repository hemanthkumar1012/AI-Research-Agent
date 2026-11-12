/* ── API client for the Research Agent backend ────────── */
const BASE = ""; // same-origin
/** Type-safe SSE event stream */
export class ResearchStream {
    es;
    constructor(question, depth, fileTokens) {
        const params = new URLSearchParams({
            q: question,
            depth,
            files: fileTokens.join(","),
        });
        this.es = new EventSource(`${BASE}/api/research?${params}`);
    }
    on(event, handler) {
        this.es.addEventListener(event, ((ev) => {
            handler(JSON.parse(ev.data));
        }));
        return this;
    }
    onError(handler) {
        this.es.onerror = handler;
        return this;
    }
    close() {
        this.es.close();
    }
}
/** Upload a file to the server */
export async function uploadFile(file) {
    const res = await fetch(`${BASE}/api/upload`, {
        method: "POST",
        headers: { "X-Filename": file.name },
        body: file,
    });
    return res.json();
}
/** Fetch report history */
export async function fetchHistory() {
    const res = await fetch(`${BASE}/api/history`);
    return res.json();
}
/** Fetch a single saved report by ID */
export async function fetchReport(id) {
    const res = await fetch(`${BASE}/api/report?id=${encodeURIComponent(id)}`);
    return res.json();
}
/** Ask a follow-up question about a report */
export async function askFollowUp(reportId, question, history) {
    const res = await fetch(`${BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, question, history }),
    });
    return res.json();
}
//# sourceMappingURL=api.js.map