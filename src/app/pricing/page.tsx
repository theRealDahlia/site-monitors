import type { Metadata } from "next";
import SignedInRedirect from "@/components/SignedInRedirect";
import AlertsCta from "@/components/AlertsCta";
import PlanComparison from "@/components/PlanComparison";
import PlanCta from "@/components/PlanCta";
import { Footer, Header } from "@/components/SiteChrome";
import { PRICING_FAQ as FAQ } from "@/lib/faq";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing: Free for 5 Sites, Plans from $9/mo",
  alternates: { canonical: "/pricing" },
  description:
    "Free SSL, domain and uptime monitoring for 5 sites. Paid plans from $9/month add status pages, client reports and white-label for agencies.",
};


export default function PricingPage() {
  return (
    <>
      <Header guest />
      <SignedInRedirect to="/dashboard/plans" />
      <main>
        <section className="mx-auto max-w-5xl px-4 pb-6 pt-14 sm:px-6 sm:pt-20">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Simple pricing: free for 5 sites, plans from $9/month</h1>
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
                className={`flex flex-col rounded-xl border bg-surface p-5 ${p.recommended ? "border-accent ring-2 ring-accent/30" : "border-border"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.recommended ? (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">Recommended</span>
                  ) : (
                    !p.available && <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted">Planned</span>
                  )}
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
            Prices are in US dollars, billed monthly through Stripe. Cancel any time.
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
