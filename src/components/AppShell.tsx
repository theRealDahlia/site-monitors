"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PlanSwitcher from "@/components/PlanSwitcher";
import { BrandMark, BrandingContext } from "@/components/branding-context";
import { type Branding, applyTheme, resetTheme } from "@/lib/theme";

interface User {
  email: string;
  plan: string;
  planName: string;
  isAdmin: boolean;
  plans?: { id: string; name: string }[];
  branding: Branding;
}

// Small outline icons, drawn on a 24px grid.
const ICONS = {
  overview: "M3 12 12 4l9 8M5 10v10h5v-6h4v6h5V10",
  sites: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  notifications: "M6 9a6 6 0 1 1 12 0c0 5 2 7 2 7H4s2-2 2-7Zm4 10a2 2 0 0 0 4 0",
  integrations: "M9 7V3m6 4V3M7 7h10v4a5 5 0 0 1-10 0V7Zm5 9v5",
  plans: "M3 7h18v10H3zM3 11h18M7 15h3",
  appearance:
    "M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4ZM7.5 12h.01M10 8h.01M14 8h.01",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
} as const;

function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/sites", label: "Manage sites", icon: "sites" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
  { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" },
  { href: "/dashboard/appearance", label: "Appearance", icon: "appearance" },
  { href: "/dashboard/plans", label: "Plans", icon: "plans" },
] as const;

function Sidebar({ user, branding, onNavigate }: { user: User | null; branding: Branding | null; onNavigate?: () => void }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // The next person on this browser shouldn't start with this account's colours.
    resetTheme(true);
    window.location.replace("/");
  }

  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" onClick={onNavigate} aria-label="Overview" className="block px-5 py-5 pr-12">
        <BrandMark branding={branding} />
      </Link>

      <nav aria-label="App" className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-accent/10 text-accent" : "text-muted hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-border p-4">
        {user ? (
          <>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
                aria-hidden
              >
                {user.email.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={user.email}>
                  {user.email}
                </p>
                <p className="text-xs text-muted">{user.planName} plan</p>
              </div>
            </div>
            {user.isAdmin && user.plans && <PlanSwitcher plan={user.plan} plans={user.plans} />}
          </>
        ) : (
          <div className="h-9" aria-hidden />
        )}
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-accent hover:text-foreground"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

/** The signed-in app: navigation down the left side, or in a slide-out menu on a narrow screen. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [branding, setBrandingState] = useState<Branding | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.user) {
          setUser(d.user);
          setBrandingState(d.user.branding);
          applyTheme(d.user.branding, true);
        } else router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Who's signed in doesn't change between pages, so this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the app (to a public page) goes back to the site's own look.
  useEffect(() => () => resetTheme(), []);

  const setBranding = useCallback((b: Branding) => {
    setBrandingState(b);
    applyTheme(b, true);
  }, []);
  const brandingValue = useMemo(() => ({ branding, setBranding }), [branding, setBranding]);

  // While the menu is open: Escape closes it, focus moves into it, and the page behind doesn't scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const button = menuButton.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      button?.focus();
    };
  }, [menuOpen]);

  return (
    <BrandingContext.Provider value={brandingValue}>
      <div className="flex min-h-screen flex-1">
        {/* Wide screens: a fixed column on the left. */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-surface lg:block">
          <Sidebar user={user} branding={branding} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Narrow screens: a top bar with a button that opens the menu. */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
            <Link href="/dashboard" aria-label="Overview">
              <BrandMark branding={branding} size="sm" />
            </Link>
            <button
              ref={menuButton}
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="app-menu"
              className="rounded-lg p-2 text-muted hover:bg-foreground/5 hover:text-foreground"
            >
              <Icon name="menu" className="h-6 w-6" />
            </button>
          </header>

          <main className="w-full flex-1 px-4 py-8 sm:px-8 lg:py-10">
            <div className="mx-auto max-w-4xl">{children}</div>
          </main>
        </div>

        {menuOpen && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-hidden />
            <div
              ref={drawer}
              id="app-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface shadow-xl"
            >
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:bg-foreground/5 hover:text-foreground"
              >
                <Icon name="close" />
              </button>
              <Sidebar user={user} branding={branding} onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </BrandingContext.Provider>
  );
}
