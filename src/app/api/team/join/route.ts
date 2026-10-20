import { currentUser, sameOrigin } from "@/lib/auth";
import { acceptInvite } from "@/lib/teams";

/** Accepts an invitation for the person signed in: `{ token }`. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body?.token !== "string") return Response.json({ error: "Invalid request." }, { status: 400 });
  const r = acceptInvite(body.token, user.actor);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ ok: true });
}
