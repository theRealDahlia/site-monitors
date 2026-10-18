import { normalizeEmail, sameOrigin } from "@/lib/auth";
import { RESET_COOLDOWN_SECONDS, issueReset, sendResetEmail } from "@/lib/password-reset";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Asks for a password reset link. The answer is the same whether or not the email has an account, so
 * this can't be used to find out who is signed up. The email is sent without waiting for it, so a
 * quick reply doesn't give the answer away either.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  // Each request can email a stranger's inbox, so cap both per sender and per address.
  if (!rateLimit(`pw-forgot-ip:${clientIp(request)}`, 10, HOUR_MS) || !rateLimit(`pw-forgot-email:${email}`, 3, HOUR_MS)) {
    return Response.json({ error: "Too many requests. Try again in a little while." }, { status: 429 });
  }

  const issued = issueReset(email);
  if (issued) {
    sendResetEmail(issued.email, issued.token).catch((err) => console.error("password reset email failed", err));
  }
  return Response.json({ ok: true, resendAfterSeconds: RESET_COOLDOWN_SECONDS });
}
