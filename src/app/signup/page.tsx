import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Create a free account",
  description: "Create a free account for unlimited SSL and domain expiry checks.",
};

export default function SignupPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Create your free account</h1>
        <p className="mt-3 text-muted">
          Unlimited SSL and domain expiry checks. We&apos;ll email you a code to confirm your address, so
          only you can create an account with it. Monitoring and expiry alerts are coming next, and
          accounts get first access.
        </p>
        <div className="mt-8">
          <AuthForm mode="signup" />
        </div>
      </main>
      <Footer />
    </>
  );
}
