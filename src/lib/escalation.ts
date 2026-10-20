import { createHmac, timingSafeEqual } from "node:crypto";
import { readTargets } from "./alert-targets";
import { db } from "./db";
import { entitlementsFor } from "./entitlements";
import { appUrl } from "./mail";
import { secret } from "./secret";

// Escalation (Pro): when a monitor goes down, its alert goes out as usual. If nobody acknowledges it within the time
// the owner chose, the same news goes to the people named in their escalation rule ("tell the on-call phone after
// 15 minutes"). Acknowledging is one click, from the link in the alert or the monitor's page, and needs no login, so
// whoever reads the alert can do it.

export const ESCALATE_AFTER = [5, 10, 15, 30, 60].map((m) => m * 60_000);

export interface Policy {
  enabled: boolean;
  afterMs: number;
  targets: string[];
}

export const DEFAULT_POLICY: Policy = { enabled: false, afterMs: 15 * 60_000, targets: [] };

export function getPolicy(userId: number): Policy {
  const row = db().prepare("SELECT enabled, after_ms, targets FROM escalation_policies WHERE user_id = ?").get(userId) as
    | { enabled: number; after_ms: number; targets: string }
    | undefined;
  if (!row) return DEFAULT_POLICY;
  return { enabled: row.enabled === 1, afterMs: row.after_ms, targets: [...(readTargets(row.targets) ?? [])] };
}

export function setPolicy(userId: number, p: Policy): void {
  db()
    .prepare(
      `INSERT INTO escalation_policies (user_id, enabled, after_ms, targets, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, after_ms = excluded.after_ms, targets = excluded.targets, updated_at = excluded.updated_at`,
    )
    .run(userId, p.enabled ? 1 : 0, p.afterMs, JSON.stringify(p.targets), Date.now());
}

/** The rule that applies to an account right now: only when it's switched on and the plan includes it. */
export function activePolicy(userId: number, plan: string): Policy | null {
  if (!entitlementsFor(plan).escalation) return null;
  const p = getPolicy(userId);
  return p.enabled && p.targets.length ? p : null;
}

// ---------- acknowledging ----------

// The link is signed and names one outage (by when it started), so it can't acknowledge a later one.
const ackMac = (monitorId: number, downSince: number) => createHmac("sha256", secret()).update(`ack:${monitorId}:${downSince}`).digest("base64url");

export function ackLink(monitorId: number, downSince: number): string {
  return `${appUrl()}/api/ack/${monitorId}.${downSince}.${ackMac(monitorId, downSince)}`;
}

/** What an acknowledge link is about, if it's genuine. Doesn't act on it. */
export function readAckToken(token: string): { monitorId: number; downSince: number } | null {
  const [a, b, mac] = token.split(".");
  const monitorId = Number(a);
  const downSince = Number(b);
  if (!Number.isInteger(monitorId) || !Number.isInteger(downSince) || !mac) return null;
  const x = Buffer.from(mac);
  const y = Buffer.from(ackMac(monitorId, downSince));
  return x.length === y.length && timingSafeEqual(x, y) ? { monitorId, downSince } : null;
}

export type AckResult = "acknowledged" | "already" | "over";

/** Marks an outage as acknowledged, so nobody else is alerted about it. Only the outage still going on counts. */
export function acknowledge(monitorId: number, downSince: number | null, now = Date.now()): AckResult {
  const row = db().prepare("SELECT down_alerted, down_since, ack_at FROM monitors WHERE id = ?").get(monitorId) as
    | { down_alerted: number; down_since: number | null; ack_at: number | null }
    | undefined;
  if (!row || !row.down_alerted || (downSince !== null && row.down_since !== downSince)) return "over";
  if (row.ack_at) return "already";
  db().prepare("UPDATE monitors SET ack_at = ? WHERE id = ?").run(now, monitorId);
  return "acknowledged";
}

/** Outages whose alert has gone unacknowledged for longer than their owner's rule allows. */
export function dueEscalations(now: number): { id: number; user_id: number; owner_plan: string; after_ms: number; targets: string }[] {
  return db()
    .prepare(
      `SELECT m.id, m.user_id, u.plan AS owner_plan, p.after_ms, p.targets FROM monitors m
       JOIN users u ON u.id = m.user_id JOIN escalation_policies p ON p.user_id = m.user_id
       WHERE p.enabled = 1 AND m.down_alerted = 1 AND m.ack_at IS NULL AND m.escalated_at IS NULL
         AND m.down_alerted_at IS NOT NULL AND m.down_alerted_at + p.after_ms <= ?`,
    )
    .all(now) as { id: number; user_id: number; owner_plan: string; after_ms: number; targets: string }[];
}
