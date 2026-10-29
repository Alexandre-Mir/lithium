import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/auth-redirect";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

function copyResponseState(source: NextResponse, destination: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) destination.headers.set(header, value);
  }
  return destination;
}

export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headersToSet).forEach(([name, value]) => {
          supabaseResponse.headers.set(name, value);
        });
      },
    },
  });

  const { data } = await client.auth.getClaims();
  const authenticated = typeof data?.claims?.sub === "string";
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!authenticated && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      safeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
    const hasSupabaseSessionCookie = request.cookies.getAll().some(({ name }) =>
      /^sb-.+-auth-token(?:\.\d+)?$/.test(name),
    );
    if (hasSupabaseSessionCookie) {
      loginUrl.searchParams.set("reason", "session-expired");
    }
    return copyResponseState(supabaseResponse, NextResponse.redirect(loginUrl));
  }

  if (authenticated && isLoginPage) {
    const nextPath = safeReturnPath(request.nextUrl.searchParams.get("next"));
    return copyResponseState(
      supabaseResponse,
      NextResponse.redirect(new URL(nextPath, request.url)),
    );
  }

  return supabaseResponse;
}
