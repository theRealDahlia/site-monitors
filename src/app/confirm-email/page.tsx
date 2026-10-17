import type { Metadata } from "next";
import EmailLinkAction from "@/components/EmailLinkAction";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Confirm alerts",
  robots: { index: false },
  // The address holds a one-time token; never send it to another site as a referrer.
  referrer: "no-referrer",
};

export default function ConfirmEmailPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-14 sm:px-6">
        <EmailLinkAction mode="confirm" />
      </main>
      <Footer />
    </>
  );
}
