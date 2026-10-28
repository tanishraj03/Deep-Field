import { NextResponse, type NextRequest } from "next/server";
import { finishLogin } from "@/lib/auth/google";
import { cookieOptions, newSession, OAUTH_COOKIE, SESSION_COOKIE, unsign } from "@/lib/auth/session";
import { upsertGoogleUser } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

/** Google sends the browser back here with a code; trade it for the account and start a session. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, req.url));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  };

  const saved = unsign<{ state: string; verifier: string; next: string }>(req.cookies.get(OAUTH_COOKIE)?.value);
  if (p.get("error")) return fail(p.get("error") === "access_denied" ? "Sign-in was cancelled." : `Google said: ${p.get("error")}`);
  if (!saved || !p.get("code") || p.get("state") !== saved.state) return fail("That sign-in link expired. Try again.");

  try {
    const profile = await finishLogin(req.nextUrl.origin, p.get("code")!, saved.verifier);
    const user = await upsertGoogleUser(profile);
    const session = newSession(user.id, user.email, !!user.username);
    const res = NextResponse.redirect(new URL(user.username ? saved.next : "/welcome", req.url));
    res.cookies.set(SESSION_COOKIE, session.value, cookieOptions(session.maxAge));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  } catch (e) {
    return fail((e as Error).message);
  }
}
