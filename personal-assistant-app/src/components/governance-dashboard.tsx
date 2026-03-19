"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDownIcon, ChevronRightIcon, DollarIcon } from "@/components/icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RiskLevel = "critical" | "warning" | "info";

interface ToolCall {
  toolName: string;
  inputSummary: string;
  risk: { level: RiskLevel; label: string };
  timestamp: string;
}

interface SessionSummary {
  sessionId: string;
  project: string;
  startedAt: string;
  lastActivity: string;
  version: string;
  gitBranch: string;
  messageCount: number;
  toolCalls: ToolCall[];
  riskCounts: { critical: number; warning: number; info: number };
  highestRisk: RiskLevel;
}

interface GovernanceData {
  sessions: SessionSummary[];
  projects: string[];
  stats: {
    totalSessions: number;
    totalToolCalls: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
}

interface CostPeriod {
  total: number;
  count: number;
}

interface AgentCost {
  slug: string;
  name: string;
  total: number;
  count: number;
  avgPerRun: number;
}

interface TopRun {
  agent_name: string;
  cost_usd: number;
  prompt: string;
  created_at: string;
}

interface CostData {
  periods: {
    today: CostPeriod;
    week: CostPeriod;
    month: CostPeriod;
  };
  agentBreakdown: AgentCost[];
  topRuns: TopRun[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_STYLES: Record<RiskLevel, { dot: string; text: string; rowBg: string }> = {
  critical: { dot: "bg-red-400", text: "text-red-400", rowBg: "bg-red-500/5" },
  warning: { dot: "bg-amber-400", text: "text-amber-400", rowBg: "bg-transparent" },
  info: { dot: "bg-[var(--text-muted)]", text: "text-[var(--text-tertiary)]", rowBg: "bg-transparent" },
};

function timeAgo(ts: string): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortProject(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

function toolIcon(toolName: string): string {
  if (toolName === "Bash") return "$";
  if (toolName === "Read") return "R";
  if (toolName === "Write") return "W";
  if (toolName === "Edit") return "E";
  if (toolName === "Glob") return "G";
  if (toolName === "Grep") return "?";
  if (toolName === "Agent") return "A";
  if (toolName.startsWith("mcp__")) return "M";
  if (toolName === "WebFetch" || toolName === "WebSearch") return "N";
  return "T";
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatItem({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div>
      <div className={`text-[18px] font-semibold tabular-nums ${color || "text-[var(--text-primary)]"}`}>{value}</div>
      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{label}</div>
    </div>
  );
}

function CostPeriodDisplay({ label, period }: { label: string; period: CostPeriod }) {
  return (
    <div>
      <div className="text-[18px] font-semibold tabular-nums text-[var(--text-primary)]">
        {formatCost(period.total)}
      </div>
      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
        {label} <span className="text-[var(--text-muted)]">· {period.count} run{period.count !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

function RiskDot({ level }: { level: RiskLevel }) {
  return <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${RISK_STYLES[level].dot}`} />;
}

function ToolCallRow({ tc }: { tc: ToolCall }) {
  const s = RISK_STYLES[tc.risk.level];
  return (
    <div className={`flex items-center gap-3 px-3 py-1.5 text-[12px] ${s.rowBg}`}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--bg-elevated)] text-[10px] font-mono text-[var(--text-muted)]">
        {toolIcon(tc.toolName)}
      </span>
      <span className="font-medium text-[var(--text-secondary)] w-24 shrink-0 truncate">{tc.toolName}</span>
      {tc.risk.level !== "info" && (
        <span className={`flex items-center gap-1 text-[11px] ${s.text} shrink-0`}>
          <RiskDot level={tc.risk.level} />
          {tc.risk.label}
        </span>
      )}
      <span className="text-[var(--text-muted)] truncate flex-1 font-mono">{tc.inputSummary || "—"}</span>
      <span className="text-[var(--text-muted)] shrink-0 tabular-nums">{timeAgo(tc.timestamp)}</span>
    </div>
  );
}

function SessionRow({
  session,
  expanded,
  onToggle,
}: {
  session: SessionSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const riskyTools = session.toolCalls.filter((t) => t.risk.level !== "info");
  const displayTools = expanded ? session.toolCalls : riskyTools.slice(0, 5);

  return (
    <div>
      <button onClick={onToggle} className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors">
        {expanded ? <ChevronDownIcon size={12} className="text-[var(--text-muted)] shrink-0" /> : <ChevronRightIcon size={12} className="text-[var(--text-muted)] shrink-0" />}
        <RiskDot level={session.highestRisk} />
        <span className="text-[13px] font-medium text-[var(--text-primary)] w-40 shrink-0 truncate">{shortProject(session.project)}</span>
        {session.gitBranch && (
          <code className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] shrink-0">{session.gitBranch}</code>
        )}
        <span className="flex-1" />
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0 flex items-center gap-3">
          {session.riskCounts.critical > 0 && <span className="text-red-400">{session.riskCounts.critical} critical</span>}
          {session.riskCounts.warning > 0 && <span className="text-amber-400">{session.riskCounts.warning} warn</span>}
          <span>{session.toolCalls.length} tools</span>
          <span>{timeAgo(session.lastActivity)}</span>
        </span>
      </button>

      {(expanded || riskyTools.length > 0) && displayTools.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] ml-7 divide-y divide-[var(--border-subtle)]">
          {displayTools.map((tc, i) => (
            <ToolCallRow key={`${tc.toolName}-${i}`} tc={tc} />
          ))}
          {!expanded && session.toolCalls.length > riskyTools.slice(0, 5).length && (
            <button onClick={onToggle} className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)]">
              Show all {session.toolCalls.length} tool calls
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function GovernanceDashboard() {
  const [data, setData] = useState<GovernanceData | null>(null);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (riskFilter !== "all") params.set("risk", riskFilter);
    if (projectFilter !== "all") params.set("project", projectFilter);
    params.set("limit", "50");

    Promise.all([
      fetch(`/api/governance/sessions?${params}`)
        .then((r) => { if (!r.ok) throw new Error(`Sessions: HTTP ${r.status}`); return r.json(); }),
      fetch("/api/governance/costs")
        .then((r) => { if (!r.ok) throw new Error(`Costs: HTTP ${r.status}`); return r.json(); })
        .catch(() => null), // costs are optional — don't block if it fails
    ])
      .then(([govData, costs]: [GovernanceData, CostData | null]) => {
        setData(govData);
        setCostData(costs);
        setError(null);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [riskFilter, projectFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Governance</h1>
        <div className="space-y-1 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-[var(--bg-raised)]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Governance</h1>
        <div className="rounded-md border border-red-500/15 bg-red-500/5 p-3 text-red-400 text-[13px]">
          Failed to load governance data: {error}
        </div>
      </div>
    );
  }

  const stats = data!.stats;
  const sessions = data!.sessions;
  const projects = data!.projects;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Governance</h1>
        <button onClick={fetchData} disabled={loading}
          className="rounded-md px-2.5 py-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Cost overview */}
      {costData && (
        <div className="space-y-4">
          {/* Period totals */}
          <div className="flex items-end gap-8 pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 mr-2">
              <DollarIcon size={14} className="text-[var(--text-muted)]" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Spend</span>
            </div>
            <CostPeriodDisplay label="Today" period={costData.periods.today} />
            <CostPeriodDisplay label="This week" period={costData.periods.week} />
            <CostPeriodDisplay label="This month" period={costData.periods.month} />
          </div>

          {/* Per-agent breakdown — only if there's data */}
          {costData.agentBreakdown.length > 0 && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">Cost by agent (this month)</div>
              <div className="border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
                {costData.agentBreakdown.map((agent) => (
                  <div key={agent.slug} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-[13px] font-medium text-[var(--text-primary)] w-40 shrink-0 truncate">{agent.name}</span>
                    <span className="flex-1" />
                    <span className="text-[12px] text-[var(--text-muted)] tabular-nums">{agent.count} runs</span>
                    <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums w-16 text-right">~{formatCost(agent.avgPerRun)}/run</span>
                    <span className="text-[13px] font-medium text-[var(--text-primary)] tabular-nums w-20 text-right">{formatCost(agent.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top runs — compact */}
          {costData.topRuns.length > 0 && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">Most expensive runs (this month)</div>
              <div className="border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
                {costData.topRuns.map((run, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 text-[12px]">
                    <span className="text-[var(--text-secondary)] w-28 shrink-0 truncate">{run.agent_name}</span>
                    <span className="text-[var(--text-muted)] truncate flex-1">{run.prompt}</span>
                    <span className="text-[var(--text-muted)] tabular-nums shrink-0">{timeAgo(run.created_at)}</span>
                    <span className="font-medium text-[var(--text-primary)] tabular-nums w-20 text-right">{formatCost(run.cost_usd)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Risk stats — inline */}
      <div className="flex items-end gap-8 pb-4 border-b border-[var(--border-subtle)]">
        <StatItem label="Sessions" value={stats.totalSessions} />
        <StatItem label="Tool Calls" value={stats.totalToolCalls} />
        <StatItem label="Critical" value={stats.criticalCount} color={stats.criticalCount > 0 ? "text-red-400" : "text-[var(--text-muted)]"} />
        <StatItem label="Warnings" value={stats.warningCount} color={stats.warningCount > 0 ? "text-amber-400" : "text-[var(--text-muted)]"} />
        <StatItem label="Info" value={stats.infoCount} color="text-[var(--text-tertiary)]" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[var(--text-muted)] mr-1">Risk:</span>
          {(["all", "critical", "warning", "info"] as const).map((level) => (
            <button key={level} onClick={() => setRiskFilter(level)}
              className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                riskFilter === level
                  ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
              }`}>
              {level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[var(--text-muted)]">Project:</span>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-md bg-[var(--bg-raised)] border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-focus)]">
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p} value={p}>{shortProject(p)}</option>)}
          </select>
        </div>
      </div>

      {/* Session list */}
      <div className="border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
        {sessions.length === 0 ? (
          <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">No sessions found matching filters.</p>
        ) : (
          sessions.map((session) => (
            <SessionRow
              key={session.sessionId}
              session={session}
              expanded={expandedSession === session.sessionId}
              onToggle={() => setExpandedSession(expandedSession === session.sessionId ? null : session.sessionId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
