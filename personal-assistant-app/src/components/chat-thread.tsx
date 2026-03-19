"use client";

import type { AgentRun } from "@/lib/types";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ChatThread({ runs }: { runs: AgentRun[] }) {
  if (runs.length === 0) return null;

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <div key={run.id} className="space-y-2">
          {/* User prompt */}
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-lg bg-[var(--bg-elevated)] px-4 py-2.5">
              <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap">{run.prompt}</p>
            </div>
          </div>

          {/* Agent response */}
          <div className="max-w-[90%]">
            {run.status === "completed" && run.output ? (
              <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap break-words leading-relaxed">
                {run.output}
              </p>
            ) : run.status === "failed" ? (
              <p className="text-[13px] text-red-400">
                Failed: {run.error || "Unknown error"}
              </p>
            ) : (
              <p className="text-[13px] text-[var(--text-muted)] italic">
                {run.status === "running" ? "Running..." : "Queued"}
              </p>
            )}
            {run.status === "completed" && (
              <div className="mt-1 flex gap-3 text-[10px] text-[var(--text-muted)] tabular-nums">
                {run.cost_usd != null && <span>${run.cost_usd.toFixed(4)}</span>}
                {run.duration_ms != null && <span>{formatDuration(run.duration_ms)}</span>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
