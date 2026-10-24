"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * A plan's button on the public pricing page. Free: sign up for visitors, the dashboard for people already logged in.
 * A paid plan (`plan`): sign up for visitors, who pick it on their Plans page once they have an account.
 */
export default function PlanCta({ plan }: { plan?: string }) {
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

  const paid = Boolean(plan);
  const label = email ? (paid ? "Choose this plan" : "Open your dashboard") : paid ? "Sign up to subscribe" : "Create a free account";
  return (
    <Link
      href={email ? (paid ? "/dashboard/plans" : "/dashboard") : "/signup"}
      className="block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
    >
      {label}
    </Link>
  );
}
