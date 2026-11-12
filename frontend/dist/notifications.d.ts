type NotifPriority = "info" | "success" | "warn" | "error";
export declare function notify(title: string, message: string, priority?: NotifPriority): void;
export declare function markRead(id: string): void;
export declare function markAllRead(): void;
export declare function clearNotifications(): void;
export declare function getUnreadCount(): number;
export declare function setNotificationListener(fn: () => void): void;
export declare function renderNotificationCenter(container: HTMLElement): void;
export {};
//# sourceMappingURL=notifications.d.ts.map