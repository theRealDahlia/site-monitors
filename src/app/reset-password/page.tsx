import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
  // The address holds a one-time link; never send it to another site as a referrer.
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-3 text-muted">Pick a new password for your account.</p>
        <div className="mt-8">
          <AuthForm mode="reset" />
        </div>
      </main>
      <Footer />
    </>
  );
}
