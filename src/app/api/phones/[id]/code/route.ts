import { currentUser, sameOrigin } from "@/lib/auth";
import { sendCode } from "@/lib/phones";
import { rateLimit } from "@/lib/rate-limit";

/** Texts a new code to a number that isn't confirmed yet. */
export async function POST(request: Request, ctx: RouteContext<"/api/phones/[id]/code">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!rateLimit(`phone-code:${user.id}`, 10, 24 * 60 * 60 * 1000)) return Response.json({ error: "Too many codes today. Try again tomorrow." }, { status: 429 });
  const r = await sendCode(user.id, Number((await ctx.params).id));
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ phone: r.phone });
}
