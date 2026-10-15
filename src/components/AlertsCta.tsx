"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** A call to action that adapts: sign-up buttons for visitors, a dashboard link for people who are logged in. */
export default function AlertsCta({ heading, body }: { heading: string; body: string }) {
  // undefined = still checking, null = signed out
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => !cancelled && setEmail(d.user?.email ?? null))
      .catch(() => !cancelled && setEmail(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const primary =
    "rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90";

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{heading}</h2>
      <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">{body}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {email ? (
          <Link href="/dashboard" className={primary}>
            Open your dashboard
          </Link>
        ) : (
          <>
            <Link href="/signup" className={primary}>
              Create a free account
            </Link>
            {email === null && (
              <Link href="/login" className="text-sm text-accent underline underline-offset-2">
                Log in
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
