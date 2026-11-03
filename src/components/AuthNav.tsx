"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfileMenu from "@/components/ProfileMenu";

/**
 * `guest`: for pages only signed-out visitors see (the proxy sends anyone logged in to the app), so the Log in and Sign
 * up buttons are in the page from the start instead of appearing once the account check answers.
 */
export default function AuthNav({ guest = false }: { guest?: boolean }) {
  // undefined = still loading, null = signed out
  const [user, setUser] = useState<{ email: string; plan: string; isAdmin: boolean; plans?: { id: string; name: string }[] } | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => !cancelled && setUser(d.user ?? null))
      .catch(() => !cancelled && setUser(null));
    return () => {
      cancelled = true;
    };
  }, []);

  if (user === undefined && !guest) return <span className="h-9 w-28" aria-hidden />;

  if (user) return <ProfileMenu email={user.email} plan={user.plan} isAdmin={user.isAdmin} plans={user.plans ?? []} />;

  return (
    <>
      <Link href="/login" className="-my-3 py-3 hover:text-foreground">
        Log in
      </Link>
      <Link
        href="/signup"
        className="rounded-lg bg-accent px-3 py-2 font-medium sm:px-3.5 text-accent-foreground hover:opacity-90"
      >
        Sign up
      </Link>
    </>
  );
}
