"use client";

import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/types";
import { XIcon } from "@/components/icons";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function typeIcon(type: Notification["type"]): { icon: string; color: string } {
  switch (type) {
    case "completed":
      return { icon: "✓", color: "text-green-400" };
    case "failed":
      return { icon: "✕", color: "text-red-400" };
    case "needs_review":
      return { icon: "!", color: "text-yellow-400" };
    case "approval_needed":
      return { icon: "⏳", color: "text-amber-400" };
  }
}

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onClose: () => void;
}

export function NotificationPanel({
  notifications,
  onMarkAllRead,
  onMarkRead,
  onClose,
}: NotificationPanelProps) {
  const router = useRouter();

  const handleClick = (n: Notification) => {
    onMarkRead(n.id);
    onClose();
    if (n.session_id) {
      router.push(`/agents/${n.agent_slug}/chat?session=${n.session_id}`);
    } else {
      router.push(`/agents/${n.agent_slug}/chat`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[420px] max-h-[80vh] rounded-lg border border-[var(--border-default)] bg-[#111113] shadow-2xl shadow-black/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">Notifications</span>
          <div className="flex items-center gap-3">
            {notifications.some((n) => !n.read) && (
              <button onClick={onMarkAllRead} className="text-[11px] text-[var(--accent-text)] hover:underline">
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="flex items-center justify-center h-6 w-6 rounded-md text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
              <XIcon size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
          {notifications.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[var(--text-tertiary)]">No notifications</p>
          ) : (
            notifications.map((n) => {
              const { icon, color } = typeIcon(n.type);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--bg-hover)] ${
                    !n.read ? "bg-[var(--bg-raised)]" : ""
                  }`}
                >
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${color} bg-[var(--bg-elevated)]`}>
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] truncate ${!n.read ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-tertiary)]"}`}>
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.summary && (
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)] line-clamp-2">{n.summary}</p>
                    )}
                  </div>
                  {!n.read && (
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
