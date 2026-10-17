import { getLogo } from "@/lib/branding";

/**
 * Serves an uploaded logo. Public, because status pages show it to anyone. The address is random and
 * changes with every upload, so it can be cached for good. The headers make sure the browser only
 * ever treats it as a plain image, never as a page that could run anything.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/logo/[id]">) {
  const logo = getLogo((await ctx.params).id);
  if (!logo) return new Response("Not found.", { status: 404 });
  return new Response(Buffer.from(logo.bytes), {
    headers: {
      "Content-Type": logo.type,
      "Content-Length": String(logo.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
