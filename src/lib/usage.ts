import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { secret } from "./secret";

/** Free checks a visitor gets per window. */
export const FREE_LIMIT = 4;
/** The window is a rolling 24 hours that starts at the visitor's first check. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;

const COOKIE = "sm_visitor";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface Visitor {
  id: string;
  /** Free checks used in the current window. */
  used: number;
  /** When the current window began (epoch ms). It ends WINDOW_MS later and the count starts again. */
  windowStart: number;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function parseCookie(header: string | null): Visitor | null {
  const raw = header
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;

  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const [id, used, start] = payload.split(":");
  const n = Number(used);
  if (!id || !Number.isInteger(n) || n < 0) return null;
  // Cookies from before the daily window existed have no start time; begin their window now.
  const windowStart = start === undefined ? Date.now() : Number(start);
  return Number.isFinite(windowStart) ? { id, used: n, windowStart } : null;
}

/** The server's own count per visitor id. It stops parallel requests all reading "0 used". */
const serverCounts = new Map<string, { used: number; windowStart: number }>();

export function readVisitor(request: Request, now = Date.now()): Visitor {
  const fromCookie = parseCookie(request.headers.get("cookie"));
  if (!fromCookie) return { id: randomBytes(12).toString("base64url"), used: 0, windowStart: now };

  // Trust whichever record is from the newer window; within the same window take the higher count.
  let { used, windowStart } = fromCookie;
  const server = serverCounts.get(fromCookie.id);
  if (server) {
    if (server.windowStart > windowStart) ({ used, windowStart } = server);
    else if (server.windowStart === windowStart) used = Math.max(used, server.used);
  }

  // A window that has run its 24 hours starts over.
  if (now - windowStart >= WINDOW_MS) {
    used = 0;
    windowStart = now;
  }
  return { id: fromCookie.id, used, windowStart };
}

/** When this visitor's free checks come back, or null if they haven't used any. */
export function resetsAt(visitor: Visitor): number | null {
  return visitor.used > 0 ? visitor.windowStart + WINDOW_MS : null;
}

function remember(visitor: Visitor) {
  serverCounts.set(visitor.id, { used: visitor.used, windowStart: visitor.windowStart });
  if (serverCounts.size > 20_000) serverCounts.delete(serverCounts.keys().next().value!);
}

/** Takes one free check if any are left. Pair with `release` if the check then fails. */
export function reserve(visitor: Visitor): boolean {
  if (visitor.used >= FREE_LIMIT) return false;
  visitor.used += 1;
  remember(visitor);
  return true;
}

export function release(visitor: Visitor): void {
  visitor.used = Math.max(0, visitor.used - 1);
  remember(visitor);
}

export function cookieHeader(visitor: Visitor): string {
  const payload = `${visitor.id}:${visitor.used}:${visitor.windowStart}`;
  const flags = [
    `${COOKIE}=${payload}.${sign(payload)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") flags.push("Secure");
  return flags.join("; ");
}
