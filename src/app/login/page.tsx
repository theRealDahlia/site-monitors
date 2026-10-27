import SignedInRedirect from "@/components/SignedInRedirect";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { Footer, Header } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Log in",
  // Nothing here for search results: the page only exists to sign in.
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <>
      <Header />
      <SignedInRedirect />
      <main className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Log in</h1>
        <div className="mt-8">
          <AuthForm mode="login" />
        </div>
      </main>
      <Footer />
    </>
  );
}
