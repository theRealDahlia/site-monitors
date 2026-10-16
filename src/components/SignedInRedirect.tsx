"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Sends a logged-in person to the dashboard if they end up on a page that's only for visitors (the
 * landing, login and sign-up pages). The proxy already does this before the page loads. This covers
 * the browser's Back button, which can show a saved copy of the page without asking the server.
 */
export default function SignedInRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.user) router.replace("/dashboard");
        })
        .catch(() => {});
    };
    check();
    // "pageshow" with persisted=true means the browser restored this page from its back/forward cache
    // without reloading it, so the check above wouldn't run again by itself.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) check();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
