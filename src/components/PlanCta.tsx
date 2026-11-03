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
  // The plan is picked on the Plans page once there is an account, so the button says that.
  const label = email ? (paid ? "Choose this plan" : "Open your dashboard") : paid ? `Sign up, then choose ${plan![0].toUpperCase()}${plan!.slice(1)}` : "Create a free account";
  return (
    <Link
      href={email ? (paid ? "/dashboard/plans" : "/dashboard") : paid ? "/signup?next=/dashboard/plans" : "/signup"}
      className="block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
    >
      {label}
    </Link>
  );
}
