import { currentUser, sameOrigin } from "@/lib/auth";
import { removePhone, setPhoneMode } from "@/lib/phones";

/** Changes whether a number gets texts, calls or both: `{ mode }`. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/phones/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  let body: { mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!setPhoneMode(user.id, Number((await ctx.params).id), body?.mode)) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/phones/[id]">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!removePhone(user.id, Number((await ctx.params).id))) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ok: true });
}
