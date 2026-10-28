import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * The front door. Signed-out visitors go to /login, signed-in ones without a
 * username go to /welcome. This is only routing: every API route checks the
 * session again itself (lib/auth) before spending anyone's keys.
 */

const OPEN = ["/login", "/api/auth/"];
/** The scheduler calls these with CRON_SECRET instead of a session. */
const CRON = ["/api/scan", "/api/schedule"];

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (OPEN.some((p) => path === p || path.startsWith(p))) return NextResponse.next();

  const api = path.startsWith("/api/");
  const secret = process.env.CRON_SECRET;
  if (api && secret && CRON.some((p) => path.startsWith(p)) && req.headers.get("authorization") === `Bearer ${secret}`) {
    return NextResponse.next();
  }

  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (api) return NextResponse.json({ ok: false, error: "Sign in to DeepField first." }, { status: 401 });
    const login = new URL("/login", req.url);
    if (path !== "/") login.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (!api && !session.onb && path !== "/welcome") return NextResponse.redirect(new URL("/welcome", req.url));
  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets and files with an extension (icons, images).
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
