import { currentUser, sameOrigin } from "@/lib/auth";
import { withdrawInvite } from "@/lib/teams";

export async function DELETE(request: Request, ctx: RouteContext<"/api/team/invites/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (user.role !== "owner" || !withdrawInvite(user.id, Number((await ctx.params).id))) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
