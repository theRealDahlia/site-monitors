"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LANDING_PARAM, LANDING_VALUE } from "@/lib/landing";

/**
 * Sends a logged-in person into the app if they end up on a page that's only for visitors (the
 * landing, login, sign-up, checker and pricing pages). The proxy already does this before the page
 * loads. This covers the browser's Back button, which can show a saved copy of the page without
 * asking the server.
 */
export default function SignedInRedirect({ to = "/dashboard" }: { to?: `/dashboard${string}` }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      // Opened from the "Run by site-monitors.net" link in the app: stay on this page.
      if (new URLSearchParams(window.location.search).get(LANDING_PARAM) === LANDING_VALUE) return;
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.user) router.replace(to);
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
  }, [router, to]);

  return null;
}
