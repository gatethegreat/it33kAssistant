"use client";

import { useEffect, useState, useRef, useCallback } from "react"; // useRef kept for prevCountRef
import type { Notification } from "@/lib/types";
import { NotificationPanel } from "./notification-panel";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const prevCountRef = useRef(0);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true");
      if (!res.ok) return;
      const data: Notification[] = await res.json();
      setNotifications(data);

      // Fire desktop notification for new unreads
      if (permissionGranted && data.length > prevCountRef.current && prevCountRef.current >= 0) {
        const newest = data[0];
        if (newest) {
          new window.Notification(newest.title, {
            body: newest.summary || undefined,
            icon: "/favicon.ico",
          });
        }
      }
      prevCountRef.current = data.length;
    } catch {
      // silently fail
    }
  }, [permissionGranted]);

  useEffect(() => {
    // Request browser notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setPermissionGranted(true);
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => setPermissionGranted(p === "granted"));
      }
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);


  const handleMarkAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleMarkRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center h-6 w-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 6.5a3.5 3.5 0 017 0c0 2.5 1 4 1.5 4.5H3c.5-.5 1.5-2 1.5-4.5z" />
          <path d="M6.5 11v.5a1.5 1.5 0 003 0V11" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-[var(--accent)] px-0.5 text-[9px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          onMarkRead={handleMarkRead}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
