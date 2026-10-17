import { currentUser, sameOrigin } from "@/lib/auth";
import { MAX_LOGO_BYTES, getBranding, removeLogo, saveLogo, sniffImage } from "@/lib/branding";
import { rateLimit } from "@/lib/rate-limit";

const TOO_BIG = `That file is too big. Use an image under ${MAX_LOGO_BYTES / 1024} KB.`;

/** Uploads the account's own logo, shown in the dashboard and on its public status pages. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!rateLimit(`logo-upload:${user.id}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }
  // Refuse an oversized upload from its declared size, before reading any of it.
  const declared = Number(request.headers.get("content-length"));
  if (!declared || declared > MAX_LOGO_BYTES + 16 * 1024) return Response.json({ error: TOO_BIG }, { status: 413 });

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("logo");
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose an image to upload." }, { status: 400 });
  if (file.size > MAX_LOGO_BYTES) return Response.json({ error: TOO_BIG }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return Response.json({ error: "Use a PNG, JPEG or WebP image." }, { status: 400 });
  saveLogo(user.id, bytes, type);
  return Response.json(getBranding(user.id), { status: 201 });
}

/** Goes back to no logo of their own. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  removeLogo(user.id);
  return Response.json(getBranding(user.id));
}
