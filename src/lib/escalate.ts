import { readTargets } from "./alert-targets";
import { emailRecipients } from "./alert-emails";
import { sendAlertToChannels } from "./channels";
import { db } from "./db";
import { ackLink, dueEscalations } from "./escalation";
import { everyText } from "./monitor-config";
import { addEvent, getMonitorWithOwner } from "./monitors-db";

/**
 * Tells the people in each account's escalation rule about outages nobody has acknowledged in time. Called by the
 * scheduler. Each outage is escalated once: it's marked before anything is sent, so a slow send can't repeat it.
 */
export async function runEscalations(now = Date.now()): Promise<number> {
  let count = 0;
  for (const due of dueEscalations(now)) {
    const claimed = db().prepare("UPDATE monitors SET escalated_at = ? WHERE id = ? AND escalated_at IS NULL AND ack_at IS NULL").run(now, due.id);
    if (Number(claimed.changes) === 0) continue;
    const m = getMonitorWithOwner(due.id);
    const only = readTargets(due.targets);
    if (!m || !only || !m.down_since) continue;

    const subject = `Escalated: ${m.host} is still down`;
    const body =
      `${m.host} has been down since ${new Date(m.down_since).toUTCString()}, and nobody has acknowledged the alert in ${everyText(due.after_ms)}.\n\n` +
      `Last error: ${m.up_error ?? "no response"}\n\n` +
      `Acknowledge it: ${ackLink(m.id, m.down_since)}\n\n` +
      `You're getting this because you're in this account's escalation rule.`;
    let emailed = 0;
    try {
      emailed = await emailRecipients(m.user_id, { subject, text: body }, only);
    } catch (err) {
      console.error(`escalation email for ${m.host} failed`, err);
    }
    await sendAlertToChannels(m.user_id, m.owner_plan, { subject, body, kind: "down" }, only).catch((err) => console.error(`escalation to channels for ${m.host} failed`, err));
    addEvent({ userId: m.user_id, monitorId: m.id, host: m.host, kind: "escalated", message: `${subject}: nobody acknowledged it in ${everyText(due.after_ms)}`, emailed: emailed > 0 });
    count++;
  }
  return count;
}
