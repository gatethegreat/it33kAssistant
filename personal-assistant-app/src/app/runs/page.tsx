"use client";

import { useEffect, useState } from "react";
import { RunHistoryTable } from "@/components/run-history-table";
import type { AgentRun } from "@/lib/types";

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs?limit=100")
      .then((r) => r.json())
      .then((data) => {
        setRuns(data);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Run History</h1>
        <button
          onClick={() => {
            setLoading(true);
            fetch("/api/runs?limit=100")
              .then((r) => r.json())
              .then((data) => {
                setRuns(data);
                setLoading(false);
              });
          }}
          className="rounded-md px-2.5 py-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="space-y-1 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-md">
              <div className="h-2 w-2 rounded-full bg-[var(--bg-elevated)]" />
              <div className="h-3.5 w-28 rounded bg-[var(--bg-elevated)]" />
              <div className="h-3 flex-1 rounded bg-[var(--bg-raised)]" />
              <div className="h-3 w-16 rounded bg-[var(--bg-raised)]" />
            </div>
          ))}
        </div>
      ) : (
        <RunHistoryTable runs={runs} />
      )}
    </div>
  );
}
