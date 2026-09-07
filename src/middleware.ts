import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Guards the /admin/** pages (not the API — API routes enforce auth themselves
 * via adminRoute()). We only check for a structurally-valid session cookie here;
 * full verification still happens server-side.
 */
const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get("tf_admin")?.value;
  let ok = false;
  if (token) {
    try {
      await jwtVerify(token, secret);
      ok = true;
    } catch {
      ok = false;
    }
  }
  if (ok) return NextResponse.next();

  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
