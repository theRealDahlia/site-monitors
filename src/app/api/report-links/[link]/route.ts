import { askPage, esc, expiredPage, linkPage } from "@/lib/link-page";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { checkRecipientStop, confirmRecipient, stopRecipient } from "@/lib/reports";

// The links in report emails: "confirm.<token>" and "stop.<id>.<signature>". Opening one shows a button; pressing it acts.

function parse(link: string) {
  const dot = link.indexOf(".");
  const action = link.slice(0, dot);
  const token = link.slice(dot + 1);
  return dot > 0 && token && token.length <= 200 && (action === "confirm" || action === "stop") ? { action, token } : null;
}

export async function GET(_: Request, ctx: RouteContext<"/api/report-links/[link]">) {
  const p = parse((await ctx.params).link);
  if (!p) return expiredPage();
  if (p.action === "stop") {
    const row = checkRecipientStop(p.token);
    if (!row) return expiredPage();
    return askPage("Stop the monthly report?", `${esc(row.email)} will no longer get this uptime report.`, "Stop the report");
  }
  return askPage("Confirm the monthly report", "You'll get an uptime report by email at the start of each month.", "Confirm");
}

export async function POST(request: Request, ctx: RouteContext<"/api/report-links/[link]">) {
  if (!rateLimit(`report-link:${clientIp(request)}`, 30, 60 * 60 * 1000)) return linkPage("Too many requests", "<h1>Too many requests</h1><p>Try again later.</p>", 429);
  const p = parse((await ctx.params).link);
  if (!p) return expiredPage();
  if (p.action === "stop") {
    const done = stopRecipient(p.token);
    return done ? askPage("You're unsubscribed", `${esc(done.email)} won't get this report any more.`) : expiredPage();
  }
  const done = confirmRecipient(p.token);
  return done ? askPage("You're all set", `${esc(done.email)} will get the "${esc(done.reportName)}" uptime report at the start of each month.`) : expiredPage();
}
