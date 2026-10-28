import { createHash, randomBytes } from "node:crypto";
import { config } from "@/lib/config";

/**
 * Sign in with Google: the authorization-code flow with PKCE, no SDK.
 * The id token comes straight from Google's token endpoint over TLS, so its
 * claims are read without re-checking the signature (Google's documented
 * allowance for tokens fetched directly); audience, issuer, expiry and
 * email_verified are still checked.
 */

export const googleConfigured = () => Boolean(config.auth.googleClientId && config.auth.googleClientSecret && config.auth.secret);

/** Where to land after signing in: a path on this site, never another one. */
export const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") && !n.startsWith("/api/") ? n : "/");

export const callbackUrl = (origin: string) => `${origin}/api/auth/callback`;

export function startLogin(origin: string) {
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.auth.googleClientId,
    redirect_uri: callbackUrl(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), state, verifier };
}

export interface GoogleProfile { sub: string; email: string; name: string; picture: string | null }

export async function finishLogin(origin: string, code: string, verifier: string): Promise<GoogleProfile> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.auth.googleClientId,
      client_secret: config.auth.googleClientSecret,
      redirect_uri: callbackUrl(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { id_token?: string; error_description?: string; error?: string };
  if (!res.ok || !json.id_token) throw new Error(json.error_description ?? json.error ?? `Google answered HTTP ${res.status}`);

  const claims = JSON.parse(Buffer.from(json.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
    sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string; aud?: string; iss?: string; exp?: number;
  };
  if (claims.aud !== config.auth.googleClientId) throw new Error("This sign-in was meant for another app.");
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") throw new Error("Unexpected token issuer.");
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("The sign-in expired. Try again.");
  if (!claims.sub || !claims.email) throw new Error("Google did not share an email address.");
  // Must be confirmed, not merely "not denied": an email decides who the
  // admin is, so an account Google has not verified signs in as nobody.
  if (claims.email_verified !== true) throw new Error("Verify your Google email address first.");
  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    name: claims.name ?? claims.email.split("@")[0],
    picture: claims.picture ?? null,
  };
}
