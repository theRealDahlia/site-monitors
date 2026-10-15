import { normalizeEmail, sameOrigin, startSession, verifyAgainstDummy, verifyPassword } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";
import { clientIp, countInWindow, record } from "@/lib/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 20;
const MAX_FAILS_PER_EMAIL = 8;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || password.length > 128) {
    return Response.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  // Only failures count, so an attacker spamming someone's email can't lock out successful logins
  // for long, and a real user isn't penalised for logging in often.
  const ipKey = `login-fail-ip:${clientIp(request)}`;
  const emailKey = `login-fail-email:${email}`;
  if (countInWindow(ipKey, WINDOW_MS) >= MAX_FAILS_PER_IP || countInWindow(emailKey, WINDOW_MS) >= MAX_FAILS_PER_EMAIL) {
    return Response.json({ error: "Too many failed attempts. Try again in a few minutes." }, { status: 429 });
  }

  const user = findUserByEmail(email);
  let ok = false;
  if (user) ok = await verifyPassword(password, user.password_hash);
  else await verifyAgainstDummy(password);

  if (!user || !ok) {
    record(ipKey, WINDOW_MS);
    record(emailKey, WINDOW_MS);
    return Response.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  return Response.json({ user: { email: user.email } }, { headers: { "Set-Cookie": startSession(user.id) } });
}
