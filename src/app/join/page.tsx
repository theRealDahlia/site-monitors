import type { Metadata } from "next";
import JoinTeam from "@/components/JoinTeam";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Join a team",
  robots: { index: false },
  // The address holds the invitation; never send it to another site as a referrer.
  referrer: "no-referrer",
};

export default function JoinPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-14 sm:px-6">
        <JoinTeam />
      </main>
      <Footer />
    </>
  );
}
