import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAgent } from "@/lib/agents";
import { executeDetached } from "@/lib/agent-runner";
import { requireRole } from "@/lib/auth-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["admin", "operator"], "start_run", "agent_runs");
  if (!auth.authorized) return auth.response!;

  const { id: runId } = await params;

  const { data: run, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (error || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.status !== "queued") {
    return NextResponse.json({ error: `Run is already ${run.status}` }, { status: 409 });
  }

  const agent = getAgent(run.agent_slug);
  if (!agent) {
    return NextResponse.json({ error: `Agent ${run.agent_slug} not found` }, { status: 404 });
  }

  // Parse optional files from request body
  const body = await req.json().catch(() => ({}));
  const files = body.files as string[] | undefined;

  // For follow-up messages in a session, find the SDK session ID from a previous run
  let resumeSessionId: string | undefined;
  if (run.session_id) {
    const { data: prevRuns } = await supabase
      .from("agent_runs")
      .select("metadata")
      .eq("session_id", run.session_id)
      .neq("id", runId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (prevRuns?.[0]) {
      const meta = prevRuns[0].metadata as Record<string, unknown> | null;
      if (meta?.sdk_session_id) {
        resumeSessionId = meta.sdk_session_id as string;
      }
    }
  }

  executeDetached(runId, agent, run.prompt, resumeSessionId, files, auth.user!.role, auth.user!.email);

  return NextResponse.json({ started: true });
}
