import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_email", user.email)
    .single();

  return NextResponse.json({ preferences: data?.preferences || "" });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const preferences = typeof body.preferences === "string" ? body.preferences : "";

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_email: user.email, preferences, updated_at: new Date().toISOString() },
      { onConflict: "user_email" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
