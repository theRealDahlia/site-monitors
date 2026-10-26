import { currentUser, sameOrigin } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { claimClientDomain, domainView, getDomain, removeClientDomain, validateDomain } from "@/lib/custom-domains";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";

const NOT_ON_PLAN = { error: "Status pages on your own domain are part of the Pro plan.", code: "plan_required" };
const allowed = (plan: string) => entitlementsFor(plan).whiteLabel && entitlementsFor(plan).clients;

/** The custom domain for one client's status page, with the records to set up. */
export async function GET(request: Request, ctx: RouteContext<"/api/clients/[id]/domain">) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !getClient(id, user.id)) return Response.json({ error: "Client not found." }, { status: 404 });
  const row = getDomain({ clientId: id }, user.id);
  return Response.json({ allowed: allowed(user.plan), domain: row ? domainView(row) : null });
}

/** Starts using a domain for this client's status page. It serves nothing until the owner proves they control it. */
export async function PUT(request: Request, ctx: RouteContext<"/api/clients/[id]/domain">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!allowed(user.plan)) return Response.json(NOT_ON_PLAN, { status: 403 });
  if (!rateLimit(`domain-claim:${user.id}`, 10, 60 * 60 * 1000)) return Response.json({ error: "Too many changes. Try again later." }, { status: 429 });

  const id = Number((await ctx.params).id);
  const client = Number.isInteger(id) ? getClient(id, user.id) : undefined;
  if (!client) return Response.json({ error: "Client not found." }, { status: 404 });
  if (!client.status_public) return Response.json({ error: "Turn on this client's public status page first." }, { status: 409 });

  let body: { domain?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const valid = validateDomain(body.domain);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  const claim = claimClientDomain(user.id, client.id, valid.domain);
  if (!claim.ok) return Response.json({ error: claim.error }, { status: 409 });
  return Response.json({ allowed: true, domain: domainView(claim.row) });
}

/** Stops using the domain. Always allowed, including after a downgrade. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/clients/[id]/domain">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !removeClientDomain(id, user.id)) return Response.json({ error: "No domain to remove." }, { status: 404 });
  return Response.json({ allowed: allowed(user.plan), domain: null });
}
