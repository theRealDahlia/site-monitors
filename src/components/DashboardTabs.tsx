"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sites", label: "Manage sites" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/integrations", label: "Integrations" },
];

export default function DashboardTabs() {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);

  // On a narrow screen the tabs scroll sideways. Bring the current one into view so you can see where you are.
  useEffect(() => {
    const strip = nav.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (strip && current) strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav ref={nav} aria-label="Dashboard sections" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
              active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
