// Agent Runner — manages agent execution independently of HTTP connections.
// Agents run in-memory; SSE streams are read-only observers.

import { EventEmitter } from "events";
import { supabase } from "@/lib/supabase";
import { executeAgent } from "@/lib/run-agent";
import type { Role } from "@/lib/auth-guard";
import type { AgentMeta } from "@/lib/types";

// ---------------------------------------------------------------------------
// RunContext — one per active agent run
// ---------------------------------------------------------------------------

export interface RunContext {
  emitter: EventEmitter;
  status: "running" | "done";
  pendingApprovals: Map<string, { resolve: (approved: boolean) => void; toolName: string; toolInput: Record<string, unknown> }>;
  abortController: AbortController;
  bufferedText: string;
  flushTimer: ReturnType<typeof setInterval> | null;
  seq: number;
  subscriberCount: number; // how many SSE clients are watching
}

// ---------------------------------------------------------------------------
// Global registry (survives Next.js dev-mode module reloads)
// ---------------------------------------------------------------------------

const REGISTRY_KEY = "__agent_runner_registry__" as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (!g[REGISTRY_KEY]) {
  g[REGISTRY_KEY] = new Map<string, RunContext>();
}
export const RunnerRegistry: Map<string, RunContext> = g[REGISTRY_KEY];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeEvent(runId: string, seq: number, eventType: string, payload: Record<string, unknown>) {
  await supabase.from("run_events").insert({ run_id: runId, seq, event_type: eventType, payload });
}

function emit(ctx: RunContext, runId: string, eventType: string, payload: Record<string, unknown>) {
  ctx.emitter.emit("event", { type: eventType, seq: ctx.seq, ...payload });
}

function flushText(ctx: RunContext, runId: string): number | null {
  if (!ctx.bufferedText) return null;
  const seq = ++ctx.seq;
  const text = ctx.bufferedText;
  ctx.bufferedText = "";
  // Write batched text to DB (fire-and-forget)
  writeEvent(runId, seq, "text_chunk", { text });
  return seq;
}

function emitAndWrite(ctx: RunContext, runId: string, eventType: string, payload: Record<string, unknown>) {
  // Flush any buffered text first
  flushText(ctx, runId);
  const seq = ++ctx.seq;
  emit(ctx, runId, eventType, { ...payload, seq });
  writeEvent(runId, seq, eventType, payload);
}

// ---------------------------------------------------------------------------
// executeDetached — starts agent, returns immediately
// ---------------------------------------------------------------------------

export function executeDetached(
  runId: string,
  agent: AgentMeta,
  prompt: string,
  sessionId?: string,
  files?: string[],
  userRole?: Role,
  userEmail?: string
): void {
  const ctx: RunContext = {
    emitter: new EventEmitter(),
    status: "running",
    pendingApprovals: new Map(),
    abortController: new AbortController(),
    bufferedText: "",
    flushTimer: null,
    seq: 0,
    subscriberCount: 0,
  };

  // Track whether an error event was already emitted (via onError callback)
  // to prevent the catch block from emitting a duplicate
  let errorAlreadyEmitted = false;

  // Allow many SSE listeners
  ctx.emitter.setMaxListeners(50);

  RunnerRegistry.set(runId, ctx);

  // Start 3-second text flush interval
  ctx.flushTimer = setInterval(() => {
    flushText(ctx, runId);
  }, 3000);

  // Inject file paths into prompt
  let agentPrompt = prompt;
  if (files && files.length > 0) {
    const fileList = files.map((p) => `  - ${p}`).join("\n");
    agentPrompt = `${prompt}\n\n[Attached files — use the Read tool to read these]\n${fileList}`;
  }

  // Mark as running
  supabase
    .from("agent_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId)
    .then(() => {
      emitAndWrite(ctx, runId, "status", { status: "running" });
    });

  // Fire-and-forget execution
  (async () => {
    try {
      const result = await executeAgent(agent, agentPrompt, {
        signal: ctx.abortController.signal,
        onToken: (text) => {
          // Emit to live listeners immediately (every token).
          // No seq — tokens are transient live events, not deduplicated.
          // They get batched into text_chunk DB events (which have seq) by the flush timer.
          ctx.bufferedText += text;
          ctx.emitter.emit("event", { type: "token", text });
        },
        onToolCall: (name, status, detail) => {
          emitAndWrite(ctx, runId, "tool_call", {
            name,
            status,
            ...(detail?.input != null ? { input: detail.input } : {}),
            ...(detail?.result != null ? { result: detail.result } : {}),
          });
        },
        onThinking: (active) => {
          emitAndWrite(ctx, runId, "thinking", { active });
        },
        onProgress: (info) => {
          emitAndWrite(ctx, runId, "progress", { info });
        },
        onError: (err) => {
          errorAlreadyEmitted = true;
          emitAndWrite(ctx, runId, "error", { error: err });
        },
        onDebug: (msg) => {
          // Debug only goes to live listeners, not DB
          ctx.emitter.emit("event", { type: "debug", message: msg });
        },
        onSessionInit: (sid) => {
          emitAndWrite(ctx, runId, "session_init", { session_id: sid });
          // Store SDK session ID in metadata (not session_id column — that's the conversation grouping ID)
          supabase
            .from("agent_runs")
            .select("metadata")
            .eq("id", runId)
            .single()
            .then(({ data }) => {
              const meta = (data?.metadata as Record<string, unknown>) || {};
              supabase
                .from("agent_runs")
                .update({ metadata: { ...meta, sdk_session_id: sid } })
                .eq("id", runId)
                .then(() => {});
            });
        },
        onApprovalRequired: async (toolName, toolInput, toolUseId) => {
          // Flush text, then emit approval event
          flushText(ctx, runId);
          const seq = ++ctx.seq;

          const approvalPayload = {
            tool_name: toolName,
            tool_input: toolInput,
            tool_use_id: toolUseId,
          };

          emit(ctx, runId, "approval_required", { ...approvalPayload, seq });
          writeEvent(runId, seq, "approval_required", approvalPayload);

          // Persist to agent_runs so it survives reconnection
          await supabase
            .from("agent_runs")
            .update({ pending_approval: approvalPayload })
            .eq("id", runId);

          // Create notification if no SSE clients are watching
          if (ctx.subscriberCount === 0) {
            const { data: run } = await supabase
              .from("agent_runs")
              .select("agent_slug, agent_name, session_id")
              .eq("id", runId)
              .single();

            if (run) {
              await supabase.from("notifications").insert({
                run_id: runId,
                agent_slug: run.agent_slug,
                session_id: run.session_id,
                type: "approval_needed",
                title: `Approval needed: ${toolName}`,
                summary: `${run.agent_name} needs permission to use ${toolName}`,
              });
            }
          }

          // Wait for approval (Promise blocks agent execution)
          return new Promise<boolean>((resolve) => {
            ctx.pendingApprovals.set(toolUseId, { resolve, toolName, toolInput });
          });
        },
      }, sessionId, userRole, userEmail);

      // --- Completion ---
      flushText(ctx, runId);
      if (ctx.flushTimer) clearInterval(ctx.flushTimer);

      const finalStatus = result.aborted ? "stopped" : "completed";
      const finalPayload = {
        output: result.output,
        cost_usd: result.costUsd,
        duration_ms: result.durationMs,
        session_id: result.sessionId,
      };

      await supabase
        .from("agent_runs")
        .update({
          status: finalStatus,
          output: result.output || null,
          cost_usd: result.costUsd,
          duration_ms: result.durationMs,
          pending_approval: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);

      const doneType = result.aborted ? "stopped" : "done";
      emitAndWrite(ctx, runId, doneType, finalPayload);

      // Create completion notification
      const { data: run } = await supabase
        .from("agent_runs")
        .select("agent_slug, agent_name, session_id")
        .eq("id", runId)
        .single();

      if (run) {
        await supabase.from("notifications").insert({
          run_id: runId,
          agent_slug: run.agent_slug,
          session_id: run.session_id,
          type: "completed",
          title: `${run.agent_name}: Completed`,
          summary: result.output ? result.output.slice(0, 200) : null,
        });
      }

      ctx.status = "done";
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      flushText(ctx, runId);
      if (ctx.flushTimer) clearInterval(ctx.flushTimer);

      await supabase
        .from("agent_runs")
        .update({
          status: "failed",
          error: errorMsg,
          pending_approval: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);

      // Only emit error if onError callback didn't already emit it
      // (prevents duplicate "balance too low" / credit error messages)
      if (!errorAlreadyEmitted) {
        emitAndWrite(ctx, runId, "error", { error: errorMsg });
      }

      // Create failure notification
      const { data: run } = await supabase
        .from("agent_runs")
        .select("agent_slug, agent_name, session_id")
        .eq("id", runId)
        .single();

      if (run) {
        await supabase.from("notifications").insert({
          run_id: runId,
          agent_slug: run.agent_slug,
          session_id: run.session_id,
          type: "failed",
          title: `${run.agent_name}: Failed`,
          summary: errorMsg.slice(0, 200),
        });
      }

      ctx.status = "done";
    } finally {
      // Deny any still-pending approvals
      for (const [, entry] of ctx.pendingApprovals) {
        entry.resolve(false);
      }
      ctx.pendingApprovals.clear();

      // Clean up after a delay to let final SSE events drain
      setTimeout(() => {
        RunnerRegistry.delete(runId);
      }, 30_000);
    }
  })();
}

// ---------------------------------------------------------------------------
// getRunContext — check if agent is running in this process
// ---------------------------------------------------------------------------

export function getRunContext(runId: string): RunContext | undefined {
  return RunnerRegistry.get(runId);
}

// ---------------------------------------------------------------------------
// stopRun — abort a running agent
// ---------------------------------------------------------------------------

export async function stopRun(runId: string): Promise<boolean> {
  const ctx = RunnerRegistry.get(runId);
  if (ctx) {
    ctx.abortController.abort();
    return true;
  }
  // RunContext not found — update DB directly (server may have restarted)
  const { error } = await supabase
    .from("agent_runs")
    .update({ status: "stopped", completed_at: new Date().toISOString(), pending_approval: null })
    .eq("id", runId)
    .eq("status", "running");
  return !error;
}

// ---------------------------------------------------------------------------
// submitApproval — resolve a pending approval in RunContext
// ---------------------------------------------------------------------------

export function submitApproval(runId: string, toolUseId: string, approved: boolean): boolean {
  const ctx = RunnerRegistry.get(runId);
  if (!ctx) return false;
  const entry = ctx.pendingApprovals.get(toolUseId);
  if (!entry) return false;
  entry.resolve(approved);
  ctx.pendingApprovals.delete(toolUseId);

  // Clear pending_approval from DB and write resolution event
  supabase
    .from("agent_runs")
    .update({ pending_approval: null })
    .eq("id", runId)
    .then(() => {});
  emitAndWrite(ctx, runId, "approval_resolved", { tool_use_id: toolUseId, approved });

  return true;
}

// ---------------------------------------------------------------------------
// cleanupStaleRuns — mark old "running" runs as failed on startup
// ---------------------------------------------------------------------------

export async function cleanupStaleRuns(): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: staleRuns } = await supabase
    .from("agent_runs")
    .select("id, agent_slug, agent_name, session_id")
    .eq("status", "running")
    .lt("started_at", tenMinutesAgo);

  if (!staleRuns || staleRuns.length === 0) return;

  for (const run of staleRuns) {
    // Skip runs that are actually running in this process
    if (RunnerRegistry.has(run.id)) continue;

    await supabase
      .from("agent_runs")
      .update({
        status: "failed",
        error: "Server restarted during execution",
        pending_approval: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    await supabase.from("notifications").insert({
      run_id: run.id,
      agent_slug: run.agent_slug,
      session_id: run.session_id,
      type: "failed",
      title: `${run.agent_name}: Failed (server restart)`,
      summary: "Server restarted during execution. Please retry.",
    });
  }

  console.log(`[agent-runner] Cleaned up ${staleRuns.length} stale runs`);
}
