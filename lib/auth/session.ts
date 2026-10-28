import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

/**
 * A signed session cookie: `<payload>.<signature>`, both base64url, signed
 * with HMAC-SHA256 under AUTH_SECRET. It says who you are and whether you have
 * picked a username, so proxy.ts can route without a database read. Anything
 * that matters (the profile, the keys) is read from the store per request.
 */

export const SESSION_COOKIE = "df_session";
export const OAUTH_COOKIE = "df_oauth";
export const SESSION_DAYS = 30;

export interface Session {
  uid: string;
  email: string;
  /** Has a username, so onboarding is done. */
  onb: boolean;
  /** Expiry, ms since epoch. */
  exp: number;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function mac(data: string): Buffer {
  if (!config.auth.secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", config.auth.secret).update(data).digest();
}

export function sign(payload: object): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(mac(body))}`;
}

export function unsign<T>(token: string | undefined): T | null {
  if (!token || !config.auth.secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = mac(body);
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T; } catch { return null; }
}

export function readSession(token: string | undefined): Session | null {
  const s = unsign<Session>(token);
  return s && typeof s.uid === "string" && s.exp > Date.now() ? s : null;
}

export function newSession(uid: string, email: string, onb: boolean): { value: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 86_400;
  return { value: sign({ uid, email, onb, exp: Date.now() + maxAge * 1000 } satisfies Session), maxAge };
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
