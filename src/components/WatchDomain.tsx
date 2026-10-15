"use client";

import { useState } from "react";

interface Props {
  /** The domain the result card is about. */
  domain: string;
  /** Which checker the visitor came from; stored so we know which tool converts. */
  kind: "ssl" | "domain";
  /** What we'd watch, e.g. "certificate" or "registration". */
  subject: string;
  /** Days until expiry, if known, used to make the prompt specific. */
  daysRemaining: number | null;
}

export default function WatchDomain({ domain, kind, subject, daysRemaining }: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, watch: domain, kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Couldn't reach the server. Try again.");
      setState("idle");
    }
  }

  const urgent = daysRemaining !== null && daysRemaining <= 60;

  return (
    <div className="mt-6 rounded-lg border border-accent/40 bg-accent/5 p-4">
      {state === "done" ? (
        <p role="status" className="text-sm">
          <span className="font-medium text-ok">Saved.</span> We&apos;ve noted {domain}. Monitoring
          isn&apos;t live yet, so nothing is being watched today. We&apos;ll email you when it
          opens, and you&apos;ll be first to get alerts for this domain.
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          <h4 className="text-sm font-semibold">
            {urgent
              ? `Don't rely on remembering this date.`
              : `Want a warning before ${domain} lapses?`}
          </h4>
          <p className="mt-1 text-sm text-muted">
            We&apos;re launching monitoring that emails you before the {subject} for {domain}{" "}
            expires. Leave your email to be first on the list for it.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`watch-email-${kind}`} className="sr-only">
              Email address
            </label>
            <input
              id={`watch-email-${kind}`}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {state === "sending" ? "Saving…" : "Notify me"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-bad">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
