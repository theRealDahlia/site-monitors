import { runAiVisibilityWithin } from "./ai-visibility";
import { type Alert, brokenLinksAlert, dnsChangedAlert, evaluateAi, evaluateDomain, evaluateSsl, evaluateUptime, securityIssuesAlert, securityResolvedAlert } from "./alerts";
import { type DnsSnapshot, type ScanResult, dnsChanges, runScan } from "./health-scan";
import { checkDomain } from "./domain-check";
import { CheckError } from "./hostname";
import { emailRecipients } from "./alert-emails";
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
import { checkHeartbeat, checkHttp, checkTcp, heartbeatDeadline } from "./monitor-kinds";
import { alertsSilenced } from "./status-notices";
import { notifySubscribers } from "./status-subscribers";
import { listTargets, readTargets } from "./alert-targets";
import { ackLink, activePolicy } from "./escalation";
import {
  AI_EVERY,
  AI_RECHECK,
  AI_RETRY,
  DAY,
  LINKS_EVERY,
  SCAN_EVERY,
  SCAN_RETRY,
  DOMAIN_EVERY,
  DOMAIN_RETRY,
  DOMAIN_UNSUPPORTED_EVERY,
  SSL_EVERY,
  SSL_RETRY,
  UPTIME_RECHECK,
} from "./monitor-config";

export interface Which {
  uptime: boolean;
  ssl: boolean;
  domain: boolean;
  /** AI visibility. Only runs for plans that include it, whatever is asked for here. */
  ai: boolean;
  /** The health scan (DNS, email setup, security headers, links). Only for sites on plans that include it. */
  scan?: boolean;
}
export const ALL_CHECKS: Which = { uptime: true, ssl: true, domain: true, ai: true, scan: true };

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
  const now = Date.now();
  const site = m.kind === "site";
  const aiIncluded = site && entitlementsFor(m.owner_plan).aiVisibility;
  const scanIncluded = site && entitlementsFor(m.owner_plan).healthScans;
  const which: Which =
    requested === "due"
      ? {
          uptime: m.up_due_at <= now,
          ssl: site && m.ssl_due_at <= now,
          domain: site && m.dom_due_at <= now,
          ai: aiIncluded && m.ai_due_at <= now,
          scan: scanIncluded && m.scan_due_at <= now,
        }
      : { uptime: requested.uptime, ssl: site && requested.ssl, domain: site && requested.domain, ai: requested.ai && aiIncluded, scan: !!requested.scan && scanIncluded };
  if (!which.uptime && !which.ssl && !which.domain && !which.ai && !which.scan) return false;

  // The scan's broken-link part runs weekly, on plans that include it.
  const lastScan = parseScan(m.scan_result);
  const withLinks = entitlementsFor(m.owner_plan).brokenLinks && (!lastScan?.linksAt || now - lastScan.linksAt >= LINKS_EVERY);

  // Each kind has its own way of telling up from down; a site's other checks only run for sites.
  const uptimeCheck = () => {
    switch (m.kind) {
      case "http":
        return checkHttp(m);
      case "tcp":
        return checkTcp(m);
      case "heartbeat":
        return Promise.resolve(checkHeartbeat(m, now));
      default:
        return checkUptime(m.host);
    }
  };

  const [up, ssl, dom, ai, scan] = await Promise.all([
    which.uptime ? uptimeCheck() : null,
    which.ssl ? settle(checkSsl(m.host)) : null,
    which.domain ? settle(checkDomain(m.host)) : null,
    which.ai ? settle(runAiVisibilityWithin(m.host)) : null,
    which.scan ? settle(runScan(m.host, m.dom_name, { withLinks, now })) : null,
  ]);

  // If the monitor was edited or removed while these checks were running, the results belong to what it
  // watched before. Drop them rather than record or email anything about the wrong thing.
  const fresh = getMonitorWithOwner(m.id);
  const target = (x: typeof m) => [x.host, x.url, x.port, x.keyword, x.keyword_mode, x.hb_every_ms, x.hb_grace_ms].join("|");
  if (!fresh || target(fresh) !== target(m)) return false;
  // A heartbeat that checked in while we were deciding it was late isn't late.
  if (m.kind === "heartbeat" && fresh.hb_last_ping !== m.hb_last_ping) return false;

  const update: MonitorUpdate = {};
  const pending: PendingAlert[] = [];

  if (up) {
    recordUptime(m.id, now, up.up, up.ms);
    const heartbeat = m.kind === "heartbeat";
    // A heartbeat has been overdue since its deadline passed, not since we happened to notice.
    const downSince = m.down_since ?? (heartbeat && !up.up ? heartbeatDeadline(m) : null);
    const r = evaluateUptime({ failures: m.up_failures, downAlerted: !!m.down_alerted, downSince }, m.host, up, now, {
      subject: m.kind,
      downAfter: heartbeat ? 1 : undefined,
    });
    // A heartbeat is next looked at when its next check-in is due; once it's overdue, every interval until it's back.
    const nextDue = heartbeat
      ? up.up
        ? heartbeatDeadline(m) + 1
        : now + (m.hb_every_ms ?? 60_000)
      : now + (r.recheckSoon ? UPTIME_RECHECK : entitlementsFor(m.owner_plan).uptimeEveryMs);
    Object.assign(update, {
      up_status: up.up ? "up" : "down",
      up_code: up.status,
      up_ms: up.ms,
      up_error: up.error,
      up_checked_at: now,
      up_due_at: nextDue,
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

  if (ai) {
    if (!ai.ok) {
      // The check itself crashed. Keep what we knew and try again later.
      Object.assign(update, { ai_due_at: now + AI_RETRY } satisfies MonitorUpdate);
    } else if (ai.value.status === "unknown") {
      // We couldn't read the site (it's down, or it turns our check away). That's not an AI problem, so no alert,
      // and what we'd alerted about stays as it was.
      Object.assign(update, {
        ai_status: "unknown",
        ai_result: JSON.stringify(ai.value),
        ai_checked_at: now,
        ai_due_at: now + AI_RETRY,
      } satisfies MonitorUpdate);
    } else {
      const v = ai.value;
      const r = evaluateAi(
        { alertedSig: m.ai_alerted_sig, pendingSig: m.ai_pending_sig },
        m.host,
        { sig: v.problemSig, problems: v.findings.filter((f) => f.severity === "problem") },
      );
      Object.assign(update, {
        ai_status: v.status,
        ai_result: JSON.stringify(v),
        ai_checked_at: now,
        ai_due_at: now + (r.recheckSoon ? AI_RECHECK : AI_EVERY),
        ai_alerted_sig: r.state.alertedSig,
        ai_pending_sig: r.state.pendingSig,
      } satisfies MonitorUpdate);
      for (const alert of r.alerts) pending.push({ alert, revert: { ai_alerted_sig: m.ai_alerted_sig, ai_pending_sig: m.ai_pending_sig } });
    }
  }

  if (scan) {
    if (!scan.ok) {
      Object.assign(update, { scan_due_at: now + SCAN_RETRY } satisfies MonitorUpdate);
    } else {
      const v = scan.value;
      // A week's links result is kept until the next weekly run.
      const result: ScanResult = v.links ? v : { ...v, links: lastScan?.links ?? null, linksAt: lastScan?.linksAt ?? null };
      Object.assign(update, { scan_result: JSON.stringify(result), scan_checked_at: now, scan_due_at: now + SCAN_EVERY } satisfies MonitorUpdate);

      // DNS: the first scan only records the records. After that, any change is news. A lookup that failed (null)
      // never counts as a change.
      if (v.dns) {
        const before = parseBaseline(m.dns_baseline);
        const changes = before ? dnsChanges(before, v.dns) : [];
        update.dns_baseline = JSON.stringify(v.dns);
        if (changes.length) pending.push({ alert: dnsChangedAlert(m.host, changes), revert: { dns_baseline: m.dns_baseline } });
      }
      // Security: report problems we haven't reported before (by finding, so a changed header or record is news but the
      // same open issue isn't repeated every day). Once they're all fixed, the slate is wiped. A scan that couldn't
      // load the homepage or look up DNS has no findings for that part, so it never counts as "fixed".
      const found = [...(v.email?.findings ?? []), ...(v.headers?.findings ?? [])].filter((f): f is typeof f & { tone: "problem" | "notice" } => f.tone === "problem" || f.tone === "notice");
      const complete = !!v.email && !!v.headers;
      if (found.length || complete) {
        const knownIssues = new Set<string>(m.security_alerted ? (JSON.parse(m.security_alerted) as string[]) : []);
        const freshIssues = found.filter((f) => !knownIssues.has(f.id));
        // Keep what was reported if part of the scan failed, so it isn't reported again when it comes back.
        const stillOpen = complete ? found.map((f) => f.id) : [...knownIssues, ...freshIssues.map((f) => f.id)];
        update.security_alerted = stillOpen.length ? JSON.stringify([...new Set(stillOpen)]) : null;
        if (freshIssues.length) pending.push({ alert: securityIssuesAlert(m.host, freshIssues), revert: { security_alerted: m.security_alerted } });
        // Everything we reported is gone, and the whole scan ran: say so.
        else if (complete && found.length === 0 && knownIssues.size) pending.push({ alert: securityResolvedAlert(m.host), revert: { security_alerted: m.security_alerted } });
      }
      // Links: report broken links we haven't reported before. Once they're all fixed, the slate is wiped.
      if (v.links) {
        const known = new Set<string>(m.links_alerted ? (JSON.parse(m.links_alerted) as string[]) : []);
        const fresh = v.links.broken.filter((b) => !known.has(b.url));
        update.links_alerted = v.links.broken.length ? JSON.stringify(v.links.broken.map((b) => b.url)) : null;
        if (fresh.length) pending.push({ alert: brokenLinksAlert(m.host, v.links.broken), revert: { links_alerted: m.links_alerted } });
      }
    }
  }

  if (options.afterChecks) {
    try {
      await options.afterChecks({ ...m, ...update } as MonitorRow);
    } catch (err) {
      console.error(`afterChecks for ${m.host} failed`, err);
    }
  }

  // Who hears about it. A monitor can send its alerts to only some destinations. If the account has an escalation rule,
  // the people it names only hear about outages nobody has acknowledged, so they're left out of first alerts unless
  // this monitor chooses them.
  const policy = pending.length ? activePolicy(m.user_id, m.owner_plan) : null;
  const route = entitlementsFor(m.owner_plan).alertRouting ? readTargets(m.alert_targets) : null;
  // If that would leave nobody (the escalation contact is the only address), first alerts go to everyone as usual.
  const rest = policy ? listTargets(m.user_id).filter((t) => t.active && !policy.targets.includes(t.id)) : [];
  const firstLine = route ?? (rest.length ? new Set(rest.map((t) => t.id)) : null);

  // Email the account owner. If sending fails, roll that alert's bookkeeping back so it's retried.
  let sentToday = pending.length ? countEmailsSince(m.user_id, now - DAY) : 0;
  const logged: { kind: string; message: string; emailed: boolean }[] = [];
  // During maintenance the owner has asked not to hear about outages: the outage is still recorded, just not sent.
  const silenced = pending.some((p) => p.alert.kind === "down" || p.alert.kind === "recovered") && alertsSilenced(m.id, now);
  // Alerts that reached the owner. One that failed is retried next time, so it isn't passed on to anyone else yet.
  const delivered: Alert[] = [];
  for (const { alert: raw, revert } of pending) {
    // "Handled" means the alert has reached the user by email, or email was deliberately skipped.
    let handled = false;
    // With an escalation rule, an outage alert says how to stop it going further.
    const downSince = (update.down_since ?? m.down_since) as number | null;
    const alert = raw.kind === "down" && policy && downSince ? { ...raw, body: `${raw.body}\n\nAcknowledge this outage so nobody else is alerted: ${ackLink(m.id, downSince)}` } : raw;
    // "Back up" after an escalation also goes to whoever it was escalated to.
    const only = alert.kind === "recovered" && m.escalated_at && policy && firstLine ? new Set([...firstLine, ...policy.targets]) : firstLine;
    if (silenced && (alert.kind === "down" || alert.kind === "recovered")) {
      logged.push({ kind: alert.kind, message: `${alert.subject} (not sent: during scheduled maintenance)`, emailed: false });
      continue;
    }
    if (sentToday >= entitlementsFor(m.owner_plan).maxEmailsPerDay) {
      logged.push({ kind: alert.kind, message: `${alert.subject} (email skipped: daily limit reached)`, emailed: false });
      handled = true;
    } else {
      try {
        // Every address the owner has switched on. None switched on is their choice, not a failure.
        const sent = await emailRecipients(m.user_id, { subject: alert.subject, text: alert.body }, only);
        if (sent) sentToday++;
        const why = only ? "no email address is chosen for this monitor" : "every address is switched off";
        logged.push({ kind: alert.kind, message: sent ? alert.subject : `${alert.subject} (not emailed: ${why})`, emailed: sent > 0 });
        handled = true;
      } catch (err) {
        console.error(`alert email for ${m.host} failed; will retry`, err);
        Object.assign(update, revert);
      }
    }
    // Slack and Discord get it too (Starter plan). Only once email has gone through: if email failed
    // the alert is retried next time, and sending to the channels now would post it twice.
    if (handled) {
      delivered.push(alert);
      await sendAlertToChannels(m.user_id, m.owner_plan, { subject: alert.subject, body: alert.body, kind: alert.kind }, only).catch((err) =>
        console.error(`channel delivery for ${m.host} failed`, err),
      );
      // A delivered outage alert starts the clock for escalation; being back up ends it.
      if (alert.kind === "down") Object.assign(update, { down_alerted_at: now, ack_at: null, escalated_at: null } satisfies MonitorUpdate);
      if (alert.kind === "recovered") Object.assign(update, { down_alerted_at: null, ack_at: null, escalated_at: null } satisfies MonitorUpdate);
    }
  }

  // A status page's subscribers hear about confirmed outages too (not during maintenance the owner has scheduled).
  for (const alert of delivered) {
    if (alert.kind !== "down" && alert.kind !== "recovered") continue;
    const text =
      alert.kind === "down"
        ? `Our checks found that ${m.host} isn't working. We'll send another update when it's back.`
        : `${m.host} is working again.`;
    notifySubscribers(m, { subject: alert.kind === "down" ? `${m.host} is down` : `${m.host} is back up`, text }).catch((err) =>
      console.error(`subscriber outage notice for ${m.host} failed`, err),
    );
  }

  updateMonitor(m.id, update);
  for (const e of logged) {
    try {
      addEvent({ userId: m.user_id, monitorId: m.id, host: m.host, kind: e.kind, message: e.message, emailed: e.emailed });
    } catch {
      // The monitor was deleted while its checks were running; nothing to log.
    }
  }
  return true;
}

/** A stored scan result, or null if there isn't one or it's from a version we don't recognise. */
function parseScan(json: string | null): ScanResult | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as ScanResult;
    return v?.v === 1 ? v : null;
  } catch {
    return null;
  }
}

function parseBaseline(json: string | null): DnsSnapshot | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as DnsSnapshot;
  } catch {
    return null;
  }
}
