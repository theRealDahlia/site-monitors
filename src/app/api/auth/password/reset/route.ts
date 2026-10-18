import { passwordProblem, sameOrigin } from "@/lib/auth";
import { resetPassword, sendPasswordChangedEmail } from "@/lib/password-reset";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Sets a new password from the link in the email. The link works once. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });

  // The tokens are long and random, so guessing one isn't realistic. This just stops hammering.
  if (!rateLimit(`pw-reset-ip:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: { token?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // A weak password is turned down before the link is used, so the person can fix it and try again.
  const problem = passwordProblem(body.password);
  if (problem) return Response.json({ error: problem, code: "bad_password" }, { status: 400 });

  const done = typeof body.token === "string" ? await resetPassword(body.token, body.password as string) : null;
  if (!done) {
    return Response.json({ error: "This link has expired or was already used. Ask for a new one.", code: "bad_link" }, { status: 400 });
  }

  sendPasswordChangedEmail(done.email).catch((err) => console.error("password changed email failed", err));
  // No one is logged in afterwards: every session for the account was ended, and they log in with the new password.
  return Response.json({ ok: true });
}
