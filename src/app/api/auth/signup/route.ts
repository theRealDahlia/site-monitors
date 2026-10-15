import {
  checkSignupCode,
  hashPassword,
  normalizeEmail,
  passwordProblem,
  sameOrigin,
  startSession,
} from "@/lib/auth";
import { insertUser } from "@/lib/db";
import { clientIp, countInWindow, record } from "@/lib/rate-limit";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_FAILED_CODES_PER_IP = 30;

/** Step 2 of sign-up: the emailed code proves the address is theirs, then the account is created. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });

  let body: { email?: unknown; code?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(code)) return Response.json({ error: "Enter the 6-digit code from the email." }, { status: 400 });
  // Checked before the code so a password typo doesn't use up one of the code's guesses.
  const problem = passwordProblem(body.password);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const failKey = `code-fail-ip:${clientIp(request)}`;
  if (countInWindow(failKey, WINDOW_MS) >= MAX_FAILED_CODES_PER_IP) {
    return Response.json({ error: "Too many incorrect codes from this network. Try again later." }, { status: 429 });
  }

  const check = checkSignupCode(email, code);
  if (!check.ok) {
    record(failKey, WINDOW_MS);
    if (check.reason === "locked") {
      return Response.json({ error: "Too many incorrect attempts. Request a new code.", code: "code_locked" }, { status: 400 });
    }
    return Response.json(
      {
        error:
          check.attemptsLeft > 0
            ? `That code is incorrect. ${check.attemptsLeft} ${check.attemptsLeft === 1 ? "attempt" : "attempts"} left.`
            : "That code is incorrect or has expired. Request a new one.",
        code: check.attemptsLeft > 0 ? "code_wrong" : "code_expired",
      },
      { status: 400 },
    );
  }

  const userId = insertUser(email, await hashPassword(body.password as string));
  if (userId === null) {
    return Response.json({ error: "An account with that email already exists. Log in instead." }, { status: 409 });
  }

  return Response.json({ user: { email } }, { status: 201, headers: { "Set-Cookie": startSession(userId) } });
}
