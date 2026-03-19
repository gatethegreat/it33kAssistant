// Approval store — now delegates to RunnerRegistry for active runs.
// Keeps the old in-memory map as fallback for any edge cases,
// and preserves isReadOnlyMcpTool which is used by run-agent.ts.

import { submitApproval as runnerSubmit, getRunContext } from "@/lib/agent-runner";

// --- Legacy in-memory map (fallback) ---

interface PendingApproval {
  resolve: (approved: boolean) => void;
  toolName: string;
  toolInput: Record<string, unknown>;
}

const globalKey = "__approval_pending_map__" as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (!g[globalKey]) {
  g[globalKey] = new Map<string, PendingApproval>();
}
const pending: Map<string, PendingApproval> = g[globalKey];

export function requestApproval(
  runId: string,
  toolUseId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    pending.set(`${runId}:${toolUseId}`, { resolve, toolName, toolInput });
  });
}

export function submitApproval(
  runId: string,
  toolUseId: string,
  approved: boolean
): boolean {
  // Try RunnerRegistry first (new detached execution path)
  if (getRunContext(runId)) {
    return runnerSubmit(runId, toolUseId, approved);
  }
  // Fallback to legacy map
  const key = `${runId}:${toolUseId}`;
  const entry = pending.get(key);
  if (!entry) return false;
  entry.resolve(approved);
  pending.delete(key);
  return true;
}

export function cancelAllForRun(runId: string): void {
  for (const [key, entry] of pending) {
    if (key.startsWith(`${runId}:`)) {
      entry.resolve(false);
      pending.delete(key);
    }
  }
}

// Check if a tool name looks like a read-only operation
const READ_VERBS = ["get", "list", "search", "read", "find", "view", "check", "fetch", "show", "describe", "take_screenshot", "take_snapshot", "take_memory_snapshot", "lighthouse_audit", "performance_analyze", "list_console", "list_network", "list_pages", "get_console", "get_network"];

export function isReadOnlyMcpTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return READ_VERBS.some((verb) => {
    const pattern = new RegExp(`(?:^|__|_)${verb}(?:_|$)`);
    return pattern.test(lower);
  });
}
