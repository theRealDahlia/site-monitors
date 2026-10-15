"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** The free plan's button: sign up for visitors, straight to the dashboard for people already logged in. */
export default function PlanCta() {
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

  return (
    <Link
      href={email ? "/dashboard" : "/signup"}
      className="block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
    >
      {email ? "Open your dashboard" : "Create a free account"}
    </Link>
  );
}
