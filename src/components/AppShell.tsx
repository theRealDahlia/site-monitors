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
  /** The plan includes white label (status pages on your own domain, no Site Monitors credit). */
  whiteLabel: boolean;
  /** The plan includes the Appearance settings on the Account page (Starter and up). */
  canBrand: boolean;
  /** Set when they're working in a team owner's account rather than their own. */
  team: { ownerEmail: string } | null;
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
  ai: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z",
  whiteLabel: "M3 12V4h8l10 10-8 8L3 12Zm5-4h.01",
  guides: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 14a2 2 0 0 1 2-2h13M9 7h6",
  reports: "M7 3h7l5 5v13H7V3Zm7 0v5h5M10 17v-3m3 3v-6m3 6v-4",
  api: "M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16",
  team: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10c0-3.3 3.1-6 7-6s7 2.7 7 6M17 3.5a4 4 0 0 1 0 7M22 21c0-2.6-1.8-4.8-4.5-5.6",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9c0-3.9 3.6-7 8-7s8 3.1 8 7",
  contact: "M3 5h18v14H3V5Zm0 1 9 7 9-7",
  clients: "M3 21V8l6-4v17M9 21V10h12v11M3 21h18M13 14h2m2 0h.01M13 17.5h2m2 0h.01",
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

// Grouped so the pages about your sites sit apart from account settings and help.
const NAV = [
  {
    heading: null,
    items: [{ href: "/dashboard", label: "Overview", icon: "overview" }],
  },
  {
    heading: "Monitoring",
    items: [
      { href: "/dashboard/sites", label: "Sites", icon: "sites" },
      { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
      { href: "/dashboard/ai-visibility", label: "AI visibility", icon: "ai" },
    ],
  },
  {
    heading: "Clients",
    items: [
      { href: "/dashboard/clients", label: "Clients", icon: "clients" },
      { href: "/dashboard/reports", label: "Reports", icon: "reports" },
      { href: "/dashboard/white-label", label: "White label", icon: "whiteLabel" },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" },
      { href: "/dashboard/team", label: "Team", icon: "team" },
      { href: "/dashboard/api", label: "API & export", icon: "api" },
    ],
  },
  {
    heading: "Account",
    items: [
      { href: "/dashboard/plans", label: "Plans", icon: "plans" },
      { href: "/dashboard/account", label: "Account", icon: "account" },
    ],
  },
  {
    heading: "Help",
    items: [
      { href: "/dashboard/guides", label: "Guides", icon: "guides" },
      { href: "/dashboard/contact", label: "Contact us", icon: "contact" },
    ],
  },
] as const;

/** The logo spot. A logo or name links to Overview. The "Run by" credit has its own link, so it isn't wrapped in another. */
function BrandHome({ branding, size, className, onNavigate }: { branding: Branding | null; size?: "sm" | "md"; className?: string; onNavigate?: () => void }) {
  if (branding && !branding.logoUrl && !branding.name) {
    return (
      <div className={className}>
        <BrandMark branding={branding} size={size} />
      </div>
    );
  }
  return (
    <Link href="/dashboard" onClick={onNavigate} aria-label="Overview" className={className}>
      <BrandMark branding={branding} size={size} />
    </Link>
  );
}

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
      {/* In the phone menu, room is left on the right for its close button. */}
      <BrandHome branding={branding} onNavigate={onNavigate} className={`block px-5 py-5 ${onNavigate ? "pr-12" : ""}`} />

      <nav aria-label="App" className="flex-1 overflow-y-auto px-3">
        {NAV.map((group, i) => (
          <div key={group.heading ?? "main"} className={i ? "mt-5" : ""}>
            {group.heading && <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted/80">{group.heading}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                // A site's own page keeps Sites lit, and an article keeps Guides lit. Overview is only itself, as every page is under /dashboard.
                const active = item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
          </div>
        ))}
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
                <p className="truncate text-xs text-muted" title={user.team ? `In ${user.team.ownerEmail}'s account` : undefined}>
                  {user.team ? `In ${user.team.ownerEmail}'s account` : `${user.planName} plan`}
                </p>
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
  const whiteLabel = !!user?.whiteLabel;
  const canBrand = !!user?.canBrand;
  const brandingValue = useMemo(() => ({ branding, setBranding, whiteLabel, canBrand }), [branding, setBranding, whiteLabel, canBrand]);

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
            <BrandHome branding={branding} size="sm" />
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
            <div className="app-page mx-auto max-w-4xl">{children}</div>
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
