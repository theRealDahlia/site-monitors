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

  status_public: number;
  status_slug: string | null;
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
export function dueMonitors(now: number, limit: number): (MonitorRow & { owner_email: string; owner_plan: string })[] {
  return db()
    .prepare(
      `SELECT m.*, u.email AS owner_email, u.plan AS owner_plan FROM monitors m JOIN users u ON u.id = m.user_id
       WHERE m.up_due_at <= ? OR m.ssl_due_at <= ? OR m.dom_due_at <= ?
       ORDER BY MIN(m.up_due_at, m.ssl_due_at, m.dom_due_at) LIMIT ?`,
    )
    .all(now, now, now, limit) as unknown as (MonitorRow & { owner_email: string; owner_plan: string })[];
}

/** A monitor with its owner's email, read fresh. Used right before running checks so alerts never use stale state. */
export function getMonitorWithOwner(id: number): (MonitorRow & { owner_email: string; owner_plan: string }) | undefined {
  return db()
    .prepare("SELECT m.*, u.email AS owner_email, u.plan AS owner_plan FROM monitors m JOIN users u ON u.id = m.user_id WHERE m.id = ?")
    .get(id) as unknown as (MonitorRow & { owner_email: string; owner_plan: string }) | undefined;
}

// ---------- events ----------

export interface EventRow {
  id: number;
  monitor_id: number | null;
  host: string;
  kind: string;
  message: string;
  /** Longer text shown under the message, for notifications that carry more than one line. */
  details: string | null;
  emailed: number;
  created_at: number;
}

export function addEvent(event: {
  userId: number;
  /** The monitor this is about. May no longer exist by the time anyone reads it. */
  monitorId: number | null;
  host: string;
  kind: string;
  message: string;
  emailed: boolean;
  details?: string;
  at?: number;
}): void {
  db()
    .prepare(
      "INSERT INTO monitor_events (user_id, monitor_id, host, kind, message, details, emailed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(event.userId, event.monitorId, event.host, event.kind, event.message, event.details ?? null, event.emailed ? 1 : 0, event.at ?? Date.now());
}

export function recentEvents(userId: number, limit: number): EventRow[] {
  return db()
    .prepare(
      `SELECT id, monitor_id, host, kind, message, details, emailed, created_at
       FROM monitor_events WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
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

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Raw checks older than this are folded into hourly totals. */
const RAW_KEEP_MS = 48 * HOUR_MS;

/** Checks and successes since a time, counting both recent raw checks and older hourly totals. */
export function uptimeSince(monitorId: number, since: number): { total: number; ok: number } {
  const conn = db();
  const raw = conn
    .prepare("SELECT COUNT(*) AS total, COALESCE(SUM(ok), 0) AS ok FROM uptime_checks WHERE monitor_id = ? AND at >= ?")
    .get(monitorId, since) as { total: number; ok: number };
  const hourly = conn
    .prepare("SELECT COALESCE(SUM(total), 0) AS total, COALESCE(SUM(ok), 0) AS ok FROM uptime_hourly WHERE monitor_id = ? AND hour >= ?")
    .get(monitorId, Math.floor(since / HOUR_MS) * HOUR_MS) as { total: number; ok: number };
  return { total: raw.total + hourly.total, ok: raw.ok + hourly.ok };
}

/** One entry per UTC day, oldest first, for the days since `since`. Days with no checks have total 0. */
export function uptimeByDay(monitorId: number, since: number): { day: number; total: number; ok: number }[] {
  const rows = db()
    .prepare(
      `SELECT day, SUM(total) AS total, SUM(ok) AS ok FROM (
         SELECT (at / ${DAY_MS}) * ${DAY_MS} AS day, COUNT(*) AS total, SUM(ok) AS ok
           FROM uptime_checks WHERE monitor_id = ? AND at >= ? GROUP BY day
         UNION ALL
         SELECT (hour / ${DAY_MS}) * ${DAY_MS} AS day, SUM(total) AS total, SUM(ok) AS ok
           FROM uptime_hourly WHERE monitor_id = ? AND hour >= ? GROUP BY day
       ) GROUP BY day ORDER BY day`,
    )
    .all(monitorId, since, monitorId, Math.floor(since / DAY_MS) * DAY_MS) as { day: number; total: number; ok: number }[];
  return rows;
}

/**
 * Folds raw checks older than two days into hourly totals, so a one-minute check on 25 sites
 * doesn't pile up tens of thousands of rows a day. Only whole hours are moved, so an hour is
 * never split between the two tables. All or nothing.
 */
export function rollupHistory(now: number): void {
  const cut = Math.floor((now - RAW_KEEP_MS) / HOUR_MS) * HOUR_MS;
  const conn = db();
  conn.exec("BEGIN");
  try {
    conn
      .prepare(
        `INSERT INTO uptime_hourly (monitor_id, hour, total, ok)
         SELECT monitor_id, (at / ${HOUR_MS}) * ${HOUR_MS}, COUNT(*), SUM(ok) FROM uptime_checks WHERE at < ?
         GROUP BY monitor_id, (at / ${HOUR_MS})
         ON CONFLICT (monitor_id, hour) DO UPDATE SET total = total + excluded.total, ok = ok + excluded.ok`,
      )
      .run(cut);
    conn.prepare("DELETE FROM uptime_checks WHERE at < ?").run(cut);
    conn.exec("COMMIT");
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

export function pruneHistory(before: number): void {
  const conn = db();
  conn.prepare("DELETE FROM monitor_events WHERE created_at < ?").run(before);
  // Hourly totals and incidents back the status page's 30-day view, so they outlive the raw checks.
  const longAgo = Date.now() - 95 * DAY_MS;
  conn.prepare("DELETE FROM uptime_hourly WHERE hour < ?").run(longAgo);
  conn.prepare("DELETE FROM monitor_incidents WHERE started_at < ?").run(longAgo);
}

// ---------- incidents ----------

export interface IncidentRow {
  id: number;
  started_at: number;
  ended_at: number | null;
  error: string | null;
}

/** Starts an incident unless one is already open for this monitor, so a retried alert can't duplicate it. */
export function openIncident(monitorId: number, startedAt: number, error: string | null): void {
  const conn = db();
  const open = conn.prepare("SELECT id FROM monitor_incidents WHERE monitor_id = ? AND ended_at IS NULL").get(monitorId);
  if (!open) conn.prepare("INSERT INTO monitor_incidents (monitor_id, started_at, error) VALUES (?, ?, ?)").run(monitorId, startedAt, error);
}

export function closeIncident(monitorId: number, endedAt: number): void {
  db().prepare("UPDATE monitor_incidents SET ended_at = ? WHERE monitor_id = ? AND ended_at IS NULL").run(endedAt, monitorId);
}

/** When the current outage began, or null if there isn't one. This is what a status page treats as "down". */
export function openIncidentSince(monitorId: number): number | null {
  const row = db().prepare("SELECT started_at FROM monitor_incidents WHERE monitor_id = ? AND ended_at IS NULL").get(monitorId) as { started_at: number } | undefined;
  return row?.started_at ?? null;
}

export function recentIncidents(monitorId: number, since: number, limit: number): IncidentRow[] {
  return db()
    .prepare("SELECT id, started_at, ended_at, error FROM monitor_incidents WHERE monitor_id = ? AND started_at >= ? ORDER BY started_at DESC LIMIT ?")
    .all(monitorId, since, limit) as unknown as IncidentRow[];
}

// ---------- public status page ----------

/** Turns a monitor's public status page on or off. The first time it's on, it gets a random address that then never changes. */
export function setStatusPage(id: number, userId: number, enabled: boolean, newSlug: () => string): { slug: string | null } | null {
  const conn = db();
  const row = conn.prepare("SELECT status_slug FROM monitors WHERE id = ? AND user_id = ?").get(id, userId) as { status_slug: string | null } | undefined;
  if (!row) return null;

  let slug = row.status_slug;
  if (enabled && !slug) {
    for (let attempt = 0; attempt < 5 && !slug; attempt++) {
      const candidate = newSlug();
      try {
        conn.prepare("UPDATE monitors SET status_slug = ? WHERE id = ? AND user_id = ?").run(candidate, id, userId);
        slug = candidate;
      } catch (err) {
        if ((err as { errcode?: number }).errcode !== 2067) throw err; // slug collision: try another
      }
    }
    if (!slug) throw new Error("Couldn't generate a status page address.");
  }
  conn.prepare("UPDATE monitors SET status_public = ? WHERE id = ? AND user_id = ?").run(enabled ? 1 : 0, id, userId);
  return { slug };
}

/** The monitor behind a public status page, only if its owner has turned the page on AND their plan includes it. */
export function getPublicMonitor(slug: string): (MonitorRow & { owner_plan: string }) | undefined {
  return db()
    .prepare("SELECT m.*, u.plan AS owner_plan FROM monitors m JOIN users u ON u.id = m.user_id WHERE m.status_slug = ? AND m.status_public = 1")
    .get(slug) as unknown as (MonitorRow & { owner_plan: string }) | undefined;
}
