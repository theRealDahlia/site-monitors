import { issueSignupCode, normalizeEmail, sameOrigin } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const HOUR_MS = 60 * 60 * 1000;

/** Step 1 of sign-up: email a confirmation code. No account exists until the code is entered. */
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

  // Each code is an email to a stranger's inbox, so cap both per sender and per recipient.
  if (
    !rateLimit(`code-ip:${clientIp(request)}`, 10, HOUR_MS) ||
    !rateLimit(`code-email:${email}`, 5, HOUR_MS)
  ) {
    return Response.json({ error: "Too many codes requested. Try again later." }, { status: 429 });
  }

  if (findUserByEmail(email)) {
    return Response.json({ error: "An account with that email already exists. Log in instead." }, { status: 409 });
  }

  try {
    const issued = await issueSignupCode(email);
    if (!issued.ok) {
      return Response.json(
        { error: `Wait ${issued.retryAfterSeconds}s before asking for another code.`, retryAfterSeconds: issued.retryAfterSeconds },
        { status: 429 },
      );
    }
  } catch (err) {
    console.error("signup code email failed", err);
    return Response.json({ error: "We couldn't send the email. Try again later." }, { status: 502 });
  }

  return Response.json({ ok: true, resendAfterSeconds: 60 });
}
