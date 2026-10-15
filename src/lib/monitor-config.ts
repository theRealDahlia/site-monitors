const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export { DAY, HOUR, MIN };

// How often each check runs, and how soon to retry when it couldn't get an answer.
export const UPTIME_EVERY = 5 * MIN;
export const UPTIME_RECHECK = MIN; // after a first failure, look again quickly to confirm
export const SSL_EVERY = 6 * HOUR;
export const SSL_RETRY = 5 * MIN;
export const DOMAIN_EVERY = 12 * HOUR;
export const DOMAIN_RETRY = HOUR;
export const DOMAIN_UNSUPPORTED_EVERY = 7 * DAY;

/** "5 minutes", "6 hours", "1 hour". */
export function everyText(ms: number): string {
  if (ms % HOUR === 0) {
    const h = ms / HOUR;
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const m = Math.round(ms / MIN);
  return `${m} ${m === 1 ? "minute" : "minutes"}`;
}
