import Link from "next/link";
import AuthNav from "@/components/AuthNav";
import { BRAND } from "@/lib/brand";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="whitespace-nowrap text-base font-semibold tracking-tight sm:text-lg">
          {BRAND}
        </Link>
        <nav className="flex items-center gap-2.5 whitespace-nowrap text-sm text-muted sm:gap-5">
          <Link href="/ssl-checker" className="hover:text-foreground">
            SSL<span className="hidden sm:inline"> checker</span>
          </Link>
          <Link href="/domain-checker" className="hover:text-foreground">
            Domain<span className="hidden sm:inline"> checker</span>
          </Link>
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <p>{BRAND}</p>
        <p>SSL, domain and uptime monitoring for agencies.</p>
      </div>
    </footer>
  );
}
