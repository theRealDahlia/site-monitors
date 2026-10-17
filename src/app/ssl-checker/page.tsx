import type { Metadata } from "next";
import SignedInRedirect from "@/components/SignedInRedirect";
import Link from "next/link";
import SslChecker from "@/components/SslChecker";
import AlertsCta from "@/components/AlertsCta";
import Faq, { type FaqItem } from "@/components/Faq";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Free SSL Certificate Checker",
  description:
    "Check any website's SSL certificate: expiry date, issuer, certificate chain and hostname match. Free, no sign-up.",
  alternates: { canonical: "/ssl-checker" },
};

const FAQ: FaqItem[] = [
  {
    q: "What happens when an SSL certificate expires?",
    a: "Browsers stop trusting the site and show visitors a full-page security warning instead of your pages. Most people leave at that point, and anything that connects over HTTPS, such as an API or a webhook, can fail as well. See [SSL certificate expired: how to fix it](/guides/ssl-certificate-expired).",
  },
  {
    q: "How early should a certificate be renewed?",
    a: "Automatic renewal usually starts well before the end: Certbot, for example, renews a certificate once it has 30 days or fewer left. For a certificate you renew by hand, start at least a couple of weeks ahead so there is time to fix problems. This checker flags anything with 30 days or fewer remaining.",
  },
  {
    q: "Why does my certificate only last 90 days, or less than a year?",
    a: "Free certificates from Let's Encrypt are issued for 90 days on purpose, and renew automatically. Lifetimes are getting shorter across the board: public certificates issued since 15 March 2026 can't last more than 200 days, and the limit falls to 47 days by 2029. See [SSL certificates are moving to 47 days](/guides/47-day-ssl-certificates).",
  },
  {
    q: "My certificate should have renewed on its own. Why didn't it?",
    a: "Automatic renewals fail quietly, usually because of a closed port, a DNS change or a scheduled job that stopped running, and Let's Encrypt no longer emails a warning. See [Let's Encrypt renewal failed: causes and fixes](/guides/lets-encrypt-renewal-failed).",
  },
  {
    q: "Which websites can I check?",
    a: "Public websites that serve HTTPS on the standard port, 443. Addresses on private networks, and other ports, can't be checked.",
  },
  {
    q: "Is the checker really free?",
    a: "Yes. Without an account you can run 4 checks a day across the SSL and domain checkers. With a free account you can instead add up to 5 sites, and we check them for you around the clock and email you before anything expires.",
  },
];

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
          <div>
            <h3 className="font-medium text-foreground">Issuer</h3>
            <p className="mt-1">
              The certificate authority that signed the certificate, such as Let&apos;s Encrypt, DigiCert or
              Sectigo. Browsers trust a free certificate from a public authority the same as a paid one. What
              differs is mostly how long it lasts and what support comes with it.
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

        <section className="mt-16" aria-labelledby="ssl-guides">
          <h2 id="ssl-guides" className="text-xl font-semibold tracking-tight">
            Seeing a certificate warning?
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-muted marker:text-accent">
            <li>
              <Link href="/guides/ssl-certificate-expired" className="text-accent underline underline-offset-2">
                SSL certificate expired: how to fix it
              </Link>
            </li>
            <li>
              <Link href="/guides/lets-encrypt-renewal-failed" className="text-accent underline underline-offset-2">
                Let&apos;s Encrypt renewal failed: causes and fixes
              </Link>
            </li>
            <li>
              <Link href="/guides/47-day-ssl-certificates" className="text-accent underline underline-offset-2">
                SSL certificates are moving to 47 days: what to do about it
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="ssl-faq">
          <h2 id="ssl-faq" className="mb-4 text-xl font-semibold tracking-tight">
            Common questions
          </h2>
          <Faq items={FAQ} />
        </section>
      </main>
      <Footer />
    </>
  );
}
