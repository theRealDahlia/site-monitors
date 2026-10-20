import { clientIp, rateLimit } from "@/lib/rate-limit";
import { readInvite } from "@/lib/teams";

/** Who an invitation link is from and for, so the join page can say so before anyone signs in. */
export async function GET(request: Request) {
  if (!rateLimit(`invite-info:${clientIp(request)}`, 30, 60_000)) return Response.json({ error: "Too many requests." }, { status: 429 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const info = token.length <= 100 ? readInvite(token) : null;
  if (!info) return Response.json({ error: "This invitation has expired or was withdrawn." }, { status: 404 });
  return Response.json(info);
}
