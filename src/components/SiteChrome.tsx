import Link from "next/link";
import AuthNav from "@/components/AuthNav";
import LogoMark from "@/components/LogoMark";
import { BRAND } from "@/lib/brand";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-base font-semibold tracking-tight sm:gap-2.5 sm:text-lg">
          <LogoMark className="h-7 w-7 sm:h-8 sm:w-8" />
          {BRAND}
        </Link>
        <nav className="flex items-center gap-2.5 whitespace-nowrap text-sm text-muted sm:gap-5">
          <Link href="/ssl-checker" className="hover:text-foreground">
            SSL<span className="hidden sm:inline"> checker</span>
          </Link>
          <Link href="/domain-checker" className="hover:text-foreground">
            Domain<span className="hidden sm:inline"> checker</span>
          </Link>
          <Link href="/pricing" className="hidden hover:text-foreground sm:inline">
            Pricing
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
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-medium text-foreground">{BRAND}</p>
          <p className="mt-1">SSL, domain and uptime monitoring for agencies.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/ssl-checker" className="hover:text-foreground">
            SSL checker
          </Link>
          <Link href="/domain-checker" className="hover:text-foreground">
            Domain checker
          </Link>
          <Link href="/guides" className="hover:text-foreground">
            Guides
          </Link>
        </nav>
      </div>
    </footer>
  );
}
