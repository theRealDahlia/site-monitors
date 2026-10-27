import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { SITE_UPDATED, SITE_URL } from "@/lib/site-url";

// Only public pages worth finding in search. Not here: the dashboard, login and sign-up, status pages
// (their owners chose to share them, not to publish them) and the links in emails.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/ssl-checker`, lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/domain-checker`, lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/guides`, lastModified: SITE_UPDATED, changeFrequency: "weekly", priority: 0.8 },
    ...GUIDES.map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: g.updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/signup`, lastModified: SITE_UPDATED, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/pricing`, lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: SITE_UPDATED, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: SITE_UPDATED, changeFrequency: "yearly", priority: 0.2 },
  ];
}
