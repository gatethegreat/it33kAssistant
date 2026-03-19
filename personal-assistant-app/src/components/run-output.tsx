"use client";

import { useEffect, useRef, useState } from "react";
import type { SSEMessage } from "@/hooks/use-sse";

interface ApprovalRequest {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
}

interface RunOutputProps {
  messages: SSEMessage[];
  isConnected: boolean;
  onStop?: () => void;
  onApprove?: (toolUseId: string, approved: boolean) => void;
}

function formatToolName(name: string): string {
  if (!name.startsWith("mcp__")) return name;
  const parts = name.replace(/^mcp__/, "").split("__");
  const service = parts[0] || "";
  const action = (parts[1] || "").replace(/^[^_]+_/, "").replace(/_/g, " ");
  return `${service}: ${action}`;
}

export function RunOutput({ messages, isConnected, onStop, onApprove }: RunOutputProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const debugRef = useRef<HTMLPreElement>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [handledApprovals, setHandledApprovals] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    if (debugRef.current) debugRef.current.scrollTop = debugRef.current.scrollHeight;
  }, [messages]);

  const tokens = messages.filter((m) => m.type === "token").map((m) => m.text as string).join("");

  const activities: Array<{ type: string; label: string; key: number }> = [];
  let activityKey = 0;
  for (const m of messages) {
    if (m.type === "thinking" && m.active) activities.push({ type: "thinking", label: "Thinking...", key: activityKey++ });
    else if (m.type === "tool_call" && m.status === "start") activities.push({ type: "tool", label: m.name as string, key: activityKey++ });
    else if (m.type === "progress") activities.push({ type: "progress", label: m.info as string, key: activityKey++ });
  }

  const debugMessages = messages.filter((m) => m.type === "debug");
  const doneMsg = messages.find((m) => m.type === "done");
  const stoppedMsg = messages.find((m) => m.type === "stopped");
  const errorMsg = messages.find((m) => m.type === "error" && !doneMsg);
  const statusMsg = messages.findLast((m) => m.type === "status");

  const pendingApprovals = messages
    .filter((m) => m.type === "approval_required" && !handledApprovals.has(m.tool_use_id as string))
    .map((m) => ({ tool_name: m.tool_name as string, tool_input: m.tool_input as Record<string, unknown>, tool_use_id: m.tool_use_id as string })) as ApprovalRequest[];

  const handleApproval = (toolUseId: string, approved: boolean) => {
    setHandledApprovals((prev) => new Set(prev).add(toolUseId));
    onApprove?.(toolUseId, approved);
  };

  const thinkingMsgs = messages.filter((m) => m.type === "thinking");
  const isThinking = thinkingMsgs.length > 0 && (thinkingMsgs[thinkingMsgs.length - 1].active as boolean);
  const toolMsgs = messages.filter((m) => m.type === "tool_call");
  const lastTool = toolMsgs.length > 0 ? toolMsgs[toolMsgs.length - 1] : null;
  const activeTool = lastTool?.status === "start" ? (lastTool.name as string) : null;

  if (messages.length === 0 && !isConnected) return null;
  const finishedMsg = doneMsg || stoppedMsg;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-medium text-[var(--text-secondary)]">Output</h3>
        {isConnected && (
          <span className="flex items-center gap-1 text-[11px] text-green-400/70">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400/70 animate-pulse" />
            Live
          </span>
        )}
        {finishedMsg && (
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            ${(finishedMsg.cost_usd as number)?.toFixed(4) || "?"} · {((finishedMsg.duration_ms as number) / 1000)?.toFixed(1) || "?"}s
          </span>
        )}
        {isConnected && onStop && (
          <button onClick={onStop}
            className="ml-auto rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/15">
            Stop
          </button>
        )}
        {debugMessages.length > 0 && (
          <button onClick={() => setShowDebug(!showDebug)}
            className={`${isConnected && onStop ? "" : "ml-auto "}rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]`}>
            {showDebug ? "Hide" : "Show"} Debug ({debugMessages.length})
          </button>
        )}
      </div>

      {/* Approval prompts */}
      {pendingApprovals.map((req) => (
        <div key={req.tool_use_id} className="rounded-md border border-amber-500/15 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[12px] font-medium text-amber-300">Approval Required</span>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Run: <span className="font-mono text-amber-200">{formatToolName(req.tool_name)}</span>
          </p>
          {Object.keys(req.tool_input).length > 0 && (
            <pre className="max-h-40 overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2 text-[11px] text-[var(--text-muted)] font-mono">
              {JSON.stringify(req.tool_input, null, 2)}
            </pre>
          )}
          <div className="flex gap-2">
            <button onClick={() => handleApproval(req.tool_use_id, true)}
              className="rounded-md bg-green-600/80 px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-green-600">
              Allow
            </button>
            <button onClick={() => handleApproval(req.tool_use_id, false)}
              className="rounded-md border border-[var(--border-default)] px-3 py-1 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)]">
              Deny
            </button>
          </div>
        </div>
      ))}

      {/* Activity bar */}
      {isConnected && (isThinking || activeTool) && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-3 py-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          {isThinking && !activeTool && "Thinking..."}
          {activeTool && <>Using: <span className="font-mono text-amber-300/80">{activeTool}</span></>}
        </div>
      )}

      {/* Activity feed */}
      {activities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activities.map((a) => (
            <span key={a.key}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border ${
                a.type === "thinking" ? "bg-[var(--accent-muted)] text-[var(--accent-text)] border-[var(--accent-muted)]"
                  : a.type === "tool" ? "bg-amber-500/10 text-amber-400/80 border-amber-500/15"
                  : "bg-[var(--bg-elevated)] text-[var(--text-tertiary)] border-[var(--border-subtle)]"
              }`}>
              {a.label}
            </span>
          ))}
        </div>
      )}

      {/* Main output */}
      <div ref={outputRef}
        className="max-h-[500px] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap break-words">
        {tokens || (statusMsg?.status as string) || "Waiting..."}
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-500/15 bg-red-500/5 p-3 text-[13px] text-red-400">
          Error: {errorMsg.error as string}
        </div>
      )}
      {stoppedMsg && (
        <div className="rounded-md border border-amber-500/15 bg-amber-500/5 p-3 text-[13px] text-amber-400/80">
          Stopped by user
        </div>
      )}
      {doneMsg && !errorMsg && (
        <div className="rounded-md border border-green-500/15 bg-green-500/5 p-3 text-[13px] text-green-400/80">
          Completed successfully
        </div>
      )}

      {showDebug && debugMessages.length > 0 && (
        <div>
          <h4 className="text-[11px] font-medium text-[var(--text-muted)] mb-1">Debug Log</h4>
          <pre ref={debugRef}
            className="max-h-[300px] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-3 text-[11px] text-[var(--text-muted)] whitespace-pre-wrap break-words font-mono">
            {debugMessages.map((m) => m.message as string).join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
