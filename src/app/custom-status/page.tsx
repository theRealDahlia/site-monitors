import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import StatusView from "@/components/StatusView";
import { lookupVerifiedDomain } from "@/lib/custom-domains";
import { entitlementsFor } from "@/lib/entitlements";

// The status page as shown on a customer's own domain. proxy.ts sends their domain's "/" here. Nothing on this page
// may mention Site Monitors, so the site-wide title, description and share image are all replaced.
export const metadata: Metadata = {
  title: { absolute: "Status" },
  description: "Current status and uptime.",
  applicationName: "Status",
  robots: { index: false },
  openGraph: { type: "website", siteName: "Status", title: "Status" },
  twitter: { card: "summary", title: "Status" },
};

async function ForThisDomain() {
  const host = (await headers()).get("host") ?? "";
  const served = lookupVerifiedDomain(host);
  const plan = served && entitlementsFor(served.ownerPlan);
  // One answer for every reason there's nothing to show: not a connected domain, page switched off, or plan changed.
  if (!served || !served.slug || !served.statusPublic || !plan?.whiteLabel || !plan.statusPages || (served.clientId !== null && !plan.clients)) notFound();
  return <StatusView slug={served.slug} customDomain />;
}

export default function CustomStatusPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl px-4 py-16 text-muted sm:px-6">Loading status…</main>}>
      <ForThisDomain />
    </Suspense>
  );
}
