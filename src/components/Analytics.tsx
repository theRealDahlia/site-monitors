import AnalyticsScript from "@/components/AnalyticsScript";
import { ourHost } from "@/lib/hosts";

/**
 * Visitor analytics from a cookieless provider, switched on by setting these in the environment (see .env.example):
 * ANALYTICS_PROVIDER ("plausible" or "umami") and ANALYTICS_ID (the site's domain for Plausible, the website id for
 * Umami). Nothing loads without them, and nothing loads outside production.
 */
export default function Analytics() {
  const provider = process.env.ANALYTICS_PROVIDER?.trim();
  const id = process.env.ANALYTICS_ID?.trim();
  if (process.env.NODE_ENV !== "production" || !id || (provider !== "plausible" && provider !== "umami")) return null;
  const custom = process.env.ANALYTICS_SRC?.trim();
  const src = custom || (provider === "plausible" ? "https://plausible.io/js/script.js" : "https://cloud.umami.is/script.js");
  const attribute = provider === "plausible" ? "data-domain" : "data-website-id";
  return <AnalyticsScript src={src} attribute={attribute} id={id} host={ourHost()} />;
}
