import { currentUser, sameOrigin } from "@/lib/auth";
import { deleteKey } from "@/lib/api-keys";

/** Deletes a key. Anything using it stops working straight away. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/keys/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!deleteKey(user.id, Number((await ctx.params).id))) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
