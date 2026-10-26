import { SUPPORT_EMAIL, BRAND } from "./brand";
import { sendMail } from "./mail";

// Tells the owner by email when something breaks on the server or in a visitor's browser. Many errors repeat (one bad
// page hit a hundred times), so the same error is only emailed once in a while, and there's a cap on the total per hour.
// Reporting must never make things worse: nothing here throws, and a failed email is only logged.

const SAME_ERROR_MS = 30 * 60_000;
const HOUR_MS = 60 * 60_000;
const MAX_PER_HOUR = 10;

const lastSent = new Map<string, number>();
const sentTimes: number[] = [];

/** Where error emails go: ERROR_ALERT_EMAIL, or the support address. */
const recipient = () => process.env.ERROR_ALERT_EMAIL?.trim() || SUPPORT_EMAIL;

/** Errors that are part of normal operation, not problems: a page that doesn't exist, a redirect, a closed connection. */
function expected(err: unknown): boolean {
  const text = `${(err as { digest?: unknown })?.digest ?? ""} ${err instanceof Error ? err.message : String(err)}`;
  return /NEXT_(NOT_FOUND|REDIRECT|HTTP_ERROR_FALLBACK)|aborted|ECONNRESET|socket hang up|Script error\.?$|ResizeObserver loop/i.test(text);
}

export interface ErrorDetail {
  /** Where it happened: "server", "browser", "scheduler"... */
  source: string;
  /** The address or job involved. */
  where?: string;
  extra?: string;
}

/** Logs an error and, in production, emails it (throttled). Safe to call from anywhere; never throws. */
export async function reportError(err: unknown, detail: ErrorDetail): Promise<void> {
  try {
    if (expected(err)) return;
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? "") : "";
    console.error(`[error] ${detail.source}${detail.where ? ` ${detail.where}` : ""}:`, err);

    if (process.env.NODE_ENV !== "production") return;
    const now = Date.now();
    const key = `${detail.source}|${detail.where ?? ""}|${message.slice(0, 120)}`;
    if (now - (lastSent.get(key) ?? 0) < SAME_ERROR_MS) return;
    while (sentTimes.length && now - sentTimes[0] > HOUR_MS) sentTimes.shift();
    if (sentTimes.length >= MAX_PER_HOUR) return;
    lastSent.set(key, now);
    sentTimes.push(now);
    if (lastSent.size > 500) for (const [k, t] of lastSent) if (now - t > SAME_ERROR_MS) lastSent.delete(k);

    await sendMail({
      to: recipient(),
      subject: `[${BRAND} error] ${detail.source}: ${message.slice(0, 90)}`,
      text:
        `Something went wrong on ${BRAND}.\n\n` +
        `Where: ${detail.source}${detail.where ? ` (${detail.where})` : ""}\n` +
        `Error: ${message}\n` +
        `Time: ${new Date(now).toUTCString()}\n` +
        (detail.extra ? `${detail.extra}\n` : "") +
        (stack ? `\n${stack.slice(0, 3000)}\n` : "") +
        `\nThe same error isn't emailed again for 30 minutes, and at most ${MAX_PER_HOUR} are sent an hour. Full details are in the server log: journalctl -u site-monitors -n 100 --no-pager`,
    });
  } catch (sendFailure) {
    console.error("[error] couldn't report an error:", sendFailure);
  }
}
