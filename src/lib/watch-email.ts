import { DOMAIN_THRESHOLDS, SSL_THRESHOLDS } from "./alerts";
import { sendAlertToChannels } from "./channels";
import { emailRecipients } from "./alert-emails";
import { appUrl } from "./mail";
import { DOMAIN_EVERY, SSL_EVERY, everyText } from "./monitor-config";
import { describeHealth } from "./monitor-summary";
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

/** Emails the owner to confirm that a monitor now exists and is watching a specific site. */
export async function sendWatchConfirmation(opts: {
  monitorId: number;
  userId: number;
  host: string;
  createdAt: number;
  /** How often this account's uptime checks run, in milliseconds. */
  uptimeEveryMs: number;
  /** The account's plan, which decides whether Slack and Discord get this too. */
  plan: string;
}): Promise<void> {
  const added = new Date(opts.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const subject = `Now watching ${opts.host}`;

  tellChannels(opts.userId, opts.plan, {
    kind: "created",
    subject,
    body:
      `Your monitor for ${opts.host} is now active.\n` +
      `• Uptime: checked every ${everyText(opts.uptimeEveryMs)}\n` +
      `• SSL certificate: checked every ${everyText(SSL_EVERY)}\n` +
      `• Domain registration: checked every ${everyText(DOMAIN_EVERY)}`,
  });

  const sent = await emailRecipients(opts.userId, {
    subject,
    text:
      `Your monitor for ${opts.host} has been created and is now active.\n\n` +
      `Here's what we're watching:\n` +
      `- Uptime: checked every ${everyText(opts.uptimeEveryMs)}\n` +
      `- SSL certificate: checked every ${everyText(SSL_EVERY)}, with warnings ${list(SSL_THRESHOLDS)} days before it expires\n` +
      `- Domain registration: checked every ${everyText(DOMAIN_EVERY)}, with warnings ${list(DOMAIN_THRESHOLDS)} days before it expires\n\n` +
      `We'll email you if the site goes down or something is about to expire, and again when it's back up.\n\n` +
      `See its status: ${appUrl()}/dashboard\n` +
      `Added on ${added} (UTC).\n\n` +
      `If you didn't add this site, log in and remove it from the Sites tab.`,
  });
  addEvent({ userId: opts.userId, monitorId: opts.monitorId, host: opts.host, kind: "created", message: `Started watching ${opts.host}`, emailed: sent > 0 });
}

/**
 * Tells the owner their monitor was edited: what changed, its new status, and the health of the new
 * site. The same text is saved as a notification, so the Notifications tab matches the email. The
 * notification is recorded even if the email can't be sent, and says so.
 */
export async function sendEditNotice(opts: {
  monitor: MonitorRow;
  oldHost: string;
  uptimeEveryMs: number;
  plan: string;
}): Promise<void> {
  const { monitor: m, oldHost, uptimeEveryMs } = opts;
  const health = describeHealth(m);

  const details =
    `What changed\n` +
    `Site: ${oldHost} \u2192 ${m.host}\n\n` +
    `New status: ${health.overall}\n` +
    health.lines.join("\n");
  const subject = `Monitor updated: ${oldHost} to ${m.host} (${health.overall})`;
  tellChannels(m.user_id, opts.plan, { kind: "edited", subject, body: details });

  let emailed = false;
  try {
    const sent = await emailRecipients(m.user_id, {
      subject,
      text:
        `Your monitor was updated. It now watches ${m.host} instead of ${oldHost}.\n\n` +
        `${details}\n\n` +
        `We've cleared everything we knew about ${oldHost} and run all the checks again on ${m.host}. ` +
        `From now on we'll check uptime every ${everyText(uptimeEveryMs)}, the SSL certificate every ${everyText(SSL_EVERY)} ` +
        `and the domain registration every ${everyText(DOMAIN_EVERY)}, and email you if anything needs attention.\n\n` +
        `See its status: ${appUrl()}/dashboard\n\n` +
        `If you didn't make this change, log in and review your sites on the Sites tab.`,
    });
    emailed = sent > 0;
  } catch (err) {
    console.error(`edit notice for ${m.host} failed`, err);
  }
  try {
    addEvent({ userId: m.user_id, monitorId: m.id, host: m.host, kind: "edited", message: `Updated ${oldHost} to ${m.host}: ${health.overall}`, emailed, details });
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
