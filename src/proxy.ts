import { NextRequest, NextResponse } from "next/server";
import {
  isPasswordSessionTokenValid,
  PASSWORD_SESSION_COOKIE,
  safeReturnPath,
} from "@/lib/password-auth";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(PASSWORD_SESSION_COOKIE)?.value;
  if (isPasswordSessionTokenValid(token, process.env.SENHA)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", safeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
