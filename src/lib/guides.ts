// The articles under /guides. Written as data so every article gets the same layout, the sitemap lists
// them automatically, and a new one is just another entry here plus a one-line page file.
//
// Inline formatting inside any text: [link text](/internal-path or https://address), `code`, **bold**.
// The same articles are shown to visitors (/guides) and inside the app for logged-in users
// (/dashboard/guides). Wording that only fits one place goes in {public}...{/public} or {app}...{/app}.
// Inside the app, links to /guides become /dashboard/guides and /signup becomes the Sites page.
// Facts that can go out of date (certificate lifetime dates, registry rules) say when they were checked.

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "code"; text: string }
  | { type: "note"; title: string; text: string };

export interface Guide {
  slug: string;
  title: string;
  /** For search results and social previews. About 150 characters. */
  description: string;
  /** ISO date the article was last checked or changed. */
  updated: string;
  minutes: number;
  /** Slugs of guides to suggest at the end. */
  related: string[];
  blocks: Block[];
}

export const GUIDES: Guide[] = [
  {
    slug: "ssl-certificate-expired",
    title: "SSL certificate expired: how to fix it",
    description:
      "Visitors see a security warning because your SSL certificate has expired. How to confirm it, renew it for your setup, check it worked, and stop it happening again.",
    updated: "2026-10-16",
    minutes: 6,
    related: ["lets-encrypt-renewal-failed", "47-day-ssl-certificates"],
    blocks: [
      {
        type: "p",
        text: 'When an SSL certificate expires, browsers stop trusting the site and show visitors a full-page warning instead of your pages. Chrome shows "Your connection is not private" with the code `NET::ERR_CERT_DATE_INVALID`. Firefox shows "Warning: Potential Security Risk Ahead" with `SEC_ERROR_EXPIRED_CERTIFICATE`. Most visitors will leave, and anything else that connects to the site over HTTPS, such as an API, a payment webhook or a mobile app, can fail too.',
      },
      {
        type: "p",
        text: "The fix is quick once you know which certificate has expired and where it comes from. Work through these steps in order.",
      },
      { type: "h2", text: "1. Confirm the certificate has expired" },
      {
        type: "p",
        text: "{public}Run the site through the [free SSL checker](/ssl-checker). It shows the expiry date, who issued the certificate, and whether the certificate chain and hostname are set up correctly.{/public}{app}Open the site from [Sites](/dashboard/sites) and click **Check now**. The SSL line shows when the certificate expires and who issued it. If you don't watch the site yet, add it on the same page.{/app} If the expiry date is in the past, that's your problem.",
      },
      {
        type: "p",
        text: "You can also check from a terminal. This prints the dates the certificate is valid between, and `notAfter` is the expiry:",
      },
      {
        type: "code",
        text: "echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | openssl x509 -noout -dates",
      },
      {
        type: "note",
        title: "Not expired? Look for another cause",
        text: "The same warning appears when a visitor's device clock is wrong, so if {public}the checker{/public}{app}your Overview{/app} says the certificate is valid and only one device shows the warning, check that device's date and time. A certificate issued for a different hostname, or one missing its intermediate certificate, also triggers warnings. {public}The checker flags both.{/public}{app}Site Monitors flags both.{/app}",
      },
      { type: "h2", text: "2. Renew it the way it was issued" },
      { type: "p", text: "How you renew depends on where the certificate came from. Find yours in this list." },
      {
        type: "ul",
        items: [
          "**Managed hosting or a control panel (cPanel, Plesk, WordPress hosts).** Look for an SSL/TLS or AutoSSL section and run the renewal or check there. If it keeps failing, your host's support can see the reason. A common one is a domain that no longer points at the host.",
          "**Cloudflare.** The certificates Cloudflare issues to visitors renew automatically. If you see Cloudflare's error 526, the expired certificate is the one on your own server, which Cloudflare checks in Full (strict) mode. Renew that one, or replace it with a Cloudflare Origin CA certificate.",
          "**Let's Encrypt with Certbot on your own server.** Run `sudo certbot renew`, then reload your web server, for example `sudo systemctl reload nginx`. If renewal fails, see [Let's Encrypt renewal failed](/guides/lets-encrypt-renewal-failed).",
          "**A certificate you bought.** Renew or reissue it with the provider, then install the new certificate together with the intermediate certificates they give you, and reload the web server. Use the private key that matches the new certificate request.",
        ],
      },
      { type: "h2", text: "3. Check the new certificate is the one being served" },
      { type: "p", text: "Renewing doesn't help until your server actually uses the new certificate. After installing it:" },
      {
        type: "ul",
        items: [
          "Reload or restart the web server. Most keep the old certificate in memory until they're told to reload.",
          "If several servers sit behind a load balancer, check each one. A single server still holding the old certificate makes the warning appear for some visitors and not others.",
          "If a CDN or proxy sits in front of the site, check its certificate settings too.",
        ],
      },
      {
        type: "p",
        text: "Then {public}run the [SSL checker](/ssl-checker) again{/public}{app}click **Check now** on your [Overview](/dashboard){/app}. It should show the new expiry date. Test in a private browsing window, as a normal one can hold on to the old connection for a while.",
      },
      { type: "h2", text: "4. Stop it happening again" },
      {
        type: "p",
        text: "Certificates don't expire without warning, but nobody is warned unless you set that up. Let's Encrypt, for example, stopped sending expiry emails in June 2025, so a failed automatic renewal can go unnoticed until the certificate lapses.",
      },
      {
        type: "ul",
        items: [
          "Turn on automatic renewal wherever your setup supports it, and confirm it worked after the first renewal, not only that it was configured.",
          "Monitor the certificate itself, from outside, so you hear about a problem weeks before the expiry date. [Site Monitors](/signup) emails you 30, 14, 7, 3 and 1 days before a certificate expires, and flags hostname mismatches and broken chains.{public} It's free for up to 5 sites.{/public}",
          "Expect more renewals, not fewer. Certificate lifetimes are shrinking, to 47 days by 2029, which makes renewing by hand harder to keep up with. See [SSL certificates are moving to 47 days](/guides/47-day-ssl-certificates).",
        ],
      },
    ],
  },
  {
    slug: "how-to-check-when-a-domain-expires",
    title: "How to check when a domain expires",
    description:
      "Find any domain's expiry date in seconds, what happens after it passes, and why auto-renew still lets domains lapse. Includes a command-line method.",
    updated: "2026-10-16",
    minutes: 5,
    related: ["ssl-certificate-expired", "47-day-ssl-certificates"],
    blocks: [
      {
        type: "p",
        text: "A domain name is rented, not owned. A registration runs for a set period, from one to ten years, and if it isn't renewed by the expiry date the website and email on that domain stop working. Finding the date takes under a minute.",
      },
      { type: "h2", text: "The quickest way: {public}a domain expiry checker{/public}{app}your dashboard{/app}" },
      {
        type: "p",
        text: "{public}Enter the domain into the [free domain expiry checker](/domain-checker). It reads the registration directly from the registry and shows the expiry date, the registrar, the registration date and any status codes.{/public}{app}Open the site from [Sites](/dashboard/sites), or add it there. The Domain line shows the expiry date and the registrar, read directly from the registry.{/app} It works for most domains. Some it can't see; more on that below.",
      },
      { type: "h2", text: "From the command line" },
      {
        type: "p",
        text: "Registration data is published through RDAP, the modern replacement for WHOIS. This asks a public RDAP service, which forwards the request to the right registry, and prints the `expiration` entry and the date after it:",
      },
      {
        type: "code",
        text: "curl -sL https://rdap.org/domain/example.com | python3 -m json.tool | grep -A1 '\"expiration\"'",
      },
      {
        type: "p",
        text: 'If you have the older `whois` tool installed, `whois example.com` prints similar details. Look for a line containing "Expiry" or "Expiration"; the exact label varies by registry.',
      },
      { type: "h2", text: "Domains where the date isn't public" },
      {
        type: "p",
        text: "Not every registry publishes the expiry date. Some country-code domains leave it out of public lookups, and some don't offer RDAP at all yet. In that case only the owner can see it: log in to the registrar the domain is registered with and open the domain's page. If a client owns the domain, ask for access to their registrar account or ask them to send you the date.",
      },
      { type: "h2", text: "What happens after the date passes" },
      {
        type: "p",
        text: "The exact steps differ by registry and registrar, but for most .com, .net, .org and similar domains it goes roughly like this:",
      },
      {
        type: "ol",
        items: [
          "**Grace period at the registrar.** The domain has expired but can usually still be renewed at the normal price. Registrars set their own length, from none to around 45 days, and many take the website offline or point it at a parked page straight away.",
          "**Redemption period.** Typically about 30 days. Only the previous owner can recover the domain, through their registrar, and it costs a restore fee on top of the renewal.",
          "**Pending delete.** Around 5 days during which the domain can't be recovered at all.",
          "**Released.** The name becomes available for anyone to register, including people who watch for expiring domains.",
        ],
      },
      {
        type: "p",
        text: "Don't plan around the grace periods. Some registrars have none, country-code domains such as .uk set their own rules, and your site and email may already be down during these stages.",
      },
      { type: "h2", text: "Why auto-renew still lets domains lapse" },
      {
        type: "ul",
        items: [
          "The card on file expired or was declined.",
          "Renewal and warning emails go to an address nobody reads any more, such as a former employee's.",
          "The domain is registered in someone else's account: a previous agency, a freelancer, or a client's personal login.",
          "Auto-renew was never switched on, or was switched off during a transfer.",
        ],
      },
      { type: "h2", text: "Set up reminders that don't depend on the registrar" },
      {
        type: "p",
        text: "Registrar emails are easy to miss. For every domain you look after, put the expiry date somewhere you check yourself, or let a monitor watch it. [Site Monitors](/signup) emails you 60, 30, 14, 7 and 1 days before a domain's registration runs out{public}, free for up to 5 sites{/public}.",
      },
      {
        type: "p",
        text: "If you manage domains for clients, also keep a record of which registrar account each one is in. Whoever holds that account is the one who can renew it.",
      },
    ],
  },
  {
    slug: "47-day-ssl-certificates",
    title: "SSL certificates are moving to 47 days: what to do about it",
    description:
      "Maximum SSL certificate lifetimes are shrinking from 398 days to 47 by 2029. The schedule, who it affects, and how to avoid expired-certificate outages.",
    updated: "2026-10-16",
    minutes: 6,
    related: ["lets-encrypt-renewal-failed", "ssl-certificate-expired"],
    blocks: [
      {
        type: "p",
        text: "Public SSL/TLS certificates are getting much shorter-lived. In April 2025 the CA/Browser Forum, the group of certificate authorities and browser makers that sets the rules for them, approved a schedule that cuts the maximum lifetime of a certificate from 398 days to 47 days over three years.",
      },
      { type: "h2", text: "The schedule" },
      {
        type: "ul",
        items: [
          "**Before 15 March 2026:** up to 398 days.",
          "**From 15 March 2026:** up to 200 days.",
          "**From 15 March 2027:** up to 100 days.",
          "**From 15 March 2029:** up to 47 days.",
        ],
      },
      {
        type: "p",
        text: "The dates apply to when a certificate is issued, so certificates that already exist keep their original lifetime until they expire. The rules cover publicly trusted certificates, not those from a private, internal certificate authority. The length of time a certificate authority may reuse an earlier check that you control a domain shrinks as well, ending at 10 days.",
      },
      {
        type: "p",
        text: "The 200-day limit is already in force. A certificate issued since 15 March 2026 can't last a full year.",
      },
      { type: "h2", text: "Let's Encrypt is shortening its certificates too" },
      {
        type: "p",
        text: "Let's Encrypt, which issues free certificates for a very large number of websites, currently issues certificates valid for 90 days. Its announced plan is:",
      },
      {
        type: "ul",
        items: [
          "**13 May 2026:** 45-day certificates available as an opt-in profile.",
          "**10 February 2027:** the default moves to 64-day certificates.",
          "**16 February 2028:** the default moves to 45-day certificates.",
        ],
      },
      { type: "h2", text: "What it means in practice" },
      {
        type: "p",
        text: "A certificate that lasts about a year needs renewing about once a year. At 47 days that becomes roughly eight times a year, for every certificate you look after. A process that works once a year, such as a calendar reminder followed by someone logging in to a provider and pasting in a new certificate, stops being realistic, especially across many client sites.",
      },
      { type: "h2", text: "Who is most at risk" },
      {
        type: "ul",
        items: [
          "Sites using certificates that were bought and installed by hand.",
          "Sites where a client or a previous developer set up the certificate and nobody on your side knows how it renews.",
          "Servers with a fixed renewal schedule, such as a job that renews every 60 days. That works for 90-day certificates and will miss the window once they last 45.",
          "Anything that quietly stops renewing: a changed firewall rule, a DNS move, an expired payment method.",
        ],
      },
      { type: "h2", text: "What to do now" },
      {
        type: "ol",
        items: [
          "**List every domain and certificate you're responsible for,** and write down who or what renews each one.",
          "**Automate renewal.** Use an ACME client such as Certbot or acme.sh, the automatic SSL built into your hosting or CDN, or a web server that manages certificates itself, such as Caddy.",
          "**Renew on a schedule that adapts.** Run the renewal command often (Certbot is designed to run twice a day) and let it renew only when a certificate is close to expiry, instead of using a fixed interval.",
          "**Monitor the certificate itself, not just the renewal job.** Automation fails quietly. [Let's Encrypt renewal failed](/guides/lets-encrypt-renewal-failed) covers the usual causes.",
          "**Plan a fallback.** For anything you can't automate, decide well before the expiry who renews it and how.",
        ],
      },
      {
        type: "p",
        text: "{public}[Site Monitors](/signup) watches the certificates and domains of every site you add, emails you before they expire, and flags problems like hostname mismatches and broken chains. It's free for up to 5 sites. You can check any site right now with the [free SSL checker](/ssl-checker).{/public}{app}Site Monitors watches the certificates and domains of every site you add, emails you before they expire, and flags problems like hostname mismatches and broken chains. Add or review your sites on [Sites](/dashboard/sites).{/app}",
      },
      {
        type: "note",
        title: "Dates checked October 2026",
        text: "Certificate authorities and browsers can change these plans, so confirm the dates before relying on them. The schedule comes from the CA/Browser Forum's [ballot SC-081](https://cabforum.org/2025/04/11/ballot-sc081v3-introduce-schedule-of-reducing-validity-and-data-reuse-periods/). The Let's Encrypt dates are from its own announcements.",
      },
    ],
  },
  {
    slug: "lets-encrypt-renewal-failed",
    title: "Let's Encrypt renewal failed: causes and fixes",
    description:
      "Certbot couldn't renew your Let's Encrypt certificate. How to find the error, the most common causes, and how to make sure renewals keep working.",
    updated: "2026-10-16",
    minutes: 7,
    related: ["ssl-certificate-expired", "47-day-ssl-certificates"],
    blocks: [
      {
        type: "p",
        text: "Let's Encrypt certificates are meant to renew by themselves, usually through Certbot or a similar tool running on your server. When that stops working, nothing tells you: Let's Encrypt ended its expiration emails on 4 June 2025. The first sign is often visitors seeing a certificate warning. This guide helps you find out why renewal failed and fix it.",
      },
      {
        type: "note",
        title: "Already expired?",
        text: "Start with [SSL certificate expired: how to fix it](/guides/ssl-certificate-expired) to get the site working again, then come back here to fix the cause.",
      },
      { type: "h2", text: "1. Find out what's wrong" },
      { type: "p", text: "Run these on the server. The first lists your certificates and when each one expires:" },
      { type: "code", text: "sudo certbot certificates" },
      { type: "p", text: "This tries a renewal without issuing anything real, and prints the reason if it fails:" },
      { type: "code", text: "sudo certbot renew --dry-run" },
      {
        type: "p",
        text: "Then check that something runs renewal on a schedule. A Certbot install normally sets up a timer or a cron job:",
      },
      { type: "code", text: "systemctl list-timers | grep -i certbot" },
      {
        type: "p",
        text: "If nothing shows up there or in your cron jobs, renewal never runs. The details of each attempt are in `/var/log/letsencrypt/letsencrypt.log`.",
      },
      { type: "h2", text: "2. The usual causes" },
      {
        type: "ul",
        items: [
          "**Port 80 isn't reachable.** The common HTTP-01 check needs Let's Encrypt to reach your server on port 80 from the internet. A firewall or cloud security-group rule that blocks it, or closing port 80 after setup, breaks renewal. On a cloud server, check the provider's firewall as well as the one on the machine.",
          "**The domain no longer points at this server.** If DNS moved, or a proxy or CDN now sits in front, the check reaches somewhere else. Point DNS back, or switch to the DNS challenge (see section 3).",
          "**The challenge address is blocked or changed.** Let's Encrypt requests a file under `/.well-known/acme-challenge/`. An access rule, a firewall (WAF) rule or a web server change that stops that path being served fails the check. Make sure it's served openly.",
          "**The web server config changed.** If Certbot used a plugin or a webroot folder that has since moved or been renamed, renewal fails. The settings for each certificate are in `/etc/letsencrypt/renewal/`.",
          "**A CAA record blocks Let's Encrypt.** If your DNS has CAA records, one of them must allow `letsencrypt.org`. Otherwise issuance is refused.",
          "**Certbot isn't running.** A system upgrade, switching between the snap and apt versions of Certbot, or removing the timer can leave nothing scheduled. Check the timer from step 1.",
          "**The certificate renewed but the server kept using the old one.** Web servers need a reload to pick up a new certificate. Put a script that reloads your web server in `/etc/letsencrypt/renewal-hooks/deploy/`. Scripts there run after each successful renewal.",
          "**Rate limits.** Repeating a failing renewal many times can trip Let's Encrypt's rate limits and lock you out for a while. Fix the cause first and test with `--dry-run`, which uses Let's Encrypt's staging service.",
        ],
      },
      { type: "h2", text: "3. Wildcards, and servers without port 80" },
      {
        type: "p",
        text: "Wildcard certificates, and servers that can't be reached on port 80, need the DNS challenge, where Certbot proves control of the domain by creating a DNS record. For renewal to be automatic it needs a DNS provider plugin or API access. A certificate obtained with the manual DNS option won't renew by itself.",
      },
      { type: "h2", text: "4. Renew and check" },
      { type: "p", text: "Once the cause is fixed, renew:" },
      { type: "code", text: "sudo certbot renew" },
      {
        type: "p",
        text: "Certbot only renews certificates that are close to expiry. To renew one earlier, add `--force-renewal`, and use it sparingly, because each one counts towards Let's Encrypt's rate limits. Reload the web server if no deploy script did it, then check the result {public}with the [SSL checker](/ssl-checker){/public}{app}by clicking **Check now** on your [Overview](/dashboard){/app}.",
      },
      { type: "h2", text: "5. Make sure you hear about it next time" },
      {
        type: "p",
        text: "Certbot's renewals fail quietly, and Let's Encrypt no longer emails you. Watch the certificate from the outside, so a failed renewal turns into an email weeks before the expiry date instead of a warning page for your visitors. [Site Monitors](/signup) emails you 30, 14, 7, 3 and 1 days before a certificate expires{public}, free for up to 5 sites{/public}.",
      },
      {
        type: "p",
        text: "This matters more over time. Certificate lifetimes are shrinking (see [SSL certificates are moving to 47 days](/guides/47-day-ssl-certificates)), so renewals will happen more often, and each one is another chance for something to break.",
      },
    ],
  },
  {
    slug: "monitor-client-websites",
    title: "How to monitor all your client websites from one place",
    description:
      "What to watch on every client site (uptime, SSL, domain expiry, email setup), how to avoid missed renewals, and how to keep clients informed without the busywork.",
    updated: "2026-10-26",
    minutes: 7,
    related: ["ssl-certificate-expired", "how-to-check-when-a-domain-expires"],
    blocks: [
      {"type": "p", "text": "Managing a handful of client sites is easy to do from memory. Managing thirty is not. Certificates expire on different dates, domains are registered in different places, and a site can go down on a Saturday with nobody looking. The sites that cause trouble are rarely the busy ones. They're the quiet ones nobody has opened in months."},
      {"type": "p", "text": "This guide covers what to watch on every client site, how to set it up so it doesn't depend on anyone's memory, and how to keep clients informed."},
      {"type": "h2", "text": "1. Decide what \"healthy\" means for a client site"},
      {"type": "p", "text": "Four things take a site offline or put a warning in front of visitors, and each can be checked automatically:"},
      {"type": "ul", "items": ["**Is it up?** A check every minute or few minutes that requests the site and treats errors and timeouts as down. A good check confirms a failure before alerting, so one blip doesn't wake anyone.", "**Is the SSL certificate valid, and for how long?** Expiry is the common cause, but a certificate for the wrong hostname or with a missing intermediate certificate gives visitors the same warning.", "**Is the domain registration current?** A domain that lapses takes the site and its email down together. Registrars' renewal emails go to whoever registered it, which is often a previous agency or a client's old address.", "**Is email set up properly?** Missing SPF, DKIM or DMARC records are why a client's invoices land in spam. See [how to check SPF, DKIM and DMARC](/guides/check-spf-dkim-dmarc)."]},
      {"type": "h2", "text": "2. Put every site in one list"},
      {"type": "p", "text": "The goal is one place where every site is visible at once, so the one that needs a look stands out. {public}[Site Monitors](/signup) shows each site's uptime, certificate and domain status in one list, and starts checking it as soon as you add it. The free plan covers 5 sites.{/public}{app}On [Sites](/dashboard/sites), every site shows its uptime, certificate and domain status in one list. Add a site there and the checks start straight away.{/app}"},
      {"type": "p", "text": "Add the sites you manage, and the ones you only advise on. A site you aren't responsible for but depend on, like a client's payment page, is worth a monitor of its own."},
      {"type": "h2", "text": "3. Set the alerts up so they reach a person"},
      {"type": "ul", "items": ["**Send alerts to more than one address.** A shared inbox or a colleague's address means one person on holiday doesn't mean a missed alert.", "**Use a chat channel for urgent ones.** An outage alert in Slack or Discord is seen faster than an email. {app}Connect them on [Integrations](/dashboard/integrations).{/app}", "**Route alerts per site where it helps.** The person looking after one client doesn't need alerts for every other client.", "**Add escalation.** If nobody acknowledges an outage within a set time, tell someone else."]},
      {"type": "note", "title": "Expiry warnings should arrive early", "text": "A warning a day before a certificate expires is too late to fix something that needs a client's approval or a payment. Warnings 30 and 14 days ahead leave time to ask the client, get a card, or sort out access."},
      {"type": "h2", "text": "4. Check who actually owns each domain and certificate"},
      {"type": "p", "text": "The most common cause of a missed renewal is not a failing system. It's a renewal that goes to the wrong person. For each client, write down:"},
      {"type": "ul", "items": ["Who the domain is registered with, and whose email and card are on the account.", "Where DNS is managed, and who can change it.", "Where the certificate comes from, and whether renewal is automatic."]},
      {"type": "p", "text": "If the domain is registered in the client's personal account, ask for it to be moved to an account you control or share. It's a ten-minute job now and a bad weekend later."},
      {"type": "h2", "text": "5. Keep clients informed without the busywork"},
      {"type": "p", "text": "Clients ask the same questions: is my site up, what happened last night, are we on target? Answer them before they ask:"},
      {"type": "ul", "items": ["**A status page** each client can open any time, showing current status and recent incidents.", "**A monthly report** with uptime for the month, outages and upcoming renewals. See [how to set up a status page for a client](/guides/status-page-for-clients).", "**A short message when something happens,** even when it's already fixed. Clients who hear it from you remember that."]},
      {"type": "h2", "text": "A routine that scales"},
      {"type": "ol", "items": ["Add the site as soon as you take on the client, before anything is built.", "Record who owns the domain, DNS and certificate.", "Set the alerts to reach at least two people.", "Give the client their status page and, if it's part of the work, a monthly report.", "Review the list once a month and remove anything you no longer look after."]},
    ],
  },
  {
    slug: "monitor-cron-jobs-heartbeat",
    title: "How to monitor cron jobs and backups with a heartbeat",
    description:
      "Uptime checks can't see a backup that silently stopped. How heartbeat monitoring works, how to add it to a cron job, and the mistakes that cause false alarms.",
    updated: "2026-10-26",
    minutes: 6,
    related: ["monitor-client-websites"],
    blocks: [
      {"type": "p", "text": "A website that's down is obvious. A nightly backup that stopped running three weeks ago isn't, because nothing visible breaks. You find out the day you need the backup. Scheduled jobs fail quietly, and an ordinary uptime check can't see them, because there's nothing to request."},
      {"type": "p", "text": "A **heartbeat monitor** turns this round. Instead of you checking the job, the job reports in each time it runs. If a report doesn't arrive on time, you're alerted."},
      {"type": "h2", "text": "How a heartbeat works"},
      {"type": "ol", "items": ["You create a heartbeat and say how often the job should run and how late a report may be.", "You get a private web address, called the ping address.", "At the end of the job, you make a request to that address.", "If no request arrives by the time it's due plus the allowance, the heartbeat is marked down and you're alerted. When the next report arrives, it's marked up again and you're told."]},
      {"type": "p", "text": "{public}[Site Monitors](/signup) offers heartbeat monitors from the Starter plan.{/public}{app}Add one on [Sites](/dashboard/sites) with the **Heartbeat** tab.{/app} Give it a name like \"Nightly backup\", choose how often it runs (from every 5 minutes to every 7 days) and how late a report may be (from 1 minute to 6 hours)."},
      {"type": "h2", "text": "Add it to a cron job"},
      {"type": "p", "text": "Add one request at the end of the job, joined with `&&` so it only runs if the job succeeded:"},
      {"type": "code", "text": "0 2 * * * /opt/scripts/backup.sh && curl -fsS -m 10 --retry 3 https://example.com/api/ping/YOUR-CODE > /dev/null"},
      {"type": "p", "text": "Replace the address with your heartbeat's own. What the options do:"},
      {"type": "ul", "items": ["`&&` means the request is only sent when `backup.sh` finishes without an error. If the backup fails, no report is sent, and you're alerted once the allowance runs out.", "`-f` makes `curl` treat an error response as a failure, `-sS` hides progress but keeps errors, `-m 10` gives up after 10 seconds so a network problem can't hang the job, and `--retry 3` tries again if it fails."]},
      {"type": "p", "text": "In a shell script, put the request on the last line. For a systemd timer, use `ExecStartPost=` in the service, or add the request to the end of the script it runs. Any tool that can call a web address, such as a backup program's \"notify URL\" setting, works too."},
      {"type": "h2", "text": "Pick sensible numbers"},
      {"type": "ul", "items": ["**Match the schedule.** A job that runs once a day should be \"every 1 day\", not \"every hour\".", "**Leave some room.** Give it a bit more than the job's usual run time, so a slow night doesn't cause a false alarm.", "**Think about time zones.** Cron runs in the server's time zone. The heartbeat only cares about the gaps between reports, so as long as the gap matches, the zone doesn't matter."]},
      {"type": "note", "title": "One heartbeat per job", "text": "Give each job its own address. If two jobs share one, a failing job hides behind the other's reports."},
      {"type": "h2", "text": "Test it before you rely on it"},
      {"type": "ol", "items": ["Make a heartbeat with the shortest schedule, every 5 minutes with 1 minute to spare.", "Run the `curl` command by hand and watch it show as on time.", "Stop sending reports. After about 6 minutes it goes overdue and you're alerted.", "Send one again, and check it returns to up. Then set the real schedule."]},
      {"type": "h2", "text": "What to monitor this way"},
      {"type": "ul", "items": ["Backups, especially off-site and database dumps.", "Scheduled imports, syncs and report emails.", "Renewal and billing runs.", "Cleanup jobs that stop a disk filling up."]},
      {"type": "p", "text": "Keep the address private. Anyone who has it can send reports for that heartbeat, and if it leaks, delete the heartbeat and make a new one."},
    ],
  },
  {
    slug: "status-page-for-clients",
    title: "How to set up a status page for a client, on their own domain",
    description:
      "Give each client a status page with their logo, show incidents and maintenance, and put it on an address like status.clientname.com. A step-by-step guide.",
    updated: "2026-10-26",
    minutes: 7,
    related: ["monitor-client-websites"],
    blocks: [
      {"type": "p", "text": "When a client's site has a problem, their first question is whether you know. A status page answers it before they ask: current status, how the last month went, and what you're doing about anything that's wrong. It also takes the \"is it just me?\" messages off your inbox."},
      {"type": "h2", "text": "What a good client status page shows"},
      {"type": "ul", "items": ["**Current status,** in one clear line such as \"All systems operational\".", "**Recent uptime,** with a bar for each day so a bad day is easy to see.", "**Incidents,** with updates as you work on them and a note when it's resolved.", "**Scheduled maintenance,** so planned downtime doesn't look like an outage."]},
      {"type": "p", "text": "It should not show internal detail. Error messages, server names and certificate details stay private. Only the site's name, its status and the updates you write are public."},
      {"type": "h2", "text": "1. Turn the page on"},
      {"type": "p", "text": "{public}[Site Monitors](/signup) gives each site a public status page on the Starter plan and above.{/public}{app}Open the site from [Sites](/dashboard/sites) and turn on its status page.{/app} The address is a long random link, so it can't be guessed, and you share it with the client. Turning the page off and on again keeps the same address."},
      {"type": "h2", "text": "2. Add your client's look"},
      {"type": "p", "text": "A page with the client's logo and colours feels like theirs. Your own logo, name and accent colour appear on the pages and reports for your account. On the Agency plan, each client can also have its own logo, name and colour, and a single page can cover all of that client's sites."},
      {"type": "h2", "text": "3. Post updates when something happens"},
      {"type": "ol", "items": ["Open the site and post an incident with a short title, how serious it is and what's happening now.", "Add an update each time something changes: investigating, identified, monitoring, resolved.", "For planned work, schedule maintenance with a start and end time. Alerts for that site are quietened while it's under way."]},
      {"type": "p", "text": "Keep updates plain and specific. \"We found the cause and are applying a fix\" is better than silence, and better than a promise you can't keep."},
      {"type": "h2", "text": "4. Put it on the client's own domain"},
      {"type": "p", "text": "On the Pro plan and above, the page can live at an address like `status.clientname.com` instead of a link on our domain, with no mention of Site Monitors. You prove you control the domain with two DNS records, which you add where the client's domain is managed:"},
      {"type": "ul", "items": ["**A TXT record** at `_sitemonitors-verify.status.clientname.com`, with the value shown on the page. This proves the domain is theirs.", "**A CNAME record** from `status.clientname.com` to `site-monitors.net`, so visitors arrive here."]},
      {"type": "p", "text": "Use a subdomain such as `status`, not the main domain. A name can't have a CNAME and other records at the same time. Changes can take a few minutes to spread. Then click **Check DNS** on the page, and the certificate is set up automatically the first time someone visits."},
      {"type": "note", "title": "If the page shows a certificate error", "text": "The usual causes are DNS that doesn't point here yet, or a CDN or proxy in front of the domain. The certificate can only be issued once the CNAME points at us directly."},
      {"type": "h2", "text": "5. Let visitors subscribe"},
      {"type": "p", "text": "On the Pro plan and above, visitors can enter their email to be told about incidents and maintenance. Nobody gets anything until they confirm their address, and every email has a link to stop. Every status page also has an RSS feed."},
      {"type": "h2", "text": "Send it with the monthly report"},
      {"type": "p", "text": "A status page shows the present. A monthly report shows the month: uptime against a target you set, outages, and when certificates and domains are due for renewal. Together they show a client you're watching, without a meeting."},
    ],
  },
  {
    slug: "check-spf-dkim-dmarc",
    title: "How to check SPF, DKIM and DMARC for a domain",
    description:
      "Why client email lands in spam, and how to check and fix the three DNS records that decide it: SPF, DKIM and DMARC. Includes command-line checks and common mistakes.",
    updated: "2026-10-26",
    minutes: 8,
    related: ["monitor-client-websites"],
    blocks: [
      {"type": "p", "text": "When a client says their emails keep going to spam, the site is usually fine. The cause is almost always three DNS records that tell receiving mail servers a message is genuine: **SPF**, **DKIM** and **DMARC**. Since 2024, large mailbox providers have made them a requirement for anyone who sends in volume."},
      {"type": "h2", "text": "What each one does"},
      {"type": "ul", "items": ["**SPF** lists the servers allowed to send email for the domain.", "**DKIM** adds a signature to each message that proves it wasn't changed and really came from the domain.", "**DMARC** tells receiving servers what to do with a message that fails SPF and DKIM (nothing, put in spam, or reject it), and where to send reports."]},
      {"type": "h2", "text": "1. Check SPF"},
      {"type": "p", "text": "SPF is a TXT record on the bare domain that starts with `v=spf1`. Look it up:"},
      {"type": "code", "text": "dig +short TXT example.com"},
      {"type": "p", "text": "A typical record looks like this:"},
      {"type": "code", "text": "v=spf1 include:_spf.google.com include:amazonses.com ~all"},
      {"type": "p", "text": "What to check:"},
      {"type": "ul", "items": ["**There is exactly one.** A domain with two SPF records breaks SPF. Merge them into one record.", "**Every service that sends email for the domain is listed.** That means the mailbox provider (Google uses `include:_spf.google.com`, Microsoft 365 uses `include:spf.protection.outlook.com`), plus anything that sends invoices, newsletters or website forms.", "**It ends in `~all` or `-all`.** `~all` marks other senders as suspicious, and `-all` rejects them. A record ending `+all` lets anyone send as the domain, and one with no ending doesn't say what to do.", "**It stays under 10 lookups.** Each `include:` costs at least one, and more than 10 makes SPF fail. Remove services you no longer use."]},
      {"type": "h2", "text": "2. Check DKIM"},
      {"type": "p", "text": "DKIM keys live at a name that includes a **selector** your mail service chooses, so you can't list them. You have to know the selector, which the service's setup page shows. For a selector called `google`:"},
      {"type": "code", "text": "dig +short TXT google._domainkey.example.com"},
      {"type": "p", "text": "You should get a long value starting `v=DKIM1` with a key after `p=`. An empty `p=` means the key was withdrawn. Each service that sends email for the domain needs its own DKIM record, and the setup page of each one gives the exact name and value to add."},
      {"type": "h2", "text": "3. Check DMARC"},
      {"type": "p", "text": "DMARC is a TXT record at `_dmarc` under the domain:"},
      {"type": "code", "text": "dig +short TXT _dmarc.example.com"},
      {"type": "p", "text": "A good starting record:"},
      {"type": "code", "text": "v=DMARC1; p=none; rua=mailto:dmarc@example.com"},
      {"type": "ul", "items": ["`p=none` only watches. It sends reports and changes nothing. It's the right place to start.", "`p=quarantine` sends failing messages to spam, and `p=reject` refuses them. Move to one of these once the reports show your real mail passes.", "`rua=` is where daily summary reports go. They're XML and hard to read by hand, but a free DMARC report service turns them into something useful."]},
      {"type": "note", "title": "Go slowly with p=reject", "text": "If a legitimate sender, such as a billing system, isn't set up properly, `p=reject` will bounce its mail. Run `p=none` for a few weeks, fix anything the reports show failing, then tighten."},
      {"type": "h2", "text": "4. Send a test message"},
      {"type": "p", "text": "Send an email from the domain to a Gmail address, open it, choose **Show original**, and look for `SPF: PASS`, `DKIM: PASS` and `DMARC: PASS` at the top. If any say FAIL or NEUTRAL, that record is the one to fix."},
      {"type": "h2", "text": "Common mistakes"},
      {"type": "ul", "items": ["Adding a second SPF record instead of editing the first.", "Setting up the website's mail form but forgetting it sends from a different service than the mailbox.", "Adding DKIM for the mailbox provider but not for the newsletter or invoice tool.", "A DNS provider that adds the domain name again to the end of a record. If you enter `_dmarc.example.com` and it becomes `_dmarc.example.com.example.com`, enter only `_dmarc`."]},
      {"type": "h2", "text": "Keep watching it"},
      {"type": "p", "text": "These records break when someone changes email provider, adds a new service or moves DNS, and nobody checks afterwards. {public}[Site Monitors](/signup) runs a daily health scan on each site that flags a missing or weak SPF or DMARC record, looks for DKIM, checks security headers, and emails you when something new appears.{/public}{app}Open a site from [Sites](/dashboard/sites) and look at its health scan. It flags a missing or weak SPF or DMARC record, looks for DKIM, and emails you when something new appears.{/app}"},
    ],
  },
];

export type Mode = "public" | "app";

/** Keeps the wording meant for `mode` and drops the rest. */
export function forMode(text: string, mode: Mode): string {
  return text
    .replace(/\{public\}([\s\S]*?)\{\/public\}/g, mode === "public" ? "$1" : "")
    .replace(/\{app\}([\s\S]*?)\{\/app\}/g, mode === "app" ? "$1" : "");
}

export function getGuide(slug: string): Guide {
  const guide = GUIDES.find((g) => g.slug === slug);
  if (!guide) throw new Error(`No guide called ${slug}`);
  return guide;
}
