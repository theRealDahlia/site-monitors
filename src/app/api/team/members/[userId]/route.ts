import { currentUser, sameOrigin } from "@/lib/auth";
import { removeMember } from "@/lib/teams";

/** The owner removes someone from the team. They keep their own login and their own account. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/team/members/[userId]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (user.role !== "owner" || !removeMember(user.id, Number((await ctx.params).userId))) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
