import type { Metadata } from "next";
import ManageSites from "@/components/ManageSites";

export const metadata: Metadata = {
  title: "Manage sites",
  robots: { index: false },
};

export default function ManageSitesPage() {
  return <ManageSites />;
}
