import { currentUser, sameOrigin } from "@/lib/auth";
import { cleanClientName, clientView, deleteClient, getClient, listClients, renameClient, setClientLook, setClientStatusPage } from "@/lib/clients";
import { entitlementsFor } from "@/lib/entitlements";
import { cleanBrandName, isAccent } from "@/lib/theme";

const view = (userId: number, id: number) => {
  const row = listClients(userId).find((c) => c.id === id);
  return row ? clientView(row) : null;
};

/**
 * Changes a client. Any of: `{ name }`, `{ look: { name, accent } }` (null for either means the account's), and
 * `{ statusPage: true | false }`.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/clients/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const ent = entitlementsFor(user.plan);
  if (!ent.clients) return Response.json({ error: "Clients are part of the Agency plan.", code: "plan_required" }, { status: 403 });

  const id = Number((await ctx.params).id);
  const client = Number.isInteger(id) ? getClient(id, user.id) : undefined;
  if (!client) return Response.json({ error: "Client not found." }, { status: 404 });

  let body: { name?: unknown; look?: { name?: unknown; accent?: unknown }; statusPage?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });

  if (body.name !== undefined) {
    const name = cleanClientName(body.name);
    if (!name) return Response.json({ error: "Enter the client's name (up to 60 characters)." }, { status: 400 });
    if (renameClient(id, user.id, name) === "duplicate") return Response.json({ error: `You already have a client called ${name}.` }, { status: 409 });
  }
  if (body.look !== undefined) {
    const look = body.look ?? {};
    const brandName = look.name === null || look.name === undefined ? null : cleanBrandName(look.name);
    if (brandName === undefined) return Response.json({ error: "Keep the brand name to 60 characters." }, { status: 400 });
    const accent = look.accent === null || look.accent === undefined ? null : look.accent;
    if (accent !== null && !isAccent(accent)) return Response.json({ error: "Choose one of the colours." }, { status: 400 });
    setClientLook(id, user.id, { brandName, accent });
  }
  if (body.statusPage !== undefined) {
    if (typeof body.statusPage !== "boolean") return Response.json({ error: "Invalid request." }, { status: 400 });
    if (body.statusPage && !ent.statusPages) return Response.json({ error: "Status pages are part of the Starter plan.", code: "plan_required" }, { status: 403 });
    setClientStatusPage(id, user.id, body.statusPage);
  }
  return Response.json({ client: view(user.id, id) });
}

/** Deletes a client. Its monitors stay, without a client. Always allowed, including after a downgrade. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/clients/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !deleteClient(id, user.id)) return Response.json({ error: "Client not found." }, { status: 404 });
  return Response.json({ ok: true });
}
