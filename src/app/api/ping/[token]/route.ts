import { HEARTBEAT_TOKEN_PATTERN } from "@/lib/monitor-kinds";
import { ALL_CHECKS, runChecks } from "@/lib/monitor-runner";
import { findHeartbeat, recordPing } from "@/lib/monitors-db";
import { rateLimit } from "@/lib/rate-limit";

// A heartbeat's ping address. A scheduled job calls it (curl, wget, a fetch) each time it runs. No login: the long
// random token in the address is what identifies the job, so it works from any server or script.
//
// It answers the same "not found" for an unknown token as for a malformed one, so tokens can't be probed.

async function ping(ctx: RouteContext<"/api/ping/[token]">): Promise<Response> {
  const { token } = await ctx.params;
  if (!HEARTBEAT_TOKEN_PATTERN.test(token)) return new Response("Not found\n", { status: 404 });
  // A job that pings in a tight loop shouldn't be able to keep the checker busy.
  if (!rateLimit(`ping:${token}`, 30, 60_000)) return new Response("Too many pings\n", { status: 429 });

  const monitor = findHeartbeat(token);
  if (!monitor) return new Response("Not found\n", { status: 404 });

  recordPing(monitor.id, Date.now());
  // Bring its state up to date now (and send "checked in again" if it was overdue). The job doesn't wait for that.
  runChecks(monitor.id, ALL_CHECKS).catch((err) => console.error(`heartbeat ${monitor.id} update failed`, err));
  return new Response("OK\n", { headers: { "Cache-Control": "no-store" } });
}

export const GET = (_: Request, ctx: RouteContext<"/api/ping/[token]">) => ping(ctx);
export const POST = (_: Request, ctx: RouteContext<"/api/ping/[token]">) => ping(ctx);
export const HEAD = (_: Request, ctx: RouteContext<"/api/ping/[token]">) => ping(ctx);
