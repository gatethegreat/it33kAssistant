import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

  let query = supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  if (body.all) {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("read", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (body.ids && Array.isArray(body.ids)) {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", body.ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (body.session_id) {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("session_id", body.session_id)
      .eq("read", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Provide { ids: [...] }, { session_id: '...' }, or { all: true }" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
