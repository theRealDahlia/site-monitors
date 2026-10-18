import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookie-names";
import { isPrimaryHost } from "@/lib/hosts";
import { LANDING_PARAM, LANDING_VALUE } from "@/lib/landing";

/**
 * Runs before every page and API request, and does two jobs.
 *
 * 1. Customer domains. A Pro customer can show their status page on their own domain (status.theircompany.com).
 *    Those requests arrive here with the customer's host name instead of ours. They get the status page at "/" and
 *    only the few things that page needs. Everything else is a plain 404, so none of the rest of the site is
 *    reachable on someone else's domain.
 *
 * 2. Keeping logged-in people on the app: the landing, login and sign-up pages and the free checkers send them to the
 *    dashboard, the public pricing page to the in-app Plans page, and the public guides to the same guides inside
 *    the app. It happens before the page loads, so there's no flash of the wrong page.
 *    This only checks that a login cookie is present. It can't tell whether the session is still valid, because a
 *    proxy should stay light and doesn't look anything up. That's fine here: if the cookie is stale the dashboard
 *    sends them to log in, and /api/auth/me clears the stale cookie. The cookie is never trusted to grant access to
 *    anything, only to choose where to send a visitor.
 */

/** What a status page on a customer's domain may load: the page's data and the owner's logo. */
const CUSTOMER_DOMAIN_ALLOWED = [/^\/api\/status\/[a-z2-7]{12}$/, /^\/api\/logo\/[A-Za-z0-9_-]{22}$/, /^\/_next\//];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const host = request.headers.get("host");

  if (host && !isPrimaryHost(host)) {
    if (path === "/") return NextResponse.rewrite(new URL("/custom-status", request.url));
    if (CUSTOMER_DOMAIN_ALLOWED.some((allowed) => allowed.test(path))) return NextResponse.next();
    return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }

  if (request.cookies.has(SESSION_COOKIE)) {
    // The credit link in the app opens the landing page on purpose (see src/lib/landing.ts).
    if (path === "/" && request.nextUrl.searchParams.get(LANDING_PARAM) === LANDING_VALUE) return NextResponse.next();
    let to: string | null = null;
    if (path === "/pricing") to = "/dashboard/plans";
    else if (path === "/guides" || path.startsWith("/guides/")) to = `/dashboard${path}`;
    else if (["/", "/login", "/signup", "/ssl-checker", "/domain-checker"].includes(path)) to = "/dashboard";
    if (to) return NextResponse.redirect(new URL(to, request.url)); // 307: temporary, never cached as permanent
  }
  return NextResponse.next();
}

// Everything except Next's own static files, which never need this.
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
