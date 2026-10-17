import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
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
  title: {
    default: `${BRAND} — SSL, domain and uptime monitoring for every client site`,
    template: `%s | ${BRAND}`,
  },
  description:
    "Get alerted before an SSL certificate or domain expires, and when a site goes down. Built for agencies and freelancers who manage many client sites.",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
