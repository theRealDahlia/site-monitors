import { currentUser, sameOrigin } from "@/lib/auth";
import { removeRecipient } from "@/lib/reports";

export async function DELETE(request: Request, ctx: RouteContext<"/api/reports/[id]/recipients/[rid]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const { id, rid } = await ctx.params;
  if (!removeRecipient(user.id, Number(id), Number(rid))) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
