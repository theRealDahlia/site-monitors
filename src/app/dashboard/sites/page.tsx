import type { Metadata } from "next";
import { Footer, Header } from "@/components/SiteChrome";
import ManageSites from "@/components/ManageSites";

export const metadata: Metadata = {
  title: "Manage sites",
  robots: { index: false },
};

export default function ManageSitesPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <ManageSites />
      </main>
      <Footer />
    </>
  );
}
