import { entitlementsFor } from "@/lib/entitlements";
import { getPublicMonitor, recentIncidents } from "@/lib/monitors-db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { STATE_LABEL, listNotices } from "@/lib/status-notices";
import { SLUG_PATTERN } from "@/lib/status-page";
import { pageAddress, pageName } from "@/lib/status-subscribers";

const DAY = 86_400_000;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rfc822 = (ms: number) => new Date(ms).toUTCString();
const fmt = (ms: number) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });

/** A status page as an RSS feed: the owner's incidents and maintenance, and outages our checks confirmed. */
export async function GET(request: Request, ctx: RouteContext<"/api/status/[slug]/feed">) {
  if (!rateLimit(`feed:${clientIp(request)}`, 120, 60_000)) return new Response("Too many requests\n", { status: 429 });
  const { slug } = await ctx.params;
  const monitor = SLUG_PATTERN.test(slug) ? getPublicMonitor(slug) : undefined;
  if (!monitor || !entitlementsFor(monitor.owner_plan).statusPages) return new Response("Not found\n", { status: 404 });

  const now = Date.now();
  const page = pageAddress(monitor);
  const name = pageName(monitor);
  const items: { title: string; text: string; at: number; guid: string }[] = [];

  for (const n of listNotices(monitor.id, now)) {
    if (n.kind === "maintenance" && n.state === "cancelled" && n.updates.length === 0) continue;
    const latest = n.updates[0];
    const what = n.kind === "maintenance" ? "Maintenance" : "Incident";
    const times = n.kind === "maintenance" && n.startsAt && n.endsAt ? `${fmt(n.startsAt)} to ${fmt(n.endsAt)}\n\n` : "";
    items.push({
      title: `${what}: ${n.title} (${STATE_LABEL[n.state] ?? n.state})`,
      text: times + n.updates.map((u) => `${STATE_LABEL[u.state] ?? u.state}, ${fmt(u.at)}: ${u.message}`).join("\n\n"),
      at: latest?.at ?? n.createdAt,
      // A new update makes it a new item, so feed readers show it again.
      guid: `${slug}-notice-${n.id}-${latest?.id ?? 0}`,
    });
  }
  for (const i of recentIncidents(monitor.id, now - 30 * DAY, 20)) {
    items.push({
      title: i.ended_at ? `Outage resolved: ${monitor.host}` : `Outage: ${monitor.host} is down`,
      text: i.ended_at ? `${monitor.host} was down from ${fmt(i.started_at)} to ${fmt(i.ended_at)}.` : `${monitor.host} has been down since ${fmt(i.started_at)}.`,
      at: i.ended_at ?? i.started_at,
      guid: `${slug}-outage-${i.id}-${i.ended_at ? "end" : "start"}`,
    });
  }
  items.sort((a, b) => b.at - a.at);

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n` +
    `<title>${esc(`${name} status`)}</title>\n<link>${esc(page)}</link>\n<description>${esc(`Incidents, maintenance and outages for ${name}`)}</description>\n` +
    `<lastBuildDate>${rfc822(now)}</lastBuildDate>\n` +
    items
      .slice(0, 50)
      .map(
        (i) =>
          `<item>\n<title>${esc(i.title)}</title>\n<link>${esc(page)}</link>\n<guid isPermaLink="false">${esc(i.guid)}</guid>\n` +
          `<pubDate>${rfc822(i.at)}</pubDate>\n<description>${esc(i.text)}</description>\n</item>`,
      )
      .join("\n") +
    `\n</channel>\n</rss>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
