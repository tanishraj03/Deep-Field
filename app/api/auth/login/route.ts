import { NextResponse, type NextRequest } from "next/server";
import { googleConfigured, safeNext, startLogin } from "@/lib/auth/google";
import { cookieOptions, OAUTH_COOKIE, sign } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Sends the browser to Google, remembering the state and PKCE verifier for ten minutes. */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=setup", req.url));
  }
  const { url, state, verifier } = startLogin(req.nextUrl.origin);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, sign({ state, verifier, next: safeNext(req.nextUrl.searchParams.get("next")) }), cookieOptions(600));
  return res;
}
