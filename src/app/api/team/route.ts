import { currentUser } from "@/lib/auth";
import { teamOf } from "@/lib/teams";

/** The team: for the owner, its members and invitations; for a member, whose account they're in. */
export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (user.role === "member") return Response.json({ role: "member", ownerEmail: user.email });
  return Response.json({ role: "owner", ...teamOf(user.id, user.plan) });
}
