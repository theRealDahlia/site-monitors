import { currentUser } from "./auth";
import { CheckError } from "./hostname";
import { clientIp, countInWindow, rateLimit, record } from "./rate-limit";
import { FREE_LIMIT, cookieHeader, readVisitor, release, reserve } from "./usage";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Backstop for people who clear cookies: successful free checks per IP per day. */
const IP_DAILY_LIMIT = 12;
/** Attempts of any kind per IP per minute, so failed lookups can't be hammered either. */
const IP_BURST_LIMIT = 10;
/** Fair-use ceiling for signed-in accounts, so one account can't be used to run a scraper. */
const ACCOUNT_DAILY_LIMIT = 300;

export interface UsageInfo {
  used: number;
  limit: number;
  /** Accounts are only created after their email is confirmed, so signed in means unlimited. */
  signedIn: boolean;
}

const LIMIT_REACHED = {
  error: "You've used your free checks. Create a free account to keep checking.",
  code: "free_limit_reached",
  usage: { used: FREE_LIMIT, limit: FREE_LIMIT, signedIn: false } satisfies UsageInfo,
};

export function currentUsage(request: Request): UsageInfo & { email?: string } {
  const user = currentUser(request);
  if (user) return { used: 0, limit: FREE_LIMIT, signedIn: true, email: user.email };

  const visitor = readVisitor(request);
  const ipExhausted = countInWindow(`ip-day:${clientIp(request)}`, DAY_MS) >= IP_DAILY_LIMIT;
  return {
    used: ipExhausted ? FREE_LIMIT : Math.min(visitor.used, FREE_LIMIT),
    limit: FREE_LIMIT,
    signedIn: false,
  };
}

function failure(err: unknown): Response {
  if (err instanceof CheckError) {
    return Response.json({ error: err.message }, { status: err.httpStatus });
  }
  console.error("check failed", err);
  return Response.json({ error: "Something went wrong running the check." }, { status: 500 });
}

/**
 * Runs one check for `request`. Signed-in accounts aren't metered beyond a fair-use ceiling.
 * Everyone else gets FREE_LIMIT free checks, and a check only counts against them when it
 * succeeds, so a typo or an unreachable server doesn't use one up.
 */
export async function gatedCheck<T extends object>(
  request: Request,
  run: (host: string) => Promise<T>,
): Promise<Response> {
  const ip = clientIp(request);
  const host = new URL(request.url).searchParams.get("host") ?? "";

  if (!rateLimit(`ip-burst:${ip}`, IP_BURST_LIMIT, 60_000)) {
    return Response.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  }

  const user = currentUser(request);
  if (user) {
    if (!rateLimit(`acct-day:${user.id}`, ACCOUNT_DAILY_LIMIT, DAY_MS)) {
      return Response.json(
        { error: "You've reached today's fair-use limit of checks. Try again tomorrow." },
        { status: 429 },
      );
    }
    try {
      const result = await run(host);
      return Response.json({ ...result, usage: { used: 0, limit: FREE_LIMIT, signedIn: true } satisfies UsageInfo });
    } catch (err) {
      return failure(err);
    }
  }

  if (countInWindow(`ip-day:${ip}`, DAY_MS) >= IP_DAILY_LIMIT) {
    return Response.json(LIMIT_REACHED, { status: 429 });
  }

  const visitor = readVisitor(request);
  if (!reserve(visitor)) {
    return Response.json(LIMIT_REACHED, {
      status: 429,
      headers: { "Set-Cookie": cookieHeader({ ...visitor, used: FREE_LIMIT }) },
    });
  }

  try {
    const result = await run(host);
    record(`ip-day:${ip}`, DAY_MS);
    return Response.json(
      { ...result, usage: { used: visitor.used, limit: FREE_LIMIT, signedIn: false } satisfies UsageInfo },
      { headers: { "Set-Cookie": cookieHeader(visitor) } },
    );
  } catch (err) {
    release(visitor);
    return failure(err);
  }
}
