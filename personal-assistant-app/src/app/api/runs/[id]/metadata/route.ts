import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Merge new metadata with existing
  const { data: existing } = await supabase
    .from("agent_runs")
    .select("metadata")
    .eq("id", id)
    .single();

  const merged = { ...(existing?.metadata || {}), ...body };

  const { error } = await supabase
    .from("agent_runs")
    .update({ metadata: merged })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
