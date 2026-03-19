import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { requireRole } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "view_users", "settings/users");
  if (!auth.authorized) return auth.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "add_user", "settings/users");
  if (!auth.authorized) return auth.response;

  const supabase = await createClient();
  const { email, role } = await req.json();

  if (!email || !role) {
    return NextResponse.json(
      { error: "email and role are required" },
      { status: 400 }
    );
  }

  if (!["admin", "operator", "viewer"].includes(role)) {
    return NextResponse.json(
      { error: "role must be admin, operator, or viewer" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("user_roles")
    .insert({ email: email.toLowerCase().trim(), role, added_by: auth.user!.email })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This email is already added" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "update_user_role", "settings/users");
  if (!auth.authorized) return auth.response;

  const supabase = await createClient();
  const { id, role } = await req.json();

  if (!id || !role || !["admin", "operator", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_roles")
    .update({ role })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "remove_user", "settings/users");
  if (!auth.authorized) return auth.response;

  const supabase = await createClient();
  const { id, email } = await req.json();

  if (email === auth.user!.email) {
    return NextResponse.json(
      { error: "You cannot remove yourself" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("user_roles").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
