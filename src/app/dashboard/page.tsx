import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

export default function DashboardPage() {
  return <Dashboard />;
}
