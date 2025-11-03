import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if user is accessing admin routes
  if (req.nextUrl.pathname.startsWith("/admin")) {
    // Allow access to login page without authentication
    if (req.nextUrl.pathname === "/admin/login") {
      return res;
    }

    if (!session) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    // Optional: Check if user has admin or user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile && profile.role !== "admin" && profile.role !== "user") {
      // Redirect users without proper role
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
