import { createHash, randomInt } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Target } from "./alert-targets";
import { db } from "./db";
import { entitlementsFor } from "./entitlements";

// Outage alerts by text message and phone call (Pro), sent through Twilio (https://www.twilio.com) when
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set. Without them, development writes each text or call
// to data/outbox.log instead, and production says texts aren't set up.
//
// Each one costs money, so phones only get outage alerts (down, back up, escalated), and each account has a monthly
// limit. A number only gets alerts after someone has typed in the code we texted to it.

export const MAX_PHONES = 3;
export const PHONE_MODES = ["sms", "call", "both"] as const;
export type PhoneMode = (typeof PHONE_MODES)[number];
const CODE_MINUTES = 10;
const CODE_ATTEMPTS = 5;
export const CODE_RESEND_SECONDS = 60;
const LABEL_MAX = 40;

interface Row {
  id: number;
  user_id: number;
  number: string;
  label: string;
  mode: PhoneMode;
  verified_at: number | null;
  code_hash: string | null;
  code_expires: number | null;
  code_attempts: number;
  code_sent_at: number | null;
  created_at: number;
}

export interface PhoneView {
  id: number;
  number: string;
  label: string;
  mode: PhoneMode;
  verified: boolean;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const view = (r: Row): PhoneView => ({ id: r.id, number: r.number, label: r.label, mode: r.mode, verified: r.verified_at !== null });

/** Whether texts and calls can actually be sent from this server. */
export function phonesConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) || process.env.NODE_ENV !== "production";
}

/** A phone number in international form: "+" then the country code and number, 8 to 15 digits. Spaces and dashes are fine. */
export function parseNumber(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** Shows a number with most of it hidden, for lists and messages. */
export const maskNumber = (n: string) => `${n.slice(0, 3)}…${n.slice(-3)}`;

// ---------- sending ----------

type Send = typeof fetch;

async function twilio(kind: "Messages" | "Calls", fields: Record<string, string>, send: Send): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("Texts and calls aren't set up: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM.");
    const block = `\n---- ${kind === "Calls" ? "phone call" : "text message"} (not sent: no TWILIO_ACCOUNT_SID) ----\nTo: ${fields.To}\n\n${fields.Body ?? fields.Say}\n----\n`;
    console.log(block);
    const file = path.join(process.cwd(), "data", "outbox.log");
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, block);
    return;
  }
  const body = new URLSearchParams({ To: fields.To, From: from });
  if (kind === "Messages") body.set("Body", fields.Body);
  // A short spoken message, said twice in case the first is missed.
  else body.set("Twiml", `<Response><Say>${xml(fields.Say)}</Say><Pause length="1"/><Say>${xml(fields.Say)}</Say></Response>`);
  const res = await send(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/${kind}.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Twilio returned HTTP ${res.status}`);
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const sendSms = (to: string, text: string, send: Send = fetch) => twilio("Messages", { To: to, Body: text.slice(0, 600) }, send);
export const placeCall = (to: string, say: string, send: Send = fetch) => twilio("Calls", { To: to, Say: say.slice(0, 300) }, send);

// ---------- the monthly limit ----------

const monthOf = (now: number) => new Date(now).toISOString().slice(0, 7);

export function usage(userId: number, now = Date.now()): { sms: number; calls: number } {
  const row = db().prepare("SELECT sms, calls FROM phone_usage WHERE user_id = ? AND month = ?").get(userId, monthOf(now)) as { sms: number; calls: number } | undefined;
  return { sms: row?.sms ?? 0, calls: row?.calls ?? 0 };
}

/** Counts one text or call against this month's limit, if there's room. False means the limit is reached. */
function take(userId: number, plan: string, what: "sms" | "calls", now: number): boolean {
  const ent = entitlementsFor(plan);
  const limit = what === "sms" ? ent.smsPerMonth : ent.callsPerMonth;
  db().prepare("INSERT INTO phone_usage (user_id, month) VALUES (?, ?) ON CONFLICT DO NOTHING").run(userId, monthOf(now));
  const res = db().prepare(`UPDATE phone_usage SET ${what} = ${what} + 1 WHERE user_id = ? AND month = ? AND ${what} < ?`).run(userId, monthOf(now), limit);
  return Number(res.changes) > 0;
}

// ---------- the account's numbers ----------

export function listPhones(userId: number): PhoneView[] {
  return (db().prepare("SELECT * FROM phones WHERE user_id = ? ORDER BY created_at, id").all(userId) as unknown as Row[]).map(view);
}

/** Phones as alert destinations (see alert-targets.ts). Unverified ones get nothing. */
export function phoneTargets(userId: number): Target[] {
  return listPhones(userId).map((p) => ({
    id: `phone:${p.id}`,
    kind: p.mode === "call" ? "call" : "sms",
    label: `${p.label} (${maskNumber(p.number)}${p.mode === "both" ? ", text and call" : ""})`,
    active: p.verified,
  }));
}

export type PhoneResult = { ok: true; phone: PhoneView } | { ok: false; error: string; status: number };

/** Adds a number and texts it a code. Nothing else is sent to it until the code comes back. */
export async function addPhone(userId: number, input: { number?: unknown; label?: unknown; mode?: unknown }, now = Date.now(), send: Send = fetch): Promise<PhoneResult> {
  const number = parseNumber(input.number);
  if (!number) return { ok: false, error: "Enter the number with its country code, like +44 7700 900123.", status: 400 };
  const label = typeof input.label === "string" ? input.label.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, LABEL_MAX) : "";
  const mode = PHONE_MODES.includes(input.mode as PhoneMode) ? (input.mode as PhoneMode) : "sms";
  if (listPhones(userId).length >= MAX_PHONES) return { ok: false, error: `You can add up to ${MAX_PHONES} numbers.`, status: 409 };
  let id: number;
  try {
    id = Number(
      db()
        .prepare("INSERT INTO phones (user_id, number, label, mode, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(userId, number, label || "Phone", mode, now).lastInsertRowid,
    );
  } catch (err) {
    if ((err as { errcode?: number }).errcode === 2067) return { ok: false, error: "That number is already on your account.", status: 409 };
    throw err;
  }
  const sent = await sendCode(userId, id, now, send);
  if (!sent.ok) {
    db().prepare("DELETE FROM phones WHERE id = ?").run(id);
    return sent;
  }
  return sent;
}

/** Texts a fresh code to a number that isn't verified yet. */
export async function sendCode(userId: number, id: number, now = Date.now(), send: Send = fetch): Promise<PhoneResult> {
  const row = db().prepare("SELECT * FROM phones WHERE id = ? AND user_id = ?").get(id, userId) as unknown as Row | undefined;
  if (!row) return { ok: false, error: "Number not found.", status: 404 };
  if (row.verified_at) return { ok: true, phone: view(row) };
  if (row.code_sent_at && now - row.code_sent_at < CODE_RESEND_SECONDS * 1000) return { ok: false, error: "We've just sent a code. Wait a minute before asking for another.", status: 429 };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await sendSms(row.number, `Your Site Monitors code is ${code}. It confirms this number for outage alerts. If you didn't ask for it, ignore this message.`, send);
  } catch (err) {
    console.error("verification text failed", err);
    return { ok: false, error: "We couldn't text that number. Check it and try again.", status: 502 };
  }
  db()
    .prepare("UPDATE phones SET code_hash = ?, code_expires = ?, code_attempts = 0, code_sent_at = ? WHERE id = ?")
    .run(sha256(`${row.id}:${code}`), now + CODE_MINUTES * 60_000, now, row.id);
  return { ok: true, phone: view({ ...row, code_sent_at: now }) };
}

/** Checks the code someone typed in. A few wrong guesses use the code up. */
export function verifyPhone(userId: number, id: number, code: unknown, now = Date.now()): PhoneResult {
  const row = db().prepare("SELECT * FROM phones WHERE id = ? AND user_id = ?").get(id, userId) as unknown as Row | undefined;
  if (!row) return { ok: false, error: "Number not found.", status: 404 };
  if (row.verified_at) return { ok: true, phone: view(row) };
  const typed = typeof code === "string" ? code.replace(/\s/g, "") : "";
  if (!row.code_hash || !row.code_expires || row.code_expires < now || row.code_attempts >= CODE_ATTEMPTS) {
    return { ok: false, error: "That code has expired. Send a new one.", status: 410 };
  }
  db().prepare("UPDATE phones SET code_attempts = code_attempts + 1 WHERE id = ?").run(row.id);
  if (!/^\d{6}$/.test(typed) || sha256(`${row.id}:${typed}`) !== row.code_hash) {
    const left = CODE_ATTEMPTS - row.code_attempts - 1;
    return { ok: false, error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "That code isn't right. Send a new one.", status: 400 };
  }
  db().prepare("UPDATE phones SET verified_at = ?, code_hash = NULL, code_expires = NULL WHERE id = ?").run(now, row.id);
  return { ok: true, phone: view({ ...row, verified_at: now }) };
}

export function setPhoneMode(userId: number, id: number, mode: unknown): boolean {
  if (!PHONE_MODES.includes(mode as PhoneMode)) return false;
  return Number(db().prepare("UPDATE phones SET mode = ? WHERE id = ? AND user_id = ?").run(mode as string, id, userId).changes) > 0;
}

export function removePhone(userId: number, id: number): boolean {
  return Number(db().prepare("DELETE FROM phones WHERE id = ? AND user_id = ?").run(id, userId).changes) > 0;
}

// ---------- outage alerts ----------

/**
 * Texts and/or calls each verified number that should hear about an outage: those `only` names, or every verified
 * number when `only` is null. Each one counts against the month's limit; past it, nothing more goes out this month.
 * Returns what happened, for the activity log. Never throws.
 */
export async function alertPhones(
  userId: number,
  plan: string,
  only: Set<string> | null,
  message: { text: string; say: string },
  now = Date.now(),
  send: Send = fetch,
): Promise<{ sent: number; skipped: number }> {
  const ent = entitlementsFor(plan);
  if (!ent.smsPerMonth && !ent.callsPerMonth) return { sent: 0, skipped: 0 };
  const phones = (db().prepare("SELECT * FROM phones WHERE user_id = ? AND verified_at IS NOT NULL").all(userId) as unknown as Row[]).filter(
    (p) => !only || only.has(`phone:${p.id}`),
  );
  let sent = 0;
  let skipped = 0;
  for (const p of phones) {
    if (p.mode !== "call") {
      if (!take(userId, plan, "sms", now)) skipped++;
      else
        await sendSms(p.number, message.text, send).then(
          () => sent++,
          (err) => console.error(`outage text to ${maskNumber(p.number)} failed`, err),
        );
    }
    if (p.mode !== "sms") {
      if (!take(userId, plan, "calls", now)) skipped++;
      else
        await placeCall(p.number, message.say, send).then(
          () => sent++,
          (err) => console.error(`outage call to ${maskNumber(p.number)} failed`, err),
        );
    }
  }
  return { sent, skipped };
}
