/* ── Notification Center ──────────────────────────────── */
/* Collects research events into a dismissable feed panel    */
/* Supports priorities, grouping, and auto-dismiss           */

import { esc } from "./utils.js";

type NotifPriority = "info" | "success" | "warn" | "error";

interface Notification {
  id: string;
  title: string;
  message: string;
  priority: NotifPriority;
  timestamp: number;
  read: boolean;
  icon: string;
}

const notifications: Notification[] = [];
let onUpdate: (() => void) | null = null;

const ICONS: Record<NotifPriority, string> = {
  info: "ℹ️",
  success: "✅",
  warn: "⚠️",
  error: "❌"
};

export function notify(title: string, message: string, priority: NotifPriority = "info"): void {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  notifications.unshift({
    id,
    title,
    message,
    priority,
    timestamp: Date.now(),
    read: false,
    icon: ICONS[priority]
  });

  // Keep max 100
  if (notifications.length > 100) notifications.length = 100;

  if (onUpdate) onUpdate();
}

export function markRead(id: string): void {
  const n = notifications.find(x => x.id === id);
  if (n) n.read = true;
  if (onUpdate) onUpdate();
}

export function markAllRead(): void {
  for (const n of notifications) n.read = true;
  if (onUpdate) onUpdate();
}

export function clearNotifications(): void {
  notifications.length = 0;
  if (onUpdate) onUpdate();
}

export function getUnreadCount(): number {
  return notifications.filter(n => !n.read).length;
}

export function setNotificationListener(fn: () => void): void {
  onUpdate = fn;
}

export function renderNotificationCenter(container: HTMLElement): void {
  const unread = getUnreadCount();

  if (!notifications.length) {
    container.innerHTML = `<div class="empty-state"><span class="es-icon">🔔</span><h3>No Notifications</h3><p>Events will appear here during research</p></div>`;
    return;
  }

  let html = `<div class="notif-center">`;
  html += `<div class="notif-toolbar">`;
  html += `<span class="notif-count">${unread} unread</span>`;
  html += `<div class="notif-actions">`;
  html += `<button class="notif-btn notif-mark-all">Mark all read</button>`;
  html += `<button class="notif-btn notif-clear-all">Clear all</button>`;
  html += `</div></div>`;

  html += `<div class="notif-list">`;
  for (const n of notifications) {
    const cls = n.read ? "notif-item notif-read" : "notif-item notif-unread";
    const ago = formatTimeAgo(n.timestamp);
    html += `<div class="${cls} notif-${n.priority}" data-nid="${n.id}">`;
    html += `<span class="notif-icon">${n.icon}</span>`;
    html += `<div class="notif-body">`;
    html += `<div class="notif-title">${esc(n.title)}</div>`;
    html += `<div class="notif-msg">${esc(n.message)}</div>`;
    html += `<div class="notif-time">${ago}</div>`;
    html += `</div></div>`;
  }
  html += `</div></div>`;

  container.innerHTML = html;

  // Events
  container.querySelector(".notif-mark-all")?.addEventListener("click", () => {
    markAllRead();
    renderNotificationCenter(container);
  });
  container.querySelector(".notif-clear-all")?.addEventListener("click", () => {
    clearNotifications();
    renderNotificationCenter(container);
  });
  container.querySelectorAll(".notif-item").forEach(el => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).getAttribute("data-nid") || "";
      markRead(id);
      renderNotificationCenter(container);
    });
  });
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
