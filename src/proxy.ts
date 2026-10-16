import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookie-names";

/**
 * Keeps logged-in people off the landing page and the login and sign-up pages by sending them to the
 * dashboard before the page loads, so there's no flash of the wrong page.
 *
 * This only checks that a login cookie is present. It can't tell whether the session is still valid,
 * because a proxy should stay light and doesn't look anything up. That's fine here: if the cookie is
 * stale the dashboard sends them to log in, and /api/auth/me clears the stale cookie. The cookie is
 * never trusted to grant access to anything, only to choose where to send a visitor.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/dashboard", request.url)); // 307: temporary, never cached as permanent
  }
  return NextResponse.next();
}

// Only these three pages. Everything else (pricing, the free checkers, the dashboard, APIs, files) is untouched.
export const config = {
  matcher: ["/", "/login", "/signup"],
};
