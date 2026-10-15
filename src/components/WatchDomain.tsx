"use client";

import Link from "next/link";
import { useState } from "react";

interface Props {
  /** The domain the result card is about. */
  domain: string;
  /** What we'd watch, e.g. "SSL certificate" or "registration". */
  subject: string;
  /** Days until expiry, if known, used to make the prompt specific. */
  daysRemaining: number | null;
  signedIn: boolean;
}

/** Shown under a checker result: one click to start monitoring if signed in, otherwise a path to sign up. */
export default function WatchDomain({ domain, subject, daysRemaining, signedIn }: Props) {
  const [state, setState] = useState<"idle" | "adding" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const next = encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname);
  const urgent = daysRemaining !== null && daysRemaining <= 60;

  async function watch() {
    if (state === "adding") return;
    setState("adding");
    setError(null);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: domain }),
      });
      const data = await res.json();
      if (res.ok || res.status === 409) {
        setState("done"); // 409 means they already watch it, which is the outcome they wanted
      } else {
        setError(data.error ?? "Something went wrong.");
        setState("idle");
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
      setState("idle");
    }
  }

  const heading = urgent ? "Don't rely on remembering this date." : `Want a warning before ${domain} lapses?`;

  return (
    <div className="mt-6 rounded-lg border border-accent/40 bg-accent/5 p-4">
      {state === "done" ? (
        <p role="status" className="text-sm">
          <span className="font-medium text-ok">Now watching {domain}.</span> We&apos;ll email you if the{" "}
          {subject} is about to expire or the site goes down.{" "}
          <Link href="/dashboard" className="text-accent underline underline-offset-2">
            View your dashboard
          </Link>
        </p>
      ) : (
        <>
          <h4 className="text-sm font-semibold">{heading}</h4>
          {signedIn ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Watch {domain} and we&apos;ll email you before the {subject} expires, and if the site goes down.
              </p>
              <button
                type="button"
                onClick={watch}
                disabled={state === "adding"}
                className="mt-3 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {state === "adding" ? "Setting up…" : `Watch ${domain}`}
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                Create a free account and we&apos;ll email you before the {subject} for {domain} expires, and if the site
                goes down.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href={`/signup?next=${next}`}
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                  Create free account
                </Link>
                <Link href={`/login?next=${next}`} className="text-sm text-accent underline underline-offset-2">
                  Log in
                </Link>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-bad">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
