import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { entitlementsFor } from "./entitlements";
import { type Mail, appUrl, sendMail } from "./mail";
import { secret } from "./secret";

// Who gets alert emails: the account's own address, plus more addresses up to the plan's limit (a colleague, a
// shared inbox). Each one can be switched on or off. An added address only ever receives alerts after
// someone has clicked the confirmation link we sent to it, and every alert it gets has a link to stop
// them, so this can't be used to send email to people who didn't ask for it.

const CONFIRM_DAYS = 7;
export const CONFIRM_RESEND_SECONDS = 60;

interface Row {
  id: number;
  user_id: number;
  email: string;
  enabled: number;
  confirmed_at: number | null;
  confirm_hash: string | null;
  confirm_expires: number | null;
  confirm_sent_at: number | null;
  created_at: number;
}

export interface AlertEmailView {
  id: number;
  email: string;
  enabled: boolean;
  confirmed: boolean;
  /** When the latest confirmation link was sent, while it's still waiting. */
  confirmSentAt: number | null;
}

export interface Recipients {
  account: { email: string; enabled: boolean };
  extras: AlertEmailView[];
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const view = (r: Row): AlertEmailView => ({
  id: r.id,
  email: r.email,
  enabled: r.enabled === 1,
  confirmed: r.confirmed_at !== null,
  confirmSentAt: r.confirmed_at === null ? r.confirm_sent_at : null,
});

export function listRecipients(userId: number): Recipients | null {
  const user = db().prepare("SELECT email, alerts_to_account FROM users WHERE id = ?").get(userId) as { email: string; alerts_to_account: number } | undefined;
  if (!user) return null;
  const rows = db().prepare("SELECT * FROM alert_emails WHERE user_id = ? ORDER BY created_at, id").all(userId) as unknown as Row[];
  return { account: { email: user.email, enabled: user.alerts_to_account === 1 }, extras: rows.map(view) };
}

export function setAccountAlerts(userId: number, enabled: boolean): void {
  db().prepare("UPDATE users SET alerts_to_account = ? WHERE id = ?").run(enabled ? 1 : 0, userId);
}

export type AddResult = { ok: true; id: number; token: string } | { ok: false; error: string; status: number };

/**
 * The account's addresses, and how many extra ones its plan allows. An account that has fallen to a smaller
 * plan can have more than that: nothing is removed, they all keep working, and no more can be added until
 * it's back under the limit.
 */
export function recipientsView(userId: number, plan: string) {
  return { ...listRecipients(userId), max: entitlementsFor(plan).maxExtraEmails };
}

/** Saves an address as waiting for confirmation and returns the token for its confirmation link. `maxExtras` is the plan's limit. */
export function addAlertEmail(userId: number, accountEmail: string, email: string, maxExtras: number, now = Date.now()): AddResult {
  if (email === accountEmail) return { ok: false, error: "That's already your account's email address.", status: 409 };
  const count = (db().prepare("SELECT COUNT(*) AS c FROM alert_emails WHERE user_id = ?").get(userId) as { c: number }).c;
  if (count >= maxExtras) return { ok: false, error: `Your plan includes up to ${maxExtras} extra addresses. Remove one to add another.`, status: 403 };
  const token = randomBytes(32).toString("base64url");
  try {
    const res = db()
      .prepare("INSERT INTO alert_emails (user_id, email, confirm_hash, confirm_expires, confirm_sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(userId, email, sha256(token), now + CONFIRM_DAYS * 86_400_000, now, now);
    return { ok: true, id: Number(res.lastInsertRowid), token };
  } catch {
    return { ok: false, error: "You've already added that address.", status: 409 };
  }
}

export type ResendResult = { ok: true; email: string; token: string } | { ok: false; error: string; status: number };

/** A fresh confirmation link for an address that hasn't been confirmed yet. The old link stops working. */
export function renewConfirmation(id: number, userId: number, now = Date.now()): ResendResult {
  const row = db().prepare("SELECT * FROM alert_emails WHERE id = ? AND user_id = ?").get(id, userId) as unknown as Row | undefined;
  if (!row) return { ok: false, error: "Address not found.", status: 404 };
  if (row.confirmed_at !== null) return { ok: false, error: "That address is already confirmed.", status: 409 };
  const wait = (row.confirm_sent_at ?? 0) + CONFIRM_RESEND_SECONDS * 1000 - now;
  if (wait > 0) return { ok: false, error: `You can send another link in ${Math.ceil(wait / 1000)} seconds.`, status: 429 };
  const token = randomBytes(32).toString("base64url");
  db()
    .prepare("UPDATE alert_emails SET confirm_hash = ?, confirm_expires = ?, confirm_sent_at = ? WHERE id = ?")
    .run(sha256(token), now + CONFIRM_DAYS * 86_400_000, now, id);
  return { ok: true, email: row.email, token };
}

/** Confirms an address from its link. Each link works once, and only until it expires. */
export function confirmAlertEmail(token: string, now = Date.now()): { email: string } | null {
  if (!token || token.length > 100) return null;
  const row = db().prepare("SELECT * FROM alert_emails WHERE confirm_hash = ?").get(sha256(token)) as unknown as Row | undefined;
  if (!row || (row.confirm_expires ?? 0) < now) return null;
  db().prepare("UPDATE alert_emails SET confirmed_at = ?, confirm_hash = NULL, confirm_expires = NULL WHERE id = ?").run(now, row.id);
  return { email: row.email };
}

export function setAlertEmailEnabled(id: number, userId: number, enabled: boolean): boolean {
  return Number(db().prepare("UPDATE alert_emails SET enabled = ? WHERE id = ? AND user_id = ?").run(enabled ? 1 : 0, id, userId).changes) > 0;
}

export function removeAlertEmail(id: number, userId: number): boolean {
  return Number(db().prepare("DELETE FROM alert_emails WHERE id = ? AND user_id = ?").run(id, userId).changes) > 0;
}

// ---------- the "stop these emails" link ----------

// Signed over the row and its address (and when it was added), so a link from an old email can never
// remove a different address that later reuses the same row number.
const stopMac = (id: number, email: string, createdAt: number) =>
  createHmac("sha256", secret()).update(`alert-email-stop:${id}:${email}:${createdAt}`).digest("base64url");

/** Goes in every alert sent to an added address, so whoever reads it can stop them without logging in. */
export function stopToken(id: number): string | null {
  const row = db().prepare("SELECT email, created_at FROM alert_emails WHERE id = ?").get(id) as { email: string; created_at: number } | undefined;
  return row ? `${id}.${stopMac(id, row.email, row.created_at)}` : null;
}

export function stopByToken(token: string): { email: string } | null {
  const [idText, mac] = token.split(".");
  const id = Number(idText);
  if (!Number.isInteger(id) || id <= 0 || !mac) return null;
  const row = db().prepare("SELECT email, created_at FROM alert_emails WHERE id = ?").get(id) as { email: string; created_at: number } | undefined;
  if (!row) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(stopMac(id, row.email, row.created_at));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  db().prepare("DELETE FROM alert_emails WHERE id = ?").run(id);
  return { email: row.email };
}

// ---------- sending ----------

/** The addresses an alert goes to right now: the switched-on ones, and only confirmed added addresses. */
export function activeRecipients(userId: number): { email: string; extraId: number | null }[] {
  const r = listRecipients(userId);
  if (!r) return [];
  const list: { email: string; extraId: number | null }[] = r.account.enabled ? [{ email: r.account.email, extraId: null }] : [];
  for (const e of r.extras) if (e.enabled && e.confirmed) list.push({ email: e.email, extraId: e.id });
  return list;
}

/**
 * Emails an alert or update to every address the account has switched on. Each address gets its own
 * copy, so nobody sees the others. Returns how many went out (0 if every address is switched off).
 * Throws only if there was someone to send to and every send failed, so callers can retry.
 */
export async function emailRecipients(userId: number, mail: Omit<Mail, "to">): Promise<number> {
  const recipients = activeRecipients(userId);
  const owner = recipients.length ? listRecipients(userId)?.account.email : null;
  let sent = 0;
  let lastError: unknown = null;
  for (const r of recipients) {
    const text =
      r.extraId === null
        ? mail.text
        : `${mail.text}\n\n--\nYou're getting this because ${owner} added this address to their Site Monitors alerts.\n` +
          `To stop getting them: ${appUrl()}/stop-emails?token=${stopToken(r.extraId) ?? ""}`;
    try {
      await sendMail({ to: r.email, subject: mail.subject, text });
      sent++;
    } catch (err) {
      lastError = err;
      console.error("alert email failed", err);
    }
  }
  if (recipients.length && !sent) throw lastError instanceof Error ? lastError : new Error("Every alert email failed.");
  return sent;
}

/** Asks a newly added address to confirm it wants alerts. */
export async function sendConfirmationLink(ownerEmail: string, email: string, token: string): Promise<void> {
  await sendMail({
    to: email,
    subject: "Confirm website alerts from Site Monitors",
    text:
      `${ownerEmail} wants to send alerts about their websites to this address: when a site goes down, or an SSL certificate ` +
      `or domain is about to expire.\n\n` +
      `To start getting them, confirm here:\n${appUrl()}/confirm-email?token=${token}\n\n` +
      `This link works for ${CONFIRM_DAYS} days. If you don't know ${ownerEmail} or don't want these emails, ignore this ` +
      `message and you won't hear from us again.`,
  });
}
