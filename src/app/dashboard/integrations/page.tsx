import type { Metadata } from "next";
import { Footer, Header } from "@/components/SiteChrome";
import Integrations from "@/components/Integrations";

export const metadata: Metadata = {
  title: "Integrations",
  robots: { index: false },
};

export default function IntegrationsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Integrations />
      </main>
      <Footer />
    </>
  );
}
