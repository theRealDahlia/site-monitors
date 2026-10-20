import { currentUser, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";
import { listReports, previousMonth, sendReport } from "@/lib/reports";

/** Emails last month's report to the account's own address, to see what clients will get. */
export async function POST(request: Request, ctx: RouteContext<"/api/reports/[id]/send">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).reports) return Response.json({ error: "Client reports are part of the Pro plan.", code: "plan_required" }, { status: 403 });
  if (!rateLimit(`report-test:${user.id}`, 10, 60 * 60 * 1000)) return Response.json({ error: "Too many test emails. Try again later." }, { status: 429 });
  const id = Number((await ctx.params).id);
  if (!listReports(user.id).some((r) => r.id === id)) return Response.json({ error: "Report not found." }, { status: 404 });
  // To the person who asked, who may be a team member.
  const sent = await sendReport(user.id, id, previousMonth(Date.now()), user.actor.email);
  if (!sent) return Response.json({ error: "We couldn't send it. Try again in a moment." }, { status: 502 });
  return Response.json({ ok: true, to: user.actor.email });
}
