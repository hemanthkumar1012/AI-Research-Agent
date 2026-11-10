/* ── Research Session Bookmarks ────────────────────────── */
/* Save and restore research sessions from localStorage      */
/* Includes session naming, tagging, and quick recall         */

import { esc } from "./utils.js";
import { toast } from "./commands.js";

interface Bookmark {
  id: string;
  query: string;
  title: string;
  tags: string[];
  timestamp: number;
  reportPreview: string;
  sourceCount: number;
  claimCount: number;
  score: number;
}

const STORAGE_KEY = "ai-research-bookmarks";

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveBookmarks(bookmarks: Bookmark[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch { /* quota exceeded */ }
}

export function addBookmark(query: string, report: string, sourceCount: number, claimCount: number, score: number): void {
  const bookmarks = loadBookmarks();
  const preview = report.replace(/[#*_`>]/g, "").slice(0, 150);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  bookmarks.unshift({
    id,
    query,
    title: query.slice(0, 80),
    tags: extractTags(query),
    timestamp: Date.now(),
    reportPreview: preview,
    sourceCount,
    claimCount,
    score
  });

  // Keep max 50
  if (bookmarks.length > 50) bookmarks.length = 50;
  saveBookmarks(bookmarks);
  toast("Research bookmarked ★", "info", 2000);
}

export function removeBookmark(id: string): void {
  const bookmarks = loadBookmarks().filter(b => b.id !== id);
  saveBookmarks(bookmarks);
}

function extractTags(query: string): string[] {
  const tags: string[] = [];
  const words = query.toLowerCase().split(/\s+/);
  const tagWords = ["ai", "ml", "science", "health", "tech", "finance", "crypto", "climate", "politics", "security", "education", "research"];
  for (const w of words) {
    if (tagWords.includes(w) && !tags.includes(w)) tags.push(w);
  }
  return tags.slice(0, 3);
}

export function renderBookmarksPanel(container: HTMLElement, onLoad: (query: string) => void): void {
  const bookmarks = loadBookmarks();

  if (!bookmarks.length) {
    container.innerHTML = `<div class="empty-state"><span class="es-icon">★</span><h3>No Bookmarks</h3><p>Bookmark research sessions for quick recall</p></div>`;
    return;
  }

  let html = `<div class="bm-panel">`;
  html += `<div class="bm-header"><span class="bm-count">${bookmarks.length} saved</span></div>`;

  for (const b of bookmarks) {
    const date = new Date(b.timestamp);
    const ago = formatAgo(date);
    html += `<div class="bm-card" data-id="${b.id}">`;
    html += `<div class="bm-card-top">`;
    html += `<span class="bm-title">${esc(b.title)}</span>`;
    html += `<button class="bm-delete" data-del="${b.id}" title="Remove">✕</button>`;
    html += `</div>`;
    html += `<div class="bm-preview">${esc(b.reportPreview)}…</div>`;
    html += `<div class="bm-meta">`;
    html += `<span class="bm-time">${ago}</span>`;
    html += `<span class="bm-stat">${b.sourceCount} sources</span>`;
    html += `<span class="bm-stat">${b.claimCount} claims</span>`;
    html += `<span class="bm-score">${b.score}/100</span>`;
    html += `</div>`;
    if (b.tags.length) {
      html += `<div class="bm-tags">`;
      for (const t of b.tags) html += `<span class="bm-tag">${t}</span>`;
      html += `</div>`;
    }
    html += `<button class="bm-load" data-query="${esc(b.query)}">Load Research →</button>`;
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  // Event delegation
  container.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("bm-load")) {
      const query = target.getAttribute("data-query") || "";
      onLoad(query);
    }
    if (target.classList.contains("bm-delete")) {
      const id = target.getAttribute("data-del") || "";
      removeBookmark(id);
      renderBookmarksPanel(container, onLoad);
    }
  });
}

function formatAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function getBookmarkCount(): number {
  return loadBookmarks().length;
}
