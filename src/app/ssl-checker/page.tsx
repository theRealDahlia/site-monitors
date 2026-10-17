import type { Metadata } from "next";
import SignedInRedirect from "@/components/SignedInRedirect";
import Link from "next/link";
import SslChecker from "@/components/SslChecker";
import AlertsCta from "@/components/AlertsCta";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Free SSL Certificate Checker",
  description:
    "Check any website's SSL certificate: expiry date, issuer, certificate chain and hostname match. Free, no sign-up.",
};

export default function SslCheckerPage() {
  return (
    <>
      <Header />
      <SignedInRedirect />
      <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Free SSL certificate checker
        </h1>
        <p className="mt-4 text-lg text-muted">
          Enter a domain to see when its certificate expires, who issued it, and whether the chain
          and hostname are set up correctly.
        </p>

        <div className="mt-8">
          <SslChecker />
        </div>

        <section className="mt-16 rounded-xl border border-border bg-surface p-6">
          <AlertsCta
            heading="Get alerted before it expires"
            body="Checking by hand doesn't scale. Create a free account and we'll watch your certificates and domains for you, and email you before anything expires."
          />
        </section>

        <section className="mt-16 space-y-6 text-sm text-muted">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            What this checker looks at
          </h2>
          <div>
            <h3 className="font-medium text-foreground">Expiry date</h3>
            <p className="mt-1">
              An expired certificate makes browsers show a full-page security warning. We flag
              anything with 30 days or fewer remaining.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-foreground">Certificate chain</h3>
            <p className="mt-1">
              Servers should send the intermediate certificates along with their own. A missing
              intermediate works in some browsers and fails in others, which makes it hard to spot.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-foreground">Hostname match</h3>
            <p className="mt-1">
              The certificate must list the exact domain you&apos;re visiting. A certificate issued
              for another name triggers a mismatch warning.
            </p>
          </div>
          <p>
            Checking a domain registration instead?{" "}
            <Link href="/domain-checker" className="text-accent underline underline-offset-2">
              Use the free domain expiry checker
            </Link>
            .
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
