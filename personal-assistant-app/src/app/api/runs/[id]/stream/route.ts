import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getRunContext } from "@/lib/agent-runner";

export const maxDuration = 300; // 5 min max for long-running SSE observation

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  // Fetch the run record
  const { data: run, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (error || !run) {
    return new Response(`data: ${JSON.stringify({ type: "error", error: "Run not found" })}\n\n`, {
      status: 404,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // If already completed/failed/stopped and no RunContext, return final state
  const ctx = getRunContext(runId);
  if (!ctx && (run.status === "completed" || run.status === "failed" || run.status === "stopped")) {
    // Map DB status to the SSE event types the client expects
    const eventType = run.status === "completed" ? "done"
      : run.status === "stopped" ? "stopped"
      : "error";
    const payload = eventType === "error"
      ? { type: "error", error: run.error || "Run failed" }
      : { type: eventType, output: run.output, cost_usd: run.cost_usd, duration_ms: run.duration_ms };
    const encoder = new TextEncoder();
    const body = encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
          closed = true;
        }
      };

      // --- Mode 1: Live attach (RunContext exists) ---
      if (ctx) {
        ctx.subscriberCount++;

        // Load historical events written before this connection (for mid-run reconnection)
        const afterSeq = parseInt(req.nextUrl.searchParams.get("after_seq") || "0", 10);
        if (afterSeq > 0) {
          const { data: events } = await supabase
            .from("run_events")
            .select("*")
            .eq("run_id", runId)
            .gt("seq", afterSeq)
            .order("seq", { ascending: true });

          if (events) {
            for (const evt of events) {
              send({ type: evt.event_type, seq: evt.seq, ...evt.payload });
            }
          }
        }

        // Subscribe to live emitter
        const onEvent = (data: Record<string, unknown>) => {
          send(data);
        };

        ctx.emitter.on("event", onEvent);

        // Wait for client disconnect or run completion
        const cleanup = () => {
          ctx.emitter.off("event", onEvent);
          ctx.subscriberCount = Math.max(0, ctx.subscriberCount - 1);
          if (!closed) {
            closed = true;
            try { controller.close(); } catch { /* already closed */ }
          }
        };

        // Watch for client disconnect
        req.signal.addEventListener("abort", cleanup);

        // Also close when run finishes (after a small delay to flush final events)
        const checkDone = () => {
          if (ctx.status === "done") {
            setTimeout(() => cleanup(), 500);
          } else {
            setTimeout(checkDone, 1000);
          }
        };
        checkDone();

        return; // keep stream open
      }

      // --- Mode 2: Historical replay (RunContext not found) ---
      // Load all events from DB
      const { data: events } = await supabase
        .from("run_events")
        .select("*")
        .eq("run_id", runId)
        .order("seq", { ascending: true });

      if (events && events.length > 0) {
        for (const evt of events) {
          send({ type: evt.event_type, seq: evt.seq, ...evt.payload });
        }
      }

      // If run is still "running" but no RunContext (server restarted), poll for new events
      if (run.status === "running" || run.status === "queued") {
        let lastSeq = events?.length ? events[events.length - 1].seq : 0;
        const pollInterval = setInterval(async () => {
          if (closed || req.signal.aborted) {
            clearInterval(pollInterval);
            if (!closed) {
              closed = true;
              try { controller.close(); } catch { /* ok */ }
            }
            return;
          }

          // Check for new events
          const { data: newEvents } = await supabase
            .from("run_events")
            .select("*")
            .eq("run_id", runId)
            .gt("seq", lastSeq)
            .order("seq", { ascending: true });

          if (newEvents && newEvents.length > 0) {
            for (const evt of newEvents) {
              send({ type: evt.event_type, seq: evt.seq, ...evt.payload });
            }
            lastSeq = newEvents[newEvents.length - 1].seq;

            // Check if run is done
            const doneEvt = newEvents.find((e) => e.event_type === "done" || e.event_type === "stopped" || e.event_type === "error");
            if (doneEvt) {
              clearInterval(pollInterval);
              closed = true;
              try { controller.close(); } catch { /* ok */ }
            }
          }

          // Also check if the run status changed (stale cleanup may have updated it)
          const { data: freshRun } = await supabase
            .from("agent_runs")
            .select("status")
            .eq("id", runId)
            .single();

          if (freshRun && (freshRun.status === "completed" || freshRun.status === "failed" || freshRun.status === "stopped")) {
            clearInterval(pollInterval);
            // Send final event if no done event was sent
            if (!newEvents?.some((e) => e.event_type === "done" || e.event_type === "stopped")) {
              const eventType = freshRun.status === "completed" ? "done" : freshRun.status === "stopped" ? "stopped" : "error";
              send({ type: eventType });
            }
            closed = true;
            try { controller.close(); } catch { /* ok */ }
          }
        }, 2000);

        return; // keep stream open for polling
      }

      // Run is terminal and no events — just close
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
