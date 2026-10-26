"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

// Pages that belong to a signed-in person, a client or someone's status page aren't counted.
const PRIVATE = /^\/(dashboard|status|report|custom-status|join|confirm-email|stop-emails|reset-password)(\/|$)/;

/**
 * Loads the analytics script, but only on our own public pages: never on a customer's own domain (their visitors
 * aren't ours to measure) and never inside the app. Decided in the browser, because the host isn't known to the server
 * when the page is built.
 */
export default function AnalyticsScript({ src, attribute, id, host }: { src: string; attribute: string; id: string; host: string }) {
  const pathname = usePathname() ?? "";
  // The server renders "not ours" and the browser then settles on the real answer, so nothing mismatches.
  const ours = useSyncExternalStore(
    () => () => {},
    () => window.location.hostname === host || window.location.hostname === `www.${host}`,
    () => false,
  );
  if (!ours || PRIVATE.test(pathname)) return null;
  return <Script src={src} strategy="afterInteractive" defer {...{ [attribute]: id }} />;
}
