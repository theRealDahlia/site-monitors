import { brandingFor } from "@/lib/branding";
import { publicClientStatus } from "@/lib/client-status";
import { clientBranding, clientMonitors, getPublicClient } from "@/lib/clients";
import { entitlementsFor } from "@/lib/entitlements";
import { getPublicMonitor } from "@/lib/monitors-db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { publicNotices } from "@/lib/status-notices";
import { SLUG_PATTERN, publicStatus } from "@/lib/status-page";

// Public: no login. Anyone with the address can read it, so what it returns is decided in publicStatus().
export async function GET(request: Request, ctx: RouteContext<"/api/status/[slug]">) {
  if (!rateLimit(`status-view:${clientIp(request)}`, 120, 60_000)) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const { slug } = await ctx.params;
  const monitor = SLUG_PATTERN.test(slug) ? getPublicMonitor(slug) : undefined;
  if (!monitor && SLUG_PATTERN.test(slug)) {
    // Not a site's page: it may be a client's (Agency), which shows all of that client's monitors and its own look.
    const client = getPublicClient(slug);
    const plan = client && entitlementsFor(client.owner_plan);
    if (client && plan?.clients && plan.statusPages) {
      const branding = clientBranding(client, brandingFor(client.user_id, client.owner_plan));
      // `?site=<id>`: one of the client's sites in full, the way its own status page would show it.
      const wanted = new URL(request.url).searchParams.get("site");
      if (wanted !== null) {
        const site = /^\d{1,12}$/.test(wanted) ? clientMonitors(client.id, client.user_id).find((m) => m.id === Number(wanted)) : undefined;
        if (!site) return Response.json({ error: "Status page not found." }, { status: 404 });
        return Response.json(
          { ...publicStatus(site), notices: publicNotices(site.id), updates: { email: false }, branding, fromClient: { name: client.name } },
          { headers: { "Cache-Control": "public, max-age=15" } },
        );
      }
      return Response.json(
        { ...publicClientStatus(client), branding },
        { headers: { "Cache-Control": "public, max-age=15" } },
      );
    }
  }
  // One answer for "no such page", "switched off" and "owner's plan doesn't include it", so none can be told apart.
  if (!monitor || !entitlementsFor(monitor.owner_plan).statusPages) {
    return Response.json({ error: "Status page not found." }, { status: 404 });
  }
  // The owner's own logo, name and colours (on plans with branding), so the page their clients see looks like theirs.
  // Leaving our credit off is a Pro feature; brandingFor() only reports it for accounts that still have it.
  return Response.json(
    {
      ...publicStatus(monitor),
      notices: publicNotices(monitor.id),
      // Ways to follow the page: an RSS feed always, email on plans that include it.
      updates: { email: entitlementsFor(monitor.owner_plan).statusSubscribers },
      branding: brandingFor(monitor.user_id, monitor.owner_plan),
    },
    { headers: { "Cache-Control": "public, max-age=15" } },
  );
}
