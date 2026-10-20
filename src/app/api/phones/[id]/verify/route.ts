import { currentUser, sameOrigin } from "@/lib/auth";
import { verifyPhone } from "@/lib/phones";

/** Checks the code that was texted to a number: `{ code }`. */
export async function POST(request: Request, ctx: RouteContext<"/api/phones/[id]/verify">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const r = verifyPhone(user.id, Number((await ctx.params).id), body?.code);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ phone: r.phone });
}
