import { currentUser, sameOrigin } from "@/lib/auth";
import { getBranding, saveTheme } from "@/lib/branding";
import { isAccent, isThemeMode } from "@/lib/theme";

export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json(getBranding(user.id));
}

/** Saves light/dark and the accent colour. Every plan can do this. */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });

  let body: { mode?: unknown; accent?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const accent = typeof body.accent === "string" ? body.accent.trim().toLowerCase() : null;
  if (!isThemeMode(body.mode) || !isAccent(accent)) return Response.json({ error: "Choose a theme and a colour." }, { status: 400 });
  saveTheme(user.id, body.mode, accent);
  return Response.json(getBranding(user.id));
}
