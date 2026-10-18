import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { safeLookup } from "./uptime-check";

// Fetches a page from a site we were given. The site is somebody else's, so this is careful:
//  - Every connection goes to an address we resolved and checked is public (never a private or internal one),
//    including after each redirect.
//  - Only the standard web ports, no logins in the address, no IP addresses.
//  - A limit on time, on redirects and on how much of the page is read.

export interface FetchOptions {
  userAgent: string;
  /** Stop reading after this many bytes. */
  maxBytes: number;
  accept?: string;
}

export interface FetchResult {
  status: number;
  /** Header names are lower-case. */
  headers: http.IncomingHttpHeaders;
  body: string;
  truncated: boolean;
  /** Where we ended up after redirects. */
  finalUrl: string;
  ms: number;
}

export type Fetcher = (url: string, options: FetchOptions) => Promise<FetchResult>;

export class FetchError extends Error {
  readonly code: string;
  constructor(message: string, code: string = "EFETCH") {
    super(message);
    this.code = code;
  }
}

const MAX_REDIRECTS = 5;
const IDLE_TIMEOUT_MS = 8_000;
const TOTAL_TIMEOUT_MS = 15_000;

const ERROR_TEXT: Record<string, string> = {
  ENOTFOUND: "DNS lookup failed",
  EAI_AGAIN: "DNS lookup failed",
  ECONNREFUSED: "Connection refused",
  ECONNRESET: "Connection reset",
  ETIMEDOUT: "Connection timed out",
  EHOSTUNREACH: "Host unreachable",
  ENETUNREACH: "Network unreachable",
  EPRIVATE: "Resolves to a private address",
  CERT_HAS_EXPIRED: "Certificate expired",
};

/** Checks an address is one we're willing to fetch, and returns it parsed. Throws FetchError if not. */
export function validateTarget(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("Not a valid address", "EBADURL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchError("Only http and https addresses can be fetched", "EBADURL");
  if (url.username || url.password) throw new FetchError("Addresses with a login in them can't be fetched", "EBADURL");
  // The URL parser drops a port that is the default for the scheme, so any port left over is an unusual one.
  if (url.port) throw new FetchError("Only the standard web ports can be fetched", "EBADURL");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  // Node skips our address check for a literal IP and connects straight to it, so refuse those outright.
  if (net.isIP(hostname) || url.hostname.startsWith("[")) throw new FetchError("IP addresses can't be fetched", "EBADURL");
  return url;
}

function once(url: URL, options: FetchOptions): Promise<{ res: http.IncomingMessage; started: number }> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        lookup: safeLookup,
        timeout: IDLE_TIMEOUT_MS,
        ...(url.protocol === "https:" ? { servername: url.hostname, rejectUnauthorized: false } : {}),
        headers: {
          "User-Agent": options.userAgent,
          Accept: options.accept ?? "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
          "Accept-Encoding": "gzip, deflate",
        },
      },
      (res) => resolve({ res, started }),
    );
    req.on("timeout", () => req.destroy(new FetchError("Timed out", "ETIMEDOUT")));
    req.on("error", (err: NodeJS.ErrnoException) => reject(err instanceof FetchError ? err : new FetchError(ERROR_TEXT[err.code ?? ""] ?? err.message.slice(0, 120), err.code ?? "EFETCH")));
    req.end();
  });
}

/** Reads a response body as text, up to a limit, undoing gzip or deflate. */
function readBody(res: http.IncomingMessage, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
  return new Promise((resolve) => {
    const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
    let stream: NodeJS.ReadableStream = res;
    if (encoding === "gzip") stream = res.pipe(zlib.createGunzip());
    else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
    else if (encoding && encoding !== "identity") return resolve({ body: "", truncated: false }); // an encoding we didn't ask for and can't read

    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (truncated: boolean) => {
      if (done) return;
      done = true;
      res.destroy();
      resolve({ body: Buffer.concat(chunks).toString("utf8"), truncated });
    };
    stream.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
        finish(true);
      } else chunks.push(chunk);
    });
    stream.on("end", () => finish(false));
    stream.on("error", () => finish(false)); // keep what we got
    res.on("error", () => finish(false));
  });
}

export const safeFetch: Fetcher = async (rawUrl, options) => {
  const overall = Date.now();
  let url = validateTarget(rawUrl);
  for (let hop = 0; ; hop++) {
    if (Date.now() - overall > TOTAL_TIMEOUT_MS) throw new FetchError("Timed out", "ETIMEDOUT");
    const { res, started } = await once(url, options);
    const status = res.statusCode ?? 0;
    const location = res.headers.location;
    if (status >= 300 && status < 400 && location) {
      res.destroy();
      if (hop >= MAX_REDIRECTS) throw new FetchError("Too many redirects", "EREDIRECTS");
      // Each hop is checked like the first, so a redirect can't lead us somewhere we'd have refused to start.
      url = validateTarget(new URL(location, url).href);
      continue;
    }
    const { body, truncated } = await readBody(res, options.maxBytes);
    return { status, headers: res.headers, body, truncated, finalUrl: url.href, ms: Date.now() - started };
  }
};
