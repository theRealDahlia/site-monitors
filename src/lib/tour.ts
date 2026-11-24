// The words for the welcome tour (shown once, at a new person's first login) and for the Getting started page (always available
// from the Help menu). They share one source so the two can't drift apart. Every plan detail here comes from plans.ts and
// entitlements.ts: if a plan changes, check this file too.

export interface TourStep {
  id: string;
  title: string;
  /** What the person sees in the left-hand menu for this part of the app, shown as a hint. */
  menu?: string;
  paragraphs: string[];
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Site Monitors",
    paragraphs: [
      "Site Monitors watches your websites around the clock and emails you when something needs attention, before your visitors or your clients notice.",
      "For each site we check that it's up, that its SSL certificate is valid, and when its domain registration runs out. The free plan covers 5 monitors.",
      "This quick tour shows you where everything is. It takes about a minute.",
    ],
  },
  {
    id: "add",
    title: "Add a site to start watching it",
    menu: "Sites",
    paragraphs: [
      "Open Sites and type a domain, such as example.com. We start checking straight away: no code to install and nothing to change on the site.",
      "Besides a whole website, you can watch a single page (with an optional keyword that must, or must not, appear), a server port, or a heartbeat for a scheduled job such as a nightly backup. Ports and heartbeats are on the Starter plan and up.",
    ],
  },
  {
    id: "overview",
    title: "See how everything is at a glance",
    menu: "Overview",
    paragraphs: [
      "Overview is where you land. It counts your sites that are fine, that need a look and that are down, and lists exactly what needs attention first, most serious on top.",
      "Click any site to see its uptime history, certificate, domain details and a Check now button that re-checks it on the spot.",
    ],
  },
  {
    id: "alerts",
    title: "Get told before it becomes a problem",
    menu: "Notifications and Integrations",
    paragraphs: [
      "Alerts go to your email by default. You get emailed when a site goes down, and ahead of expiry: 60, 30, 14, 7 and 1 days before a domain runs out, and 30, 14, 7, 3 and 1 days before a certificate does.",
      "Notifications keeps a record of every alert and whether it was emailed. On Integrations you can add more email addresses, and on the Starter plan and up send alerts to Slack or Discord.",
    ],
  },
  {
    id: "clients",
    title: "Keep clients in the loop",
    menu: "Sites, Reports and Clients",
    paragraphs: [
      "From the Starter plan, each site can have a public status page you share with the client, with incident updates and planned maintenance. Your own logo, name and colours go on it from the Account page.",
      "Pro adds monthly uptime reports emailed to clients and status pages on your own domain. Agency adds client groups, each with its own status page, look and reports.",
    ],
  },
  {
    id: "help",
    title: "Help is always in the menu",
    menu: "Getting started and Guides",
    paragraphs: [
      "Getting started has a short guide to every tool and how to use it, and you can replay this tour from there. Guides covers the problems that quietly take websites down, such as expired certificates, lapsed domains and failed renewals.",
      "If you're stuck, Contact us reaches a person. Ready? Add your first site and we'll take it from there.",
    ],
  },
];

export interface Tool {
  id: string;
  title: string;
  /** The menu item to click. */
  menu: string;
  href: string;
  /** What it is, in a sentence or two. */
  summary: string;
  /** How to use it, in order. */
  steps: string[];
  /** Which plans have it, when it isn't every plan. */
  plan?: string;
}

export const TOOLS: Tool[] = [
  {
    id: "sites",
    title: "Sites",
    menu: "Sites",
    href: "/dashboard/sites",
    summary: "Where you add and manage everything you want watched. Each site shows its uptime, SSL certificate and domain status in one list.",
    steps: [
      "Choose what to watch: a Website (uptime, SSL certificate and domain expiry), a Page (one address, optionally with a keyword that must or must not appear), a Port (a server that should accept connections) or a Heartbeat (a scheduled job that reports in each time it runs).",
      "Type the domain or address and add it. Checking starts straight away.",
      "Click a site to see its history, the certificate and domain details, and to re-check it with Check now.",
      "To stop watching something, remove it from its row. Removing a site doesn't touch the site itself.",
    ],
    plan: "Free: 5 monitors, uptime checked every 5 minutes. Starter and up: more monitors, checks every minute, plus ports and heartbeats.",
  },
  {
    id: "overview",
    title: "Overview",
    menu: "Overview",
    href: "/dashboard",
    summary: "Your starting point. It shows how many sites are fine, need a look or are down, and recent activity.",
    steps: [
      "Check the tiles at the top: sites watched, all good, need a look and down.",
      "Read Needs attention. Each site lists its reasons, most serious first, such as a certificate expiring soon or a domain close to its expiry date. Click one to open it.",
      "Recent activity shows the latest alerts. Open Notifications for the full list.",
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    menu: "Notifications",
    href: "/dashboard/notifications",
    summary: "A record of every alert and update about your sites, and whether it was emailed.",
    steps: [
      "Look here when you want to know what we told you, and when.",
      "You're emailed when a site goes down, and ahead of expiry: 60, 30, 14, 7 and 1 days before a domain runs out, and 30, 14, 7, 3 and 1 days before a certificate does.",
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    menu: "Integrations",
    href: "/dashboard/integrations",
    summary: "Choose where alerts go.",
    steps: [
      "Add extra email addresses, such as a shared inbox or a colleague, so one person on holiday doesn't mean a missed alert.",
      "Connect Slack or Discord and we'll create a #site-monitors-alerts channel for your alerts.",
    ],
    plan: "Slack and Discord are on Starter and up.",
  },
  {
    id: "status",
    title: "Status pages",
    menu: "Sites",
    href: "/dashboard/sites",
    summary: "A public page for a site showing its current status, recent uptime, incidents and planned maintenance, so clients can check without asking you.",
    steps: [
      "Open a site and turn on its status page. You get a link that can't be guessed, and you share it with the client.",
      "Post an incident with a short title and update it as you work: investigating, identified, monitoring, resolved.",
      "Schedule maintenance with a start and end time, so planned downtime doesn't look like an outage.",
      "Add your own logo, name and colours on the Account page.",
    ],
    plan: "Starter and up. Pro adds email updates for visitors and status pages on your own domain.",
  },
  {
    id: "reports",
    title: "Reports",
    menu: "Reports",
    href: "/dashboard/reports",
    summary: "A monthly uptime report for each client, with your logo and colours, emailed on the 1st of each month.",
    steps: ["Create a report and choose the sites it covers, or a client's sites.", "Add the email addresses to send it to. Each person confirms their address by email first.", "Each monthly email links to a full report your client can save as a PDF."],
    plan: "Pro and up.",
  },
  {
    id: "clients",
    title: "Clients",
    menu: "Clients",
    href: "/dashboard/clients",
    summary: "Group your sites by client. Each client gets its own status page, look and reports.",
    steps: ["Create a client and put its sites in the group.", "Filter the Sites page by client to see only that client's sites."],
    plan: "Agency.",
  },
  {
    id: "white-label",
    title: "White label",
    menu: "White label",
    href: "/dashboard/white-label",
    summary: "Put status pages on your own domain, such as status.clientname.com, without the Site Monitors credit.",
    steps: ["Choose the address and add the DNS records the page shows you.", "Click Check DNS. The certificate is set up automatically."],
    plan: "Pro and up.",
  },
  {
    id: "ai",
    title: "AI visibility",
    menu: "AI visibility",
    href: "/dashboard/ai-visibility",
    summary: "A daily check of whether AI search tools can read each of your sites.",
    steps: ["Open the page to see the result for each site.", "Use the result to spot sites that AI tools can't read, so you can fix them."],
    plan: "Pro and up.",
  },
  {
    id: "team",
    title: "Team",
    menu: "Team",
    href: "/dashboard/team",
    summary: "Invite people to work in the account with their own logins: the same monitors, alerts and settings.",
    steps: ["Enter a colleague's email to invite them.", "Only the account owner manages the team."],
    plan: "Pro: 3 team members. Agency: 20.",
  },
  {
    id: "api",
    title: "API & export",
    menu: "API & export",
    href: "/dashboard/api",
    summary: "Download all of your data, or read it from your own tools with an API key.",
    steps: ["Use the export to download your data.", "Create an API key to read your monitors from your own scripts."],
    plan: "Export is on every plan. The API is on Pro and up.",
  },
  {
    id: "plans",
    title: "Plans and account",
    menu: "Plans and Account",
    href: "/dashboard/plans",
    summary: "Compare plans and change yours on Plans. On Account you see your sign-in details and, from Starter, set your own logo, name and colours.",
    steps: ["Plans: Free, Starter ($9 a month), Pro ($29) and Agency ($79).", "Account: your sign-in details, your own logo, name and colours (from Starter) and account deletion."],
  },
  {
    id: "guides",
    title: "Guides and Contact us",
    menu: "Guides",
    href: "/dashboard/guides",
    summary: "Step-by-step help for the problems that quietly take sites down, and a way to reach a person.",
    steps: ["Read a guide when an alert needs fixing, such as an expired certificate or a failed renewal.", "Use Contact us when you're stuck."],
  },
];
