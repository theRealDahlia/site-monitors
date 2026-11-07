"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/ssl-checker", label: "SSL checker" },
  { href: "/domain-checker", label: "Domain checker" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * The header links on a phone, behind one Menu button (from 640px up they sit in the header itself). The panel is as wide
 * as the header, so it fits any screen; it closes on a tap outside it, on Escape, and when a link is chosen.
 * It must be placed inside a `relative` header.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="sm:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
        className="-my-3 flex items-center gap-1 py-3 hover:text-foreground"
      >
        Menu
        <span aria-hidden className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="absolute inset-x-4 top-full z-30 mt-1 rounded-xl border border-border bg-surface p-1 shadow-lg">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base text-foreground hover:bg-border/40">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
