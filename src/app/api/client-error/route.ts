import { sameOrigin } from "@/lib/auth";
import { reportError } from "@/lib/error-alerts";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const cut = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

/** Errors from visitors' browsers: `{ message, stack, path }`. Rate-limited, and only ever turned into one capped email. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (!rateLimit(`client-error:${clientIp(request)}`, 10, 60_000)) return new Response(null, { status: 429 });
  let body: { message?: unknown; stack?: unknown; path?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const message = cut(body?.message, 300);
  if (!message) return new Response(null, { status: 400 });
  const err = new Error(message);
  err.stack = cut(body.stack, 2000);
  await reportError(err, { source: "browser", where: cut(body.path, 200), extra: `Browser: ${cut(request.headers.get("user-agent"), 200)}` });
  return new Response(null, { status: 204 });
}
