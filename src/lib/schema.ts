import { BRAND } from "./brand";
import { PLANS } from "./plans";
import { SITE_URL } from "./site-url";

// Structured data that tells search engines what the site and its pages are. Each one is a plain object that
// <JsonLd> turns into a script tag.

const organization = { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: BRAND, url: SITE_URL, logo: `${SITE_URL}/icon.svg` };

/** The home page: who we are, the site, and the product with its plans. */
export function homeSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: BRAND, publisher: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en" },
      {
        "@type": "SoftwareApplication",
        name: BRAND,
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "SSL certificate, domain expiry and uptime monitoring for agencies and freelancers, with status pages and reports for every client.",
        publisher: { "@id": `${SITE_URL}/#organization` },
        offers: PLANS.filter((p) => p.available).map((p) => ({
          "@type": "Offer",
          name: p.name,
          price: String(p.price),
          priceCurrency: "USD",
          description: p.summary,
          url: `${SITE_URL}/pricing`,
        })),
      },
    ],
  };
}

/** A free tool page, such as the SSL checker. */
export function toolSchema(name: string, path: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    url: `${SITE_URL}${path}`,
    description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}
