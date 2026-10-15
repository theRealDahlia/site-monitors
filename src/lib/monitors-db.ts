import { db } from "./db";

export interface MonitorRow {
  id: number;
  user_id: number;
  host: string;
  created_at: number;

  up_status: "pending" | "up" | "down";
  up_code: number | null;
  up_ms: number | null;
  up_error: string | null;
  up_checked_at: number | null;
  up_due_at: number;
  up_failures: number;
  down_since: number | null;
  down_alerted: number;

  ssl_status: "pending" | "valid" | "expiring" | "expired" | "invalid" | "unreachable";
  ssl_expires_at: number | null;
  ssl_days: number | null;
  ssl_issuer: string | null;
  ssl_problems: string | null; // JSON array of strings
  ssl_error: string | null;
  ssl_checked_at: number | null;
  ssl_due_at: number;
  ssl_alert_bucket: number | null;
  ssl_problem_alerted: string | null;

  dom_status: "pending" | "ok" | "expiring" | "expired" | "unknown" | "unsupported" | "error";
  dom_name: string | null;
  dom_expires_at: number | null;
  dom_days: number | null;
  dom_registrar: string | null;
  dom_note: string | null;
  dom_checked_at: number | null;
  dom_due_at: number;
  dom_alert_bucket: number | null;

  last_manual_check_at: number | null;
}

export type MonitorUpdate = Partial<Omit<MonitorRow, "id" | "user_id" | "host" | "created_at">>;

const UPDATABLE = new Set<string>([
  "up_status", "up_code", "up_ms", "up_error", "up_checked_at", "up_due_at", "up_failures", "down_since", "down_alerted",
  "ssl_status", "ssl_expires_at", "ssl_days", "ssl_issuer", "ssl_problems", "ssl_error", "ssl_checked_at", "ssl_due_at",
  "ssl_alert_bucket", "ssl_problem_alerted",
  "dom_status", "dom_name", "dom_expires_at", "dom_days", "dom_registrar", "dom_note", "dom_checked_at", "dom_due_at",
  "dom_alert_bucket", "last_manual_check_at",
]);

export function listMonitors(userId: number): MonitorRow[] {
  return db().prepare("SELECT * FROM monitors WHERE user_id = ? ORDER BY created_at DESC, id DESC").all(userId) as unknown as MonitorRow[];
}

export function getMonitor(id: number, userId: number): MonitorRow | undefined {
  return db().prepare("SELECT * FROM monitors WHERE id = ? AND user_id = ?").get(id, userId) as unknown as MonitorRow | undefined;
}

export function countMonitors(userId: number): number {
  return (db().prepare("SELECT COUNT(*) AS c FROM monitors WHERE user_id = ?").get(userId) as { c: number }).c;
}

/** A new monitor isn't due for this long, so the scheduler can't start on it while the request that created it is still running its first checks. */
const FIRST_CHECK_GRACE_MS = 2 * 60 * 1000;

/** Returns the new monitor's id, or null if this user already watches that host. */
export function insertMonitor(userId: number, host: string, now: number): number | null {
  const due = now + FIRST_CHECK_GRACE_MS;
  try {
    const res = db()
      .prepare("INSERT INTO monitors (user_id, host, created_at, up_due_at, ssl_due_at, dom_due_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(userId, host, now, due, due, due);
    return Number(res.lastInsertRowid);
  } catch (err) {
    if ((err as { errcode?: number }).errcode === 2067) return null; // UNIQUE constraint
    throw err;
  }
}

/**
 * Points a monitor at a different hostname and wipes everything learned about the old one, so the
 * next checks start clean: no stale results, no "already alerted" bookkeeping, no old uptime history.
 * Returns "duplicate" if the user already watches the new host.
 */
export function retargetMonitor(id: number, userId: number, host: string, now: number): "ok" | "duplicate" | "missing" {
  try {
    const res = db()
      .prepare(
        `UPDATE monitors SET host = ?,
           up_status = 'pending', up_code = NULL, up_ms = NULL, up_error = NULL, up_checked_at = NULL,
           up_due_at = ?, up_failures = 0, down_since = NULL, down_alerted = 0,
           ssl_status = 'pending', ssl_expires_at = NULL, ssl_days = NULL, ssl_issuer = NULL, ssl_problems = NULL,
           ssl_error = NULL, ssl_checked_at = NULL, ssl_due_at = ?, ssl_alert_bucket = NULL, ssl_problem_alerted = NULL,
           dom_status = 'pending', dom_name = NULL, dom_expires_at = NULL, dom_days = NULL, dom_registrar = NULL,
           dom_note = NULL, dom_checked_at = NULL, dom_due_at = ?, dom_alert_bucket = NULL,
           last_manual_check_at = NULL
         WHERE id = ? AND user_id = ?`,
      )
      .run(host, now, now, now, id, userId);
    if (Number(res.changes) === 0) return "missing";
    db().prepare("DELETE FROM uptime_checks WHERE monitor_id = ?").run(id);
    return "ok";
  } catch (err) {
    if ((err as { errcode?: number }).errcode === 2067) return "duplicate"; // UNIQUE (user_id, host)
    throw err;
  }
}

export function deleteMonitor(id: number, userId: number): boolean {
  return Number(db().prepare("DELETE FROM monitors WHERE id = ? AND user_id = ?").run(id, userId).changes) > 0;
}

export function updateMonitor(id: number, fields: MonitorUpdate): void {
  const keys = Object.keys(fields).filter((k) => UPDATABLE.has(k));
  if (keys.length === 0) return;
  const values = keys.map((k) => (fields as Record<string, unknown>)[k] ?? null);
  db()
    .prepare(`UPDATE monitors SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
    .run(...(values as (string | number | null)[]), id);
}

/** Monitors with at least one check due, oldest first, together with the owner's email. */
export function dueMonitors(now: number, limit: number): (MonitorRow & { owner_email: string })[] {
  return db()
    .prepare(
      `SELECT m.*, u.email AS owner_email FROM monitors m JOIN users u ON u.id = m.user_id
       WHERE m.up_due_at <= ? OR m.ssl_due_at <= ? OR m.dom_due_at <= ?
       ORDER BY MIN(m.up_due_at, m.ssl_due_at, m.dom_due_at) LIMIT ?`,
    )
    .all(now, now, now, limit) as unknown as (MonitorRow & { owner_email: string })[];
}

/** A monitor with its owner's email, read fresh. Used right before running checks so alerts never use stale state. */
export function getMonitorWithOwner(id: number): (MonitorRow & { owner_email: string }) | undefined {
  return db()
    .prepare("SELECT m.*, u.email AS owner_email FROM monitors m JOIN users u ON u.id = m.user_id WHERE m.id = ?")
    .get(id) as unknown as (MonitorRow & { owner_email: string }) | undefined;
}

// ---------- events ----------

export interface EventRow {
  id: number;
  monitor_id: number;
  host: string;
  kind: string;
  message: string;
  /** Longer text shown under the message, for notifications that carry more than one line. */
  details: string | null;
  emailed: number;
  created_at: number;
}

export function addEvent(
  monitorId: number,
  userId: number,
  kind: string,
  message: string,
  emailed: boolean,
  now: number,
  details?: string,
): void {
  db()
    .prepare("INSERT INTO monitor_events (monitor_id, user_id, kind, message, details, emailed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(monitorId, userId, kind, message, details ?? null, emailed ? 1 : 0, now);
}

export function recentEvents(userId: number, limit: number): EventRow[] {
  return db()
    .prepare(
      `SELECT e.id, e.monitor_id, m.host, e.kind, e.message, e.details, e.emailed, e.created_at
       FROM monitor_events e JOIN monitors m ON m.id = e.monitor_id
       WHERE e.user_id = ? ORDER BY e.created_at DESC, e.id DESC LIMIT ?`,
    )
    .all(userId, limit) as unknown as EventRow[];
}

export function countEmailsSince(userId: number, since: number): number {
  return (
    db().prepare("SELECT COUNT(*) AS c FROM monitor_events WHERE user_id = ? AND emailed = 1 AND created_at >= ?").get(userId, since) as {
      c: number;
    }
  ).c;
}

// ---------- uptime history ----------

export function recordUptime(monitorId: number, at: number, ok: boolean, ms: number | null): void {
  db().prepare("INSERT INTO uptime_checks (monitor_id, at, ok, ms) VALUES (?, ?, ?, ?)").run(monitorId, at, ok ? 1 : 0, ms);
}

export function uptimeSince(monitorId: number, since: number): { total: number; ok: number } {
  const row = db()
    .prepare("SELECT COUNT(*) AS total, COALESCE(SUM(ok), 0) AS ok FROM uptime_checks WHERE monitor_id = ? AND at >= ?")
    .get(monitorId, since) as { total: number; ok: number };
  return { total: row.total, ok: row.ok };
}

export function pruneHistory(before: number): void {
  db().prepare("DELETE FROM uptime_checks WHERE at < ?").run(before);
  db().prepare("DELETE FROM monitor_events WHERE created_at < ?").run(before);
}
