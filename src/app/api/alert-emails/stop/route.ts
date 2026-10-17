import { stopByToken } from "@/lib/alert-emails";
import { sameOrigin } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Removes an added address, from the "stop getting these" link at the bottom of its alerts. No login. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  if (!rateLimit(`alert-email-stop:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const stopped = typeof body.token === "string" && body.token.length < 200 ? stopByToken(body.token) : null;
  if (!stopped) return Response.json({ error: "This link isn't valid, or the address was already removed." }, { status: 400 });
  return Response.json({ email: stopped.email });
}
