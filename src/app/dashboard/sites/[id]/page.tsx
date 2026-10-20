import type { Metadata } from "next";
import { Suspense } from "react";
import SiteDetail from "@/components/SiteDetail";

export const metadata: Metadata = {
  title: "Site",
  robots: { index: false },
};

export default function SitePage() {
  // useParams() reads the address at request time, so Next needs a Suspense boundary to prerender the rest.
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <SiteDetail />
    </Suspense>
  );
}
