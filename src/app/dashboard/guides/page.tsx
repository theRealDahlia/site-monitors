import type { Metadata } from "next";
import { GuideCards } from "@/components/GuideArticle";

export const metadata: Metadata = {
  title: "Guides",
  robots: { index: false },
};

export default function GuidesPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Guides</h1>
      <p className="mt-2 text-muted">
        Practical help with the things that quietly take websites down: expired SSL certificates, lapsed domains and failed renewals.
      </p>
      <div className="mt-8">
        <GuideCards mode="app" />
      </div>
    </div>
  );
}
