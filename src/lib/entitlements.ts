import { MIN } from "./monitor-config";

// What each plan is allowed to do. The pricing page lists the same things for people; this is the
// version the server actually enforces. Payment isn't built yet, so an account's plan is set by an
// admin (see scripts/set-plan.mjs), and nobody can upgrade themselves.

export interface Entitlements {
  name: string;
  /** How many sites an account can watch. */
  maxMonitors: number;
  /** How often each site's uptime is checked. */
  uptimeEveryMs: number;
  /** Slack and Discord alert channels. */
  integrations: boolean;
  /** A public status page for each site. */
  statusPages: boolean;
  /**
   * How many more addresses, besides the account's own, can get alert emails. Agency, when it's added,
   * gets 20.
   */
  maxExtraEmails: number;
  /**
   * How many sites can be added in an hour. It stops add-and-remove loops that would flood inboxes, but
   * it's sized to the plan: someone setting up 100 client sites can't wait ten hours.
   */
  addsPerHour: number;
  /**
   * The most alert emails an account is sent in a day, so a mass outage can't flood inboxes. Notices about
   * adding, editing or removing a site don't count towards it, and Slack and Discord aren't limited by it.
   */
  maxEmailsPerDay: number;
  /** Daily checks of whether AI search tools can read each site (see ai-visibility.ts). */
  aiVisibility: boolean;
  /** Status pages on the account's own domain, with no Site Monitors branding. */
  whiteLabel: boolean;
}

export const ENTITLEMENTS = {
  free: { name: "Free", maxMonitors: 5, uptimeEveryMs: 5 * MIN, integrations: false, statusPages: false, maxExtraEmails: 5, addsPerHour: 10, maxEmailsPerDay: 40, aiVisibility: false, whiteLabel: false },
  starter: { name: "Starter", maxMonitors: 25, uptimeEveryMs: MIN, integrations: true, statusPages: true, maxExtraEmails: 5, addsPerHour: 10, maxEmailsPerDay: 40, aiVisibility: false, whiteLabel: false },
  // Pro is everything in Starter with room for more, plus AI-visibility checks and white-label status pages.
  pro: { name: "Pro", maxMonitors: 100, uptimeEveryMs: MIN, integrations: true, statusPages: true, maxExtraEmails: 10, addsPerHour: 30, maxEmailsPerDay: 200, aiVisibility: true, whiteLabel: true },
} as const satisfies Record<string, Entitlements>;

/** Every plan there is. Adding a plan to ENTITLEMENTS adds it here, to the types and to the admin plan switcher. */
export type PlanId = keyof typeof ENTITLEMENTS;
export const PLAN_IDS = Object.keys(ENTITLEMENTS) as PlanId[];

/** Exact match against the real plans (never the `in` operator, which also matches names like "constructor"). */
export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && Object.hasOwn(ENTITLEMENTS, value);
}

/** Anything unrecognised is treated as the free plan, so a bad value can never grant extra access. */
export function planId(value: string | null | undefined): PlanId {
  return isPlanId(value) ? value : "free";
}

export function entitlementsFor(value: string | null | undefined): Entitlements {
  return ENTITLEMENTS[planId(value)];
}
