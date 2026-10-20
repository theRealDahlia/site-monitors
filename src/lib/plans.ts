// The single source of truth for plans. The home page and the pricing page both read this, so they
// can't disagree. Only the free plan exists today: the others are plans we intend to offer, and
// nothing here can be bought yet.

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
    summary: "5 sites with uptime, SSL and domain checks and email alerts",
    features: [
      "Watch up to 5 sites",
      "Uptime checked every 5 minutes",
      "SSL certificate and domain expiry checks",
      "Email alerts when something needs attention",
      "Alerts to up to 5 more email addresses",
      "Dashboard with notification history",
    ],
    available: true,
  },
  {
    name: "Starter",
    price: 9,
    summary: "25 sites, 1-minute checks, Slack and Discord",
    features: ["Watch up to 25 sites", "Uptime checked every minute", "Slack and Discord alerts", "A public status page for each site", "Your own logo, name and colours"],
    available: false,
  },
  {
    name: "Pro",
    price: 29,
    summary: "100 sites, AI-visibility checks, white-label status page",
    features: [
      "Watch up to 100 sites",
      "Everything in Starter",
      "Alerts to up to 10 more email addresses",
      "AI-visibility checks: can AI search tools read your site?",
      "White-label status pages on your own domain",
    ],
    available: false,
  },
  {
    name: "Agency",
    price: 79,
    summary: "500 sites, client workspaces, monthly client reports",
    features: [
      "Watch up to 500 sites",
      "Everything in Pro",
      "Alerts to up to 20 more email addresses",
      "Separate workspaces for each client",
      "Monthly health reports to send to clients",
      "Team seats",
    ],
    available: false,
  },
];

/** One row of the comparison table: a feature and what each plan gets, in the same order as PLANS. */
export const COMPARISON: { feature: string; values: (string | boolean)[] }[] = [
  { feature: "Sites you can watch", values: ["5", "25", "100", "500"] },
  { feature: "Uptime check interval", values: ["5 minutes", "1 minute", "1 minute", "1 minute"] },
  { feature: "SSL certificate expiry alerts", values: [true, true, true, true] },
  { feature: "Domain expiry alerts", values: [true, true, true, true] },
  { feature: "Email alerts", values: [true, true, true, true] },
  { feature: "Extra alert email addresses", values: ["5", "5", "10", "20"] },
  { feature: "Your own logo, name and colours", values: [false, true, true, true] },
  { feature: "Dashboard and notification history", values: [true, true, true, true] },
  { feature: "Slack and Discord alerts", values: [false, true, true, true] },
  { feature: "Public status page", values: [false, true, true, true] },
  { feature: "White-label status page", values: [false, false, true, true] },
  { feature: "AI-visibility checks", values: [false, false, true, true] },
  { feature: "Client workspaces and reports", values: [false, false, false, true] },
  { feature: "Team seats", values: [false, false, false, true] },
];
