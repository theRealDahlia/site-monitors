import { lookupVerifiedDomain } from "@/lib/custom-domains";
import { entitlementsFor } from "@/lib/entitlements";

/**
 * The web server asks this before it gets an HTTPS certificate for a domain it has never seen (Caddy's "ask"). The
 * answer is yes only for a verified custom domain whose owner is still on a plan that includes it, so nobody can make
 * us request certificates for domains that aren't connected to an account.
 *
 * It's meant for the web server on this machine. Next adds an X-Forwarded-For header holding the address a request
 * really came from, and the web server replaces any value a visitor sends. So the web server's own question shows the
 * loopback address, and a visitor's request relayed from the internet shows the visitor's address and gets the same
 * "no" as an unknown domain. That way this can't be used to find out which domains are connected.
 */
const isLoopback = (ip: string) => /^(::ffff:)?127\.\d+\.\d+\.\d+$/.test(ip) || ip === "::1";

export async function GET(request: Request) {
  const from = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (!isLoopback(from)) return new Response(null, { status: 404 });
  const domain = new URL(request.url).searchParams.get("domain") ?? "";
  if (!domain || domain.length > 253) return new Response(null, { status: 404 });
  const served = lookupVerifiedDomain(domain);
  return new Response(null, { status: served && entitlementsFor(served.ownerPlan).whiteLabel ? 200 : 404 });
}
