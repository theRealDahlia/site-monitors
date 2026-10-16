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
}

export const ENTITLEMENTS = {
  free: { name: "Free", maxMonitors: 5, uptimeEveryMs: 5 * MIN, integrations: false, statusPages: false },
  starter: { name: "Starter", maxMonitors: 25, uptimeEveryMs: MIN, integrations: true, statusPages: true },
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
