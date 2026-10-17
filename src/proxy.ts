import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookie-names";

/**
 * Keeps logged-in people on the app: the landing, login and sign-up pages and the free checkers send
 * them to the dashboard, the public pricing page to the in-app Plans page, and the public guides to
 * the same guides inside the app. It happens
 * before the page loads, so there's no flash of the wrong page.
 *
 * This only checks that a login cookie is present. It can't tell whether the session is still valid,
 * because a proxy should stay light and doesn't look anything up. That's fine here: if the cookie is
 * stale the dashboard sends them to log in, and /api/auth/me clears the stale cookie. The cookie is
 * never trusted to grant access to anything, only to choose where to send a visitor.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    const path = request.nextUrl.pathname;
    const to = path === "/pricing" ? "/dashboard/plans" : path === "/guides" || path.startsWith("/guides/") ? `/dashboard${path}` : "/dashboard";
    return NextResponse.redirect(new URL(to, request.url)); // 307: temporary, never cached as permanent
  }
  return NextResponse.next();
}

// Only these pages. Everything else (the dashboard, public status pages, APIs, files) is untouched.
export const config = {
  matcher: ["/", "/login", "/signup", "/ssl-checker", "/domain-checker", "/pricing", "/guides", "/guides/:path*"],
};
