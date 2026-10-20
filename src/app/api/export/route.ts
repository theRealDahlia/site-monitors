import { currentUser } from "@/lib/auth";
import { apiHistory, apiMonitor } from "@/lib/api-view";
import { entitlementsFor } from "@/lib/entitlements";
import { listMonitors, recentEvents } from "@/lib/monitors-db";
import { rateLimit } from "@/lib/rate-limit";

// Downloads of the account's own data, on every plan: its monitors, its notifications, and daily uptime for as far
// back as the plan shows. CSV for spreadsheets, JSON for everything else.

/** One CSV cell: quoted when needed, and never starting with something a spreadsheet would run as a formula. */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!rateLimit(`export:${user.id}`, 30, 60 * 60 * 1000)) return Response.json({ error: "Too many downloads. Try again later." }, { status: 429 });
  const params = new URL(request.url).searchParams;
  const what = params.get("what");
  const format = params.get("format") === "json" ? "json" : "csv";
  const date = new Date().toISOString().slice(0, 10);
  const monitors = listMonitors(user.id).map((m) => apiMonitor(m, user.plan));

  let data: unknown;
  let rows: unknown[][];
  if (what === "monitors") {
    data = { monitors };
    rows = [
      ["id", "kind", "name", "status", "uptime_24h", "uptime_30d", "response_ms", "ssl_days_left", "domain_days_left", "created_at"],
      ...monitors.map((m) => [m.id, m.kind, m.name, m.status, m.uptime.last24h, m.uptime.last30d, m.uptime.responseMs, m.ssl?.daysLeft, m.domain?.daysLeft, new Date(m.createdAt).toISOString()]),
    ];
  } else if (what === "events") {
    const events = recentEvents(user.id, 5000);
    data = { events: events.map((e) => ({ id: e.id, monitor: e.host, kind: e.kind, message: e.message, details: e.details, emailed: !!e.emailed, at: e.created_at })) };
    rows = [["at", "monitor", "kind", "message", "emailed"], ...events.map((e) => [new Date(e.created_at).toISOString(), e.host, e.kind, e.message, e.emailed ? "yes" : "no"])];
  } else if (what === "uptime") {
    const days = entitlementsFor(user.plan).historyDays;
    const history = monitors.map((m) => ({ id: m.id, name: m.name, days: apiHistory(m.id, user.plan, days) }));
    data = { days, history };
    rows = [["date", "monitor_id", "monitor", "checks", "up", "uptime_percent", "avg_response_ms"], ...history.flatMap((h) => h.days.map((d) => [d.date, h.id, h.name, d.checks, d.up, d.uptime, d.avgResponseMs]))];
  } else {
    return Response.json({ error: "Choose what to download: monitors, events or uptime." }, { status: 400 });
  }

  const name = `site-monitors-${what}-${date}.${format}`;
  return new Response(format === "json" ? JSON.stringify(data, null, 2) : csv(rows), {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
