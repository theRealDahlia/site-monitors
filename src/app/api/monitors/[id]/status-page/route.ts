import { currentUser, sameOrigin } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { setStatusPage } from "@/lib/monitors-db";
import { rateLimit } from "@/lib/rate-limit";
import { newSlug } from "@/lib/status-page";

/** Turns a site's public status page on or off. */
export async function POST(request: Request, ctx: RouteContext<"/api/monitors/[id]/status-page">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).statusPages) {
    return Response.json({ error: "Public status pages are part of the Starter plan.", code: "plan_required" }, { status: 403 });
  }
  if (!rateLimit(`status-page:${user.id}`, 60, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many changes. Try again later." }, { status: 429 });
  }

  let body: { enabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") return Response.json({ error: "Invalid request." }, { status: 400 });

  const id = Number((await ctx.params).id);
  const result = Number.isInteger(id) ? setStatusPage(id, user.id, body.enabled, newSlug) : null;
  if (!result) return Response.json({ error: "Monitor not found." }, { status: 404 });
  return Response.json({ enabled: body.enabled, slug: result.slug });
}
