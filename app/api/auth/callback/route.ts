import { NextResponse, type NextRequest } from "next/server";
import { SUSPENDED_MESSAGE } from "@/lib/auth";
import { finishLogin } from "@/lib/auth/google";
import { cookieOptions, newSession, OAUTH_COOKIE, SESSION_COOKIE, unsign } from "@/lib/auth/session";
import { getUser, isAdmin, upsertGoogleUser } from "@/lib/auth/users";
import { deviceOf, getPlatform, recordLogin } from "@/lib/platform";

export const dynamic = "force-dynamic";

/** Vercel's geolocation headers, decoded; null when absent (local, or not on Vercel). */
const geo = (req: NextRequest, name: string) => {
  const v = req.headers.get(name);
  try { return v ? decodeURIComponent(v) : null; } catch { return v; }
};

/** Google sends the browser back here with a code; trade it for the account and start a session. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, req.url));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  };

  const saved = unsign<{ state: string; verifier: string; next: string }>(req.cookies.get(OAUTH_COOKIE)?.value);
  if (p.get("error")) return fail(p.get("error") === "access_denied" ? "Sign-in was cancelled." : "Google couldn't sign you in. Try again.");
  if (!saved || !p.get("code") || p.get("state") !== saved.state) return fail("That sign-in link expired. Try again.");

  try {
    const profile = await finishLogin(req.nextUrl.origin, p.get("code")!, saved.verifier);
    const existing = await getUser(`g:${profile.sub}`);
    if (existing?.suspended) return fail(SUSPENDED_MESSAGE);
    // Closing sign-ups stops new accounts only; the admin is never locked out.
    if (!existing && !isAdmin(profile) && !(await getPlatform()).signupsOpen) {
      return fail("DeepField isn't taking new sign-ups right now. Check back soon.");
    }

    const user = await upsertGoogleUser(profile);
    await recordLogin({
      uid: user.id, email: user.email, name: user.name, at: user.lastLoginAt, created: !existing,
      country: geo(req, "x-vercel-ip-country"), city: geo(req, "x-vercel-ip-city"),
      device: deviceOf(req.headers.get("user-agent")),
    });

    const session = newSession(user.id, user.email, !!user.username);
    // The admin picks between the service dashboard and their own feed, unless
    // they were on their way somewhere in particular.
    const to = !user.username ? "/welcome" : isAdmin(user) && saved.next === "/" ? "/admin/start" : saved.next;
    const res = NextResponse.redirect(new URL(to, req.url));
    res.cookies.set(SESSION_COOKIE, session.value, cookieOptions(session.maxAge));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  } catch (e) {
    console.error("Sign-in failed:", e);
    // Google's own wording for the cases people can act on; nothing internal.
    const message = (e as Error).message;
    return fail(/^(Verify|The sign-in expired|Google did not share|This sign-in was meant)/.test(message) ? message : "Sign-in didn't go through. Try again.");
  }
}
