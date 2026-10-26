import { currentUser, sameOrigin } from "@/lib/auth";
import { MAX_LOGO_BYTES, sniffImage } from "@/lib/branding";
import { clientView, getClient, listClients, removeClientLogo, saveClientLogo } from "@/lib/clients";
import { entitlementsFor } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";

const TOO_BIG = `That file is too big. Use an image under ${MAX_LOGO_BYTES / 1024} KB.`;
const view = (userId: number, id: number) => clientView(listClients(userId).find((c) => c.id === id)!);

/** Uploads a client's own logo, shown on its status page and reports. */
export async function POST(request: Request, ctx: RouteContext<"/api/clients/[id]/logo">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!entitlementsFor(user.plan).clients) return Response.json({ error: "Clients are part of the Agency plan.", code: "plan_required" }, { status: 403 });
  if (!rateLimit(`logo-upload:${user.id}`, 60, 60 * 60 * 1000)) return Response.json({ error: "Too many uploads. Try again later." }, { status: 429 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !getClient(id, user.id)) return Response.json({ error: "Client not found." }, { status: 404 });

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
  saveClientLogo(id, user.id, bytes, type);
  return Response.json({ client: view(user.id, id) }, { status: 201 });
}

/** Back to the account's own logo. Always allowed. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/clients/[id]/logo">) {
  if (!sameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = currentUser(request);
  if (!user) return Response.json({ error: "Log in first." }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !getClient(id, user.id)) return Response.json({ error: "Client not found." }, { status: 404 });
  removeClientLogo(id, user.id);
  return Response.json({ client: view(user.id, id) });
}
