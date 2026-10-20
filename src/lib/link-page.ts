// The small pages behind links in emails (confirm, unsubscribe, acknowledge). They're plain and unbranded, because
// some are shown on an owner's own domain, and each one only acts when its button is pressed (a POST): email security
// scanners open links by themselves, and must not be able to confirm, unsubscribe or acknowledge anything.

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A whole page. `body` is HTML: escape anything that came from a person with `esc`. */
export function linkPage(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 64px 16px; background: Canvas; color: CanvasText; }
  main { max-width: 28rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
  p { opacity: .8; }
  button { font: inherit; padding: .6rem 1.2rem; border-radius: .5rem; border: 0; background: #0f766e; color: #fff; cursor: pointer; }
  a { color: inherit; }
</style></head><body><main>${body}</main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

/** A heading, a line of text, and (when `button` is given) a button that POSTs back to the same address. */
export const askPage = (title: string, text: string, button?: string) =>
  linkPage(title, `<h1>${esc(title)}</h1><p>${text}</p>${button ? `<form method="post"><button type="submit">${esc(button)}</button></form>` : ""}`);

export const expiredPage = () =>
  linkPage("Link expired", `<h1>This link has expired</h1><p>It may have been used already, or it's no longer valid.</p>`, 404);
