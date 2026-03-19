import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ role: null });
  }

  const { data: role } = await supabase.rpc("check_user_role", {
    user_email: user.email,
  });

  return NextResponse.json({ role: role || null, email: user.email });
}
