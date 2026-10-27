/**
 * The public address of the site, for the sitemap, canonical links and social preview tags. It's
 * APP_URL when that's set (the same value emails use), and the real domain otherwise, so a build
 * without it can never put a wrong address in search results.
 */
export const SITE_URL = process.env.APP_URL?.trim().replace(/\/$/, "") || "https://site-monitors.net";

/** When the site's pages last changed in a way worth telling search engines (an ISO date). */
export const SITE_UPDATED = "2026-10-26";
