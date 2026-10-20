import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      {/* Applies the account's saved light/dark and colour before anything is drawn, so it doesn't flash. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      {/* The menu reads the address to light up the current page. On a page whose address is only known when it's
          requested (one site's page, /dashboard/sites/12), Next needs a Suspense boundary for that; on every other
          page the address is known ahead of time and nothing waits. */}
      <Suspense fallback={<div className="min-h-screen flex-1" />}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </>
  );
}
