import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do NOT remove this
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth");
  const isApi = request.nextUrl.pathname.startsWith("/api");
  const isNotAuthorized = request.nextUrl.pathname === "/not-authorized";

  // Redirect unauthenticated users to login (except login page and auth callback)
  if (!user && !isLoginPage && !isAuthCallback && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check if authenticated user is in the allowed user_roles table
  if (user && !isLoginPage && !isAuthCallback && !isNotAuthorized) {
    const { data: role } = await supabase.rpc("check_user_role", {
      user_email: user.email,
    });

    if (!role) {
      // User is authenticated but not authorized — sign them out and show error
      if (isApi) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/not-authorized";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
