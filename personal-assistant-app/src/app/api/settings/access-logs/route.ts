import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { requireRole } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "view_access_logs", "settings/access-logs");
  if (!auth.authorized) return auth.response;

  const { searchParams } = req.nextUrl;
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const filter = searchParams.get("filter"); // "blocked" | "allowed" | null

  const supabase = await createClient();
  let query = supabase
    .from("access_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter === "blocked") {
    query = query.eq("allowed", false);
  } else if (filter === "allowed") {
    query = query.eq("allowed", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
