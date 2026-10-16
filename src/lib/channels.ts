import { db } from "./db";
import { entitlementsFor } from "./entitlements";
import { open, seal } from "./secret-box";
import { type ChannelKind, type DeliveryResult, type Message, deliver, maskWebhook, parseWebhookUrl } from "./webhooks";

export const MAX_CHANNELS = 5;

interface ChannelRow {
  id: number;
  user_id: number;
  kind: ChannelKind;
  name: string;
  url_enc: string;
  created_at: number;
  last_attempt_at: number | null;
  last_ok_at: number | null;
  last_error: string | null;
}

export interface ChannelView {
  id: number;
  kind: ChannelKind;
  name: string;
  /** Enough to recognise the webhook, never the whole secret address. */
  hint: string;
  createdAt: number;
  lastAttemptAt: number | null;
  lastOkAt: number | null;
  lastError: string | null;
}

function view(row: ChannelRow): ChannelView {
  let hint = row.kind === "slack" ? "hooks.slack.com/…" : "discord.com/…";
  try {
    hint = maskWebhook(row.kind, open(row.url_enc));
  } catch {
    // Can't be decrypted (SESSION_SECRET changed). Show a generic hint; sending to it will fail and say so.
  }
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    hint,
    createdAt: row.created_at,
    lastAttemptAt: row.last_attempt_at,
    lastOkAt: row.last_ok_at,
    lastError: row.last_error,
  };
}

export function listChannels(userId: number): ChannelView[] {
  return (db().prepare("SELECT * FROM notification_channels WHERE user_id = ? ORDER BY created_at DESC, id DESC").all(userId) as unknown as ChannelRow[]).map(view);
}

export function countChannels(userId: number): number {
  return (db().prepare("SELECT COUNT(*) AS c FROM notification_channels WHERE user_id = ?").get(userId) as { c: number }).c;
}

/** Saves a channel. The address must already have been validated by the caller. */
export function addChannel(userId: number, kind: ChannelKind, name: string, url: string): number {
  const res = db()
    .prepare("INSERT INTO notification_channels (user_id, kind, name, url_enc, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, kind, name, seal(url), Date.now());
  return Number(res.lastInsertRowid);
}

export function removeChannel(id: number, userId: number): boolean {
  return Number(db().prepare("DELETE FROM notification_channels WHERE id = ? AND user_id = ?").run(id, userId).changes) > 0;
}

function recordResult(id: number, result: DeliveryResult) {
  const now = Date.now();
  db()
    .prepare("UPDATE notification_channels SET last_attempt_at = ?, last_ok_at = CASE WHEN ? THEN ? ELSE last_ok_at END, last_error = ? WHERE id = ?")
    .run(now, result.ok ? 1 : 0, now, result.error, id);
}

/** Sends one message to a single channel and records how it went. */
export async function sendToChannel(id: number, userId: number, message: Message): Promise<DeliveryResult | null> {
  const row = db().prepare("SELECT * FROM notification_channels WHERE id = ? AND user_id = ?").get(id, userId) as unknown as ChannelRow | undefined;
  if (!row) return null;
  let result: DeliveryResult;
  try {
    result = await deliver(row.kind, open(row.url_enc), message);
  } catch {
    result = { ok: false, error: "This channel's saved address couldn't be read. Remove it and add it again." };
  }
  recordResult(row.id, result);
  return result;
}

/**
 * Sends an alert to every channel the user has set up, if their plan includes them. Best effort: a
 * broken webhook is recorded against that channel and never stops the email or the other channels.
 */
export async function sendAlertToChannels(userId: number, plan: string, message: Message): Promise<void> {
  if (!entitlementsFor(plan).integrations) return;
  const rows = db().prepare("SELECT id FROM notification_channels WHERE user_id = ?").all(userId) as { id: number }[];
  await Promise.all(rows.map((r) => sendToChannel(r.id, userId, message).catch((err) => console.error(`channel ${r.id} failed`, err))));
}

export { parseWebhookUrl };
