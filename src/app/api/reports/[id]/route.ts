import { currentUser, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { deleteReport, updateReport } from "@/lib/reports";

export async function PATCH(request: Request, ctx: RouteContext<"/api/reports/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).reports) return Response.json({ error: "Client reports are part of the Pro plan.", code: "plan_required" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const r = updateReport(user.id, Number((await ctx.params).id), body ?? {});
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ report: r.value });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/reports/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!deleteReport(user.id, Number((await ctx.params).id))) return Response.json({ error: "Report not found." }, { status: 404 });
  return Response.json({ ok: true });
}
