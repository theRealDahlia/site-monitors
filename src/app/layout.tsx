import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";
import Analytics from "@/components/Analytics";
import ErrorReporter from "@/components/ErrorReporter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Makes every relative address in the page's tags (like the share image) a full one.
  metadataBase: new URL(SITE_URL),
  applicationName: BRAND,
  openGraph: { type: "website", siteName: BRAND, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  title: {
    default: `SSL, Domain & Uptime Monitoring for Agencies | ${BRAND}`,
    template: `%s | ${BRAND}`,
  },
  description:
    "Get emailed before a client's SSL certificate or domain expires, or a site goes down. Free for 5 sites, with client status pages from $9/month.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The dashboard sets the account's light/dark and colours on <html> before React starts (see
      // THEME_BOOT_SCRIPT), so those attributes are expected to differ from the server's copy.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ErrorReporter />
        {/* The script component reads the address, which on pages with a changing part needs a Suspense boundary. */}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </body>
    </html>
  );
}
