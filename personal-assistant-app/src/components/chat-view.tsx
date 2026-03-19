"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SSEMessage } from "@/hooks/use-sse";
import type { AgentRun } from "@/lib/types";
import { Markdown } from "@/components/markdown";
import { ToolBadge } from "@/components/tool-tooltip";
import { XIcon, CheckIcon, ToolIcon, ChevronRightIcon } from "@/components/icons";

// --- Types ---

interface ApprovalData {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
}

interface ChatViewProps {
  conversationRuns: AgentRun[];
  completedRunEvents?: Record<string, SSEMessage[]>;
  messages: SSEMessage[];
  isConnected: boolean;
  isRunning: boolean;
  currentPrompt: string | null;
  onApprove?: (toolUseId: string, approved: boolean) => void;
  loading?: boolean;
  suggestions?: string[];
  onSuggestionClick?: (text: string) => void;
  agentName?: string;
  agentEmoji?: string;
}

interface ToolEntry {
  name: string;
  done: boolean;
  input?: unknown;
  result?: string;
}

type Segment =
  | { kind: "thinking" }
  | { kind: "tools"; tools: ToolEntry[]; startIndex: number }
  | { kind: "text"; text: string }
  | { kind: "approval"; data: ApprovalData }
  | { kind: "error"; message: string };

// --- Helpers ---

function formatToolName(name: string): string {
  if (!name || name === "unknown") return name;
  if (!name.startsWith("mcp__")) return name;
  const parts = name.replace(/^mcp__/, "").split("__");
  const service = (parts[0] || "").replace(/^claude_ai_/, "");
  const action = (parts[1] || "").replace(/^[^_]+_/, "").replace(/_/g, " ");
  return `${service} / ${action}`;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function isCreditError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes("credit balance") || lower.includes("insufficient") || lower.includes("billing");
}

function buildSegments(messages: SSEMessage[], handledApprovals: Set<string>): Segment[] {
  const segments: Segment[] = [];
  let currentText = "";
  let currentToolSegment: { kind: "tools"; tools: ToolEntry[]; startIndex: number } | null = null;
  let isThinking = false;
  let creditErrorEmitted = false;

  const flushText = () => {
    if (currentText) {
      segments.push({ kind: "text", text: currentText });
      currentText = "";
    }
  };

  const flushTools = () => {
    if (currentToolSegment) {
      segments.push(currentToolSegment);
      currentToolSegment = null;
    }
  };

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];

    if (m.type === "thinking") {
      if (m.active) {
        flushText();
        flushTools();
        if (!isThinking) {
          segments.push({ kind: "thinking" });
          isThinking = true;
        }
      } else {
        isThinking = false;
      }
      continue;
    }

    if (m.type === "tool_call" && m.status === "start") {
      isThinking = false;
      flushText();
      if (!currentToolSegment) {
        currentToolSegment = { kind: "tools", tools: [], startIndex: segments.length };
      }
      const toolName = (m.name as string) || "unknown";
      currentToolSegment.tools.push({ name: toolName, done: false, input: m.input as unknown });
      continue;
    }

    if (m.type === "tool_call" && m.status === "end") {
      if (currentToolSegment && currentToolSegment.tools.length > 0) {
        const undone = currentToolSegment.tools.find((t) => !t.done);
        if (undone) {
          undone.done = true;
          if (m.result) undone.result = m.result as string;
          if (!undone.input && m.input) undone.input = m.input as unknown;
        }
      }
      continue;
    }

    if (m.type === "token" || m.type === "text_chunk") {
      isThinking = false;
      flushTools();
      currentText += m.text as string;
      continue;
    }

    if (m.type === "approval_required" && !handledApprovals.has(m.tool_use_id as string)) {
      flushText();
      flushTools();
      segments.push({
        kind: "approval",
        data: {
          tool_name: m.tool_name as string,
          tool_input: m.tool_input as Record<string, unknown>,
          tool_use_id: m.tool_use_id as string,
        },
      });
      continue;
    }

    if (m.type === "error" && !messages.some((d) => d.type === "done" || d.type === "stopped")) {
      const errMsg = m.error as string;
      // Deduplicate credit errors — only show one CreditErrorCard per run
      if (isCreditError(errMsg)) {
        if (creditErrorEmitted) continue;
        creditErrorEmitted = true;
      }
      flushText();
      flushTools();
      segments.push({ kind: "error", message: errMsg });
      continue;
    }
  }

  flushTools();
  flushText();
  return segments;
}

function countTools(messages: SSEMessage[]): number {
  return messages.filter((m) => m.type === "tool_call" && m.status === "start").length;
}

function getLiveState(messages: SSEMessage[]): "thinking" | "tool" | "streaming" | "idle" {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.type === "done" || m.type === "stopped" || m.type === "error") return "idle";
    if (m.type === "thinking" && m.active) return "thinking";
    if (m.type === "tool_call" && m.status === "start") return "tool";
    if (m.type === "token" || m.type === "text_chunk") return "streaming";
    if (m.type === "tool_call" && m.status === "end") return "idle";
    if (m.type === "thinking" && !m.active) return "idle";
  }
  return "idle";
}

// --- Sub-components ---

/** User message — right-aligned, subtle background, no heavy bubble */
function UserMessage({ children, meta }: { children: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex justify-end mb-5">
      <div className="max-w-[75%] min-w-[60px]">
        <div className="rounded-lg bg-[var(--bg-elevated)] px-4 py-2.5">
          <div className="text-[13px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">{children}</div>
        </div>
        {meta && <div className="mt-1 text-right">{meta}</div>}
      </div>
    </div>
  );
}

/** Agent response — left-aligned, no container/bubble, just content */
function AgentResponse({
  children,
  meta,
}: {
  children: React.ReactNode;
  live?: boolean;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="max-w-[90%]">
        {children}
      </div>
      {meta && <div className="mt-1">{meta}</div>}
    </div>
  );
}

/** Tool result detail panel */
function ToolResultPopup({ tool, onClose }: { tool: ToolEntry; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const hasInput = tool.input != null && Object.keys(tool.input as Record<string, unknown>).length > 0;
  const hasResult = !!tool.result;

  const formatInput = (input: unknown): string => {
    if (!input) return "";
    if (typeof input === "string") return input;
    try { return JSON.stringify(input, null, 2); } catch { return String(input); }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl max-h-[80vh] mx-4 rounded-lg bg-[#111113] border border-[var(--border-default)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 min-w-0">
            <ToolIcon size={14} className="text-[var(--text-muted)] shrink-0" />
            <span className="text-[13px] font-mono text-[var(--text-primary)] truncate">{formatToolName(tool.name)}</span>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors p-1 -mr-1">
            <XIcon size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {hasInput && (
            <div>
              <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Input</div>
              <pre className="rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] p-3 text-[12px] text-[var(--text-tertiary)] font-mono whitespace-pre-wrap break-words overflow-x-auto max-h-48 overflow-y-auto">
                {formatInput(tool.input)}
              </pre>
            </div>
          )}
          {hasResult ? (
            <div>
              <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Result</div>
              <pre className="rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] p-3 text-[12px] text-[var(--text-tertiary)] font-mono whitespace-pre-wrap break-words overflow-x-auto max-h-96 overflow-y-auto">
                {tool.result}
              </pre>
            </div>
          ) : !hasInput ? (
            <p className="text-[12px] text-[var(--text-muted)] italic">No data available for this tool call.</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Tool call list — compact, inline */
function ToolSegmentBlock({ tools, isLive }: { tools: ToolEntry[]; isLive: boolean }) {
  const activeTool = tools.find((t) => !t.done);
  const [selectedTool, setSelectedTool] = useState<ToolEntry | null>(null);

  return (
    <>
      <div className="mb-3 pl-3 border-l-2 border-[var(--border-subtle)] space-y-0.5">
        {tools.map((tool, i) => {
          const hasDetail = !!(tool.done && (tool.result || tool.input));
          return (
            <div
              key={i}
              className={`flex items-center gap-2 py-0.5 ${hasDetail ? "cursor-pointer group/tool" : ""}`}
              onClick={hasDetail ? () => setSelectedTool(tool) : undefined}
            >
              {tool.done ? (
                <CheckIcon size={12} className="text-green-400/60 shrink-0" />
              ) : (
                <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                  <span className="absolute h-2 w-2 animate-ping rounded-full bg-[var(--accent)] opacity-30" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                </span>
              )}
              <ToolBadge
                name={tool.name}
                className={`text-[12px] font-mono ${hasDetail ? "cursor-pointer" : "cursor-help"} ${tool.done ? "text-[var(--text-muted)] group-hover/tool:text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"} transition-colors`}
              >
                {formatToolName(tool.name)}
              </ToolBadge>
              {hasDetail && (
                <ChevronRightIcon size={10} className="text-[var(--text-muted)] opacity-0 group-hover/tool:opacity-100 transition-opacity shrink-0" />
              )}
            </div>
          );
        })}
        {isLive && activeTool && (
          <span className="text-[10px] text-[var(--text-muted)] pl-5">Running...</span>
        )}
      </div>
      {selectedTool && <ToolResultPopup tool={selectedTool} onClose={() => setSelectedTool(null)} />}
    </>
  );
}

function ThinkingIndicator() {
  return (
    <div className="mb-3 flex items-center gap-2 pl-3">
      <div className="flex gap-0.5">
        <span className="h-1 w-1 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1 w-1 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="h-1 w-1 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-[11px] text-[var(--text-muted)]">Thinking</span>
    </div>
  );
}

function RunMeta({ toolCount, costUsd, durationMs }: { toolCount: number; costUsd?: number | null; durationMs?: number | null }) {
  if (toolCount === 0 && costUsd == null && durationMs == null) return null;
  return (
    <div className="flex items-center gap-2 mb-5 text-[10px] text-[var(--text-muted)] tabular-nums">
      {toolCount > 0 && (
        <span className="flex items-center gap-1">
          <ToolIcon size={10} className="opacity-50" />
          {toolCount} tool{toolCount !== 1 ? "s" : ""}
        </span>
      )}
      {costUsd != null && <span>${costUsd.toFixed(4)}</span>}
      {durationMs != null && <span>{formatDuration(durationMs)}</span>}
    </div>
  );
}

function ApprovalCard({ data, onApprove }: { data: ApprovalData; onApprove: (toolUseId: string, approved: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4 rounded-md border border-amber-500/15 bg-amber-500/5 px-4 py-3 space-y-2.5 max-w-[90%]">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
        <span className="text-[12px] text-amber-300/90 font-medium">Approval needed</span>
      </div>

      <p className="text-[13px] text-[var(--text-secondary)]">
        Run <ToolBadge name={data.tool_name} className="font-mono text-amber-200/90 text-[12px] cursor-help">{formatToolName(data.tool_name)}</ToolBadge>?
      </p>

      {Object.keys(data.tool_input).length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors"
          >
            {expanded ? "Hide" : "Show"} parameters
          </button>
          {expanded && (
            <pre className="mt-1 max-h-32 overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2 text-[11px] text-[var(--text-muted)] font-mono">
              {JSON.stringify(data.tool_input, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onApprove(data.tool_use_id, true)}
          className="rounded-md bg-green-600/80 px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-green-600"
        >
          Allow
        </button>
        <button
          onClick={() => onApprove(data.tool_use_id, false)}
          className="rounded-md border border-[var(--border-default)] px-3 py-1 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function CreditErrorCard() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="text-[13px] font-medium text-red-400">API key stuck — credit balance not recognized</span>
      </div>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
        Anthropic caches credit balance per API key. Even after credits reload, the old key can stay stuck.
        Generate a new key and paste it in Settings to fix this instantly.
      </p>
      <div className="flex items-center gap-2">
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Generate new key
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-70">
            <path d="M4.5 2.5H9.5V7.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
        <a
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
        >
          Paste in Settings
        </a>
      </div>
    </div>
  );
}

// --- Main Component ---

export function ChatView({
  conversationRuns,
  completedRunEvents,
  messages,
  isConnected,
  isRunning,
  currentPrompt,
  onApprove,
  loading,
  suggestions,
  onSuggestionClick,
  agentName,
  agentEmoji,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [handledApprovals, setHandledApprovals] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, conversationRuns]);

  const segments = useMemo(() => buildSegments(messages, handledApprovals), [messages, handledApprovals]);
  const toolCount = useMemo(() => countTools(messages), [messages]);
  const liveState = useMemo(() => getLiveState(messages), [messages]);
  const doneMsg = messages.find((m) => m.type === "done" || m.type === "stopped");

  const handleApproval = (toolUseId: string, approved: boolean) => {
    setHandledApprovals((prev) => new Set(prev).add(toolUseId));
    onApprove?.(toolUseId, approved);
  };

  const hasContent = conversationRuns.length > 0 || isRunning || messages.length > 0;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Loading skeleton */}
        {loading && !hasContent && (
          <div className="space-y-4 animate-pulse pt-2">
            <div className="flex justify-end"><div className="h-8 w-48 rounded-lg bg-[var(--bg-elevated)]" /></div>
            <div className="h-16 w-72 rounded-lg bg-[var(--bg-raised)]" />
            <div className="flex justify-end"><div className="h-8 w-36 rounded-lg bg-[var(--bg-elevated)]" /></div>
            <div className="h-12 w-64 rounded-lg bg-[var(--bg-raised)]" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasContent && (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
            {agentEmoji && <span className="text-3xl">{agentEmoji}</span>}
            <div className="text-center">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                {agentName ? `What can I help with?` : "Start a conversation"}
              </h2>
              {agentName && (
                <p className="text-[12px] text-[var(--text-muted)] mt-1">
                  Ask {agentName} anything to get started
                </p>
              )}
            </div>
            {suggestions && suggestions.length > 0 && (
              <div className="flex flex-col gap-1.5 w-full max-w-sm mt-2">
                {suggestions.slice(0, 3).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => onSuggestionClick?.(s)}
                    className="text-left px-3 py-2.5 rounded-md border border-[var(--border-subtle)] text-[13px] text-[var(--text-tertiary)] leading-snug transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Completed conversation turns */}
        {conversationRuns.map((run) => {
          const runEvents = completedRunEvents?.[run.id];
          const meta = run.metadata as Record<string, unknown> | undefined;
          const storedToolCount = meta?.tool_count as number | undefined;

          if (runEvents && runEvents.length > 0) {
            const completedSegments = buildSegments(runEvents, handledApprovals);
            const completedToolCount = runEvents.filter((m) => m.type === "tool_call" && m.status === "start").length;

            return (
              <div key={run.id}>
                <UserMessage>{run.prompt}</UserMessage>
                {completedSegments.map((seg, i) => {
                  switch (seg.kind) {
                    case "thinking":
                      return <div key={i} className="mb-2"><span className="text-[11px] text-[var(--text-muted)] italic">Thought about the request</span></div>;
                    case "tools":
                      return <ToolSegmentBlock key={`tools-${i}`} tools={seg.tools} isLive={false} />;
                    case "text":
                      return (
                        <AgentResponse key={`text-${i}`}>
                          <div className="text-[13px] leading-relaxed text-[var(--text-secondary)] break-words">
                            <Markdown>{seg.text}</Markdown>
                          </div>
                        </AgentResponse>
                      );
                    case "error":
                      return (
                        <AgentResponse key={`error-${i}`}>
                          {isCreditError(seg.message) ? <CreditErrorCard /> : <p className="text-[13px] text-red-400">{seg.message}</p>}
                        </AgentResponse>
                      );
                    default:
                      return null;
                  }
                })}
                {run.status === "completed" && (
                  <RunMeta toolCount={completedToolCount} costUsd={run.cost_usd} durationMs={run.duration_ms} />
                )}
              </div>
            );
          }

          // Fallback: no events stored
          const storedTools = meta?.tools_used as string[] | undefined;
          return (
            <div key={run.id}>
              <UserMessage>{run.prompt}</UserMessage>
              {storedTools && storedTools.length > 0 ? (
                <ToolSegmentBlock tools={storedTools.map((t) => ({ name: t, done: true }))} isLive={false} />
              ) : storedToolCount != null && storedToolCount > 0 ? (
                <RunMeta toolCount={storedToolCount} />
              ) : null}
              <AgentResponse>
                {run.status === "completed" && run.output ? (
                  <div className="text-[13px] leading-relaxed text-[var(--text-secondary)] break-words">
                    <Markdown>{run.output}</Markdown>
                  </div>
                ) : run.status === "failed" ? (
                  <p className="text-[13px] text-red-400">Failed{run.error ? `: ${run.error}` : ""}</p>
                ) : run.status === "stopped" ? (
                  <p className="text-[13px] text-amber-400/70 italic">Stopped</p>
                ) : (
                  <p className="text-[13px] text-[var(--text-muted)] italic">{run.status}</p>
                )}
              </AgentResponse>
              {run.status === "completed" && (
                <RunMeta toolCount={storedToolCount || 0} costUsd={run.cost_usd} durationMs={run.duration_ms} />
              )}
            </div>
          );
        })}

        {/* Live: user prompt */}
        {currentPrompt && (isRunning || messages.length > 0) && (
          <UserMessage>{currentPrompt}</UserMessage>
        )}

        {/* Live: starting state */}
        {(isRunning || messages.length > 0) && segments.length === 0 && isRunning && (
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--text-muted)] opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--text-muted)]" />
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">Starting...</span>
          </div>
        )}

        {/* Live: segments */}
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;

          switch (seg.kind) {
            case "thinking":
              return isLast && liveState === "thinking" ? (
                <ThinkingIndicator key={i} />
              ) : (
                <div key={i} className="mb-2"><span className="text-[11px] text-[var(--text-muted)] italic">Thought about the request</span></div>
              );

            case "tools":
              return (
                <ToolSegmentBlock
                  key={`tools-${i}`}
                  tools={seg.tools}
                  isLive={isLast && (liveState === "tool" || liveState === "idle") && isRunning && !doneMsg}
                />
              );

            case "text":
              return (
                <AgentResponse key={`text-${i}`} live={isLast && isRunning && !doneMsg}>
                  <div className="text-[13px] leading-relaxed text-[var(--text-secondary)] break-words">
                    <Markdown>{seg.text}</Markdown>
                    {isLast && isRunning && !doneMsg && liveState === "streaming" && (
                      <span className="inline-block w-[2px] h-[13px] bg-[var(--accent)] ml-0.5 animate-pulse align-text-bottom" />
                    )}
                  </div>
                </AgentResponse>
              );

            case "approval":
              return <ApprovalCard key={`approval-${i}`} data={seg.data} onApprove={handleApproval} />;

            case "error":
              return (
                <AgentResponse key={`error-${i}`}>
                  {isCreditError(seg.message) ? <CreditErrorCard /> : <p className="text-[13px] text-red-400">{seg.message}</p>}
                </AgentResponse>
              );

            default:
              return null;
          }
        })}

        {/* Completion meta */}
        {doneMsg && (
          <RunMeta
            toolCount={toolCount}
            costUsd={doneMsg.cost_usd as number | undefined}
            durationMs={doneMsg.duration_ms as number | undefined}
          />
        )}
      </div>
    </div>
  );
}
