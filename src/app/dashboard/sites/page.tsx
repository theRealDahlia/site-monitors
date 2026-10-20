import type { Metadata } from "next";
import ManageSites from "@/components/ManageSites";

export const metadata: Metadata = {
  title: "Sites",
  robots: { index: false },
};

export default function ManageSitesPage() {
  return <ManageSites />;
}
