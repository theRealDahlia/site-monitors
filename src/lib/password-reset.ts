import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "./auth";
import { db } from "./db";
import { appUrl, sendMail } from "./mail";

// "Forgot password": an emailed link that lets someone choose a new password.
// - The link carries a random token. Only its hash is stored, it works once, and it expires.
// - Asking for a link never reveals whether an address has an account (see the route).
// - Choosing a new password logs the account out everywhere and cancels any other waiting link.

export const RESET_MINUTES = 60;
/** Minimum gap between links for one account, so the form can't be used to flood someone's inbox. */
export const RESET_COOLDOWN_SECONDS = 60;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Creates a link for this email, if it has an account and one wasn't made a moment ago. Returns the token
 * to put in the email, or null when there's nothing to send (no account, or too soon). Callers must answer
 * the visitor the same way either way.
 */
export function issueReset(email: string, now = Date.now()): { token: string; email: string } | null {
  const user = db().prepare("SELECT id, email FROM users WHERE email = ?").get(email) as { id: number; email: string } | undefined;
  if (!user) return null;
  const last = db().prepare("SELECT MAX(created_at) AS at FROM password_resets WHERE user_id = ?").get(user.id) as { at: number | null };
  if (last.at !== null && now - last.at < RESET_COOLDOWN_SECONDS * 1000) return null;

  const token = randomBytes(32).toString("base64url");
  db().prepare("DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?").run(user.id, now);
  db().prepare("INSERT INTO password_resets (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)").run(user.id, sha256(token), now, now + RESET_MINUTES * 60_000);
  return { token, email: user.email };
}

export const resetLink = (token: string) => `${appUrl()}/reset-password?token=${token}`;

export async function sendResetEmail(email: string, token: string): Promise<void> {
  await sendMail({
    to: email,
    subject: "Reset your Site Monitors password",
    text:
      `Someone asked to reset the password for the Site Monitors account ${email}. If that was you, choose a new password here:\n\n` +
      `${resetLink(token)}\n\n` +
      `The link works once and expires in ${RESET_MINUTES} minutes. If you didn't ask for this, ignore this email: your password hasn't changed, ` +
      `and nobody can use the link without access to your inbox.`,
  });
}

export async function sendPasswordChangedEmail(email: string): Promise<void> {
  await sendMail({
    to: email,
    subject: "Your Site Monitors password was changed",
    text:
      `The password for the Site Monitors account ${email} was just changed, and you've been logged out everywhere.\n\n` +
      `If that was you, there's nothing more to do. If it wasn't, reset your password again straight away: ${appUrl()}/forgot-password`,
  });
}

/**
 * Uses a link to set a new password. Returns the account's email, or null if the link is unknown, expired
 * or already used. The new password, the removal of every other link and the logout of every session
 * happen together or not at all.
 */
export async function resetPassword(token: string, newPassword: string, now = Date.now()): Promise<{ email: string } | null> {
  if (!token || token.length > 100) return null;
  const hash = sha256(token);
  const found = db().prepare("SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?").get(hash) as { user_id: number; expires_at: number } | undefined;
  if (!found || found.expires_at < now) return null;

  // Hashing takes a moment, so it's done before the quick, all-or-nothing database change.
  const passwordHash = await hashPassword(newPassword);
  const conn = db();
  conn.exec("BEGIN IMMEDIATE");
  try {
    // Deleting the link is what claims it: if two requests race, only one of them deletes a row.
    if (Number(conn.prepare("DELETE FROM password_resets WHERE token_hash = ?").run(hash).changes) === 0) {
      conn.exec("ROLLBACK");
      return null;
    }
    conn.prepare("DELETE FROM password_resets WHERE user_id = ?").run(found.user_id);
    conn.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, found.user_id);
    conn.prepare("DELETE FROM sessions WHERE user_id = ?").run(found.user_id);
    conn.exec("COMMIT");
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
  const user = conn.prepare("SELECT email FROM users WHERE id = ?").get(found.user_id) as { email: string } | undefined;
  return user ? { email: user.email } : null;
}
