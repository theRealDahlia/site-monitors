import type { Metadata } from "next";
import { Footer, Header } from "@/components/SiteChrome";
import Notifications from "@/components/Notifications";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false },
};

export default function NotificationsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Notifications />
      </main>
      <Footer />
    </>
  );
}
