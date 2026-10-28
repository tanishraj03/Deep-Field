import { NextResponse, type NextRequest } from "next/server";
import { currentUser, unauthorized } from "@/lib/auth";
import { cookieOptions, newSession, SESSION_COOKIE } from "@/lib/auth/session";
import { checkUsername, savePrefs, setUsername, usernameTaken } from "@/lib/auth/users";
import { cleanPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

/** Is a username free? ?username=<name>, for the onboarding form as you type. */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const check = checkUsername(req.nextUrl.searchParams.get("username") ?? "");
  if (!check.ok) return NextResponse.json({ ok: true, available: false, error: check.error });
  const taken = await usernameTaken(check.name, user.id);
  return NextResponse.json({ ok: true, available: !taken, error: taken ? "That username is taken." : null });
}

/** Set the username and/or the feed answers: { username?, prefs? }. */
export async function PUT(req: NextRequest) {
  let user = await currentUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { username?: string; prefs?: Record<string, unknown> };
  try {
    if (typeof body.username === "string") user = await setUsername(user, body.username);
    if (body.prefs && typeof body.prefs === "object") user = await savePrefs(user, cleanPrefs(body.prefs));
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, username: user.username, prefs: user.prefs });
  // The session records that onboarding is done, so proxy.ts stops sending you to /welcome.
  const session = newSession(user.id, user.email, !!user.username);
  res.cookies.set(SESSION_COOKIE, session.value, cookieOptions(session.maxAge));
  return res;
}
