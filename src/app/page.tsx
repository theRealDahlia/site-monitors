import type { Metadata } from "next";
import SignedInRedirect from "@/components/SignedInRedirect";
import Link from "next/link";
import SslChecker from "@/components/SslChecker";
import AlertsCta from "@/components/AlertsCta";
import Faq from "@/components/Faq";
import JsonLd from "@/components/JsonLd";
import { Footer, Header } from "@/components/SiteChrome";
import { HOME_FAQ } from "@/lib/faq";
import { GUIDES } from "@/lib/guides";
import { homeSchema } from "@/lib/schema";
import PlanCta from "@/components/PlanCta";
import ProductPreview from "@/components/ProductPreview";
import { PLANS } from "@/lib/plans";

// The title and description come from the site-wide defaults. Only the canonical address is set here.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/** The home page's main sign-up button. Only visitors reach this page (the proxy sends anyone logged in to the app). */
function StartFree() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link
        href="/signup"
        className="rounded-lg bg-accent px-5 py-3 text-base font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Start monitoring free
      </Link>
      <p className="text-sm text-muted">Free for 5 sites. No credit card.</p>
    </div>
  );
}

const FEATURES = [
  {
    title: "Certificate expiry alerts",
    body: "Emails 30, 14, 7, 3 and 1 days before a certificate expires, plus alerts for hostname mismatches, broken chains and self-signed certificates.",
    link: { href: "/guides/ssl-certificate-expired", text: "How to fix an expired certificate" },
  },
  {
    title: "Domain expiry alerts",
    body: "Emails 60, 30, 14, 7 and 1 days before a domain's registration runs out, so a forgotten renewal never takes a site offline.",
    link: { href: "/guides/how-to-check-when-a-domain-expires", text: "How to check when a domain expires" },
  },
  {
    title: "Uptime checks",
    body: "Every site is checked every 5 minutes on Free and every minute on paid plans. We double-check before emailing you, so a single hiccup doesn't wake anyone, and we email again when it's back.",
    link: { href: "/guides/monitor-client-websites", text: "Monitor all your client websites" },
  },
  {
    title: "One dashboard",
    body: "See every site's uptime, certificate and domain status in one place, and add, edit or remove sites whenever you like.",
  },
];

// How alerts are kept trustworthy, in the same words the pricing FAQ uses.
const CHECKS = [
  {
    title: "Around the clock",
    body: "Every site is checked every 5 minutes on Free and every minute on paid plans.",
  },
  {
    title: "Double-checked before we email",
    body: "A site is reported down only after two failed checks in a row, so a single hiccup doesn't wake anyone.",
  },
  {
    title: "We tell you when it's back",
    body: "You get another email when a site comes back up, and early warnings before a certificate or domain expires.",
  },
];

const AGENCY_FEATURES = [
  {
    title: "A status page for every client",
    body: "Share a public page with each client, with their logo and colours, on their own domain. One page can cover all of a client's sites.",
    link: { href: "/guides/status-page-for-clients", text: "Set up a status page for a client" },
  },
  {
    title: "Monthly reports",
    body: "Send each client a monthly uptime report against a target you set, with your branding, that they can save as a PDF.",
    link: { href: "/pricing", text: "See which plans include reports" },
  },
  {
    title: "Cron jobs and backups",
    body: "Heartbeat monitors alert you when a scheduled job or backup stops running, which an uptime check can't see.",
    link: { href: "/guides/monitor-cron-jobs-heartbeat", text: "Monitor cron jobs with a heartbeat" },
  },
  {
    title: "A daily health scan",
    body: "Catch missing security headers, a missing or weak email setup (SPF and DMARC) and DNS changes before they cause a problem.",
    link: { href: "/guides/check-spf-dkim-dmarc", text: "Check SPF, DKIM and DMARC" },
  },
];

export default function Home() {
  return (
    <>
      <Header guest />
      <SignedInRedirect />
      <JsonLd data={homeSchema()} />
      <main>
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <p className="text-sm font-medium text-accent">For agencies and freelancers</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Never let a client&apos;s SSL certificate or domain expire again.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Certificates are getting shorter-lived, and renewals fail quietly. Get alerted before a
            client&apos;s site shows a security warning, with uptime monitoring for every site in
            one dashboard.
          </p>

          <div className="mt-8">
            <StartFree />
          </div>

          <div className="mt-10 max-w-2xl">
            <h2 className="mb-3 text-base font-semibold">Or try the free SSL checker, no account needed</h2>
            <SslChecker />
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Why this keeps happening</h2>
            <p className="mt-3 max-w-2xl text-muted">
              Certificate lifetimes are shrinking in stages, to 47 days by 2029. That means far more
              renewals per year across every site you manage, and far more chances for one to be
              missed.
            </p>
            <h2 className="mt-14 text-2xl font-semibold tracking-tight">What Site Monitors checks for you: SSL certificates, domain expiry and uptime</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{f.body}</p>
                  {f.link && (
                    <p className="mt-2 text-sm">
                      <Link href={f.link.href} className="text-accent underline underline-offset-2 hover:opacity-80">
                        {f.link.text}
                      </Link>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <ProductPreview />
        <div className="mx-auto -mt-6 max-w-5xl px-4 pb-16 sm:px-6">
          <StartFree />
        </div>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Built for the way agencies work</h2>
            <p className="mt-3 max-w-2xl text-muted">Group sites by client, then give each client its own page, report and look. Larger plans add a team, an API and more.</p>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {AGENCY_FEATURES.map((f) => (
                <div key={f.title}>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{f.body}</p>
                  {f.link && (
                    <p className="mt-2 text-sm">
                      <Link href={f.link.href} className="text-accent underline underline-offset-2 hover:opacity-80">
                        {f.link.text}
                      </Link>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pt-16 sm:px-6" aria-labelledby="trust-heading">
          <h2 id="trust-heading" className="text-2xl font-semibold tracking-tight">
            How we make sure an alert is worth reading
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {CHECKS.map((c) => (
              <div key={c.title}>
                <h3 className="font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
          <p className="mt-2 text-sm text-muted">
            Start free, and upgrade to Starter, Pro or Agency when you need more.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/pricing" className="text-accent underline underline-offset-2">
              See full pricing and plan comparison
            </Link>
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className={`flex flex-col rounded-xl border bg-surface p-5 ${p.recommended ? "border-accent ring-2 ring-accent/30" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.recommended ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Recommended</span>
                  ) : (
                    !p.available && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">Planned</span>
                  )}
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  ${p.price}
                  <span className="text-base font-normal text-muted">/mo</span>
                </p>
                <p className="mt-3 flex-1 text-sm text-muted">{p.summary}</p>
                {p.available && (
                  <div className="mt-5">
                    <PlanCta plan={p.price > 0 ? p.name.toLowerCase() : undefined} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>


        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight">
            Common questions
          </h2>
          <div className="mt-6">
            <Faq items={HOME_FAQ} />
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <AlertsCta
              heading="Get emailed before a site goes down or expires"
              body="Create a free account and watch up to 5 sites. We check them around the clock and email you when something needs attention."
            />
            <p className="mt-8 text-sm text-muted">
              Just need a one-off check?{" "}
              <Link href="/ssl-checker" className="text-accent underline underline-offset-2">
                Free SSL checker
              </Link>{" "}
              ·{" "}
              <Link href="/domain-checker" className="text-accent underline underline-offset-2">
                Free domain expiry checker
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6" aria-labelledby="guides-heading">
          <h2 id="guides-heading" className="text-2xl font-semibold tracking-tight">
            Guides for people who look after websites
          </h2>
          <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="text-accent underline underline-offset-2 hover:opacity-80">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
