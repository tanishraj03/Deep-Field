import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { currentUser } from "./index";
import { isAdmin, type User } from "./users";

export { ADMIN_EMAIL, isAdmin } from "./users";

/**
 * For admin pages: the admin, or a plain 404 for everyone else, signed in or
 * not, so the dashboard's existence is not advertised.
 */
export async function requireAdmin(): Promise<User> {
  const user = await currentUser();
  if (!isAdmin(user)) notFound();
  return user!;
}

const notFoundJson = () => NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

/**
 * For admin API routes. Non-admins get the same 404 as a missing route. A
 * change must also come from this site's own pages: the Origin header has to
 * match, on top of the SameSite session cookie.
 */
export async function withAdmin(req: Request, fn: (admin: User) => Promise<Response>): Promise<Response> {
  const user = await currentUser();
  if (!isAdmin(user)) return notFoundJson();
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let from = "";
    try { from = origin ? new URL(origin).host : ""; } catch { /* "null" and the like: not this site */ }
    if (!from || !host || from !== host) {
      return NextResponse.json({ ok: false, error: "That request didn't come from DeepField." }, { status: 403 });
    }
  }
  return fn(user!);
}
