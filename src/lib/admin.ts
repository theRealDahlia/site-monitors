/**
 * Admin powers (the plan switcher in the profile menu) exist only to test the site on every plan while
 * developing. They work ONLY when the app runs in development mode (`next dev`). There is no setting,
 * flag or environment variable that turns them on anywhere else, so a production server can never
 * treat anyone as an admin, whatever its database contains.
 *
 * Everything that asks "is this user an admin?" goes through currentUser() in auth.ts, which applies
 * this check.
 */
export function adminEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
