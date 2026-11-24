import { currentUser, sameOrigin } from "@/lib/auth";
import { markTourSeen } from "@/lib/db";

/** Records that the signed-in person has seen the welcome tour (finished or skipped it), so it isn't shown again at their next login. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  markTourSeen(user.actor.id);
  return Response.json({ ok: true });
}
