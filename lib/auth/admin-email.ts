/*
  Its own file, with no imports, so the front door (proxy.ts) can check it
  without loading the database client.
*/

/**
 * The one account with admin access to the service dashboard.
 *
 * Fixed in code on purpose. No environment variable, setting, database row or
 * admin action can add a second admin, so taking over any of those cannot
 * grant it either. The email is the one Google verified at sign-in
 * (lib/auth/google.ts refuses unverified ones). Pages and API routes read it
 * from the stored account on every request; proxy.ts reads it from the signed
 * session only to turn everyone else away early.
 */
export const ADMIN_EMAIL = "tanishraj05@gmail.com";
