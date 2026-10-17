import type { Metadata } from "next";
import { GuideCards } from "@/components/GuideArticle";
import SignedInRedirect from "@/components/SignedInRedirect";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Guides: SSL certificates, domains and website monitoring",
  description:
    "Practical guides on expired SSL certificates, domain expiry, Let's Encrypt renewals and shorter certificate lifetimes, for people who look after websites.",
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
          Practical help with the things that quietly take websites down: expired SSL certificates, lapsed domains and failed renewals.
        </p>
        <div className="mt-10">
          <GuideCards mode="public" />
        </div>
      </main>
      <Footer />
    </>
  );
}
