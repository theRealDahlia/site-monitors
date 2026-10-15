// In-memory, per-process counters. Fine for a single server; they reset on restart and aren't
// shared between instances, so swap for Redis/Upstash once deployed on serverless.
interface Bucket {
  times: number[];
  windowMs: number;
}
const buckets = new Map<string, Bucket>();

function recent(key: string, windowMs: number): number[] {
  const now = Date.now();
  const times = (buckets.get(key)?.times ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, { times, windowMs });
  return times;
}

function sweep() {
  if (buckets.size <= 5000) return;
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.times.every((t) => now - t >= b.windowMs)) buckets.delete(k);
  }
}

/** Counts this call and returns false once `limit` calls have happened inside the window. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const times = recent(key, windowMs);
  if (times.length >= limit) return false;
  times.push(Date.now());
  sweep();
  return true;
}

/** How many times `record` has been called for this key inside the window. */
export function countInWindow(key: string, windowMs: number): number {
  return recent(key, windowMs).length;
}

export function record(key: string, windowMs: number): void {
  recent(key, windowMs).push(Date.now());
  sweep();
}

/**
 * The visitor's IP as seen by our own proxy. Anything left of that in x-forwarded-for was
 * supplied by the client and can be faked, so count from the right. Set TRUSTED_PROXY_HOPS
 * to the number of proxies in front of the app (Vercel/Fly/Cloudflare alone = 1).
 */
export function clientIp(request: Request): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  const parts = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[parts.length - hops] || "local";
}
