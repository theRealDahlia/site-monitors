import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { brandingFor } from "./branding";
import { db } from "./db";
import { entitlementsFor } from "./entitlements";
import { appUrl, sendMail } from "./mail";
import { type MonitorRow, incidentsBetween, uptimeBetween } from "./monitors-db";
import { secret } from "./secret";
import { listNotices } from "./status-notices";

// Monthly uptime reports for an agency's clients (Pro). Each report covers some of the account's monitors and has
// an uptime target. On the first of each month, its confirmed recipients get last month's summary by email, with a
// link to the full report: a page with the owner's branding that prints cleanly, so it can be saved as a PDF.
//
// Recipients confirm once before they get anything, and every report email has a link to stop them.

export const MAX_REPORTS = 25;
export const MAX_RECIPIENTS = 10;
const NAME_MAX = 80;
const CONFIRM_DAYS = 14;
const DAY = 86_400_000;

interface ReportRow {
  id: number;
  user_id: number;
  name: string;
  monitor_ids: string;
  sla_target: number;
  enabled: number;
  last_sent_month: string | null;
  created_at: number;
}

interface RecipientRow {
  id: number;
  report_id: number;
  email: string;
  confirmed_at: number | null;
  confirm_hash: string | null;
  confirm_expires: number | null;
  created_at: number;
}

export interface ReportView {
  id: number;
  name: string;
  monitorIds: number[];
  slaTarget: number;
  enabled: boolean;
  lastSentMonth: string | null;
  recipients: { id: number; email: string; confirmed: boolean }[];
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const ids = (json: string): number[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
};

function view(r: ReportRow): ReportView {
  const recipients = db().prepare("SELECT * FROM report_recipients WHERE report_id = ? ORDER BY created_at, id").all(r.id) as unknown as RecipientRow[];
  return {
    id: r.id,
    name: r.name,
    monitorIds: ids(r.monitor_ids),
    slaTarget: r.sla_target,
    enabled: !!r.enabled,
    lastSentMonth: r.last_sent_month,
    recipients: recipients.map((x) => ({ id: x.id, email: x.email, confirmed: x.confirmed_at !== null })),
  };
}

export function listReports(userId: number): ReportView[] {
  return (db().prepare("SELECT * FROM reports WHERE user_id = ? ORDER BY created_at, id").all(userId) as unknown as ReportRow[]).map(view);
}

function getReport(userId: number, id: number): ReportRow | undefined {
  return db().prepare("SELECT * FROM reports WHERE id = ? AND user_id = ?").get(id, userId) as unknown as ReportRow | undefined;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = (error: string, status = 400) => ({ ok: false as const, error, status });

/** Reads a report's settings from a request: a name, some of the account's monitors, and an uptime target. */
function parseSettings(userId: number, input: Record<string, unknown>): Result<{ name: string; monitorIds: number[]; slaTarget: number }> {
  const name = typeof input.name === "string" ? input.name.replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim() : "";
  if (!name) return fail("Give the report a name, like the client's company.");
  if (name.length > NAME_MAX) return fail(`Keep the name to ${NAME_MAX} characters or fewer.`);
  const mine = new Set((db().prepare("SELECT id FROM monitors WHERE user_id = ?").all(userId) as { id: number }[]).map((r) => r.id));
  const monitorIds = Array.isArray(input.monitorIds) ? [...new Set(input.monitorIds.map(Number))].filter((x) => mine.has(x)) : [];
  if (monitorIds.length === 0) return fail("Choose at least one monitor for the report.");
  const slaTarget = Number(input.slaTarget);
  if (!Number.isFinite(slaTarget) || slaTarget < 90 || slaTarget > 100) return fail("Choose an uptime target between 90% and 100%.");
  return { ok: true, value: { name, monitorIds, slaTarget: Math.round(slaTarget * 1000) / 1000 } };
}

export function createReport(userId: number, input: Record<string, unknown>, now = Date.now()): Result<ReportView> {
  const s = parseSettings(userId, input);
  if (!s.ok) return s;
  const count = (db().prepare("SELECT COUNT(*) AS c FROM reports WHERE user_id = ?").get(userId) as { c: number }).c;
  if (count >= MAX_REPORTS) return fail(`You can have up to ${MAX_REPORTS} reports.`, 409);
  const id = Number(
    db()
      .prepare("INSERT INTO reports (user_id, name, monitor_ids, sla_target, created_at, last_sent_month) VALUES (?, ?, ?, ?, ?, ?)")
      // A new report starts with next month's send: this month isn't over, and last month was before it existed.
      .run(userId, s.value.name, JSON.stringify(s.value.monitorIds), s.value.slaTarget, now, previousMonth(now)).lastInsertRowid,
  );
  return { ok: true, value: view(getReport(userId, id)!) };
}

export function updateReport(userId: number, id: number, input: Record<string, unknown>): Result<ReportView> {
  const r = getReport(userId, id);
  if (!r) return fail("Report not found.", 404);
  const s = parseSettings(userId, input);
  if (!s.ok) return s;
  const enabled = input.enabled === undefined ? !!r.enabled : input.enabled === true;
  db().prepare("UPDATE reports SET name = ?, monitor_ids = ?, sla_target = ?, enabled = ? WHERE id = ?").run(s.value.name, JSON.stringify(s.value.monitorIds), s.value.slaTarget, enabled ? 1 : 0, id);
  return { ok: true, value: view(getReport(userId, id)!) };
}

export function deleteReport(userId: number, id: number): boolean {
  return Number(db().prepare("DELETE FROM reports WHERE id = ? AND user_id = ?").run(id, userId).changes) > 0;
}

// ---------- recipients ----------

/** Adds someone to a report and emails them a link to confirm. They get nothing until they do. */
export async function addRecipient(userId: number, accountEmail: string, reportId: number, email: string, now = Date.now()): Promise<Result<ReportView>> {
  const r = getReport(userId, reportId);
  if (!r) return fail("Report not found.", 404);
  const count = (db().prepare("SELECT COUNT(*) AS c FROM report_recipients WHERE report_id = ?").get(reportId) as { c: number }).c;
  if (count >= MAX_RECIPIENTS) return fail(`A report can go to up to ${MAX_RECIPIENTS} people.`, 409);
  const token = randomBytes(24).toString("base64url");
  try {
    db()
      .prepare("INSERT INTO report_recipients (report_id, email, confirm_hash, confirm_expires, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(reportId, email, sha256(token), now + CONFIRM_DAYS * DAY, now);
  } catch (err) {
    if ((err as { errcode?: number }).errcode === 2067) return fail("That address already gets this report.", 409);
    throw err;
  }
  const plan = (db().prepare("SELECT plan FROM users WHERE id = ?").get(userId) as { plan: string } | undefined)?.plan;
  const brand = brandingFor(userId, plan).name ?? accountEmail;
  try {
    await sendMail({
      to: email,
      subject: `Confirm monthly uptime reports from ${brand}`,
      text:
        `${brand} would like to send you a monthly uptime report for "${r.name}": how often your websites were up, ` +
        `any outages, and when certificates and domains are due for renewal.\n\n` +
        `To start getting it, confirm here:\n${appUrl()}/api/report-links/confirm.${token}\n\n` +
        `This link works for ${CONFIRM_DAYS} days. If you weren't expecting this, ignore this message and you won't hear from us again.`,
    });
  } catch (err) {
    db().prepare("DELETE FROM report_recipients WHERE report_id = ? AND email = ?").run(reportId, email);
    console.error("report confirmation email failed", err);
    return fail("We couldn't send the confirmation email. Try again in a moment.", 502);
  }
  return { ok: true, value: view(r) };
}

export function removeRecipient(userId: number, reportId: number, recipientId: number): boolean {
  if (!getReport(userId, reportId)) return false;
  return Number(db().prepare("DELETE FROM report_recipients WHERE id = ? AND report_id = ?").run(recipientId, reportId).changes) > 0;
}

export function confirmRecipient(token: string, now = Date.now()): { email: string; reportName: string } | null {
  const row = db().prepare("SELECT * FROM report_recipients WHERE confirm_hash = ?").get(sha256(token)) as unknown as RecipientRow | undefined;
  if (!row || !row.confirm_expires || row.confirm_expires < now) return null;
  db().prepare("UPDATE report_recipients SET confirmed_at = ?, confirm_hash = NULL, confirm_expires = NULL WHERE id = ?").run(now, row.id);
  const r = db().prepare("SELECT name FROM reports WHERE id = ?").get(row.report_id) as { name: string } | undefined;
  return { email: row.email, reportName: r?.name ?? "this report" };
}

const stopMac = (id: number, email: string, createdAt: number) => createHmac("sha256", secret()).update(`report-stop:${id}:${email}:${createdAt}`).digest("base64url");
const stopToken = (r: Pick<RecipientRow, "id" | "email" | "created_at">) => `${r.id}.${stopMac(r.id, r.email, r.created_at)}`;

export function checkRecipientStop(token: string): RecipientRow | null {
  const [a, mac] = token.split(".");
  const id = Number(a);
  if (!Number.isInteger(id) || !mac) return null;
  const row = db().prepare("SELECT * FROM report_recipients WHERE id = ?").get(id) as unknown as RecipientRow | undefined;
  if (!row) return null;
  const x = Buffer.from(mac);
  const y = Buffer.from(stopMac(row.id, row.email, row.created_at));
  return x.length === y.length && timingSafeEqual(x, y) ? row : null;
}

export function stopRecipient(token: string): { email: string } | null {
  const row = checkRecipientStop(token);
  if (!row) return null;
  db().prepare("DELETE FROM report_recipients WHERE id = ?").run(row.id);
  return { email: row.email };
}

// ---------- months ----------

/** "2026-10" for a time, in UTC. */
export const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);
export const previousMonth = (ms: number) => {
  const d = new Date(ms);
  return monthOf(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
};
export function monthRange(month: string): { from: number; to: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return null;
  return { from: Date.UTC(y, mo, 1), to: Date.UTC(y, mo + 1, 1) };
}
export const monthName = (month: string) => {
  const r = monthRange(month);
  return r ? new Date(r.from).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : month;
};

// ---------- what's in a report ----------

export interface ReportData {
  name: string;
  month: string;
  monthName: string;
  /** True for the month we're in: figures so far, not a finished month. */
  partial: boolean;
  slaTarget: number;
  branding: { name: string | null; logoUrl: string | null; accent: string; hideCredit: boolean };
  sites: {
    host: string;
    kind: string;
    uptime: number | null;
    metTarget: boolean | null;
    avgMs: number | null;
    outages: { start: number; end: number | null; minutes: number }[];
    downMinutes: number;
    ssl: { days: number | null; status: string } | null;
    domain: { days: number | null; status: string } | null;
    notices: { title: string; kind: string; state: string; at: number }[];
  }[];
  summary: { sites: number; met: number; outages: number; downMinutes: number };
}

/** Works out a report for a month from the stored history. Monitors that have since been removed are left out. */
export function buildReport(userId: number, reportId: number, month: string, now = Date.now()): ReportData | null {
  const r = getReport(userId, reportId);
  const range = monthRange(month);
  if (!r || !range) return null;
  const owner = db().prepare("SELECT plan FROM users WHERE id = ?").get(userId) as { plan: string } | undefined;
  const b = brandingFor(userId, owner?.plan ?? "free");
  const to = Math.min(range.to, now);
  const wanted = ids(r.monitor_ids);
  const monitors = (db().prepare(`SELECT * FROM monitors WHERE user_id = ?`).all(userId) as unknown as MonitorRow[]).filter((m) => wanted.includes(m.id));

  const sites = monitors.map((m) => {
    const u = uptimeBetween(m.id, range.from, to);
    const uptime = u.total ? Math.round((u.ok / u.total) * 100_000) / 1000 : null;
    const outages = incidentsBetween(m.id, range.from, to).map((i) => {
      const start = Math.max(i.started_at, range.from);
      const end = i.ended_at ? Math.min(i.ended_at, to) : null;
      return { start: i.started_at, end: i.ended_at, minutes: Math.max(1, Math.round(((end ?? to) - start) / 60_000)) };
    });
    const site = m.kind === "site";
    return {
      host: m.host,
      kind: m.kind,
      uptime,
      metTarget: uptime === null ? null : uptime >= r.sla_target,
      avgMs: u.avgMs,
      outages,
      downMinutes: outages.reduce((t, o) => t + o.minutes, 0),
      ssl: site ? { days: m.ssl_days, status: m.ssl_status } : null,
      domain: site ? { days: m.dom_days, status: m.dom_status } : null,
      notices: listNotices(m.id, now, Math.ceil((now - range.from) / DAY) + 1)
        .filter((n) => (n.startsAt ?? n.createdAt) >= range.from && (n.startsAt ?? n.createdAt) < range.to && n.state !== "cancelled")
        .map((n) => ({ title: n.title, kind: n.kind, state: n.state, at: n.startsAt ?? n.createdAt })),
    };
  });

  return {
    name: r.name,
    month,
    monthName: monthName(month),
    partial: now < range.to,
    slaTarget: r.sla_target,
    branding: { name: b.name, logoUrl: b.logoUrl, accent: b.accent, hideCredit: b.hideCredit },
    sites,
    summary: {
      sites: sites.length,
      met: sites.filter((s) => s.metTarget).length,
      outages: sites.reduce((t, s) => t + s.outages.length, 0),
      downMinutes: sites.reduce((t, s) => t + s.downMinutes, 0),
    },
  };
}

// ---------- the report's web address ----------

// A signed link to one month of one report. Anyone with it can read that report (it goes to the client), and it
// can't be changed to show another report or another month.
const viewMac = (reportId: number, month: string) => createHmac("sha256", secret()).update(`report-view:${reportId}:${month}`).digest("base64url").slice(0, 32);

export const reportPath = (reportId: number, month: string) => `/report/${reportId}.${month}.${viewMac(reportId, month)}`;

export function readReportToken(token: string): { reportId: number; month: string } | null {
  const [a, month, mac] = token.split(".");
  const reportId = Number(a);
  if (!Number.isInteger(reportId) || !month || !mac || !monthRange(month)) return null;
  const x = Buffer.from(mac);
  const y = Buffer.from(viewMac(reportId, month));
  return x.length === y.length && timingSafeEqual(x, y) ? { reportId, month } : null;
}

/** The report a signed link points at, with its owner, if the owner's plan still includes reports. */
export function reportForToken(token: string, now = Date.now()): ReportData | null {
  const t = readReportToken(token);
  if (!t) return null;
  const row = db().prepare("SELECT r.user_id, u.plan FROM reports r JOIN users u ON u.id = r.user_id WHERE r.id = ?").get(t.reportId) as { user_id: number; plan: string } | undefined;
  if (!row || !entitlementsFor(row.plan).reports) return null;
  return buildReport(row.user_id, t.reportId, t.month, now);
}

// ---------- sending ----------

const pct = (v: number | null) => (v === null ? "no data" : `${v}%`);
const duration = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);

/** The email version: a short summary per site, and the link to the full report. */
export function reportEmail(data: ReportData, link: string): { subject: string; text: string } {
  const brand = data.branding.name;
  const lines = data.sites.map((s) => {
    const mark = s.metTarget === null ? "" : s.metTarget ? " (target met)" : " (below target)";
    const out = s.outages.length ? `, ${s.outages.length} outage${s.outages.length === 1 ? "" : "s"} (${duration(s.downMinutes)} in total)` : ", no outages";
    return `- ${s.host}: ${pct(s.uptime)} uptime${mark}${out}`;
  });
  return {
    subject: `${data.name}: uptime report for ${data.monthName}`,
    text:
      `Here's ${brand ? `${brand}'s` : "the"} uptime report for ${data.name}, ${data.monthName}.\n\n` +
      `${data.summary.met} of ${data.summary.sites} sites met the ${data.slaTarget}% uptime target.\n\n` +
      `${lines.join("\n")}\n\n` +
      `See the full report, or save it as a PDF:\n${link}`,
  };
}

/**
 * Sends one month of one report to its confirmed recipients (or, with `onlyTo`, just to that address, as a test).
 * Returns how many emails went out.
 */
export async function sendReport(userId: number, reportId: number, month: string, onlyTo?: string): Promise<number> {
  const data = buildReport(userId, reportId, month);
  if (!data) return 0;
  const link = `${appUrl()}${reportPath(reportId, month)}`;
  const { subject, text } = reportEmail(data, link);
  const recipients = onlyTo
    ? [{ email: onlyTo, stop: null as string | null }]
    : (db().prepare("SELECT * FROM report_recipients WHERE report_id = ? AND confirmed_at IS NOT NULL").all(reportId) as unknown as RecipientRow[]).map((r) => ({
        email: r.email,
        stop: stopToken(r),
      }));
  let sent = 0;
  for (const r of recipients) {
    try {
      await sendMail({
        to: r.email,
        subject: onlyTo ? `[Test] ${subject}` : subject,
        text: r.stop ? `${text}\n\n--\nTo stop getting this report: ${appUrl()}/api/report-links/stop.${r.stop}` : text,
      });
      sent++;
    } catch (err) {
      console.error(`report ${reportId} to a recipient failed`, err);
    }
  }
  return sent;
}

/**
 * On the first days of a month, sends every switched-on report its previous month, once. Called by the scheduler's
 * hourly housekeeping. Only for accounts whose plan includes reports.
 */
export async function sendMonthlyReports(now = Date.now()): Promise<number> {
  const month = previousMonth(now);
  const due = db()
    .prepare("SELECT r.id, r.user_id, u.plan FROM reports r JOIN users u ON u.id = r.user_id WHERE r.enabled = 1 AND (r.last_sent_month IS NULL OR r.last_sent_month < ?)")
    .all(month) as { id: number; user_id: number; plan: string }[];
  let count = 0;
  for (const r of due) {
    if (!entitlementsFor(r.plan).reports) continue;
    // Marked first, so a slow or failing send can't make it go out twice.
    db().prepare("UPDATE reports SET last_sent_month = ? WHERE id = ?").run(month, r.id);
    count += await sendReport(r.user_id, r.id, month);
  }
  return count;
}
