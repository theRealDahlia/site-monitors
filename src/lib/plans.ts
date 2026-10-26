// The single source of truth for plans. The home page and the pricing page both read this, so they
// can't disagree. All four plans can be had today.

export interface Plan {
  name: string;
  price: number;
  /** One line for the home page. */
  summary: string;
  /** The longer list for the pricing page. */
  features: string[];
  available: boolean;
}

export const PLANS: Plan[] = [
  {
    name: "Free",
    price: 0,
    summary: "5 monitors with uptime, SSL and domain checks and email alerts",
    features: [
      "Up to 5 monitors: whole sites, or single pages with a keyword check",
      "Uptime checked every 5 minutes",
      "SSL certificate and domain expiry checks",
      "Email alerts when something needs attention",
      "Alerts to up to 5 more email addresses",
      "30 days of history, and downloads of all your data",
    ],
    available: true,
  },
  {
    name: "Starter",
    price: 9,
    summary: "25 monitors, 1-minute checks, status pages, Slack and Discord",
    features: [
      "Up to 25 monitors, including ports and cron job heartbeats",
      "Uptime checked every minute",
      "Slack and Discord alerts, and choosing who gets each monitor's alerts",
      "A public status page for each site, with incident updates, scheduled maintenance and an RSS feed",
      "A daily health scan: DNS changes, email setup and security headers",
      "Your own logo, name and colours",
      "90 days of history",
    ],
    available: true,
  },
  {
    name: "Pro",
    price: 29,
    summary: "100 monitors, escalation, client reports, white label, a team",
    features: [
      "Up to 100 monitors",
      "Everything in Starter",
      "Escalation when nobody acknowledges an outage",
      "Email updates for your status pages' visitors",
      "Monthly uptime reports for your clients",
      "White-label status pages on your own domain",
      "3 team members with their own logins",
      "AI-visibility checks and a weekly broken-link check",
      "12 months of history and an API",
    ],
    available: true,
  },
  {
    name: "Agency",
    price: 79,
    summary: "500 monitors, client groups with their own pages, bulk tools, 20 seats",
    features: [
      "Up to 500 monitors",
      "Everything in Pro",
      "Group your sites by client, and filter the Sites page by client",
      "One status page per client covering all their sites, on the client's own domain if you like",
      "Each client's own logo and colours on its status page and reports",
      "Import hundreds of sites from a list, and change many monitors at once",
      "20 team members with their own logins",
      "Alerts to up to 20 more email addresses",
    ],
    available: true,
  },
];

/** One row of the comparison table: a feature and what each plan gets, in the same order as PLANS. */
export const COMPARISON: { feature: string; values: (string | boolean)[] }[] = [
  { feature: "Monitors", values: ["5", "25", "100", "500"] },
  { feature: "Uptime check interval", values: ["5 minutes", "1 minute", "1 minute", "1 minute"] },
  { feature: "Whole sites, and single pages with keyword checks", values: [true, true, true, true] },
  { feature: "Port and cron job (heartbeat) monitors", values: [false, true, true, true] },
  { feature: "SSL certificate and domain expiry alerts", values: [true, true, true, true] },
  { feature: "Email alerts", values: [true, true, true, true] },
  { feature: "Extra alert email addresses", values: ["5", "5", "10", "20"] },
  { feature: "Slack and Discord alerts", values: [false, true, true, true] },
  { feature: "Choose who gets each monitor's alerts", values: [false, true, true, true] },
  { feature: "Escalation and acknowledging outages", values: [false, false, true, true] },
  { feature: "Public status page", values: [false, true, true, true] },
  { feature: "Incident updates, maintenance and RSS on status pages", values: [false, true, true, true] },
  { feature: "Email updates for status page visitors", values: [false, false, true, true] },
  { feature: "White-label status page on your own domain", values: [false, false, true, true] },
  { feature: "Your own logo, name and colours", values: [false, true, true, true] },
  { feature: "Daily health scan (DNS, email setup, security headers)", values: [false, true, true, true] },
  { feature: "Weekly broken-link check", values: [false, false, true, true] },
  { feature: "AI-visibility checks", values: [false, false, true, true] },
  { feature: "Monthly client reports", values: [false, false, true, true] },
  { feature: "Team members with their own logins", values: [false, false, "3", "20"] },
  { feature: "History", values: ["30 days", "90 days", "12 months", "12 months"] },
  { feature: "Download your data", values: [true, true, true, true] },
  { feature: "API", values: [false, false, true, true] },
  { feature: "Clients: group sites, with a status page and look for each", values: [false, false, false, true] },
  { feature: "Import sites from a list, and bulk changes", values: [false, false, false, true] },
];
