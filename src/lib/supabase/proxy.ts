import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

const protectedRoutePrefixes = ["/home", "/map", "/connect", "/messages", "/notifications", "/profile", "/admin"];
const authRoutePrefixes = ["/login", "/register"];

function matchesRoute(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectWithCookies(request: NextRequest, destination: string, source: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = destination;
  url.search = "";

  const response = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function updateSession(request: NextRequest) {
  const isProtectedRoute = matchesRoute(request.nextUrl.pathname, protectedRoutePrefixes);
  const isAuthRoute = matchesRoute(request.nextUrl.pathname, authRoutePrefixes);

  if (!isSupabaseConfigured()) {
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("notice", "config_required");
      return NextResponse.redirect(url);
    }

    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const { publishableKey, url } = getSupabasePublicConfig();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, options, value }) => supabaseResponse.cookies.set(name, value, options));
        Object.entries(headersToSet).forEach(([name, value]) => supabaseResponse.headers.set(name, value));
      },
    },
  });

  let hasVerifiedClaims = false;

  try {
    const { data } = await supabase.auth.getClaims();
    hasVerifiedClaims = Boolean(data?.claims?.sub);
  } catch {
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("error", "auth_unavailable");
      const response = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      return response;
    }

    return supabaseResponse;
  }

  if (!hasVerifiedClaims && isProtectedRoute) {
    return redirectWithCookies(request, "/login", supabaseResponse);
  }

  if (hasVerifiedClaims && isAuthRoute) {
    return redirectWithCookies(request, "/home", supabaseResponse);
  }

  return supabaseResponse;
}
