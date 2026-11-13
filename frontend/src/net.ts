/* ── Verity network: SSE research client + JSON endpoints ──────────── */

export interface RSource {
  id: number; title: string; url: string; passages: string[];
  credibility: string; relevance: number; date: string;
}
export interface RClaim {
  id: number; text: string; cites: number[]; label: string; reason: string;
  facts: { fact: string; supported?: boolean }[];
}
export interface RScore {
  supported: number; partial: number; unsupported: number;
  citation_precision: number; claims: number;
}
export interface RReport {
  question: string; markdown: string; body: string; score: RScore;
  sources: RSource[]; claims: RClaim[]; plan: { question: string; query: string; source: string }[];
  conflicts: unknown[]; usage?: Record<string, number>; time_sensitive?: boolean;
}

export interface ResearchHandlers {
  status(msg: string): void;
  plan(subs: { question: string; query: string; source: string }[]): void;
  search(query: string, kind: string): void;
  source(s: { id: number; title: string; url: string; credibility: string }): void;
  draft(body: string): void;
  report(r: RReport): void;
  error(msg: string): void;
}

export interface ResearchRun { cancel(): void; done: Promise<void> }

/** POST /api/research and parse the SSE stream (works buffered or chunked). */
export function runResearch(
  q: string, depth: string,
  context: { name: string; text: string }[],
  on: ResearchHandlers,
): ResearchRun {
  const ctrl = new AbortController();
  let finished = false;

  const done = (async () => {
    let resp: Response;
    try {
      resp = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, depth, context }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (!ctrl.signal.aborted) on.error("Could not reach the research service. Check your connection and try again.");
      return;
    }
    if (!resp.ok || !resp.body) {
      on.error(resp.status === 504
        ? "The research service timed out. Try a shorter, more specific question."
        : `Research service error (HTTP ${resp.status}).`);
      return;
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const dispatch = (block: string) => {
      let ev = "message"; const datas: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) ev = line.slice(6).trim();
        else if (line.startsWith("data:")) datas.push(line.slice(5).trim());
      }
      if (!datas.length) return;
      let data: Record<string, unknown>;
      try { data = JSON.parse(datas.join("\n")); } catch { return; }
      switch (ev) {
        case "status": on.status(String(data.message || "")); break;
        case "plan": on.plan((data.subquestions as never[]) || []); break;
        case "search": on.search(String(data.query || ""), String(data.kind || "web")); break;
        case "source": on.source(data as never); break;
        case "draft": on.draft(String(data.body || "")); break;
        case "report": finished = true; on.report(data as unknown as RReport); break;
        case "error": finished = true; on.error(String(data.message || "Research failed.")); break;
      }
    };
    try {
      for (;;) {
        const { value, done: eof } = await reader.read();
        if (value) {
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) { dispatch(buf.slice(0, i)); buf = buf.slice(i + 2); }
        }
        if (eof) break;
      }
      if (buf.trim()) dispatch(buf);
      if (!finished) on.error("The research stream ended unexpectedly. Please try again.");
    } catch (e) {
      if (!ctrl.signal.aborted && !finished) on.error("Connection lost while researching. Please try again.");
    }
  })();

  return { cancel: () => ctrl.abort(), done };
}

/** Follow-up question grounded in a report (sends the report inline). */
export async function askFollowup(
  report: RReport, question: string, history: { role: string; content: string }[],
): Promise<{ answer: string; claims: RClaim[] } | { error: string }> {
  try {
    const r = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report, question, history }),
    });
    const j = await r.json();
    if (j.error) return { error: String(j.error) };
    return j;
  } catch {
    return { error: "Could not reach the server." };
  }
}

export async function fetchServerHistory(): Promise<{ id: string; question: string }[]> {
  try {
    const r = await fetch("/api/history");
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}
