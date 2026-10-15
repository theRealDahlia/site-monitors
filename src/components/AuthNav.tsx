"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AuthNav() {
  // undefined = still loading, null = signed out
  const [user, setUser] = useState<{ email: string } | null | undefined>(undefined);

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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.reload();
  }

  if (user === undefined) return <span className="h-9 w-28" aria-hidden />;

  if (user) {
    return (
      <>
        <span className="hidden max-w-[12rem] truncate sm:inline" title={user.email}>
          {user.email}
        </span>
        <button onClick={logout} className="hover:text-foreground">
          Log out
        </button>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="hover:text-foreground">
        Log in
      </Link>
      <Link
        href="/signup"
        className="rounded-lg bg-accent px-3.5 py-2 font-medium text-accent-foreground hover:opacity-90"
      >
        Sign up
      </Link>
    </>
  );
}
