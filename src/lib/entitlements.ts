import { MIN } from "./monitor-config";
import type { MonitorKind } from "./monitor-kinds";

// What each plan is allowed to do. The pricing page lists the same things for people; this is the
// version the server actually enforces. An account's plan follows its Stripe subscription (see billing.ts), and an
// admin can still set one by hand (see scripts/set-plan.mjs), for example to give someone a plan free.

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
  /** Which kinds of monitor the account can add (see monitor-kinds.ts). All of them count towards maxMonitors. */
  monitorKinds: readonly MonitorKind[];
  /** The Appearance settings on the Account page: the account's own logo, name, light or dark, and accent colour. */
  branding: boolean;
  /**
   * How many more addresses, besides the account's own, can get alert emails.
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
  /** Visitors can subscribe to a status page by email. (Its RSS feed comes with any status page.) */
  statusSubscribers: boolean;
  /** Choosing which addresses and channels get each monitor's alerts. */
  alertRouting: boolean;
  /** Telling someone else when an outage alert isn't acknowledged in time. */
  escalation: boolean;
  /** Monthly uptime reports emailed to clients. */
  reports: boolean;
  /** How many other people can be invited to work in the account (0 means teams aren't included). */
  teamSeats: number;
  /** Keys for the read-only API. */
  apiAccess: boolean;
  /** How far back uptime history can be seen, in days. */
  historyDays: number;
  /** The daily health scan of each site: DNS changes, email setup and security headers. */
  healthScans: boolean;
  /** The weekly broken-link check, as part of the health scan. */
  brokenLinks: boolean;
  /** Client groups: label sites by client, and give each client its own status page, branding and reports. */
  clients: boolean;
  /** Importing sites from a list, and changing many monitors at once. */
  bulkTools: boolean;
  /** API requests allowed per key per minute (0 when the plan has no API). */
  apiPerMinute: number;
  /** How many API keys the account can have. */
  apiKeys: number;
  /** The most events one API request can return. */
  apiEventsMax: number;
}

export const ENTITLEMENTS = {
  free: { name: "Free", maxMonitors: 5, uptimeEveryMs: 5 * MIN, integrations: false, statusPages: false, monitorKinds: ["site", "http"], branding: false, maxExtraEmails: 5, addsPerHour: 10, maxEmailsPerDay: 40, aiVisibility: false, whiteLabel: false, statusSubscribers: false, alertRouting: false, escalation: false, reports: false, teamSeats: 0, apiAccess: false, historyDays: 30, healthScans: false, brokenLinks: false, clients: false, bulkTools: false, apiPerMinute: 0, apiKeys: 0, apiEventsMax: 0 },
  starter: { name: "Starter", maxMonitors: 25, uptimeEveryMs: MIN, integrations: true, statusPages: true, monitorKinds: ["site", "http", "tcp", "heartbeat"], branding: true, maxExtraEmails: 5, addsPerHour: 10, maxEmailsPerDay: 40, aiVisibility: false, whiteLabel: false, statusSubscribers: false, alertRouting: true, escalation: false, reports: false, teamSeats: 0, apiAccess: false, historyDays: 90, healthScans: true, brokenLinks: false, clients: false, bulkTools: false, apiPerMinute: 0, apiKeys: 0, apiEventsMax: 0 },
  // Pro is everything in Starter with room for more, plus AI-visibility checks and white-label status pages.
  pro: { name: "Pro", maxMonitors: 100, uptimeEveryMs: MIN, integrations: true, statusPages: true, monitorKinds: ["site", "http", "tcp", "heartbeat"], branding: true, maxExtraEmails: 10, addsPerHour: 30, maxEmailsPerDay: 200, aiVisibility: true, whiteLabel: true, statusSubscribers: true, alertRouting: true, escalation: true, reports: true, teamSeats: 3, apiAccess: true, historyDays: 365, healthScans: true, brokenLinks: true, clients: false, bulkTools: false, apiPerMinute: 120, apiKeys: 5, apiEventsMax: 200 },
  // Agency is everything in Pro with room for 500 monitors and 20 team seats, plus client groups and bulk tools, two years of
  // history and a bigger API allowance.
  agency: { name: "Agency", maxMonitors: 500, uptimeEveryMs: MIN, integrations: true, statusPages: true, monitorKinds: ["site", "http", "tcp", "heartbeat"], branding: true, maxExtraEmails: 20, addsPerHour: 600, maxEmailsPerDay: 1000, aiVisibility: true, whiteLabel: true, statusSubscribers: true, alertRouting: true, escalation: true, reports: true, teamSeats: 20, apiAccess: true, historyDays: 730, healthScans: true, brokenLinks: true, clients: true, bulkTools: true, apiPerMinute: 600, apiKeys: 20, apiEventsMax: 1000 },
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
