"use client";

import { useEffect } from "react";
import { reportBrowserError } from "@/components/ErrorReporter";

// What a visitor sees when a page breaks while it's being drawn, instead of a blank screen. The error is reported too.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportBrowserError(error);
  }, [error]);
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted">We&apos;ve been told about it. Try again, and if it keeps happening, reload the page.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90">
        Try again
      </button>
    </main>
  );
}
