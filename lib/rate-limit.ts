import { NextResponse } from "next/server";

/**
 * Per-person limits on the things that cost the service: Explore searches,
 * chats and comment reads hit the free sources (Reddit archive, Bluesky,
 * GDELT…) from this server's address, which every user shares, so one person
 * hammering them could get everyone rate-limited. Generous for real use.
 *
 * Counted in memory per server instance: a first line of defence that costs
 * no database writes, not an exact global count.
 */

export const LIMITS = {
  explore: { max: 40, windowMs: 10 * 60_000 },
  insight: { max: 30, windowMs: 10 * 60_000 },
  discussion: { max: 40, windowMs: 10 * 60_000 },
  chat: { max: 60, windowMs: 60 * 60_000 },
  export: { max: 30, windowMs: 10 * 60_000 },
  keys: { max: 20, windowMs: 10 * 60_000 },
  feedback: { max: 120, windowMs: 10 * 60_000 },
  profile: { max: 60, windowMs: 60_000 },
  suggest: { max: 10, windowMs: 24 * 60 * 60_000 },
} as const;

export type LimitKind = keyof typeof LIMITS;

const hits = new Map<string, number[]>();
let sweptAt = Date.now();

/** Record one use. Returns how many seconds to wait when over the limit, or 0. */
export function take(uid: string, kind: LimitKind, now = Date.now()): number {
  const { max, windowMs } = LIMITS[kind];
  const key = `${kind}:${uid}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
  }
  recent.push(now);
  hits.set(key, recent);
  // Now and then, forget people who have gone quiet, so the map can't grow forever.
  if (now - sweptAt > 10 * 60_000) {
    sweptAt = now;
    for (const [k, ts] of hits) if (!ts.length || now - ts[ts.length - 1] > 24 * 60 * 60_000) hits.delete(k);
  }
  return 0;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
const wait = (s: number) => (s >= 3600 ? plural(Math.ceil(s / 3600), "hour") : s >= 60 ? plural(Math.ceil(s / 60), "minute") : plural(s, "second"));

/** For API routes: a 429 to return when over the limit, or null to go ahead. */
export function limited(uid: string, kind: LimitKind): Response | null {
  const retry = take(uid, kind);
  if (!retry) return null;
  return NextResponse.json(
    { ok: false, error: `You're doing that a lot. Try again in ${wait(retry)}.` },
    { status: 429, headers: { "Retry-After": String(retry) } },
  );
}
