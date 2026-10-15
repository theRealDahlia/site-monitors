"use client";

import Link from "next/link";
import type { Usage } from "@/components/useChecker";

function AccountPrompt({ limit }: { limit: number }) {
  // Send them back to this page after they sign up or log in.
  const next = encodeURIComponent(window.location.pathname);

  return (
    <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-5">
      <h3 className="font-semibold">You&apos;ve used your {limit} free checks</h3>
      <p className="mt-1 text-sm text-muted">
        Create a free account for unlimited checks. We&apos;ll email you a confirmation code, and accounts get
        first access to monitoring and expiry alerts when they launch.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/signup?next=${next}`}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Create free account
        </Link>
        <Link href={`/login?next=${next}`} className="text-sm text-accent underline underline-offset-2">
          I already have an account
        </Link>
      </div>
    </div>
  );
}

/** Shows the remaining free checks, or the account prompt once they're used up. */
export default function FreeChecks({ usage }: { usage: Usage | null }) {
  if (!usage || usage.signedIn) return null;
  if (usage.used >= usage.limit) return <AccountPrompt limit={usage.limit} />;
  if (usage.used === 0) return null;

  const left = usage.limit - usage.used;
  return (
    <p className="mt-2 text-xs text-muted" aria-live="polite">
      {left} of {usage.limit} free checks left
    </p>
  );
}
