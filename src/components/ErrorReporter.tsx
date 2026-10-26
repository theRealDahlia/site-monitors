"use client";

import { useEffect } from "react";

/** Sends uncaught errors from the visitor's browser to the server, so a broken page gets noticed. Renders nothing. */
export function reportBrowserError(error: unknown) {
  try {
    const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
    const body = JSON.stringify({ message: e.message, stack: e.stack, path: window.location.pathname });
    // sendBeacon survives a page that's closing; fetch is the fallback.
    if (!navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    // Reporting is best effort.
  }
}

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportBrowserError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportBrowserError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
