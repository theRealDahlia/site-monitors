import type { Metadata } from "next";
import Link from "next/link";
import DomainChecker from "@/components/DomainChecker";
import AlertsCta from "@/components/AlertsCta";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Free Domain Expiry Checker",
  description:
    "Check when any domain name expires. See the registrar, registration date, nameservers and status codes, straight from the registry. Free, no sign-up.",
};

export default function DomainCheckerPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Free domain expiry checker
        </h1>
        <p className="mt-4 text-lg text-muted">
          Enter a domain to see when its registration expires, which registrar holds it, and
          whether it&apos;s in any status that could take the site offline.
        </p>

        <div className="mt-8">
          <DomainChecker />
        </div>

        <section className="mt-16 rounded-xl border border-border bg-surface p-6">
          <AlertsCta
            heading="Get alerted before it expires"
            body="A lapsed domain takes the website and email down with it. Create a free account and we'll watch your domains and certificates for you, and email you before anything expires."
          />
        </section>

        <section className="mt-16 space-y-6 text-sm text-muted">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            What this checker looks at
          </h2>
          <div>
            <h3 className="font-medium text-foreground">Expiry date</h3>
            <p className="mt-1">
              The date the registration runs out unless it&apos;s renewed. We flag anything with 60
              days or fewer remaining. Domains on auto-renew can still fail if the card on file
              has expired.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-foreground">Status codes</h3>
            <p className="mt-1">
              Registries attach codes to every domain. Most, like &quot;client transfer
              prohibited&quot;, are protections. Others, like &quot;redemption period&quot; or
              &quot;client hold&quot;, mean the domain has lapsed or been suspended and we call
              them out.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-foreground">Where the data comes from</h3>
            <p className="mt-1">
              Results come directly from the domain&apos;s registry using RDAP, the modern
              replacement for WHOIS. Owner contact details are redacted by most registries, so we
              don&apos;t show them.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-foreground">Domains we can&apos;t check</h3>
            <p className="mt-1">
              Some registries, including those for .io, .co and .de, don&apos;t offer public RDAP
              data yet, and a few registries leave out the expiry date. When that happens we say so
              rather than guess.
            </p>
          </div>
          <p>
            Checking a certificate instead?{" "}
            <Link href="/ssl-checker" className="text-accent underline underline-offset-2">
              Use the free SSL checker
            </Link>
            .
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
