import { getMonitorWithOwner } from "@/lib/monitors-db";
import { esc, expiredPage, linkPage as page } from "@/lib/link-page";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { checkStopToken, confirmSubscription, pageAddress, pageName, unsubscribe } from "@/lib/status-subscribers";

// The links in status-update emails: "confirm.<token>" starts a subscription, "stop.<id>.<signature>" ends it.
// Opening one shows a button; the change happens when it's pressed (see link-page.ts).

const gone = expiredPage;

function parse(link: string): { action: "confirm" | "stop"; token: string } | null {
  const dot = link.indexOf(".");
  const action = link.slice(0, dot);
  const token = link.slice(dot + 1);
  if (dot < 0 || !token || token.length > 200) return null;
  return action === "confirm" || action === "stop" ? { action, token } : null;
}

export async function GET(_: Request, ctx: RouteContext<"/api/subscriptions/[link]">) {
  const p = parse((await ctx.params).link);
  if (!p) return gone();
  if (p.action === "stop") {
    const row = checkStopToken(p.token);
    const m = row && getMonitorWithOwner(row.monitor_id);
    if (!row || !m) return gone();
    return page(
      "Stop status updates",
      `<h1>Stop status updates?</h1><p>${esc(row.email)} will no longer get emails about ${esc(pageName(m))}.</p><form method="post"><button type="submit">Stop the emails</button></form>`,
    );
  }
  return page(
    "Confirm status updates",
    `<h1>Confirm your subscription</h1><p>You'll get an email when there's news on this status page: an outage, an incident update, or scheduled maintenance.</p><form method="post"><button type="submit">Confirm</button></form>`,
  );
}

export async function POST(request: Request, ctx: RouteContext<"/api/subscriptions/[link]">) {
  if (!rateLimit(`subscription-link:${clientIp(request)}`, 30, 60 * 60 * 1000)) return page("Too many requests", "<h1>Too many requests</h1><p>Try again later.</p>", 429);
  const p = parse((await ctx.params).link);
  if (!p) return gone();
  if (p.action === "stop") {
    const row = checkStopToken(p.token);
    const m = row && getMonitorWithOwner(row.monitor_id);
    if (!row || !unsubscribe(p.token)) return gone();
    const name = m ? pageName(m) : "this status page";
    return page("Unsubscribed", `<h1>You're unsubscribed</h1><p>${esc(row.email)} won't get any more updates about ${esc(name)}.</p>`);
  }
  const done = confirmSubscription(p.token);
  const m = done && getMonitorWithOwner(done.monitorId);
  if (!done || !m) return gone();
  const link = pageAddress(m);
  return page(
    "Subscribed",
    `<h1>You're subscribed</h1><p>We'll email ${esc(done.email)} when there's news about ${esc(pageName(m))}. Every email has a link to stop them.</p><p><a href="${esc(link)}">Back to the status page</a></p>`,
  );
}
