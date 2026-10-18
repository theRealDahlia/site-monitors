import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-3 text-muted">Enter the email you signed up with and we&apos;ll send you a link to choose a new password.</p>
        <div className="mt-8">
          <AuthForm mode="forgot" />
        </div>
      </main>
      <Footer />
    </>
  );
}
