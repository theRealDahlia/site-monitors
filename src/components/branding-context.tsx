"use client";

import { createContext, useContext } from "react";
import { LANDING_FROM_APP } from "@/lib/landing";
import { type Branding, DEFAULT_BRANDING } from "@/lib/theme";

/** The signed-in account's look, shared by the app shell and the Appearance page so a change shows everywhere at once. */
export const BrandingContext = createContext<{ branding: Branding | null; setBranding: (b: Branding) => void; whiteLabel: boolean }>({
  branding: null,
  setBranding: () => {},
  whiteLabel: false,
});

export const useBranding = () => useContext(BrandingContext);

/**
 * The logo spot: the account's own logo if it has uploaded one, otherwise "Run by site-monitors.net",
 * where site-monitors.net links to the landing page in a new tab. That credit is a link, so it must not
 * be placed inside another one. Nothing is shown until the account is known, so the wrong one never flashes up first.
 */
export function BrandMark({ branding, size = "md" }: { branding: Branding | null; size?: "sm" | "md" }) {
  const height = size === "sm" ? "h-7" : "h-9";
  if (!branding) return <span className={`block ${height} w-32`} aria-hidden />;
  if (branding.logoUrl) {
    return (
      // A plain img: the logo is already small, and its address changes with every upload.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={branding.logoUrl} alt="Company logo" className={`${height} w-auto max-w-[180px] object-contain object-left`} />
    );
  }
  return (
    <span className={`flex ${height} items-center text-sm text-muted`}>
      Run by&nbsp;
      <a href={LANDING_FROM_APP} target="_blank" rel="noopener" className="font-semibold text-foreground underline-offset-2 hover:text-accent hover:underline">
        site-monitors.net<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </span>
  );
}

export { DEFAULT_BRANDING };
