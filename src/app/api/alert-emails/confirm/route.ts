import { confirmAlertEmail } from "@/lib/alert-emails";
import { sameOrigin } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Confirms an added address from the link in its email. No login: the person confirming is usually
 * not the account owner. It's a POST from the confirmation page's button, never a GET, so an email
 * scanner that opens links can't confirm an address on its own.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  if (!rateLimit(`alert-email-confirm:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const confirmed = typeof body.token === "string" ? confirmAlertEmail(body.token) : null;
  if (!confirmed) return Response.json({ error: "This link has expired or was already used." }, { status: 400 });
  return Response.json({ email: confirmed.email });
}
