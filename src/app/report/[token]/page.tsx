import type { Metadata } from "next";
import { Suspense } from "react";
import ReportView from "@/components/ReportView";

export const metadata: Metadata = {
  title: "Uptime report",
  robots: { index: false },
  // The address is the key to the report; never send it to another site as a referrer.
  referrer: "no-referrer",
};

export default function ReportPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-16 text-muted">Loading report…</main>}>
      <ReportView />
    </Suspense>
  );
}
