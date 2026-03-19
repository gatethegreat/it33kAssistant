import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const agentSlug = searchParams.get("agent_slug");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  let query = supabase
    .from("agent_runs")
    .select("*, run_events(count)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (agentSlug) {
    query = query.eq("agent_slug", agentSlug);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the nested run_events count into a top-level event_count field
  const normalized = (data || []).map((run: Record<string, unknown>) => {
    const events = run.run_events as { count: number }[] | undefined;
    const { run_events: _, ...rest } = run;
    return { ...rest, event_count: events?.[0]?.count ?? 0 };
  });

  return NextResponse.json(normalized);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("agent_runs")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "operator"], "create_run", "agent_runs");
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const { agent_slug, agent_name, prompt, session_id } = body;

  if (!agent_slug || !agent_name || !prompt) {
    return NextResponse.json(
      { error: "agent_slug, agent_name, and prompt are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      agent_slug,
      agent_name,
      prompt,
      status: "queued",
      ...(session_id ? { session_id } : {}),
      metadata: {
        created_by: auth.user!.email,
        created_by_role: auth.user!.role,
      },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
