import { type Alert, evaluateDomain, evaluateSsl, evaluateUptime } from "./alerts";
import { checkDomain } from "./domain-check";
import { CheckError } from "./hostname";
import { sendMail } from "./mail";
import { sendAlertToChannels } from "./channels";
import { entitlementsFor } from "./entitlements";
import {
  type MonitorRow,
  type MonitorUpdate,
  addEvent,
  closeIncident,
  countEmailsSince,
  getMonitorWithOwner,
  openIncident,
  recordUptime,
  updateMonitor,
} from "./monitors-db";
import { checkSsl } from "./ssl-check";
import { checkUptime } from "./uptime-check";
import {
  DAY,
  DOMAIN_EVERY,
  DOMAIN_RETRY,
  DOMAIN_UNSUPPORTED_EVERY,
  SSL_EVERY,
  SSL_RETRY,
  UPTIME_RECHECK,
} from "./monitor-config";

/** A safety valve: no account is ever emailed more than this many alerts in 24 hours. */
const EMAILS_PER_DAY = 40;

export interface Which {
  uptime: boolean;
  ssl: boolean;
  domain: boolean;
}
export const ALL_CHECKS: Which = { uptime: true, ssl: true, domain: true };

type Settled<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };

async function settle<T>(p: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await p };
  } catch (err) {
    if (err instanceof CheckError) return { ok: false, error: err.message, code: err.code };
    console.error("monitor check crashed", err);
    return { ok: false, error: "The check couldn't be completed." };
  }
}

interface PendingAlert {
  alert: Alert;
  /** Bookkeeping to restore if the email can't be sent, so the alert is tried again next time. */
  revert: MonitorUpdate;
}

// Monitors being checked right now. Two overlapping runs would each see "no alert sent yet" and
// both email, so a second request for the same monitor is skipped while the first is running.
const running = ((globalThis as unknown as { __monitorsRunning?: Set<number> }).__monitorsRunning ??= new Set<number>());

export interface RunOptions {
  /**
   * Called with the monitor as it stands after these checks, just before any alert emails go out.
   * Lets a caller send its own message (like "your monitor was edited") ahead of the alerts.
   */
  afterChecks?: (monitor: MonitorRow) => Promise<void>;
}

/**
 * Runs checks for one monitor, saves the results, and emails any alerts to its owner.
 * `which` is a list of checks to force, or "due" to run only those whose time has come.
 * The monitor is read fresh from the database here, never from a copy loaded earlier.
 * Returns true if the checks ran, false if they were skipped (already running, nothing due,
 * or the monitor changed or vanished underneath them).
 */
export async function runChecks(monitorId: number, which: Which | "due", options: RunOptions = {}): Promise<boolean> {
  if (running.has(monitorId)) return false;
  running.add(monitorId);
  try {
    return await runLocked(monitorId, which, options);
  } finally {
    running.delete(monitorId);
  }
}

async function runLocked(monitorId: number, requested: Which | "due", options: RunOptions): Promise<boolean> {
  const m = getMonitorWithOwner(monitorId);
  if (!m) return false; // deleted while it was waiting
  const ownerEmail = m.owner_email;
  const now = Date.now();
  const which: Which =
    requested === "due" ? { uptime: m.up_due_at <= now, ssl: m.ssl_due_at <= now, domain: m.dom_due_at <= now } : requested;
  if (!which.uptime && !which.ssl && !which.domain) return false;

  const [up, ssl, dom] = await Promise.all([
    which.uptime ? checkUptime(m.host) : null,
    which.ssl ? settle(checkSsl(m.host)) : null,
    which.domain ? settle(checkDomain(m.host)) : null,
  ]);

  // If the site was edited or removed while these checks were running, the results belong to
  // the old hostname. Drop them rather than record or email anything about the wrong site.
  if (getMonitorWithOwner(m.id)?.host !== m.host) return false;

  const update: MonitorUpdate = {};
  const pending: PendingAlert[] = [];

  if (up) {
    recordUptime(m.id, now, up.up, up.ms);
    const r = evaluateUptime({ failures: m.up_failures, downAlerted: !!m.down_alerted, downSince: m.down_since }, m.host, up, now);
    Object.assign(update, {
      up_status: up.up ? "up" : "down",
      up_code: up.status,
      up_ms: up.ms,
      up_error: up.error,
      up_checked_at: now,
      up_due_at: now + (r.recheckSoon ? UPTIME_RECHECK : entitlementsFor(m.owner_plan).uptimeEveryMs),
      up_failures: r.state.failures,
      down_since: r.state.downSince,
      down_alerted: r.state.downAlerted ? 1 : 0,
    } satisfies MonitorUpdate);
    // Keep a record of confirmed outages for the public status page.
    if (r.state.downAlerted && !m.down_alerted && r.state.downSince) openIncident(m.id, r.state.downSince, up.error);
    if (!r.state.downAlerted && m.down_alerted) closeIncident(m.id, now);

    for (const alert of r.alerts) {
      pending.push({
        alert,
        revert: alert.kind === "down" ? { down_alerted: 0 } : { down_alerted: 1, down_since: m.down_since },
      });
    }
  }

  if (ssl) {
    if (ssl.ok) {
      const v = ssl.value;
      const r = evaluateSsl({ bucket: m.ssl_alert_bucket, problemSig: m.ssl_problem_alerted }, m.host, {
        status: v.status,
        days: v.cert.daysRemaining,
        expiresAt: Date.parse(v.cert.validTo),
        issuer: v.cert.issuer,
        problems: v.problems,
      });
      Object.assign(update, {
        ssl_status: v.status,
        ssl_expires_at: Date.parse(v.cert.validTo),
        ssl_days: v.cert.daysRemaining,
        ssl_issuer: v.cert.issuer,
        ssl_problems: JSON.stringify(v.problems),
        ssl_error: null,
        ssl_checked_at: now,
        ssl_due_at: now + SSL_EVERY,
        ssl_alert_bucket: r.state.bucket,
        ssl_problem_alerted: r.state.problemSig,
      } satisfies MonitorUpdate);
      for (const alert of r.alerts) {
        pending.push({
          alert,
          revert: alert.kind === "ssl_expiry" ? { ssl_alert_bucket: m.ssl_alert_bucket } : { ssl_problem_alerted: m.ssl_problem_alerted },
        });
      }
    } else {
      // Couldn't read a certificate (site down, port closed). Uptime reports that; don't raise an SSL alert.
      Object.assign(update, { ssl_status: "unreachable", ssl_error: ssl.error, ssl_checked_at: now, ssl_due_at: now + SSL_RETRY } satisfies MonitorUpdate);
    }
  }

  if (dom) {
    if (dom.ok) {
      const v = dom.value;
      const expiresAt = v.expiresAt ? Date.parse(v.expiresAt) : null;
      const common = {
        dom_name: v.domain,
        dom_expires_at: expiresAt,
        dom_days: v.daysRemaining,
        dom_registrar: v.registrar,
        dom_note: v.problems.length ? v.problems.join(" ") : null,
        dom_checked_at: now,
        dom_due_at: now + DOMAIN_EVERY,
      };
      if (expiresAt === null || v.daysRemaining === null) {
        Object.assign(update, { ...common, dom_status: "unknown" } satisfies MonitorUpdate);
      } else {
        const r = evaluateDomain(m.dom_alert_bucket, m.host, { domain: v.domain, days: v.daysRemaining, expiresAt, registrar: v.registrar });
        Object.assign(update, { ...common, dom_status: v.state === "ok" ? "ok" : v.state, dom_alert_bucket: r.bucket } satisfies MonitorUpdate);
        for (const alert of r.alerts) pending.push({ alert, revert: { dom_alert_bucket: m.dom_alert_bucket } });
      }
    } else if (dom.code === "unsupported_tld") {
      Object.assign(update, { dom_status: "unsupported", dom_note: dom.error, dom_checked_at: now, dom_due_at: now + DOMAIN_UNSUPPORTED_EVERY } satisfies MonitorUpdate);
    } else {
      Object.assign(update, { dom_status: "error", dom_note: dom.error, dom_checked_at: now, dom_due_at: now + DOMAIN_RETRY } satisfies MonitorUpdate);
    }
  }

  if (options.afterChecks) {
    try {
      await options.afterChecks({ ...m, ...update } as MonitorRow);
    } catch (err) {
      console.error(`afterChecks for ${m.host} failed`, err);
    }
  }

  // Email the account owner. If sending fails, roll that alert's bookkeeping back so it's retried.
  let sentToday = pending.length ? countEmailsSince(m.user_id, now - DAY) : 0;
  const logged: { kind: string; message: string; emailed: boolean }[] = [];
  for (const { alert, revert } of pending) {
    // "Handled" means the alert has reached the user by email, or email was deliberately skipped.
    let handled = false;
    if (sentToday >= EMAILS_PER_DAY) {
      logged.push({ kind: alert.kind, message: `${alert.subject} (email skipped: daily limit reached)`, emailed: false });
      handled = true;
    } else {
      try {
        await sendMail({ to: ownerEmail, subject: alert.subject, text: alert.body });
        sentToday++;
        logged.push({ kind: alert.kind, message: alert.subject, emailed: true });
        handled = true;
      } catch (err) {
        console.error(`alert email for ${m.host} failed; will retry`, err);
        Object.assign(update, revert);
      }
    }
    // Slack and Discord get it too (Starter plan). Only once email has gone through: if email failed
    // the alert is retried next time, and sending to the channels now would post it twice.
    if (handled) {
      await sendAlertToChannels(m.user_id, m.owner_plan, { subject: alert.subject, body: alert.body, kind: alert.kind }).catch((err) =>
        console.error(`channel delivery for ${m.host} failed`, err),
      );
    }
  }

  updateMonitor(m.id, update);
  for (const e of logged) {
    try {
      addEvent({ userId: m.user_id, monitorId: m.id, host: m.host, kind: e.kind, message: e.message, emailed: e.emailed });
    } catch {
      // The monitor was deleted while its checks were running; nothing to log.
    }
  }  return true;
}
