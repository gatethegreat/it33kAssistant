import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export type Role = "admin" | "operator" | "viewer";

interface AuthResult {
  authorized: boolean;
  user: { email: string; role: Role } | null;
  response?: NextResponse;
}

/**
 * Check if the current user has one of the required roles.
 * Logs every access attempt (allowed or blocked) with a reason.
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: Role[],
  action: string,
  resource?: string
): Promise<AuthResult> {
  const supabase = await createClient();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    await supabase.rpc("log_access", {
      p_email: null,
      p_role: null,
      p_action: action,
      p_resource: resource || null,
      p_allowed: false,
      p_reason: "Not authenticated — no valid session",
      p_ip_address: ip,
      p_user_agent: ua,
    });

    return {
      authorized: false,
      user: null,
      response: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  // Check role
  const { data: role } = await supabase.rpc("check_user_role", {
    user_email: user.email,
  }) as { data: Role | null };

  if (!role) {
    await supabase.rpc("log_access", {
      p_email: user.email,
      p_role: null,
      p_action: action,
      p_resource: resource || null,
      p_allowed: false,
      p_reason: "User has no role assigned — not in user_roles table",
      p_ip_address: ip,
      p_user_agent: ua,
    });

    return {
      authorized: false,
      user: null,
      response: NextResponse.json(
        { error: "Not authorized — no role assigned" },
        { status: 403 }
      ),
    };
  }

  if (!allowedRoles.includes(role)) {
    await supabase.rpc("log_access", {
      p_email: user.email,
      p_role: role,
      p_action: action,
      p_resource: resource || null,
      p_allowed: false,
      p_reason: `Role "${role}" is not allowed — requires one of: ${allowedRoles.join(", ")}`,
      p_ip_address: ip,
      p_user_agent: ua,
    });

    return {
      authorized: false,
      user: { email: user.email, role },
      response: NextResponse.json(
        { error: `Forbidden — your role "${role}" does not have access to this action` },
        { status: 403 }
      ),
    };
  }

  // Allowed
  await supabase.rpc("log_access", {
    p_email: user.email,
    p_role: role,
    p_action: action,
    p_resource: resource || null,
    p_allowed: true,
    p_reason: `Allowed — role "${role}" permitted for this action`,
    p_ip_address: ip,
    p_user_agent: ua,
  });

  return {
    authorized: true,
    user: { email: user.email, role },
  };
}
