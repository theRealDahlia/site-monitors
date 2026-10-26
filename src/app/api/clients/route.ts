import { currentUser, sameOrigin } from "@/lib/auth";
import { cleanClientName, clientView, createClient, listClients } from "@/lib/clients";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";

/** The account's clients. Anything already there stays visible after a downgrade; making more needs the Agency plan. */
export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json({ allowed: entitlementsFor(user.plan).clients, clients: listClients(user.id).map(clientView) }, { headers: { "Cache-Control": "no-store" } });
}

/** Adds a client: `{ name }`. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).clients) return Response.json({ error: "Clients are part of the Agency plan.", code: "plan_required" }, { status: 403 });
  if (!rateLimit(`client-add:${user.id}`, 100, 60 * 60 * 1000)) return Response.json({ error: "You're adding clients too quickly. Try again later." }, { status: 429 });

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = cleanClientName(body?.name);
  if (!name) return Response.json({ error: "Enter the client's name (up to 60 characters)." }, { status: 400 });
  const made = createClient(user.id, name);
  if (!made.ok) return Response.json({ error: made.error }, { status: made.status });
  return Response.json({ client: clientView({ ...made.client, sites: 0 }) }, { status: 201 });
}
