"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCachedAgent } from "@/lib/agent-cache";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useOverview } from "@/components/overview/overview-context";
import type { AgentMeta, AgentRun } from "@/lib/types";
import { ProfileMenu } from "./profile-menu";
import { ToolBadge } from "@/components/tool-tooltip";
import {
  GridIcon,
  ChevronLeftIcon,
  InfoIcon,
  PlusIcon,
  XIcon,
  TrashIcon,
} from "@/components/icons";

interface SessionSummary {
  session_id: string;
  label: string;
  turnCount: number;
  lastAt: string;
  status: "completed" | "failed" | "running" | "mixed";
}

interface Capabilities {
  skills: { slug: string; name: string; description: string; category: string }[];
  commands: { slug: string; name: string; description: string; group?: string }[];
  mcpServers: { name: string; type: string }[];
  subagents: { slug: string; name: string; description: string; emoji?: string }[];
  tools: string[];
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` ${time}`;
}

function groupSessions(runs: AgentRun[]): SessionSummary[] {
  const sessions = new Map<string, AgentRun[]>();
  for (const run of runs) {
    if (!run.session_id) continue;
    const arr = sessions.get(run.session_id) || [];
    arr.push(run);
    sessions.set(run.session_id, arr);
  }

  return Array.from(sessions.entries())
    .map(([sid, sRuns]) => {
      const sorted = sRuns.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const statuses = new Set(sorted.map((r) => r.status));
      let status: SessionSummary["status"] = "completed";
      if (statuses.has("running")) status = "running";
      else if (statuses.size > 1) status = "mixed";
      else if (statuses.has("failed")) status = "failed";

      return {
        session_id: sid,
        label: formatSessionDate(sorted[0].created_at),
        turnCount: sorted.length,
        lastAt: sorted[sorted.length - 1].created_at,
        status,
      };
    })
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}

function OverviewLink({ label, icon }: { label: string; icon: "grid" | "back" }) {
  const { setTab } = useOverview();
  return (
    <button
      onClick={() => setTab("agents")}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
    >
      {icon === "grid" ? <GridIcon size={14} /> : <ChevronLeftIcon size={14} />}
      {label}
    </button>
  );
}

function DetailSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  return (
    <div className="border-t border-[var(--border-subtle)] pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-2"
      >
        <span>
          {title}
          <span className="ml-1.5 text-[var(--text-muted)] normal-case font-normal">{count}</span>
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

export function AgentSidebar({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSession = searchParams.get("session");
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  const cachedAgent = getCachedAgent(slug);
  const [agent, setAgent] = useState<AgentMeta | null>(cachedAgent || null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [titles, setTitles] = useState<Record<string, string>>({});


  const fetchTitles = useCallback((sessionIds: string[]) => {
    if (sessionIds.length === 0) return;
    fetch(`/api/ai/title?session_ids=${sessionIds.join(",")}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.titles) setTitles((prev) => ({ ...prev, ...d.titles }));
      })
      .catch(() => {});
  }, []);

  const fetchSessions = useCallback(() => {
    fetch(`/api/runs?agent_slug=${slug}&limit=100`)
      .then((r) => r.json())
      .then((runs: AgentRun[]) => {
        const grouped = groupSessions(runs);
        setSessions(grouped);
        setSessionsLoaded(true);
        fetchTitles(grouped.map((s) => s.session_id));
      })
      .catch(() => setSessionsLoaded(true));
  }, [slug, fetchTitles]);

  useEffect(() => {
    if (!agent) {
      fetch("/api/agents")
        .then((r) => r.json())
        .then((agents: AgentMeta[]) => {
          setAgent(agents.find((a: AgentMeta) => a.slug === slug) || null);
        });
    }

    fetchSessions();

    fetch(`/api/agents/${slug}/capabilities`)
      .then((r) => r.json())
      .then((data) => setCaps(data))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, fetchSessions]);

  useEffect(() => {
    const handler = () => fetchSessions();
    window.addEventListener("agent-session-updated", handler);

    const titleHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { session_id?: string; title?: string } | undefined;
      if (detail?.session_id && detail?.title) {
        setTitles((prev) => ({ ...prev, [detail.session_id!]: detail.title! }));
      }
    };
    window.addEventListener("session-title-ready", titleHandler);

    const startHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { session_id?: string } | undefined;
      if (!detail?.session_id) return;
      setSessions((prev) => {
        if (prev.some((s) => s.session_id === detail.session_id)) return prev;
        return [
          {
            session_id: detail.session_id!,
            label: formatSessionDate(new Date().toISOString()),
            turnCount: 1,
            lastAt: new Date().toISOString(),
            status: "running" as const,
          },
          ...prev,
        ];
      });
    };
    window.addEventListener("agent-session-started", startHandler);

    return () => {
      window.removeEventListener("agent-session-updated", handler);
      window.removeEventListener("session-title-ready", titleHandler);
      window.removeEventListener("agent-session-started", startHandler);
    };
  }, [fetchSessions, fetchTitles]);

  const handleNewChat = () => {
    router.push(`/agents/${slug}/chat`, { scroll: false });
  };

  const handleResumeSession = (sessionId: string) => {
    router.push(`/agents/${slug}/chat?session=${sessionId}`, { scroll: false });
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingSession(sessionId);
    try {
      const res = await fetch(`/api/runs?session_id=${sessionId}`, { method: "DELETE" });
      if (!res.ok) return;
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (activeSession === sessionId) {
        router.push(`/agents/${slug}/chat`, { scroll: false });
      }
      window.dispatchEvent(new Event("agent-session-updated"));
    } finally {
      setDeletingSession(null);
    }
  };

  return (
    <nav className="w-[220px] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-base)] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 h-12">
        {slug === "main" ? (
          <OverviewLink label="Overview" icon="grid" />
        ) : (
          <OverviewLink label="All Agents" icon="back" />
        )}
        <NotificationBell />
      </div>

      {/* Agent header */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {agent?.emoji && <span className="text-base">{agent.emoji}</span>}
            <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
              {agent?.name || slug}
            </span>
          </div>

          <div className="relative flex items-center gap-1">
            <button
              onClick={() => setShowTooltip(!showTooltip)}
              className={`flex items-center justify-center h-6 w-6 rounded-md transition-colors ${
                showTooltip
                  ? "text-[var(--text-primary)] bg-[var(--bg-active)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <InfoIcon size={14} />
            </button>

            {showTooltip && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowTooltip(false)}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div
                  className="relative z-10 w-[420px] max-h-[80vh] rounded-lg border border-[var(--border-default)] bg-[#111113] shadow-2xl shadow-black/60 flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setShowTooltip(false)}
                    className="absolute top-4 right-4 z-10 flex items-center justify-center h-6 w-6 rounded-md text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    <XIcon size={14} />
                  </button>

                  <div className="overflow-y-auto p-6 pr-6">
                    <div className="flex items-start gap-3 mb-4 pr-8">
                      {agent?.emoji && <span className="text-2xl">{agent.emoji}</span>}
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{agent?.name}</h2>
                        {agent?.vibe && (
                          <p className="text-[11px] text-[var(--text-muted)] italic mt-0.5">{agent.vibe}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-5">
                      {agent?.description}
                    </p>

                  {/* Meta chips */}
                  {(agent?.model || agent?.color) && (
                    <div className="flex flex-wrap items-center gap-2 mb-5">
                      {agent.model && (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border border-[var(--accent-muted)] bg-[var(--accent-muted)] text-[var(--accent-text)]">
                          {agent.model}
                        </span>
                      )}
                      {agent.color && (
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-[var(--border-default)] shrink-0"
                          style={{ backgroundColor: agent.color }}
                        />
                      )}
                    </div>
                  )}

                  {/* Capability sections */}
                  {caps && (
                    <div className="space-y-4">
                      <DetailSection title="Tools" count={caps.tools.length} defaultOpen>
                          <div className="flex flex-wrap gap-1.5">
                            {caps.tools.map((t) => (
                              <ToolBadge
                                key={t}
                                name={t}
                                className="rounded-md px-2 py-0.5 text-[11px] font-medium border border-[var(--accent-muted)] bg-[var(--accent-muted)] text-[var(--accent-text)] cursor-help"
                              />
                            ))}
                          </div>
                        </DetailSection>

                        <DetailSection title="Integrations" count={caps.mcpServers.length} defaultOpen>
                          <div className="flex flex-wrap gap-1.5">
                            {caps.mcpServers.map((s) => (
                              <span
                                key={s.name}
                                className={`rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                                  s.type === "remote"
                                    ? "border-green-500/15 bg-green-500/8 text-green-400/80"
                                    : "border-amber-500/15 bg-amber-500/8 text-amber-400/80"
                                }`}
                              >
                                <span className="opacity-50 text-[9px] mr-1">{s.type === "remote" ? "CLOUD" : "LOCAL"}</span>
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </DetailSection>

                      <DetailSection title="Subagents" count={caps.subagents.length}>
                        <div className="space-y-2">
                          {caps.subagents.map((a) => (
                            <div key={a.slug} className="flex items-start gap-2">
                              {a.emoji && <span className="text-sm mt-0.5">{a.emoji}</span>}
                              <div className="min-w-0">
                                <p className="text-[12px] font-medium text-[var(--text-secondary)]">{a.name}</p>
                                <p className="text-[11px] text-[var(--text-muted)] leading-snug">{a.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </DetailSection>

                      <DetailSection title="Skills" count={caps.skills.length}>
                        {(() => {
                          const grouped: Record<string, typeof caps.skills> = {};
                          for (const s of caps.skills) {
                            const cat = s.category || "Other";
                            if (!grouped[cat]) grouped[cat] = [];
                            grouped[cat].push(s);
                          }
                          return (
                            <div className="space-y-3">
                              {Object.entries(grouped).map(([category, skills]) => (
                                <div key={category}>
                                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{category}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {skills.map((s) => (
                                      <span key={s.slug} className="rounded-md px-2 py-0.5 text-[11px] font-medium border border-[var(--border-subtle)] bg-[var(--bg-raised)] text-[var(--text-tertiary)]">
                                        {s.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </DetailSection>

                      <DetailSection title="Commands" count={caps.commands.length}>
                        <div className="flex flex-wrap gap-1.5">
                          {caps.commands.map((c) => (
                            <span key={c.slug} className="rounded-md px-2 py-0.5 text-[11px] font-mono border border-[var(--border-subtle)] bg-[var(--bg-raised)] text-[var(--text-tertiary)]">
                              /{c.slug}
                            </span>
                          ))}
                        </div>
                      </DetailSection>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New chat button */}
      <div className="px-2 pt-2">
        <button
          onClick={handleNewChat}
          className={`w-full flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
            !activeSession
              ? "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
              : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          <PlusIcon size={14} />
          New chat
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-px">
        {!sessionsLoaded ? (
          <div className="space-y-1 px-1 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 rounded-md bg-[var(--bg-raised)] animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-[var(--text-muted)] text-center">
            No conversations yet
          </p>
        ) : (
          sessions.map((s) => {
            const isActive = activeSession === s.session_id;
            const isDeleting = deletingSession === s.session_id;
            return (
              <div
                key={s.session_id}
                className={`group relative rounded-md transition-colors ${
                  isActive
                    ? "bg-[var(--bg-active)]"
                    : "hover:bg-[var(--bg-hover)]"
                } ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
              >
                <button
                  onClick={() => handleResumeSession(s.session_id)}
                  className="w-full text-left px-2.5 py-1.5"
                >
                  <p className={`text-[12px] truncate pr-5 ${isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                    {titles[s.session_id] || s.label}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {s.turnCount} turn{s.turnCount > 1 ? "s" : ""} · {timeAgo(s.lastAt)}
                  </p>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(s.session_id);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)] transition-all"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Profile — pinned to bottom */}
      <div className="border-t border-[var(--border-subtle)] px-2 py-2">
        <ProfileMenu />
      </div>
    </nav>
  );
}
