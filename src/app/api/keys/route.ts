import { currentUser, sameOrigin } from "@/lib/auth";
import { createKey, listKeys } from "@/lib/api-keys";
import { entitlementsFor } from "@/lib/entitlements";

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json({ allowed: entitlementsFor(user.plan).apiAccess, max: entitlementsFor(user.plan).apiKeys, perMinute: entitlementsFor(user.plan).apiPerMinute, keys: listKeys(user.id) });
}

/** Makes an API key: `{ name }`. The response is the only time the key is shown. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).apiAccess) return Response.json({ error: "The API is part of the Pro plan.", code: "plan_required" }, { status: 403 });
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const r = createKey(user.id, body?.name, entitlementsFor(user.plan).apiKeys);
  if (!r.ok) return Response.json({ error: r.error }, { status: 409 });
  return Response.json({ key: r.key, view: r.view }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
