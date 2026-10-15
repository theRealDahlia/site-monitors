/** Server secret used to sign cookies and key code hashes. Required in production. */
export function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production.");
  }
  return "dev-only-secret-change-me";
}
