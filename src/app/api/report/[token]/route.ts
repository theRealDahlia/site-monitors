import { clientIp, rateLimit } from "@/lib/rate-limit";
import { reportForToken } from "@/lib/reports";

/** One month of one report, for the page a signed link opens. Anyone with the link can read it: it's for the client. */
export async function GET(request: Request, ctx: RouteContext<"/api/report/[token]">) {
  if (!rateLimit(`report-view:${clientIp(request)}`, 60, 60_000)) return Response.json({ error: "Too many requests." }, { status: 429 });
  const data = reportForToken((await ctx.params).token);
  if (!data) return Response.json({ error: "Report not found." }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "private, max-age=60" } });
}
