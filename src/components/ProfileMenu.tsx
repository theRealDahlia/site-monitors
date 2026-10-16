"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** The round profile icon in the header. It opens a small menu with the dashboard and log out. */
export default function ProfileMenu({ email, plan, isAdmin, plans }: { email: string; plan: string; isAdmin: boolean; plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
  }

  // Admins only. Changes their own account's plan, then reloads so every page shows the new limits.
  async function switchPlan(next: string) {
    if (switching || next === plan) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      const res = await fetch("/api/admin/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: next }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      setSwitchError((await res.json()).error ?? "Couldn't switch plans.");
    } catch {
      setSwitchError("Couldn't reach the server.");
    }
    setSwitching(false);
  }

  const initial = email.trim().charAt(0).toUpperCase() || "?";
  const item = "block w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-accent/10";

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground ring-offset-2 ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          <p className="truncate border-b border-border px-4 py-2.5 text-xs text-muted" title={email}>
            Signed in as <span className="text-foreground">{email}</span>
          </p>
          {isAdmin && (
            <div className="border-b border-border px-4 py-3" role="group" aria-label="Admin plan switcher">
              <p className="text-xs font-medium text-accent">Admin · switch your plan</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => switchPlan(p.id)}
                    disabled={switching}
                    aria-pressed={plan === p.id}
                    className={`rounded-md border px-2 py-1.5 text-sm disabled:opacity-60 ${
                      plan === p.id ? "border-accent bg-accent/10 font-medium text-foreground" : "border-border text-muted hover:border-accent"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              {switchError && (
                <p role="alert" className="mt-2 text-xs text-bad">
                  {switchError}
                </p>
              )}
            </div>
          )}
          <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)} className={item}>
            Dashboard
          </Link>
          <Link href="/dashboard/sites" role="menuitem" onClick={() => setOpen(false)} className={item}>
            Manage sites
          </Link>
          <Link href="/dashboard/notifications" role="menuitem" onClick={() => setOpen(false)} className={item}>
            Notifications
          </Link>
          <button type="button" role="menuitem" onClick={logout} className={item}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
