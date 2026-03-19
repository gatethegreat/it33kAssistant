"use client";

import { useState } from "react";
import Link from "next/link";
import type { AgentRun } from "@/lib/types";
import { ChevronRightIcon, DollarIcon, ClockIcon, MessageIcon, AlertIcon, UserIcon, ScheduleIcon } from "@/components/icons";

const statusConfig: Record<
  string,
  { dot: string; label: string }
> = {
  queued: { dot: "bg-yellow-400", label: "Queued" },
  running: { dot: "bg-[var(--accent)] animate-pulse", label: "Running" },
  completed: { dot: "bg-emerald-400", label: "Completed" },
  failed: { dot: "bg-red-400", label: "Failed" },
  stopped: { dot: "bg-[var(--text-muted)]", label: "Stopped" },
};

type StatusFilter = "all" | "running" | "completed" | "failed" | "queued" | "stopped";
type SourceFilter = "all" | "manual" | "scheduled";

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const remaining = Math.floor(s % 60);
  return `${m}m ${remaining}s`;
}

function runHref(run: AgentRun): string {
  const base = `/agents/${run.agent_slug}/chat`;
  return run.session_id ? `${base}?session=${run.session_id}` : base;
}

function RunRow({ run }: { run: AgentRun }) {
  const status = statusConfig[run.status] || statusConfig.stopped;

  return (
    <Link
      href={runHref(run)}
      className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
    >
      {/* Status dot */}
      <span className={`h-2 w-2 rounded-full shrink-0 ${status.dot}`} />

      {/* Agent name */}
      <span className="text-[13px] font-medium text-[var(--text-primary)] w-32 shrink-0 truncate">
        {run.agent_name}
      </span>

      {/* Prompt */}
      <span className="text-[12px] text-[var(--text-tertiary)] truncate flex-1 min-w-0">
        {run.prompt || "—"}
      </span>

      {/* Meta: cost, duration, events */}
      <div className="flex items-center gap-3 shrink-0 text-[11px] text-[var(--text-muted)] tabular-nums">
        {run.cost_usd != null && (
          <span className="flex items-center gap-1">
            <DollarIcon size={12} className="opacity-50" />
            ${run.cost_usd.toFixed(4)}
          </span>
        )}
        {run.duration_ms != null && (
          <span className="flex items-center gap-1">
            <ClockIcon size={12} className="opacity-50" />
            {formatDuration(run.duration_ms)}
          </span>
        )}
        {run.event_count > 0 && (
          <span className="flex items-center gap-1">
            <MessageIcon size={12} className="opacity-50" />
            {run.event_count}
          </span>
        )}
        {run.error && (
          <AlertIcon size={12} className="text-red-400/60" />
        )}
      </div>

      {/* Time */}
      <span className="text-[11px] text-[var(--text-muted)] w-16 text-right shrink-0 tabular-nums">
        {timeAgo(run.created_at)}
      </span>

      {/* Chevron */}
      <ChevronRightIcon
        size={14}
        className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      />
    </Link>
  );
}

export function RunHistoryTable({ runs }: { runs: AgentRun[] }) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");

  const manualCount = runs.filter((r) => !r.schedule_id).length;
  const scheduledCount = runs.filter((r) => !!r.schedule_id).length;

  const sourceFiltered =
    source === "all" ? runs : source === "manual" ? runs.filter((r) => !r.schedule_id) : runs.filter((r) => !!r.schedule_id);

  const counts = sourceFiltered.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const filtered = filter === "all" ? sourceFiltered : sourceFiltered.filter((r) => r.status === filter);

  const activeFilters = (["all", "running", "completed", "failed", "queued", "stopped"] as const).filter(
    (f) => f === "all" || counts[f],
  );

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[13px] text-[var(--text-tertiary)]">No runs yet</p>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          Run an agent to see its history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Source toggle + Status filter pills */}
      <div className="flex items-center gap-4">
        {/* Source toggle */}
        <div className="flex items-center rounded-lg border border-[var(--border-subtle)] p-0.5">
          {(
            [
              { key: "all", label: "All", icon: null, count: runs.length },
              { key: "manual", label: "Manual", icon: UserIcon, count: manualCount },
              { key: "scheduled", label: "Scheduled", icon: ScheduleIcon, count: scheduledCount },
            ] as const
          ).map(({ key, label, icon: IconCmp, count }) => {
            const isActive = source === key;
            return (
              <button
                key={key}
                onClick={() => { setSource(key); setFilter("all"); }}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {IconCmp && <IconCmp size={12} className="opacity-60" />}
                {label}
                <span className="opacity-50 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Status filter pills */}
        {activeFilters.length > 2 && (
          <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-4">
          {activeFilters.map((f) => {
            const isActive = filter === f;
            const count = f === "all" ? sourceFiltered.length : counts[f] || 0;
            const config = f !== "all" ? statusConfig[f] : null;

            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {config && <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />}
                {f === "all" ? "All" : config?.label || f}
                <span className="opacity-50 tabular-nums">{count}</span>
              </button>
            );
          })}
          </div>
        )}
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        <span className="w-2 shrink-0" />
        <span className="w-32 shrink-0">Agent</span>
        <span className="flex-1">Prompt</span>
        <span className="w-[200px] shrink-0 text-right">Details</span>
        <span className="w-16 text-right shrink-0">When</span>
        <span className="w-[14px] shrink-0" />
      </div>

      {/* Run rows */}
      <div className="border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
        {filtered.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </div>

      {filtered.length === 0 && (filter !== "all" || source !== "all") && (
        <p className="text-[12px] text-[var(--text-muted)] text-center py-8">
          No {filter !== "all" ? (statusConfig[filter]?.label.toLowerCase() + " ") : ""}{source !== "all" ? source + " " : ""}runs
        </p>
      )}
    </div>
  );
}
