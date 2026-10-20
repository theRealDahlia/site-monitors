import type { Metadata } from "next";
import Reports from "@/components/Reports";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false },
};

export default function ReportsPage() {
  return <Reports />;
}
