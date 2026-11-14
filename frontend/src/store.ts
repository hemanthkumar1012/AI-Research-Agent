/* ── Nyna state: localStorage index + IndexedDB blobs ────────────── */
import { uid } from "./u.js";

export interface VUser { name: string; email: string }
export interface VWorkspace { id: string; name: string; created: number }
export interface VProject { id: string; name: string; created: number; updated: number }
export interface VReportMeta {
  id: string; question: string; created: number; projectId?: string;
  sources: number; precision: number; claims: number; depth: string; secs: number;
  starred?: boolean;
}
export interface VDoc {
  id: string; name: string; kind: "pdf" | "doc" | "note" | "data" | "image";
  size: number; added: number; hasText: boolean; useInResearch: boolean;
}
export interface VEvent { t: number; type: string; n?: number; label?: string }
export interface VNotif { t: number; text: string; reportId?: string; read: boolean }

interface Root {
  user: VUser | null;
  workspaces: VWorkspace[];
  activeWs: string;
  byWs: Record<string, {
    projects: VProject[]; reports: VReportMeta[]; docs: VDoc[];
    events: VEvent[]; notifs: VNotif[];
  }>;
  sidebarCollapsed: boolean;
}

const LS_KEY = "verity:v1";

function blankWs(): Root["byWs"][string] {
  return { projects: [], reports: [], docs: [], events: [], notifs: [] };
}

function loadRoot(): Root {
  try {
    const r = JSON.parse(localStorage.getItem(LS_KEY) || "");
    if (r && r.workspaces) return r;
  } catch { /* fresh */ }
  const wsId = uid();
  return { user: null, workspaces: [{ id: wsId, name: "Personal Workspace", created: Date.now() }], activeWs: wsId, byWs: { [wsId]: blankWs() }, sidebarCollapsed: false };
}

class Store {
  root: Root = loadRoot();

  save(): void {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.root)); }
    catch { /* quota — metadata only, should not happen */ }
  }
  get ws(): Root["byWs"][string] {
    if (!this.root.byWs[this.root.activeWs]) this.root.byWs[this.root.activeWs] = blankWs();
    return this.root.byWs[this.root.activeWs];
  }
  get wsMeta(): VWorkspace {
    return this.root.workspaces.find(w => w.id === this.root.activeWs) || this.root.workspaces[0];
  }

  /* auth */
  signIn(name: string, email: string): void { this.root.user = { name, email }; this.save(); }
  signOut(): void { this.root.user = null; this.save(); }

  /* workspaces */
  addWorkspace(name: string): void {
    const w = { id: uid(), name, created: Date.now() };
    this.root.workspaces.push(w); this.root.byWs[w.id] = blankWs(); this.root.activeWs = w.id; this.save();
  }
  switchWorkspace(id: string): void { this.root.activeWs = id; this.save(); }
  renameWorkspace(id: string, name: string): void {
    const w = this.root.workspaces.find(x => x.id === id); if (w) { w.name = name; this.save(); }
  }
  deleteWorkspace(id: string): boolean {
    if (this.root.workspaces.length < 2) return false;
    this.root.workspaces = this.root.workspaces.filter(w => w.id !== id);
    delete this.root.byWs[id];
    if (this.root.activeWs === id) this.root.activeWs = this.root.workspaces[0].id;
    this.save(); return true;
  }

  /* projects */
  addProject(name: string): VProject {
    const p = { id: uid(), name, created: Date.now(), updated: Date.now() };
    this.ws.projects.unshift(p); this.save(); return p;
  }
  project(id: string): VProject | undefined { return this.ws.projects.find(p => p.id === id); }
  renameProject(id: string, name: string): void {
    const p = this.project(id); if (p) { p.name = name; p.updated = Date.now(); this.save(); }
  }
  deleteProject(id: string): void {
    this.ws.projects = this.ws.projects.filter(p => p.id !== id);
    for (const r of this.ws.reports) if (r.projectId === id) delete r.projectId;
    this.save();
  }
  touchProject(id: string): void { const p = this.project(id); if (p) { p.updated = Date.now(); this.save(); } }
  reportsIn(projectId: string): VReportMeta[] { return this.ws.reports.filter(r => r.projectId === projectId); }

  /* reports */
  addReport(m: VReportMeta): void { this.ws.reports.unshift(m); this.save(); }
  reportMeta(id: string): VReportMeta | undefined { return this.ws.reports.find(r => r.id === id); }
  assignReport(id: string, projectId?: string): void {
    const r = this.reportMeta(id); if (!r) return;
    r.projectId = projectId; if (projectId) this.touchProject(projectId); this.save();
  }
  toggleStar(id: string): void {
    const r = this.reportMeta(id);
    if (r) { r.starred = !r.starred; this.save(); }
  }
  deleteReport(id: string): void {
    this.ws.reports = this.ws.reports.filter(r => r.id !== id); this.save(); void dbDel("reports", id);
  }

  /* knowledge base */
  addDoc(d: VDoc): void { this.ws.docs.unshift(d); this.save(); }
  deleteDoc(id: string): void {
    this.ws.docs = this.ws.docs.filter(d => d.id !== id); this.save(); void dbDel("files", id);
  }

  /* analytics + notifications */
  log(type: string, n?: number, label?: string): void {
    this.ws.events.push({ t: Date.now(), type, n, label });
    if (this.ws.events.length > 3000) this.ws.events = this.ws.events.slice(-2500);
    this.save();
  }
  notify(text: string, reportId?: string): void {
    this.ws.notifs.unshift({ t: Date.now(), text, reportId, read: false });
    this.ws.notifs = this.ws.notifs.slice(0, 30); this.save();
  }
  markNotifsRead(): void { for (const n of this.ws.notifs) n.read = true; this.save(); }
}

export const ST = new Store();

/* ── IndexedDB for large payloads (full reports, file blobs) ───────── */
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise((res, rej) => {
    const req = indexedDB.open("verity-db", 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("reports")) d.createObjectStore("reports");
      if (!d.objectStoreNames.contains("files")) d.createObjectStore("files");
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbp;
}
function tx(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<unknown> {
  return db().then(d => new Promise((res, rej) => {
    const r = fn(d.transaction(store, mode).objectStore(store));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
export function dbPut(store: "reports" | "files", key: string, val: unknown): Promise<unknown> {
  return tx(store, "readwrite", s => s.put(val, key));
}
export function dbGet<T>(store: "reports" | "files", key: string): Promise<T | undefined> {
  return tx(store, "readonly", s => s.get(key)) as Promise<T | undefined>;
}
export function dbDel(store: "reports" | "files", key: string): Promise<unknown> {
  return tx(store, "readwrite", s => s.delete(key));
}

/* stored file payload */
export interface VFilePayload { blob: Blob; text: string }
