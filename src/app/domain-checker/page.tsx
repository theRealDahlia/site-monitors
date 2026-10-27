import type { Metadata } from "next";
import SignedInRedirect from "@/components/SignedInRedirect";
import Link from "next/link";
import DomainChecker from "@/components/DomainChecker";
import AlertsCta from "@/components/AlertsCta";
import Faq, { type FaqItem } from "@/components/Faq";
import JsonLd from "@/components/JsonLd";
import { Footer, Header } from "@/components/SiteChrome";
import { toolSchema } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Free Domain Expiry Checker",
  description:
    "Check when any domain name expires. See the registrar, registration date, nameservers and status codes, straight from the registry. Free, no sign-up.",
  alternates: { canonical: "/domain-checker" },
};

const FAQ: FaqItem[] = [
  {
    q: "What happens when a domain expires?",
    a: "The website and any email on the domain stop working, often straight away. For most domains there is then a grace period at the registrar, a redemption period of typically around 30 days in which only the previous owner can recover it for an extra fee, and a few days where it can't be recovered, before the name is released for anyone to register. The exact steps vary. See [How to check when a domain expires](/guides/how-to-check-when-a-domain-expires).",
  },
  {
    q: "How early should I renew a domain?",
    a: "Weeks ahead, not on the expiry date. Registrar grace periods vary and some have none, so treat the expiry date as the day things may stop working. This checker flags anything with 60 days or fewer remaining.",
  },
  {
    q: "Why can't I see the expiry date for some domains?",
    a: "Some registries, including those for .io, .co and .de, don't offer public RDAP data yet, and a few leave the expiry date out of public records. We say so rather than guess. The owner can always see the date by logging in to the registrar the domain is registered with.",
  },
  {
    q: "What is RDAP, and how is it different from WHOIS?",
    a: "RDAP is the modern replacement for WHOIS. It returns the same kind of registration details in a structured, standard format, straight from the registry, and most registries now redact the owner's personal contact details. This checker uses RDAP.",
  },
  {
    q: "Why do domains expire even when auto-renew is on?",
    a: "Usually because the card on file expired or was declined, because renewal emails go to an address nobody reads, or because the domain sits in someone else's registrar account, such as a previous agency or a client's personal login.",
  },
  {
    q: "Does an expired domain affect my SSL certificate?",
    a: "Yes. A certificate can't be renewed once the domain stops working, because the checks a certificate authority runs depend on the domain's DNS. If a domain lapses, the site goes down and the certificate can't be renewed. See [SSL certificate expired: how to fix it](/guides/ssl-certificate-expired).",
  },
];

export default function DomainCheckerPage() {
  return (
    <>
      <Header />
      <SignedInRedirect />
      <JsonLd data={toolSchema("Free Domain Expiry Checker", "/domain-checker", "Check when any domain name expires, with the registrar, registration date, nameservers and status codes.")} />
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

        <section className="mt-16" aria-labelledby="domain-guides">
          <h2 id="domain-guides" className="text-xl font-semibold tracking-tight">
            Keep reading
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-muted marker:text-accent">
            <li>
              <Link href="/guides/how-to-check-when-a-domain-expires" className="text-accent underline underline-offset-2">
                How to check when a domain expires
              </Link>
            </li>
            <li>
              <Link href="/guides/ssl-certificate-expired" className="text-accent underline underline-offset-2">
                SSL certificate expired: how to fix it
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="domain-faq">
          <h2 id="domain-faq" className="mb-4 text-xl font-semibold tracking-tight">
            Common questions
          </h2>
          <Faq items={FAQ} />
        </section>
      </main>
      <Footer />
    </>
  );
}
