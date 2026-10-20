"use client";

import { createContext, useContext } from "react";
import { LANDING_FROM_APP } from "@/lib/landing";
import { type Branding, DEFAULT_BRANDING } from "@/lib/theme";

/** The signed-in account's look, shared by the app shell and the Appearance page so a change shows everywhere at once. */
export const BrandingContext = createContext<{
  branding: Branding | null;
  setBranding: (b: Branding) => void;
  /** The plan includes white label. */
  whiteLabel: boolean;
  /** The plan includes the Appearance page (Starter and up). */
  canBrand: boolean;
}>({
  branding: null,
  setBranding: () => {},
  whiteLabel: false,
  canBrand: false,
});

export const useBranding = () => useContext(BrandingContext);

/**
 * The logo spot: the account's own logo and name if it has set them (either on its own works too), otherwise "Run by site-monitors.net",
 * where site-monitors.net links to the landing page in a new tab. That credit is a link, so it must not
 * be placed inside another one. Nothing is shown until the account is known, so the wrong one never flashes up first.
 */
export function BrandMark({ branding, size = "md" }: { branding: Branding | null; size?: "sm" | "md" }) {
  const height = size === "sm" ? "h-7" : "h-9";
  if (!branding) return <span className={`block ${height} w-32`} aria-hidden />;
  if (branding.logoUrl || branding.name) {
    return (
      <span className={`flex ${size === "sm" ? "min-h-7" : "min-h-9"} min-w-0 items-center gap-2.5`}>
        {branding.logoUrl && (
          // A plain img: the logo is already small, and its address changes with every upload. With a name beside it,
          // the name says who it is, so the image needs no description of its own.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.name ? "" : "Company logo"}
            className={`${height} w-auto shrink-0 object-contain object-left ${branding.name ? "max-w-[120px]" : "max-w-[180px]"}`}
          />
        )}
        {/* A long name wraps onto a second line rather than being cut short. */}
        {branding.name && (
          <span className={`line-clamp-2 min-w-0 break-words font-semibold leading-tight tracking-tight ${size === "sm" ? "text-sm" : "text-base"}`}>{branding.name}</span>
        )}
      </span>
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
