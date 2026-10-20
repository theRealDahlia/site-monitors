import { db } from "./db";

// What an owner tells the visitors of a status page, in their own words:
//  - Incidents: "We're investigating slow checkouts", with a timeline of updates until it's resolved.
//  - Maintenance: "Database upgrade, Saturday 02:00 to 04:00". It shows as upcoming, then under way, then over,
//    from its times. While it's under way, down alerts for the monitor can be held back (see monitor-runner.ts).
// The status page's automatic outage history (monitor_incidents) is separate: that's what the checks saw.

export const INCIDENT_STATES = ["investigating", "identified", "monitoring", "resolved"] as const;
export type IncidentState = (typeof INCIDENT_STATES)[number];
export const IMPACTS = ["minor", "major"] as const;
export type Impact = (typeof IMPACTS)[number];

export const STATE_LABEL: Record<string, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TITLE_MAX = 120;
export const MESSAGE_MAX = 2000;
const DAY = 86_400_000;
/** Maintenance can be scheduled up to this far ahead, and last up to this long. */
export const MAINTENANCE_AHEAD_MAX = 90 * DAY;
export const MAINTENANCE_LENGTH_MAX = 7 * DAY;
/** How long finished incidents and maintenance stay on a status page. */
export const HISTORY_DAYS = 30;

interface NoticeRow {
  id: number;
  user_id: number;
  monitor_id: number;
  kind: "incident" | "maintenance";
  title: string;
  impact: Impact | null;
  state: string;
  starts_at: number | null;
  ends_at: number | null;
  silence_alerts: number;
  created_at: number;
  resolved_at: number | null;
}

interface UpdateRow {
  id: number;
  notice_id: number;
  state: string;
  message: string;
  created_at: number;
}

export interface NoticeView {
  id: number;
  kind: "incident" | "maintenance";
  title: string;
  impact: Impact | null;
  /** For maintenance, worked out from its times: scheduled, in_progress, completed or cancelled. */
  state: string;
  startsAt: number | null;
  endsAt: number | null;
  silenceAlerts: boolean;
  createdAt: number;
  resolvedAt: number | null;
  /** Newest first. */
  updates: { id: number; state: string; message: string; at: number }[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = (error: string, status = 400): { ok: false; error: string; status: number } => ({ ok: false, error, status });

/** Text from a person, tidied: invisible characters dropped, runs of blank lines kept to one. */
function text(value: unknown, max: number, what: string, required = true): Result<string> {
  const v = typeof value === "string" ? value.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : "")).replace(/\n{3,}/g, "\n\n").trim() : "";
  if (!v && required) return fail(`Write ${what}.`);
  if (v.length > max) return fail(`Keep ${what} to ${max} characters or fewer.`);
  return { ok: true, value: v };
}

export function maintenanceState(n: Pick<NoticeRow, "state" | "starts_at" | "ends_at">, now: number): string {
  if (n.state === "cancelled") return "cancelled";
  if (n.starts_at !== null && now < n.starts_at) return "scheduled";
  if (n.ends_at !== null && now >= n.ends_at) return "completed";
  return "in_progress";
}

function view(n: NoticeRow, updates: UpdateRow[], now: number): NoticeView {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    impact: n.impact,
    state: n.kind === "maintenance" ? maintenanceState(n, now) : n.state,
    startsAt: n.starts_at,
    endsAt: n.ends_at,
    silenceAlerts: !!n.silence_alerts,
    createdAt: n.created_at,
    resolvedAt: n.resolved_at,
    updates: updates
      .filter((u) => u.notice_id === n.id)
      .sort((a, b) => b.created_at - a.created_at || b.id - a.id)
      .map((u) => ({ id: u.id, state: u.state, message: u.message, at: u.created_at })),
  };
}

function updatesFor(ids: number[]): UpdateRow[] {
  if (ids.length === 0) return [];
  return db()
    .prepare(`SELECT * FROM status_notice_updates WHERE notice_id IN (${ids.map(() => "?").join(", ")})`)
    .all(...ids) as unknown as UpdateRow[];
}

/** Every notice for a monitor from the last `days` days, plus anything still open or upcoming. Newest first. */
export function listNotices(monitorId: number, now = Date.now(), days = HISTORY_DAYS): NoticeView[] {
  const since = now - days * DAY;
  const rows = db()
    .prepare(
      `SELECT * FROM status_notices WHERE monitor_id = ?
         AND (created_at >= ? OR resolved_at IS NULL OR resolved_at >= ? OR ends_at >= ?)
       ORDER BY COALESCE(starts_at, created_at) DESC, id DESC LIMIT 100`,
    )
    .all(monitorId, since, since, since) as unknown as NoticeRow[];
  const updates = updatesFor(rows.map((r) => r.id));
  return rows.map((r) => view(r, updates, now));
}

/** What a status page's visitors see, sorted into what's happening now, what's coming, and what's over. */
export function publicNotices(monitorId: number, now = Date.now()) {
  const all = listNotices(monitorId, now);
  const open = (n: NoticeView) => (n.kind === "incident" ? n.state !== "resolved" : n.state === "in_progress");
  return {
    active: all.filter(open),
    upcoming: all.filter((n) => n.kind === "maintenance" && n.state === "scheduled").sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0)),
    past: all.filter((n) => !open(n) && !(n.kind === "maintenance" && (n.state === "scheduled" || n.state === "cancelled"))),
  };
}

function owned(userId: number, monitorId: number, noticeId: number): NoticeRow | undefined {
  return db().prepare("SELECT * FROM status_notices WHERE id = ? AND monitor_id = ? AND user_id = ?").get(noticeId, monitorId, userId) as unknown as NoticeRow | undefined;
}

function addUpdate(noticeId: number, state: string, message: string, at: number) {
  db().prepare("INSERT INTO status_notice_updates (notice_id, state, message, created_at) VALUES (?, ?, ?, ?)").run(noticeId, state, message, at);
}

/** Reports a new incident, with its first update. */
export function createIncident(userId: number, monitorId: number, input: Record<string, unknown>, now = Date.now()): Result<NoticeView> {
  const title = text(input.title, TITLE_MAX, "a short title");
  if (!title.ok) return title;
  const message = text(input.message, MESSAGE_MAX, "what's happening");
  if (!message.ok) return message;
  const state = INCIDENT_STATES.includes(input.state as IncidentState) ? (input.state as IncidentState) : null;
  if (!state) return fail("Choose the incident's state.");
  const impact = IMPACTS.includes(input.impact as Impact) ? (input.impact as Impact) : null;
  if (!impact) return fail("Choose how serious it is.");

  const conn = db();
  const res = conn
    .prepare("INSERT INTO status_notices (user_id, monitor_id, kind, title, impact, state, created_at, resolved_at) VALUES (?, ?, 'incident', ?, ?, ?, ?, ?)")
    .run(userId, monitorId, title.value, impact, state, now, state === "resolved" ? now : null);
  const id = Number(res.lastInsertRowid);
  addUpdate(id, state, message.value, now);
  return { ok: true, value: listNotices(monitorId, now).find((n) => n.id === id)! };
}

/** Adds to an incident's timeline. Resolving it closes it; a later update can reopen it. */
export function updateIncident(userId: number, monitorId: number, noticeId: number, input: Record<string, unknown>, now = Date.now()): Result<NoticeView> {
  const n = owned(userId, monitorId, noticeId);
  if (!n || n.kind !== "incident") return fail("Incident not found.", 404);
  const message = text(input.message, MESSAGE_MAX, "an update");
  if (!message.ok) return message;
  const state = INCIDENT_STATES.includes(input.state as IncidentState) ? (input.state as IncidentState) : null;
  if (!state) return fail("Choose the incident's state.");
  db()
    .prepare("UPDATE status_notices SET state = ?, resolved_at = ? WHERE id = ?")
    .run(state, state === "resolved" ? (n.resolved_at ?? now) : null, n.id);
  addUpdate(n.id, state, message.value, now);
  return { ok: true, value: listNotices(monitorId, now).find((x) => x.id === n.id)! };
}

/** Schedules maintenance. Times are epoch milliseconds, as the browser read them from the person's own clock. */
export function createMaintenance(userId: number, monitorId: number, input: Record<string, unknown>, now = Date.now()): Result<NoticeView> {
  const title = text(input.title, TITLE_MAX, "a short title");
  if (!title.ok) return title;
  const message = text(input.message, MESSAGE_MAX, "what's being done", false);
  if (!message.ok) return message;
  const startsAt = Number(input.startsAt);
  const endsAt = Number(input.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return fail("Choose when it starts and ends.");
  if (endsAt <= startsAt) return fail("It has to end after it starts.");
  if (endsAt <= now) return fail("That time has already passed.");
  if (startsAt > now + MAINTENANCE_AHEAD_MAX) return fail("Maintenance can be scheduled up to 90 days ahead.");
  if (endsAt - startsAt > MAINTENANCE_LENGTH_MAX) return fail("Maintenance can last up to 7 days.");

  const res = db()
    .prepare(
      "INSERT INTO status_notices (user_id, monitor_id, kind, title, state, starts_at, ends_at, silence_alerts, created_at) VALUES (?, ?, 'maintenance', ?, 'scheduled', ?, ?, ?, ?)",
    )
    .run(userId, monitorId, title.value, Math.round(startsAt), Math.round(endsAt), input.silenceAlerts === false ? 0 : 1, now);
  const id = Number(res.lastInsertRowid);
  if (message.value) addUpdate(id, "scheduled", message.value, now);
  return { ok: true, value: listNotices(monitorId, now).find((n) => n.id === id)! };
}

/** Ends maintenance that's under way now, or cancels it before it starts. */
export function finishMaintenance(userId: number, monitorId: number, noticeId: number, now = Date.now()): Result<NoticeView> {
  const n = owned(userId, monitorId, noticeId);
  if (!n || n.kind !== "maintenance") return fail("Maintenance not found.", 404);
  const state = maintenanceState(n, now);
  if (state === "scheduled") {
    db().prepare("UPDATE status_notices SET state = 'cancelled', resolved_at = ? WHERE id = ?").run(now, n.id);
    addUpdate(n.id, "cancelled", "This maintenance has been cancelled.", now);
  } else if (state === "in_progress") {
    db().prepare("UPDATE status_notices SET ends_at = ?, resolved_at = ? WHERE id = ?").run(now, now, n.id);
    addUpdate(n.id, "completed", "This maintenance is complete.", now);
  } else return fail("This maintenance is already over.", 409);
  return { ok: true, value: listNotices(monitorId, now).find((x) => x.id === n.id)! };
}

export function deleteNotice(userId: number, monitorId: number, noticeId: number): boolean {
  return Number(db().prepare("DELETE FROM status_notices WHERE id = ? AND monitor_id = ? AND user_id = ?").run(noticeId, monitorId, userId).changes) > 0;
}

/** True while maintenance that holds back alerts is under way for a monitor. */
export function alertsSilenced(monitorId: number, now = Date.now()): boolean {
  return !!db()
    .prepare("SELECT 1 FROM status_notices WHERE monitor_id = ? AND kind = 'maintenance' AND state != 'cancelled' AND silence_alerts = 1 AND starts_at <= ? AND ends_at > ? LIMIT 1")
    .get(monitorId, now, now);
}
