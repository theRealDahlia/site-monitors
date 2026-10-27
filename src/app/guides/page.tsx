import type { Metadata } from "next";
import { GuideCards } from "@/components/GuideArticle";
import SignedInRedirect from "@/components/SignedInRedirect";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Guides: monitoring client websites, SSL certificates, domains and email",
  description:
    "Practical guides for agencies and freelancers: monitoring client websites, expired SSL certificates, domain expiry, cron job monitoring, status pages and SPF, DKIM and DMARC.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <>
      <Header />
      <SignedInRedirect to="/dashboard/guides" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Guides</h1>
        <p className="mt-4 text-lg text-muted">
          Practical help with the things that quietly take websites down, and with keeping clients informed: expired SSL certificates, lapsed domains, failed renewals, silent cron jobs and email setup.
        </p>
        <div className="mt-10">
          <GuideCards mode="public" />
        </div>
      </main>
      <Footer />
    </>
  );
}
