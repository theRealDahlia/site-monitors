import { currentUser, sameOrigin } from "@/lib/auth";
import { removeChannel } from "@/lib/channels";

export async function DELETE(request: Request, ctx: RouteContext<"/api/integrations/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !removeChannel(id, user.id)) return Response.json({ error: "Channel not found." }, { status: 404 });
  return Response.json({ ok: true });
}
