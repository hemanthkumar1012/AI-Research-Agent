/* ── Core domain types for AI Research Agent ────────── */

export interface Source {
  id: number;
  title: string;
  url: string;
  credibility: "user" | "high" | "medium" | "low";
  date?: string;
  passages?: string[];
  relevance?: number;
}

export interface AtomicFact {
  fact: string;
  supported: boolean;
  source: number | null;
  quote?: string;
}

export interface Claim {
  id: number;
  text: string;
  cites: number[];
  label: "supported" | "partial" | "unsupported" | "unchecked";
  reason?: string;
  facts?: AtomicFact[];
}

export interface Score {
  citation_precision: number;
  supported: number;
  partial: number;
  unsupported: number;
  fact_precision?: number;
  facts?: number;
}

export interface Usage {
  calls: number;
  cached: number;
  input_tokens: number;
  output_tokens: number;
}

export interface Conflict {
  topic: string;
  positions: { source: number; says: string }[];
  assessment?: string;
}

export interface HistoryEntry {
  citation_precision: number;
}

export interface ReportData {
  id?: string;
  question: string;
  markdown: string;
  sources: Source[];
  claims: Claim[];
  score: Score;
  history?: HistoryEntry[];
  usage?: Usage;
  conflicts?: Conflict[];
  time_sensitive?: boolean;
}

export interface HistoryItem {
  id: string;
  question: string;
  precision?: number;
}

export interface UploadResult {
  token: string;
  name: string;
  error?: string;
}

/* ── SSE event payloads ──────────────────────────────── */

export interface StatusEvent {
  message: string;
}

export interface PlanEvent {
  subquestions: { question: string; source: string }[];
  time_sensitive?: boolean;
}

export interface SearchEvent {
  query: string;
  kind: string;
}

export interface SourceEvent extends Source {}

export interface WritingEvent {
  phase: "draft" | "revision";
}

export interface TokenEvent {
  text: string;
}

export interface BudgetEvent {
  message: string;
  used: number;
  limit: number;
}

export interface GapsEvent {
  queries: string[];
}

export interface ConflictsEvent {
  conflicts: Conflict[];
}

export interface VerifyEvent {
  checked: number;
  total: number;
}

export interface ReviseEvent {
  round: number;
  flagged: number;
}

export interface ErrorEvent {
  message: string;
}

export type AgentEventMap = {
  status: StatusEvent;
  plan: PlanEvent;
  search: SearchEvent;
  source: SourceEvent;
  writing: WritingEvent;
  token: TokenEvent;
  budget: BudgetEvent;
  gaps: GapsEvent;
  conflicts: ConflictsEvent;
  verify: VerifyEvent;
  revise: ReviseEvent;
  report: ReportData;
  error: ErrorEvent;
};
