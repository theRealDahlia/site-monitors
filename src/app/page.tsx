import Link from "next/link";
import SslChecker from "@/components/SslChecker";
import AlertsCta from "@/components/AlertsCta";
import { Footer, Header } from "@/components/SiteChrome";

const FEATURES = [
  {
    title: "Certificate expiry alerts",
    body: "Emails 30, 14, 7, 3 and 1 days before a certificate expires, plus alerts for hostname mismatches, broken chains and self-signed certificates.",
  },
  {
    title: "Domain expiry alerts",
    body: "Emails 60, 30, 14, 7 and 1 days before a domain's registration runs out, so a forgotten renewal never takes a site offline.",
  },
  {
    title: "Uptime checks",
    body: "Every site is checked every 5 minutes. We double-check before emailing you, so a single hiccup doesn't wake anyone, and we email again when it's back.",
  },
  {
    title: "One dashboard",
    body: "See every site's uptime, certificate and domain status in one place, and add, edit or remove sites whenever you like.",
  },
];

const PLANS = [
  { name: "Free", price: "$0", detail: "5 sites with uptime, SSL and domain checks and email alerts", available: true },
  { name: "Starter", price: "$9", detail: "25 sites, 1-minute checks, Slack and Discord", available: false },
  { name: "Pro", price: "$29", detail: "100 sites, AI-visibility checks, white-label status page", available: false },
  { name: "Agency", price: "$79", detail: "500 sites, client workspaces, monthly client reports", available: false },
];

export default function Home() {
  return (
    <>
      <Header />
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

          <div className="mt-10 max-w-2xl">
            <h2 className="mb-3 text-base font-semibold">Try the free SSL checker</h2>
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
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
          <p className="mt-2 text-sm text-muted">
            The free plan is available now. The paid plans are planned and may change.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.available ? "bg-ok-bg text-ok" : "border border-border text-muted"}`}>
                    {p.available ? "Available now" : "Planned"}
                  </span>
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {p.price}
                  <span className="text-base font-normal text-muted">/mo</span>
                </p>
                <p className="mt-3 text-sm text-muted">{p.detail}</p>
              </div>
            ))}
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
      </main>
      <Footer />
    </>
  );
}
