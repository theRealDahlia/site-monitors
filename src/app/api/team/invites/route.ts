import { currentUser, normalizeEmail, sameOrigin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { invite } from "@/lib/teams";

/** The owner invites someone to the team: `{ email }`. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (user.role !== "owner") return Response.json({ error: "Only the account's owner can invite people." }, { status: 403 });
  if (!rateLimit(`team-invite:${user.id}`, 20, 24 * 60 * 60 * 1000)) return Response.json({ error: "Too many invitations today. Try again tomorrow." }, { status: 429 });
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = normalizeEmail(body?.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const r = await invite(user, email);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ ok: true }, { status: 201 });
}
