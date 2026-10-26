import { currentUser, sameOrigin } from "@/lib/auth";
import { domainView, verifyClientDomain } from "@/lib/custom-domains";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";

/** "Check DNS" for a client's domain: looks for the proof record and whether the domain points at us. */
export async function POST(request: Request, ctx: RouteContext<"/api/clients/[id]/domain/verify">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const ent = entitlementsFor(user.plan);
  if (!ent.whiteLabel || !ent.clients) return Response.json({ error: "Status pages on your own domain are part of the Pro plan.", code: "plan_required" }, { status: 403 });
  if (!rateLimit(`domain-verify:${user.id}`, 20, 10 * 60 * 1000)) return Response.json({ error: "Too many checks. Wait a few minutes." }, { status: 429 });

  const id = Number((await ctx.params).id);
  const result = Number.isInteger(id) ? await verifyClientDomain(id, user.id) : { ok: false as const, error: "Client not found." };
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ allowed: true, domain: domainView(result.row, result.dns) });
}
