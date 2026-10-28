import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { envKeys, runWithKeys } from "@/lib/keys";
import { touchSeen } from "@/lib/platform";
import { readSession, SESSION_COOKIE } from "./session";
import { getUser, isAdmin, keysFor, type User } from "./users";

export { isAdmin, usesServerKeys, type User } from "./users";

export const SUSPENDED_MESSAGE = "This account has been suspended. If you think that's a mistake, get in touch with the DeepField team.";

/**
 * The account behind the session cookie, read from the store once per
 * request: the cookie only says who you are, never what you may do. A
 * suspended account comes back with suspended set.
 */
const sessionAccount = cache(async (): Promise<User | null> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return getUser(session.uid).catch(() => null);
});

/**
 * The signed-in user, or null when signed out. A suspended account counts as
 * signed out, so suspending someone locks every page and API at once, even
 * though their cookie is still validly signed.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const user = await sessionAccount();
  if (!user || user.suspended) return null;
  touchSeen(user.id);
  return user;
});

/** For pages: the signed-in, onboarded user, or a redirect to sign in. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect((await sessionAccount())?.suspended ? `/login?error=${encodeURIComponent(SUSPENDED_MESSAGE)}` : "/login");
  if (!user.username) redirect("/welcome");
  return user;
}

/** For pages that show what the user's keys unlock: run fn with their keys. */
export async function withPageKeys<T>(fn: (user: User) => T | Promise<T>): Promise<T> {
  const user = await requireUser();
  const keys = await keysFor(user);
  return runWithKeys(keys, () => fn(user));
}

export const unauthorized = () => NextResponse.json({ ok: false, error: "Sign in to DeepField first." }, { status: 401 });

/**
 * For API routes: run the handler as the signed-in user, spending only
 * their keys (lib/keys.ts). Signed-out callers get a 401.
 */
export async function withUser(fn: (user: User) => Promise<Response>): Promise<Response> {
  const user = await currentUser();
  if (!user) return unauthorized();
  const keys = await keysFor(user);
  return runWithKeys(keys, () => fn(user));
}

/** The scheduler's bearer token, which runs with the server's own keys. */
export function isCron(req: Request): boolean {
  return !!config.cronSecret && req.headers.get("authorization") === `Bearer ${config.cronSecret}`;
}

/** Run as the scheduler (server keys) when it holds CRON_SECRET, otherwise as the signed-in user. */
export async function withUserOrCron(req: Request, fn: (user: User | null) => Promise<Response>): Promise<Response> {
  if (isCron(req)) return runWithKeys(envKeys(), () => fn(null));
  return withUser(fn);
}

/** For API routes only the admin may call: a 403 for anyone else, or null to go ahead. */
export const adminOnly = (user: User | null) => (!isAdmin(user)
  ? NextResponse.json({ ok: false, error: "Only the DeepField admin can change this." }, { status: 403 })
  : null);
