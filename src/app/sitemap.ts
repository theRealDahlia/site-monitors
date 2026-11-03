import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/site-url";

// When each page last changed in a way worth telling search engines. Update a page's date when its content changes.
const UPDATED = { home: "2026-11-02", pricing: "2026-11-02", guides: "2026-11-02", signup: "2026-11-02", tools: "2026-10-26", legal: "2026-10-26" };

// Only public pages worth finding in search. Not here: the dashboard, login and sign-up, status pages
// (their owners chose to share them, not to publish them) and the links in emails.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: UPDATED.home, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/ssl-checker`, lastModified: UPDATED.tools, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/domain-checker`, lastModified: UPDATED.tools, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/guides`, lastModified: UPDATED.guides, changeFrequency: "weekly", priority: 0.8 },
    ...GUIDES.map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: g.updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/signup`, lastModified: UPDATED.signup, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/pricing`, lastModified: UPDATED.pricing, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: UPDATED.legal, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: UPDATED.legal, changeFrequency: "yearly", priority: 0.2 },
  ];
}
