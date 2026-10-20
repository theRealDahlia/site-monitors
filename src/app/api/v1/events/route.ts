import { apiCaller } from "@/lib/api-keys";
import { recentEvents } from "@/lib/monitors-db";

/** GET /api/v1/events?limit=50: the account's latest alerts and notices, newest first (up to 200). */
export async function GET(request: Request) {
  const c = apiCaller(request);
  if (!c.ok) return c.response;
  const limit = Math.max(1, Math.min(200, Number(new URL(request.url).searchParams.get("limit")) || 50));
  return Response.json({
    events: recentEvents(c.userId, limit).map((e) => ({
      id: e.id,
      monitorId: e.monitor_id,
      monitor: e.host,
      kind: e.kind,
      message: e.message,
      details: e.details,
      emailed: !!e.emailed,
      at: e.created_at,
    })),
  });
}
