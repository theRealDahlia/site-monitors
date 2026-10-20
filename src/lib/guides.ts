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
