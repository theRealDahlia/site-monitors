import dns from "node:dns";
import https from "node:https";
import net from "node:net";
import { isPublicAddress } from "./ssl-check";

export interface UptimeResult {
  up: boolean;
  status: number | null;
  ms: number | null;
  error: string | null;
}

const TIMEOUT_MS = 10_000;

/**
 * Resolves the hostname ourselves and refuses private or reserved addresses. Node then connects
 * to exactly the address we validated, so a hostname that changes its DNS answer between our
 * check and the connection (DNS rebinding) can't aim us at an internal service.
 */
const safeLookup: typeof dns.lookup = ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address, a.family))) {
      return callback(Object.assign(new Error("Resolves to a private address"), { code: "EPRIVATE" }));
    }
    if (options?.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}) as typeof dns.lookup;

const ERROR_TEXT: Record<string, string> = {
  ENOTFOUND: "DNS lookup failed",
  EAI_AGAIN: "DNS lookup failed",
  ECONNREFUSED: "Connection refused",
  ECONNRESET: "Connection reset",
  ETIMEDOUT: "Connection timed out",
  EHOSTUNREACH: "Host unreachable",
  ENETUNREACH: "Network unreachable",
  EPRIVATE: "Resolves to a private address",
};

/**
 * Is the site answering? Any HTTP response below 500 counts as up: a 403 or 401 still means the
 * server is alive, and plenty of healthy sites refuse robots. Connection failures, timeouts and
 * 5xx responses count as down. Redirects are not followed, so a redirect can't point us at an
 * internal address. Certificate problems are the SSL check's job, so they don't mark a site down.
 */
export function checkUptime(host: string): Promise<UptimeResult> {
  // Node skips our DNS lookup for a literal IP address and connects straight to it, which would
  // bypass the private-address check below. Only hostnames are ever monitored, so refuse IPs.
  if (net.isIP(host) || host.startsWith("[")) {
    return Promise.resolve({ up: false, status: null, ms: null, error: "IP addresses can't be monitored" });
  }
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    const done = (result: UptimeResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const req = https.request(
      {
        host,
        port: 443,
        path: "/",
        method: "GET",
        servername: host,
        lookup: safeLookup,
        rejectUnauthorized: false,
        timeout: TIMEOUT_MS,
        headers: { Host: host, "User-Agent": "SiteMonitors-UptimeCheck/1.0", Accept: "*/*" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const ms = Date.now() - started;
        res.destroy(); // headers are enough; don't download the page
        done(
          status < 500
            ? { up: true, status, ms, error: null }
            : { up: false, status, ms, error: `Server error (HTTP ${status})` },
        );
      },
    );

    req.on("timeout", () => {
      req.destroy();
      done({ up: false, status: null, ms: null, error: "Timed out after 10s" });
    });
    req.on("error", (err: NodeJS.ErrnoException) => {
      done({ up: false, status: null, ms: null, error: ERROR_TEXT[err.code ?? ""] ?? err.message.slice(0, 120) });
    });
    req.end();
  });
}
