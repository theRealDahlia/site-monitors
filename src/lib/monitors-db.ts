import { db } from "./db";
import { ENTITLEMENTS } from "./entitlements";
import { type KindConfig, type MonitorKind, NEVER, SITE_CONFIG, newHeartbeatToken } from "./monitor-kinds";

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

  ai_status: "pending" | "ok" | "attention" | "problem" | "unknown";
  ai_result: string | null; // JSON, see ai-bots.ts
  ai_checked_at: number | null;
  ai_due_at: number;
  ai_alerted_sig: string | null;
  ai_pending_sig: string | null;

  last_manual_check_at: number | null;

  status_public: number;
  status_slug: string | null;

  kind: MonitorKind;
  url: string | null;
  port: number | null;
  keyword: string | null;
  keyword_mode: "contains" | "absent" | null;
  hb_token: string | null;
  hb_every_ms: number | null;
  hb_grace_ms: number | null;
  hb_last_ping: number | null;

  alert_targets: string | null;
  down_alerted_at: number | null;
  ack_at: number | null;
  escalated_at: number | null;

  scan_result: string | null;
  scan_checked_at: number | null;
  scan_due_at: number;
  dns_baseline: string | null;
  links_alerted: string | null;
}

export type MonitorUpdate = Partial<
  Omit<MonitorRow, "id" | "user_id" | "host" | "created_at" | "kind" | "url" | "port" | "keyword" | "keyword_mode" | "hb_token" | "hb_every_ms" | "hb_grace_ms" | "alert_targets">
>;

const UPDATABLE = new Set<string>([
  "up_status", "up_code", "up_ms", "up_error", "up_checked_at", "up_due_at", "up_failures", "down_since", "down_alerted",
  "ssl_status", "ssl_expires_at", "ssl_days", "ssl_issuer", "ssl_problems", "ssl_error", "ssl_checked_at", "ssl_due_at",
  "ssl_alert_bucket", "ssl_problem_alerted",
  "dom_status", "dom_name", "dom_expires_at", "dom_days", "dom_registrar", "dom_note", "dom_checked_at", "dom_due_at",
  "dom_alert_bucket", "last_manual_check_at",
  "ai_status", "ai_result", "ai_checked_at", "ai_due_at", "ai_alerted_sig", "ai_pending_sig",
  "hb_last_ping", "down_alerted_at", "ack_at", "escalated_at",
  "scan_result", "scan_checked_at", "scan_due_at", "dns_baseline", "links_alerted",
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

/**
 * Returns the new monitor's id, or null if this user already has a monitor with that label. Only a site gets the
 * SSL, domain and AI checks; for other kinds they're scheduled never to run.
 */
export function insertMonitor(userId: number, host: string, now: number, config: KindConfig = SITE_CONFIG): number | null {
  const due = now + FIRST_CHECK_GRACE_MS;
  const siteDue = config.kind === "site" ? due : NEVER;
  // A heartbeat isn't checked until it's had its full first interval to check in.
  const upDue = config.kind === "heartbeat" ? now + (config.hb_every_ms ?? 0) + (config.hb_grace_ms ?? 0) : due;
  try {
    const res = db()
      .prepare(
        `INSERT INTO monitors (user_id, host, created_at, up_due_at, ssl_due_at, dom_due_at, ai_due_at, scan_due_at,
           kind, url, port, keyword, keyword_mode, hb_token, hb_every_ms, hb_grace_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId, host, now, upDue, siteDue, siteDue, siteDue, siteDue,
        config.kind, config.url, config.port, config.keyword, config.keyword_mode,
        config.kind === "heartbeat" ? newHeartbeatToken() : null, config.hb_every_ms, config.hb_grace_ms,
      );
    return Number(res.lastInsertRowid);
  } catch (err) {
    if ((err as { errcode?: number }).errcode === 2067) return null; // UNIQUE constraint
    throw err;
  }
}

/**
 * Points a monitor at something new (another hostname, address, port or timetable) and wipes everything learned
 * about the old one, so the next checks start clean: no stale results, no "already alerted" bookkeeping, no old
 * uptime history. The kind itself never changes. Returns "duplicate" if the user already has a monitor with that label.
 */
export function retargetMonitor(id: number, userId: number, host: string, now: number, config: KindConfig = SITE_CONFIG): "ok" | "duplicate" | "missing" {
  const siteDue = config.kind === "site" ? now : NEVER;
  // Every kind is looked at again straight away. A heartbeat keeps its last check-in, so it's judged against its new
  // timetable from when it really last ran.
  const upDue = now;
  try {
    const res = db()
      .prepare(
        `UPDATE monitors SET host = ?, url = ?, port = ?, keyword = ?, keyword_mode = ?, hb_every_ms = ?, hb_grace_ms = ?,
           up_status = 'pending', up_code = NULL, up_ms = NULL, up_error = NULL, up_checked_at = NULL,
           up_due_at = ?, up_failures = 0, down_since = NULL, down_alerted = 0, down_alerted_at = NULL, ack_at = NULL, escalated_at = NULL,
           ssl_status = 'pending', ssl_expires_at = NULL, ssl_days = NULL, ssl_issuer = NULL, ssl_problems = NULL,
           ssl_error = NULL, ssl_checked_at = NULL, ssl_due_at = ?, ssl_alert_bucket = NULL, ssl_problem_alerted = NULL,
           dom_status = 'pending', dom_name = NULL, dom_expires_at = NULL, dom_days = NULL, dom_registrar = NULL,
           dom_note = NULL, dom_checked_at = NULL, dom_due_at = ?, dom_alert_bucket = NULL,
           ai_status = 'pending', ai_result = NULL, ai_checked_at = NULL, ai_due_at = ?, ai_alerted_sig = NULL, ai_pending_sig = NULL,
           scan_result = NULL, scan_checked_at = NULL, scan_due_at = ?, dns_baseline = NULL, links_alerted = NULL,
           last_manual_check_at = NULL
         WHERE id = ? AND user_id = ? AND kind = ?`,
      )
      .run(host, config.url, config.port, config.keyword, config.keyword_mode, config.hb_every_ms, config.hb_grace_ms, upDue, siteDue, siteDue, siteDue, siteDue, id, userId, config.kind);
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

// The plans whose sites get AI checks. They come from our own plan list (letters only), never from a request, so
// they're safe to write straight into the query. The AI check is due for a site only if its owner's plan is one of these.
const AI_PLANS = Object.entries(ENTITLEMENTS)
  .filter(([, e]) => e.aiVisibility)
  .map(([id]) => {
    if (!/^[a-z]+$/.test(id)) throw new Error(`Unexpected plan id ${id}`);
    return `'${id}'`;
  })
  .join(", ");

// The plans whose sites get the health scan, built the same way.
const SCAN_PLANS = Object.entries(ENTITLEMENTS)
  .filter(([, e]) => e.healthScans)
  .map(([id]) => {
    if (!/^[a-z]+$/.test(id)) throw new Error(`Unexpected plan id ${id}`);
    return `'${id}'`;
  })
  .join(", ");

/** Monitors with at least one check due, oldest first, together with the owner's email. */
export function dueMonitors(now: number, limit: number): (MonitorRow & { owner_email: string; owner_plan: string })[] {
  return db()
    .prepare(
      `SELECT m.*, u.email AS owner_email, u.plan AS owner_plan FROM monitors m JOIN users u ON u.id = m.user_id
       WHERE m.up_due_at <= ? OR m.ssl_due_at <= ? OR m.dom_due_at <= ? OR (m.ai_due_at <= ? AND u.plan IN (${AI_PLANS}))
          OR (m.kind = 'site' AND m.scan_due_at <= ? AND u.plan IN (${SCAN_PLANS}))
       ORDER BY MIN(m.up_due_at, m.ssl_due_at, m.dom_due_at, CASE WHEN u.plan IN (${AI_PLANS}) THEN m.ai_due_at ELSE m.up_due_at END) LIMIT ?`,
    )
    .all(now, now, now, now, now, limit) as unknown as (MonitorRow & { owner_email: string; owner_plan: string })[];
}

/** A monitor with its owner's email, read fresh. Used right before running checks so alerts never use stale state. */
export function getMonitorWithOwner(id: number): (MonitorRow & { owner_email: string; owner_plan: string }) | undefined {
  return db()
    .prepare("SELECT m.*, u.email AS owner_email, u.plan AS owner_plan FROM monitors m JOIN users u ON u.id = m.user_id WHERE m.id = ?")
    .get(id) as unknown as (MonitorRow & { owner_email: string; owner_plan: string }) | undefined;
}

// ---------- heartbeats ----------

/** The heartbeat a ping address belongs to, if any. */
export function findHeartbeat(token: string): MonitorRow | undefined {
  return db().prepare("SELECT * FROM monitors WHERE hb_token = ? AND kind = 'heartbeat'").get(token) as unknown as MonitorRow | undefined;
}

/** Records a check-in, and makes the heartbeat due straight away so its state (and any recovery) is updated at once. */
export function recordPing(id: number, now: number): void {
  db().prepare("UPDATE monitors SET hb_last_ping = ?, up_due_at = ? WHERE id = ?").run(now, now, id);
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

/**
 * How many alert emails an account has been sent since a time, for the daily limit. The notices about adding,
 * editing or removing a site are left out: the person did those themselves, and counting them let setting up
 * a batch of sites use up the day's limit so that real alerts were skipped.
 */
export function countEmailsSince(userId: number, since: number): number {
  return (
    db()
      .prepare("SELECT COUNT(*) AS c FROM monitor_events WHERE user_id = ? AND emailed = 1 AND created_at >= ? AND kind NOT IN ('created', 'edited', 'removed')")
      .get(userId, since) as {
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

/**
 * Checks, successes and the average response time between two times, from recent raw checks and older hourly totals.
 * Hourly totals are counted by the hour they start in.
 */
export function uptimeBetween(monitorId: number, from: number, to: number): { total: number; ok: number; avgMs: number | null } {
  const conn = db();
  const raw = conn
    .prepare("SELECT COUNT(*) AS total, COALESCE(SUM(ok), 0) AS ok, COALESCE(SUM(ms), 0) AS ms, COUNT(ms) AS n FROM uptime_checks WHERE monitor_id = ? AND at >= ? AND at < ?")
    .get(monitorId, from, to) as { total: number; ok: number; ms: number; n: number };
  const hourly = conn
    .prepare(
      "SELECT COALESCE(SUM(total), 0) AS total, COALESCE(SUM(ok), 0) AS ok, COALESCE(SUM(ms_sum), 0) AS ms, COALESCE(SUM(ms_n), 0) AS n FROM uptime_hourly WHERE monitor_id = ? AND hour >= ? AND hour < ?",
    )
    .get(monitorId, from, to) as { total: number; ok: number; ms: number; n: number };
  const n = raw.n + hourly.n;
  return { total: raw.total + hourly.total, ok: raw.ok + hourly.ok, avgMs: n ? Math.round((raw.ms + hourly.ms) / n) : null };
}

/** Outages that overlapped a period, oldest first. */
export function incidentsBetween(monitorId: number, from: number, to: number): IncidentRow[] {
  return db()
    .prepare("SELECT id, started_at, ended_at, error FROM monitor_incidents WHERE monitor_id = ? AND started_at < ? AND (ended_at IS NULL OR ended_at >= ?) ORDER BY started_at")
    .all(monitorId, to, from) as unknown as IncidentRow[];
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
        `INSERT INTO uptime_hourly (monitor_id, hour, total, ok, ms_sum, ms_n)
         SELECT monitor_id, (at / ${HOUR_MS}) * ${HOUR_MS}, COUNT(*), SUM(ok), COALESCE(SUM(ms), 0), COUNT(ms) FROM uptime_checks WHERE at < ?
         GROUP BY monitor_id, (at / ${HOUR_MS})
         ON CONFLICT (monitor_id, hour) DO UPDATE SET total = total + excluded.total, ok = ok + excluded.ok,
           ms_sum = ms_sum + excluded.ms_sum, ms_n = ms_n + excluded.ms_n`,
      )
      .run(cut);
    // The same checks also go into the daily totals, which are kept for over a year.
    conn
      .prepare(
        `INSERT INTO uptime_daily (monitor_id, day, total, ok, ms_sum, ms_n)
         SELECT monitor_id, (at / ${DAY_MS}) * ${DAY_MS}, COUNT(*), SUM(ok), COALESCE(SUM(ms), 0), COUNT(ms) FROM uptime_checks WHERE at < ?
         GROUP BY monitor_id, (at / ${DAY_MS})
         ON CONFLICT (monitor_id, day) DO UPDATE SET total = total + excluded.total, ok = ok + excluded.ok,
           ms_sum = ms_sum + excluded.ms_sum, ms_n = ms_n + excluded.ms_n`,
      )
      .run(cut);
    conn.prepare("DELETE FROM uptime_checks WHERE at < ?").run(cut);
    conn.exec("COMMIT");
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

/**
 * Deletes history nobody can see any more. Notifications are kept for `before` on most plans, and for a year on plans
 * with long history; daily uptime and outages for a year (plus a little); hourly totals for three months.
 */
export function pruneHistory(before: number, now = Date.now()): void {
  const conn = db();
  const longPlans = Object.entries(ENTITLEMENTS)
    .filter(([, e]) => e.historyDays >= 365)
    .map(([id]) => {
      if (!/^[a-z]+$/.test(id)) throw new Error(`Unexpected plan id ${id}`);
      return `'${id}'`;
    })
    .join(", ");
  conn.prepare(`DELETE FROM monitor_events WHERE created_at < ? AND user_id NOT IN (SELECT id FROM users WHERE plan IN (${longPlans}))`).run(before);
  const yearAgo = now - 400 * DAY_MS;
  conn.prepare("DELETE FROM monitor_events WHERE created_at < ?").run(yearAgo);
  conn.prepare("DELETE FROM uptime_daily WHERE day < ?").run(yearAgo);
  conn.prepare("DELETE FROM monitor_incidents WHERE started_at < ?").run(yearAgo);
  // Hourly totals back the status page's 30-day view and the last few months' reports.
  conn.prepare("DELETE FROM uptime_hourly WHERE hour < ?").run(now - 95 * DAY_MS);
}

/**
 * Uptime per calendar month (UTC), newest first, for the months since `since`. Finished days come from the daily
 * totals; today's checks aren't in them yet, so they're added from the raw checks.
 */
export function uptimeByMonth(monitorId: number, since: number): { month: string; total: number; ok: number; avgMs: number | null }[] {
  const rows = db()
    .prepare(
      `SELECT strftime('%Y-%m', day / 1000, 'unixepoch') AS month, SUM(total) AS total, SUM(ok) AS ok, SUM(ms_sum) AS ms, SUM(ms_n) AS n FROM (
         SELECT day, total, ok, ms_sum, ms_n FROM uptime_daily WHERE monitor_id = ? AND day >= ?
         UNION ALL
         SELECT (at / ${DAY_MS}) * ${DAY_MS}, 1, ok, COALESCE(ms, 0), ms IS NOT NULL FROM uptime_checks WHERE monitor_id = ? AND at >= ?
       ) GROUP BY month ORDER BY month DESC`,
    )
    .all(monitorId, since, monitorId, since) as { month: string; total: number; ok: number; ms: number; n: number }[];
  return rows.map((r) => ({ month: r.month, total: r.total, ok: r.ok, avgMs: r.n ? Math.round(r.ms / r.n) : null }));
}

/** Uptime per UTC day between two times, oldest first, from the daily totals and today's raw checks. */
export function dailyHistory(monitorId: number, from: number, to: number): { day: number; total: number; ok: number; avgMs: number | null }[] {
  const rows = db()
    .prepare(
      `SELECT day, SUM(total) AS total, SUM(ok) AS ok, SUM(ms) AS ms, SUM(n) AS n FROM (
         SELECT day, total, ok, ms_sum AS ms, ms_n AS n FROM uptime_daily WHERE monitor_id = ? AND day >= ? AND day < ?
         UNION ALL
         SELECT (at / ${DAY_MS}) * ${DAY_MS} AS day, 1, ok, COALESCE(ms, 0), ms IS NOT NULL FROM uptime_checks WHERE monitor_id = ? AND at >= ? AND at < ?
       ) GROUP BY day ORDER BY day`,
    )
    .all(monitorId, from, to, monitorId, from, to) as { day: number; total: number; ok: number; ms: number; n: number }[];
  return rows.map((r) => ({ day: r.day, total: r.total, ok: r.ok, avgMs: r.n ? Math.round(r.ms / r.n) : null }));
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
