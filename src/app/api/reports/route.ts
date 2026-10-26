import { currentUser, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { clientView, listClients } from "@/lib/clients";
import { listMonitors } from "@/lib/monitors-db";
import { createReport, listReports, previousMonth, reportPath } from "@/lib/reports";

/** The account's client reports, the monitors they can cover, and a preview link to last month's of each. */
export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const month = previousMonth(Date.now());
  return Response.json({
    allowed: entitlementsFor(user.plan).reports,
    month,
    monitors: listMonitors(user.id).map((m) => ({ id: m.id, host: m.host, kind: m.kind, clientId: m.client_id })),
    // Clients (Agency), whose logo and colours a report can carry.
    clients: entitlementsFor(user.plan).clients ? listClients(user.id).map(clientView).map((c) => ({ id: c.id, name: c.name })) : [],
    reports: listReports(user.id).map((r) => ({ ...r, preview: reportPath(r.id, month) })),
  });
}

export async function POST(request: Request) {
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
  const r = createReport(user.id, body ?? {});
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ report: r.value }, { status: 201 });
}
