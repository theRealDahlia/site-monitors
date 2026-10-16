import type { Metadata } from "next";
import { Suspense } from "react";
import StatusView from "@/components/StatusView";

export const metadata: Metadata = {
  title: "Status",
  // The owner chose to share this page, not to have it show up in search results.
  robots: { index: false },
};

export default function StatusPage() {
  // useParams() reads the address at request time, so Next needs a Suspense boundary to prerender the rest.
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl px-4 py-16 text-muted sm:px-6">Loading status…</main>}>
      <StatusView />
    </Suspense>
  );
}
