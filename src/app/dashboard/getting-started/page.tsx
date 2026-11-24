import type { Metadata } from "next";
import Link from "next/link";
import ReplayTour from "@/components/ReplayTour";
import { TOOLS } from "@/lib/tour";

export const metadata: Metadata = {
  title: "Getting started",
  robots: { index: false },
};

export default function GettingStartedPage() {
  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Getting started</h1>
        <ReplayTour />
      </div>

      <p className="mt-2 text-muted">
        Site Monitors watches your websites around the clock and emails you when something needs attention: a site that&apos;s down, an SSL certificate about to
        expire, or a domain registration about to run out. Here is what each part of the app does and how to use it.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-surface p-5" aria-labelledby="first-steps">
        <h2 id="first-steps" className="font-semibold">
          Your first five minutes
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            Go to <Link href="/dashboard/sites#add" className="text-accent underline underline-offset-2">Sites</Link> and add your first domain, such as example.com. Checking starts straight away.
          </li>
          <li>
            Open <Link href="/dashboard" className="text-accent underline underline-offset-2">Overview</Link> to see how it is doing. Anything that needs a look is listed there.
          </li>
          <li>
            Check <Link href="/dashboard/integrations" className="text-accent underline underline-offset-2">Integrations</Link> to add another email address for alerts, so one person away doesn&apos;t mean a missed alert.
          </li>
          <li>
            Add the rest of your sites. The free plan watches up to 5 monitors.
          </li>
        </ol>
      </section>

      <nav aria-label="On this page" className="mt-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted/80">The tools</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {TOOLS.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="inline-block rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-accent hover:text-foreground">
                {t.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 space-y-4">
        {TOOLS.map((t) => (
          <section key={t.id} id={t.id} aria-labelledby={`${t.id}-heading`} className="scroll-mt-6 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`${t.id}-heading`} className="text-lg font-semibold">
                {t.title}
              </h2>
              <Link href={t.href} className="text-sm text-accent underline underline-offset-2">
                Open {t.menu}
              </Link>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{t.summary}</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
              {t.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {t.plan && <p className="mt-3 rounded-lg bg-foreground/5 px-3 py-2 text-xs text-muted">{t.plan}</p>}
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        Stuck? Read the <Link href="/dashboard/guides" className="text-accent underline underline-offset-2">Guides</Link> or{" "}
        <Link href="/dashboard/contact" className="text-accent underline underline-offset-2">contact us</Link>.
      </p>
    </div>
  );
}
