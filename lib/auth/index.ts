import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { envKeys, runWithKeys } from "@/lib/keys";
import { readSession, SESSION_COOKIE } from "./session";
import { getUser, isOwner, keysFor, type User } from "./users";

export { isOwner, type User } from "./users";

/** The signed-in user, read once per request. Null when signed out. */
export const currentUser = cache(async (): Promise<User | null> => {
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return getUser(session.uid).catch(() => null);
});

/** For pages: the signed-in, onboarded user, or a redirect to sign in. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
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

export const ownerOnly = (user: User | null) => (user && !isOwner(user)
  ? NextResponse.json({ ok: false, error: "Only the workspace owner can change this." }, { status: 403 })
  : null);
