import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

export default function DashboardPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Dashboard />
      </main>
      <Footer />
    </>
  );
}
