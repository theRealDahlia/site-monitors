import { acknowledge, readAckToken } from "@/lib/escalation";
import { esc, linkPage as page } from "@/lib/link-page";
import { addEvent, getMonitorWithOwner } from "@/lib/monitors-db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// The "acknowledge" link in an outage alert. Opening it shows a button; pressing it acknowledges (see link-page.ts).

const invalid = () => page("Link not valid", "<h1>This link isn't valid</h1><p>Check you copied all of it from the email.</p>", 404);

export async function GET(_: Request, ctx: RouteContext<"/api/ack/[token]">) {
  const t = readAckToken((await ctx.params).token);
  const m = t && getMonitorWithOwner(t.monitorId);
  if (!t || !m) return invalid();
  if (!m.down_alerted || m.down_since !== t.downSince) return page("Outage over", `<h1>This outage is over</h1><p>${esc(m.host)} is back up, so there's nothing to acknowledge.</p>`);
  if (m.ack_at) return page("Already acknowledged", `<h1>Already acknowledged</h1><p>Someone acknowledged the outage on ${esc(m.host)} at ${esc(new Date(m.ack_at).toUTCString())}.</p>`);
  return page(
    "Acknowledge outage",
    `<h1>Acknowledge the outage?</h1><p>${esc(m.host)} has been down since ${esc(new Date(t.downSince).toUTCString())}. Acknowledging it tells everyone it's being dealt with, and stops it being escalated.</p><form method="post"><button type="submit">Acknowledge</button></form>`,
  );
}

export async function POST(request: Request, ctx: RouteContext<"/api/ack/[token]">) {
  if (!rateLimit(`ack:${clientIp(request)}`, 30, 60 * 60 * 1000)) return page("Too many requests", "<h1>Too many requests</h1><p>Try again later.</p>", 429);
  const t = readAckToken((await ctx.params).token);
  const m = t && getMonitorWithOwner(t.monitorId);
  if (!t || !m) return invalid();
  const r = acknowledge(m.id, t.downSince);
  if (r === "over") return page("Outage over", `<h1>This outage is over</h1><p>${esc(m.host)} is back up, so there's nothing to acknowledge.</p>`);
  if (r === "acknowledged") addEvent({ userId: m.user_id, monitorId: m.id, host: m.host, kind: "acknowledged", message: `Outage on ${m.host} acknowledged from the alert email`, emailed: false });
  return page("Acknowledged", `<h1>Acknowledged</h1><p>The outage on ${esc(m.host)} is marked as being dealt with. Nobody else will be alerted about it. We'll still email when it's back up.</p>`);
}
