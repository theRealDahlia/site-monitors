import Link from "next/link";
import SslChecker from "@/components/SslChecker";
import WaitlistForm from "@/components/WaitlistForm";
import { Footer, Header } from "@/components/SiteChrome";

const FEATURES = [
  {
    title: "Certificate expiry alerts",
    body: "Warnings 30, 14, 7 and 1 days before any certificate expires, plus alerts for broken chains and hostname mismatches.",
  },
  {
    title: "Domain expiry alerts",
    body: "Track every client domain's registration date, so a forgotten renewal never takes a site offline.",
  },
  {
    title: "Uptime checks",
    body: "Status code, response time and keyword checks, confirmed from a second region before anyone gets paged.",
  },
  {
    title: "Built for many sites",
    body: "Paste in 50 domains at once, group them by client, and share a status page with each one.",
  },
];

const PLANS = [
  { name: "Free", price: "$0", detail: "5 monitors, SSL and domain checks, email alerts" },
  { name: "Starter", price: "$9", detail: "25 monitors, 1-minute checks, Slack and Discord" },
  { name: "Pro", price: "$29", detail: "100 monitors, AI-visibility checks, white-label status page" },
  { name: "Agency", price: "$79", detail: "500 monitors, client workspaces, monthly client reports" },
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
          <h2 className="text-2xl font-semibold tracking-tight">Planned pricing</h2>
          <p className="mt-2 text-sm text-muted">
            Early-access members get first pick of launch pricing. These plans may change.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className="rounded-xl border border-border bg-surface p-5">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {p.price}
                  <span className="text-base font-normal text-muted">/mo</span>
                </p>
                <p className="mt-3 text-sm text-muted">{p.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="early-access" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Get early access</h2>
            <p className="mt-2 max-w-xl text-muted">
              We&apos;re building this now. Join the list and we&apos;ll email you when monitoring
              opens, no spam.
            </p>
            <div className="mt-6 max-w-2xl">
              <WaitlistForm />
            </div>
            <p className="mt-6 text-sm text-muted">
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
