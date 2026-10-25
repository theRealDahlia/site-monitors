import { currentUser, endSession, sameOrigin, verifyPassword } from "@/lib/auth";
import { deleteAccount, deletionSummary, passwordHashFor } from "@/lib/account-deletion";
import { sendMail } from "@/lib/mail";
import { BRAND, SUPPORT_EMAIL } from "@/lib/brand";
import { countInWindow, record } from "@/lib/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

/** What the Account page shows. Always about the signed-in person's own account, even when they're working in a team's. */
export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json(
    { email: user.actor.email, plan: user.plan, role: user.role, ...deletionSummary(user.actor.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Deletes the signed-in person's own account for good: `{ password }`. A team member deletes theirs, never the team owner's. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || password.length > 128) return Response.json({ error: "Enter your password to confirm." }, { status: 400 });

  // Only wrong passwords count, as on the log-in page, so someone on a borrowed screen can't guess at it.
  const failKey = `delete-fail:${user.actor.id}`;
  if (countInWindow(failKey, WINDOW_MS) >= MAX_FAILS) return Response.json({ error: "Too many wrong passwords. Try again in a few minutes." }, { status: 429 });
  const hash = passwordHashFor(user.actor.id);
  if (!hash || !(await verifyPassword(password, hash))) {
    record(failKey, WINDOW_MS);
    return Response.json({ error: "That password isn't right." }, { status: 403 });
  }

  const email = user.actor.email;
  try {
    await deleteAccount(user.actor.id);
  } catch (error) {
    console.error("Account deletion failed:", error);
    return Response.json({ error: "Couldn't delete your account, and nothing was deleted. Please try again, or email us for help." }, { status: 500 });
  }

  // Best effort: the account is already gone, so a failed email mustn't turn into an error.
  await sendMail({
    to: email,
    subject: `Your ${BRAND} account has been deleted`,
    text: `Your ${BRAND} account for ${email} and its data have been deleted, and any paid subscription has been cancelled.\n\nIf this wasn't you, or you have questions, reply to ${SUPPORT_EMAIL}.`,
  }).catch(() => {});

  return Response.json({ ok: true }, { headers: { "Set-Cookie": endSession(request), "Cache-Control": "no-store" } });
}
