import { SITE_URL } from "./site-url";

// Which addresses are this site itself, as opposed to a customer's own domain pointed at us. Kept apart from the
// database code so the request filter (proxy.ts) can use it without loading anything heavy.

/** Our own address, which customers point their domain at. */
export function ourHost(): string {
  return new URL(SITE_URL).hostname;
}

/** Hosts that are this site itself, never a customer's. A port, if any, is ignored. */
export function isPrimaryHost(host: string): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  const ours = ourHost();
  return h === ours || h === `www.${ours}` || h === "localhost" || h === "127.0.0.1" || h === "::1";
}
