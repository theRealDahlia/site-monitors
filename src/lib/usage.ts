import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { secret } from "./secret";

export const FREE_LIMIT = 4;

const COOKIE = "sm_visitor";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface Visitor {
  id: string;
  /** Free checks already used, as recorded in the cookie. */
  used: number;
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

  const [id, used] = payload.split(":");
  const n = Number(used);
  return id && Number.isInteger(n) && n >= 0 ? { id, used: n } : null;
}

/** The server's own count per visitor id. It stops parallel requests all reading "0 used". */
const serverCounts = new Map<string, number>();

export function readVisitor(request: Request): Visitor {
  const fromCookie = parseCookie(request.headers.get("cookie"));
  if (!fromCookie) return { id: randomBytes(12).toString("base64url"), used: 0 };
  return { id: fromCookie.id, used: Math.max(fromCookie.used, serverCounts.get(fromCookie.id) ?? 0) };
}

/** Takes one free check if any are left. Pair with `release` if the check then fails. */
export function reserve(visitor: Visitor): boolean {
  if (visitor.used >= FREE_LIMIT) return false;
  visitor.used += 1;
  serverCounts.set(visitor.id, visitor.used);
  if (serverCounts.size > 20_000) serverCounts.delete(serverCounts.keys().next().value!);
  return true;
}

export function release(visitor: Visitor): void {
  visitor.used = Math.max(0, visitor.used - 1);
  serverCounts.set(visitor.id, visitor.used);
}

export function cookieHeader(visitor: Visitor): string {
  const payload = `${visitor.id}:${visitor.used}`;
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
