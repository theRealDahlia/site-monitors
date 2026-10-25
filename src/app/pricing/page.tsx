import type { Metadata } from "next";
import SignedInRedirect from "@/components/SignedInRedirect";
import AlertsCta from "@/components/AlertsCta";
import PlanComparison from "@/components/PlanComparison";
import PlanCta from "@/components/PlanCta";
import { Footer, Header } from "@/components/SiteChrome";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  alternates: { canonical: "/pricing" },
  description:
    "Watch up to 5 sites for free, with uptime, SSL certificate and domain expiry checks and email alerts. Starter and Pro give you more sites, 1-minute checks and status pages.",
};

const FAQ = [
  {
    q: "Is the free plan really free?",
    a: "Yes. There's no credit card to enter and no trial that ends. You can watch up to 5 sites for as long as you like.",
  },
  {
    q: "What counts as a site?",
    a: "One hostname, such as example.com. Each site gets uptime, SSL certificate and domain expiry checks. www.example.com and example.com are separate hostnames, so they count as two sites.",
  },
  {
    q: "What emails will I get?",
    a: "A confirmation when you add a site, and then alerts only when something needs attention: an SSL certificate nearing expiry (30, 14, 7, 3 and 1 days before), a domain nearing expiry (60, 30, 14, 7 and 1 days before), a certificate problem, or a site going down. We only report a site as down after two failed checks in a row, and we email again when it's back up.",
  },
  {
    q: "Do I need an account to use the free checkers?",
    a: "No. Without an account you get 4 checks a day across the SSL and domain checkers. With an account you add sites to your dashboard instead, and we check them for you around the clock.",
  },
  {
    q: "How do I pay, and can I cancel?",
    a: "Starter and Pro are monthly subscriptions paid by card through Stripe. You can change plan, update your card, download invoices or cancel from your Plans page whenever you like. Changing plan or cancelling takes effect at once, and the unused days are refunded to your card. Agency is planned but can't be bought yet.",
  },
  {
    q: "What happens if I want more than 5 sites?",
    a: "You'll need to remove a site before adding another. Starter (25 sites) and Pro (100 sites) have higher limits.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Header />
      <SignedInRedirect to="/dashboard/plans" />
      <main>
        <section className="mx-auto max-w-5xl px-4 pb-6 pt-14 sm:px-6 sm:pt-20">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Free to start, with room to grow.</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Watch up to 5 sites for free, with uptime, SSL certificate and domain expiry checks and email alerts. The paid
            plans below are for people who watch more sites.
          </p>
        </section>

        <section aria-labelledby="plans-heading" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <h2 id="plans-heading" className="sr-only">
            Plans
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`flex flex-col rounded-xl border bg-surface p-5 ${p.available ? "border-accent" : "border-border"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.available ? "bg-ok-bg text-ok" : "border border-border text-muted"
                    }`}
                  >
                    {p.available ? "Available now" : "Planned"}
                  </span>
                </div>
                <p className="mt-3 text-4xl font-semibold tracking-tight">
                  ${p.price}
                  <span className="text-base font-normal text-muted"> /month</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className={p.available ? "text-ok" : "text-muted"}>
                        ✓
                      </span>
                      <span className={p.available ? "" : "text-muted"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {p.available ? (
                    <PlanCta plan={p.price > 0 ? p.name.toLowerCase() : undefined} />
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-lg border border-border px-4 py-2.5 text-sm text-muted"
                    >
                      Not available yet
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            Prices are in US dollars, billed monthly through Stripe. Cancel any time. Agency is planned and can&apos;t be bought yet.
          </p>
        </section>

        <section aria-labelledby="compare-heading" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <h2 id="compare-heading" className="text-2xl font-semibold tracking-tight">
            Compare plans
          </h2>
          <PlanComparison className="mt-6" />
        </section>

        <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight">
            Common questions
          </h2>
          <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.q}
                  <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <AlertsCta
              heading="Start watching your sites for free"
              body="Create a free account, add up to 5 sites, and we'll check them around the clock and email you when something needs attention."
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
