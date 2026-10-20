import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { brandingFor } from "./branding";
import { lookupDomainFor } from "./custom-domains";
import { db } from "./db";
import { entitlementsFor } from "./entitlements";
import { appUrl, sendMail } from "./mail";
import { secret } from "./secret";

// People who asked to be emailed about a status page (a Pro feature). It's double opt-in: an address gets nothing
// until someone clicks the confirmation link we sent to it, so this can't be used to send email to strangers. Every
// email carries a link that stops them, which works without logging in.
//
// Links point at the page's own address: the owner's domain when the page is white-labelled there, otherwise ours.

export const MAX_SUBSCRIBERS = 2000;
const CONFIRM_DAYS = 7;
export const RESEND_SECONDS = 60;
const DAY = 86_400_000;

interface Row {
  id: number;
  monitor_id: number;
  email: string;
  confirmed_at: number | null;
  confirm_hash: string | null;
  confirm_expires: number | null;
  confirm_sent_at: number | null;
  created_at: number;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Where a status page's visitors see it, for links in emails: its custom domain if it has one, otherwise /status/<slug>. */
export function pageAddress(monitor: { id: number; user_id: number; status_slug: string | null; owner_plan: string }): string {
  const domain = entitlementsFor(monitor.owner_plan).whiteLabel ? lookupDomainFor(monitor.id) : null;
  return domain ? `https://${domain}` : `${appUrl()}/status/${monitor.status_slug}`;
}

/** Base address for subscription links, on the same host visitors see the page on. */
const linkBase = (monitor: Parameters<typeof pageAddress>[0]) => {
  const page = pageAddress(monitor);
  return page.startsWith(appUrl()) ? appUrl() : page;
};

/** What the page is called in emails: the owner's brand name when they have one, otherwise the site. */
export function pageName(monitor: { user_id: number; host: string; owner_plan: string }): string {
  const name = brandingFor(monitor.user_id, monitor.owner_plan).name;
  return name ? `${name} (${monitor.host})` : monitor.host;
}

// ---------- signing up ----------

export type SubscribeResult = { ok: true; sent: boolean } | { ok: false; error: string; status: number };

/**
 * Starts a subscription and emails a confirmation link. To the person asking, the answer is the same whether the
 * address was new, waiting or already subscribed, so this can't be used to find out who's subscribed.
 */
export async function subscribe(
  monitor: { id: number; user_id: number; host: string; status_slug: string | null; owner_plan: string },
  email: string,
  now = Date.now(),
): Promise<SubscribeResult> {
  const conn = db();
  const existing = conn.prepare("SELECT * FROM status_subscribers WHERE monitor_id = ? AND email = ?").get(monitor.id, email) as unknown as Row | undefined;
  if (existing?.confirmed_at) return { ok: true, sent: false };
  if (existing?.confirm_sent_at && now - existing.confirm_sent_at < RESEND_SECONDS * 1000) return { ok: true, sent: false };
  if (!existing) {
    const count = (conn.prepare("SELECT COUNT(*) AS c FROM status_subscribers WHERE monitor_id = ?").get(monitor.id) as { c: number }).c;
    if (count >= MAX_SUBSCRIBERS) return { ok: false, error: "This page can't take more subscribers right now.", status: 409 };
  }

  const token = randomBytes(24).toString("base64url");
  if (existing) {
    conn.prepare("UPDATE status_subscribers SET confirm_hash = ?, confirm_expires = ?, confirm_sent_at = ? WHERE id = ?").run(sha256(token), now + CONFIRM_DAYS * DAY, now, existing.id);
  } else {
    conn
      .prepare("INSERT INTO status_subscribers (monitor_id, email, confirm_hash, confirm_expires, confirm_sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(monitor.id, email, sha256(token), now + CONFIRM_DAYS * DAY, now, now);
  }

  const name = pageName(monitor);
  await sendMail({
    to: email,
    subject: `Confirm status updates for ${name}`,
    text:
      `Someone (hopefully you) asked to get an email whenever there's news on the status page for ${name}: an outage, ` +
      `an incident update, or scheduled maintenance.\n\n` +
      `To start getting them, confirm here:\n${linkBase(monitor)}/api/subscriptions/confirm.${token}\n\n` +
      `This link works for ${CONFIRM_DAYS} days. If you didn't ask for this, ignore this message and you won't hear from us again.`,
  });
  return { ok: true, sent: true };
}

/** Confirms a subscription from its emailed link. Null when the link is unknown, used or expired. */
export function confirmSubscription(token: string, now = Date.now()): { email: string; monitorId: number } | null {
  const row = db().prepare("SELECT * FROM status_subscribers WHERE confirm_hash = ?").get(sha256(token)) as unknown as Row | undefined;
  if (!row || !row.confirm_expires || row.confirm_expires < now) return null;
  db().prepare("UPDATE status_subscribers SET confirmed_at = ?, confirm_hash = NULL, confirm_expires = NULL WHERE id = ?").run(now, row.id);
  return { email: row.email, monitorId: row.monitor_id };
}

// ---------- stopping ----------

// The stop link is signed rather than stored, and covers the address and when it signed up, so it can't be used to
// remove a different subscriber that later reuses the same row number.
const stopMac = (id: number, email: string, createdAt: number) =>
  createHmac("sha256", secret()).update(`status-sub-stop:${id}:${email}:${createdAt}`).digest("base64url");

export function stopToken(row: Pick<Row, "id" | "email" | "created_at">): string {
  return `${row.id}.${stopMac(row.id, row.email, row.created_at)}`;
}

/** Looks up a stop link without acting on it, so the page can say what it's about before anyone clicks. */
export function checkStopToken(token: string): Row | null {
  const [idText, mac] = token.split(".");
  const id = Number(idText);
  if (!Number.isInteger(id) || id <= 0 || !mac) return null;
  const row = db().prepare("SELECT * FROM status_subscribers WHERE id = ?").get(id) as unknown as Row | undefined;
  if (!row) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(stopMac(row.id, row.email, row.created_at));
  return a.length === b.length && timingSafeEqual(a, b) ? row : null;
}

export function unsubscribe(token: string): { email: string } | null {
  const row = checkStopToken(token);
  if (!row) return null;
  db().prepare("DELETE FROM status_subscribers WHERE id = ?").run(row.id);
  return { email: row.email };
}

// ---------- the owner's view ----------

export function listSubscribers(monitorId: number): { id: number; email: string; confirmed: boolean; createdAt: number }[] {
  return (db().prepare("SELECT * FROM status_subscribers WHERE monitor_id = ? ORDER BY created_at DESC, id DESC").all(monitorId) as unknown as Row[]).map((r) => ({
    id: r.id,
    email: r.email,
    confirmed: r.confirmed_at !== null,
    createdAt: r.created_at,
  }));
}

export function removeSubscriber(monitorId: number, id: number): boolean {
  return Number(db().prepare("DELETE FROM status_subscribers WHERE id = ? AND monitor_id = ?").run(id, monitorId).changes) > 0;
}

// ---------- sending ----------

/**
 * Emails every confirmed subscriber of a status page, each their own copy with their own stop link. Only for pages
 * that are switched on, on a plan with subscribers. Never throws: a failed send is logged and the rest go on.
 */
export async function notifySubscribers(
  monitor: { id: number; user_id: number; host: string; status_slug: string | null; status_public: number; owner_plan: string },
  message: { subject: string; text: string },
): Promise<number> {
  if (!monitor.status_public || !monitor.status_slug || !entitlementsFor(monitor.owner_plan).statusSubscribers) return 0;
  const rows = db().prepare("SELECT * FROM status_subscribers WHERE monitor_id = ? AND confirmed_at IS NOT NULL").all(monitor.id) as unknown as Row[];
  const page = pageAddress(monitor);
  const base = linkBase(monitor);
  const name = pageName(monitor);
  let sent = 0;
  for (const r of rows) {
    try {
      await sendMail({
        to: r.email,
        subject: `[${name}] ${message.subject}`,
        text:
          `${message.text}\n\nSee the status page: ${page}\n\n--\n` +
          `You're getting this because you subscribed to status updates for ${name}.\n` +
          `To stop getting them: ${base}/api/subscriptions/stop.${stopToken(r)}`,
      });
      sent++;
    } catch (err) {
      console.error(`status update to a subscriber of monitor ${monitor.id} failed`, err);
    }
  }
  return sent;
}

// ---------- what subscribers are told ----------

const STATE_WORDS: Record<string, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};
const utc = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });

/** The email for an incident being posted or updated, or maintenance being scheduled or finished. */
export function noticeMessage(
  n: { kind: "incident" | "maintenance"; title: string; state: string; startsAt: number | null; endsAt: number | null; updates: { message: string }[] },
  event: "created" | "updated" | "finished",
): { subject: string; text: string } {
  const latest = n.updates[0]?.message ?? "";
  if (n.kind === "maintenance") {
    const times = n.startsAt && n.endsAt ? `${utc(n.startsAt)} to ${utc(n.endsAt)}` : "";
    if (event === "finished") {
      const cancelled = n.state === "cancelled";
      return { subject: `Maintenance ${cancelled ? "cancelled" : "complete"}: ${n.title}`, text: cancelled ? `The maintenance planned for ${times} has been cancelled.` : `The maintenance "${n.title}" is complete.` };
    }
    return { subject: `Scheduled maintenance: ${n.title}`, text: `Maintenance is planned for ${times}.${latest ? `\n\n${latest}` : ""}` };
  }
  const state = STATE_WORDS[n.state] ?? n.state;
  return { subject: `${n.state === "resolved" ? "Resolved" : event === "created" ? "Incident" : "Update"}: ${n.title} (${state})`, text: latest };
}
