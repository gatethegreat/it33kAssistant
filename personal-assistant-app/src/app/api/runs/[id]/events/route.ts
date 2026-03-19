import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;
  const afterSeq = parseInt(req.nextUrl.searchParams.get("after_seq") || "0", 10);

  let query = supabase
    .from("run_events")
    .select("*")
    .eq("run_id", runId)
    .order("seq", { ascending: true });

  if (afterSeq > 0) {
    query = query.gt("seq", afterSeq);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
