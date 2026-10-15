/** Only allow redirects to a path on this site, never to another origin. */
export function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/";
  return /^\/(?![/\\])[^\s]*$/.test(next) ? next : "/";
}
