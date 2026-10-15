import { insertSignup } from "@/lib/db";
import { CheckError, parseHostname } from "@/lib/hostname";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Where the signup came from: a checker's result box, or the early-access forms.
const KINDS = new Set(["ssl", "domain", "account"]);

export async function POST(request: Request) {
  if (!rateLimit(`waitlist:${clientIp(request)}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: { email?: unknown; clients?: unknown; watch?: unknown; kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const clients = typeof body.clients === "string" ? body.clients.slice(0, 40) : "";
  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : undefined;

  // Optional: a domain the visitor asked us to watch once monitoring launches.
  let watch: string | undefined;
  if (typeof body.watch === "string" && body.watch) {
    try {
      watch = parseHostname(body.watch, { ignorePort: true });
    } catch (err) {
      if (err instanceof CheckError) {
        return Response.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  insertSignup({ email, kind, watch, clients });
  return Response.json({ ok: true });
}
