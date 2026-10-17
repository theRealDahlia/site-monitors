import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing useful for a search engine lives behind these: the app's data and the logged-in dashboard.
      // Pages that should stay out of results (status pages, email links) say so themselves with noindex,
      // which a crawler can only read if it's allowed to visit them, so they aren't listed here.
      disallow: ["/api/", "/dashboard"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
