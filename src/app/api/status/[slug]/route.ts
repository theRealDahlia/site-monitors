import { getBranding } from "@/lib/branding";
import { entitlementsFor } from "@/lib/entitlements";
import { getPublicMonitor } from "@/lib/monitors-db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { SLUG_PATTERN, publicStatus } from "@/lib/status-page";

// Public: no login. Anyone with the address can read it, so what it returns is decided in publicStatus().
export async function GET(request: Request, ctx: RouteContext<"/api/status/[slug]">) {
  if (!rateLimit(`status-view:${clientIp(request)}`, 120, 60_000)) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const { slug } = await ctx.params;
  const monitor = SLUG_PATTERN.test(slug) ? getPublicMonitor(slug) : undefined;
  // One answer for "no such page", "switched off" and "owner's plan doesn't include it", so none can be told apart.
  if (!monitor || !entitlementsFor(monitor.owner_plan).statusPages) {
    return Response.json({ error: "Status page not found." }, { status: 404 });
  }
  // The owner's own logo and colours, so the page their clients see looks like theirs.
  return Response.json({ ...publicStatus(monitor), branding: getBranding(monitor.user_id) }, { headers: { "Cache-Control": "public, max-age=15" } });
}
