import { DOMAIN_THRESHOLDS, SSL_THRESHOLDS } from "./alerts";
import { appUrl, sendMail } from "./mail";
import { DOMAIN_EVERY, SSL_EVERY, UPTIME_EVERY, everyText } from "./monitor-config";
import { describeHealth } from "./monitor-summary";
import { type MonitorRow, addEvent } from "./monitors-db";

const list = (nums: number[]) => {
  const sorted = [...nums].sort((a, b) => b - a);
  return `${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
};

/** Emails the owner to confirm that a monitor now exists and is watching a specific site. */
export async function sendWatchConfirmation(opts: {
  monitorId: number;
  userId: number;
  host: string;
  email: string;
  createdAt: number;
}): Promise<void> {
  const added = new Date(opts.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const subject = `Now watching ${opts.host}`;

  await sendMail({
    to: opts.email,
    subject,
    text:
      `Your monitor for ${opts.host} has been created and is now active.\n\n` +
      `Here's what we're watching:\n` +
      `- Uptime: checked every ${everyText(UPTIME_EVERY)}\n` +
      `- SSL certificate: checked every ${everyText(SSL_EVERY)}, with warnings ${list(SSL_THRESHOLDS)} days before it expires\n` +
      `- Domain registration: checked every ${everyText(DOMAIN_EVERY)}, with warnings ${list(DOMAIN_THRESHOLDS)} days before it expires\n\n` +
      `We'll email you at this address if the site goes down or something is about to expire, and again when it's back up.\n\n` +
      `See its status: ${appUrl()}/dashboard\n` +
      `Added on ${added} (UTC).\n\n` +
      `If you didn't add this site, log in and remove it from the Manage sites tab.`,
  });
  addEvent(opts.monitorId, opts.userId, "created", `Started watching ${opts.host}`, true, Date.now());
}

/**
 * Tells the owner their monitor was edited: what changed, its new status, and the health of the new
 * site. The same text is saved as a notification, so the Notifications tab matches the email. The
 * notification is recorded even if the email can't be sent, and says so.
 */
export async function sendEditNotice(opts: { monitor: MonitorRow; oldHost: string; email: string }): Promise<void> {
  const { monitor: m, oldHost, email } = opts;
  const health = describeHealth(m);

  const details =
    `What changed\n` +
    `Site: ${oldHost} \u2192 ${m.host}\n\n` +
    `New status: ${health.overall}\n` +
    health.lines.join("\n");
  const subject = `Monitor updated: ${oldHost} to ${m.host} (${health.overall})`;

  let emailed = true;
  try {
    await sendMail({
      to: email,
      subject,
      text:
        `Your monitor was updated. It now watches ${m.host} instead of ${oldHost}.\n\n` +
        `${details}\n\n` +
        `We've cleared everything we knew about ${oldHost} and run all the checks again on ${m.host}. ` +
        `From now on we'll check uptime every ${everyText(UPTIME_EVERY)}, the SSL certificate every ${everyText(SSL_EVERY)} ` +
        `and the domain registration every ${everyText(DOMAIN_EVERY)}, and email you at this address if anything needs attention.\n\n` +
        `See its status: ${appUrl()}/dashboard\n\n` +
        `If you didn't make this change, log in and review your sites on the Manage sites tab.`,
    });
  } catch (err) {
    emailed = false;
    console.error(`edit notice for ${m.host} failed`, err);
  }
  try {
    addEvent(m.id, m.user_id, "edited", `Updated ${oldHost} to ${m.host}: ${health.overall}`, emailed, Date.now(), details);
  } catch {
    // The monitor was deleted in the meantime; there's nothing to attach a notification to.
  }
}
