import { currentUser, sameOrigin } from "@/lib/auth";
import { leaveTeam } from "@/lib/teams";

/** A member leaves the team and goes back to their own account. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (user.role !== "member" || !leaveTeam(user.actor.id)) return Response.json({ error: "You're not in a team." }, { status: 404 });
  return Response.json({ ok: true });
}
