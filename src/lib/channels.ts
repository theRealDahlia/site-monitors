import { db } from "./db";
import { entitlementsFor } from "./entitlements";
import { open, seal } from "./secret-box";
import { type ChannelKind, type DeliveryResult, type Message, deliver, deliverSlackBot, maskWebhook, parseSlackBotTarget, parseWebhookUrl } from "./webhooks";

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
  enabled: number;
  via: ChannelVia;
}

/**
 * How a channel was connected:
 * - bot: Slack sign-in that created its own alerts channel; we post into it as the app
 * - oauth: a webhook from signing in (Discord, and Slack connections made before the alerts channel)
 * - manual: an older pasted webhook
 */
export type ChannelVia = "bot" | "oauth" | "manual";
const asVia = (value: string): ChannelVia => (value === "bot" || value === "oauth" ? value : "manual");

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
  /** Off means the channel is kept but gets no messages until it's switched back on. */
  enabled: boolean;
  via: ChannelVia;
}

function view(row: ChannelRow): ChannelView {
  let hint = row.kind === "slack" ? "hooks.slack.com/…" : "discord.com/…";
  try {
    hint = row.via === "bot" ? "Posts as the Site Monitors app" : maskWebhook(row.kind, open(row.url_enc));
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
    enabled: row.enabled === 1,
    via: asVia(row.via),
  };
}

export function listChannels(userId: number): ChannelView[] {
  return (db().prepare("SELECT * FROM notification_channels WHERE user_id = ? ORDER BY created_at DESC, id DESC").all(userId) as unknown as ChannelRow[]).map(view);
}

export function countChannels(userId: number): number {
  return (db().prepare("SELECT COUNT(*) AS c FROM notification_channels WHERE user_id = ?").get(userId) as { c: number }).c;
}

/** Saves a channel. The address must already have been validated by the caller. */
export function addChannel(userId: number, kind: ChannelKind, name: string, url: string, via: ChannelVia = "oauth"): number {
  const res = db()
    .prepare("INSERT INTO notification_channels (user_id, kind, name, url_enc, created_at, via) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, kind, name, seal(url), Date.now(), via);
  return Number(res.lastInsertRowid);
}

export function setChannelEnabled(id: number, userId: number, enabled: boolean): boolean {
  return Number(db().prepare("UPDATE notification_channels SET enabled = ? WHERE id = ? AND user_id = ?").run(enabled ? 1 : 0, id, userId).changes) > 0;
}

/**
 * Deletes a channel and returns what's needed to tidy up on the provider's side (the webhook address
 * and how it was connected), or null if the user has no such channel.
 */
export function removeChannel(id: number, userId: number): { kind: ChannelKind; url: string | null; via: ChannelVia } | null {
  const row = db().prepare("SELECT * FROM notification_channels WHERE id = ? AND user_id = ?").get(id, userId) as unknown as ChannelRow | undefined;
  if (!row) return null;
  db().prepare("DELETE FROM notification_channels WHERE id = ? AND user_id = ?").run(id, userId);
  let url: string | null = null;
  try {
    url = open(row.url_enc);
  } catch {
    // Can't be read any more; there's nothing to tidy up remotely.
  }
  return { kind: row.kind, url, via: asVia(row.via) };
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
    if (row.via === "bot") {
      const target = parseSlackBotTarget(open(row.url_enc));
      result = target ? await deliverSlackBot(target, message) : { ok: false, error: "This connection's saved details couldn't be read. Connect Slack again." };
    } else {
      result = await deliver(row.kind, open(row.url_enc), message);
    }
  } catch {
    result = { ok: false, error: "This channel's saved address couldn't be read. Remove it and add it again." };
  }
  recordResult(row.id, result);
  return result;
}

/**
 * Sends an alert to every channel the user has switched on, if their plan includes them. Best effort: a
 * broken webhook is recorded against that channel and never stops the email or the other channels.
 */
export async function sendAlertToChannels(userId: number, plan: string, message: Message): Promise<void> {
  if (!entitlementsFor(plan).integrations) return;
  const rows = db().prepare("SELECT id FROM notification_channels WHERE user_id = ? AND enabled = 1").all(userId) as { id: number }[];
  await Promise.all(rows.map((r) => sendToChannel(r.id, userId, message).catch((err) => console.error(`channel ${r.id} failed`, err))));
}

export { parseWebhookUrl };
