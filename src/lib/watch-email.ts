import { DOMAIN_THRESHOLDS, SSL_THRESHOLDS } from "./alerts";
import { sendAlertToChannels } from "./channels";
import { emailRecipients } from "./alert-emails";
import { appUrl } from "./mail";
import { DOMAIN_EVERY, SSL_EVERY, everyText } from "./monitor-config";
import { describeHealth } from "./monitor-summary";
import type { KindConfig } from "./monitor-kinds";
import { type MonitorRow, addEvent } from "./monitors-db";

/**
 * Posts to the owner's Slack and Discord channels (Starter plan). It doesn't wait: nobody should sit
 * on a slow Slack when they've just added a site, and a broken channel is recorded against that
 * channel and never affects the email or the change itself.
 */
function tellChannels(userId: number, plan: string, message: Parameters<typeof sendAlertToChannels>[2]): void {
  sendAlertToChannels(userId, plan, message).catch((err) => console.error("channel notice failed", err));
}

const list = (nums: number[]) => {
  const sorted = [...nums].sort((a, b) => b - a);
  return `${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
};

/** What a monitor of each kind checks and how often, one line per check, for the "now watching" and "updated" notices. */
function watchLines(config: Pick<KindConfig, "kind" | "url" | "port" | "keyword" | "keyword_mode" | "hb_every_ms" | "hb_grace_ms">, uptimeEveryMs: number): string[] {
  switch (config.kind) {
    case "http": {
      const keyword = config.keyword
        ? `, or if the page ${config.keyword_mode === "absent" ? "contains" : "doesn't contain"} "${config.keyword}"`
        : "";
      return [`The page at ${config.url}: checked every ${everyText(uptimeEveryMs)}. It counts as down if it answers with an error (HTTP 400 or above)${keyword}.`];
    }
    case "tcp":
      return [`Port ${config.port} on ${config.url}: checked every ${everyText(uptimeEveryMs)} by opening a connection.`];
    case "heartbeat":
      return [
        `A check-in expected every ${everyText(config.hb_every_ms ?? 0)}, with ${everyText(config.hb_grace_ms ?? 0)} to spare. ` +
          `Its ping address is on its page in your dashboard.`,
      ];
    default:
      return [
        `Uptime: checked every ${everyText(uptimeEveryMs)}`,
        `SSL certificate: checked every ${everyText(SSL_EVERY)}, with warnings ${list(SSL_THRESHOLDS)} days before it expires`,
        `Domain registration: checked every ${everyText(DOMAIN_EVERY)}, with warnings ${list(DOMAIN_THRESHOLDS)} days before it expires`,
      ];
  }
}

/** Emails the owner to confirm that a monitor now exists and what it's watching. */
export async function sendWatchConfirmation(opts: {
  monitorId: number;
  userId: number;
  host: string;
  createdAt: number;
  /** How often this account's uptime checks run, in milliseconds. */
  uptimeEveryMs: number;
  /** The account's plan, which decides whether Slack and Discord get this too. */
  plan: string;
  /** What kind of monitor it is, and its settings. A site when left out. */
  config?: KindConfig;
}): Promise<void> {
  const added = new Date(opts.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const subject = `Now watching ${opts.host}`;
  const lines = watchLines(opts.config ?? { kind: "site", url: null, port: null, keyword: null, keyword_mode: null, hb_every_ms: null, hb_grace_ms: null }, opts.uptimeEveryMs);
  const site = !opts.config || opts.config.kind === "site";

  tellChannels(opts.userId, opts.plan, {
    kind: "created",
    subject,
    body: `Your monitor for ${opts.host} is now active.\n` + lines.map((l) => `• ${l}`).join("\n"),
  });

  const sent = await emailRecipients(opts.userId, {
    subject,
    text:
      `Your monitor for ${opts.host} has been created and is now active.\n\n` +
      `Here's what we're watching:\n` +
      lines.map((l) => `- ${l}`).join("\n") +
      "\n\n" +
      (site
        ? `We'll email you if the site goes down or something is about to expire, and again when it's back up.\n\n`
        : `We'll email you if it goes down, and again when it's back.\n\n`) +
      `See its status: ${appUrl()}/dashboard\n` +
      `Added on ${added} (UTC).\n\n` +
      `If you didn't add this ${site ? "site" : "monitor"}, log in and remove it from the Sites tab.`,
  });
  addEvent({ userId: opts.userId, monitorId: opts.monitorId, host: opts.host, kind: "created", message: `Started watching ${opts.host}`, emailed: sent > 0 });
}

/**
 * Tells the owner their monitor was edited: what changed, its new status, and the health of the new
 * site. The same text is saved as a notification, so the Notifications tab matches the email. The
 * notification is recorded even if the email can't be sent, and says so.
 */
/** What an edit changed, one line each, in words. */
function changes(before: MonitorRow, after: MonitorRow): string[] {
  const rule = (m: MonitorRow) => (m.keyword ? `must ${m.keyword_mode === "absent" ? "not contain" : "contain"} "${m.keyword}"` : "none");
  const out: string[] = [];
  if (before.host !== after.host) out.push(`${after.kind === "heartbeat" ? "Name" : after.kind === "site" ? "Site" : "Monitor"}: ${before.host} \u2192 ${after.host}`);
  if (after.kind === "http" && before.url !== after.url) out.push(`Address: ${before.url} \u2192 ${after.url}`);
  if (after.kind === "http" && rule(before) !== rule(after)) out.push(`Keyword rule: ${rule(before)} \u2192 ${rule(after)}`);
  if (after.kind === "heartbeat" && before.hb_every_ms !== after.hb_every_ms) out.push(`Runs every: ${everyText(before.hb_every_ms ?? 0)} \u2192 ${everyText(after.hb_every_ms ?? 0)}`);
  if (after.kind === "heartbeat" && before.hb_grace_ms !== after.hb_grace_ms) out.push(`Can be late by: ${everyText(before.hb_grace_ms ?? 0)} \u2192 ${everyText(after.hb_grace_ms ?? 0)}`);
  return out;
}

export async function sendEditNotice(opts: {
  monitor: MonitorRow;
  /** The monitor as it was before the edit. */
  before: MonitorRow;
  uptimeEveryMs: number;
  plan: string;
}): Promise<void> {
  const { monitor: m, before, uptimeEveryMs } = opts;
  const oldHost = before.host;
  const health = describeHealth(m);

  const details =
    `What changed\n` +
    `${changes(before, m).join("\n") || "Settings saved"}\n\n` +
    `New status: ${health.overall}\n` +
    health.lines.join("\n");
  const subject = oldHost === m.host ? `Monitor updated: ${m.host} (${health.overall})` : `Monitor updated: ${oldHost} to ${m.host} (${health.overall})`;
  tellChannels(m.user_id, opts.plan, { kind: "edited", subject, body: details });

  let emailed = false;
  try {
    const sent = await emailRecipients(m.user_id, {
      subject,
      text:
        (oldHost === m.host ? `Your monitor for ${m.host} was updated.\n\n` : `Your monitor was updated. It now watches ${m.host} instead of ${oldHost}.\n\n`) +
        `${details}\n\n` +
        `We've cleared what we knew from before and started checking again. From now on:\n` +
        watchLines(m, uptimeEveryMs)
          .map((l) => `- ${l}`)
          .join("\n") +
        `\n\nWe'll email you if anything needs attention.\n\n` +
        `See its status: ${appUrl()}/dashboard\n\n` +
        `If you didn't make this change, log in and review your sites on the Sites tab.`,
    });
    emailed = sent > 0;
  } catch (err) {
    console.error(`edit notice for ${m.host} failed`, err);
  }
  try {
    const message = oldHost === m.host ? `Updated ${m.host}: ${health.overall}` : `Updated ${oldHost} to ${m.host}: ${health.overall}`;
    addEvent({ userId: m.user_id, monitorId: m.id, host: m.host, kind: "edited", message, emailed, details });
  } catch {
    // The monitor was deleted in the meantime; there's nothing to attach a notification to.
  }
}

/**
 * Tells the owner a monitor was removed, with the last thing we knew about it. The notification is
 * kept even though the monitor is gone, and records honestly whether the email went out.
 * Returns whether the email was sent.
 */
export async function sendRemovalNotice(opts: { monitor: MonitorRow; plan: string }): Promise<boolean> {
  const { monitor: m } = opts;
  const health = describeHealth(m);
  const since = new Date(m.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

  const details =
    `Site: ${m.host}\n` +
    `Watched since: ${since}\n\n` +
    `Last known status: ${health.overall}\n` +
    health.lines.join("\n");

  tellChannels(m.user_id, opts.plan, { kind: "removed", subject: `Stopped watching ${m.host}`, body: details });

  let emailed = false;
  try {
    const sent = await emailRecipients(m.user_id, {
      subject: `Stopped watching ${m.host}`,
      text:
        `You removed ${m.host} from your monitors. We've stopped checking it, so you won't get any more alerts about it.\n\n` +
        `${details}\n\n` +
        `Your earlier notifications about it are still in your dashboard. You can start watching it again any time: ${appUrl()}/dashboard/sites\n\n` +
        `If you didn't remove this site, log in and review your account.`,
    });
    emailed = sent > 0;
  } catch (err) {
    console.error(`removal notice for ${m.host} failed`, err);
  }
  try {
    addEvent({ userId: m.user_id, monitorId: m.id, host: m.host, kind: "removed", message: `Stopped watching ${m.host}`, emailed, details });
  } catch (err) {
    console.error(`couldn't record the removal of ${m.host}`, err);
  }
  return emailed;
}
