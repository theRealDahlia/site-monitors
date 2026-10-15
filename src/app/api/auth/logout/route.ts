import { endSession, sameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": endSession(request) } });
}
