"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

/**
 * Fades a page in as the one before it fades out, whenever the address changes. `scope` picks which part of the
 * address counts: the whole site uses the path, except that the app's pages share one key, so moving around inside
 * the app doesn't redraw its menu (the app's own content area has a second one of these for that).
 */
export default function PageTransition({ children, scope = "page" }: { children: React.ReactNode; scope?: "site" | "page" }) {
  const pathname = usePathname() ?? "";
  const key = scope === "site" && pathname.startsWith("/dashboard") ? "/dashboard" : pathname;
  return (
    <ViewTransition key={key} enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
